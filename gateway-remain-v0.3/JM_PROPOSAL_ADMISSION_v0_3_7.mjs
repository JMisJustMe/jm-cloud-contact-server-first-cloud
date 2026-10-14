// JM v0.3.7 — untrusted proposal admission, independent native source verification.
// Candidate is assistant-authored durable PR #370, NOT a model-inferred source patch.
// Intent: model/provider can later emit this envelope, but cannot crown or execute it.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const jobRoot=path.resolve('.handoff');
const sourceRoot=path.resolve('proposal-src');
const BASE='18cb13123020e0df7c05f6402f774a24ff8f4a8e';
const CANDIDATE='960b7455030701d1d9484fda6f8a7d0695e5670e';
const ROUTER='e26d1ce5605016ea94a670596ab12c52b0499d33';
const PROVEN_DIFF='2cbe5c3367fb9cdf73bbc66bc2b045806ff8704e9b1f4515644cc76d2de5c9a2';
const ACTION='ATOMIC_RECEIPT_REPLACEMENT';
const TARGET='agent-runtime/host-adapters/jm_host_adapter_conformance.py';
const canon=v=>JSON.stringify(Array.isArray(v)?v.map(x=>JSON.parse(canon(x))):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,JSON.parse(canon(v[k]))])):v);
const sha=t=>createHash('sha256').update(typeof t==='string'?t:canon(t)).digest('hex');
const insist=(ok,label)=>{if(!ok)throw Error('JM_PROPOSAL_ADMISSION_HOLD:'+label);};
const read=async p=>JSON.parse(await fs.readFile(path.join(jobRoot,p),'utf8'));
const run=(cmd,args)=>{
  const p=spawnSync(cmd,args,{cwd:sourceRoot,encoding:'utf8',timeout:120000,maxBuffer:5*1024*1024});
  insist(p.status===0,'EXEC_'+cmd+'_'+(p.stderr||p.stdout||p.error?.message).slice(-550));
  return p.stdout.trim();
};
const seed=await read('job-manifest.json'),digest=await read('job-manifest-digest.json'),route=await read('sovereign-route.json');
insist(seed.schema==='JM.BoundedAutoRepairHandoff/0.3.6' &&
       sha(JSON.stringify(seed))===digest.sha256 &&
       seed.taskId===route.taskId && seed.routerSourceCommit===ROUTER &&
       seed.requestedAction===ACTION && seed.allowedFile===TARGET &&
       seed.destructiveAuthority===false,'CADING_MANIFEST');
const {decisionSha256,...routeBody}=route;
insist(route.schema==='JM.SovereignRouteDecision/0.3.6' &&
       decisionSha256===sha(routeBody) &&
       route.routerCoreSha256?.length===64 &&
       route.chosenCurrentHead?.id==='coding-control-plane' &&
       route.actionAuthority==='SYNTHETIC_TEST_HUMAN_CADING_MANIFEST' &&
       route.permissionToPush===false,'ROUTING_GATE');
insist(run('git',['rev-parse','HEAD'])===CANDIDATE,'EXACT_IMMUTABLE_SOURCE');
const changes=run('git',['diff','--name-only',BASE,CANDIDATE]).split('\n').filter(Boolean).sort();
const allow=[
 '.github/workflows/jm-host-atomic-receipt-v02.yml',
 'agent-runtime/host-adapters/jm_host_adapter_conformance.py',
 'agent-runtime/host-adapters/test_atomic_machine_receipt.py'
].sort();
insist(JSON.stringify(changes)===JSON.stringify(allow),'DIFF_SCOPE');
const patch=run('git',['diff','--no-ext-diff',BASE,CANDIDATE,'--',TARGET]);
insist(sha(patch)===PROVEN_DIFF,'UNVERIFIED_CLOUD_REPAIR_DIFF');
const fullSHA=sha(run('git',['diff','--no-ext-diff',BASE,CANDIDATE]));
const proposal={
 schema:'JM.UntrustedSourceProposal/0.3.7',
 providerClass:'ASSISTANT_AUTHORED_DRAFT_PR_NOT_LLM',
 proposerAuthority:'NONE',
 targetRepository:'JMisJustMe/JM-cading-lab',
 taskId:seed.taskId,
 targetPath:TARGET,
 baseCommit:BASE,
 candidateCommit:CANDIDATE,
 action:ACTION,
 sourceDiffSha256:PROVEN_DIFF,
 cloudWorkerRepairDiffSha256:PROVEN_DIFF,
 routeDecisionSha256:decisionSha256,
 requestedExecution:'READ_ONLY_INDEPENDENT_TEST',
 allowMerge:false,
 allowPush:false,
 destructiveAuthority:false,
 claimScope:'DRAFT_PR_370_VERIFICATION_ONLY'
};
function valid(p){
 return Boolean(p&&p.schema===proposal.schema&&
   p.providerClass===proposal.providerClass&&
   p.proposerAuthority==='NONE'&&p.targetRepository===proposal.targetRepository&&
   p.taskId===seed.taskId&&p.targetPath===TARGET&&p.baseCommit===BASE&&
   p.candidateCommit===CANDIDATE&&p.action===ACTION&&
   p.sourceDiffSha256===PROVEN_DIFF&&
   p.cloudWorkerRepairDiffSha256===PROVEN_DIFF&&
   p.routeDecisionSha256===decisionSha256&&
   p.requestedExecution==='READ_ONLY_INDEPENDENT_TEST'&&
   p.allowMerge===false&&p.allowPush===false&&
   p.destructiveAuthority===false&&p.claimScope===proposal.claimScope);
}
insist(valid(proposal),'EXPECTED_PROPOSAL_REJECTED');
const mutations=[
 {allowMerge:true},{allowPush:true},{destructiveAuthority:true},
 {action:'DELETE_SOURCE'}, {targetPath:'../secrets'},
 {candidateCommit:'f'.repeat(40)}, {baseCommit:'0'.repeat(40)},
 {taskId:'task-forged'}, {providerClass:'JM_LLM_GENERATED_AND_PROVEN'},
 {routeDecisionSha256:'0'.repeat(64)}, {sourceDiffSha256:'0'.repeat(64)},
 {proposerAuthority:'ROOT'}, {requestedExecution:'AUTO_MERGE'},
 {claimScope:'PRODUCTION_APPROVED'}, {targetRepository:'another/owner'}
];
insist(mutations.every(m=>!valid({...proposal,...m})),'FORGED_PROPOSAL_ADMITTED');
const conformance=run('python3',['agent-runtime/host-adapters/jm_host_adapter_conformance.py','--all','--run-local']);
insist(conformance.includes('JM HOST ADAPTER CONFORMANCE: PASS'),'REAL_CONFORMANCE');
const original=run('python3',['agent-runtime/host-adapters/test_machine_receipt.py']);
const atomic=run('python3',['agent-runtime/host-adapters/test_atomic_machine_receipt.py']);
const native=JSON.parse(atomic.split('\n').at(-1));
insist(native.status==='PASS'&&native.matchesExactIndependentWorkerPatch===true&&
       native.workerSourceDiffSha256===PROVEN_DIFF&&
       native.interruptedReplacePreservesPrior&&native.interruptedTempWritePreservesPrior&&
       native.noOrphanTempFiles&&native.realHostConformance&&
       native.successfulCommitValid,'NATIVE_ATOMIC_TEST');
insist(run('git',['status','--porcelain'])==='','SOURCE_TEST_MUTATED_GIT_CHECKOUT');
const report={
 schema:'JM.ProposalIndependentVerification/0.3.7',
 status:'PASS',
 proposal,
 sourceCommit:CANDIDATE,
 verifiedBaseCommit:BASE,
 validatedPaths:changes,
 routeDecisionSha256:decisionSha256,
 signedProposalBodySha256:sha(proposal), // content hash; NOT a signature
 nativeWork:{
   sourceDiffSha256:PROVEN_DIFF,
   fullChangeDiffSha256:fullSHA,
   originalReceiptRegression:true,
   durableAtomicFaultRegression:true,
   inheritedConformance:true,
   sourceTreeUnchanged:true,
   nativeReceiptSha256:native.receiptSha256
 },
 adversarialMutationsRejected:mutations.length,
 boundaries:'ASSISTANT_AUTHORED_PROPOSAL; UNTRUSTED_PROVENANCE_NOT_INDEPENDENT_MODEL_INFERENCE; REAL_SOURCE_AND_TESTS; NOT_SIGNED; NO_CANONICAL_WRITE'
};
await fs.mkdir(jobRoot,{recursive:true});
await fs.writeFile(path.join(jobRoot,'proposal-proof.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log(JSON.stringify({status:'PASS',schema:report.schema,candidateCommit:CANDIDATE,
  adversarialRejected:mutations.length,sourceDiffSha256:PROVEN_DIFF,
  proposalProofSha256:sha(report),nativeWork:report.nativeWork}));
