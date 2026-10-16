import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {nullField} from '../market/JM_MARKET_NULL_FIELD_v0_1.mjs';
import {createAnalysisRunner} from '../market/JM_MARKET_ANALYSIS_RUNNER.mjs';
const defs={},series={};
for(let j=0;j<7;j++){
 const name='S'+j;defs[name]={transform:'pct_return',defaultThreshold:.005};
 series[name]=Array.from({length:1250},(_,i)=>({timestamp:Date.UTC(2020,0,1)+i*86400000,value:100+Math.sin(i*.13+j)*8+i*.01}));
}
const args=[series,defs,{maxLag:20,familyRounds:8,pairPlacebos:8}],clean=value=>JSON.parse(JSON.stringify(value,(k,v)=>k==='durationMs'?undefined:v));
async function sample(run){
 const server=createServer(async(req,res)=>{
  if(req.url==='/analysis'){try{res.end(JSON.stringify(await run()));}catch(e){res.statusCode=500;res.end(String(e));}}
  else{res.setHeader('content-type','application/json');res.end('{"ready":true}');}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 let running=true;const latencies=[];
 const analysis=fetch(base+'/analysis').then(r=>r.json()).finally(()=>running=false);
 // A scheduled probe becomes ready while the analysis owns the event loop.
 let timerLagMs=0;const scheduled=performance.now();
 const firstProbe=new Promise(resolve=>setTimeout(async()=>{
  timerLagMs=performance.now()-scheduled-10;
  const t=performance.now();assert.equal((await fetch(base+'/ready')).status,200);
  latencies.push(performance.now()-t);resolve();
 },10));
 const checks=(async()=>{await firstProbe;while(running){await new Promise(r=>setTimeout(r,10));const t=performance.now();assert.equal((await fetch(base+'/ready')).status,200);latencies.push(performance.now()-t);}})();
 const result=await analysis;await checks;await new Promise(r=>server.close(r));
 return {result,metrics:{timerLagMs:Math.round(timerLagMs),maxHttpMs:Math.round(Math.max(...latencies)),healthSamples:latencies.length}};
}
const runner=createAnalysisRunner();
try {
 const before=await sample(()=>nullField(...args));
 const after=await sample(()=>runner.run('nullField',args));
 assert.deepEqual(clean(after.result),clean(before.result),'analysis output must remain identical');
 assert(after.metrics.timerLagMs<before.metrics.timerLagMs*.5,'event loop must improve');
 assert(after.metrics.maxHttpMs<1000,'health stays responsive under analysis');
 await assert.rejects(runner.run('unknown',[]),/unknown market analysis/);
 assert.deepEqual(clean(await runner.run('nullField',args)),clean(before.result),'worker survives operation error');
 const timed=createAnalysisRunner({timeoutMs:1});
 await assert.rejects(timed.run('nullField',args),/timed out/);await timed.close();
 const bounded=createAnalysisRunner({maxQueued:1});
 const a=bounded.run('nullField',args),b=bounded.run('nullField',args);
 await assert.rejects(bounded.run('nullField',args),/queue full/);
 await Promise.all([a,b]);await bounded.close();
 await assert.rejects(bounded.run('nullField',args),/stopped/);
 console.log(JSON.stringify({pass:true,before:before.metrics,after:after.metrics,identicalAnalysis:true,failureGates:['unknown-operation','timeout','queue-bound','closed-runner']},null,2));
}finally{await runner.close();}
