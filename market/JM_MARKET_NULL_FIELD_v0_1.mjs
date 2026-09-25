import {quantifyClock} from './JM_MARKET_CLOCK_ENGINE_v0_3.mjs';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
const median=a=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};
const quantile=(a,q)=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),p=(b.length-1)*q,i=Math.floor(p),r=p-i;return b[i+1]===undefined?b[i]:b[i]+r*(b[i+1]-b[i])};
const rotateValues=(rows,shift)=>{const a=[...(rows||[])].sort((x,y)=>x.timestamp-y.timestamp),n=a.length;if(!n)return[];const s=((Math.trunc(shift)%n)+n)%n;return a.map((x,i)=>({...x,value:a[(i+s)%n].value}))};
const nonZeroShift=(n,round,idx,minShift=20)=>{if(n<3)return 1;const lo=Math.min(Math.max(1,minShift),Math.max(1,n-1)),span=Math.max(1,n-lo);return lo+(((round+1)*(idx+3)*97+(round+1)*(round+7)*13)%span)};
const pairRun=(A,B,da,db,maxLag,frictionBps)=>quantifyClock(A,B,{maxLag,threshold:da.defaultThreshold,frictionBps,sourceTransform:da.transform,targetTransform:db.transform});

function scanObserved(series,defs,maxLag,frictionBps){
 const names=Object.keys(defs),results=[];
 for(const a of names)for(const b of names){if(a===b)continue;const A=series[a],B=series[b];if(!A?.length||!B?.length){results.push({source:a,target:b,error:'missing rows',mismatchedClockCandidate:false,historicalSurvivalCandidate:false});continue}
  try{const q=pairRun(A,B,defs[a],defs[b],maxLag,frictionBps);results.push({source:a,target:b,lagBars:q.lagBars,observedLagHours:q.observedLagHours,clockBand:q.clockBand,trainingCorrelation:q.trainingCorrelation,historicalSurvivalCandidate:q.historicalSurvivalCandidate,mismatchedClockCandidate:q.mismatchedClockCandidate,paperSurvivalCandidate:q.paperSurvivalCandidate,validationN:q.validation.n,testN:q.test.n,validationAssociationMean:q.validation.associationMean,testAssociationMean:q.test.associationMean})}
  catch(e){results.push({source:a,target:b,error:String(e.message||e),mismatchedClockCandidate:false,historicalSurvivalCandidate:false})}
 }
 return results;
}

function pairNull(A,B,da,db,baseline,opts={}){
 const placeboCount=clamp(Math.trunc(+opts.pairPlacebos||64),8,256),maxLag=clamp(Math.trunc(+opts.maxLag||20),1,90),frictionBps=clamp(+opts.frictionBps||20,0,10000),minShift=clamp(Math.trunc(+opts.minShift||20),1,1000),results=[];
 for(let r=0;r<placeboCount;r++){
  const shift=nonZeroShift(B.length,r,1,minShift);
  try{const q=pairRun(A,rotateValues(B,shift),da,db,maxLag,frictionBps);results.push({round:r+1,shift,lagBars:q.lagBars,historicalSurvivalCandidate:q.historicalSurvivalCandidate,mismatchedClockCandidate:q.mismatchedClockCandidate,trainingCorrelation:q.trainingCorrelation})}
  catch(e){results.push({round:r+1,shift,error:String(e.message||e),historicalSurvivalCandidate:false,mismatchedClockCandidate:false})}
 }
 const ok=results.filter(x=>!x.error),m=ok.filter(x=>x.mismatchedClockCandidate),lag=baseline?.lagBars,same=Number.isFinite(lag)?m.filter(x=>x.lagBars===lag).length:0,near=Number.isFinite(lag)?m.filter(x=>Math.abs(x.lagBars-lag)<=2).length:0;
 return {
  requested:placeboCount,completed:ok.length,failed:results.length-ok.length,mismatchedSurvivals:m.length,
  mismatchRate:ok.length?m.length/ok.length:null,mismatchRateAddOne:(m.length+1)/(ok.length+1),
  sameLagSurvivals:same,sameLagRate:ok.length?same/ok.length:null,sameLagRateAddOne:(same+1)/(ok.length+1),
  withinTwoBarsSurvivals:near,withinTwoBarsRate:ok.length?near/ok.length:null,
  minShift,results
 };
}

export function nullField(series,defs,opts={}){
 const t=Date.now(),maxLag=clamp(Math.trunc(+opts.maxLag||20),1,90),frictionBps=clamp(+opts.frictionBps||20,0,10000),familyRounds=clamp(Math.trunc(+opts.familyRounds||24),8,96),minShift=clamp(Math.trunc(+opts.minShift||20),1,1000);
 const observed=scanObserved(series,defs,maxLag,frictionBps),observedOk=observed.filter(x=>!x.error),observedMismatch=observedOk.filter(x=>x.mismatchedClockCandidate),observedSame=observedOk.filter(x=>x.historicalSurvivalCandidate&&!x.mismatchedClockCandidate&&x.lagBars===0);
 const names=Object.keys(defs),rounds=[];
 for(let r=0;r<familyRounds;r++){
  const rotated={};for(let i=0;i<names.length;i++){const name=names[i],rows=series[name]||[],shift=nonZeroShift(rows.length,r,i,minShift);rotated[name]=rotateValues(rows,shift)}
  const z=scanObserved(rotated,defs,maxLag,frictionBps),ok=z.filter(x=>!x.error),mis=ok.filter(x=>x.mismatchedClockCandidate),same=ok.filter(x=>x.historicalSurvivalCandidate&&!x.mismatchedClockCandidate&&x.lagBars===0);
  rounds.push({round:r+1,completedPairs:ok.length,failedPairs:z.length-ok.length,mismatchedCandidateCount:mis.length,sameBarCandidateCount:same.length,maxLagBars:mis.length?Math.max(...mis.map(x=>x.lagBars)):0});
 }
 const familyOk=rounds.filter(x=>x.failedPairs===0||x.completedPairs>0),counts=familyOk.map(x=>x.mismatchedCandidateCount),observedCount=observedMismatch.length,ge=familyOk.filter(x=>x.mismatchedCandidateCount>=observedCount).length;
 const pairPlacebos=observedMismatch.map(x=>({source:x.source,target:x.target,baseline:x,null:pairNull(series[x.source]||[],series[x.target]||[],defs[x.source],defs[x.target],x,{...opts,maxLag,frictionBps,minShift})}));
 return {
  schema:'JM.MarketNullField/0.1',
  screenedPairs:observed.length,completedObservedPairs:observedOk.length,failedObservedPairs:observed.length-observedOk.length,
  observedMismatchCount:observedMismatch.length,observedSameBarCount:observedSame.length,observedMismatchCandidates:observedMismatch,
  familyNull:{requestedRounds:familyRounds,completedRounds:familyOk.length,meanMismatchCount:mean(counts),medianMismatchCount:median(counts),p95MismatchCount:quantile(counts,.95),maxMismatchCount:counts.length?Math.max(...counts):null,roundsAtLeastObserved:ge,empiricalAtLeastObservedRate:familyOk.length?ge/familyOk.length:null,empiricalAtLeastObservedRateAddOne:(ge+1)/(familyOk.length+1),rounds},
  pairPlacebos,
  settings:{maxLag,frictionBps,familyRounds,pairPlacebos:+opts.pairPlacebos||64,minShift},
  durationMs:Date.now()-t,
  claimBoundary:'Deterministic circular-shift null diagnostics estimate how often this exact screening machinery generates survivors after calendar alignment is broken. They are not proof of independence, a formal causal test, or capital authority.'
 };
}
