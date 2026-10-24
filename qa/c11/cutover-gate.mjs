// JM CP-C11 owner-facing *decision support*, not a deploy authority.
// Evidence requirements must be independently proven; boolean fields alone are
// declarations and cannot authorise production writes. NEVER takes credentials.
import crypto from 'node:crypto';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const sha=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const rule=(name,valid,note)=>({gate:name,pass:valid===true,note});
const cleanText=s=>typeof s==='string'&&s.trim().length>0;
const proof=x=>x&&x.status==='VERIFIED'&&cleanText(x.evidenceRef)&&!/^fixture|synthetic|demo/i.test(x.evidenceRef);
const noSecretData=(v)=>{
 const serialized=JSON.stringify(v||{});
 return !/(private.key|api[_-]?key|bearer\s|password\s*[:=]|sk-proj-|BEGIN (?:EC |RSA )?PRIVATE KEY)/i.test(serialized);
};
export function evaluateCutover(input){
 if(!input||input.schema!=='jm.cp-c11.cutover-evidence/1')throw Error('UNSUPPORTED_EVIDENCE_SCHEMA');
 const s=input.service||{},d=input.database||{},k=input.signing||{},v=input.verification||{},a=input.authority||{};
 const checks=[
  rule('NO_SECRET_MATERIAL_IN_EVIDENCE',noSecretData(input),'Cutover records contain identifiers and proof refs only, never tokens, signing PEMs or credentials'),
  rule('TARGET_SERVICE_MATCHES_KNOWN_HOST',s.serviceId==='srv-dag55iek1f9s73e7fmng'&&s.name==='jm-cloud-contact-server-v05','Correct existing hosted service; no alternate carrier silently substituted'),
  rule('PUBLIC_HTTPS_READY_CURRENT',s.readiness==='VERIFIED_READY'&&proof(s.readinessProof),'Fresh live ready/health contact from exact host is required'),
  rule('CURRENT_DEPLOY_AUTHORITY',proof(s.deploymentProof)&&cleanText(s.proposedCommit)&&s.proposedCommit===v.ciCommit&&s.autoDeploy===false,'Exact reviewed candidate source, CI commit and deployment provenance must agree; auto deploy disabled'),
  rule('DEDICATED_CONTACT_DATABASE',d.name!=='jm-market-survivor-state'&&d.databaseName!=='jm_market_survivor_state'&&d.purpose==='CLOUD_CONTACT_ONLY'&&d.separateResource===true&&d.ownerApproved===true&&proof(d.resourceProof),'No custody borrowing from Market database'),
  rule('POSTGRES_RECOVERY',proof(d.freshVolumeRecoveryProof)&&proof(d.backupRestoreProof)&&d.backupsProtected===true,'Backup, restore and cold fresh-volume Postgres continuity independently verified'),
  rule('OWNER_MANAGED_SIGNER',k.provider==='OWNER_MANAGED_PRIVATE_STORE'&&/^[0-9a-f]{24}$/.test(k.expectedKeyId||'')&&k.currentKeyId===k.expectedKeyId&&proof(k.keyContinuityProof),'Independent signer pin matches owner approved signer on live host'),
  rule('SIGNER_EPOCH_DRIFT_RECONCILED',k.historicalDriftAcknowledged===true&&proof(k.rotationOrRecoveryProof),'Observed historical signer changes cannot be silently declared harmless'),
  rule('INTEGRATED_RD_PG_CI',v.integrationCiResult==='PASS'&&v.integrationCiChecks>=25&&proof(v.integrationCiProof),'Real runner + actual server + isolated Postgres CI evidence'),
  rule('FRESH_VOLUME_CI',v.freshVolumeCiResult==='PASS'&&proof(v.freshVolumeCiProof),'New independent boot files and stable external signer passed isolated CI'),
  rule('OWNER_APPROVED_SEGREGATED_PROBE',a.explicitProbeApproval===true&&proof(a.approvalRef)&&a.capability==='command:probe'&&a.secretHandling==='PRIVATE_HOST_ONLY','One bounded live probe only; private separate admin/member roles and credentials'),
  rule('ROLLBACK_AND_FINANCIAL_AUTHORITY',proof(a.rollbackRehearsalProof)&&a.incrementalCostsApproved===true&&proof(a.financialApprovalRef),'Rollback, storage costs, and owner approval cannot be inferred from historical CI'),
 ];
 const missing=checks.filter(x=>!x.pass).map(x=>x.gate);
 const evidenceHash=sha(input);
 return {schema:'jm.cp-c11.cutover-decision/1',status:missing.length?'HOLD':'REVIEW_CANDIDATE_NOT_AUTHORISED',deploymentAuthorised:false,source:'untrusted metadata declarations + independently referenced evidence',evidenceHash,checks,failedGates:missing,validGates:checks.length-missing.length,claimBoundary:'Even all checks cannot issue a live deploy/credential action; explicit owner approval and independently verified evidence are separate.',advice:missing.length?'Do not deploy, create/borrow databases, rotate signer, or submit hosted missions':'Prepare a separately approved change window; do not automatically deploy.'};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 if(process.argv.length!==3)throw Error('Usage: node cutover-gate.mjs <nonsecret-evidence.json>');
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const out=evaluateCutover(input);console.log(JSON.stringify(out,null,2));
 if(out.status==='HOLD')process.exitCode=2;
}
