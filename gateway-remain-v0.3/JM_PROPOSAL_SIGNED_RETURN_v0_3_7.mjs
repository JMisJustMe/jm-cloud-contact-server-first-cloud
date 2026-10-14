// JM Gateway v0.3.7 — independent signer verification before inherited Cading return.
// Does not alter protected v0.3.6 gateway / Remain / worker ledger.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
const root=path.resolve('.handoff');
const read=async n=>JSON.parse(await fs.readFile(path.join(root,n),'utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const check=(yes,label)=>{if(!yes)throw Error('JM_SIGNED_FINAL_HOLD:'+label)};
const [proof,report,route,w]=await Promise.all(['proposal-proof.json','worker-report.json','sovereign-route.json','signed-cloud-witness.json'].map(read));
function verify(x){
 try{
  const r=x.cloudReceipt;
  if(x.schema!=='JM.ExternalSignedSourceWitness/0.3.7'||x.status!=='PASS'||r.status!=='closed')return false;
  if(x.sourceCommit!==proof.sourceCommit||x.sourceProposalSha256!==sha(canonical(proof))||
     x.workerReportSha256!==sha(JSON.stringify(report))||
     x.routeDecisionSha256!==route.decisionSha256||
     x.repairSourceDiffSha256!==report.repair.sourceDiffSha256)return false;
  if(x.cloudPublicKeyId!==r.publicKeyId||x.cloudReceiptSha256!==r.receiptHash||
     x.readbackHash!==r.receiptHash||x.readbackStatus!=='complete'||
     x.readbackStage!=='PUBLIC_OUTPUT'||!x.hashesFoundInReadback||
     x.sourcePromoted!==false||x.productionDurabilityClaim!==false)return false;
  const snap={schema:r.schema,spaceId:r.spaceId,label:r.label,kind:r.kind,status:r.status,createdAt:r.createdAt,updatedAt:r.updatedAt,members:r.members,eventCount:r.eventCount,commandCount:r.commandCount,signalCount:r.signalCount,chainHead:r.chainHead};
  if(sha(canonical(snap))!==r.receiptHash)return false;
  const key=crypto.createPublicKey({key:x.cloudPublicKey,format:'jwk'});
  return crypto.verify('sha256',Buffer.from(r.receiptHash),{key,dsaEncoding:'ieee-p1363'},Buffer.from(r.publicSig,'base64url'));
 }catch{return false}
}
check(verify(w),'BAD_EXTERNAL_SIGNED_WITNESS');
const attacks=[
 {...w,sourceProposalSha256:'0'.repeat(64)},
 {...w,workerReportSha256:'0'.repeat(64)},
 {...w,routeDecisionSha256:'0'.repeat(64)},
 {...w,productionDurabilityClaim:true},
 {...w,sourcePromoted:true},
 {...w,cloudReceipt:{...w.cloudReceipt,receiptHash:'f'.repeat(64)}},
 {...w,cloudReceipt:{...w.cloudReceipt,eventCount:w.cloudReceipt.eventCount+1}},
 {...w,cloudReceipt:{...w.cloudReceipt,publicSig:'AA'}},
 {...w,cloudPublicKeyId:'FORGED'},
 {...w,readbackHash:'0'.repeat(64)}
];
check(attacks.every(y=>!verify(y)),'HOSTILE_EXTERNAL_WITNESS_ACCEPTED');
const recontact=await fetch('https://jm-cloud-contact-server-v05.onrender.com/receipt-key',{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});
check(recontact.ok,'PUBLIC_SIGNER_RECONTACT_FAILED');
const current=await recontact.json();
check(current.keyId===w.cloudPublicKeyId&&
      canonical(current.publicKeyJwk)===canonical(w.cloudPublicKey),'SIGNER_IDENTITY_DRIFT');
// A cross-runner witness is only added after independent verification.
// The unchanged inherited v0.3.6 gateway hashes this expanded report on return.
report.proposalVerifiedSha256=sha(canonical(proof));
report.jmCloudWitness={
  schema:w.schema,pipelineId:w.pipelineId,
  sourceProposalSha256:w.sourceProposalSha256,
  cloudReceiptHash:w.cloudReceiptSha256,
  meshReceiptHash:w.meshReceiptHash,
  currentKeyRecontacted:true,
  signatureVerified:true,
  negativeTamperCasesRejected:attacks.length,
  claimedModelAuthor:'NONE_NOT_A_MODEL_GENERATED_PATCH'
};
await fs.writeFile(path.join(root,'worker-report.json'),JSON.stringify(report,null,2)+'\n');
const p=spawnSync(process.execPath,['gateway-remain-v0.3/JM_SOVEREIGN_ROUTED_HANDOFF_v0_3_6.mjs','recover'],{encoding:'utf8',cwd:process.cwd(),timeout:240000,maxBuffer:5*1024*1024});
check(p.status===0,'GATEWAY_RECOVERY_'+(p.stderr||p.stdout).slice(-1600));
const recovered=await read('recovery-result.json');
check(recovered.status==='PASS'&&recovered.schema==='JM.SovereignRoutedRepairResult/0.3.6'&&
      recovered.returnRecoveredAfterSecondRestart===true&&
      recovered.taskRecovered===true&&recovered.controlRecovered===true&&
      recovered.destructiveAuthority===false&&recovered.publishedSource===false,'NOT_RECOVERED');
const final={
 schema:'JM.ModelProposalAdmissionReturn/0.3.7',
 status:'PASS',
 proposalAuthorship:'ASSISTANT_AUTHORED_NO_AUTONOMOUS_MODEL_INFERENCE',
 proposalSourceCommit:proof.sourceCommit,
 checkedNativeSourceSha256:proof.nativeWork.sourceDiffSha256,
 proposalSha256:w.sourceProposalSha256,
 routerDecisionSha256:route.decisionSha256,
 signedCloudReceiptSha256:w.cloudReceiptSha256,
 cloudSignatureReverified:true,
 signerIdentityRecontacted:true,
 hostileProposalMutationsRejected:proof.adversarialMutationsRejected,
 hostileCloudWitnessMutationsRejected:attacks.length,
 originalGatewayReceiptSha256:recovered.returnReceiptSha256,
 inheritedGatewayReturn:recovered,
 syntheticApprovalOnly:true,
 sourceMerged:false,
 modelGeneratedNewRepair:false,
 continuousHostedAgent:false,
 claimBoundary:'REAL_SOURCE_AND_SIGNED_EXISTING_JM_CLOUD_SECOND_BODY_CONTACT; CI_TEST_ONLY; DOES_NOT_PROVE_UNRESTRICTED_LLM_CODE_GENERATION_OR_RENDER_PERSISTENT_VOLUME'
};
await fs.writeFile(path.join(root,'recovery-result.json'),JSON.stringify(final,null,2)+'\n');
console.log(JSON.stringify({stage:'JM_CLOUD_SIGNED_FINAL_RETURN',status:'PASS',
 proposalAuthor:final.proposalAuthorship,
 proposalSha256:final.proposalSha256,
 signedCloudReceiptSha256:final.signedCloudReceiptSha256,
 gatewayReturnReceiptSha256:final.originalGatewayReceiptSha256,
 mutationCases:final.hostileProposalMutationsRejected+final.hostileCloudWitnessMutationsRejected,
 sourceMerged:false,signedCloudSignature:true,claimBoundary:final.claimBoundary}));
