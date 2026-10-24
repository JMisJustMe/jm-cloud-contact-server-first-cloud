// JM CP-C15 — live localhost server with source/target PostgreSQL and a SINGLE
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
if(process.env.GITHUB_ACTIONS!=='true'||Object.keys(U).some(k=>E[k]!==U[k])||ids.some(x=>!x)||new Set(ids).size!==3)throw Error('CP_C15_REQUIRES_THREE_EXACT_DISPOSABLE_GITHUB_POSTGRES_CONTAINERS');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-c15-atomicity-'));
const rand=()=>crypto.randomBytes(32).toString('hex');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const admin=rand(),secret=rand(),ownerA='carrier-a-'+crypto.randomBytes(6).toString('hex'),ownerB='carrier-b-'+crypto.randomBytes(6).toString('hex'),scope='jm-c14-'+crypto.randomBytes(8).toString('hex');
const spaceId='jm_c14_'+crypto.randomBytes(8).toString('hex'),memberId='rd_probe';
const tokens={JM_PRODUCER_TOKEN:rand(),JM_RUNNER_TOKEN:rand(),JM_MISSION_KEY:rand(),JM_RECEIPT_KEY:rand(),JM_WAKE_TOKEN:rand(),JM_ALLOWED_RUNNER_ID:'jm-c14-runner'};
const signer=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;
const pin=keyIdFor(crypto.createPublicKey(signer).export({format:'jwk'}));
const port=await new Promise((ok,no)=>{const s=createServer();s.once('error',no);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const host='http://127.0.0.1:'+port,log=[];const pass=k=>{log.push(k);console.log('JM_C15_STAGE',log.length,k);};
const watchdog=setTimeout(()=>{console.error('JM_C15_WATCHDOG_HOLD',JSON.stringify({lastChecks:log.slice(-5)}));process.exit(124);},55000);watchdog.unref();
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

// Inherited names and env contracts deliberately remain CP-C14-compatible;
// GitHub Actions provisions FRESH disposable databases for this independent job.
let dump=null,sourceBefore=null,faultDigest=null,decisionReason=null;
try {
 process.env.JM_C14_DISPOSABLE_FENCE_BOOTSTRAP='YES_TEST_ONLY';
 await fence.bootstrapForTest();delete process.env.JM_C14_DISPOSABLE_FENCE_BOOTSTRAP;
 pass('new-disposable-shared-authority-bootstrap');
 await boot('source',ownerA,1);pass('actual-server-starts-with-matching-empty-checkpoints');
 relay=new Relay({dbFile:path.join(tmp,'relay.sqlite'),tokens});
 relayServer=await relay.listen({port:0});relayUrl='http://127.0.0.1:'+relayServer.address().port;
 runner=new Runner({relayUrl,dbFile:path.join(tmp,'runner.sqlite'),tokens,runnerId:tokens.JM_ALLOWED_RUNNER_ID});
 const member=await checked('/v5/spaces',{status:201,method:'POST',token:admin,body:{spaceId,label:'CP-C15 uncertain transaction recovery',kind:'test',members:[{id:memberId,type:'service',capabilities:['command:probe','event:write']}]}});
 memberToken=member.credentials[memberId];bridge=newBridge();
 const first=await actualProbe();assert.ok(first);const stable=await hostState();
 sourceBefore=await saved(sourcePool);const f0=await fence.current();
 assert.equal(Number(f0.snapshot_revision),sourceBefore.revision);
 assert.equal(f0.snapshot_sha256,sourceBefore.checksum);
 assert.equal(runner.store.audit().status,'PASS');
 pass('actual-rd-signed-nonce-and-both-committed-checkpoints-match');
 // Exact native binary database backup before fault; retained in memory only.
 dump=command(['exec',sourceCid,'pg_dump','-Fc','--schema=jm_cloud_contact_v1','-U','jm_qa','-d','jm_cloud_c14_source']);
 assert.ok(dump.length>500);pass('native-source-pg-backup-before-failure');
 // Inject a REAL PostgreSQL ERROR on the shared fence UPDATE. The separate
 // Contact state save has already COMMITTED by the time this trigger fires.
 await fence.pool.query(`CREATE FUNCTION jm_cloud_contact_fence_v1.c15_fail_update() RETURNS trigger LANGUAGE plpgsql AS $$
 BEGIN RAISE EXCEPTION 'JM_C15_SIMULATED_FENCE_UPDATE_LOSS'; END; $$`);
 await fence.pool.query(`CREATE TRIGGER c15_fail_authority_update BEFORE UPDATE ON jm_cloud_contact_fence_v1.authority
 FOR EACH ROW EXECUTE FUNCTION jm_cloud_contact_fence_v1.c15_fail_update()`);
 pass('real-postgres-trigger-injects-post-state-save-fence-failure');
 const uncertainId='c15_uncertain_'+crypto.randomBytes(10).toString('hex');
 let response=null;
 try{response=await call(`/v5/spaces/${spaceId}/events`,{method:'POST',token:memberToken,body:{requestId:uncertainId,event:{type:'JM_C15_UNCERTAIN_WRITE',details:{checkpoint:'isolated-failure-injection'}}}});}catch(e){/* Transport may drop reply. Still uncertain. */}
 assert.ok(!response||response.status>=400,'Never acknowledge a state write whose fence update failed');
 pass('http-request-not-successfully-acknowledged');
 const afterFault=await saved(sourcePool);const fenceAfter=await fence.current();
 assert.equal(afterFault.revision,sourceBefore.revision+1);
 assert.notEqual(afterFault.checksum,sourceBefore.checksum);
 assert.equal(Number(fenceAfter.snapshot_revision),sourceBefore.revision);
 assert.equal(fenceAfter.snapshot_sha256,sourceBefore.checksum);
 faultDigest=afterFault.checksum;
 pass('genuine-committed-state-ahead-of-uncommitted-fence-detected');
 await fence.pool.query('DROP TRIGGER c15_fail_authority_update ON jm_cloud_contact_fence_v1.authority');
 await fence.pool.query('DROP FUNCTION jm_cloud_contact_fence_v1.c15_fail_update()');
 pass('fault-injection-revoked-before-readback');
 await stop();
 // New process sees the same owner/epoch yet DENIES boot due to mismatch.
 await boot('source',ownerA,1,{expectFailure:true});await stop();
 pass('fresh-production-configured-server-rejects-uncertain-committed-state');
 const locked=await fence.current();assert.equal(Number(locked.snapshot_revision),sourceBefore.revision);
 pass('shared-authority-checkpoint-never-falsely-advanced');
 // Operator CONTROLLED recovery: explicitly restore known-good state backup;
 // do NOT auto-repair the shared fence or replay the unacknowledged event.
 command(['exec',sourceCid,'psql','-U','jm_qa','-d','jm_cloud_c14_source','-c','DROP SCHEMA IF EXISTS jm_cloud_contact_v1 CASCADE']);
 command(['exec','-i',sourceCid,'pg_restore','--no-owner','--no-privileges','-U','jm_qa','-d','jm_cloud_c14_source'],{input:dump});dump.fill(0);dump=null;
 const afterRestore=await saved(sourcePool);assert.deepEqual(afterRestore,sourceBefore);
 pass('operator-controlled-native-pg-restore-matches-unchanged-fence-checkpoint');
 await boot('source',ownerA,1);const recovered=await hostState();
 assert.equal(recovered.receipt.receiptHash,stable.receipt.receiptHash);
 assert.equal(recovered.deep.commands.some(c=>c.id===first&&c.status==='completed'),true);
 assert.equal(recovered.deep.events.some(e=>e.event?.type==='JM_C15_UNCERTAIN_WRITE'),false);
 pass('historically-signed-receipt-recovered-with-unacknowledged-write-not-crowned');
 // The actual runner is still separate, does not silently replay the failed event.
 bridge.close();bridge=null;bridge=newBridge();
 const second=await actualProbe();assert.notEqual(second,first);
 const fresh=await hostState();assert.ok(fresh.deep.commandCount>=2);
 assert.equal(runner.store.audit().status,'PASS');
 pass('new-real-rd-signed-nonce-commits-after-controlled-recovery');
 const nowState=await saved(sourcePool);const nowFence=await fence.current();
 assert.equal(Number(nowFence.snapshot_revision),nowState.revision);
 assert.equal(nowFence.snapshot_sha256,nowState.checksum);
 pass('contact-and-fence-watermarks-again-match-after-new-probe');
 // Reverse divergence (fence ahead of state) is covered by pure policy tests,
 // not claimed as live runtime proof in this fixture.
 pass('reverse-divergence-fail-closed-policy-is-separate-from-runtime-proof');
 report={schema:'jm.cp-c15.actual-db-split-commit-recovery/1',status:'PASS',checksPassed:log.length,checks:log,contactStateCommittedWithoutFence:true,httpSuccessAfterSplit:false,restartOnDivergence:'HOLD',controlledDatabaseRestore:true,signedRunnerAfterRestore:true,reverseDivergenceRuntime:'NOT_TESTED',productionApproved:false,productionTouched:false,physicalDeviceContact:false,claimBoundary:'Demonstrates post-state-commit fence-update failure and explicit operator restore, not atomic distributed commit or real network loss.'};
}catch(err){report={schema:'jm.cp-c15.actual-db-split-commit-recovery/1',status:'HOLD',checksPassed:log.length,checks:log,error:String(err.stack||err).slice(0,1700)};process.exitCode=1;}
finally{try{if(blocker){try{await blocker.query('ROLLBACK')}catch{}blocker.release();blocker=null;}if(bridge){bridge.close();bridge=null;}await runner?.close();if(relayServer)await new Promise(ok=>relayServer.close(ok));relay?.close();await stop();await fence.close();await sourcePool.end();await targetPool.end();}catch(e){report.status='HOLD';report.cleanupError=String(e);process.exitCode=1;}if(dump){dump.fill(0);dump=null;}fs.rmSync(tmp,{recursive:true,force:true});}
clearTimeout(watchdog);
if(process.env.JM_C15_EVIDENCE_PATH)fs.writeFileSync(process.env.JM_C15_EVIDENCE_PATH,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
