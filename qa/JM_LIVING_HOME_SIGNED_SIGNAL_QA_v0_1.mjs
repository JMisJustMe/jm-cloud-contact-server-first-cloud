// Existing hosted JM Cloud Contact v0.5.1: actual HTTP server/contact/signature QA.
// Isolated ephemeral contact space and generated test-only credentials. No Render calls,
// no AI providers, no installed phone, and no private source or live account mutation.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyLivingHomeReturn} from '../contact/JM_LIVING_HOME_RETURN_VERIFY_v0_1.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-living-home-signed-signal-'));
const port=19639;
const base='http://127.0.0.1:'+port;
const adminToken='QA-ADMIN-'+crypto.randomBytes(32).toString('hex');
const serverSecret='QA-SERVER-'+crypto.randomBytes(32).toString('hex');
const spaceId='jmlh_signed_signal_qa';
const receiptKeyPath=path.join(tmp,'receipt-signing.pem');
const dataPath=path.join(tmp,'contact.json');
const caps=['signal:JM_LIVING_HOME_HANDOFF','signal:JM_LIVING_HOME_RETURN'];
const checks=[];
let child=null,logs='';
const pass=(name)=>checks.push({name,result:'PASS'});
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):
  Array.isArray(v)?'['+v.map(canonical).join(',')+']':
  '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const sha=x=>crypto.createHash('sha256').update(String(x)).digest('hex');
function start(){
  child=spawn(process.execPath,[path.join(root,'JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs')],{
    cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',JM_CLOUD_MODE:'development',
      JM_CLOUD_ADMIN_TOKEN:adminToken,JM_CLOUD_SERVER_SECRET:serverSecret,
      JM_CLOUD_ORIGINS:'https://owner.example',JM_CLOUD_DATA:dataPath,
      JM_CLOUD_RECEIPT_SIGNING_KEY:receiptKeyPath,
      JM_CLOUD_PROFILE_DIR:path.join(root,'profiles'),
      JM_CLOUD_PROFILE_MANIFEST:path.join(root,'profiles','JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json')}
  });
  child.stderr.on('data',v=>{logs+=String(v).slice(-3000)});
  child.stdout.on('data',v=>{logs+=String(v).slice(-3000)});
}
async function stop(){
  if(!child)return;
  const c=child;child=null;
  if(c.exitCode!==null||c.signalCode!==null)return;
  c.kill('SIGTERM');
  await Promise.race([once(c,'exit'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Server stop timeout')),5000))]);
}
async function ready(){
  for(let i=0;i<100;i++){
    if(child?.exitCode!==null)throw Error('Server stopped at boot: '+logs);
    try{let r=await fetch(base+'/ready',{signal:AbortSignal.timeout(600)});if(r.ok)return}
    catch{}await new Promise(r=>setTimeout(r,80));
  }
  throw Error('Server not ready: '+logs);
}
async function req(route,{method='GET',token='',data=null,requestId='',origin=''}={}){
  const headers={Accept:'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  if(data!==null)headers['Content-Type']='application/json';
  if(requestId)headers['X-JM-Request-ID']=requestId;
  if(origin)headers.Origin=origin;
  const r=await fetch(base+route,{method,headers,body:data===null?undefined:JSON.stringify(data),
    signal:AbortSignal.timeout(5000)});
  return {http:r.status,json:await r.json(),cors:r.headers.get('access-control-allow-origin')};
}
async function status(route,opts,expected){
  const x=await req(route,opts);
  assert.equal(x.http,expected,route+' '+JSON.stringify(x.json).slice(0,200));
  return x.json;
}
function verifySignedReceipt(receipt,publicKey,keyId,payload){
  assert.equal(receipt.schema,'jm.cloud-contact.signal-receipt/0.5');
  assert.equal(receipt.publicKeyId,keyId);
  assert.equal(receipt.signatureAlgorithm,'ECDSA-P256-SHA256-P1363');
  assert.equal(receipt.payloadSha256,sha(canonical(payload)));
  const core=Object.fromEntries(Object.entries(receipt).filter(([k])=>
    !['receiptHash','publicSig','publicKeyId','signatureAlgorithm','claimBoundary'].includes(k)));
  assert.equal(sha(canonical(core)),receipt.receiptHash);
  assert.ok(crypto.verify('sha256',Buffer.from(receipt.receiptHash),{
    key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(receipt.publicSig,'base64url')));
  assert.ok(!JSON.stringify(receipt).includes('jmcl_'),'No member credentials in receipt');
}
let outcome='HOLD';
try{
  start();await ready();pass('Actual v0.5.1 server process reachable');
  const meta=await status('/meta',{},200);
  assert.equal(meta.version,'0.5.1-hosted');assert.ok(meta.apiRoots.includes('/v4'));
  pass('Exact hosted v0.5.1 /v4 compatibility');
  const publicKeyMeta=await status('/receipt-key',{},200);
  assert.equal(publicKeyMeta.algorithm,'ECDSA-P256-SHA256-P1363');
  const publicKey=crypto.createPublicKey({format:'jwk',key:publicKeyMeta.publicKeyJwk});
  pass('Existing /receipt-key public ECDSA identity');
  let r=await req('/health',{origin:'null'});
  assert.equal(r.cors,'');pass('Unsafe null browser origin not silently allowed');
  r=await req('/health',{origin:'https://owner.example'});
  assert.equal(r.cors,'https://owner.example');pass('Explicitly whitelisted browser origin remains allowed');
  await status('/v4/spaces',{method:'POST',data:{spaceId}},401);
  pass('Space creation requires admin credentials');
  const created=await status('/v4/spaces',{method:'POST',token:adminToken,
    data:{spaceId,label:'Living Home secure signal test',kind:'jm.livinghome.qa',members:[
      {id:'sender',type:'app',capabilities:caps},{id:'receiver',type:'app',capabilities:caps},
      {id:'outsider',type:'app',capabilities:['event:write']}]}
  },201);
  const sender=created.credentials.sender,receiver=created.credentials.receiver,
    outsider=created.credentials.outsider;
  assert.ok(sender&&receiver&&outsider&&sender!==receiver&&sender!==outsider);
  pass('Admin-created separate capability-scoped members');
  const missionId='jmlh_'+crypto.randomBytes(8).toString('hex');
  const challenge=crypto.randomBytes(16).toString('hex');
  const forward={schema:'JM.LivingHome.CloudMission/1.0',missionId,challenge,
    project:'JM Games House',source:{id:'jm-games-house'},ownerRecorded:'QA synthetic review',
    request:'Synthetic no-op; no external task or model execution',boundaries:['QA only']};
  const sent=await status('/v4/spaces/'+spaceId+'/signals',{method:'POST',token:sender,
    requestId:missionId,data:{to:'receiver',kind:'JM_LIVING_HOME_HANDOFF',payload:forward}},201);
  assert.ok(Number.isSafeInteger(sent.signal.id)&&sent.signal.id>0);
  const signalId=sent.signal.id;pass('Actual member-authorised mission transmitted to server');
  const signalPath='/v4/spaces/'+spaceId+'/signals/'+signalId+'/receipt';
  await status(signalPath,{},401);pass('Signed receipt denies anonymous request');
  await status(signalPath,{token:outsider},404);pass('Nonparticipant is denied same-space signal receipt');
  await status('/v4/spaces/'+spaceId+'/signals/nope/receipt',{token:sender},400);
  pass('Invalid receipt identifier fails closed');
  const recSent=(await status(signalPath,{token:sender},200)).receipt;
  verifySignedReceipt(recSent,publicKey,publicKeyMeta.keyId,forward);
  assert.equal(recSent.from,'sender');assert.equal(recSent.to,'receiver');
  assert.equal(recSent.signalId,signalId);assert.equal(recSent.requestId,missionId);
  pass('Sender obtained verified ECDSA receipt bound to exact mission bytes');
  const recRecv=(await status(signalPath,{token:receiver},200)).receipt;
  verifySignedReceipt(recRecv,publicKey,publicKeyMeta.keyId,forward);
  assert.equal(recRecv.receiptHash,recSent.receiptHash);
  pass('Recipient independently reads same authenticated signal receipt');
  const inbox=await status('/v4/spaces/'+spaceId+'/signals?after=0',{token:receiver},200);
  assert.equal(inbox.signals.length,1);
  assert.equal(inbox.signals[0].payload.challenge,challenge);
  pass('Receiver reads actual source envelope and 32-hex challenge');
  const response={schema:'JM.LivingHome.CloudReturn/1.0',missionId,challenge,
    result:'Synthetic server-side round trip. No owner device or AI action.'};
  const returnRid='return:'+missionId;
  const returned=await status('/v4/spaces/'+spaceId+'/signals',{method:'POST',
    token:receiver,requestId:returnRid,data:{to:'sender',kind:'JM_LIVING_HOME_RETURN',payload:response}},201);
  const returnId=returned.signal.id;
  const responsePath='/v5/spaces/'+spaceId+'/signals/'+returnId+'/receipt';
  const returnProof=(await status(responsePath,{token:sender},200)).receipt;
  verifySignedReceipt(returnProof,publicKey,publicKeyMeta.keyId,response);
  assert.equal(returnProof.from,'receiver');assert.equal(returnProof.to,'sender');
  pass('Response independently ECDSA-signed on the v5 compatibility face');
  const senderInbox=await status('/v4/spaces/'+spaceId+'/signals?after=0',{token:sender},200);
  assert.equal(senderInbox.signals.length,1);
  assert.equal(senderInbox.signals[0].payload.missionId,missionId);
  assert.equal(senderInbox.signals[0].payload.challenge,challenge);
  pass('Original sender received exact challenge-matched server result');
  const ledger={schema:'JM.LivingHome.CP07.CloudReturn/1.0',missions:[{
    missionId,challenge,project:forward.project,origin:base,spaceId,to:'receiver',
    returnSignalId:returnId,returnText:response.result,state:'RETURN_RECEIVED_UNVERIFIED',
    outgoing:forward}]};
  const verified=await verifyLivingHomeReturn({
    baseUrl:base,spaceId,memberId:'sender',memberToken:sender,
    ledger,allowLocal:true,pinnedKeyId:publicKeyMeta.keyId
  });
  assert.equal(verified.status,'SERVER_RETURN_SIGNATURE_VERIFIED');
  assert.equal(verified.keyPinVerified,true);
  assert.equal(verified.returnSignalId,returnId);
  assert.equal(verified.sourceId,'jm-games-house');
  assert.ok(!JSON.stringify(verified).includes(sender));
  pass('Actual CP07 ledger independently verified through authorised server GET + signed receipt');
  await assert.rejects(verifyLivingHomeReturn({
    baseUrl:base,spaceId,memberId:'sender',memberToken:sender,
    ledger:{...ledger,missions:[{...ledger.missions[0],returnText:'FAKE RESULT'}]},
    allowLocal:true,pinnedKeyId:publicKeyMeta.keyId
  }),/differs from CP07 export/);
  pass('Forged CP07 ledger text fails against authenticated returned signal');
  await assert.rejects(verifyLivingHomeReturn({
    baseUrl:base,spaceId,memberId:'sender',memberToken:sender,
    ledger,allowLocal:true,pinnedKeyId:'0'.repeat(24)
  }),/differs from the owner-pinned key ID/);
  pass('Owner-pinned server public key mismatch fails closed');
  const dedup=await status('/v4/spaces/'+spaceId+'/signals',{method:'POST',
    token:receiver,requestId:returnRid,data:{to:'sender',kind:'JM_LIVING_HOME_RETURN',payload:response}},200);
  assert.equal(dedup.deduplicated,true);assert.equal(dedup.signal.id,returnId);
  pass('Repeat return request did not create another signal');
  const tampered={...returnProof,payloadSha256:'0'.repeat(64)};
  assert.throws(()=>verifySignedReceipt(tampered,publicKey,publicKeyMeta.keyId,response));
  pass('Payload-hash tamper fails independent receipt verification');
  const modifiedPayload={...response,result:'Different output'};
  assert.throws(()=>verifySignedReceipt(returnProof,publicKey,publicKeyMeta.keyId,modifiedPayload));
  pass('Altered return payload cannot reuse valid signature');
  const disk=fs.readFileSync(dataPath,'utf8');
  assert.ok(!disk.includes(sender)&&!disk.includes(receiver)&&!disk.includes(outsider));
  pass('No raw member token persisted to durable server file');
  await stop();start();await ready();
  const recoveredKey=await status('/receipt-key',{},200);
  assert.equal(recoveredKey.keyId,publicKeyMeta.keyId);
  const resumed=(await status(responsePath,{token:sender},200)).receipt;
  verifySignedReceipt(resumed,publicKey,publicKeyMeta.keyId,response);
  assert.equal(resumed.receiptHash,returnProof.receiptHash);
  pass('Cold server restart preserved original verifiable receipt/key');
  await status('/v4/spaces/'+spaceId+'/members/receiver/revoke',{method:'POST',token:adminToken},200);
  await status(signalPath,{token:receiver},401);
  pass('Revoked member loses receipt visibility after restart');
  const closed=await status('/v4/spaces/'+spaceId+'/close',{method:'POST',token:adminToken},200);
  assert.equal(closed.space.status,'closed');
  const old=(await status(responsePath,{token:sender},200)).receipt;
  assert.equal(old.receiptHash,returnProof.receiptHash);
  pass('Closed space retains historical member-verifiable proof');
  outcome='PASS';
} catch(error){
  console.error('JM_LIVING_HOME_SIGNED_SIGNAL_QA FAIL '+(error?.stack||error));
  console.error(logs.slice(-600));
  process.exitCode=1;
} finally {
  await stop().catch(e=>{console.error(String(e));process.exitCode=1});
  fs.rmSync(tmp,{recursive:true,force:true});
}
const report={schema:'JM.CloudContact.LivingHome.SignedSignalQA/1',status:outcome,
  boundary:'Actual local v0.5.1 server HTTP, synthetic two-member credentials; not deployed hosted pairing, no physical Fold or AI-provider execution',
  passed:checks.length,checks};
console.log(JSON.stringify(report,null,2));
