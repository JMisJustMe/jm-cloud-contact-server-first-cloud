// CP-C10: actual v0.5 server + disposable PostgreSQL + actual RD 0.1.2 runner.
// Isolated localhost GitHub Actions acceptance. Never production or physical device proof.
// Requires disposable postgres://...@localhost:5432/jm_cloud_qa; refuses others.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {createServer as createTCPServer} from 'node:net';
import {Relay} from './c10/bridge/revolving-door-v0_1_2_challenge/src/relay.mjs';
import {Runner} from './c10/bridge/revolving-door-v0_1_2_challenge/src/runner.mjs';
import {V05Bridge} from './c10/bridge/src/v05-bridge.mjs';
import {reconcileHost} from './c10/bridge/src/v05-reconcile.mjs';
import {verifySpaceReceipt,keyIdFor} from './c10/bridge/src/v05-proof.mjs';
const pgUrl=process.env.JM_QA_POSTGRES_URL;
if(!pgUrl || !/^postgres(?:ql)?:\/\/[^/@]+@(?:localhost|127\.0\.0\.1):5432\/jm_cloud_qa$/.test(pgUrl))
 throw Error('HOLD: only disposable localhost jm_cloud_qa Postgres allowed');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hostRoot=root;
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-c10-postgres-fullcontact-'));
const checks=[];const pass=name=>checks.push(name);
const rnd=()=>crypto.randomBytes(32).toString('hex');
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const admin=rnd(),contactHmac=rnd(),spaceId='c10_'+crypto.randomBytes(8).toString('hex'),mid='rd_probe';
const t={JM_PRODUCER_TOKEN:rnd(),JM_RUNNER_TOKEN:rnd(),JM_MISSION_KEY:rnd(),JM_RECEIPT_KEY:rnd(),JM_WAKE_TOKEN:rnd(),JM_ALLOWED_RUNNER_ID:'jm-laptop'};
const addr=async()=>new Promise((resolve,reject)=>{const s=createTCPServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const port=await addr();const hostBase=`http://127.0.0.1:${port}`;
const signerPath=path.join(temp,'contact-signer-unused.pem'),contactPath=path.join(temp,'contact-cache.json'),rdPath=path.join(temp,'rd.sqlite'),relayPath=path.join(temp,'relay.sqlite'),inboxPath=path.join(temp,'inbox.sqlite');
const {privateKey:ownerPrivateKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const ownerPin=sha(canonical(crypto.createPublicKey(ownerPrivateKey).export({format:'jwk'}))).slice(0,24);
const env={...process.env,HOST:'127.0.0.1',PORT:String(port),JM_CLOUD_MODE:'production',
 JM_CLOUD_ADMIN_TOKEN:admin,JM_CLOUD_SERVER_SECRET:contactHmac,
 JM_CLOUD_ORIGINS:'https://qa.invalid',
 JM_CLOUD_CONTACT_POSTGRES_URL:pgUrl,JM_MARKET_POSTGRES_URL:'',
 JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:'1',
 JM_CLOUD_RECEIPT_SIGNING_KEY_B64:Buffer.from(ownerPrivateKey).toString('base64'),
 JM_CLOUD_EXPECTED_SIGNING_KEY_ID:ownerPin,
 JM_CLOUD_DATA:contactPath,JM_CLOUD_RECEIPT_SIGNING_KEY:signerPath,
 JM_CLOUD_PROFILE_DIR:path.join(hostRoot,'profiles'),
 JM_CLOUD_PROFILE_MANIFEST:path.join(hostRoot,'profiles','JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json')};
let child=null,stderr='',relay=null,relayServer=null,runner=null,bridge=null;
async function call(route,{method='GET',token,body}={}){const headers={accept:'application/json'};if(token)headers.authorization='Bearer '+token;if(body!==undefined)headers['content-type']='application/json';const response=await fetch(hostBase+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(5000)});return {status:response.status,data:await response.json()};}
async function ok(route,{status=200,...opts}={}){const r=await call(route,opts);assert.equal(r.status,status,route+' '+JSON.stringify(r.data).slice(0,180));return r.data;}
async function start({first=false,overrideEnv={}}={}){
 stderr='';child=spawn(process.execPath,[path.join(hostRoot,'JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs')],{
  cwd:hostRoot,env:{...env,JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:first?'1':'0',...overrideEnv},stdio:['ignore','ignore','pipe']});
 child.stderr.on('data',b=>{if(stderr.length<1200)stderr+=String(b).slice(0,600)});
 for(let i=0;i<110;i++){
  if(child.exitCode!==null)throw Error('ACTUAL_HOST_FAILED: '+stderr.slice(0,600));
  try{const r=await call('/ready');if(r.status===200&&r.data.ready&&r.data.contactDurable)return r.data;}catch{}
  await new Promise(ok=>setTimeout(ok,90));
 }
 throw Error('ACTUAL_HOST_NOT_DURABLE_READY: '+stderr.slice(0,600));
}
async function stop(){if(!child)return;const c=child;child=null;if(c.exitCode===null&&c.signalCode===null){c.kill('SIGTERM');await Promise.race([once(c,'exit'),new Promise((_,reject)=>setTimeout(()=>reject(Error('HOST_STOP_TIMEOUT')),6500))]);}}
let relayUrl,memberToken,pin;
const makeBridge=(fetcher=fetch)=>new V05Bridge({cloudUrl:hostBase,spaceId,memberId:mid,memberToken,relayUrl,tokens:t,dbFile:inboxPath,localMock:true,fetcher});
const adminRead=()=>reconcileHost({cloudUrl:hostBase,spaceId,memberId:mid,dbFile:inboxPath,adminToken:admin,pinnedKeyId:pin,localMock:true});
async function command(nonce){const payload={schema:'jm.revolvingdoor.probe/1',nonce};const issued=await ok(`/v5/spaces/${spaceId}/commands`,{method:'POST',token:admin,status:201,body:{action:'probe',target:mid,requestId:'c10_'+nonce.slice(0,16),ttlMs:600000,payload}});return issued.command;}
async function signedSpace(){const [key,r,d]=await Promise.all([ok('/receipt-key'),ok(`/v5/spaces/${spaceId}/receipt`,{token:admin}),ok(`/v5/spaces/${spaceId}`,{token:admin})]);return {verified:verifySpaceReceipt({receipt:r.receipt,keyResponse:key,pin,deep:d.space}),receipt:r.receipt,deep:d.space};}
try{
 const firstReady=await start({first:true});assert.equal(firstReady.contactDurable,true);pass('actual-v05-server-in-production-with-disposable-postgres');
 const startKey=await ok('/receipt-key');pin=keyIdFor(startKey.publicKeyJwk);assert.equal(pin,startKey.keyId);assert.equal(pin,ownerPin);pass('independently-owner-pinned-p256-signer');
 const created=await ok('/v5/spaces',{method:'POST',token:admin,status:201,body:{spaceId,kind:'isolated-test',label:'C10 real RD runner plus Postgres isolated CI',members:[{id:mid,type:'service',capabilities:['command:probe']}]}});memberToken=created.credentials[mid];assert.ok(memberToken?.length>=32);pass('real-contact-limited-member');
 await ok(`/v5/spaces/${spaceId}/commands`,{method:'POST',token:admin,status:403,body:{action:'shell',target:mid}});pass('unsupported-command-denied-by-real-server');
 relay=new Relay({dbFile:relayPath,tokens:t});relayServer=await relay.listen({port:0});relayUrl='http://127.0.0.1:'+relayServer.address().port;
 runner=new Runner({relayUrl,dbFile:rdPath,tokens:t,runnerId:t.JM_ALLOWED_RUNNER_ID});bridge=makeBridge();pass('actual-rd-relay-runner-http-and-sqlite-start');
 const c1=await command(crypto.randomBytes(16).toString('hex'));let stages=await bridge.pollAndStage();assert.ok(stages.some(x=>x.commandId===c1.id));
 const actual=await runner.once();assert.equal(actual.code,'PROBE_OK');assert.equal(actual.content_hash,sha(c1.payload.nonce));pass('actual-runner-executes-signed-challenge-and-sqlite-commit');
 const afterLocal=relay.get(bridge.get(c1.id).mission_id);assert.equal(afterLocal.state,'DONE');assert.equal(JSON.parse(afterLocal.receipt).content_hash,actual.content_hash);pass('local-relay-returned-same-signed-receipt');
 let f=await bridge.finalize(c1.id);assert.equal(f.phase,'RESULT_HTTP_ACKNOWLEDGED');pass('http-result-is-not-cryptographic-confirmation');
 let recon=await adminRead();assert.equal(recon.statuses.find(x=>x.id===c1.id).phase,'RESULT_CONFIRMED');assert.equal(bridge.get(c1.id).phase,'RESULT_CONFIRMED');pass('actual-host-signed-space-return-reconciled-to-rd-receipt');
 const snap1=await signedSpace();assert.equal(snap1.verified.event_chain,'PASS');pass('real-host-complete-p256-journal-verified');
 const chainBefore=snap1.receipt.chainHead,receiptBefore=snap1.receipt.receiptHash;
 bridge.close();bridge=null;await runner.close();runner=null;await stop();
 // Cold restart: delete local contact cache; leave ONLY CI Postgres as durable cloud state.
 fs.rmSync(contactPath,{force:true});fs.rmSync(contactPath+'.bak',{force:true});
 const restarted=await start();assert.equal(restarted.contactDurable,true);const afterKey=await ok('/receipt-key');assert.equal(afterKey.keyId,pin);pass('actual-host-cold-restart-recovers-from-postgres-with-no-local-cache');
 const recovered=await signedSpace();assert.equal(recovered.receipt.chainHead,chainBefore);assert.equal(recovered.receipt.receiptHash,receiptBefore);pass('actual-host-restart-preserves-signed-space-history');
 const old=await ok(`/v5/spaces/${spaceId}`,{token:admin});assert.equal(old.space.commands.find(x=>x.id===c1.id).status,'completed');pass('previous-real-rd-result-survives-host-restart');
 runner=new Runner({relayUrl,dbFile:rdPath,tokens:t,runnerId:t.JM_ALLOWED_RUNNER_ID});bridge=makeBridge();
 const c2=await command(crypto.randomBytes(16).toString('hex'));await bridge.pollAndStage();
 const rr=await runner.once();assert.equal(rr.code,'PROBE_OK');assert.equal(rr.content_hash,sha(c2.payload.nonce));pass('second-real-rd-command-processed-after-restart');
 bridge.close();bridge=null;
 let dropped=false;
 const lostReply=async(url,options)=>{const r=await fetch(url,options);if(!dropped&&String(url).includes(`/commands/${c2.id}/result`)){dropped=true;await r.text();throw Error('C9_SIMULATED_LOST_HOST_RESULT_RESPONSE');}return r;};
 bridge=makeBridge(lostReply);
 f=await bridge.finalize(c2.id);assert.equal(f.phase,'REMOTE_UNCERTAIN');assert.equal(dropped,true);pass('lost-result-response-fails-closed');
 // Re-open the bridge to show recovery from durable inbox rather than memory.
 bridge.close();bridge=makeBridge();assert.equal(bridge.get(c2.id).phase,'REMOTE_UNCERTAIN');pass('uncertainty-persisted-across-bridge-restart');
 recon=await adminRead();assert.equal(recon.statuses.find(x=>x.id===c2.id).phase,'RESULT_CONFIRMED');pass('admin-pinned-signature-reconciles-lost-host-reply');
 const second=await signedSpace();assert.equal(second.deep.commands.filter(x=>x.id===c2.id).length,1);assert.equal(second.deep.commands.filter(x=>x.id===c2.id)[0].status,'completed');pass('single-host-command-under-lost-reply');
 assert.equal(runner.store.audit().status,'PASS');pass('actual-rd-local-hash-chain-audit');
 // Explicitly show a freshly generated (wrong) signer is NOT silently accepted.
 bridge.db.prepare("UPDATE inbox SET phase='REMOTE_UNCERTAIN' WHERE command_id=?").run(c2.id);
 let denied=false;try{await reconcileHost({cloudUrl:hostBase,spaceId,memberId:mid,dbFile:inboxPath,adminToken:admin,pinnedKeyId:'0'.repeat(24),localMock:true});}catch(e){denied=String(e.message).includes('SIGNER_ID_MISMATCH');}
 assert.equal(denied,true);assert.equal(bridge.get(c2.id).phase,'REMOTE_UNCERTAIN');pass('wrong-owner-public-pin-holds-real-signed-result');
 recon=await adminRead();assert.equal(recon.statuses.find(x=>x.id===c2.id).phase,'RESULT_CONFIRMED');pass('correct-original-owner-pin-required-for-return');
 // Negative: wrong owner-managed signer in PRODUCTION must FAIL-CLOSED before start.
 bridge.db.prepare("UPDATE inbox SET phase='REMOTE_UNCERTAIN' WHERE command_id=?").run(c2.id);
 await stop();
 const alternate=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;
 let mismatchedSignerRefused=false;
 try{await start({overrideEnv:{JM_CLOUD_RECEIPT_SIGNING_KEY_B64:Buffer.from(alternate).toString('base64')}})}catch(e){mismatchedSignerRefused=/production signing key differs|ACTUAL_HOST_FAILED|ACTUAL_HOST_NOT_DURABLE_READY/.test(String(e));}
 assert.equal(mismatchedSignerRefused,true);pass('production-owner-pin-rejects-different-private-signer-on-restart');
 await stop();
 fs.rmSync(contactPath,{force:true});fs.rmSync(contactPath+'.bak',{force:true});
 const finalBoot=await start();assert.equal(finalBoot.contactDurable,true);const restored=await ok('/receipt-key');assert.equal(restored.keyId,pin);
 pass('correct-owner-signer-and-postgres-recover-after-refused-start');
 recon=await adminRead();assert.equal(recon.statuses.find(x=>x.id===c2.id).phase,'RESULT_CONFIRMED');pass('signed-host-proof-recovers-only-on-original-identity');
 const finalSnap=await signedSpace();assert.equal(finalSnap.receipt.chainHead,second.receipt.chainHead);pass('postgres-event-history-stable-across-signer-refusal');
 const output={schema:'jm.cp-c10.actual-v05-postgres-real-rd-ci/1',status:'PASS',checksPassed:checks.length,checks,sourceCommit:'cb4d787e63b951a248f230fc4a47f0c4e35894a3',actualV05Server:true,actualRD012RelayRunner:true,sourceHasTestOnlyPgImportGuard:false,usedPostgres:true,postgresLocalhostDisposable:true,usedRealRender:false,usedPhysicalDevices:false,locallySignedRDReceipts:2,realLocalHostP256SignedSpace:true,coldPgRestartContinuity:true,lostHostResponseReconciled:true,localSignerId:pin};
 if(process.env.JM_C10_EVIDENCE_PATH)fs.writeFileSync(process.env.JM_C10_EVIDENCE_PATH,JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
}catch(err){const report={schema:'jm.cp-c10.actual-v05-postgres-real-rd-ci/1',status:'HOLD',checksPassed:checks.length,checks,error:String(err.stack||err).slice(0,1400)};if(process.env.JM_C10_EVIDENCE_PATH)fs.writeFileSync(process.env.JM_C10_EVIDENCE_PATH,JSON.stringify(report,null,2));console.error(JSON.stringify(report,null,2));process.exitCode=1;}
finally{try{bridge?.close();await runner?.close();if(relayServer)await new Promise(ok=>relayServer.close(ok));relay?.close();await stop();}catch(err){console.error('CLEANUP_HOLD',err.message);process.exitCode=1;}fs.rmSync(temp,{recursive:true,force:true});}
