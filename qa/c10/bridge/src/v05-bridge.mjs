// Candidate member-side adapter for an EXISTING JM Cloud Contact v0.5 space.
// No commands or host state changes on import. No arbitrary actions or paths.
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {signMission,checkReceipt,assertSecrets} from '../revolving-door-v0_1_2_challenge/src/protocol.mjs';
import {canon} from './v05-proof.mjs';
const H=s=>createHash('sha256').update(s).digest('hex');
const safe=s=>typeof s==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(s);
const safeRelayUrl=s=>{let u=new URL(s);if(u.protocol!=='http:'||!['127.0.0.1','localhost'].includes(u.hostname)||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('LOCAL_RELAY_REQUIRED');return u.origin;};
function cloudOrigin(url,localMock){
  let u=new URL(url);
  if(u.href!=='https://jm-cloud-contact-server-v05.onrender.com/'&&!(localMock===true&&u.protocol==='http:'&&['127.0.0.1','localhost'].includes(u.hostname)&&u.pathname==='/' ))throw Error('CLOUD_ORIGIN_NOT_ALLOWED');
  if(u.username||u.password||u.search||u.hash)throw Error('CLOUD_ORIGIN_NOT_ALLOWED');
  return u.origin;
}
export function immutableProbeFingerprint(c,memberId,{historical=false}={}){
  if(!c||!Number.isSafeInteger(c.id)||c.id<1||c.target!==memberId||c.action!=='probe'||(historical?!['queued','accepted','completed','expired','failed'].includes(c.status):!['queued','accepted'].includes(c.status)))throw Error('COMMAND_NOT_ALLOWED');
  if(!c.payload||Object.keys(c.payload).sort().join(',')!=='nonce,schema'||c.payload.schema!=='jm.revolvingdoor.probe/1'||typeof c.payload.nonce!=='string'||!/^[a-f0-9]{32}$/.test(c.payload.nonce))throw Error('COMMAND_PAYLOAD_NOT_ALLOWED');
  if(!Number.isFinite(Date.parse(c.expiresAt))||(!historical&&Date.parse(c.expiresAt)<=Date.now()))throw Error('EXPIRED_COMMAND');
  return H(canon({id:c.id,requestId:c.requestId??null,action:c.action,target:c.target,payload:c.payload,createdAt:c.createdAt,expiresAt:c.expiresAt}));
}
export const probeCommand=(c,memberId)=>immutableProbeFingerprint(c,memberId);
export class V05Bridge{
 constructor({cloudUrl,spaceId,memberId,memberToken,relayUrl,tokens,dbFile,localMock=false,fetcher=fetch}){
  if(!safe(spaceId)||!safe(memberId))throw Error('INVALID_SPACE_OR_MEMBER');
  if(typeof memberToken!=='string'||memberToken.length<32)throw Error('MEMBER_TOKEN_REQUIRED');
  assertSecrets(tokens,['JM_PRODUCER_TOKEN','JM_MISSION_KEY','JM_RECEIPT_KEY']);
  if(!/^[A-Za-z0-9_-]{2,48}$/.test(tokens.JM_ALLOWED_RUNNER_ID||''))throw Error('RUNNER_ID_REQUIRED');
  this.cloud=cloudOrigin(cloudUrl,localMock);this.relay=safeRelayUrl(relayUrl);
  this.sid=spaceId;this.mid=memberId;this.memberToken=memberToken;this.t=tokens;this.fetcher=fetcher;
  this.db=new DatabaseSync(dbFile,{timeout:5000});
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
   CREATE TABLE IF NOT EXISTS inbox(command_id INTEGER PRIMARY KEY,fingerprint TEXT NOT NULL,mission_id TEXT NOT NULL UNIQUE,phase TEXT NOT NULL,local_receipt TEXT,last_error TEXT,challenge_hash TEXT);`);
  // Preserve existing CP-C4 inbox without silently granting it a new challenge proof.
  if(!this.db.prepare("PRAGMA table_info(inbox)").all().some(x=>x.name==='challenge_hash'))this.db.exec("ALTER TABLE inbox ADD COLUMN challenge_hash TEXT");
 }
 async request(base,p,token,method='GET',payload=undefined){
  const response=await this.fetcher(base+p,{method,redirect:'error',headers:{authorization:'Bearer '+token,...(payload!==undefined?{'content-type':'application/json'}:{})},...(payload!==undefined?{body:JSON.stringify(payload)}:{}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error((base===this.cloud?'HOST_':'RELAY_')+'HTTP_'+response.status);
  const text=await response.text();if(text.length>1000000)throw Error('RESPONSE_TOO_LARGE');
  let json;try{json=JSON.parse(text);}catch{throw Error('NON_JSON_RESPONSE');}
  if(json?.ok===false)throw Error('PROVIDER_ERROR');return json;
 }
 host(p,method='GET',payload){return this.request(this.cloud,p,this.memberToken,method,payload);}
 local(p,method='GET',payload){return this.request(this.relay,p,this.t.JM_PRODUCER_TOKEN,method,payload);}
 missionId(id,fingerprint){if(!/^[a-f0-9]{64}$/.test(fingerprint||''))throw Error('COMMAND_FINGERPRINT_REQUIRED');return 'JM_C5_'+H(this.cloud+'|'+this.sid+'|'+id+'|'+fingerprint).slice(0,56);}
 get(id){return this.db.prepare('SELECT * FROM inbox WHERE command_id=?').get(id)||null;}
 async pollAndStage(){
  const out=await this.host('/v5/spaces/'+encodeURIComponent(this.sid)+'/commands?after=0');
  if(out.ok!==true||!Array.isArray(out.commands)||out.commands.length>5000)throw Error('BAD_HOST_COMMAND_LIST');
  const result=[];
  // No cursor watermark: accepted commands may be replayed until host confirms result.
  for(const command of out.commands){
   let fingerprint;try{fingerprint=probeCommand(command,this.mid);}catch(e){result.push({commandId:command?.id??null,phase:'HOLD',reason:e.message});continue;}
   const missionId=this.missionId(command.id,fingerprint),known=this.get(command.id);
   const challengeHash=H(command.payload.nonce);
   if(known&&(known.fingerprint!==fingerprint||known.challenge_hash!==challengeHash)){result.push({commandId:command.id,phase:'HOLD',reason:'CLOUD_COMMAND_DRIFT'});continue;}
   if(['RESULT_CONFIRMED','REMOTE_UNCERTAIN','RESULT_HTTP_ACKNOWLEDGED'].includes(known?.phase)){result.push({commandId:command.id,phase:known.phase});continue;}
   if(!known)this.db.prepare('INSERT INTO inbox(command_id,fingerprint,mission_id,phase,challenge_hash) VALUES(?,?,?,?,?)').run(command.id,fingerprint,missionId,'RECORDED',challengeHash);
   const mission=await signMission({id:missionId,op:'probe',target:this.t.JM_ALLOWED_RUNNER_ID,challenge:command.payload.nonce},this.t.JM_MISSION_KEY);
   try{
    const queued=await this.local('/v1/missions','POST',{mission});
    if(queued.id!==missionId||!['PENDING','LEASED','DONE','HOLD'].includes(queued.state))throw Error('INVALID_RELAY_QUEUE_REPLY');
    this.db.prepare("UPDATE inbox SET phase='STAGED',last_error=NULL WHERE command_id=? AND phase='RECORDED'").run(command.id);
    result.push({commandId:command.id,phase:'STAGED_OR_PRIOR',localState:queued.state});
   }catch(e){this.db.prepare('UPDATE inbox SET last_error=? WHERE command_id=?').run(e.message,command.id);result.push({commandId:command.id,phase:'HOLD',reason:e.message});}
  }
  return result;
 }
 async finalize(id){
  const row=this.get(id);if(!row)throw Error('UNKNOWN_COMMAND');
  if(row.phase==='RESULT_CONFIRMED')return {commandId:id,phase:row.phase,duplicate:true};
  if(row.phase==='RESULT_HTTP_ACKNOWLEDGED')return {commandId:id,phase:row.phase,signed_host_receipt:'REQUIRED',remote_write_replayed:false};
  if(row.phase==='REMOTE_UNCERTAIN')return {commandId:id,phase:row.phase,manual_reconciliation_required:true};
  if(row.phase==='RECORDED')return {commandId:id,phase:'HOLD_NOT_STAGED'};
  let receipt;
  if(row.phase==='STAGED'){
   const job=await this.local('/v1/missions/'+row.mission_id);
   if(job.id!==row.mission_id||job.state!=='DONE'||!job.receipt)return {commandId:id,phase:'HOLD_WAITING_FOR_LOCAL_RECEIPT'};
   receipt=typeof job.receipt==='string'?JSON.parse(job.receipt):job.receipt;
   await checkReceipt(receipt,this.t.JM_RECEIPT_KEY);
   if(!/^[a-f0-9]{64}$/.test(row.challenge_hash||'')||receipt.content_hash!==row.challenge_hash||receipt.id!==row.mission_id||receipt.job_hash!==job.job_hash||receipt.status!=='PASS'||receipt.code!=='PROBE_OK')throw Error('LOCAL_PROBE_RECEIPT_INVALID');
   this.db.prepare("UPDATE inbox SET phase='LOCAL_VERIFIED',local_receipt=? WHERE command_id=?").run(JSON.stringify(receipt),id);
  }else{receipt=JSON.parse(row.local_receipt);await checkReceipt(receipt,this.t.JM_RECEIPT_KEY);}
  const path='/v5/spaces/'+encodeURIComponent(this.sid)+'/commands/'+id;
  if(['LOCAL_VERIFIED'].includes(this.get(id).phase)){
   this.db.prepare("UPDATE inbox SET phase='REMOTE_UNCERTAIN' WHERE command_id=?").run(id);
   try{
    const ack=await this.host(path+'/ack','POST',{status:'accepted',note:'JM CP-C4 bounded local probe receipt verified'});
    if(ack.ok!==true||ack.command?.id!==id||ack.command?.ack?.status!=='accepted')throw Error('HOST_ACK_NOT_CONFIRMED');
   }catch(e){this.db.prepare('UPDATE inbox SET last_error=? WHERE command_id=?').run(e.message,id);return {commandId:id,phase:'REMOTE_UNCERTAIN',reason:e.message};}
   this.db.prepare("UPDATE inbox SET phase='ACK_CONFIRMED' WHERE command_id=?").run(id);
  }
  if(this.get(id).phase==='ACK_CONFIRMED'){
   this.db.prepare("UPDATE inbox SET phase='REMOTE_UNCERTAIN' WHERE command_id=?").run(id);
   const detail={schema:'jm.rd.host-contact/2',missionId:row.mission_id,localJobHash:receipt.job_hash,localReceiptChain:receipt.chain_hash,commandFingerprint:row.fingerprint,challengeSha256:row.challenge_hash};
   try{
    const outcome=await this.host(path+'/result','POST',{ok:true,kind:'JM_RD_PROBE',detail});
    if(outcome.ok!==true||outcome.command?.id!==id||outcome.command?.status!=='completed'||outcome.command?.result?.kind!=='JM_RD_PROBE')throw Error('HOST_RESULT_NOT_CONFIRMED');
   }catch(e){this.db.prepare('UPDATE inbox SET last_error=? WHERE command_id=?').run(e.message,id);return {commandId:id,phase:'REMOTE_UNCERTAIN',reason:e.message};}
   this.db.prepare("UPDATE inbox SET phase='RESULT_HTTP_ACKNOWLEDGED',last_error=NULL WHERE command_id=?").run(id);
  }
  return {commandId:id,phase:this.get(id).phase,localReceiptChain:receipt.chain_hash,remote_signed_space_receipt:'SEPARATE_ADMIN_VERIFICATION_REQUIRED',provenance:'HTTP_RESPONSE_ONLY_NOT_SIGNED_PROOF'};
 }
 inspect(){return this.db.prepare('SELECT command_id,mission_id,phase,last_error FROM inbox ORDER BY command_id').all();}
 close(){this.db.close();}
}
