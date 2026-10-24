import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { assertSecrets, checkMission, checkReceipt, json } from './protocol.mjs';
const rand=()=>randomBytes(24).toString('hex');
function eq(a,b){const x=createHash('sha256').update(a||'').digest(),y=createHash('sha256').update(b||'').digest();return timingSafeEqual(x,y);}
async function body(req) {let n=0,parts=[];for await(const chunk of req){n+=chunk.length;if(n>25000) throw Object.assign(new Error('BODY_TOO_LARGE'),{status:413});parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Object.assign(new Error('BAD_JSON'),{status:400});}}
export class Relay {
  constructor({dbFile,tokens,leaseMs=120000,maxAttempts=5}) {
    assertSecrets(tokens,['JM_PRODUCER_TOKEN','JM_RUNNER_TOKEN','JM_MISSION_KEY','JM_RECEIPT_KEY']);
    if(!(leaseMs>=100 && leaseMs<=1800000) || !(maxAttempts>=1 && maxAttempts<=50)) throw new Error('BAD_CONFIG');
    if(!/^[A-Za-z0-9_-]{2,48}$/.test(tokens.JM_ALLOWED_RUNNER_ID||''))throw new Error('JM_ALLOWED_RUNNER_ID_REQUIRED');
    this.t=tokens;this.leaseMs=leaseMs;this.maxAttempts=maxAttempts;
    this.db=new DatabaseSync(dbFile,{timeout:5000});
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
       CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,job_hash TEXT NOT NULL, mission TEXT NOT NULL,target TEXT NOT NULL,state TEXT NOT NULL,lease_token TEXT,lease_until INTEGER,attempts INTEGER NOT NULL DEFAULT 0,receipt TEXT,created_ms INTEGER NOT NULL,updated_ms INTEGER NOT NULL);
       CREATE INDEX IF NOT EXISTS jobs_queue ON jobs(state,created_ms);`);
  }
  tx(fn){this.db.exec('BEGIN IMMEDIATE');try{const x=fn();this.db.exec('COMMIT');return x;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  get(id){return this.db.prepare('SELECT id,job_hash,state,attempts,lease_until,receipt,created_ms,updated_ms FROM jobs WHERE id=?').get(id)??null;}
  auth(req,role){let token=(req.headers.authorization||'');return token.startsWith('Bearer ') && eq(token.slice(7),this.t[role]);}
  async handle(req){
    const url=new URL(req.url,'http://127.0.0.1'); const path=url.pathname; const method=req.method;
    try {
      if(path==='/health' && method==='GET')return json({ok:true,service:'jm-revolving-relay',mode:'local-test-relay'});
      const isRunner=(path==='/v1/claim' || path==='/v1/receipt');
      if(!this.auth(req,isRunner?'JM_RUNNER_TOKEN':'JM_PRODUCER_TOKEN'))return json({error:'UNAUTHORIZED'},401);
      if(path==='/v1/missions' && method==='POST') {
        const reqBody=await body(req),mission=reqBody?.mission;
        const fingerprint=await checkMission(mission,this.t.JM_MISSION_KEY);
        if(mission.target!==this.t.JM_ALLOWED_RUNNER_ID)return json({error:'UNAUTHORISED_TARGET'},403);
        const out=this.tx(()=>{
          const prev=this.db.prepare('SELECT id,job_hash,state,receipt FROM jobs WHERE id=?').get(mission.id);
          if(prev){if(prev.job_hash!==fingerprint)return {conflict:true};return {duplicate:true,id:mission.id,state:prev.state,receipt:prev.receipt?JSON.parse(prev.receipt):null};}
          const now=Date.now();
          this.db.prepare('INSERT INTO jobs(id,job_hash,mission,target,state,created_ms,updated_ms) VALUES(?,?,?,?,?,?,?)').run(mission.id,fingerprint,JSON.stringify(mission),mission.target,'PENDING',now,now);
          return {id:mission.id,state:'PENDING',duplicate:false};
        });
        return json(out.conflict?{error:'MISSION_ID_CONFLICT'}:out,out.conflict?409:202);
      }
      if(path==='/v1/claim' && method==='GET') {
        const runner=url.searchParams.get('runner');if(!runner || !/^[A-Za-z0-9_-]{2,48}$/.test(runner))return json({error:'BAD_RUNNER'},400);
        if(runner!==this.t.JM_ALLOWED_RUNNER_ID)return json({error:'UNAUTHORISED_RUNNER'},403);
        const claimed=this.tx(()=>{
          const now=Date.now();
          this.db.prepare("UPDATE jobs SET state='HOLD',updated_ms=? WHERE state='LEASED' AND lease_until<=? AND attempts>=? AND receipt IS NULL").run(now,now,this.maxAttempts);
          const found=this.db.prepare("SELECT id,mission,job_hash,attempts FROM jobs WHERE target=? AND (state='PENDING' OR (state='LEASED' AND lease_until<=?)) ORDER BY created_ms ASC LIMIT 1").get(runner,now);
          if(!found)return null;
          const token=rand(),until=now+this.leaseMs;
          this.db.prepare("UPDATE jobs SET state='LEASED',lease_token=?,lease_until=?,attempts=attempts+1,updated_ms=? WHERE id=?").run(token,until,now,found.id);
          return {id:found.id,mission:JSON.parse(found.mission),job_hash:found.job_hash,lease_token:token,lease_until:until,attempt:found.attempts+1};
        });
        return json({claim:claimed});
      }
      if(path==='/v1/receipt' && method==='POST'){
        const msg=await body(req);if(!msg || typeof msg.id!=='string' || typeof msg.lease_token!=='string')return json({error:'BAD_ACK'},400);
        await checkReceipt(msg.receipt,this.t.JM_RECEIPT_KEY);
        const out=this.tx(()=>{
          const found=this.db.prepare('SELECT job_hash,state,receipt,lease_token FROM jobs WHERE id=?').get(msg.id);
          if(!found)return {error:'MISSING_MISSION',status:404};
          if(msg.receipt.id!==msg.id || found.job_hash!==msg.receipt.job_hash)return {error:'RECEIPT_MISMATCH',status:409};
          if(found.receipt)return JSON.stringify(JSON.parse(found.receipt))===JSON.stringify(msg.receipt)?{ack:true,duplicate:true}:{error:'RECEIPT_CONFLICT',status:409};
          if(found.state!=='LEASED' || !eq(found.lease_token||'',msg.lease_token))return {error:'LEASE_CONFLICT',status:409};
          this.db.prepare('UPDATE jobs SET state=?,receipt=?,lease_token=NULL,lease_until=NULL,updated_ms=? WHERE id=?').run(msg.receipt.status==='PASS'?'DONE':'HOLD',JSON.stringify(msg.receipt),Date.now(),msg.id);
          return {ack:true,duplicate:false};
        });
        return json(out,out.status||200);
      }
      const match=path.match(/^\/v1\/missions\/([A-Za-z0-9_-]{6,80})(\/retry)?$/);
      if(match && method==='GET' && !match[2]){
        const found=this.get(match[1]);return found?json(found):json({error:'MISSING_MISSION'},404);
      }
      if(match && match[2] && method==='POST') {
        const out=this.tx(()=>{
          const row=this.db.prepare('SELECT state,receipt,attempts FROM jobs WHERE id=?').get(match[1]);
          if(!row)return {error:'MISSING_MISSION',status:404};
          if(row.state!=='HOLD' || row.receipt)return {error:'RETRY_NOT_ALLOWED',status:409};
          this.db.prepare("UPDATE jobs SET state='PENDING',attempts=0,lease_token=NULL,lease_until=NULL,updated_ms=? WHERE id=?").run(Date.now(),match[1]);
          return {retry:'STAGED',id:match[1]};
        });return json(out,out.status||200);
      }
      return json({error:'NOT_FOUND'},404);
    } catch(e){return json({error:e.code||e.message||'INTERNAL_ERROR'}, e.status || (/^(BAD_|UNKNOWN_|PROBE_|INVALID_|MISSING_)/.test(e.code||'')?400:500));}
  }
  listen({port=8787,host='127.0.0.1'}={}){
    const server=http.createServer(async(req,res)=>{
      const result=await this.handle(req);
      res.writeHead(result.status,Object.fromEntries(result.headers.entries()));res.end(await result.text());
    });
    return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>resolve(server));});
  }
  close(){this.db.close();}
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  const e=process.env;
  try{const s=new Relay({dbFile:e.JM_RELAY_DB||'./jm_relay.sqlite',tokens:e});s.listen({port:Number(e.JM_RELAY_PORT||8787)}).then(()=>console.log('LOCAL RELAY http://127.0.0.1:'+Number(e.JM_RELAY_PORT||8787)));}
  catch(error){console.error(error.message);process.exitCode=1;}
}
