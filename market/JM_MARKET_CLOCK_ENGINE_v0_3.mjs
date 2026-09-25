const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
const median=a=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};
const corr=(a,b)=>{const n=Math.min(a.length,b.length);if(n<3)return NaN;const A=a.slice(0,n),B=b.slice(0,n),ma=mean(A),mb=mean(B);let u=0,x=0,y=0;for(let i=0;i<n;i++){const da=A[i]-ma,db=B[i]-mb;u+=da*db;x+=da*da;y+=db*db}return x&&y?u/Math.sqrt(x*y):NaN};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const quantile=(a,q)=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),p=(b.length-1)*q,i=Math.floor(p),r=p-i;return b[i+1]===undefined?b[i]:b[i]+r*(b[i+1]-b[i])};
const stats=a=>{const x=(a||[]).filter(Number.isFinite),abs=x.map(Math.abs);return{n:x.length,min:x.length?Math.min(...x):NaN,max:x.length?Math.max(...x):NaN,mean:mean(x),median:median(x),meanAbs:mean(abs),medianAbs:median(abs),p95Abs:quantile(abs,.95),p99Abs:quantile(abs,.99)}};

export const TRANSFORMS={
 pct_return:{label:'percent return',unit:'fraction',paperCompatible:true,change:(a,b)=>a?b/a-1:NaN},
 delta_bps:{label:'basis-point change',unit:'bps',paperCompatible:false,change:(a,b)=>(b-a)*100},
 delta_abs:{label:'absolute change',unit:'native',paperCompatible:false,change:(a,b)=>b-a}
};

export function clockBand(delayMs){
 if(!Number.isFinite(delayMs))return 'UNRESOLVED';
 if(delayMs===0)return 'SAME-BAR';
 if(delayMs<=6*60*60*1000)return 'FAST';
 if(delayMs<=14*24*60*60*1000)return 'MID';
 return 'SLOW';
}

function transformRows(rows,transform){
 const t=TRANSFORMS[transform];if(!t)throw Error('unsupported transform '+transform);
 return [...(rows||[])].filter(x=>Number.isFinite(+x.timestamp)&&Number.isFinite(+x.value)).sort((x,y)=>x.timestamp-y.timestamp);
}

function alignedChanges(rowsA,rowsB,sourceTransform,targetTransform){
 const A=transformRows(rowsA,sourceTransform),Braw=transformRows(rowsB,targetTransform),B=new Map(Braw.map(x=>[+x.timestamp,+x.value]));
 const common=A.filter(x=>B.has(+x.timestamp)).map(x=>({t:+x.timestamp,a:+x.value,b:B.get(+x.timestamp)}));
 const cadence=median(common.slice(1).map((x,i)=>x.t-common[i].t).filter(x=>x>0));
 const sa=TRANSFORMS[sourceTransform],tb=TRANSFORMS[targetTransform],out=[];
 for(let i=1;i<common.length;i++){const ac=sa.change(common[i-1].a,common[i].a),bc=tb.change(common[i-1].b,common[i].b);if(Number.isFinite(ac)&&Number.isFinite(bc))out.push({t:common[i].t,ac,bc})}
 return {changes:out,commonCount:common.length,medianCadenceMs:cadence,sourceChangeStats:stats(out.map(x=>x.ac)),targetChangeStats:stats(out.map(x=>x.bc)),sourceValueStats:stats(common.map(x=>x.a)),targetValueStats:stats(common.map(x=>x.b))};
}

function scanLag(seg,maxLag){
 const out=[];for(let lag=0;lag<=maxLag;lag++){const a=[],b=[];for(let i=0;i+lag<seg.length;i++){a.push(seg[i].ac);b.push(seg[i+lag].bc)}out.push({lag,corr:corr(a,b),n:a.length})}return out;
}

function evaluate(seg,lag,threshold,sign,targetTransform,frictionBps){
 const assoc=[],paper=[];let assocHits=0,paperHits=0;
 for(let i=0;i+lag<seg.length;i++){
  const signal=seg[i].ac;if(Math.abs(signal)<threshold)continue;
  const directional=(signal>0?1:-1)*sign*seg[i+lag].bc;assoc.push(directional);if(directional>0)assocHits++;
  if(TRANSFORMS[targetTransform].paperCompatible){const net=directional-frictionBps/10000;paper.push(net);if(net>0)paperHits++}
 }
 return {
  n:assoc.length,associationHitRate:assoc.length?assocHits/assoc.length:NaN,associationMean:mean(assoc),associationMedian:median(assoc),
  paper:paper.length?{n:paper.length,hitRate:paperHits/paper.length,mean:mean(paper),median:median(paper),frictionBps}:null
 };
}

export function quantifyClock(rowsA,rowsB,opts={}){
 const maxLag=clamp(Math.trunc(Number.isFinite(+opts.maxLag)?+opts.maxLag:12),0,90);
 const sourceTransform=opts.sourceTransform||'pct_return',targetTransform=opts.targetTransform||'pct_return';
 if(!TRANSFORMS[sourceTransform]||!TRANSFORMS[targetTransform])throw Error('unsupported series transform');
 const threshold=Number.isFinite(+opts.threshold)?Math.abs(+opts.threshold):(sourceTransform==='delta_bps'?5:.005);
 const frictionBps=clamp(Number.isFinite(+opts.frictionBps)?+opts.frictionBps:20,0,10000);
 const {changes,commonCount,medianCadenceMs,sourceChangeStats,targetChangeStats,sourceValueStats,targetValueStats}=alignedChanges(rowsA,rowsB,sourceTransform,targetTransform);
 if(changes.length<30)throw Error('Need at least 30 aligned changes; found '+changes.length);
 const n=changes.length,n1=Math.floor(n*.6),n2=Math.floor(n*.8),train=changes.slice(0,n1),validation=changes.slice(n1,n2),test=changes.slice(n2);
 const candidates=scanLag(train,maxLag).filter(x=>Number.isFinite(x.corr)&&x.n>=10).sort((x,y)=>Math.abs(y.corr)-Math.abs(x.corr));
 if(!candidates.length)throw Error('No lag candidate has enough training observations');
 const best=candidates[0],sign=best.corr>=0?1:-1,A=evaluate(train,best.lag,threshold,sign,targetTransform,frictionBps),B=evaluate(validation,best.lag,threshold,sign,targetTransform,frictionBps),C=evaluate(test,best.lag,threshold,sign,targetTransform,frictionBps);
 const observedLagMs=Number.isFinite(medianCadenceMs)?best.lag*medianCadenceMs:NaN;
 const historicalSurvivalCandidate=B.associationMean>0&&C.associationMean>0&&B.n>=10&&C.n>=10;
 const paperSurvivalCandidate=!!(B.paper&&C.paper&&B.paper.mean>0&&C.paper.mean>0&&B.paper.n>=10&&C.paper.n>=10);
 return {
  schema:'JM.MismatchedClockQuantifier/0.3',
  alignedChanges:n,commonPoints:commonCount,selectedOn:'training-only',lagBars:best.lag,trainingCorrelation:best.corr,direction:sign>0?'same':'inverse',
  sourceTransform,targetTransform,sourceUnit:TRANSFORMS[sourceTransform].unit,targetUnit:TRANSFORMS[targetTransform].unit,
  threshold,frictionBps,medianCadenceMs,sourceChangeStats,targetChangeStats,sourceValueStats,targetValueStats,observedLagMs,observedLagHours:Number.isFinite(observedLagMs)?observedLagMs/3600000:null,clockBand:clockBand(observedLagMs),mismatch:best.lag>0,
  train:A,validation:B,test:C,historicalSurvivalCandidate,mismatchedClockCandidate:historicalSurvivalCandidate&&best.lag>0,paperSurvivalCandidate,
  resolutionBoundary:Number.isFinite(medianCadenceMs)&&medianCadenceMs>6*60*60*1000?'Source cadence is too coarse to resolve sub-six-hour propagation.':'Cadence can resolve the reported band at this threshold.',
  transformBoundary:'Rates/yields are measured as basis-point changes; prices, indexes and FX are measured as percentage returns. Association and paper-edge evidence are separate.',
  claimBoundary:'Historical lag survival is a research result only. It does not establish causation, live persistence, executable edge, or capital authority.'
 };
}
