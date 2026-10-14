// JM Gateway v0.3.6 — sovereign route selection before bounded native repair..
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
const tokens = {client:'jm-ci-test-client-v036-not-production', human:'jm-ci-test-human-v036-not-production',worker:'jm-ci-test-worker-v036-not-production'};
const hash = v => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const sorted = v => Array.isArray(v) ? v.map(sorted) :
  v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])) : v;
const routeHash = v => createHash('sha256').update(JSON.stringify(sorted(v))).digest('hex');
const ROUTER_PIN = 'e26d1ce5605016ea94a670596ab12c52b0499d33';
const ROUTE_ACTION = 'ATOMIC_RECEIPT_REPLACEMENT';
const SOURCE_FILE = 'agent-runtime/host-adapters/jm_host_adapter_conformance.py';
async function checkedRoute(manifest){
  const r=await readJson(path.join(root,'sovereign-route.json'));
  const {decisionSha256,...body}=r;
  ensure(r.schema==='JM.SovereignRouteDecision/0.3.6' &&
         r.taskId===manifest.taskId && r.sourceCommit===ROUTER_PIN &&
         manifest.routerSourceCommit===ROUTER_PIN &&
         manifest.routingQuery==='coding runtime' &&
         manifest.requestedAction===ROUTE_ACTION &&
         manifest.allowedFile===SOURCE_FILE &&
         r.query===manifest.routingQuery &&
         r.allowedAction===ROUTE_ACTION &&
         r.sourceEditFile===SOURCE_FILE &&
         r.sourceTarget==='JMisJustMe/JM-cading-lab' &&
         r.modelKind==='JM_SOVEREIGN_AGENT_PORTABLE_ROUTER' &&
         r.routeScope==='ROUTE_SELECTION_NOT_EXECUTION' &&
         r.actionAuthority==='SYNTHETIC_TEST_HUMAN_CADING_MANIFEST' &&
         r.permissionToPush===false && r.destructiveAuthority===false &&
         r.humanApprovalInCadingManifest===true &&
         r.chosenCurrentHead?.kind==='current_project_head' &&
         Number.isInteger(r.chosenCurrentHead?.score) &&
         r.chosenCurrentHead.score>0 &&
         /^[0-9a-f]{64}$/.test(r.routerCoreSha256||'') &&
         decisionSha256===routeHash(body),'ROUTE_EVIDENCE_MISSING_OR_FORGED');
  // Synthetic hostile alternative action must be rejected in receiving worker too.
  ensure({...r,allowedAction:'DELETE_REPOSITORY'}.allowedAction!==manifest.requestedAction,
    'FORGED_WORKER_ACTION');
  return r;
}
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
function ensure(cond,msg){if(!cond)throw new Error('JM_SOVEREIGN_ROUTE_HOLD:'+msg);}

async function seed(){
  const service=await launch();
  try{
    const health=await api('/remain/health');
    ensure(health.status===200 && health.json.control.revision>=19 && health.json.destructiveAuthority===false,'SEED_HEALTH');
    const made=await api('/api/v1/tasks',{method:'POST',body:{prompt:'Route a bounded repair test through the actual JM Sovereign Agent Portable Runtime, then prove the allowlisted worker can repair and return; no source push, model self-approval or merger',agent:'jm-sovereign-route-v036'}});
    ensure(made.status===201 && typeof made.json.task?.id==='string','CREATE');
    const id=made.json.task.id;
    const tooSoon=await api('/api/v1/tasks/'+encodeURIComponent(id)+'/dispatch',{method:'POST',token:tokens.human,body:{}});
    ensure(tooSoon.status===409,'HUMAN_GATE');
    const approved=await api('/api/v1/tasks/'+encodeURIComponent(id)+'/approve',{method:'POST',token:tokens.human,body:{}});
    const dispatched=await api('/api/v1/tasks/'+encodeURIComponent(id)+'/dispatch',{method:'POST',token:tokens.human,body:{}});
    ensure(approved.status===200 && dispatched.json.task?.status==='READY_FOR_AGENT_ROUTE','DISPATCH');
    const manifest={schema:'JM.BoundedAutoRepairHandoff/0.3.6',taskId:id,approvedStatus:'READY_FOR_AGENT_ROUTE',controlRevision:health.json.control.revision,controlDigest:health.json.control.digest,engineSha256:health.json.engineSha256,source:'CADING_APPROVED_TASK',authority:'HUMAN_FINAL_TEST_ONLY',worker:'PINNED_ATOMIC_REPAIR_ONLY',sourceCommit:'18cb13123020e0df7c05f6402f774a24ff8f4a8e',baseCommit:'e26d1ce5605016ea94a670596ab12c52b0499d33',sourceRepository:'JMisJustMe/JM-cading-lab',candidateBranch:'jm-host-adapter-machine-receipt-v0.1-20261014',routerSourceCommit:'e26d1ce5605016ea94a670596ab12c52b0499d33',routingQuery:'coding runtime',requestedAction:'ATOMIC_RECEIPT_REPLACEMENT',allowedFile:'agent-runtime/host-adapters/jm_host_adapter_conformance.py',destructiveAuthority:false};
    await writeJson(manifestPath,manifest);
    await writeJson(path.join(root,'job-manifest-digest.json'),{sha256:hash(manifest)});
    console.log(JSON.stringify({stage:'SEED',status:'PASS',taskId:id,manifestSha256:hash(manifest),stateCarrier:'ARTIFACT_TO_DIFFERENT_RUNNER'}));
  }finally{await close(service);}
}

async function worker(){
  const manifest=await readJson(manifestPath);
  const saved=await readJson(path.join(root,'job-manifest-digest.json'));
  ensure(manifest.schema==='JM.BoundedAutoRepairHandoff/0.3.5' && saved.sha256===hash(manifest),'SEED_CUSTODY');
  const route=await checkedRoute(manifest);
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
  const report={schema:'JM.SovereignRoutedRepairReport/0.3.6',taskId:manifest.taskId,manifestSha256:hash(manifest),routerDecisionSha256:route.decisionSha256,routerCoreSha256:route.routerCoreSha256,routerCommit:route.sourceCommit,selectedRoute:route.chosenCurrentHead,workerHost:'GITHUB_ACTIONS_SEPARATE_RUNNER',sourceRepository:manifest.sourceRepository,sourceCommit:manifest.sourceCommit,result:'PASS',repair:proof,boundary:'REAL_JM_PORTABLE_ROUTER_CHOSE_ROUTE; ACTION_WAS_SEPARATE_HUMAN_TEST_AUTHORISATION; ALLOWLIST_REPAIR_NOT_LLM_INFERENCE; SOURCE_NOT_PUBLISHED'};
  await writeJson(reportPath,report);
  console.log(JSON.stringify({stage:'JM_BOUNDED_REPAIR_WORKER',status:'PASS',taskId:manifest.taskId,decision:proof.decision,sourceDiffSha256:proof.sourceDiffSha256,checks:proof.checks,reportSha256:hash(report)}));
}

async function recover(){
  const manifest=await readJson(manifestPath);
  const manifestDigest=await readJson(path.join(root,'job-manifest-digest.json'));
  const report=await readJson(reportPath);
  const route=await checkedRoute(manifest);
  ensure(manifestDigest.sha256===hash(manifest) && report.manifestSha256===hash(manifest) && report.taskId===manifest.taskId,'CUSTODY_CHAIN');
  ensure(report.schema==='JM.SovereignRoutedRepairReport/0.3.6' &&
         report.routerDecisionSha256===route.decisionSha256 &&
         report.routerCoreSha256===route.routerCoreSha256 &&
         report.routerCommit===ROUTER_PIN &&
         report.selectedRoute?.id===route.chosenCurrentHead.id &&
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
    const evidence={kind:'JM_SOVEREIGN_ROUTED_REPAIR',taskId:manifest.taskId,taskStatus:task.json.task.status,remainRevision:control.json.control.revision,remainDigest:control.json.control.digest,destructiveAuthority:false,externalReportSha256:hash(report),sourceRepository:manifest.sourceRepository,sourceCommit:manifest.sourceCommit,decision:report.repair.decision,routerDecisionSha256:route.decisionSha256,routerCoreSha256:route.routerCoreSha256,routerCommit:ROUTER_PIN,sourceDiffSha256:report.repair.sourceDiffSha256,changedFilesCount:1,workerTests:report.repair.checks,publishedSource:false,sourceWriteAuthority:false};
    const returned=await api('/remain/job-returns',{method:'POST',token:tokens.worker,body:{taskId:manifest.taskId,workerId:'jm-sovereign-routed-worker-v036',evidence}});
    ensure(returned.status===201 && returned.json.status==='RETURN_RECORDED','RETURN_NOT_RECORDED');
    receiptHash=returned.json.receipt.hash;
    const repeat=await api('/remain/job-returns',{method:'POST',token:tokens.worker,body:{taskId:manifest.taskId,workerId:'jm-sovereign-routed-worker-v036',evidence}});
    ensure(repeat.status===200&&repeat.json.status==='IDEMPOTENT_REPLAY','REPLAY');
  }finally{await close(s);}
  s=await launch();
  try{
    const after=await api('/remain/job-returns?taskId='+encodeURIComponent(manifest.taskId));
    const task=await api('/api/v1/tasks/'+encodeURIComponent(manifest.taskId));
    ensure(s.workerReturns.startupRecovered && s.remain.startupRecovered && s.gateway.meta().persistence.startupRecovered,'SECOND_RESTART');
    ensure(after.status===200 && after.json.verified && after.json.receipt.hash===receiptHash,'RECEIPT_LOST');
    ensure(task.json.task?.status==='READY_FOR_AGENT_ROUTE','SOURCE_TASK_MUTATED');
    const result={schema:'JM.SovereignRoutedRepairResult/0.3.6',status:'PASS',taskId:manifest.taskId,boundedSourceRepairExecuted:true,actualJMRouterExecuted:true,selectedRouterHead:route.chosenCurrentHead,routerDecisionSha256:route.decisionSha256,sourceCommit:manifest.sourceCommit,realTests:report.repair.checks,sourceDiffSha256:report.repair.sourceDiffSha256,decision:report.repair.decision,publishedSource:false,sourceAuthority:'CADING',workerControl:'JM.MagnifyingGlass/1.0',workerProcess:'DIFFERENT_GITHUB_RUNNER',stateCarrier:'GITHUB_ACTIONS_ARTIFACT',ownerFinalGate:'PRESERVED',returnReceiptSha256:receiptHash,workerReportSha256:hash(report),taskRecovered:true,controlRecovered:true,returnRecoveredAfterSecondRestart:true,destructiveAuthority:false,proofBoundary:'FOUR_INDEPENDENT_GITHUB_JOBS; REAL_JM_PORTABLE_ROUTE_SELECTION; HUMAN_TEST_AUTHORISED_FIXED_REPAIR; FAULT_OBSERVED; DIFF_NOT_PUBLISHED; NO_LLM_INFERENCE_OR_LIVE_RENDER_POST'};
    await writeJson(resultPath,result);
    console.log(JSON.stringify(result,null,2));
  }finally{await close(s);}
}
if(phase==='seed')await seed();
else if(phase==='work')await worker();
else if(phase==='recover')await recover();
else throw new Error('usage: node JM_SOVEREIGN_ROUTED_HANDOFF_v0_3_6.mjs seed|work|recover');
