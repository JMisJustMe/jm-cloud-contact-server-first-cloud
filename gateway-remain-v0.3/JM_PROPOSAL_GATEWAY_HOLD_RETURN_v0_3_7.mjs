// JM Gateway v0.3.7 degraded return — finalise WORKER RETURN, never invent cloud signature.
// Requires real approved source task, live candidate regression, route, repair evidence.
// The independent JM Cloud signature remains a separate HOLD.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=path.resolve('.handoff');
const read=async name=>JSON.parse(await fs.readFile(path.join(root,name),'utf8'));
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const check=(x,code)=>{if(!x)throw Error('JM_V037_DEGRADED_HOLD:'+code)};
const [proposal,report,route,manifest,digest]=await Promise.all([
 'proposal-proof.json','worker-report.json','sovereign-route.json','job-manifest.json','job-manifest-digest.json'
].map(read));
check(manifest.schema==='JM.BoundedAutoRepairHandoff/0.3.6'&&
      digest.sha256===sha(JSON.stringify(manifest))&&
      manifest.taskId===route.taskId&&report.taskId===manifest.taskId,
      'CADING_BIND');
const {decisionSha256,...routeBody}=route;
check(route.schema==='JM.SovereignRouteDecision/0.3.6'&&
      sha(canonical(routeBody))===decisionSha256&&
      route.chosenCurrentHead?.id==='coding-control-plane'&&
      route.actionAuthority==='SYNTHETIC_TEST_HUMAN_CADING_MANIFEST'&&
      route.allowMerge!==true&&route.permissionToPush===false,
      'REAL_JM_ROUTER');
check(proposal.schema==='JM.ProposalIndependentVerification/0.3.7'&&proposal.status==='PASS'&&
      proposal.sourceCommit==='960b7455030701d1d9484fda6f8a7d0695e5670e'&&
      proposal.adversarialMutationsRejected===15&&
      proposal.routeDecisionSha256===decisionSha256&&
      proposal.proposal?.providerClass==='ASSISTANT_AUTHORED_DRAFT_PR_NOT_LLM'&&
      proposal.proposal?.allowMerge===false&&proposal.proposal?.allowPush===false&&
      proposal.nativeWork?.durableAtomicFaultRegression===true&&
      proposal.nativeWork?.sourceTreeUnchanged===true,'INDEPENDENT_SOURCE_PROPOSAL');
check(report.schema==='JM.SovereignRoutedRepairReport/0.3.6'&&report.result==='PASS'&&
      report.routerDecisionSha256===decisionSha256&&
      report.repair?.status==='PASS'&&
      report.repair?.sourceDiffSha256===proposal.nativeWork.sourceDiffSha256&&
      report.repair?.publishedSource===false&&
      report.repair?.checks?.baselineFaultObserved===true&&
      report.repair?.checks?.failureBeforeAtomicCommitPreservedOldReceipt===true,
      'REAL_WORKER_REPAIR');
const proposalHash=sha(canonical(proposal));
report.sourceProposalBinding={
  schema:'JM.SourceProposalBoundedProof/0.3.7',
  provenance:'ASSISTANT_AUTHORED_CANDIDATE',
  candidateCommit:proposal.sourceCommit,
  proposalSha256:proposalHash,
  routeDecisionSha256:decisionSha256,
  negativeProposalCasesRejected:15,
  testedSourceDiffSha256:proposal.nativeWork.sourceDiffSha256,
  externalSigner:'HOLD_NOT_PRESENT',
  signedCloudReceipt:false,
  sourceMerged:false
};
await fs.writeFile(path.join(root,'worker-report.json'),JSON.stringify(report,null,2)+'\n');
const result=spawnSync(process.execPath,
 ['gateway-remain-v0.3/JM_SOVEREIGN_ROUTED_HANDOFF_v0_3_6.mjs','recover'],
 {cwd:process.cwd(),encoding:'utf8',timeout:240000,maxBuffer:5*1024*1024});
check(result.status===0,'ORIGINAL_CADING_RECOVERY_'+(result.stderr||result.stdout||'').slice(-1000));
const returned=await read('recovery-result.json');
check(returned.schema==='JM.SovereignRoutedRepairResult/0.3.6'&&
      returned.status==='PASS'&&returned.taskRecovered&&returned.controlRecovered&&
      returned.returnRecoveredAfterSecondRestart&&
      returned.destructiveAuthority===false&&returned.publishedSource===false,'RETURN_STATE');
const final={
 schema:'JM.SourceProposalReturnWithExternalSignerHold/0.3.7',
 status:'PASS_WITH_EXTERNAL_SIGNER_HOLD',
 sourceProposalValidated:true,
 nativeJMRepairExecuted:true,
 gatewayReturnRecordedAndRecovered:true,
 independentJMCloudSignedReceipt:false,
 independentJMCloudStatus:'HOLD_NOT_ATTESTED_IN_THIS_RUN',
 sourcePromoted:false,
 proposalAuthorship:'ASSISTANT_NOT_LLM_GENERATED',
 originalGatewayReceiptSha256:returned.returnReceiptSha256,
 routerDecisionSha256:decisionSha256,
 durableJMSourceCommit:proposal.sourceCommit,
 originalWorkerPatchSha256:proposal.nativeWork.sourceDiffSha256,
 proposalProofSha256:proposalHash,
 inheritedGatewayResult:returned,
 claimBoundary:'FIVE_INDEPENDENT_CLOUD_JOBS_PROVE_SOURCE_ROUTING_REPAIR_GATEWAY_RETURN; NO_INDEPENDENT_SIGNED_JM_CLOUD_WITNESS; NO_PRODUCTION_RENDER_PERSISTENCE_OR_MODEL_WRITTEN_PATCH'
};
await fs.writeFile(path.join(root,'recovery-result.json'),JSON.stringify(final,null,2)+'\n');
console.log(JSON.stringify({schema:final.schema,status:final.status,
 gatewayReceiptSha256:final.originalGatewayReceiptSha256,
 sourceProposalSha256:final.proposalProofSha256,
 independentJMCloudStatus:final.independentJMCloudStatus,
 actualCodeEditedByCloudWorker:final.nativeJMRepairExecuted,
 signedCloudReceipt:false,
 sourceMerged:false,
 boundary:final.claimBoundary}));
