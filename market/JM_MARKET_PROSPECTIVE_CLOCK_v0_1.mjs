import {TRANSFORMS,clockBand} from './JM_MARKET_CLOCK_ENGINE_v0_3.mjs';

const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
const median=a=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};

function alignedChanges(rowsA,rowsB,sourceTransform,targetTransform,asOfMs){
 const A=[...(rowsA||[])].filter(x=>Number.isFinite(+x.timestamp)&&Number.isFinite(+x.value)&&+x.timestamp<=asOfMs).sort((x,y)=>x.timestamp-y.timestamp);
 const Braw=[...(rowsB||[])].filter(x=>Number.isFinite(+x.timestamp)&&Number.isFinite(+x.value)&&+x.timestamp<=asOfMs).sort((x,y)=>x.timestamp-y.timestamp),B=new Map(Braw.map(x=>[+x.timestamp,+x.value]));
 const common=A.filter(x=>B.has(+x.timestamp)).map(x=>({t:+x.timestamp,a:+x.value,b:B.get(+x.timestamp)}));
 const cadence=median(common.slice(1).map((x,i)=>x.t-common[i].t).filter(x=>x>0));
 const sa=TRANSFORMS[sourceTransform],tb=TRANSFORMS[targetTransform],changes=[];
 for(let i=1;i<common.length;i++){const ac=sa.change(common[i-1].a,common[i].a),bc=tb.change(common[i-1].b,common[i].b);if(Number.isFinite(ac)&&Number.isFinite(bc))changes.push({t:common[i].t,ac,bc})}
 return{common,changes,medianCadenceMs:cadence};
}

const metrics=a=>{const x=(a||[]).map(e=>e.directionalAssociation).filter(Number.isFinite);return{n:x.length,mean:mean(x),median:median(x),hitRate:x.length?x.filter(v=>v>0).length/x.length:NaN}};

export function evaluateProspectiveClock(rowsA,rowsB,rule,opts={}){
 if(!rule||rule.selectionPerformedAfterFreeze!==false)throw Error('prospective rule must explicitly prohibit post-freeze selection');
 const sourceTransform=rule.source?.transform,targetTransform=rule.target?.transform;
 if(!TRANSFORMS[sourceTransform]||!TRANSFORMS[targetTransform])throw Error('unsupported prospective transform');
 const lagBars=Math.max(0,Math.min(90,Math.trunc(+rule.lagBars))),threshold=Math.abs(+rule.source.threshold),sign=rule.direction==='inverse'?-1:1,minResolved=Math.max(1,Math.trunc(+rule.minimumResolvedSignals||20));
 const anchorMs=Date.parse(String(rule.evidenceStartDate)+'T00:00:00Z');if(!Number.isFinite(anchorMs))throw Error('invalid prospective evidenceStartDate');
 const asOfMs=Number.isFinite(+opts.asOfMs)?+opts.asOfMs:Date.now(),{common,changes,medianCadenceMs}=alignedChanges(rowsA,rowsB,sourceTransform,targetTransform,asOfMs);
 const signals=[],resolved=[],pending=[];
 for(let i=0;i<changes.length;i++){
  const x=changes[i];if(x.t<anchorMs||Math.abs(x.ac)<threshold)continue;
  const event={signalAt:new Date(x.t).toISOString().slice(0,10),signalTimestamp:x.t,signalChange:x.ac,signalDirection:x.ac>0?'up':'down',lagBars,direction:rule.direction};
  signals.push(event);
  if(i+lagBars<changes.length){const y=changes[i+lagBars],directional=(x.ac>0?1:-1)*sign*y.bc;resolved.push({...event,targetAt:new Date(y.t).toISOString().slice(0,10),targetTimestamp:y.t,targetChange:y.bc,directionalAssociation:directional,hit:directional>0})}
  else pending.push({...event,barsAvailableAfterSignal:Math.max(0,changes.length-1-i),barsStillNeeded:Math.max(0,lagBars-(changes.length-1-i))});
 }
 const whole=metrics(resolved),mid=Math.floor(resolved.length/2),firstHalf=metrics(resolved.slice(0,mid)),secondHalf=metrics(resolved.slice(mid));
 const sampleFloor=resolved.length>=minResolved&&firstHalf.n>=Math.floor(minResolved/2)&&secondHalf.n>=Math.ceil(minResolved/2);
 const promotionCandidate=!!(sampleFloor&&whole.mean>0&&firstHalf.mean>0&&secondHalf.mean>0);
 const observedLagMs=Number.isFinite(medianCadenceMs)?lagBars*medianCadenceMs:NaN;
 const latestCommon=common.at(-1)?.t??null,postAnchorBars=changes.filter(x=>x.t>=anchorMs).length;
 let status='WAITING_FOR_POST_ANCHOR_DATA';if(postAnchorBars>0)status=resolved.length?'RESOLVED_EVIDENCE_ACCUMULATING':signals.length?'SIGNALS_PENDING_LAG':'POST_ANCHOR_BARS_NO_RESOLVED_SIGNAL';
 if(promotionCandidate)status='PROSPECTIVE_HISTORICAL_CANDIDATE';
 return{
  schema:'JM.ProspectiveClockEvaluation/0.1',ruleSchema:rule.schema,frozenOn:rule.frozenOn,evidenceStartDate:rule.evidenceStartDate,asOf:new Date(asOfMs).toISOString(),predeclared:true,selectionPerformed:false,
  source:rule.source,target:rule.target,lagBars,direction:rule.direction,threshold,minimumResolvedSignals:minResolved,medianCadenceMs,observedLagHours:Number.isFinite(observedLagMs)?observedLagMs/3600000:null,clockBand:clockBand(observedLagMs),
  latestAlignedDate:latestCommon?new Date(latestCommon).toISOString().slice(0,10):null,postAnchorBars,signalCount:signals.length,resolvedCount:resolved.length,pendingCount:pending.length,whole,firstHalf,secondHalf,sampleFloor,promotionCandidate,status,signals,resolved,pending,
  claimBoundary:rule.claimBoundary
 };
}
