// CP-C8 — ONE actual-server path across a durable POSTGRES restart.
// GitHub Actions disposable PostgreSQL only, synthetic private keys/tokens.
// This does NOT use a physical Revolving Door runner or touch production.
// Explicit synthetic host-result detail is not proof of device consequence.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';

const url=process.env.JM_QA_POSTGRES_URL;
if(!url || !/^postgres(?:ql)?:\/\/[^/@]+@(?:localhost|127\.0\.0\.1):5432\/jm_cloud_qa$/.test(url))
  throw Error('HOLD: test accepts only disposable localhost jm_cloud_qa');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-c8-host-restart-'));
const privatePem=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;
const ownerJwk=crypto.createPublicKey(privatePem).export({format:'jwk'});
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):
  Array.isArray(v)?'['+v.map(canonical).join(',')+']':
  '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const sha=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const ownerPin=sha(canonical(ownerJwk)).slice(0,24);
const admin=crypto.randomBytes(32).toString('hex');
const secret=crypto.randomBytes(32).toString('hex');
const port=await new Promise((ok,no)=>{
  const s=createServer();s.once('error',no);s.listen(0,'127.0.0.1',()=>{
    const p=s.address().port;s.close(()=>ok(p));
  });
});
const base='http://127.0.0.1:'+port;
const cache=path.join(tmp,'contact-local-cache.json');
const env={...process.env,PORT:String(port),HOST:'127.0.0.1',JM_CLOUD_MODE:'production',
 JM_CLOUD_ADMIN_TOKEN:admin,JM_CLOUD_SERVER_SECRET:secret,
 JM_CLOUD_ORIGINS:'https://qa.invalid',
 JM_CLOUD_CONTACT_POSTGRES_URL:url,
 JM_CLOUD_RECEIPT_SIGNING_KEY_B64:Buffer.from(privatePem).toString('base64'),
 JM_CLOUD_EXPECTED_SIGNING_KEY_ID:ownerPin,
 JM_CLOUD_DATA:cache,JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(tmp,'unused.pem'),
 JM_CLOUD_PROFILE_DIR:path.join(root,'profiles'),
 JM_CLOUD_PROFILE_MANIFEST:path.join(root,'profiles','JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json')};
const checks=[];let child=null,err='';
function pass(name){checks.push(name);}
async function req(route,{method='GET',token,body}={}){
 const headers={accept:'application/json'};
 if(token)headers.authorization='Bearer '+token;
 if(body!==undefined)headers['content-type']='application/json';
 const r=await fetch(base+route,{method,headers,redirect:'error',signal:AbortSignal.timeout(4500),
 ...(body===undefined?{}:{body:JSON.stringify(body)})});
 let j=await r.json();
 return {code:r.status,data:j};
}
async function start(first=false){
 err='';child=spawn(process.execPath,[path.join(root,'JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs')],{
   cwd:root,env:{...env,JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:first?'1':'0'},
   stdio:['ignore','ignore','pipe']});
 child.stderr.on('data',b=>{if(err.length<1000)err+=String(b).slice(0,1000)});
 for(let i=0;i<100;i++){
   if(child.exitCode!==null)throw Error('actual-server boot failed '+err.slice(0,160));
   try{let r=await req('/ready');if(r.code===200&&r.data.ready&&r.data.contactDurable)return r.data;}catch{}
   await new Promise(ok=>setTimeout(ok,90));
 }
 throw Error('actual-server failed readiness '+err.slice(0,160));
}
async function stop(){
 if(!child)return;
 const c=child;child=null;
 if(c.exitCode===null&&c.signalCode===null){
   c.kill('SIGTERM');
   await Promise.race([once(c,'exit'),new Promise((_,reject)=>setTimeout(()=>reject(Error('server shutdown timeout')),6000))]);
 }
}
async function exact(route,code,opts={}){
 const r=await req(route,opts);
 assert.equal(r.code,code,route+' '+JSON.stringify(r.data).slice(0,180));
 return r.data;
}
async function verifySnapshot(spaceId,expectedCommand,expectedPayload,expectedDetail){
 const [key,raw,deep]=await Promise.all([
   exact('/receipt-key',200),
   exact('/v5/spaces/'+spaceId+'/receipt',200,{token:admin}),
   exact('/v5/spaces/'+spaceId,200,{token:admin})]);
 assert.equal(key.keyId,ownerPin);assert.equal(raw.receipt.publicKeyId,ownerPin);
 const rec=raw.receipt;
 const keys=['schema','spaceId','label','kind','status','createdAt','updatedAt','members','eventCount','commandCount','signalCount','chainHead'];
 const payload=Object.fromEntries(keys.map(k=>[k,rec[k]]));
 assert.equal(sha(canonical(payload)),rec.receiptHash);
 assert.ok(crypto.verify('sha256',Buffer.from(rec.receiptHash),
   {key:crypto.createPublicKey({key:key.publicKeyJwk,format:'jwk'}),dsaEncoding:'ieee-p1363'},
   Buffer.from(rec.publicSig,'base64url')));
 let prev='0'.repeat(64);
 for(const row of deep.space.events){
   assert.equal(row.prevHash,prev);
   assert.equal(row.hash,sha(prev+'\n'+canonical({seq:row.seq,at:row.at,memberId:row.memberId,source:row.source,event:row.event})));
   prev=row.hash;
 }
 assert.equal(prev,rec.chainHead);
 const command=deep.space.commands.find(c=>c.id===expectedCommand);
 assert.ok(command);assert.equal(command.status,'completed');
 assert.equal(canonical(command.payload),canonical(expectedPayload));
 assert.equal(canonical(command.result.detail),canonical(expectedDetail));
 const queued=deep.space.events.filter(e=>e.event?.type==='command.queued'&&e.event.payload?.commandId===expectedCommand);
 const result=deep.space.events.filter(e=>e.event?.type==='command.result'&&e.event.payload?.commandId===expectedCommand);
 assert.equal(queued.length,1);assert.equal(result.length,1);
 assert.equal(queued[0].event.payload.payloadSha256,sha(canonical(expectedPayload)));
 assert.equal(result[0].event.payload.detailSha256,sha(canonical(expectedDetail)));
 return {keyId:key.keyId,receiptHash:rec.receiptHash,chainHead:rec.chainHead,commands:deep.space.commands.length,eventCount:deep.space.events.length};
}
try{
 const initial=await start(true);pass('production-mode-boot-with-disposable-durable-postgres');
 assert.equal(initial.contactDurable,true);pass('production-ready-is-database-backed');
 const keyBefore=await exact('/receipt-key',200);
 assert.equal(keyBefore.keyId,ownerPin);pass('independently-derived-owner-signer-pin');
 const sid='jm_cp8_'+crypto.randomBytes(8).toString('hex');
 const sp=await exact('/v5/spaces',201,{method:'POST',token:admin,
   body:{spaceId:sid,kind:'isolated-test',label:'CP-C8 exact source durable host proof',
     members:[{id:'probe-target',type:'service',capabilities:['command:probe']}]}});
 const member=sp.credentials['probe-target'];
 assert.ok(member&&sp.rejoinCredentials['probe-target']);pass('durably-create-limited-member');
 const nonce=crypto.randomBytes(16).toString('hex');
 const payload={schema:'jm.revolvingdoor.probe/1',nonce};
 const reqid='jm-c8-'+crypto.randomBytes(10).toString('hex');
 const issue=await exact('/v5/spaces/'+sid+'/commands',201,{method:'POST',token:admin,
   body:{action:'probe',target:'probe-target',requestId:reqid,ttlMs:3600000,payload}});
 const cid=issue.command.id;pass('durably-queue-challenge-bound-command');
 const polled=await exact('/v5/spaces/'+sid+'/commands?after=0',200,{token:member});
 assert.ok(polled.commands.some(c=>c.id===cid));pass('authenticated-capability-limited-poll');
 await exact('/v5/spaces/'+sid+'/commands/'+cid+'/ack',200,{method:'POST',token:member,body:{status:'accepted'}});
 const detail={schema:'jm.rd.local-witness-fixture/1',challengeSha256:sha(nonce),
  receiptSha256:sha('synthetic-local-receipt-not-physical-device'),execution:'CI_SYNTHETIC_ONLY'};
 await exact('/v5/spaces/'+sid+'/commands/'+cid+'/result',200,{method:'POST',token:member,
   body:{ok:true,kind:'JM_RD_PROBE_FIXTURE',detail}});
 pass('signed-localhost-command-ack-result-fixture');
 const before=await verifySnapshot(sid,cid,payload,detail);
 pass('signed-challenge-and-result-committed-in-host-chain');
 await stop();
 fs.rmSync(cache,{force:true});
 fs.rmSync(cache+'.bak',{force:true});
 const recovered=await start(false);assert.equal(recovered.contactDurable,true);
 pass('cold-restart-with-no-local-contact-cache');
 const after=await verifySnapshot(sid,cid,payload,detail);
 assert.equal(before.keyId,after.keyId);assert.equal(before.chainHead,after.chainHead);
 assert.equal(before.receiptHash,after.receiptHash);
 pass('identical-key-chain-and-signed-receipt-after-restart');
 const retry=await exact('/v5/spaces/'+sid+'/commands',200,{method:'POST',token:admin,
   body:{action:'probe',target:'probe-target',requestId:reqid,ttlMs:3600000,payload}});
 assert.equal(retry.deduplicated,true);assert.equal(retry.command.id,cid);
 pass('replayed-request-id-returns-same-durable-command');
 const final=await verifySnapshot(sid,cid,payload,detail);
 assert.equal(final.chainHead,after.chainHead);pass('duplicate-has-no-new-journal-event');
 console.log(JSON.stringify({schema:'jm.cp-c8.actual-source-postgres-bound-contact/1',
  status:'PASS',checks,checksPassed:checks.length,
  signedReceiptStableAcrossRestart:true,signedChallengeBound:true,
  localCacheDiscardedBeforeRestart:true,privateCredentialsPrinted:false,
  actualServerSource:true,realHostedServiceTouched:false,
  realRevolvingDoorRunnerExecuted:false,physicalDeviceProof:false},null,2));
}catch(e){
 console.error(JSON.stringify({schema:'jm.cp-c8.actual-source-postgres-bound-contact/1',
 status:'HOLD',completedChecks:checks,error:String(e.message).slice(0,450)}));process.exitCode=1;
}finally{
 try{await stop()}catch(e){console.error('cleanup: '+String(e.message).slice(0,160));process.exitCode=1;}
 fs.rmSync(tmp,{recursive:true,force:true});
}
