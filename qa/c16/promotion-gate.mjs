// CP-C16: offline evidence evaluator. NEVER performs HTTP, signing, deployment or production writes.
// Provider facts are observational and MUST be refreshed independently before any human action.
import crypto from 'node:crypto';

const HEX24=/^[0-9a-f]{24}$/;
const HEX40=/^[0-9a-f]{40}$/;
const HEX64=/^[0-9a-f]{64}$/;
const OWNER_SCHEMA='jm.cp-c16.owner-release-approval/1';
const PLAN_SCHEMA='jm.cp-c16.read-only-production-gate/1';
const CONTACT_SERVICE_ID='srv-dag55iek1f9s73e7fmng';
const MARKET_DB_ID='dpg-daro60h7lnhs73e6frg0-a';
const C15_SHA='84bb7a2dbac2352e8e680d7ce1993dfee299b621';
const LIVE_SHA='0921217d95285bcb21cda7a995d02f7ec0725810';
const VERIFIED_C15_RUN=40085185327;
const VALID_STAGES=new Set(['PREPARE','CANARY','PROMOTE']);
const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const reject=(reason)=>Object.freeze({gate:'HOLD',reason,productionApproved:false,operatorReviewOnly:true,deployPerformed:false});
export const identityForJwk=jwk=>sha(canon(jwk)).slice(0,24);
export const approvalMessage=({stage,release,resources,rollback,expenses,approval,contact,acceptance})=>({
 schema:OWNER_SCHEMA,
 approvalNonce:approval?.nonce,
 issuedAt:approval?.issuedAt,
 expiresAt:approval?.expiresAt,
 stage,
 releaseCommit:release?.candidateCommit,
 previousCommit:release?.currentLiveCommit,
 serviceId:CONTACT_SERVICE_ID,
 stateDatabaseId:resources?.contactState?.id,
 fenceDatabaseId:resources?.sharedFence?.id,
 signerKeyId:resources?.ownerSigner?.keyId,
 approvedMonthlyMaxUSD:expenses?.ownerApprovedMonthlyMaxUSD,
 estimatedMonthlyUSD:expenses?.estimatedMonthlyUSD,
 rollbackDigest:sha(canon(rollback??null)),
 hostedContactDigest:sha(canon(contact??null)),
 physicalAcceptanceDigest:sha(canon(acceptance??null))
});
const at=(x)=>{const t=Date.parse(x||'');return Number.isFinite(t)?t:NaN;};
const recent=(x,now,ttlMs)=>Number.isFinite(at(x))&&at(x)<=now+30_000&&now-at(x)<=ttlMs;
function verifyOwnerSignature(input,stage,now,trustedOwnerKeyId){
 const {approval,release,resources,rollback,expenses,contact,acceptance}=input;
 if(!HEX24.test(trustedOwnerKeyId||''))return 'INDEPENDENT_OWNER_TRUST_PIN_MISSING';
 if(!approval?.publicJwk||!approval?.signature||!approval?.message)return 'OWNER_SIGNED_APPROVAL_MISSING';
 if(!/^[a-zA-Z0-9_-]{16,96}$/.test(approval?.nonce||''))return 'OWNER_APPROVAL_NONCE_MISSING';
 if(approval.publicJwk.kty!=='EC'||approval.publicJwk.crv!=='P-256')return 'OWNER_SIGNATURE_ALGORITHM_UNSUPPORTED';
 if(identityForJwk(approval.publicJwk)!==trustedOwnerKeyId)return 'OWNER_SIGNATURE_TRUST_PIN_MISMATCH';
 if(!recent(approval.issuedAt,now,24*3600_000)||!Number.isFinite(at(approval.expiresAt))||at(approval.expiresAt)<=now||at(approval.expiresAt)-now>24*3600_000)return 'OWNER_APPROVAL_EXPIRED_OR_STALE';
 const expected=approvalMessage({stage,release,resources,rollback,expenses,approval,contact,acceptance});
 if(canon(expected)!==canon(approval.message))return 'OWNER_APPROVAL_NOT_BOUND_TO_EXACT_RELEASE';
 let valid=false;
 try{const publicKey=crypto.createPublicKey({format:'jwk',key:approval.publicJwk});valid=crypto.verify('sha256',Buffer.from(canon(expected)),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(approval.signature,'base64url'));}catch{return 'OWNER_SIGNATURE_INVALID';}
 return valid?null:'OWNER_SIGNATURE_INVALID';
}
export function assessPromotion(input,{now=Date.now(),trustedOwnerKeyId=null}={}){
 if(!input||input.schema!==PLAN_SCHEMA)return reject('UNKNOWN_EVIDENCE_SCHEMA');
 const {stage,release,provider,resources,expenses,rollback,signing,contact,acceptance}=input;
 if(!VALID_STAGES.has(stage))return reject('UNKNOWN_PROMOTION_STAGE');
 if(!release||release.candidateCommit!==C15_SHA||!HEX40.test(release.candidateCommit))return reject('RELEASE_NOT_PINNED_TO_PROVEN_CP_C15');
 if(release.currentLiveCommit!==LIVE_SHA)return reject('CURRENT_LIVE_SOURCE_MISMATCH');
 if(release.sourceBranch!=='jm/c15-uncertain-commit-fence-recovery-20261024')return reject('UNEXPECTED_RELEASE_SOURCE_BRANCH');
 if(!release.ci||release.ci.runId!==VERIFIED_C15_RUN||release.ci.headSha!==C15_SHA||release.ci.conclusion!=='success'||release.ci.jobsPassed!==3)return reject('MISSING_EXACT_VERIFIED_CP_C15_CI');
 if(!provider||!recent(provider.observedAt,now,5*60_000))return reject('RENDER_OBSERVATION_STALE');
 if(provider.service?.id!==CONTACT_SERVICE_ID||provider.service?.url!=='https://jm-cloud-contact-server-v05.onrender.com')return reject('RENDER_SERVICE_IDENTITY_MISMATCH');
 if(provider.service?.branch!=='hosted-v0.5-descendant'||provider.service?.autoDeploy!=='no'||provider.service?.deployedCommit!==LIVE_SHA)return reject('DEPLOYED_SOURCE_AUTHORITY_MISMATCH');
 if(!resources?.contactState||!resources?.sharedFence)return reject('DEDICATED_CONTACT_AND_FENCE_STORAGE_MISSING');
 const ids=[resources.contactState.id,resources.sharedFence.id];
 if(ids.some(x=>!x||x===MARKET_DB_ID)||ids[0]===ids[1])return reject('DATABASE_CUSTODY_COLLISION_OR_MARKET_BORROWING');
 if(!['available'].includes(resources.contactState.status)||!['available'].includes(resources.sharedFence.status))return reject('DEDICATED_DATABASE_UNAVAILABLE');
 const present=provider.inventory?.databases;
 if(!Array.isArray(present)||!ids.every(id=>present.some(db=>db.id===id&&db.status==='available')))return reject('DEDICATED_DATABASE_NOT_IN_CURRENT_RENDER_INVENTORY');
 if(resources.contactState.purpose!=='JM_CLOUD_CONTACT_STATE'||resources.sharedFence.purpose!=='JM_CLOUD_CONTACT_FENCE')return reject('DATABASE_PURPOSE_UNPROVEN');
 if(resources.contactState.ownerApproved!==true||resources.sharedFence.ownerApproved!==true)return reject('DEDICATED_DATABASE_OWNER_APPROVAL_MISSING');
 if(!resources.ownerSigner||!HEX24.test(resources.ownerSigner.keyId||'')||resources.ownerSigner.ownerManaged!==true||resources.ownerSigner.persistedAcrossRestart!==true||resources.ownerSigner.historicalKeyErasReconciled!==true)return reject('STABLE_SIGNING_CUSTODY_UNPROVEN');
 if(!signing||signing.stagedPublicKeyId!==resources.ownerSigner.keyId||signing.independentPinConfirmed!==true||signing.privateMaterialInArtifact!==false)return reject('SIGNER_PIN_OR_SECRET_CUSTODY_INVALID');
 if(!expenses||!Number.isFinite(expenses.estimatedMonthlyUSD)||!Number.isFinite(expenses.ownerApprovedMonthlyMaxUSD)||expenses.estimatedMonthlyUSD<0||expenses.ownerApprovedMonthlyMaxUSD<=0||expenses.estimatedMonthlyUSD>expenses.ownerApprovedMonthlyMaxUSD)return reject('BILLING_SCOPE_NOT_APPROVED');
 if(!rollback||rollback.separateVerifiedBackup!==true||rollback.backupDigestVerified!==true||rollback.writerIngressCanBeDisabled!==true||rollback.forkAwareDecisionRequired!==true||rollback.uncertainCommitDecisionDocumented!==true||rollback.restoreRehearsalPassed!==true)return reject('CONTROLLED_RECOVERY_NOT_READY');
 const signedIssue=verifyOwnerSignature(input,stage,now,trustedOwnerKeyId);
 if(signedIssue)return reject(signedIssue);
 if(stage==='CANARY'||stage==='PROMOTE'){
  if(contact?.localRunnerReceiptSha===undefined||!HEX64.test(contact.localRunnerReceiptSha)||!HEX64.test(contact.hostSignedReturnSha||'')||contact.signerKeyId!==resources.ownerSigner.keyId||contact.verifiedByIndependentReconciler!==true||contact.actualHostedProbe!==true||!recent(contact.observedAt,now,5*60_000))return reject('REAL_AUTHENTICATED_HOSTED_PROBE_UNPROVEN');
 }
 if(stage==='PROMOTE'){
  if(!acceptance||acceptance.samsungPhysical===false||acceptance.laptopPhysical===false||acceptance.samsungPhysical!==true||acceptance.laptopPhysical!==true||acceptance.ownerAcceptance!==true||acceptance.rollbackRehearsalConfirmed!==true)return reject('PHYSICAL_DEVICE_OR_OWNER_ACCEPTANCE_MISSING');
 }
 return Object.freeze({gate:'READY_FOR_OWNER_REVIEW',reason:'ELIGIBLE_BUT_NOT_AUTOMATIC_AUTHORITY',productionApproved:false,operatorReviewOnly:true,deployPerformed:false});
}
