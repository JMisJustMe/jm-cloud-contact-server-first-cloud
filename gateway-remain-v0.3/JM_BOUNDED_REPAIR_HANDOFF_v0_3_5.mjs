// JM Gateway v0.3.5 — rule-bounded autonomous source repair across independent cloud workers.
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
const tokens = {client:'jm-ci-test-client-v035-not-production', human:'jm-ci-test-human-v035-not-production',worker:'jm-ci-test-worker-v035-not-production'};
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
function ensure(cond,msg){if(!cond)throw new Error('JM_AUTO_REPAIR_HOLD:'+msg);}

async function seed(){
  const service=await launch();
  try{
    const health=await api('/remain/health');
    ensure(health.status===200 && health.json.control.revision>=19 && health.json.destructiveAuthority===false,'SEED_HEALTH');
    const made=await api('/api/v1/tasks',{method:'POST',body:{prompt:'Independently detect a bounded interrupted-receipt-write defect in a disposable JM checkout; select and apply a narrowly allowed repair, retest and return review evidence; never push source or merge',agent:'jm-auto-repair-v035'}});
    ensure(made.status===201 && typeof made.json.task?.id==='string','CREATE');
    const id=made.json.task.id;
    const tooSoon=await api('/api/v1/tasks/'+encodeURIComponent(id)+'/dispatch',{method:'POST',token:tokens.human,body:{}});
    ensure(tooSoon.status===409,'HUMAN_GATE');
    const approved=await api('/api/v1/tasks/'+encodeURIComponent(id)+'/approve',{method:'POST',token:tokens.human,body:{}});
    const dispatched=await api('/api/v1/tasks/'+encodeURIComponent(id)+'/dispatch',{method:'POST',token:tokens.human,body:{}});
    ensure(approved.status===200 && dispatched.json.task?.status==='READY_FOR_AGENT_ROUTE','DISPATCH');
    const manifest={schema:'JM.BoundedAutoRepairHandoff/0.3.5',taskId:id,approvedStatus:'READY_FOR_AGENT_ROUTE',controlRevision:health.json.control.revision,controlDigest:health.json.control.digest,engineSha256:health.json.engineSha256,source:'CADING_APPROVED_TASK',authority:'HUMAN_FINAL_TEST_ONLY',worker:'PINNED_ATOMIC_REPAIR_ONLY',sourceCommit:'18cb13123020e0df7c05f6402f774a24ff8f4a8e',baseCommit:'e26d1ce5605016ea94a670596ab12c52b0499d33',sourceRepository:'JMisJustMe/JM-cading-lab',candidateBranch:'jm-host-adapter-machine-receipt-v0.1-20261014',destructiveAuthority:false};
    await writeJson(manifestPath,manifest);
    await writeJson(path.join(root,'job-manifest-digest.json'),{sha256:hash(manifest)});
    console.log(JSON.stringify({stage:'SEED',status:'PASS',taskId:id,manifestSha256:hash(manifest),stateCarrier:'ARTIFACT_TO_DIFFERENT_RUNNER'}));
  }finally{await close(service);}
}

async function worker(){
  const manifest=await readJson(manifestPath);
  const saved=await readJson(path.join(root,'job-manifest-digest.json'));
  ensure(manifest.schema==='JM.SourceReviewHandoff/0.3.4' && saved.sha256===hash(manifest),'SEED_CUSTODY');
  const proc=spawnSync('python3',['gateway-remain-v0.3/JM_BOUNDED_ATOMIC_REPAIR_v0_3_5.py'],{cwd:process.cwd(),encoding:'utf8',timeout:240000,maxBuffer:5*1024*1024});
  ensure(proc.status===0,'BOUNDED_REPAIR_EXECUTION_'+(proc.stderr||proc.stdout).slice(-1700));
  const proof=await readJson(path.join(root,'auto-repair-report.json'));
  ensure(proof.schema==='JM.BoundedAutonomousRepairWork/0.3.5' &&
         proof.status==='PASS' && proof.sourceCommit===manifest.sourceCommit &&
         proof.sourceRepository===manifest.sourceRepository &&
         proof.decision==='ATOMIC_RECEIPT_REPLACEMENT' &&
         proof.changedFilesCount===1 && proof.proposedChangePaths?.length===1 &&
         proof.proposedChangePaths[0]==='agent-runtime/host-adapters/jm_host_adapter_conformance.py' &&
         proof.checks?.baselineFaultObserved && proof.checks?.workerSelectedAllowlistedRepair &&
         proof.checks?.candidateSourceActuallyModified &&
         proof.checks?.JMHostAdapterConformancePassed &&
         proof.checks?.JMExistingMachineReceiptRegressionPassed &&
         proof.checks?.failureBeforeAtomicCommitPreservedOldReceipt &&
         proof.checks?.noOrphanTempFiles &&
         proof.checks?.healthyAtomicCommitProducedValidReceipt &&
         proof.checks?.onlyAllowlistedFileChanged &&
         proof.publishedSource===false && proof.ownerApprovalRequired===true,'REPAIR_RESULT_HOLD');
  const report={schema:'JM.BoundedRepairWorkerReport/0.3.5',taskId:manifest.taskId,manifestSha256:hash(manifest),workerHost:'GITHUB_ACTIONS_SEPARATE_RUNNER',sourceRepository:manifest.sourceRepository,sourceCommit:manifest.sourceCommit,result:'PASS',repair:proof,boundary:'DETERMINISTIC_ALLOWLISTED_REPAIR_IN_DISPOSABLE_CHECKOUT; NOT_LLM_INFERENCE; NOT_PUBLISHED'};
  await writeJson(reportPath,report);
  console.log(JSON.stringify({stage:'JM_BOUNDED_REPAIR_WORKER',status:'PASS',taskId:manifest.taskId,decision:proof.decision,sourceDiffSha256:proof.sourceDiffSha256,checks:proof.checks,reportSha256:hash(report)}));
}

async function recover(){
  const manifest=await readJson(manifestPath);
  const manifestDigest=await readJson(path.join(root,'job-manifest-digest.json'));
  const report=await readJson(reportPath);
  ensure(manifestDigest.sha256===hash(manifest) && report.manifestSha256===hash(manifest) && report.taskId===manifest.taskId,'CUSTODY_CHAIN');
  ensure(report.schema==='JM.BoundedRepairWorkerReport/0.3.5' &&
         report.result==='PASS' && report.repair?.status==='PASS' &&
         report.repair?.schema==='JM.BoundedAutonomousRepairWork/0.3.5' &&
         report.repair.sourceCommit===manifest.sourceCommit &&
         report.repair.sourceRepository===manifest.sourceRepository &&
         report.repair.decision==='ATOMIC_RECEIPT_REPLACEMENT' &&
         report.repair.changedFilesCount===1 &&
         report.repair.checks?.baselineFaultObserved===true &&
         report.repair.checks?.workerSelectedAllowlistedRepair===true &&
         report.repair.checks?.candidateSourceActuallyModified===true &&
         report.repair.checks?.JMHostAdapterConformancePassed===true &&
         report.repair.checks?.JMExistingMachineReceiptRegressionPassed===true &&
         report.repair.checks?.failureBeforeAtomicCommitPreservedOldReceipt===true &&
         report.repair.checks?.noOrphanTempFiles===true &&
         report.repair.checks?.healthyAtomicCommitProducedValidReceipt===true &&
         report.repair.checks?.onlyAllowlistedFileChanged===true &&
         report.repair.publishedSource===false,'REPAIR_REPORT_HELD');
  let s=await launch();let receiptHash;
  try{
    const control=await api('/remain/health');
    const task=await api('/api/v1/tasks/'+encodeURIComponent(manifest.taskId));
    ensure(s.remain.startupRecovered && s.gateway.meta().persistence.startupRecovered,'REENTRY_NOT_RECOVERED');
    ensure(control.json.control.revision===manifest.controlRevision && control.json.control.digest===manifest.controlDigest,'CONTROL_DRIFT');
    ensure(task.json.task?.status===manifest.approvedStatus && task.json.task?.approved===true,'TASK_DRIFT');
    const workerCannotApprove=await api('/api/v1/tasks/'+manifest.taskId+'/approve',{method:'POST',token:tokens.worker,body:{}});
    ensure(workerCannotApprove.status===401,'WORKER_BECAME_HUMAN');
    const evidence={kind:'JM_BOUNDED_AUTO_REPAIR',taskId:manifest.taskId,taskStatus:task.json.task.status,remainRevision:control.json.control.revision,remainDigest:control.json.control.digest,destructiveAuthority:false,externalReportSha256:hash(report),sourceRepository:manifest.sourceRepository,sourceCommit:manifest.sourceCommit,decision:report.repair.decision,sourceDiffSha256:report.repair.sourceDiffSha256,changedFilesCount:1,workerTests:report.repair.checks,publishedSource:false,sourceWriteAuthority:false}
    ensure(returned.status===201 && returned.json.status==='RETURN_RECORDED','RETURN_NOT_RECORDED');
    receiptHash=returned.json.receipt.hash;
    const repeat=await api('/remain/job-returns',{method:'POST',token:tokens.worker,body:{taskId:manifest.taskId,workerId:'jm-atomic-repair-worker-v035',evidence}});
    ensure(repeat.status===200&&repeat.json.status==='IDEMPOTENT_REPLAY','REPLAY');
  }finally{await close(s);}
  s=await launch();
  try{
    const after=await api('/remain/job-returns?taskId='+encodeURIComponent(manifest.taskId));
    const task=await api('/api/v1/tasks/'+encodeURIComponent(manifest.taskId));
    ensure(s.workerReturns.startupRecovered && s.remain.startupRecovered && s.gateway.meta().persistence.startupRecovered,'SECOND_RESTART');
    ensure(after.status===200 && after.json.verified && after.json.receipt.hash===receiptHash,'RECEIPT_LOST');
    ensure(task.json.task?.status==='READY_FOR_AGENT_ROUTE','SOURCE_TASK_MUTATED');
    const result={schema:'JM.BoundedAutoRepairResult/0.3.5',status:'PASS',taskId:manifest.taskId,boundedSourceRepairExecuted:true,sourceCommit:manifest.sourceCommit,realTests:report.repair.checks,sourceDiffSha256:report.repair.sourceDiffSha256,decision:report.repair.decision,publishedSource:false,sourceAuthority:'CADING',workerControl:'JM.MagnifyingGlass/1.0',workerProcess:'DIFFERENT_GITHUB_RUNNER',stateCarrier:'GITHUB_ACTIONS_ARTIFACT',ownerFinalGate:'PRESERVED',returnReceiptSha256:receiptHash,workerReportSha256:hash(report),taskRecovered:true,controlRecovered:true,returnRecoveredAfterSecondRestart:true,destructiveAuthority:false,proofBoundary:'THREE_CLOUD_RUNNERS; WORKER_SELECTED_ALLOWLISTED_SOURCE_CORRECTION_AFTER_OBSERVED_FAULT; DIFF_RETURNED_NOT_PUBLISHED; NO_LLM_INFERENCE; NO_LIVE_RENDER_DISK_OR_HOSTED_V031'};
    await writeJson(resultPath,result);
    console.log(JSON.stringify(result,null,2));
  }finally{await close(s);}
}
if(phase==='seed')await seed();
else if(phase==='work')await worker();
else if(phase==='recover')await recover();
else throw new Error('usage: node JM_BOUNDED_REPAIR_HANDOFF_v0_3_5.mjs seed|work|recover');
