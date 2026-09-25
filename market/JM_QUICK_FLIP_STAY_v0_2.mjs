const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;

const normalize=x=>{
 if(!x?.ok)return null;
 if(x.estateDecision&&x.candidate)return{estateDecision:x.estateDecision,candidate:x.candidate};
 if(x.verdict&&x.candidate)return{estateDecision:x,candidate:x.candidate};
 return null;
};

export function classifyQuickFlipStay(scans=[]){
 const ok=scans.map(normalize).filter(Boolean);
 const verdicts=ok.map(x=>x.estateDecision.verdict);
 const worth=verdicts.filter(x=>x==='PAPER_CANDIDATE').length;
 const nets=ok.map(x=>+x.candidate.netBps).filter(Number.isFinite);
 const routes=ok.map(x=>x.candidate.route).filter(Boolean);
 const sameRoute=routes.length>0&&routes.every(x=>x===routes[0]);
 let status='NO CONTACT';
 if(ok.length){
   if(worth===ok.length)status='STAYED THERE';
   else if(worth>0)status='FLICKERED';
   else status='NEVER THERE';
 }
 return{
   schema:'JM.QuickFlipStay/0.2',
   completed:ok.length,
   worthCount:worth,
   status,
   sameRoute,
   route:sameRoute?routes[0]:null,
   firstNetBps:nets[0]??null,
   lastNetBps:nets.at(-1)??null,
   averageNetBps:mean(nets),
   minNetBps:nets.length?Math.min(...nets):null,
   maxNetBps:nets.length?Math.max(...nets):null,
   verdicts,
   capitalBoundary:'Persistence check only. STAYED THERE means the paper condition survived the requested snapshots; it is not a recommendation, fill guarantee, or money Ding.'
 };
}
