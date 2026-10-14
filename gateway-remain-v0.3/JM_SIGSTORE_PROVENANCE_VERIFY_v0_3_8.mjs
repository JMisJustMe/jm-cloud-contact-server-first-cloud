// JM v0.3.8 — separate cloud-runner verification of GitHub Sigstore provenance.
// GitHub attests WORKFLOW OUTPUT identity, not independent JM Cloud service state.
// No new source authority, no project edit, no private signing key.
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
const target=path.resolve('.handoff/recovery-result.json');
const repo='JMisJustMe/jm-cloud-contact-server-first-cloud';
const signer=repo+'/.github/workflows/jm-attested-return-v038.yml';
const branch='refs/heads/jm-sovereign-agent-gateway-v0.3.8-sigstore-provenance-20261014';
const sourceHash='2cbe5c3367fb9cdf73bbc66bc2b045806ff8704e9b1f4515644cc76d2de5c9a2';
const expectedSourceCommit='960b7455030701d1d9484fda6f8a7d0695e5670e';
const check=(yes,why)=>{if(!yes)throw Error('JM_SIGSTORE_VERIFY_HOLD:'+why);};
const bytes=await fs.readFile(target);
const receipt=JSON.parse(bytes.toString('utf8'));
check(receipt.schema==='JM.SourceProposalReturnWithExternalSignerHold/0.3.7' &&
      receipt.status==='PASS_WITH_EXTERNAL_SIGNER_HOLD' &&
      receipt.sourceProposalValidated===true &&
      receipt.nativeJMRepairExecuted===true &&
      receipt.gatewayReturnRecordedAndRecovered===true &&
      receipt.independentJMCloudSignedReceipt===false &&
      receipt.independentJMCloudStatus==='HOLD_NOT_ATTESTED_IN_THIS_RUN' &&
      receipt.proposalAuthorship==='ASSISTANT_NOT_LLM_GENERATED' &&
      receipt.durableJMSourceCommit===expectedSourceCommit &&
      receipt.originalWorkerPatchSha256===sourceHash &&
      receipt.inheritedGatewayResult?.returnRecoveredAfterSecondRestart===true &&
      receipt.inheritedGatewayResult?.taskRecovered===true &&
      receipt.inheritedGatewayResult?.controlRecovered===true &&
      receipt.sourcePromoted!==true,'SOURCE_BOUNDARY');
function attest(file){
 return spawnSync('gh',['attestation','verify',file,'--repo',repo,
   '--signer-workflow',signer,'--source-ref',branch,'--deny-self-hosted-runners',
   '--format','json'],{encoding:'utf8',timeout:100000,maxBuffer:9*1024*1024});
}
const proof=attest(target);
check(proof.status===0,'SIGNED_PROVENANCE_NOT_VERIFIED_'+(proof.stderr||proof.stdout||proof.error?.message||'').slice(-750));
const records=JSON.parse(proof.stdout);
check(Array.isArray(records)&&records.length>=1,'NO_VERIFIED_ATTESTATION');
const digest=crypto.createHash('sha256').update(bytes).digest('hex');
const verified=records.some(p=>(p.verificationResult?.statement?.subject||[]).some(subject=>
  subject.digest?.sha256===digest
));
check(verified,'SIGNED_SUBJECT_DIGEST_MISMATCH');
const tampered=path.resolve('.handoff/TAMPERED_SHOULD_FAIL.json');
const fake={...receipt,sourcePromoted:true,modelGeneratedNewRepair:true};
await fs.writeFile(tampered,JSON.stringify(fake,null,2)+'\n');
const rejection=attest(tampered);
await fs.unlink(tampered);
check(rejection.status!==0,'FORGED_RECEIPT_SIGNATURE_ACCEPTED');
const result={
 schema:'JM.GitHubSigstoreProvenanceVerification/0.3.8',
 status:'PASS',
 githubAttestationVerified:true,
 sigstoreSignedSource:'GITHUB_ACTIONS_NOT_JM_CLOUD_V05',
 signatureVerifiedFromSeparateRunner:true,
 signerWorkflow:signer,
 gitRef:branch,
 subjectSha256:digest,
 signerIdentityVerifiedByGitHubCLI:true,
 immutableSourceCommit:expectedSourceCommit,
 pinnedJMRepairDiffSha256:sourceHash,
 adversarialAlteredReceiptRejected:true,
 originalGatewayReturnReceiptSha256:receipt.originalGatewayReceiptSha256,
 externalJMCloudSigner:'HOLD_UNCHANGED',
 noModelAuthorshipClaim:true,
 noCanonicalSourcePromotion:true,
 claimBoundary:'SIGSTORE_ATTESTS_GITHUB_ACTIONS_RECEIPT_ORIGIN_AND_BYTES; NOT_LIVE_JM_CLOUD_SIGNING_OR_RENDER_HOST_STORAGE_RECOVERY; NO_AUTONOMOUS_MODEL_CODE_GENERATION'
};
await fs.writeFile('.handoff/sigstore-verification.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({stage:'JM_INDEPENDENT_SIGSTORE_VERIFY',status:'PASS',
  subjectSha256:digest,verifiedAttestations:records.length,
  tamperRejected:true,githubSigstoreSigned:true,
  jmCloudSigner:'HOLD',sourcePromoted:false}));
