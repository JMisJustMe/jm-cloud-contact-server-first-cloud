// JM Remain v0.3.1 independent worker-return proof.
// Does not execute user prompts; only the fixed READ_ONLY_GATEWAY_CONTACT proof.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {startRemainService} from './JM_SOVEREIGN_AGENT_GATEWAY_REMAIN_v0_3.mjs';
import {createWorkerReturnLedger} from './JM_WORKER_RETURN_LEDGER_v0_3_1.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'jm-worker-return-'));
const client='test-client-not-human';
const human='test-human-authority';
const worker='test-restricted-worker';
const port=19487;
const base='http://127.0.0.1:'+port;
const ledgerFile=path.join(root,'JM_WORKER_RETURNS_v0_3_1.json');
const observations={};

async function req(p,method='GET',token=client,body){
  const r=await fetch(base+p,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  return {status:r.status,data:await r.json()};
}
async function close(s){await new Promise(ok=>s.server.close(ok));}
async function independentWorker(taskId){
  const js=`
  const base=process.env.JM_PROOF_BASE, id=process.env.JM_PROOF_TASK;
  const task=await fetch(base+'/api/v1/tasks/'+encodeURIComponent(id),{headers:{Authorization:'Bearer '+process.env.JM_PROOF_CLIENT}}).then(r=>r.json());
  const health=await fetch(base+'/remain/health').then(r=>r.json());
  if(task.task?.status!=='READY_FOR_AGENT_ROUTE'||health.status!=='READY')process.exit(4);
  const evidence={kind:'READ_ONLY_GATEWAY_CONTACT',taskId:id,taskStatus:task.task.status,remainRevision:health.control.revision,remainDigest:health.control.digest,destructiveAuthority:health.destructiveAuthority};
  const response=await fetch(base+'/remain/job-returns',{method:'POST',headers:{Authorization:'Bearer '+process.env.JM_PROOF_WORKER,'Content-Type':'application/json'},body:JSON.stringify({taskId:id,workerId:'independent-node-worker',evidence})});
  console.log(JSON.stringify({status:response.status,result:await response.json()}));
  `;
  return new Promise((resolve,reject)=>{
    const p=spawn(process.execPath,['--input-type=module','-e',js],{env:{...process.env,JM_PROOF_BASE:base,JM_PROOF_TASK:taskId,JM_PROOF_CLIENT:client,JM_PROOF_WORKER:worker}});
    let stdout='',stderr='';
    p.stdout.on('data',b=>stdout+=b);
    p.stderr.on('data',b=>stderr+=b);
    p.on('exit',c=>c===0?resolve(JSON.parse(stdout.trim())):reject(new Error('worker exit '+c+' '+stderr)));
  });
}
let service=await startRemainService({port,host:'127.0.0.1',dataRoot:root,clientToken:client,authorityToken:human,workerToken:worker,acpEnabled:false,durabilityTier:'ISOLATED_RESTART_TEST'});
try {
  const created=await req('/api/v1/tasks','POST',client,{prompt:'Bounded external contact proof — no arbitrary code execution',agent:'jm-external-worker-proof'});
  if(created.status!==201)throw new Error('task creation '+JSON.stringify(created));
  const taskId=created.data.task.id;
  const held=await req('/api/v1/tasks/'+taskId+'/dispatch','POST',human,{});
  if(held.status!==409)throw new Error('preapproval HOLD missing');
  const forged=await req('/api/v1/tasks/'+taskId+'/approve','POST',worker,{});
  if(forged.status!==401 && forged.status!==403)throw new Error('worker gained authority');
  const preReturn=await req('/remain/job-returns','POST',worker,{taskId,workerId:'independent-node-worker',evidence:{kind:'READ_ONLY_GATEWAY_CONTACT'}});
  if(preReturn.status!==422)throw new Error('premature return not held');
  const approval=await req('/api/v1/tasks/'+taskId+'/approve','POST',human,{});
  const dispatch=await req('/api/v1/tasks/'+taskId+'/dispatch','POST',human,{});
  if(approval.status!==200||dispatch.status!==200)throw new Error('human authority route failed');
  const returned=await independentWorker(taskId);
  if(returned.status!==201||returned.result.status!=='RETURN_RECORDED')throw new Error('external return not recorded');
  const replay=await independentWorker(taskId);
  if(replay.status!==200||replay.result.status!=='IDEMPOTENT_REPLAY')throw new Error('idempotence failed');
  const conflict=await req('/remain/job-returns','POST',worker,{taskId,workerId:'alternate-worker',evidence:{kind:'READ_ONLY_GATEWAY_CONTACT',value:'different'}});
  if(conflict.status!==409)throw new Error('conflict not rejected');
  const fetched=await req('/remain/job-returns?taskId='+encodeURIComponent(taskId));
  if(fetched.status!==200||!fetched.data.verified)throw new Error('return retrieval failed');
  const beforeHash=fetched.data.receipt.hash;
  await close(service);
  service=await startRemainService({port,host:'127.0.0.1',dataRoot:root,clientToken:client,authorityToken:human,workerToken:worker,acpEnabled:false,durabilityTier:'ISOLATED_RESTART_TEST'});
  const recovered=await req('/remain/job-returns?taskId='+encodeURIComponent(taskId));
  const original=await req('/api/v1/tasks/'+encodeURIComponent(taskId));
  if(recovered.status!==200||recovered.data.receipt.hash!==beforeHash||!service.workerReturns.startupRecovered)throw new Error('restart return not recovered');
  if(original.data.task.status!=='READY_FOR_AGENT_ROUTE')throw new Error('original task authority mutated');
  observations.taskId=taskId;
  observations.independentWorkerProcess=true;
  observations.workerAuthorityEscalationRejected=true;
  observations.preapprovalReturnHeld=true;
  observations.returnRecorded=true;
  observations.replayIdempotent=true;
  observations.conflictingReturnRejected=true;
  observations.restartLedgerRecovered=true;
  observations.originalCadingTaskUnchanged=true;
  observations.destructiveAuthority=false;
  observations.claimBoundary='ISOLATED_PROCESS_RESTART_PASS; EXTERNAL_HTTPS_HOSTED_RETURN_OPEN; FREE_HOST_STORAGE_DURABILITY_OPEN; JOB_EXECUTION_NOT_ATTESTED';
  await close(service);
  service=null;
  const corrupted=JSON.parse(await fs.readFile(ledgerFile,'utf8'));
  corrupted.receipts[0].workerId='tampered';
  await fs.writeFile(ledgerFile,JSON.stringify(corrupted),'utf8');
  let rejected=false;
  try{await createWorkerReturnLedger({dataPath:ledgerFile});}catch(e){rejected=String(e.message).includes('LEDGER_INVALID');}
  if(!rejected)throw new Error('corrupt ledger accepted');
  observations.tamperingRejected=true;
  console.log(JSON.stringify({status:'PASS',...observations},null,2));
}finally{
  if(service)await close(service);
  await fs.rm(root,{recursive:true,force:true});
}
