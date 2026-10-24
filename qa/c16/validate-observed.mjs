// Re-evaluate the immutable provider snapshot at capture time AND at current runtime.
// This does not refresh provider metadata; neither result grants deployment authority.
import fs from 'node:fs';
import {assessPromotion} from './promotion-gate.mjs';
const facts=JSON.parse(fs.readFileSync(new URL('./observed-real-inventory.json',import.meta.url),'utf8'));
const atCapture=assessPromotion(facts,{now:Date.parse(facts.provider.observedAt)+10_000});
const now=assessPromotion(facts);
const result={schema:'jm.cp-c16.production-observation-result/2',atCapture,now,observedAt:facts.provider.observedAt,releaseSha:facts.release.candidateCommit,liveSha:facts.provider.service.deployedCommit,note:'Read-only provider snapshot; no fresh provider verification or write was performed by this script'};
console.log(JSON.stringify(result,null,2));
if(atCapture.gate!=='HOLD'||atCapture.reason!=='DEDICATED_CONTACT_AND_FENCE_STORAGE_MISSING'||now.gate!=='HOLD'||atCapture.productionApproved!==false||now.productionApproved!==false)process.exitCode=1;
