// CP-C12 independent physical PostgreSQL database backup/restore within disposable CI.
// Actual JM Cloud Contact v0.5 server and actual Revolving Door v0.1.2 relay/runner.
// The dump stays in volatile test memory; never uploaded or included in evidence.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';import {once} from 'node:events';
import {fileURLToPath} from 'node:url';import {createServer} from 'node:net';
import {Relay} from './c10/bridge/revolving-door-v0_1_2_challenge/src/relay.mjs';
import {Runner} from './c10/bridge/revolving-door-v0_1_2_challenge/src/runner.mjs';
import {V05Bridge} from './c10/bridge/src/v05-bridge.mjs';
import {reconcileHost} from './c10/bridge/src/v05-reconcile.mjs';
import {verifySpaceReceipt,keyIdFor} from './c10/bridge/src/v05-proof.mjs';
import {guardDisposable} from './c12/backup-guard.mjs';
const sourceUrl=process.env.JM_C12_SOURCE_PG_URL,restoreUrl=process.env.JM_C12_RESTORE_PG_URL;
const sourceCid=process.env.JM_C12_SOURCE_CONTAINER_ID,targetCid=process.env.JM_C12_RESTORE_CONTAINER_ID;
guardDisposable({source:sourceUrl,target:restoreUrl,sourceContainer:sourceCid,targetContainer:targetCid,ci:process.env.GITHUB_ACTIONS});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-c12-disposable-backup-'));
const rand=()=>crypto.randomBytes(32).toString('hex');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const admin=rand(),hmac=rand(),spaceId='jm_c12_'+crypto.randomBytes(8).toString('hex'),memberId='rd_probe';
const keys={JM_PRODUCER_TOKEN:rand(),JM_RUNNER_TOKEN:rand(),JM_MISSION_KEY:rand(),JM_RECEIPT_KEY:rand(),JM_WAKE_TOKEN:rand(),JM_ALLOWED_RUNNER_ID:'jm-c12-runner'};
const signer=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;
const pin=keyIdFor(crypto.createPublicKey(signer).export({format:'jwk'}));
const port=await new Promise((res,rej)=>{let server=createServer();server.once('error',rej);server.listen(0,'127.0.0.1',()=>{let p=server.address().port;server.close(()=>res(p));});});
const cloud='http://127.0.0.1:'+port,sqlDb=path.join(temp,'rd.sqlite'),relayDb=path.join(temp,'relay.sqlite'),inbox=path.join(temp,'bridge.sqlite');
const checks=[];const pass=(x)=>checks.push(x);
let child=null,relay=null,relayServer=null,runner=null,bridge=null,memberToken,relayUrl,cloudPhase='none',report;
const baseEnv={...process.env,HOST:'127.0.0.1',PORT:String(port),JM_CLOUD_MODE:'production',JM_CLOUD_ADMIN_TOKEN:admin,JM_CLOUD_SERVER_SECRET:hmac,JM_CLOUD_ORIGINS:'https://isolated.invalid',JM_CLOUD_RECEIPT_SIGNING_KEY_B64:Buffer.from(signer).toString('base64'),JM_CLOUD_EXPECTED_SIGNING_KEY_ID:pin,JM_CLOUD_PROFILE_DIR:path.join(root,'profiles'),JM_CLOUD_PROFILE_MANIFEST:path.join(root,'profiles','JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json'),JM_MARKET_POSTGRES_URL:''};
async function call(route,{method='GET',token,body}={}){
 const headers={accept:'application/json'};if(token)headers.authorization='Bearer '+token;if(body!==undefined)headers['content-type']='application/json';
 const response=await fetch(cloud+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(6500)});
 return {status:response.status,data:await response.json()};
}
async function ok(route,{status=200,...opts}={}){let r=await call(route,opts);assert.equal(r.status,status,route+' '+JSON.stringify(r.data).slice(0,160));return r.data;}
let bootCount=0;
async function boot(pgUrl,{init=false,wrongSigner=false,wrongHmac=false}={}){
 const volume=path.join(temp,'volume_'+(bootCount++));fs.mkdirSync(volume);
 const env={...baseEnv,JM_CLOUD_CONTACT_POSTGRES_URL:pgUrl,JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:init?'1':'0',JM_CLOUD_DATA:path.join(volume,'local-cache.json'),JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(volume,'should-not-exist.pem')};
 if(wrongSigner){const alt=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;env.JM_CLOUD_RECEIPT_SIGNING_KEY_B64=Buffer.from(alt).toString('base64');}
 if(wrongHmac)env.JM_CLOUD_SERVER_SECRET=rand();
 assert.equal(fs.existsSync(env.JM_CLOUD_DATA),false);assert.equal(fs.existsSync(env.JM_CLOUD_RECEIPT_SIGNING_KEY),false);
 let stderr='';child=spawn(process.execPath,[path.join(root,'JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs')],{cwd:root,env,stdio:['ignore','ignore','pipe']});
 child.stderr.on('data',x=>{if(stderr.length<1300)stderr+=String(x).slice(0,800)});
 for(let n=0;n<115;n++){
   if(child.exitCode!==null||child.signalCode!==null)throw Error('BOOT_REJECTED '+stderr.slice(0,350));
   try{let r=await call('/ready');if(r.status===200&&r.data.ready&&r.data.contactDurable){cloudPhase=pgUrl===sourceUrl?'SOURCE_PG':'RESTORE_PG';return r.data;}}catch{}
   await new Promise(r=>setTimeout(r,90));
 }
 throw Error('BOOT_NOT_READY '+stderr.slice(0,300));
}
async function stop(){if(!child)return;const c=child;child=null;if(c.exitCode===null&&c.signalCode===null){c.kill('SIGTERM');await Promise.race([once(c,'exit'),new Promise((_,rej)=>setTimeout(()=>rej(Error('STOP_TIMEOUT')),7000))]);}}
async function rejected(pg,opts){let failed=false;try{await boot(pg,opts)}catch(e){failed=/BOOT_REJECTED|BOOT_NOT_READY/.test(String(e));}await stop();assert.equal(failed,true,'Expected rejected wrong custody '+JSON.stringify(opts));}
function bridgeNew(){return new V05Bridge({cloudUrl:cloud,spaceId,memberId,memberToken,relayUrl,tokens:keys,dbFile:inbox,localMock:true});}
async function readHost(){const [key,receipt,deep]=await Promise.all([ok('/receipt-key'),ok(`/v5/spaces/${spaceId}/receipt`,{token:admin}),ok(`/v5/spaces/${spaceId}`,{token:admin})]);
 assert.equal(key.keyId,pin);const verified=verifySpaceReceipt({receipt:receipt.receipt,keyResponse:key,pin,deep:deep.space});assert.equal(verified.event_chain,'PASS');return {receipt:receipt.receipt,deep:deep.space,proof:verified};}
async function cmd(){const nonce=crypto.randomBytes(16).toString('hex');const r=await ok(`/v5/spaces/${spaceId}/commands`,{status:201,method:'POST',token:admin,body:{action:'probe',target:memberId,requestId:'jm_c12_'+nonce,ttlMs:600000,payload:{schema:'jm.revolvingdoor.probe/1',nonce}}});return r.command;}
async function actualProbe(){const command=await cmd();const staged=await bridge.pollAndStage();assert.ok(staged.some(s=>s.commandId===command.id));const done=await runner.once();assert.equal(done.code,'PROBE_OK');assert.equal(done.content_hash,sha(command.payload.nonce));
 const result=await bridge.finalize(command.id);assert.equal(result.phase,'RESULT_HTTP_ACKNOWLEDGED');const rec=await reconcileHost({cloudUrl:cloud,spaceId,memberId,dbFile:inbox,adminToken:admin,pinnedKeyId:pin,localMock:true});assert.equal(rec.statuses.find(s=>s.id===command.id).phase,'RESULT_CONFIRMED');return {commandId:command.id,nonceHash:done.content_hash,chain:done.chain_hash};}
function execDocker(args,options={}){const p=spawnSync('docker',args,{encoding:null,maxBuffer:12*1024*1024,timeout:25000,...options});if(p.error||p.status!==0)throw Error('DISPOSABLE_POSTGRES_DOCKER_COMMAND_FAILED:'+String(p.error||p.stderr?.toString().slice(0,150)));return p.stdout;}
let dumpHash=null,dumpBytes=null;
try{
 const ready=await boot(sourceUrl,{init:true});assert.equal(ready.contactDurable,true);pass('actual-host-disposable-source-postgres-durable');
 relay=new Relay({dbFile:relayDb,tokens:keys});relayServer=await relay.listen({port:0});relayUrl='http://127.0.0.1:'+relayServer.address().port;
 runner=new Runner({relayUrl,dbFile:sqlDb,tokens:keys,runnerId:keys.JM_ALLOWED_RUNNER_ID});
 const space=await ok('/v5/spaces',{status:201,method:'POST',token:admin,body:{spaceId,label:'CP-C12 disposable custody transfer',kind:'test',members:[{id:memberId,type:'service',capabilities:['command:probe']}]}});memberToken=space.credentials[memberId];assert.ok(memberToken?.length>=32);bridge=bridgeNew();pass('only-command-probe-member-created');
 await ok(`/v5/spaces/${spaceId}/commands`,{status:403,method:'POST',token:admin,body:{action:'shell',target:memberId}});pass('arbitrary-command-refused');
 const first=await actualProbe();pass('real-rd-runner-commits-first-signed-nonce-in-source-pg');
 const sourceBefore=await readHost();assert.equal(sourceBefore.deep.commands.find(c=>c.id===first.commandId).status,'completed');pass('independent-ecdsa-journal-verified-before-dump');
 assert.equal(runner.store.audit().status,'PASS');pass('sqlite-signed-chain-audit-before-dump');
 bridge.close();bridge=null;await stop();
 // pg_dump -Fc from ACTUAL PostgreSQL 16 source service, pg_restore into a
 // DIFFERENT disposable PostgreSQL 16 container, not a second schema in source.
 let dump=execDocker(['exec',sourceCid,'pg_dump','-Fc','--schema=jm_cloud_contact_v1','-U','jm_qa','-d','jm_cloud_c12_source']);
 dumpBytes=dump.length;dumpHash=sha(dump);assert.ok(dumpBytes>500);pass('actual-postgres-custom-format-backup-from-isolated-source-container');
 execDocker(['exec','-i',targetCid,'pg_restore','--no-owner','--no-privileges','-U','jm_qa','-d','jm_cloud_c12_restore'],{input:dump});
 dump.fill(0);dump=null;pass('pg-restore-imports-actual-dump-into-separate-disposable-container');
 const targetReady=await boot(restoreUrl);assert.equal(targetReady.contactDurable,true);assert.ok(targetReady.contactRevision>=1);pass('brand-new-app-filesystem-starts-against-restored-postgres');
 const recovered=await readHost();assert.equal(recovered.receipt.receiptHash,sourceBefore.receipt.receiptHash);assert.equal(recovered.receipt.chainHead,sourceBefore.receipt.chainHead);pass('identical-ecdsa-signed-history-and-chain-head-across-database-transfer');
 assert.equal(recovered.deep.commands.find(c=>c.id===first.commandId).status,'completed');pass('original-real-rd-committed-command-survives-pg_dump_pg_restore');
 bridge=bridgeNew();const second=await actualProbe();assert.notEqual(first.commandId,second.commandId);pass('new-real-rd-probe-executed-and-cryptographically-confirmed-after-pg_restore');
 const targetAfter=await readHost();assert.notEqual(targetAfter.receipt.receiptHash,sourceBefore.receipt.receiptHash);pass('new-target-pg-state-earns-distinct-signed-snapshot');
 assert.equal(runner.store.audit().status,'PASS');pass('sqlite-chain-still-valid-after-pg_transfer');
 bridge.close();bridge=null;await stop();
 await rejected(restoreUrl,{wrongSigner:true});pass('wrong-private-signer-refused-against-restored-custody');
 await rejected(restoreUrl,{wrongHmac:true});pass('wrong-member-hmac-refused-against-restored-custody');
 await boot(sourceUrl);const original=await readHost();assert.equal(original.receipt.receiptHash,sourceBefore.receipt.receiptHash);assert.equal(original.deep.commandCount,1);pass('source-postgres-journal-isolated-from-target-after-second-write');await stop();
 await boot(restoreUrl);const final=await readHost();assert.equal(final.receipt.receiptHash,targetAfter.receipt.receiptHash);assert.equal(final.deep.commandCount,2);pass('restored-target-reopens-with-same-owner-key-and-second-command');
 assert.equal(final.deep.commands.find(c=>c.id===second.commandId).status,'completed');pass('both-local-rd-executions-recovered-from-target-pg');
 // Exact challenge-and-receipt binding was independently checked by actualProbe/reconcileHost.
 report={schema:'jm.cp-c12.actual-pg-backup-restore-real-rd/1',status:'PASS',checksPassed:checks.length,checks,sourceCommit:'654fb330be8b1606b5142a75a1fffce88797c7a5',backups:{kind:'postgres-pg_dump-Fc-and-pg_restore',sha256:dumpHash,bytes:dumpBytes,retained:false},sourceAndTargetDistinct:true,actualCloudServer:true,actualRevolvingDoorRunner:true,signedLocalReceipts:2,independentlyVerifiedHostSignatures:true,productionTouched:false,ownerCredentialsUsed:false,physicalDeviceContact:false};
}catch(e){report={schema:'jm.cp-c12.actual-pg-backup-restore-real-rd/1',status:'HOLD',checksPassed:checks.length,checks,error:String(e.stack||e).slice(0,1300)};process.exitCode=1;}
finally{try{bridge?.close();await runner?.close();if(relayServer)await new Promise(r=>relayServer.close(r));relay?.close();await stop();}catch(e){report.status='HOLD';report.cleanupError=String(e);process.exitCode=1;}fs.rmSync(temp,{recursive:true,force:true});}
if(process.env.JM_C12_EVIDENCE_PATH)fs.writeFileSync(process.env.JM_C12_EVIDENCE_PATH,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
