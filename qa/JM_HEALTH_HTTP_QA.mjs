import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const clean=v=>JSON.parse(JSON.stringify(v,(k,x)=>k==='durationMs'?undefined:x));
async function test(cwd,port){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jm-health-'));
 const child=spawn(process.execPath,['--import',path.resolve('qa/JM_HEALTH_HISTORY_FIXTURE.mjs'),'JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs'],{cwd,env:{...process.env,PORT:String(port),JM_CLOUD_ADMIN_TOKEN:'local-qa-admin',JM_CLOUD_SERVER_SECRET:'local-qa-secret',JM_CLOUD_MODE:'development',JM_MARKET_PULSE_ENABLED:'0',JM_CLOUD_DATA:path.join(dir,'cloud.json'),JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(dir,'key.pem')},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 const base='http://127.0.0.1:'+port;
 try{
  let ready=false;for(let i=0;i<100;i++){try{ready=(await fetch(base+'/ready')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,20));}
  assert(ready,logs);
  const cmd=fs.readFileSync(path.join(cwd,'deploy/Dockerfile'),'utf8').split('\n').find(x=>x.startsWith('HEALTHCHECK ')).split(' CMD ')[1];
  const containerProbeExit=spawnSync('sh',['-c',cmd],{env:{...process.env,PORT:String(port)}}).status;
  let done=false;
  const analysis=fetch(base+'/market/v1/clock-null-field?from=2020-01-01&to=2024-01-01&familyRounds=8&pairPlacebos=8').then(async r=>{assert.equal(r.status,200);return r.json();}).finally(()=>done=true);
  await new Promise(r=>setTimeout(r,50));
  const samples=[];
  do{const t=performance.now();const r=await fetch(base+'/ready',{signal:AbortSignal.timeout(15000)});assert.equal(r.status,200);samples.push(performance.now()-t);await new Promise(r=>setTimeout(r,50));}while(!done);
  const result=await analysis;
  return {result,metrics:{maxReadyMs:Math.round(Math.max(...samples)),samples:samples.length,containerProbeExit}};
 }finally{const exit=once(child,'exit');child.kill('SIGTERM');await exit;fs.rmSync(dir,{recursive:true,force:true});}
}
const baseline=process.argv[2];assert(baseline,'Pass exact baseline checkout directory');
const before=await test(path.resolve(baseline),19081),after=await test(process.cwd(),10000);
assert.deepEqual(clean(after.result),clean(before.result));
assert.equal(before.metrics.containerProbeExit,1);
assert.equal(after.metrics.containerProbeExit,0);
assert(after.metrics.maxReadyMs<1000);
assert(after.metrics.maxReadyMs<before.metrics.maxReadyMs*.5);
console.log(JSON.stringify({pass:true,scope:'actual hosted server HTTP routes with synthetic FRED input',before:before.metrics,after:after.metrics,identicalAnalysis:true},null,2));
