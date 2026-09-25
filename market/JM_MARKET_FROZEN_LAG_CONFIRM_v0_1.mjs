import {TRANSFORMS,clockBand} from './JM_MARKET_CLOCK_ENGINE_v0_3.mjs';

const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
const median=a=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function alignedChanges(rowsA,rowsB,sourceTransform,targetTransform){
 const A=[...(rowsA||[])].filter(x=>Number.isFinite(+x.timestamp)&&Number.isFinite(+x.value)).sort((x,y)=>x.timestamp-y.timestamp);
 const Braw=[...(rowsB||[])].filter(x=>Number.isFinite(+x.timestamp)&&Number.isFinite(+x.value)).sort((x,y)=>x.timestamp-y.timestamp),B=new Map(Braw.map(x=>[+x.timestamp,+x.value]));
 const common=A.filter(x=>B.has(+x.timestamp)).map(x=>({t:+x.timestamp,a:+x.value,b:B.get(+x.timestamp)}));
 const cadence=median(common.slice(1).map((x,i)=>x.t-common[i].t).filter(x=>x>0));
 const sa=TRANSFORMS[sourceTransform],tb=TRANSFORMS[targetTransform],changes=[];
 for(let i=1;i<common.length;i++){const ac=sa.change(common[i-1].a,common[i].a),bc=tb.change(common[i-1].b,common[i].b);if(Number.isFinite(ac)&&Number.isFinite(bc))changes.push({t:common[i].t,ac,bc})}
 return{changes,commonCount:common.length,medianCadenceMs:cadence};
}

function evaluate(seg,lag,threshold,sign,targetTransform,frictionBps){
 const assoc=[],paper=[];let hits=0,paperHits=0;
 for(let i=0;i+lag<seg.length;i++){
  const signal=seg[i].ac;if(Math.abs(signal)<threshold)continue;
  const directional=(signal>0?1:-1)*sign*seg[i+lag].bc;assoc.push(directional);if(directional>0)hits++;
  if(TRANSFORMS[targetTransform].paperCompatible){const net=directional-frictionBps/10000;paper.push(net);if(net>0)paperHits++}
 }
 return{n:assoc.length,associationHitRate:assoc.length?hits/assoc.length:NaN,associationMean:mean(assoc),associationMedian:median(assoc),paper:paper.length?{n:paper.length,hitRate:paperHits/paper.length,mean:mean(paper),median:median(paper),frictionBps}:null};
}

export function confirmFrozenLag(rowsA,rowsB,defA,defB,opts={}){
 const lagBars=clamp(Math.trunc(Number.isFinite(+opts.lagBars)?+opts.lagBars:0),0,90),direction=String(opts.direction||'same').toLowerCase()==='inverse'?'inverse':'same',sign=direction==='inverse'?-1:1,threshold=Number.isFinite(+opts.threshold)?Math.abs(+opts.threshold):defA.defaultThreshold,frictionBps=clamp(Number.isFinite(+opts.frictionBps)?+opts.frictionBps:20,0,10000);
 if(!TRANSFORMS[defA.transform]||!TRANSFORMS[defB.transform])throw Error('unsupported transform in frozen lag confirmation');
 const {changes,commonCount,medianCadenceMs}=alignedChanges(rowsA,rowsB,defA.transform,defB.transform);
 if(changes.length<40)throw Error('Need at least 40 aligned changes for frozen confirmation; found '+changes.length);
 const mid=Math.floor(changes.length/2),first=changes.slice(0,mid),second=changes.slice(mid),whole=evaluate(changes,lagBars,threshold,sign,defB.transform,frictionBps),A=evaluate(first,lagBars,threshold,sign,defB.transform,frictionBps),B=evaluate(second,lagBars,threshold,sign,defB.transform,frictionBps),observedLagMs=Number.isFinite(medianCadenceMs)?lagBars*medianCadenceMs:NaN;
 const splitSurvival=whole.associationMean>0&&A.associationMean>0&&B.associationMean>0&&whole.n>=20&&A.n>=10&&B.n>=10;
 const paperSplitSurvival=!!(whole.paper&&A.paper&&B.paper&&whole.paper.mean>0&&A.paper.mean>0&&B.paper.mean>0&&whole.paper.n>=20&&A.paper.n>=10&&B.paper.n>=10);
 return{
  schema:'JM.FrozenLagConfirmation/0.1',predeclared:true,selectionPerformed:false,lagBars,direction,threshold,sourceTransform:defA.transform,targetTransform:defB.transform,sourceUnit:TRANSFORMS[defA.transform].unit,targetUnit:TRANSFORMS[defB.transform].unit,alignedChanges:changes.length,commonPoints:commonCount,medianCadenceMs,observedLagMs,observedLagHours:Number.isFinite(observedLagMs)?observedLagMs/3600000:null,clockBand:clockBand(observedLagMs),whole,firstHalf:A,secondHalf:B,splitSurvival,paperSplitSurvival,
  claimBoundary:'The lag and direction are fixed before contact with this confirmation window. Positive survival in an older non-overlapping window is independent historical confirmation of the frozen rule, not prospective proof, causation, execution evidence, or capital authority.'
 };
}
