import {Worker} from 'node:worker_threads';
// One CPU worker, bounded queue, no main-thread fallback: expensive analysis
// cannot occupy the HTTP event loop or grow an unbounded worker population.
export function createAnalysisRunner({timeoutMs=120000,maxQueued=16}={}) {
 let worker=null,active=null,closed=false;
 const queue=[];
 function dispatch(){
  if(closed||active||!queue.length)return;
  if(!worker){
   const current=new Worker(new URL('./JM_MARKET_ANALYSIS_WORKER.mjs',import.meta.url));
   worker=current;
   current.on('message',message=>{
    if(worker!==current||!active)return;
    const job=active;active=null;clearTimeout(job.timer);
    current.unref();
    if(message.ok)job.resolve(message.result);else job.reject(Error(message.error));
    dispatch();
   });
   current.on('error',error=>fail(current,error));
   current.on('exit',code=>fail(current,Error('market analysis worker exited '+code)));
  }
  const current=worker,job=queue.shift();active=job;current.ref();
  job.timer=setTimeout(()=>fail(current,Error('market analysis timed out')),timeoutMs);
  try{current.postMessage({operation:job.operation,args:job.args});}
  catch(error){fail(current,error);}
 }
 function fail(current,error){
  if(worker!==current)return;
  worker=null;current.terminate().catch(()=>{});
  if(active){const job=active;active=null;clearTimeout(job.timer);job.reject(error);}
  dispatch();
 }
 function run(operation,args){
  if(closed)return Promise.reject(Error('market analysis stopped'));
  if(queue.length>=maxQueued)return Promise.reject(Error('market analysis queue full'));
  return new Promise((resolve,reject)=>{queue.push({operation,args,resolve,reject});dispatch();});
 }
 async function close(){
  closed=true;
  for(const job of queue.splice(0))job.reject(Error('market analysis stopped'));
  if(worker){const current=worker;worker=null;if(active){clearTimeout(active.timer);active.reject(Error('market analysis stopped'));active=null;}await current.terminate();}
 }
 return {run,close};
}
const runner=createAnalysisRunner();
export const runMarketAnalysis=runner.run;
