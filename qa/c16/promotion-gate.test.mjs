import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {assessPromotion,approvalMessage,identityForJwk} from './promotion-gate.mjs';
const when=Date.parse('2026-10-24T11:31:40Z');
const {privateKey,publicKey}=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const jwk=publicKey.export({format:'jwk'}),ownerPin=identityForJwk(jwk);
const options={now:when,trustedOwnerKeyId:ownerPin};
const observations=JSON.parse(fs.readFileSync(new URL('./observed-real-inventory.json',import.meta.url)));
const copy=x=>structuredClone(x);
const reason=x=>assessPromotion(x,options).reason;
function populate(base=observations){
 const doc=copy(base);
 doc.resources={
  contactState:{id:'dpg-contact-isolated-ci-fixture',status:'available',purpose:'JM_CLOUD_CONTACT_STATE',ownerApproved:true},
  sharedFence:{id:'dpg-fence-isolated-ci-fixture',status:'available',purpose:'JM_CLOUD_CONTACT_FENCE',ownerApproved:true},
  ownerSigner:{keyId:'a'.repeat(24),ownerManaged:true,persistedAcrossRestart:true,historicalKeyErasReconciled:true}
 };
 doc.provider.inventory.databases.push({id:doc.resources.contactState.id,name:'cp-c16-synthetic-contact',status:'available'},{id:doc.resources.sharedFence.id,name:'cp-c16-synthetic-fence',status:'available'});
 doc.signing={stagedPublicKeyId:'a'.repeat(24),independentPinConfirmed:true,privateMaterialInArtifact:false};
 doc.expenses={estimatedMonthlyUSD:12,ownerApprovedMonthlyMaxUSD:18};
 doc.rollback={separateVerifiedBackup:true,backupDigestVerified:true,writerIngressCanBeDisabled:true,forkAwareDecisionRequired:true,uncertainCommitDecisionDocumented:true,restoreRehearsalPassed:true};
 return doc;
}
function sign(input){
 const doc=copy(input),nonce=crypto.randomBytes(12).toString('base64url');
 const approval={nonce,issuedAt:'2026-10-24T11:30:00Z',expiresAt:'2026-10-24T11:50:00Z',publicJwk:jwk};
 const message=approvalMessage({...doc,approval});
 approval.message=message;
 approval.signature=crypto.sign('sha256',Buffer.from(canon(message)),{key:privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 doc.approval=approval;
 return doc;
}
const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
const good=()=>sign(populate());
test('actual observed Render inventory MUST remain HOLD',()=>assert.equal(reason(observations),'DEDICATED_CONTACT_AND_FENCE_STORAGE_MISSING'));
test('unknown schema refuses all',()=>{const x=good();x.schema='evil';assert.equal(reason(x),'UNKNOWN_EVIDENCE_SCHEMA');});
test('unknown stage holds',()=>{const x=good();x.stage='DEPLOY';assert.equal(reason(x),'UNKNOWN_PROMOTION_STAGE');});
test('changed candidate release holds',()=>{const x=good();x.release.candidateCommit='b'.repeat(40);assert.equal(reason(x),'RELEASE_NOT_PINNED_TO_PROVEN_CP_C15');});
test('changed current live code holds',()=>{const x=good();x.provider.service.deployedCommit='b'.repeat(40);assert.equal(reason(x),'DEPLOYED_SOURCE_AUTHORITY_MISMATCH');});
test('auto-deploy enabled holds',()=>{const x=good();x.provider.service.autoDeploy='yes';assert.equal(reason(x),'DEPLOYED_SOURCE_AUTHORITY_MISMATCH');});
test('CI failure cannot pass',()=>{const x=good();x.release.ci.conclusion='failure';assert.equal(reason(x),'MISSING_EXACT_VERIFIED_CP_C15_CI');});
test('stale provider observations refused',()=>{const x=good();x.provider.observedAt='2026-10-23T11:31:40Z';assert.equal(reason(x),'RENDER_OBSERVATION_STALE');});
test('Market database may not be reused',()=>{const x=good();x.resources.contactState.id='dpg-daro60h7lnhs73e6frg0-a';assert.equal(reason(x),'DATABASE_CUSTODY_COLLISION_OR_MARKET_BORROWING');});
test('contact state and fence database cannot be same',()=>{const x=good();x.resources.sharedFence.id=x.resources.contactState.id;assert.equal(reason(x),'DATABASE_CUSTODY_COLLISION_OR_MARKET_BORROWING');});
test('missing database ownership holds',()=>{const x=good();x.resources.sharedFence.ownerApproved=false;assert.equal(reason(x),'DEDICATED_DATABASE_OWNER_APPROVAL_MISSING');});
test('unavailable database holds',()=>{const x=good();x.resources.contactState.status='suspended';assert.equal(reason(x),'DEDICATED_DATABASE_UNAVAILABLE');});
test('missing stable signer holds',()=>{const x=good();x.resources.ownerSigner.persistedAcrossRestart=false;assert.equal(reason(x),'STABLE_SIGNING_CUSTODY_UNPROVEN');});
test('secret included in archive holds',()=>{const x=good();x.signing.privateMaterialInArtifact=true;assert.equal(reason(x),'SIGNER_PIN_OR_SECRET_CUSTODY_INVALID');});
test('unapproved spend holds',()=>{const x=good();x.expenses.estimatedMonthlyUSD=21;assert.equal(reason(x),'BILLING_SCOPE_NOT_APPROVED');});
test('missing backup rehearsal holds',()=>{const x=good();x.rollback.restoreRehearsalPassed=false;assert.equal(reason(x),'CONTROLLED_RECOVERY_NOT_READY');});
test('unsigned owner approval holds',()=>{const x=populate();assert.equal(reason(x),'OWNER_SIGNED_APPROVAL_MISSING');});
test('signature trust pin cannot be inferred from submitted document',()=>assert.equal(assessPromotion(good(),{now:when}).reason,'INDEPENDENT_OWNER_TRUST_PIN_MISSING'));
test('forged owner signature rejected',()=>{const x=good();x.approval.signature=crypto.randomBytes(64).toString('base64url');assert.equal(reason(x),'OWNER_SIGNATURE_INVALID');});
test('signature from wrong key rejected',()=>{const x=good();assert.equal(assessPromotion(x,{now:when,trustedOwnerKeyId:'f'.repeat(24)}).reason,'OWNER_SIGNATURE_TRUST_PIN_MISMATCH');});
test('signed approval cannot be applied to a different budget',()=>{const x=good();x.expenses.ownerApprovedMonthlyMaxUSD=20;assert.equal(reason(x),'OWNER_APPROVAL_NOT_BOUND_TO_EXACT_RELEASE');});
test('signed approval cannot be reused at another stage',()=>{const x=good();x.stage='CANARY';assert.equal(reason(x),'OWNER_APPROVAL_NOT_BOUND_TO_EXACT_RELEASE');});
test('approval expires',()=>{const x=good();x.provider.observedAt='2026-10-24T11:50:40Z';assert.equal(assessPromotion(x,{...options,now:Date.parse('2026-10-24T11:51:00Z')}).reason,'OWNER_APPROVAL_EXPIRED_OR_STALE');});
test('signed simulated prepare NEVER auto-authorises production',()=>{const r=assessPromotion(good(),options);assert.equal(r.gate,'READY_FOR_OWNER_REVIEW');assert.equal(r.productionApproved,false);assert.equal(r.deployPerformed,false);});
test('canary requires real verified hosted contact',()=>{const x=populate();x.stage='CANARY';assert.equal(reason(sign(x)),'REAL_AUTHENTICATED_HOSTED_PROBE_UNPROVEN');});
function withCanary(stage='CANARY'){
 const x=populate();x.stage=stage;x.contact={localRunnerReceiptSha:'b'.repeat(64),hostSignedReturnSha:'c'.repeat(64),signerKeyId:'a'.repeat(24),verifiedByIndependentReconciler:true,actualHostedProbe:true,observedAt:'2026-10-24T11:31:00Z'};return x;
}
test('synthetic canary only eligible for review',()=>{const r=assessPromotion(sign(withCanary()),options);assert.equal(r.gate,'READY_FOR_OWNER_REVIEW');assert.equal(r.productionApproved,false);});
test('hosted signer drift rejected',()=>{const x=withCanary();x.contact.signerKeyId='b'.repeat(24);assert.equal(reason(sign(x)),'REAL_AUTHENTICATED_HOSTED_PROBE_UNPROVEN');});
test('promotion requires physical owner acceptance',()=>{const x=withCanary('PROMOTE');assert.equal(reason(sign(x)),'PHYSICAL_DEVICE_OR_OWNER_ACCEPTANCE_MISSING');});
test('synthetic owner/device acceptance remains review, not automatic deploy',()=>{const x=withCanary('PROMOTE');x.acceptance={samsungPhysical:true,laptopPhysical:true,ownerAcceptance:true,rollbackRehearsalConfirmed:true};const r=assessPromotion(sign(x),options);assert.equal(r.gate,'READY_FOR_OWNER_REVIEW');assert.equal(r.productionApproved,false);});

test('false resource claims not in provider inventory rejected',()=>{const x=good();x.provider.inventory.databases=x.provider.inventory.databases.filter(db=>db.id==='dpg-daro60h7lnhs73e6frg0-a');assert.equal(reason(x),'DEDICATED_DATABASE_NOT_IN_CURRENT_RENDER_INVENTORY');});

test('approval expiry cannot be extended without breaking signature',()=>{const x=good();x.approval.expiresAt='2026-10-24T12:00:00Z';assert.equal(reason(x),'OWNER_APPROVAL_NOT_BOUND_TO_EXACT_RELEASE');});
test('owner approval cryptographically binds real hosted return hash',()=>{const x=sign(withCanary());x.contact.hostSignedReturnSha='e'.repeat(64);assert.equal(reason(x),'OWNER_APPROVAL_NOT_BOUND_TO_EXACT_RELEASE');});
test('canary needs explicit actualHostedProbe true',()=>{const x=withCanary();delete x.contact.actualHostedProbe;assert.equal(reason(sign(x)),'REAL_AUTHENTICATED_HOSTED_PROBE_UNPROVEN');});
