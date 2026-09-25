import {quantifyClock} from './JM_MARKET_CLOCK_ENGINE_v0_3.mjs';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const uniq=a=>[...new Set(a)];
const parseList=(value,fallback,min,max,limit=8)=>{const raw=Array.isArray(value)?value:String(value??'').split(',');const xs=raw.map(Number).filter(Number.isFinite).map(x=>clamp(x,min,max));return uniq(xs.length?xs:fallback).slice(0,limit)};
const ymd=ms=>new Date(ms).toISOString().slice(0,10);
const yearsBefore=(toMs,years)=>{const d=new Date(toMs);d.setUTCFullYear(d.getUTCFullYear()-years);return d.getTime()};
const subset=(rows,startMs,toMs)=>rows.filter(x=>+x.timestamp>=startMs&&+x.timestamp<=toMs);
const hist=a=>Object.fromEntries([...new Set(a)].sort((x,y)=>x-y).map(k=>[String(k),a.filter(v=>v===k).length]));
const summarizeBy=(rows,key)=>Object.fromEntries([...new Set(rows.map(x=>x[key]))].sort((a,b)=>a-b).map(v=>{const z=rows.filter(x=>x[key]===v),ok=z.filter(x=>!x.error);return[String(v),{completed:ok.length,historicalSurvivals:ok.filter(x=>x.historicalSurvivalCandidate).length,mismatchSurvivals:ok.filter(x=>x.mismatchedClockCandidate).length}]}));
const rotateValues=(rows,shift)=>{const a=[...rows].sort((x,y)=>x.timestamp-y.timestamp),n=a.length,s=n?((shift%n)+n)%n:0;return a.map((x,i)=>({...x,value:a[(i+s)%n]?.value}))};

export function stressClockPair(rowsA,rowsB,defA,defB,opts={}){
 const all=[...(rowsA||[]),...(rowsB||[])].filter(x=>Number.isFinite(+x.timestamp));
 if(!all.length)throw Error('stress test needs timestamped rows');
 const toMs=opts.toMs?+opts.toMs:Math.max(...all.map(x=>+x.timestamp));
 const windowsYears=parseList(opts.windowsYears,[3,5,8],1,20,6);
 const lagCaps=parseList(opts.lagCaps,[5,10,20],1,90,6).map(Math.trunc);
 const thresholdMultipliers=parseList(opts.thresholdMultipliers,[.5,1,1.5],.1,5,7);
 const frictionBps=clamp(Number.isFinite(+opts.frictionBps)?+opts.frictionBps:20,0,10000);
 const rollingWindowYears=clamp(Number.isFinite(+opts.rollingWindowYears)?+opts.rollingWindowYears:2,1,10);
 const rollingStepYears=clamp(Number.isFinite(+opts.rollingStepYears)?+opts.rollingStepYears:1,.5,5);
 const maxYears=Math.max(...windowsYears,rollingWindowYears),earliest=yearsBefore(toMs,maxYears);
 const A=(rowsA||[]).filter(x=>+x.timestamp>=earliest&&+x.timestamp<=toMs),B=(rowsB||[]).filter(x=>+x.timestamp>=earliest&&+x.timestamp<=toMs);
 const scenarios=[];
 const run=(direction,windowYears,maxLag,multiplier,kind='grid',windowEndMs=toMs)=>{
  const reverse=direction==='reverse',src=reverse?B:A,tgt=reverse?A:B,sd=reverse?defB:defA,td=reverse?defA:defB,startMs=yearsBefore(windowEndMs,windowYears),ra=subset(src,startMs,windowEndMs),rb=subset(tgt,startMs,windowEndMs),threshold=sd.defaultThreshold*multiplier;
  const base={kind,direction,windowYears,maxLag,thresholdMultiplier:multiplier,threshold,from:ymd(startMs),to:ymd(windowEndMs)};
  try{const q=quantifyClock(ra,rb,{maxLag,threshold,frictionBps,sourceTransform:sd.transform,targetTransform:td.transform});scenarios.push({...base,lagBars:q.lagBars,observedLagHours:q.observedLagHours,clockBand:q.clockBand,trainingCorrelation:q.trainingCorrelation,directionRelation:q.direction,validationN:q.validation.n,testN:q.test.n,validationAssociationMean:q.validation.associationMean,testAssociationMean:q.test.associationMean,historicalSurvivalCandidate:q.historicalSurvivalCandidate,mismatchedClockCandidate:q.mismatchedClockCandidate,paperSurvivalCandidate:q.paperSurvivalCandidate})}catch(e){scenarios.push({...base,error:String(e.message||e),historicalSurvivalCandidate:false,mismatchedClockCandidate:false,paperSurvivalCandidate:false})}
 };
 for(const direction of ['forward','reverse'])for(const w of windowsYears)for(const l of lagCaps)for(const m of thresholdMultipliers)run(direction,w,l,m);
 const rolling=[];
 const rollingMaxLag=Math.max(...lagCaps),rollingMultiplier=1;
 let end=toMs;while(yearsBefore(end,rollingWindowYears)>=earliest){const before=scenarios.length;run('forward',rollingWindowYears,rollingMaxLag,rollingMultiplier,'rolling',end);rolling.push(scenarios.at(-1));end=yearsBefore(end,rollingStepYears)}
 const grid=scenarios.filter(x=>x.kind==='grid'),forward=grid.filter(x=>x.direction==='forward'),reverse=grid.filter(x=>x.direction==='reverse'),fok=forward.filter(x=>!x.error),rok=reverse.filter(x=>!x.error),fm=fok.filter(x=>x.mismatchedClockCandidate),rm=rok.filter(x=>x.mismatchedClockCandidate);
 const baseline=forward.find(x=>x.windowYears===5&&x.maxLag===20&&x.thresholdMultiplier===1&&!x.error)||forward.find(x=>!x.error)||null;
 const baseLag=baseline?.lagBars,baselineExact=Number.isFinite(baseLag)?fm.filter(x=>x.lagBars===baseLag).length:null,baselineNear=Number.isFinite(baseLag)?fm.filter(x=>Math.abs(x.lagBars-baseLag)<=2).length:null;
 const rollOk=rolling.filter(x=>!x.error),rollMismatch=rollOk.filter(x=>x.mismatchedClockCandidate);
 const baselineWindowYears=baseline?.windowYears||5,baselineStart=yearsBefore(toMs,baselineWindowYears),baseA=subset(A,baselineStart,toMs),baseB=subset(B,baselineStart,toMs),placeboShifts=parseList(opts.placeboShifts,[20,40,60,80,100,140,180,220],1,1000,12).map(Math.trunc),placebos=[];
 for(const shift of placeboShifts){try{const q=quantifyClock(baseA,rotateValues(baseB,shift),{maxLag:baseline?.maxLag||20,threshold:defA.defaultThreshold,frictionBps,sourceTransform:defA.transform,targetTransform:defB.transform});placebos.push({shift,lagBars:q.lagBars,trainingCorrelation:q.trainingCorrelation,historicalSurvivalCandidate:q.historicalSurvivalCandidate,mismatchedClockCandidate:q.mismatchedClockCandidate})}catch(e){placebos.push({shift,error:String(e.message||e),historicalSurvivalCandidate:false,mismatchedClockCandidate:false})}}
 const pok=placebos.filter(x=>!x.error),pm=pok.filter(x=>x.mismatchedClockCandidate);
 return {
  schema:'JM.MarketClockStress/0.1',
  sourceTransform:defA.transform,targetTransform:defB.transform,defaultSourceThreshold:defA.defaultThreshold,
  from:ymd(earliest),to:ymd(toMs),windowsYears,lagCaps,thresholdMultipliers,rollingWindowYears,rollingStepYears,frictionBps,
  discoveryContext:{screenedPairs:Number.isFinite(+opts.screenedPairs)?+opts.screenedPairs:null,postSelectionStress:true},
  baseline,
  grid:{scenarioCount:grid.length,completed:fok.length+rok.length,failed:grid.length-fok.length-rok.length,forwardCompleted:fok.length,reverseCompleted:rok.length,forwardHistoricalSurvivals:fok.filter(x=>x.historicalSurvivalCandidate).length,forwardMismatchSurvivals:fm.length,forwardMismatchSurvivalRate:fok.length?fm.length/fok.length:null,reverseHistoricalSurvivals:rok.filter(x=>x.historicalSurvivalCandidate).length,reverseMismatchSurvivals:rm.length,reverseMismatchSurvivalRate:rok.length?rm.length/rok.length:null,forwardMismatchLagHistogram:hist(fm.map(x=>x.lagBars)),baselineLagExactMismatchCount:baselineExact,baselineLagWithinTwoBarsMismatchCount:baselineNear,byWindowYears:summarizeBy(fok,'windowYears'),byLagCap:summarizeBy(fok,'maxLag'),byThresholdMultiplier:summarizeBy(fok,'thresholdMultiplier')},
  rolling:{scenarioCount:rolling.length,completed:rollOk.length,failed:rolling.length-rollOk.length,historicalSurvivals:rollOk.filter(x=>x.historicalSurvivalCandidate).length,mismatchSurvivals:rollMismatch.length,mismatchLagHistogram:hist(rollMismatch.map(x=>x.lagBars)),results:rolling},
  placebo:{scenarioCount:placebos.length,completed:pok.length,failed:placebos.length-pok.length,historicalSurvivals:pok.filter(x=>x.historicalSurvivalCandidate).length,mismatchSurvivals:pm.length,mismatchSurvivalRate:pok.length?pm.length/pok.length:null,results:placebos},
  scenarios,
  claimBoundary:'Post-selection stress only. Repeated lag survival can still arise from multiple testing, autocorrelation, regime dependence or omitted variables; it is not causal, live-execution or capital evidence.'
 };
}
