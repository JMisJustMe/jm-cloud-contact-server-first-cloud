// JM Gateway v0.3.2 — cross-runner authorised job handoff proof.
// CI-only synthetic owner tokens. Real service credentials are NEVER exported.
// Each mode runs in a distinct GitHub-hosted runner; artifacts carry state, not authority.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { startRemainService } from './JM_SOVEREIGN_AGENT_GATEWAY_REMAIN_v0_3.mjs';

const phase = process.argv[2];
const root = path.resolve('.handoff');
const dataRoot = path.join(root,'state');
const manifestPath = path.join(root,'job-manifest.json');
const reportPath = path.join(root,'worker-report.json');
const resultPath = path.join(root,'recovery-result.json');
const base = 'http://127.0.0.1:19632';
const tokens = {client:'jm-ci-test-client-v032-not-production', human:'jm-ci-test-human-v032-not-production',worker:'jm-ci-test-worker-v032-not-production'};
const hash = v => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
async function readJson(p){return JSON.parse(await fs.readFile(p,'utf8'));}
async function writeJson(p,v){await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,JSON.stringify(v,null,2)+'\n','utf8');}
async function api(p,{method='GET',token=tokens.client,body}={}){
  const r = await fetch(base+p,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,json:await r.json()};
}
async function launch(){
  return await startRemainService({port:19632,host:'127.0.0.1',dataRoot,clientToken:tokens.client,authorityToken:tokens.human,workerToken:tokens.worker,acpEnabled:false,durabilityTier:'CROSS_RUNNER_ARTIFACT_TEST_NOT_RENDER_DISK'});
}
async function close(s){await new Promise(resolve=>s.server.close(resolve));}
function ensure(cond,msg){if(!cond)throw new Error('JM_HANDOFF_HOLD:'+msg);}

async function seed(){
  const service=await launch();
  try{
    const health=await api('/remain/health');
    ensure(health.status===200 && health.json.control.revision>=19 && health.json.destructiveAuthority===false,'SEED_HEALTH');
    const made=await api('/api/v1/tasks',{method:'POST',body:{prompt:'READ ONLY: verify JM Remain, cloud v0.5 and Build Mesh public HTTPS health; return witness, do not mutate an owner project',agent:'jm-cloud-handoff-v032'}});
    ensure(made.status===201 && typeof made.json.task?.id==='string','CREATE');
    const id=made.json.task.id;
    const tooSoon=await api('/api/v1/tasks/'+encodeURIComponent(id)+'/dispatch',{method:'POST',token:tokens.human,body:{}});
    ensure(tooSoon.status===409,'HUMAN_GATE');
    const approved=await api('/api/v1/tasks/'+encodeURIComponent(id)+'/approve',{method:'POST',token:tokens.human,body:{}});
    const dispatched=await api('/api/v1/tasks/'+encodeURIComponent(id)+'/dispatch',{method:'POST',token:tokens.human,body:{}});
    ensure(approved.status===200 && dispatched.json.task?.status==='READY_FOR_AGENT_ROUTE','DISPATCH');
    const manifest={schema:'JM.CrossRunnerHandoff/0.3.2',taskId:id,approvedStatus:'READY_FOR_AGENT_ROUTE',controlRevision:health.json.control.revision,controlDigest:health.json.control.digest,engineSha256:health.json.engineSha256,source:'CADING_APPROVED_TASK',authority:'HUMAN_FINAL_TEST_ONLY',worker:'EXTERNAL_CONTACT_ONLY',destructiveAuthority:false};
    await writeJson(manifestPath,manifest);
    await writeJson(path.join(root,'job-manifest-digest.json'),{sha256:hash(manifest)});
    console.log(JSON.stringify({stage:'SEED',status:'PASS',taskId:id,manifestSha256:hash(manifest),stateCarrier:'ARTIFACT_TO_DIFFERENT_RUNNER'}));
  }finally{await close(service);}
}

async function worker(){
  const manifest=await readJson(manifestPath);
  const saved=await readJson(path.join(root,'job-manifest-digest.json'));
  ensure(manifest.schema==='JM.CrossRunnerHandoff/0.3.2' && saved.sha256===hash(manifest),'SEED_CUSTODY');
  const proc=spawnSync(process.execPath,['gateway-remain-v0.3/JM_LIVE_EXTERNAL_WORKER_CONTACT_v0_3_1.mjs'],{cwd:process.cwd(),encoding:'utf8',timeout:240000});
  ensure(proc.status===0,'EXTERNAL_CONTACT_'+(proc.stderr||proc.stdout).slice(-350));
  const contact=JSON.parse(proc.stdout.trim());
  ensure(contact.status==='PASS' && contact.checks?.length===3 && contact.checks.every(v=>v.ok&&v.status===200),'LIVE_CLOUD_CONTACT');
  const gateway=contact.checks.find(x=>x.name==='jm-remain-v03');
  ensure(gateway?.detail?.controlRevision===manifest.controlRevision && gateway?.detail?.controlDigest===manifest.controlDigest,'CONTROL_RECONTACT');
  const report={schema:'JM.CloudHandoffWorkerReport/0.3.2',taskId:manifest.taskId,manifestSha256:hash(manifest),workerHost:'GITHUB_ACTIONS_SEPARATE_RUNNER',contactScope:'THREE_EXISTING_JM_PUBLIC_HTTPS_SERVICES',result:'PASS',checks:contact.checks.map(x=>({name:x.name,status:x.status,ok:x.ok,responseSha256:x.responseSha256})),externalWitnessDigest:contact.witnessDigest,boundary:'EXTERNAL_READ_ONLY_CONTACT; NOT ARBITRARY_TASK_EXECUTION; WORKER_HOST_SEPARATE_FROM_GATEWAY_STATE_HOST'};
  await writeJson(reportPath,report);
  console.log(JSON.stringify({stage:'EXTERNAL_WORKER',status:'PASS',taskId:manifest.taskId,checks:report.checks.length,reportSha256:hash(report)}));
}

async function recover(){
  const manifest=await readJson(manifestPath);
  const manifestDigest=await readJson(path.join(root,'job-manifest-digest.json'));
  const report=await readJson(reportPath);
  ensure(manifestDigest.sha256===hash(manifest) && report.manifestSha256===hash(manifest) && report.taskId===manifest.taskId,'CUSTODY_CHAIN');
  ensure(report.result==='PASS' && report.checks.length===3 && report.checks.every(v=>v.ok&&v.status===200),'WORKER_REPORT_HELD');
  let s=await launch();let receiptHash;
  try{
    const control=await api('/remain/health');
    const task=await api('/api/v1/tasks/'+encodeURIComponent(manifest.taskId));
    ensure(s.remain.startupRecovered && s.gateway.meta().persistence.startupRecovered,'REENTRY_NOT_RECOVERED');
    ensure(control.json.control.revision===manifest.controlRevision && control.json.control.digest===manifest.controlDigest,'CONTROL_DRIFT');
    ensure(task.json.task?.status===manifest.approvedStatus && task.json.task?.approved===true,'TASK_DRIFT');
    const workerCannotApprove=await api('/api/v1/tasks/'+manifest.taskId+'/approve',{method:'POST',token:tokens.worker,body:{}});
    ensure(workerCannotApprove.status===401,'WORKER_BECAME_HUMAN');
    const evidence={kind:'READ_ONLY_GATEWAY_CONTACT',taskId:manifest.taskId,taskStatus:task.json.task.status,remainRevision:control.json.control.revision,remainDigest:control.json.control.digest,destructiveAuthority:false,externalReportSha256:hash(report),externalChecksPassed:3};
    const returned=await api('/remain/job-returns',{method:'POST',token:tokens.worker,body:{taskId:manifest.taskId,workerId:'github-cross-runner-worker-v032',evidence}});
    ensure(returned.status===201 && returned.json.status==='RETURN_RECORDED','RETURN_NOT_RECORDED');
    receiptHash=returned.json.receipt.hash;
    const repeat=await api('/remain/job-returns',{method:'POST',token:tokens.worker,body:{taskId:manifest.taskId,workerId:'github-cross-runner-worker-v032',evidence}});
    ensure(repeat.status===200&&repeat.json.status==='IDEMPOTENT_REPLAY','REPLAY');
  }finally{await close(s);}
  s=await launch();
  try{
    const after=await api('/remain/job-returns?taskId='+encodeURIComponent(manifest.taskId));
    const task=await api('/api/v1/tasks/'+encodeURIComponent(manifest.taskId));
    ensure(s.workerReturns.startupRecovered && s.remain.startupRecovered && s.gateway.meta().persistence.startupRecovered,'SECOND_RESTART');
    ensure(after.status===200 && after.json.verified && after.json.receipt.hash===receiptHash,'RECEIPT_LOST');
    ensure(task.json.task?.status==='READY_FOR_AGENT_ROUTE','SOURCE_TASK_MUTATED');
    const result={schema:'JM.CrossRunnerHandoffResult/0.3.2',status:'PASS',taskId:manifest.taskId,workerCloudContact:3,sourceAuthority:'CADING',workerControl:'JM.MagnifyingGlass/1.0',workerProcess:'DIFFERENT_GITHUB_RUNNER',stateCarrier:'GITHUB_ACTIONS_ARTIFACT',ownerFinalGate:'PRESERVED',returnReceiptSha256:receiptHash,workerReportSha256:hash(report),taskRecovered:true,controlRecovered:true,returnRecoveredAfterSecondRestart:true,destructiveAuthority:false,proofBoundary:'THREE_SEPARATE_GITHUB_RUNNERS_WITH_ARTIFACT_HANDOFF; EXTERNAL_READ_ONLY_HTTPS_CONTACT; DOES_NOT_PROVE_LIVE_RENDER_DISK_SURVIVAL_OR_REMOTE_V031_POST_OR_AUTONOMOUS_OWNER_TASK_COMPLETION'};
    await writeJson(resultPath,result);
    console.log(JSON.stringify(result,null,2));
  }finally{await close(s);}
}
if(phase==='seed')await seed();
else if(phase==='work')await worker();
else if(phase==='recover')await recover();
else throw new Error('usage: node JM_CLOUD_HANDOFF_v0_3_2.mjs seed|work|recover');
