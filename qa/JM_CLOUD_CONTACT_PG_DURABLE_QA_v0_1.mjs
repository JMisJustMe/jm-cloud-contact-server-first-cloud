// Isolated Postgres durability proof for existing JM Cloud Contact v0.5.1.
// Postgres is a CI service container, not the owner's production database.
// All administrator/member credentials and signing keys are synthetic.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pg from 'pg';
import {fileURLToPath} from 'node:url';
import {inspectCutover} from '../contact/JM_CLOUD_CONTACT_CUTOVER_PREFLIGHT_v0_1.mjs';
const {Pool}=pg;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-contact-pg-qa-'));
const base='http://127.0.0.1:19844';
const port=19844;
const dbUrl=process.env.JM_QA_POSTGRES_URL;
if(!dbUrl||!dbUrl.includes('localhost'))throw Error('This test only accepts an explicit local disposable CI Postgres URL');
const admin='jmadmin_'+crypto.randomBytes(32).toString('hex');
const secret='jmsecret_'+crypto.randomBytes(32).toString('hex');
const signing=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',
  privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const otherSigning=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1',
  privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
const KEY_B64=Buffer.from(signing.privateKey).toString('base64');
const baseEnv={...process.env,HOST:'127.0.0.1',PORT:String(port),
 JM_CLOUD_MODE:'development',JM_CLOUD_ADMIN_TOKEN:admin,JM_CLOUD_SERVER_SECRET:secret,
 JM_CLOUD_ORIGINS:'https://trusted.example',JM_CLOUD_CONTACT_POSTGRES_URL:dbUrl,
 JM_CLOUD_REQUIRE_DURABLE:'1',JM_CLOUD_RECEIPT_SIGNING_KEY_B64:KEY_B64,
 JM_CLOUD_DATA:path.join(temp,'state.json'),
 JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(temp,'irrelevant-local-key.pem'),
 JM_CLOUD_PROFILE_DIR:path.join(root,'profiles'),
 JM_CLOUD_PROFILE_MANIFEST:path.join(root,'profiles/JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json')};
const checks=[];
const pass=x=>checks.push(x);
let child=null,log='';
function start(opts={}){
  child=spawn(process.execPath,[path.join(root,'JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs')],{
    cwd:root,env:{...baseEnv,...opts}});
  log='';
  child.stdout.on('data',v=>log+=String(v).slice(-1200));
  child.stderr.on('data',v=>log+=String(v).slice(-1200));
  return child;
}
async function stop(){
  if(!child)return;
  let c=child;child=null;
  if(c.exitCode!==null||c.signalCode!==null)return;
  c.kill('SIGTERM');
  await Promise.race([once(c,'exit'),new Promise((_,reject)=>setTimeout(()=>reject(Error('Term timeout')),6000))]);
}
async function waitReady(){
  for(let i=0;i<100;i++){
    if(child?.exitCode!==null)throw Error('Server failed during readiness '+log);
    try{let r=await fetch(base+'/ready',{signal:AbortSignal.timeout(500)});
      if(r.ok)return;}
    catch{}
    await new Promise(r=>setTimeout(r,80));
  }
  throw Error('Server did not become ready: '+log);
}
async function request(route,{method='GET',token='',body=null,rid=''}={}){
  const headers={Accept:'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  if(body!==null)headers['Content-Type']='application/json';
  if(rid)headers['X-JM-Request-ID']=rid;
  const r=await fetch(base+route,{method,headers,
    body:body===null?undefined:JSON.stringify(body),signal:AbortSignal.timeout(6000)});
  let j=await r.json().catch(()=>({}));
  return {http:r.status,j};
}
async function status(route,opts,n){
  const x=await request(route,opts);
  assert.equal(x.http,n,route+' '+JSON.stringify(x.j).slice(0,220));
  return x.j;
}
const pool=new Pool({connectionString:dbUrl});
try{
  start({JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:'1'});
  await waitReady();pass('Explicit empty-store bootstrap starts on isolated Postgres');
  const key=(await status('/receipt-key',{},200)).keyId;
  const pre=await inspectCutover({
    host:base,pgUrl:dbUrl,approvedDatabase:'jm_cloud_qa',
    expectedSigningKeyId:key,signingKeyB64:KEY_B64,
    memberHmacSecret:secret,previouslyObservedKeyId:key,allowLoopback:true
  });
  assert.equal(pre.status,'TECHNICAL_PREFLIGHT_PASS_OWNER_APPROVAL_REQUIRED');
  assert.equal(pre.migrationPerformed,false);
  assert.equal(pre.deploymentAuthorized,false);
  assert.equal(pre.observed.durableRows,0);
  assert.equal(pre.observed.contactNamespaceExists,true);
  assert.ok(!JSON.stringify(pre).includes(secret)&&!JSON.stringify(pre).includes(admin));
  pass('Actual owner key + read-only Postgres preflight: review-ready without secrets or writes');
  const drift=await inspectCutover({
    host:base,pgUrl:dbUrl,approvedDatabase:'jm_cloud_qa',
    expectedSigningKeyId:key,signingKeyB64:KEY_B64,
    memberHmacSecret:secret,previouslyObservedKeyId:'0'.repeat(24),allowLoopback:true
  });
  assert.equal(drift.status,'HOLD');
  assert.ok(drift.holds.includes('signer_unchanged_since_prior_observation'));
  pass('Changed previously observed hosted signer fails the read-only migration gate');
  const wrongDb=await inspectCutover({
    host:base,pgUrl:dbUrl,approvedDatabase:'other_owner_database',
    expectedSigningKeyId:key,signingKeyB64:KEY_B64,
    memberHmacSecret:secret,allowLoopback:true
  });
  assert.equal(wrongDb.status,'HOLD');
  assert.ok(wrongDb.holds.includes('database_approved_name_matches'));
  pass('Read-only gate refuses an unapproved shared database identity');
  const space='contact_pg_durable_qa';
  const created=await status('/v4/spaces',{method:'POST',token:admin,
    body:{spaceId:space,label:'Durable Contact QA',
      members:[{id:'sender',type:'client',capabilities:['signal:qa-send','signal:qa-return']},
        {id:'receiver',type:'client',capabilities:['signal:qa-send','signal:qa-return']}]}
  },201);
  const sender=created.credentials.sender,receiver=created.credentials.receiver;
  assert.ok(sender&&receiver&&sender!==receiver);
  const body={schema:'jm.qa.signal/1',challenge:'0123456789abcdef0123456789abcdef',kind:'CONTACT'};
  const sent=await status('/v4/spaces/'+space+'/signals',{method:'POST',token:sender,rid:'qa-send-1',
    body:{to:'receiver',kind:'qa-send',payload:body}},201);
  const firstSignal=sent.signal.id;
  const got=await status('/v4/spaces/'+space+'/signals?after=0',{token:receiver},200);
  assert.equal(got.signals.length,1);
  pass('New space and member signal persisted before HTTP 201');
  let snap=await pool.query('SELECT revision,document,document_sha256,signer_key_id,auth_key_check FROM jm_cloud_contact_v1.state WHERE singleton=1');
  assert.equal(snap.rowCount,1);
  const db=JSON.parse(snap.rows[0].document);
  assert.equal(db.spaces[space].signals[0].id,firstSignal);
  assert.equal(snap.rows[0].signer_key_id.trim(),key);
  assert.equal(snap.rows[0].auth_key_check.trim().length,64);
  assert.ok(!snap.rows[0].document.includes(sender)&&!snap.rows[0].document.includes(receiver));
  pass('Isolated database contains correct signal and hashed credentials only');
  const witness={revision:Number(snap.rows[0].revision),
    sha256:String(snap.rows[0].document_sha256).trim(),liveSpaces:1};
  const reviewed=await inspectCutover({
    host:base,pgUrl:dbUrl,approvedDatabase:'jm_cloud_qa',
    expectedSigningKeyId:key,signingKeyB64:KEY_B64,
    memberHmacSecret:secret,previouslyObservedKeyId:key,allowLoopback:true,
    reviewedExistingState:witness
  });
  assert.equal(reviewed.status,'TECHNICAL_PREFLIGHT_PASS_OWNER_APPROVAL_REQUIRED');
  assert.equal(reviewed.observed.durableRevision,witness.revision);
  assert.equal(reviewed.observed.currentSpaces,1);
  pass('Reviewed existing live space + exact Postgres revision/checksum is eligible for owner-approved recovery');
  const unsignedReview=await inspectCutover({
    host:base,pgUrl:dbUrl,approvedDatabase:'jm_cloud_qa',
    expectedSigningKeyId:key,signingKeyB64:KEY_B64,
    memberHmacSecret:secret,allowLoopback:true
  });
  assert.equal(unsignedReview.status,'HOLD');
  assert.ok(unsignedReview.holds.includes('existing_durable_state_requires_review'));
  assert.ok(unsignedReview.holds.includes('live_space_inventory_safe_for_cutover'));
  pass('Nonzero contact spaces without reviewed state witness remain HOLD');
  const staleReview=await inspectCutover({
    host:base,pgUrl:dbUrl,approvedDatabase:'jm_cloud_qa',
    expectedSigningKeyId:key,signingKeyB64:KEY_B64,
    memberHmacSecret:secret,allowLoopback:true,
    reviewedExistingState:{...witness,revision:witness.revision+1}
  });
  assert.equal(staleReview.status,'HOLD');
  assert.ok(staleReview.holds.includes('existing_durable_state_requires_review'));
  pass('Stale reviewed revision cannot authorise contact-state cutover');
  const alternateJwk=crypto.createPublicKey(otherSigning.privateKey).export({format:'jwk'});
  const alternateFingerprint=crypto.createHash('sha256')
    .update(JSON.stringify(Object.fromEntries(
       Object.entries(alternateJwk).sort(([a],[b])=>a.localeCompare(b)))))
    .digest('hex').slice(0,24);
  let observedKeys=0;
  const inFlightDrift=await inspectCutover({
    host:base,pgUrl:dbUrl,approvedDatabase:'jm_cloud_qa',
    expectedSigningKeyId:key,signingKeyB64:KEY_B64,
    memberHmacSecret:secret,allowLoopback:true,reviewedExistingState:witness,
    fetchImpl:async (url,opts)=>{
      if(url.endsWith('/receipt-key')&&++observedKeys===2)
        return new Response(JSON.stringify({ok:true,
          algorithm:'ECDSA-P256-SHA256-P1363',
          publicKeyJwk:alternateJwk,keyId:alternateFingerprint}),{
          status:200,headers:{'Content-Type':'application/json'}});
      return fetch(url,opts);
    }
  });
  assert.equal(inFlightDrift.status,'HOLD');
  assert.ok(inFlightDrift.holds.includes('signer_stable_during_read_only_preflight'));
  pass('Host public signer drift DURING preflight refuses cutover');
  await stop();
  fs.rmSync(path.join(temp,'state.json'),{force:true});
  fs.rmSync(path.join(temp,'state.json.bak'),{force:true});
  start({JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:'0'});
  await waitReady();
  const key2=(await status('/receipt-key',{},200)).keyId;
  assert.equal(key2,key);
  assert.equal((await status('/health',{},200)).spaces,1);
  const reloaded=await status('/v5/spaces/'+space+'/signals?after=0',{token:receiver},200);
  assert.equal(reloaded.signals[0].id,firstSignal);
  pass('Full server restart recovered spaces, credentials, signals and signing identity without local files');
  const reply=await status('/v5/spaces/'+space+'/signals',{method:'POST',token:receiver,
    rid:'qa-return-1',body:{to:'sender',kind:'qa-return',payload:{challenge:body.challenge,result:'QA receipt only'}}},201);
  assert.ok(reply.signal.id>firstSignal);
  const receipt=await status('/v5/spaces/'+space+'/signals/'+reply.signal.id+'/receipt',{token:sender},200);
  assert.equal(receipt.receipt.publicKeyId,key);
  pass('Signed contact continues after a cold Postgres recovery');
  await stop();
  start({JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:'0',
    JM_CLOUD_RECEIPT_SIGNING_KEY_B64:Buffer.from(otherSigning.privateKey).toString('base64')});
  await new Promise(r=>setTimeout(r,1500));
  assert.notEqual(child.exitCode,null,'Changed signing authority did not stop server');
  await stop();pass('Wrong signing identity fails boot closed');
  start({JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:'0',JM_CLOUD_SERVER_SECRET:'ANOTHER_SECRET_'+secret});
  await new Promise(r=>setTimeout(r,1500));
  assert.notEqual(child.exitCode,null,'Changed member credential HMAC secret did not stop server');
  await stop();pass('Changed member secret fails boot closed');
  start({JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:'0'});await waitReady();
  await pool.query('ALTER TABLE jm_cloud_contact_v1.state RENAME TO state_offline');
  const failed=await request('/v4/spaces/'+space+'/signals',{method:'POST',token:sender,
    rid:'qa-unavailable-1',body:{to:'receiver',kind:'qa-send',payload:{failCase:true}}});
  assert.equal(failed.http,503,'Server acknowledged a write when Postgres was unavailable');
  const still=await request('/ready');assert.equal(still.http,503);
  pass('Lost database write returns 503, with no false mission acknowledgement or READY');
  await pool.query('ALTER TABLE jm_cloud_contact_v1.state_offline RENAME TO state');
  await stop();
  start({JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:'0'});await waitReady();
  const restored=await status('/v4/spaces/'+space+'/signals?after=0',{token:receiver},200);
  assert.equal(restored.signals.length,1,'Unacknowledged failed write survived durable restart');
  pass('Failed write does not survive process restart as a successful signal');
  await stop();
  start({JM_CLOUD_MODE:'production',JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:'0',
    JM_CLOUD_EXPECTED_SIGNING_KEY_ID:key});
  await waitReady();
  const readyProd=await status('/ready',{},200);
  assert.equal(readyProd.contactDurable,true);
  assert.ok(readyProd.contactRevision>=3);
  assert.equal((await status('/health',{},200)).spaces,1);
  pass('Production-mode readiness requires real durable recovery and stable owner-pinned signing ID');
  await stop();
  start({JM_CLOUD_MODE:'production',JM_CLOUD_CONTACT_POSTGRES_URL:'',
    JM_CLOUD_EXPECTED_SIGNING_KEY_ID:key});
  await new Promise(r=>setTimeout(r,1500));
  assert.notEqual(child.exitCode,null,'Production started without any Postgres persistence');
  await stop();pass('Production without durable Postgres refuses to boot');
  start({JM_CLOUD_MODE:'production',JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY:'0',
    JM_CLOUD_EXPECTED_SIGNING_KEY_ID:'0'.repeat(24)});
  await new Promise(r=>setTimeout(r,1500));
  assert.notEqual(child.exitCode,null,'Production accepted an incorrect owner-pinned signer ID');
  await stop();pass('Production key pin mismatch refuses to boot');
}finally{
  await stop().catch(console.error);
  await pool.end();
  fs.rmSync(temp,{recursive:true,force:true});
}
console.log('JM_CLOUD_CONTACT_PG_QA '+JSON.stringify({
  schema:'JM.CloudContact.PostgresDurabilityQA/1',result:'PASS',
  passed:checks.length,checks,
  boundary:'Actual local existing server + disposable CI PostgreSQL; production Render and owner credentials untouched'
}));
