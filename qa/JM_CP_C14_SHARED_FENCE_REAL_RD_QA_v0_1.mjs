// JM CP-C14 — live localhost server with source/target PostgreSQL and a SINGLE
// shared authoritative fence PostgreSQL. No connection to Render or user databases.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';import {once} from 'node:events';
import {fileURLToPath} from 'node:url';import {createServer} from 'node:net';
import pg from 'pg';
import {JMContactWriterFence} from '../contact/JM_CLOUD_CONTACT_WRITER_FENCE_v0_1.mjs';
import {Relay} from './c10/bridge/revolving-door-v0_1_2_challenge/src/relay.mjs';
import {Runner} from './c10/bridge/revolving-door-v0_1_2_challenge/src/runner.mjs';
import {V05Bridge} from './c10/bridge/src/v05-bridge.mjs';
import {reconcileHost} from './c10/bridge/src/v05-reconcile.mjs';
import {verifySpaceReceipt,keyIdFor} from './c10/bridge/src/v05-proof.mjs';
const U={source:'postgres://jm_qa:qa123@127.0.0.1:5432/jm_cloud_c14_source',target:'postgres://jm_qa:qa123@127.0.0.1:5433/jm_cloud_c14_target',fence:'postgres://jm_qa:qa123@127.0.0.1:5434/jm_cloud_c14_fence'};
const E={source:process.env.JM_C14_SOURCE_PG_URL,target:process.env.JM_C14_TARGET_PG_URL,fence:process.env.JM_C14_FENCE_PG_URL};
const ids=[process.env.JM_C14_SOURCE_CONTAINER_ID,process.env.JM_C14_TARGET_CONTAINER_ID,process.env.JM_C14_FENCE_CONTAINER_ID];
if(process.env.GITHUB_ACTIONS!=='true'||Object.keys(U).some(k=>E[k]!==U[k])||ids.some(x=>!x)||new Set(ids).size!==3)throw Error('CP_C14_REQUIRES_THREE_EXACT_DISPOSABLE_GITHUB_POSTGRES_CONTAINERS');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-c14-writer-fence-'));
const rand=()=>crypto.randomBytes(32).toString('hex');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const admin=rand(),secret=rand(),ownerA='carrier-a-'+crypto.randomBytes(6).toString('hex'),ownerB='carrier-b-'+crypto.randomBytes(6).toString('hex'),scope='jm-c14-'+crypto.randomBytes(8).toString('hex');
const spaceId='jm_c14_'+crypto.randomBytes(8).toString('hex'),memberId='rd_probe';
const tokens={JM_PRODUCER_TOKEN:rand(),JM_RUNNER_TOKEN:rand(),JM_MISSION_KEY:rand(),JM_RECEIPT_KEY:rand(),JM_WAKE_TOKEN:rand(),JM_ALLOWED_RUNNER_ID:'jm-c14-runner'};
const signer=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;
const pin=keyIdFor(crypto.createPublicKey(signer).export({format:'jwk'}));
const port=await new Promise((ok,no)=>{const s=createServer();s.once('error',no);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const host='http://127.0.0.1:'+port,log=[];const pass=k=>{log.push(k);console.log('JM_C14_STAGE',log.length,k);};
const watchdog=setTimeout(()=>{console.error('JM_C14_WATCHDOG_HOLD',JSON.stringify({lastChecks:log.slice(-5)}));process.exit(124);},55000);watchdog.unref();
const envBase={...process.env,HOST:'127.0.0.1',PORT:String(port),JM_CLOUD_MODE:'production',JM_CLOUD_ADMIN_TOKEN:admin,JM_CLOUD_SERVER_SECRET:secret,JM_CLOUD_ORIGINS:'https://example.invalid',JM_CLOUD_RECEIPT_SIGNING_KEY_B64:Buffer.from(signer).toString('base64'),JM_CLOUD_EXPECTED_SIGNING_KEY_ID:pin,JM_CLOUD_PROFILE_DIR:path.join(root,'profiles'),JM_CLOUD_PROFILE_MANIFEST:path.join(root,'profiles','JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json'),JM_MARKET_POSTGRES_URL:'',JM_CLOUD_WRITER_FENCE_POSTGRES_URL:U.fence,JM_CLOUD_WRITER_FENCE_SCOPE:scope};
let child,relay,relayServer,runner,bridge,memberToken,relayUrl,boots=0, report,blocker=null;
const fence=new JMContactWriterFence({connectionString:U.fence,scope,owner:ownerA,epoch:1});
const sourcePool=new pg.Pool({connectionString:U.source,max:2});
const targetPool=new pg.Pool({connectionString:U.target,max:2});
async function call(url,{method='GET',token,body}={}){const headers={accept:'application/json'};if(token)headers.authorization='Bearer '+token;if(body!==undefined)headers['content-type']='application/json';const r=await fetch(host+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(7000)});return {status:r.status,data:await r.json()};}
async function checked(url,{status=200,...params}={}){const r=await call(url,params);assert.equal(r.status,status,url+':'+JSON.stringify(r.data).slice(0,220));return r.data;}
async function boot(which,owner,epoch,{expectFailure=false}={}){
 const volume=path.join(tmp,'boot_'+boots++);fs.mkdirSync(volume);
 const env={...envBase,JM_CLOUD_CONTACT_POSTGRES_URL:U[which],JM_CLOUD_WRITER_FENCE_OWNER:owner,JM_CLOUD_WRITER_FENCE_EPOCH:String(epoch),JM_CLOUD_DATA:path.join(volume,'data.json'),JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(volume,'unused.pem'),JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:which==='source'?'1':'0'};
 assert.equal(fs.existsSync(env.JM_CLOUD_DATA),false);
 let stderr='';child=spawn(process.execPath,[path.join(root,'JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs')],{cwd:root,env,stdio:['ignore','ignore','pipe']});child.stderr.on('data',b=>{if(stderr.length<1000)stderr+=String(b).slice(0,1000)});
 for(let n=0;n<110;n++){if(child.exitCode!==null||child.signalCode!==null){if(expectFailure)return;throw Error('SERVER_EARLY_EXIT:'+stderr.slice(0,400));}
  try{const r=await call('/ready');if(r.status===200&&r.data.ready&&r.data.contactDurable){if(expectFailure)throw Error('UNEXPECTED_STALE_SERVER_BOOT');return;}}catch(e){if(String(e).includes('UNEXPECTED_STALE'))throw e;}
  await new Promise(r=>setTimeout(r,85));}
 if(!expectFailure)throw Error('SERVER_BOOT_TIMEOUT:'+stderr.slice(0,400));throw Error('STALE_SERVER_DID_NOT_REJECT');
}
async function stop(){if(!child)return;const c=child;child=null;if(c.exitCode===null&&c.signalCode===null){c.kill('SIGTERM');await Promise.race([once(c,'exit'),new Promise((_,reject)=>setTimeout(()=>reject(Error('C14_STOP_TIMEOUT')),6000))]);}}
async function hostState(){const [key,receipt,deep]=await Promise.all([checked('/receipt-key'),checked(`/v5/spaces/${spaceId}/receipt`,{token:admin}),checked(`/v5/spaces/${spaceId}`,{token:admin})]);assert.equal(key.keyId,pin);const proof=verifySpaceReceipt({receipt:receipt.receipt,keyResponse:key,pin,deep:deep.space});assert.equal(proof.event_chain,'PASS');return {receipt:receipt.receipt,deep:deep.space};}
async function queued(){const nonce=crypto.randomBytes(16).toString('hex');const r=await checked(`/v5/spaces/${spaceId}/commands`,{status:201,method:'POST',token:admin,body:{action:'probe',target:memberId,requestId:'jm_c14_'+nonce,ttlMs:600000,payload:{schema:'jm.revolvingdoor.probe/1',nonce}}});return r.command;}
async function actualProbe(){const cmd=await queued();const staged=await bridge.pollAndStage();assert.ok(staged.some(s=>s.commandId===cmd.id));const result=await runner.once();assert.equal(result.code,'PROBE_OK');assert.equal(result.content_hash,sha(cmd.payload.nonce));const posted=await bridge.finalize(cmd.id);assert.equal(posted.phase,'RESULT_HTTP_ACKNOWLEDGED');const recon=await reconcileHost({cloudUrl:host,spaceId,memberId,dbFile:path.join(tmp,'inbox.sqlite'),adminToken:admin,pinnedKeyId:pin,localMock:true});assert.equal(recon.statuses.find(s=>s.id===cmd.id).phase,'RESULT_CONFIRMED');return cmd.id;}
function command(args,{input}={}){const p=spawnSync('docker',args,{input,encoding:null,maxBuffer:8*1024*1024,timeout:25000});if(p.error||p.status!==0)throw Error('CP_C14_DOCKER:'+String(p.error||p.stderr?.toString().slice(0,280)));return p.stdout;}
const sourceCid=ids[0],targetCid=ids[1];
async function saved(pgPool){const r=await pgPool.query('SELECT revision,document_sha256 FROM jm_cloud_contact_v1.state WHERE singleton=1');assert.equal(r.rows.length,1);return {revision:Number(r.rows[0].revision),checksum:r.rows[0].document_sha256.trim()};}
function newBridge(){return new V05Bridge({cloudUrl:host,spaceId,memberId,memberToken,relayUrl,tokens,dbFile:path.join(tmp,'inbox.sqlite'),localMock:true});}
try{
 process.env.JM_C14_DISPOSABLE_FENCE_BOOTSTRAP='YES_TEST_ONLY';await fence.bootstrapForTest();delete process.env.JM_C14_DISPOSABLE_FENCE_BOOTSTRAP;pass('explicit-bootstrap-single-shared-authority');
 await boot('source',ownerA,1);pass('actual-source-server-starts-with-owner-epoch-one');
 relay=new Relay({dbFile:path.join(tmp,'relay.sqlite'),tokens});relayServer=await relay.listen({port:0});relayUrl='http://127.0.0.1:'+relayServer.address().port;
 runner=new Runner({relayUrl,dbFile:path.join(tmp,'runner.sqlite'),tokens,runnerId:tokens.JM_ALLOWED_RUNNER_ID});
 const member=await checked('/v5/spaces',{status:201,method:'POST',token:admin,body:{spaceId,label:'CP-C14 shared writer-fence QA',kind:'test',members:[{id:memberId,type:'service',capabilities:['command:probe','event:write']}]}});memberToken=member.credentials[memberId];bridge=newBridge();
 const first=await actualProbe();const initial=await hostState();const watermark1=await saved(sourcePool);const fence1=await fence.current();assert.equal(Number(fence1.snapshot_revision),watermark1.revision);assert.equal(fence1.snapshot_sha256,watermark1.checksum);pass('actual-rd-probe-committed-with-shared-fence-watermark');
 bridge.close();bridge=null;await stop();
 let dump=command(['exec',sourceCid,'pg_dump','-Fc','--schema=jm_cloud_contact_v1','-U','jm_qa','-d','jm_cloud_c14_source']);command(['exec','-i',targetCid,'pg_restore','--no-owner','--no-privileges','-U','jm_qa','-d','jm_cloud_c14_target'],{input:dump});dump.fill(0);pass('first-real-postgres-snapshot-restored-to-separate-carrier');
 await boot('source',ownerA,1);
 // Actual concurrency proof: block the Cloud Contact state row to suspend an
 // HTTP durable write WHILE it holds the shared writer-fence row lock. A
 // concurrent promotion must wait, then notice the advanced checkpoint.
 blocker=await sourcePool.connect();await blocker.query('BEGIN');
 await blocker.query('SELECT singleton FROM jm_cloud_contact_v1.state WHERE singleton=1 FOR UPDATE');
 const latePromise=call(`/v5/spaces/${spaceId}/events`,{method:'POST',token:memberToken,body:{event:{type:'JM_CP_C14_POST_BACKUP_CHECKPOINT',details:{scope:'isolated-ci',kind:'late-guarded-event'}}}});
 let writeHasFence=false;
 for(let i=0;i<50;i++){
   const trial=await fence.pool.connect();
   try{await trial.query('BEGIN');await trial.query('SELECT scope FROM jm_cloud_contact_fence_v1.authority WHERE scope=$1 FOR UPDATE NOWAIT',[scope]);await trial.query('ROLLBACK');}
   catch(e){await trial.query('ROLLBACK');if(e.code==='55P03')writeHasFence=true;else throw e;}
   finally{trial.release();}
   if(writeHasFence)break;await new Promise(resolve=>setTimeout(resolve,35));
 }
 assert.equal(writeHasFence,true,'Actual HTTP writer must hold shared fence while state save is blocked');pass('actual-HTTP-write-holds-shared-Postgres-fence-lock');
 const promotionPending=fence.promote({expectedOwner:ownerA,expectedEpoch:1,expectedRevision:watermark1.revision,expectedChecksum:watermark1.checksum,nextOwner:ownerB});
 await new Promise(resolve=>setTimeout(resolve,90));
 await blocker.query('COMMIT');blocker.release();blocker=null;
 const late=await latePromise;assert.equal(late.status,201);assert.ok(late.data.record?.hash);
 const latest=await saved(sourcePool);assert.ok(latest.revision>watermark1.revision);pass('old-authoritative-source-advanced-after-backup');
 const stale=await promotionPending;assert.equal(stale.status,'HOLD');assert.ok(['CHECKPOINT_REVISION_MISMATCH','CHECKPOINT_HASH_MISMATCH'].includes(stale.reason));pass('concurrent-stale-promotion-waits-and-refuses-later-checkpoint');
 await stop();
 command(['exec',targetCid,'psql','-U','jm_qa','-d','jm_cloud_c14_target','-c','DROP SCHEMA IF EXISTS jm_cloud_contact_v1 CASCADE']);
 let fresh=command(['exec',sourceCid,'pg_dump','-Fc','--schema=jm_cloud_contact_v1','-U','jm_qa','-d','jm_cloud_c14_source']);command(['exec','-i',targetCid,'pg_restore','--no-owner','--no-privileges','-U','jm_qa','-d','jm_cloud_c14_target'],{input:fresh});fresh.fill(0);pass('candidate-recovered-from-latest-authoritative-source');
 await boot('source',ownerA,1);const sourceBeforeCutover=await hostState();assert.equal(sourceBeforeCutover.deep.commandCount,1);pass('old-source-still-live-before-fence-promotion');
 const current=await fence.current();assert.equal(current.snapshot_sha256,latest.checksum);assert.equal(Number(current.snapshot_revision),latest.revision);pass('latest-checkpoint-rechecked-under-fence');
 const restoredState=await saved(targetPool);assert.deepEqual(restoredState,latest);pass('candidate-restored-checksum-and-revision-match-fenced-watermark');
 const promotion=await fence.promote({expectedOwner:ownerA,expectedEpoch:1,expectedRevision:latest.revision,expectedChecksum:latest.checksum,nextOwner:ownerB});assert.equal(promotion.status,'PROMOTED_IN_DISPOSABLE_AUTHORITY');assert.equal(promotion.epoch,2);assert.equal(promotion.productionApproved,false);pass('shared-authority-epoch-two-promoted-without-production-approval');
 const oldAttempt=await call(`/v5/spaces/${spaceId}/commands`,{method:'POST',token:admin,body:{action:'probe',target:memberId,requestId:'jm_c14_old_fenced_'+crypto.randomBytes(5).toString('hex'),payload:{schema:'jm.revolvingdoor.probe/1',nonce:crypto.randomBytes(16).toString('hex')}}});assert.ok(oldAttempt.status>=400);const sourceAfterFail=await saved(sourcePool);assert.deepEqual(sourceAfterFail,latest);pass('formerly-live-source-request-denied-with-zero-durable-advance');
 await stop();
 try{await boot('source',ownerA,1,{expectFailure:true});pass('stale-epoch-source-reboot-fails-closed');}finally{await stop()}
 await boot('target',ownerB,2);const targetBefore=await hostState();assert.equal(targetBefore.receipt.receiptHash,sourceBeforeCutover.receipt.receiptHash);pass('successor-with-new-epoch-restores-exact-signed-history');
 bridge=newBridge();const second=await actualProbe();assert.notEqual(first,second);assert.ok(late.data.record?.hash);pass('real-rd-probe-executes-on-new-fenced-Postgres-owner');
 const after=await hostState();assert.equal(after.deep.commandCount,2);assert.equal(runner.store.audit().status,'PASS');pass('post-promotion-local-and-host-signatures-verify');
 const oldEpochAttempt=await fence.promote({expectedOwner:ownerA,expectedEpoch:1,expectedRevision:latest.revision,expectedChecksum:latest.checksum,nextOwner:'third'});assert.equal(oldEpochAttempt.status,'HOLD');assert.equal(oldEpochAttempt.reason,'STALE_WRITER_EPOCH');pass('second-promotion-with-stale-epoch-refused');
 const f2=await fence.current();assert.equal(f2.owner,ownerB);assert.equal(Number(f2.epoch),2);pass('new-owner-authority-preserved');
 bridge.close();bridge=null;await stop();
 const targetAgain=await boot('target',ownerB,2);const final=await hostState();assert.equal(final.receipt.receiptHash,after.receipt.receiptHash);pass('cold-boot-retains-new-owner-signed-history');await stop();
 report={schema:'jm.cp-c14.shared-pg-fence-real-rd/1',status:'PASS',checksPassed:log.length,checks:log,threeDistinctDisposablePostgres:true,sharedFence:true,oneOldWriterDurablyDenied:true,staleSnapshotPromotion:'HOLD',oldWriterRestart:'HOLD',productionApproved:false,productionTouched:false,physicalDeviceContact:false,claimBoundary:'Shared fence serialises successful application saves while lock is held; not an atomic distributed commit across independent databases or authority for production cutover.'};
}catch(err){report={schema:'jm.cp-c14.shared-pg-fence-real-rd/1',status:'HOLD',checksPassed:log.length,checks:log,error:String(err.stack||err).slice(0,1500)};process.exitCode=1;}
finally{try{if(blocker){try{await blocker.query('ROLLBACK')}catch{}blocker.release();blocker=null;}bridge?.close();await runner?.close();if(relayServer)await new Promise(ok=>relayServer.close(ok));relay?.close();await stop();await fence.close();await sourcePool.end();await targetPool.end();}catch(e){report.status='HOLD';report.cleanupError=String(e);process.exitCode=1}fs.rmSync(tmp,{recursive:true,force:true});}
clearTimeout(watchdog);
if(process.env.JM_C14_EVIDENCE_PATH)fs.writeFileSync(process.env.JM_C14_EVIDENCE_PATH,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
