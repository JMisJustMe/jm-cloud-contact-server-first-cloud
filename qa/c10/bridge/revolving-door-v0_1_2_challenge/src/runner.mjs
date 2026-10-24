import http from 'node:http';
import { createHash,timingSafeEqual } from 'node:crypto';
import { LocalStore } from './local-store.mjs';
import { assertSecrets, checkMission, json } from './protocol.mjs';
function equal(a,b){return timingSafeEqual(createHash('sha256').update(a||'').digest(),createHash('sha256').update(b||'').digest());}
export class Runner {
  constructor({relayUrl,dbFile,tokens,runnerId='local-runner',fetcher=fetch}) {
    assertSecrets(tokens,['JM_RUNNER_TOKEN','JM_WAKE_TOKEN','JM_MISSION_KEY','JM_RECEIPT_KEY']);
    if(!/^https:\/\//.test(relayUrl) && !/^http:\/\/127\.0\.0\.1(?::\d+)?$/.test(relayUrl) && !/^http:\/\/localhost(?::\d+)?$/.test(relayUrl))throw new Error('RELAY_REQUIRES_HTTPS_OR_LOOPBACK');
    this.url=relayUrl.replace(/\/$/,'');this.t=tokens;this.id=runnerId;this.fetcher=fetcher;
    this.store=new LocalStore(dbFile,tokens.JM_RECEIPT_KEY);
    this.running=null;this.timer=null;
  }
  async call(path,options={}){
    const r=await this.fetcher(this.url+path,{...options,headers:{authorization:'Bearer '+this.t.JM_RUNNER_TOKEN,...options.headers},signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw new Error('RELAY_'+r.status+':'+(await r.text()).slice(0,300));return r.json();
  }
  async once(){
    const response=await this.call('/v1/claim?runner='+encodeURIComponent(this.id));
    const claim=response.claim;if(!claim)return null;
    const computed=await checkMission(claim.mission,this.t.JM_MISSION_KEY);
    if(claim.id!==claim.mission.id || claim.mission.target!==this.id || claim.job_hash!==computed)throw new Error('CLAIM_HASH_INVALID');
    // LocalStore atomically persists a result and receipt. A redelivery returns the saved receipt.
    const receipt=this.store.apply(claim.mission,claim.job_hash);
    await this.call('/v1/receipt',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:claim.id,lease_token:claim.lease_token,receipt})});
    return receipt;
  }
  drain(limit=10){
    if(this.running)return this.running;
    this.running=(async()=>{
      let count=0;for(;count<limit;count++){const result=await this.once();if(!result)break;}return count;
    })().finally(()=>{this.running=null;});
    return this.running;
  }
  startPull(interval=5000){if(this.timer)throw new Error('ALREADY_POLLING');
    this.timer=setInterval(()=>this.drain().catch(e=>console.error('POLL_HOLD',e.message)),interval);
    this.timer.unref();return this;
  }
  async startPush({port=8788}={}){
    const server=http.createServer(async(req,res)=>{
      if(req.method!=='POST'||req.url!=='/v1/wake'){res.writeHead(404);res.end();return;}
      if(!equal((req.headers.authorization||'').replace(/^Bearer /,''),this.t.JM_WAKE_TOKEN)){
        res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'UNAUTHORIZED'}));return;
      }
      if(req.headers['transfer-encoding'] || Number(req.headers['content-length']||0)>0){res.writeHead(400);res.end();return;}
      const reply=json({accepted:true,route:'WAKE_ONLY'},202);res.writeHead(reply.status,Object.fromEntries(reply.headers.entries()));res.end(await reply.text());
      this.drain().catch(e=>console.error('WAKE_HOLD',e.message));
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
    this.server=server;return server;
  }
  async close(){if(this.timer)clearInterval(this.timer);if(this.server)await new Promise(res=>this.server.close(res));if(this.running)await this.running.catch(()=>{});this.store.close();}
}
if(process.argv[1] && import.meta.url===new URL('file://'+process.argv[1]).href){
  const e=process.env;
  try{
    const runner=new Runner({relayUrl:e.JM_RELAY_URL||'http://127.0.0.1:8787',dbFile:e.JM_LOCAL_DB||'./jm_local.sqlite',tokens:e,runnerId:e.JM_RUNNER_ID||'jm-laptop'});
    await runner.startPush({port:Number(e.JM_WAKE_PORT||8788)});
    runner.startPull(Number(e.JM_POLL_MS||5000));
    await runner.drain().catch(err=>console.error('INITIAL_POLL_HOLD',err.message));
    console.log('RUNNER ACTIVE: push wake on loopback, pull polling active; no shell operations permitted');
  }catch(err){console.error(err.message);process.exitCode=1;}
}
