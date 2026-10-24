import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes,createHash } from 'node:crypto';
import { Relay } from '../src/relay.mjs';
import { Runner } from '../src/runner.mjs';
import { LocalStore } from '../src/local-store.mjs';
import { signMission, checkMission, checkReceipt, sha256 } from '../src/protocol.mjs';
const t=()=>randomBytes(32).toString('hex');
const makeTokens=()=>({JM_PRODUCER_TOKEN:t(),JM_RUNNER_TOKEN:t(),JM_WAKE_TOKEN:t(),JM_MISSION_KEY:t(),JM_RECEIPT_KEY:t(),JM_ALLOWED_RUNNER_ID:'runner-one'});
const hash=t=>createHash('sha256').update(t).digest('hex');
async function setup(opts={}){
  const dir=mkdtempSync(path.join(tmpdir(),'jm-door-'));
  const tokens=makeTokens();
  const relay=new Relay({dbFile:path.join(dir,'relay.sqlite'),tokens,leaseMs:opts.leaseMs??1000,maxAttempts:opts.maxAttempts??5});
  const server=await relay.listen({port:0});
  const url='http://127.0.0.1:'+server.address().port;
  const localPath=path.join(dir,'local.sqlite');
  const runner=()=>new Runner({relayUrl:url,dbFile:localPath,tokens,runnerId:'runner-one'});
  const request=async(path,method='GET',object,role='JM_PRODUCER_TOKEN',key)=>{
    const res=await fetch(url+path,{method,headers:{authorization:'Bearer '+(key??tokens[role]),...(object!==undefined?{'content-type':'application/json'}:{})},body:object===undefined?undefined:JSON.stringify(object)});
    return {status:res.status,data:await res.json()};
  };
  const sign=(body)=>signMission({target:'runner-one',...body},tokens.JM_MISSION_KEY);
  const submit=async(body)=>request('/v1/missions','POST',{mission:await sign(body)});
  const close=async()=>{await new Promise(r=>server.close(r));relay.close();rmSync(dir,{recursive:true,force:true});};
  return {dir,tokens,relay,runner,url,request,sign,submit,close,localPath};
}
async function claim(s){return (await s.request('/v1/claim?runner=runner-one','GET',undefined,'JM_RUNNER_TOKEN')).data.claim;}
async function ack(s,c,rec){return s.request('/v1/receipt','POST',{id:c.id,lease_token:c.lease_token,receipt:rec},'JM_RUNNER_TOKEN');}
const id=n=>'mission_'+String(n).padStart(6,'0');

test('01: no default secrets and token separation',async()=>{
  assert.throws(()=>new Relay({dbFile:':memory:',tokens:{}}),/MISSING_/);
  const s=await setup();try{
    assert.equal((await s.request('/v1/claim?runner=runner-one')).status,401);
    assert.equal((await s.request('/v1/missions','POST',{mission:{}},'JM_RUNNER_TOKEN')).status,401);
  }finally{await s.close();}
});
test('02: strict mission allowlist rejects shell and path fields',async()=>{
  const s=await setup();try{
    const raw=await s.sign({id:id(2),op:'probe'});
    const attempt={...raw,command:{verification_cmd:'rm -rf ~'}};
    assert.equal((await s.request('/v1/missions','POST',{mission:attempt})).status,400);
    await assert.rejects(()=>s.sign({id:id(3),op:'put',artifact:'../../outside',expected_revision:0,content:'x'}),/BAD_ARTIFACT/);
    await assert.rejects(()=>s.sign({id:id(4),op:'exec'}),/BAD_OPERATION/);
  }finally{await s.close();}
});
test('03: forged mission rejected and no job created',async()=>{
  const s=await setup();try{
    const m=await s.sign({id:id(5),op:'probe'});
    m.op='put';m.artifact='x';m.expected_revision=0;m.content='injected';
    assert.equal((await s.request('/v1/missions','POST',{mission:m})).status,400);
    assert.equal((await claim(s)),null);
  }finally{await s.close();}
});
test('04: conflict vs idempotent producer submit',async()=>{
  const s=await setup();try{
    assert.equal((await s.submit({id:id(6),op:'probe'})).status,202);
    assert.equal((await s.submit({id:id(6),op:'probe'})).data.duplicate,true);
    assert.equal((await s.submit({id:id(6),op:'put',artifact:'a',expected_revision:0,content:'x'})).status,409);
  }finally{await s.close();}
});
test('05: FIFO claims persist and are mutually exclusive',async()=>{
  const s=await setup();try{
    await s.submit({id:id(7),op:'probe'});await s.submit({id:id(8),op:'probe'});
    const [a,b]=await Promise.all([claim(s),claim(s)]);
    assert.deepEqual(new Set([a.id,b.id]),new Set([id(7),id(8)]));
    assert.equal(await claim(s),null);
  }finally{await s.close();}
});
test('06: claim expiry returns same signed mission and new lease',async()=>{
  const s=await setup({leaseMs:100});try{
    await s.submit({id:id(9),op:'probe'});
    const first=await claim(s);await new Promise(r=>setTimeout(r,130));
    const second=await claim(s);
    assert.equal(first.job_hash,second.job_hash);assert.notEqual(first.lease_token,second.lease_token);
    assert.equal(second.attempt,2);
  }finally{await s.close();}
});
test('07: lost ACK is locally idempotent',async()=>{
  const s=await setup({leaseMs:100});const r=s.runner();try{
    await s.submit({id:id(10),op:'put',artifact:'Schematic',expected_revision:0,content:'original'});
    const first=await claim(s);const hash1=await checkMission(first.mission,s.tokens.JM_MISSION_KEY);
    const receipt1=r.store.apply(first.mission,hash1);
    assert.equal(r.store.read('Schematic').revision,1);
    await new Promise(r=>setTimeout(r,140));
    const next=await claim(s);
    const receipt2=r.store.apply(next.mission,next.job_hash);
    assert.deepEqual(receipt1,receipt2);assert.equal(r.store.read('Schematic').revision,1);
    assert.equal((await ack(s,next,receipt2)).data.ack,true);
  }finally{await r.close();await s.close();}
});
test('08: forged ACK and wrong lease rejected',async()=>{
  const s=await setup();const r=s.runner();try{
    await s.submit({id:id(11),op:'probe'});
    const c=await claim(s),receipt=r.store.apply(c.mission,c.job_hash);
    assert.equal((await ack(s,{...c,lease_token:'wrong'},receipt)).status,409);
    assert.equal((await ack(s,c,{...receipt,revision:123})).status,400);
    assert.equal((await ack(s,c,receipt)).status,200);
    assert.equal((await ack(s,c,receipt)).data.duplicate,true);
  }finally{await r.close();await s.close();}
});
test('09: CAS revision mismatch HOLD without overwriting',async()=>{
  const s=await setup();const r=s.runner();try{
    await s.submit({id:id(12),op:'put',artifact:'panel',expected_revision:0,content:'A'});await r.drain();
    await s.submit({id:id(13),op:'put',artifact:'panel',expected_revision:0,content:'B'});await r.drain();
    assert.equal(r.store.read('panel').content,'A');
    assert.equal(s.relay.get(id(13)).state,'HOLD');
  }finally{await r.close();await s.close();}
});
test('10: restore creates new revision preserving history',async()=>{
  const s=await setup();const r=s.runner();try{
    await s.submit({id:id(14),op:'put',artifact:'panel',expected_revision:0,content:'A'});await r.drain();
    await s.submit({id:id(15),op:'put',artifact:'panel',expected_revision:1,content:'B'});await r.drain();
    await s.submit({id:id(16),op:'restore',artifact:'panel',expected_revision:2,source_revision:1});await r.drain();
    assert.equal(r.store.read('panel').revision,3);assert.equal(r.store.read('panel').content,'A');
    assert.equal(r.store.db.prepare('SELECT count(*) AS n FROM history WHERE name=?').get('panel').n,3);
  }finally{await r.close();await s.close();}
});
test('11: restore nonexistent version HOLD without mutation',async()=>{
  const s=await setup();const r=s.runner();try{
    await s.submit({id:id(17),op:'restore',artifact:'panel',expected_revision:0,source_revision:9});await r.drain();
    assert.equal(r.store.read('panel'),null);assert.equal(s.relay.get(id(17)).state,'HOLD');
  }finally{await r.close();await s.close();}
});
test('12: runner pull receives, applies and returns valid receipt',async()=>{
  const s=await setup();const r=s.runner();try{
    await s.submit({id:id(18),op:'put',artifact:'world',expected_revision:0,content:'loaded'});
    assert.equal(await r.drain(),1);
    const receipt=JSON.parse(s.relay.get(id(18)).receipt);await checkReceipt(receipt,s.tokens.JM_RECEIPT_KEY);
    assert.equal(receipt.status,'PASS');assert.equal(s.relay.get(id(18)).state,'DONE');
  }finally{await r.close();await s.close();}
});
test('13: authenticated push wake drains the SAME queue',async()=>{
  const s=await setup();const r=s.runner();try{
    const wake=await r.startPush({port:0});const wurl='http://127.0.0.1:'+wake.address().port;
    await s.submit({id:id(19),op:'put',artifact:'island',expected_revision:0,content:'contact'});
    assert.equal((await fetch(wurl+'/v1/wake',{method:'POST',headers:{authorization:'Bearer wrong'}})).status,401);
    assert.equal((await fetch(wurl+'/v1/wake',{method:'POST',headers:{authorization:'Bearer '+s.tokens.JM_WAKE_TOKEN}})).status,202);
    await r.running;
    assert.equal(r.store.read('island').content,'contact');assert.equal(s.relay.get(id(19)).state,'DONE');
  }finally{await r.close();await s.close();}
});
test('14: relay state survives restart with same SQLite file',async()=>{
  const s=await setup();try{
    await s.submit({id:id(20),op:'probe'});
    const opened=new Relay({dbFile:path.join(s.dir,'relay.sqlite'),tokens:s.tokens});
    assert.equal(opened.get(id(20)).state,'PENDING');
    opened.close();
  }finally{await s.close();}
});
test('15: local commit survives restart and replays same receipt',async()=>{
  const s=await setup();let r=s.runner();try{
    const m=await s.sign({id:id(21),op:'put',artifact:'a',expected_revision:0,content:'v1'}),h=await checkMission(m,s.tokens.JM_MISSION_KEY);
    const a=r.store.apply(m,h);await r.close();r=s.runner();
    const b=r.store.apply(m,h);assert.deepEqual(a,b);assert.equal(r.store.read('a').revision,1);
  }finally{await r.close();await s.close();}
});
test('16: database transaction rolls back when apply fails',async()=>{
  const s=await setup();const r=s.runner();try{
    const m=await s.sign({id:id(22),op:'put',artifact:'a',expected_revision:0,content:'A'}),h=await checkMission(m,s.tokens.JM_MISSION_KEY);
    r.store.db.exec(`CREATE TRIGGER sabotage BEFORE INSERT ON history BEGIN SELECT RAISE(ABORT,'TEST_FAIL');END;`);
    assert.throws(()=>r.store.apply(m,h),/TEST_FAIL/);
    assert.equal(r.store.read('a'),null);
    assert.equal(r.store.db.prepare('SELECT count(*) n FROM applied').get().n,0);
  }finally{await r.close();await s.close();}
});
test('17: lease exhaustion holds mission until explicit safe retry',async()=>{
  const s=await setup({leaseMs:100,maxAttempts:1});try{
    await s.submit({id:id(23),op:'probe'});await claim(s);await new Promise(r=>setTimeout(r,130));
    assert.equal(await claim(s),null);assert.equal(s.relay.get(id(23)).state,'HOLD');
    assert.equal((await s.request('/v1/missions/'+id(23)+'/retry','POST')).data.retry,'STAGED');
    assert.equal((await claim(s)).attempt,1);
  }finally{await s.close();}
});
test('18: Unicode content preserved and bytes fingerprinted',async()=>{
  const s=await setup();const r=s.runner();try{
    const sample='🌍 JM — 𝅘𝅥𝅮 こんにちは';
    await s.submit({id:id(24),op:'put',artifact:'music',expected_revision:0,content:sample});await r.drain();
    assert.equal(r.store.read('music').content,sample);
    assert.equal(JSON.parse(s.relay.get(id(24)).receipt).content_hash,hash(sample));
  }finally{await r.close();await s.close();}
});
test('19: oversized data blocked and queue remains empty',async()=>{
  const s=await setup();try{
    await assert.rejects(()=>s.sign({id:id(25),op:'put',artifact:'a',expected_revision:0,content:'A'.repeat(16385)}),/BAD_CONTENT/);
    assert.equal(await claim(s),null);
  }finally{await s.close();}
});
test('20: tampering with signed mission body detected by runner',async()=>{
  const s=await setup();try{
    const m=await s.sign({id:id(26),op:'put',artifact:'a',expected_revision:0,content:'x'});m.content='y';
    await assert.rejects(()=>checkMission(m,s.tokens.JM_MISSION_KEY),/INVALID_MISSION_SIGNATURE/);
  }finally{await s.close();}
});
test('21: hash-chain audit detects stored receipt tampering',async()=>{
  const s=await setup();const r=s.runner();try{
    await s.submit({id:id(27),op:'put',artifact:'world',expected_revision:0,content:'good'});await r.drain();
    assert.equal(r.store.audit().status,'PASS');
    r.store.db.prepare('UPDATE applied SET chain_hash=? WHERE mission_id=?').run('0'.repeat(64),id(27));
    assert.equal(r.store.audit().status,'HOLD');
  }finally{await r.close();await s.close();}
});
test('22: probe has signed receipt but no artifact mutation',async()=>{
  const s=await setup();const r=s.runner();try{
    await s.submit({id:id(28),op:'probe'});await r.drain();
    const receipt=JSON.parse(s.relay.get(id(28)).receipt);
    assert.equal(receipt.code,'PROBE_OK');assert.equal(r.store.db.prepare('SELECT count(*) n FROM artifacts').get().n,0);
  }finally{await r.close();await s.close();}
});
test('23: only the configured runner identity may claim',async()=>{
  const s=await setup();try{
    await s.submit({id:id(29),op:'probe'});
    assert.equal((await s.request('/v1/claim?runner=some-other','GET',undefined,'JM_RUNNER_TOKEN')).status,403);
    assert.equal((await claim(s)).id,id(29));
  }finally{await s.close();}
});
test('24: reject a signed mission addressed to the wrong runner',async()=>{
  const s=await setup();try{
    const wrong=await signMission({id:id(30),op:'probe',target:'second-runner'},s.tokens.JM_MISSION_KEY);
    assert.equal((await s.request('/v1/missions','POST',{mission:wrong})).status,403);
    assert.equal(await claim(s),null);
  }finally{await s.close();}
});
test('25: key and operation fields reject traversal and metacharacters',async()=>{
  const s=await setup();try{
    for(const name of ['../foo','a/b','a\\b','a;b','a b','..'])
      await assert.rejects(()=>s.sign({id:id(31),op:'put',artifact:name,expected_revision:0,content:'x'}),/BAD_ARTIFACT/);
  }finally{await s.close();}
});
