// JM CP-C11: actual v0.5 Cloud Contact, **fresh filesystem every boot**,
// original production-mode owner signer/HMAC, disposable Postgres 16.
// No external account, existing database, Render, or device is touched.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';
import {verifySpaceReceipt, keyIdFor} from './c10/bridge/src/v05-proof.mjs';
const pgUrl=process.env.JM_QA_POSTGRES_URL;
const fail=why=>{throw Error('C11_HOLD: '+why)};
if(!pgUrl||!/^postgres(?:ql)?:\/\/jm_qa:[^/@]+@(?:localhost|127\.0\.0\.1):5432\/jm_cloud_qa$/.test(pgUrl))fail('requires disposable CI Postgres localhost jm_cloud_qa as jm_qa; never production URI');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const hex=bytes=>crypto.randomBytes(bytes).toString('hex');
const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-c11-fresh-volume-'));
const {privateKey:signerPem}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const ownerPin=keyIdFor(crypto.createPublicKey(signerPem).export({format:'jwk'}));
const admin=hex(32),memberHmac=hex(32),spaceId='jm_c11_'+hex(8),member='proof_runner';
const newPort=()=>new Promise((ok,no)=>{const s=createServer();s.once('error',no);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const port=await newPort(),base='http://127.0.0.1:'+port;
const volumeFiles=[];let proc=null,stderr='';const checks=[];
const pass=name=>checks.push(name);
const rootEnv={...process.env,HOST:'127.0.0.1',PORT:String(port),JM_CLOUD_MODE:'production',JM_CLOUD_ADMIN_TOKEN:admin,JM_CLOUD_SERVER_SECRET:memberHmac,JM_CLOUD_ORIGINS:'https://qa.invalid',JM_CLOUD_CONTACT_POSTGRES_URL:pgUrl,JM_MARKET_POSTGRES_URL:'',JM_CLOUD_RECEIPT_SIGNING_KEY_B64:Buffer.from(signerPem).toString('base64'),JM_CLOUD_EXPECTED_SIGNING_KEY_ID:ownerPin,JM_CLOUD_PROFILE_DIR:path.join(root,'profiles'),JM_CLOUD_PROFILE_MANIFEST:path.join(root,'profiles','JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json')};
async function api(route,{method='GET',token,body}={}){
 const h={accept:'application/json'};if(token)h.authorization='Bearer '+token;if(body!==undefined)h['content-type']='application/json';
 const r=await fetch(base+route,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(4500)});
 return {status:r.status,value:await r.json()};
}
async function expect(route,status=200,options={}){const r=await api(route,options);assert.equal(r.status,status,route+' '+JSON.stringify(r.value).slice(0,220));return r.value;}
async function boot({allowEmpty=false,wrongKey=false,wrongHmac=false,noSigner=false,noPostgres=false}={}){
 const vol=path.join(tmp,'volume_'+volumeFiles.length);fs.mkdirSync(vol);
 const cache=path.join(vol,'cloud-contact.json'),signerFile=path.join(vol,'signer.pem');volumeFiles.push({dir:vol,cache,signerFile});
 assert.equal(fs.existsSync(cache),false);assert.equal(fs.existsSync(signerFile),false);
 const env={...rootEnv,JM_CLOUD_DATA:cache,JM_CLOUD_RECEIPT_SIGNING_KEY:signerFile,JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:allowEmpty?'1':'0'};
 if(wrongKey){const alt=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});env.JM_CLOUD_RECEIPT_SIGNING_KEY_B64=Buffer.from(alt.privateKey).toString('base64');}
 if(wrongHmac)env.JM_CLOUD_SERVER_SECRET=hex(32);
 if(noSigner)delete env.JM_CLOUD_RECEIPT_SIGNING_KEY_B64;
 if(noPostgres)delete env.JM_CLOUD_CONTACT_POSTGRES_URL;
 stderr='';proc=spawn(process.execPath,[path.join(root,'JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs')],{cwd:root,env,stdio:['ignore','ignore','pipe']});
 proc.stderr.on('data',b=>{if(stderr.length<1400)stderr+=String(b).slice(0,900)});
 for(let i=0;i<120;i++){
  if(proc.exitCode!==null||proc.signalCode!==null)throw Error('EXPECTED_HOST_REJECTED: '+stderr.slice(0,450));
  try{const x=await api('/ready');if(x.status===200&&x.value.ready&&x.value.contactDurable)return x.value;}catch{}
  await new Promise(ok=>setTimeout(ok,65));
 }
 throw Error('HOST_DID_NOT_BECOME_READY: '+stderr.slice(0,450));
}
async function stop(){if(!proc)return;const p=proc;proc=null;if(p.exitCode===null&&p.signalCode===null){p.kill('SIGTERM');await Promise.race([once(p,'exit'),new Promise((_,no)=>setTimeout(()=>no(Error('host stop timeout')),5000))]);}}
async function rejected(opts){let refused=false;try{await boot(opts)}catch(e){refused=/EXPECTED_HOST_REJECTED|HOST_DID_NOT_BECOME_READY/.test(String(e.message));}await stop();assert.equal(refused,true,'Expected fail-closed production boot: '+JSON.stringify(opts));}
async function readProof(){const [key,resp,deep]=await Promise.all([expect('/receipt-key'),expect('/v5/spaces/'+spaceId+'/receipt',200,{token:admin}),expect('/v5/spaces/'+spaceId,200,{token:admin})]);const proof=verifySpaceReceipt({receipt:resp.receipt,keyResponse:key,pin:ownerPin,deep:deep.space});assert.equal(proof.event_chain,'PASS');assert.equal(key.keyId,ownerPin);return {proof,receipt:resp.receipt,deep:deep.space};}
let report;
try{
 const a=await boot({allowEmpty:true});assert.equal(a.contactDurable,true);pass('first-boot-actual-server-in-production-mode-with-disposable-pg');
 const k=await expect('/receipt-key');assert.equal(k.keyId,ownerPin);pass('owner-key-independently-pinned');
 const created=await expect('/v5/spaces',201,{method:'POST',token:admin,body:{spaceId,label:'C11 isolated fresh volume acceptance',kind:'integration-fixture',members:[{id:member,type:'service',capabilities:['command:probe']}]}});
 const token=created.credentials[member];assert.ok(token.length>=32);pass('scoped-contact-member-issued-on-first-boot');
 await expect('/v5/spaces/'+spaceId+'/commands',401,{method:'POST',token,body:{action:'probe',target:member}});pass('member-cannot-act-as-operator');
 await expect('/v5/spaces/'+spaceId+'/commands',403,{method:'POST',token:admin,body:{action:'shell',target:member}});pass('arbitrary-command-capability-rejected');
 const payload={schema:'jm.revolvingdoor.probe/1',nonce:hex(16)};
 const command=(await expect('/v5/spaces/'+spaceId+'/commands',201,{method:'POST',token:admin,body:{action:'probe',target:member,requestId:'jm_c11_'+hex(8),ttlMs:600000,payload}})).command;
 pass('bounded-probe-queued-in-durable-pg');
 let poll=await expect('/v5/spaces/'+spaceId+'/commands?after=0',200,{token});assert.ok(poll.commands.some(c=>c.id===command.id));pass('member-scope-poll-returned-original-command');
 await expect(`/v5/spaces/${spaceId}/commands/${command.id}/ack`,200,{method:'POST',token,body:{status:'accepted'}});
 const detail={schema:'jm.cp-c11.test-fixture/1',nonceDigest:sha(payload.nonce),source:'fixture-no-device-execution'};
 await expect(`/v5/spaces/${spaceId}/commands/${command.id}/result`,200,{method:'POST',token,body:{ok:true,kind:'JM_C11_FIXTURE',detail}});
 pass('host-ack-result-stored-fixture-only');
 const prior=await readProof();pass('ecdsa-chain-valid-first-boot');
 let issued=prior.deep.commands.find(x=>x.id===command.id);assert.equal(issued.result.detail.nonceDigest,sha(payload.nonce));pass('challenge-echo-survives-in-host-state-fixture-only');
 assert.equal(prior.deep.events.find(x=>x.event?.type==='command.queued'&&x.event.payload.commandId===command.id)?.event.payload.payloadSha256,sha(canon(payload)));
 assert.equal(prior.deep.events.find(x=>x.event?.type==='command.result'&&x.event.payload.commandId===command.id)?.event.payload.detailSha256,sha(canon(detail)));
 pass('new-host-signed-chain-binds-payload-and-result-detail');
 await stop();
 // Fresh independent filesystem A -> B: each boot chooses a brand new cache and
 // would-be signer path; persisted key is never accepted from the old volume.
 const b=await boot();assert.equal(b.contactDurable,true);assert.equal(volumeFiles.length,2);pass('cold-boot-new-volume-no-existing-files');
 const recovered=await readProof();assert.equal(recovered.receipt.receiptHash,prior.receipt.receiptHash);assert.equal(recovered.receipt.chainHead,prior.receipt.chainHead);
 pass('owner-managed-key-and-postgres-recover-exact-signed-snapshot-after-new-volume');
 const second=await expect('/v5/spaces/'+spaceId+'/events',201,{method:'POST',token,body:{event:{type:'CP_C11_RESTORED_MEMBER_CONTACT',payload:{nonceDigest:sha(payload.nonce)}}}});
 assert.ok(second.record.hash);pass('member-credential-verifies-across-independent-volume');
 const afterEvent=await readProof();assert.equal(afterEvent.deep.eventCount,prior.deep.eventCount+1);pass('recovered-host-can-commit-new-member-event');
 await stop();
 await rejected({wrongKey:true});pass('wrong-private-signer-refused-under-pinned-owner-identity');
 await rejected({wrongHmac:true});pass('wrong-hmac-member-authority-refused-by-durable-store');
 await rejected({noSigner:true});pass('production-refuses-missing-owner-managed-signer-env');
 await rejected({noPostgres:true});pass('production-refuses-missing-durable-contact-postgres');
 const final=await boot();const finalProof=await readProof();assert.equal(finalProof.receipt.receiptHash,afterEvent.receipt.receiptHash);pass('final-fresh-volume-recovers-same-postgres-state-after-refused-boots');
 for(const v of volumeFiles){assert.equal(fs.existsSync(v.signerFile),false);}pass('private-signer-never-resident-in-test-volume-files');
 assert.equal(final.contactDurable,true);assert.ok(final.contactRevision>=1);pass('cutover-analog-returns-postgres-revision');
 report={schema:'jm.cp-c11.fresh-volume-durable-signing-rehearsal/1',status:'PASS',checksPassed:checks.length,checks,realServer:true,postgres:'disposable-localhost',signingKeySource:'test-only-env-not-disk',volumeCount:volumeFiles.length,ownerSignerKeyId:ownerPin,localVolumeIsolation:true,productionRenderTouched:false,realRDRunnerInThisTest:false,claims:'Simulated production process on isolated CI only; no real owner key, production database, phone, laptop or live hosted probe.'};
}catch(e){report={schema:'jm.cp-c11.fresh-volume-durable-signing-rehearsal/1',status:'HOLD',checksPassed:checks.length,checks,error:String(e.stack||e).slice(0,1200)};process.exitCode=1;}
finally{try{await stop()}catch(e){report.status='HOLD';report.cleanupFailure=String(e);process.exitCode=1;}fs.rmSync(tmp,{recursive:true,force:true});}
if(process.env.JM_C11_EVIDENCE_PATH)fs.writeFileSync(process.env.JM_C11_EVIDENCE_PATH,JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
