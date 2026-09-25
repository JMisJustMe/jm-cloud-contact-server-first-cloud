const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:NaN;
const median=a=>{if(!a.length)return NaN;const b=[...a].sort((x,y)=>x-y),m=Math.floor(b.length/2);return b.length%2?b[m]:(b[m-1]+b[m])/2};
const corr=(a,b)=>{const n=Math.min(a.length,b.length);if(n<3)return NaN;const A=a.slice(0,n),B=b.slice(0,n),ma=mean(A),mb=mean(B);let u=0,x=0,y=0;for(let i=0;i<n;i++){const da=A[i]-ma,db=B[i]-mb;u+=da*db;x+=da*da;y+=db*db}return x&&y?u/Math.sqrt(x*y):NaN};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const ret=(a,b)=>a?b/a-1:NaN;

export function clockBand(delayMs){
 if(!Number.isFinite(delayMs))return 'UNRESOLVED';
 if(delayMs===0)return 'SAME-BAR';
 if(delayMs<=6*60*60*1000)return 'FAST';
 if(delayMs<=14*24*60*60*1000)return 'MID';
 return 'SLOW';
}

function alignReturns(rowsA,rowsB){
 const A=[...(rowsA||[])].filter(x=>Number.isFinite(+x.timestamp)&&Number.isFinite(+x.value)).sort((x,y)=>x.timestamp-y.timestamp);
 const B=new Map([...(rowsB||[])].filter(x=>Number.isFinite(+x.timestamp)&&Number.isFinite(+x.value)).map(x=>[+x.timestamp,+x.value]));
 const common=A.filter(x=>B.has(+x.timestamp)).map(x=>({t:+x.timestamp,a:+x.value,b:B.get(+x.timestamp)}));
 const cadence=median(common.slice(1).map((x,i)=>x.t-common[i].t).filter(x=>x>0));
 const out=[];for(let i=1;i<common.length;i++){const ar=ret(common[i-1].a,common[i].a),br=ret(common[i-1].b,common[i].b);if(Number.isFinite(ar)&&Number.isFinite(br))out.push({t:common[i].t,ar,br})}
 return {returns:out,commonCount:common.length,medianCadenceMs:cadence};
}

function scanLag(seg,maxLag){
 const out=[];
 for(let lag=0;lag<=maxLag;lag++){
  const a=[],b=[];
  for(let i=0;i+lag<seg.length;i++){a.push(seg[i].ar);b.push(seg[i+lag].br)}
  out.push({lag,corr:corr(a,b),n:a.length});
 }
 return out;
}

function evaluate(seg,lag,threshold,frictionBps,sign){
 const p=[];let hits=0;
 for(let i=0;i+lag<seg.length;i++){
  const signal=seg[i].ar;
  if(Math.abs(signal)<threshold)continue;
  const raw=(signal>0?1:-1)*sign*seg[i+lag].br;
  const net=raw-frictionBps/10000;
  p.push(net);if(net>0)hits++;
 }
 return {n:p.length,hitRate:p.length?hits/p.length:NaN,mean:mean(p),median:median(p)};
}

export function quantifyClock(rowsA,rowsB,opts={}){
 const maxLag=clamp(Math.trunc(+opts.maxLag||12),0,90);
 const thresholdPct=clamp(Number.isFinite(+opts.thresholdPct)?+opts.thresholdPct:.5,0,100);
 const frictionBps=clamp(Number.isFinite(+opts.frictionBps)?+opts.frictionBps:20,0,10000);
 const {returns,commonCount,medianCadenceMs}=alignReturns(rowsA,rowsB);
 if(returns.length<30)throw Error('Need at least 30 aligned returns; found '+returns.length);
 const n=returns.length,n1=Math.floor(n*.6),n2=Math.floor(n*.8),train=returns.slice(0,n1),validation=returns.slice(n1,n2),test=returns.slice(n2);
 const candidates=scanLag(train,maxLag).filter(x=>Number.isFinite(x.corr)&&x.n>=10).sort((x,y)=>Math.abs(y.corr)-Math.abs(x.corr));
 if(!candidates.length)throw Error('No lag candidate has enough training observations');
 const best=candidates[0],sign=best.corr>=0?1:-1,threshold=thresholdPct/100;
 const A=evaluate(train,best.lag,threshold,frictionBps,sign),B=evaluate(validation,best.lag,threshold,frictionBps,sign),C=evaluate(test,best.lag,threshold,frictionBps,sign);
 const observedLagMs=Number.isFinite(medianCadenceMs)?best.lag*medianCadenceMs:NaN;
 const promotion=B.mean>0&&C.mean>0&&B.n>=10&&C.n>=10;
 return {
  schema:'JM.MismatchedClockQuantifier/0.1',
  alignedReturns:n,
  commonPoints:commonCount,
  selectedOn:'training-only',
  lagBars:best.lag,
  trainingCorrelation:best.corr,
  direction:sign>0?'same':'inverse',
  medianCadenceMs,
  observedLagMs,
  observedLagHours:Number.isFinite(observedLagMs)?observedLagMs/3600000:null,
  clockBand:clockBand(observedLagMs),
  mismatch:best.lag>0,
  thresholdPct,
  frictionBps,
  train:A,
  validation:B,
  test:C,
  historicalSurvivalCandidate:promotion,
  mismatchedClockCandidate:promotion&&best.lag>0,
  resolutionBoundary:Number.isFinite(medianCadenceMs)&&medianCadenceMs>6*60*60*1000?'Source cadence is too coarse to resolve sub-six-hour propagation.':'Cadence can resolve the reported band at this threshold.',
  claimBoundary:'Historical lag survival is a research result only. It does not establish causation, live persistence, executable edge, or capital authority.'
 };
}
