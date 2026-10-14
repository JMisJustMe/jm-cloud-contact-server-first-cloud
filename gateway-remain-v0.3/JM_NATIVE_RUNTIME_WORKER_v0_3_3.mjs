// JM Native Runtime worker v0.3.3. Executes EXISTING JM coding bodies
// from the immutable, independent JM-cading-lab GitHub source checkout.
// Read-only to authorities: negative control temporarily modifies a disposable checkout only.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=path.resolve('native-src');
const expectedCommit='e26d1ce5605016ea94a670596ab12c52b0499d33';
const sha=t=>createHash('sha256').update(t).digest('hex');
const check=(ok,why)=>{if(!ok)throw new Error('JM_NATIVE_CONFORMANCE_HOLD:'+why);};
function exec(program,args,{cwd=root}={}){
  const run=spawnSync(program,args,{cwd,encoding:'utf8',timeout:90000,maxBuffer:5*1024*1024});
  return {ok:run.status===0,status:run.status,stdout:(run.stdout??'').trim(),stderr:(run.stderr??'').trim(),error:run.error?.message??null};
}
function pass(program,args,label){
  const result=exec(program,args);
  check(result.ok,label+':'+(result.stderr||result.stdout).slice(-500));
  return result.stdout;
}
const commit=pass('git',['rev-parse','HEAD'],'GIT_HEAD');
check(commit===expectedCommit,'WRONG_SOURCE_COMMIT');
const policyPath=path.join(root,'coding-estate/JM_CODING_BODY_ACTIVATION_POLICY_v0_1.json');
const policyOriginal=await fs.readFile(policyPath,'utf8');
const conformance=pass('python3',['agent-runtime/host-adapters/jm_host_adapter_conformance.py','--all','--run-local'],'HOST_ADAPTER_CONFORMANCE');
check(conformance.includes('JM HOST ADAPTER CONFORMANCE: PASS') && conformance.includes('LOCAL REFERENCE PLUGS: PASS'),'CONFORMANCE_OUTPUT');
const activationPolicy=pass('python3',['coding-estate/validate_coding_body_activation.py'],'ACTIVATION_POLICY');
check(activationPolicy.includes('current64=64 active_runtime_spine=12 available_not_selected=52'),'ACCOUNTING');
const queries=['music release','coding runtime','theory research','zzzz-no-known-domain'];
const samples=[];
for(const q of queries){
  const py=pass('python3',['agent-runtime/jm_agent_runtime.py','--core-only','--query',q],'PY_CORE_'+q);
  const node=pass('node',['agent-runtime/jm-agent-runtime.mjs','--core-only','--query',q],'NODE_CORE_'+q);
  check(py===node,'CROSS_LANGUAGE_CORE_PARITY_'+q);
  const obj=JSON.parse(py);
  check(obj.authority_class==='SESSION_ROUTER_NOT_SOURCE_AUTHORITY','AUTHORITY_CLASS_'+q);
  if(q==='zzzz-no-known-domain')check(Array.isArray(obj.route_candidates)&&obj.route_candidates.length===0,'NO_INVENTED_ROUTE');
  samples.push({query:q,byteIdentical:true,sha256:sha(py),routeCandidates:obj.route_candidates.length});
}
const pyActivation=pass('python3',['agent-runtime/jm_agent_runtime.py','--activation-only','--surface','github-ci','--query','coding runtime'],'PY_ACTIVATION');
const nodeActivation=pass('node',['agent-runtime/jm-agent-runtime.mjs','--activation-only','--surface','github-ci','--query','coding runtime'],'NODE_ACTIVATION');
check(pyActivation===nodeActivation,'ACTIVATION_PARITY');
const active=JSON.parse(pyActivation);
check(active.accounting?.current_coding_identities===64 &&
      active.accounting?.active_route===12 &&
      active.accounting?.available_not_selected===52 &&
      active.selection_is_process_execution===false,'SOVEREIGN_ACCOUNTING');

// Falsification control: induce actual policy drift only inside ephemeral source checkout.
// Validator MUST fail, then restored original bytes MUST pass again.
let mutationCaught=false, restored=false;
try{
  const mutated=JSON.parse(policyOriginal);
  mutated.activation_states=['ACTIVE_ROUTE','INCORRECT_STATUS'];
  await fs.writeFile(policyPath,JSON.stringify(mutated),'utf8');
  const negative=exec('python3',['coding-estate/validate_coding_body_activation.py']);
  mutationCaught=negative.status!==0 && negative.stdout.includes('activation state vocabulary drift');
}finally{
  await fs.writeFile(policyPath,policyOriginal,'utf8');
  restored=exec('python3',['coding-estate/validate_coding_body_activation.py']).ok;
}
check(mutationCaught&&restored,'NEGATIVE_CONTROL_AND_RESTORATION');
check(exec('git',['status','--porcelain']).stdout==='','SOURCE_NOT_RESTORED');
const result={
  schema:'JM.NativeRuntimeExecutedWork/0.3.3',
  sourceRepository:'JMisJustMe/JM-cading-lab',
  sourceCommit:commit,
  kind:'JM_NATIVE_RUNTIME_CONFORMANCE',
  status:'PASS',
  host:'GITHUB_ACTIONS_INDEPENDENT_RUNNER',
  actualCommandsExecuted:10,
  checks:{
    hostAdapterConformance:true,
    codingBodyPolicy:true,
    coreByteParityQueries:queries.length,
    activationByteParity:true,
    knownUnknownQueryRejected:true,
    negativeControlDetected:true,
    sourceRestored:true
  },
  accounting:active.accounting,
  activationSha256:sha(pyActivation),
  sourcePolicySha256:sha(policyOriginal),
  conformanceTextSha256:sha(conformance),
  samples,
  outputScope:'ACTUAL_JM_CODE_EXECUTED; SOURCE_UNCHANGED; NO_RELEASE_OR_OWNER_DEVICE_CLAIM'
};
await fs.mkdir('.handoff',{recursive:true});
await fs.writeFile('.handoff/native-work-report.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',sourceCommit:commit,tests:result.checks,accounting:result.accounting,negativeControl:mutationCaught,sourceRestored:restored,reportSha256:sha(JSON.stringify(result))}));
