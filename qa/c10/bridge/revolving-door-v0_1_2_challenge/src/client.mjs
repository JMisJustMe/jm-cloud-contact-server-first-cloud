// Minimal explicit operator: producer token + HMAC key never logged.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { signMission, assertSecrets, checkReceipt } from './protocol.mjs';
const e=process.env;
const [cmd,...a]=process.argv.slice(2);
const relay=(e.JM_RELAY_URL||'http://127.0.0.1:8787').replace(/\/$/,'');
if(!relay.startsWith('https://')&&!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(relay))throw new Error('HTTPS_REQUIRED');
const id=()=>('JM_'+randomUUID().replaceAll('-',''));
const action=async(path,method,body,token)=>{
  const res=await fetch(path.startsWith('http')?path:relay+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  const text=await res.text();
  if(method==='GET' && /^\/v1\/missions\/[A-Za-z0-9_-]{6,80}$/.test(path) && res.ok){
    let data;
    try{data=JSON.parse(text);}catch{throw new Error('UNPARSABLE_STATUS');}
    if(data.receipt){
      assertSecrets(e,['JM_RECEIPT_KEY']);
      if(data.id!==data.receipt.id || data.job_hash!==data.receipt.job_hash) throw new Error('RECEIPT_STATUS_MISMATCH');
      await checkReceipt(data.receipt,e.JM_RECEIPT_KEY);
      console.log('RECEIPT_SIGNATURE_PASS');
    } else console.log('NO_RECEIPT_YET_NOT_EXECUTION_PROOF');
  }
  console.log('HTTP',res.status,text);if(!res.ok)process.exitCode=1;
};
if(cmd==='probe'||cmd==='put'||cmd==='restore'){
  assertSecrets(e,['JM_PRODUCER_TOKEN','JM_MISSION_KEY']);
  const core={id:id(),op:cmd,target:e.JM_RUNNER_ID||'jm-laptop'};
  if(cmd==='put'){
    if(a.length!==3)throw new Error('USAGE: put ARTIFACT EXPECTED_REVISION LOCAL_TEXT_FILE');
    Object.assign(core,{artifact:a[0],expected_revision:Number(a[1]),content:readFileSync(a[2],'utf8')});
  }
  if(cmd==='restore'){
    if(a.length!==3)throw new Error('USAGE: restore ARTIFACT EXPECTED_REVISION SOURCE_REVISION');
    Object.assign(core,{artifact:a[0],expected_revision:Number(a[1]),source_revision:Number(a[2])});
  }
  if(cmd==='probe'&&a.length)throw new Error('USAGE: probe');
  const mission=await signMission(core,e.JM_MISSION_KEY);
  console.log('Mission ID:',mission.id);
  await action('/v1/missions','POST',{mission},e.JM_PRODUCER_TOKEN);
}else if(cmd==='status'||cmd==='retry'){
  assertSecrets(e,['JM_PRODUCER_TOKEN']);
  if(a.length!==1 || !/^[A-Za-z0-9_-]{6,80}$/.test(a[0]))throw new Error('BAD_MISSION_ID');
  await action('/v1/missions/'+a[0]+(cmd==='retry'?'/retry':''),cmd==='retry'?'POST':'GET',undefined,e.JM_PRODUCER_TOKEN);
}else if(cmd==='wake'){
  assertSecrets(e,['JM_WAKE_TOKEN']);
  const wake=e.JM_WAKE_URL||'http://127.0.0.1:8788/v1/wake';
  if(!wake.startsWith('https://')&&!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/v1\/wake$/.test(wake))throw new Error('WAKE_REQUIRES_HTTPS_OR_LOOPBACK');
  await action(wake,'POST',undefined,e.JM_WAKE_TOKEN);
}else if(cmd==='audit'){
  assertSecrets(e,['JM_RECEIPT_KEY']);
  const {LocalStore}=await import('./local-store.mjs');
  const local=new LocalStore(e.JM_LOCAL_DB||'./jm_local.sqlite',e.JM_RECEIPT_KEY);
  try{console.log(JSON.stringify(local.audit(),null,2));if(local.audit().status!=='PASS')process.exitCode=1;}finally{local.close();}
}else{
  console.log('JM Revolving Door commands: probe | put KEY EXPECTED_REV FILE | restore KEY EXPECTED_REV SOURCE_REV | status ID | retry ID | wake | audit');
  process.exitCode=1;
}
