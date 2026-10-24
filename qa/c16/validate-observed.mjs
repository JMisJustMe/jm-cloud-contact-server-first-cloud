import fs from 'node:fs';
import {assessPromotion} from './promotion-gate.mjs';
const f=new URL('./observed-real-inventory.json',import.meta.url);
const facts=JSON.parse(fs.readFileSync(f,'utf8'));
const result=assessPromotion(facts);
console.log(JSON.stringify({schema:'jm.cp-c16.production-observation-result/1',...result,observedAt:facts.provider.observedAt,releaseSha:facts.release.candidateCommit,liveSha:facts.provider.service.deployedCommit},null,2));
if(result.gate!=='HOLD')process.exitCode=1;
