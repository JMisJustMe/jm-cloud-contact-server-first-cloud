import {quantifyClock} from './JM_MARKET_CLOCK_ENGINE_v0_3.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hist=a=>Object.fromEntries([...new Set(a)].sort((x,y)=>x-y).map(k=>[String(k),a.filter(v=>v===k).length]));
const rotateValues=(rows,shift)=>{const a=[...(rows||[])].sort((x,y)=>x.timestamp-y.timestamp),n=a.length;if(!n)return[];const s=((Math.trunc(shift)%n)+n)%n;return a.map((x,i)=>({...x,value:a[(i+s)%n].value}))};

function uniqueShifts(n,count,minShift){
 if(n<4)return[1];
 const lo=Math.min(Math.max(1,Math.trunc(minShift||20)),Math.max(1,n-2)),hi=Math.max(lo,n-lo),span=Math.max(1,hi-lo+1),want=Math.min(Math.max(1,Math.trunc(count||256)),span),out=[],seen=new Set();
 let step=Math.max(1,Math.floor(span/Math.max(1,want)));
 while(step>1&&gcd(step,span)!==1)step--;
 let x=(97%span);
 for(let i=0;out.length<want&&i<span*2;i++){const s=lo+(x%span);if(!seen.has(s)){seen.add(s);out.push(s)}x=(x+step)%span}
 for(let s=lo;out.length<want&&s<=hi;s++)if(!seen.has(s)){seen.add(s);out.push(s)}
 return out;
}
function gcd(a,b){while(b){const t=a%b;a=b;b=t}return Math.abs(a)}

export function lagRarity(rowsA,rowsB,defA,defB,opts={}){
 const maxLag=clamp(Math.trunc(Number.isFinite(+opts.maxLag)?+opts.maxLag:20),1,90);
 const frictionBps=clamp(Number.isFinite(+opts.frictionBps)?+opts.frictionBps:20,0,10000);
 const placeboCount=clamp(Math.trunc(Number.isFinite(+opts.placeboCount)?+opts.placeboCount:256),16,1024);
 const minShift=clamp(Math.trunc(Number.isFinite(+opts.minShift)?+opts.minShift:20),1,5000);
 const A=[...(rowsA||[])].sort((x,y)=>x.timestamp-y.timestamp),B=[...(rowsB||[])].sort((x,y)=>x.timestamp-y.timestamp);
 if(A.length<31||B.length<31)throw Error('lag-rarity test needs at least 31 rows in each series');
 const baseline=quantifyClock(A,B,{maxLag,threshold:defA.defaultThreshold,frictionBps,sourceTransform:defA.transform,targetTransform:defB.transform});
 const shifts=uniqueShifts(B.length,placeboCount,minShift),results=[];
 for(const shift of shifts){
  try{const q=quantifyClock(A,rotateValues(B,shift),{maxLag,threshold:defA.defaultThreshold,frictionBps,sourceTransform:defA.transform,targetTransform:defB.transform});results.push({shift,lagBars:q.lagBars,clockBand:q.clockBand,trainingCorrelation:q.trainingCorrelation,historicalSurvivalCandidate:q.historicalSurvivalCandidate,mismatchedClockCandidate:q.mismatchedClockCandidate})}
  catch(e){results.push({shift,error:String(e.message||e),historicalSurvivalCandidate:false,mismatchedClockCandidate:false})}
 }
 const ok=results.filter(x=>!x.error),mismatch=ok.filter(x=>x.mismatchedClockCandidate),lag=baseline.lagBars;
 const exact=mismatch.filter(x=>x.lagBars===lag),near=mismatch.filter(x=>Math.abs(x.lagBars-lag)<=2);
 const anySelected=ok.filter(x=>x.lagBars===lag),anyNear=ok.filter(x=>Math.abs(x.lagBars-lag)<=2);
 const exactRate=ok.length?exact.length/ok.length:null,nearRate=ok.length?near.length/ok.length:null,anyMismatchRate=ok.length?mismatch.length/ok.length:null;
 return {
  schema:'JM.MarketLagRarity/0.1',
  baseline:{lagBars:lag,observedLagHours:baseline.observedLagHours,clockBand:baseline.clockBand,trainingCorrelation:baseline.trainingCorrelation,historicalSurvivalCandidate:baseline.historicalSurvivalCandidate,mismatchedClockCandidate:baseline.mismatchedClockCandidate,validationN:baseline.validation.n,testN:baseline.test.n,validationAssociationMean:baseline.validation.associationMean,testAssociationMean:baseline.test.associationMean},
  settings:{maxLag,frictionBps,placeboCount:shifts.length,minShift},
  placebo:{completed:ok.length,failed:results.length-ok.length,mismatchedSurvivals:mismatch.length,mismatchRate:anyMismatchRate,mismatchRateAddOne:(mismatch.length+1)/(ok.length+1),exactBaselineLagMismatchSurvivals:exact.length,exactBaselineLagMismatchRate:exactRate,exactBaselineLagMismatchRateAddOne:(exact.length+1)/(ok.length+1),withinTwoBarsMismatchSurvivals:near.length,withinTwoBarsMismatchRate:nearRate,withinTwoBarsMismatchRateAddOne:(near.length+1)/(ok.length+1),exactBaselineLagSelectedAnyState:anySelected.length,withinTwoBarsSelectedAnyState:anyNear.length,mismatchLagHistogram:hist(mismatch.map(x=>x.lagBars)),allSelectedLagHistogram:hist(ok.map(x=>x.lagBars)),results},
  rarityDiagnostic:{
   baselineIsMismatch:baseline.mismatchedClockCandidate,
   exactLagRarerThanGenericMismatch:Number.isFinite(exactRate)&&Number.isFinite(anyMismatchRate)?exactRate<anyMismatchRate:null,
   exactLagToGenericMismatchRatio:anyMismatchRate?exactRate/anyMismatchRate:null,
   note:'Primary null event is a later-partition mismatched survivor landing on the baseline lag, not merely selecting the same training lag.'
  },
  claimBoundary:'This is an empirical deterministic-shift lag-identity diagnostic. Add-one rates are finite-sample null frequencies under this shift family, not universal p-values, causal proof, execution evidence, or capital authority.'
 };
}
