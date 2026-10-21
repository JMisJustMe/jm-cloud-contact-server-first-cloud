// JM Mission 002 — full HTTP gateway → model adapter → durable return proof.
// Provider HTTP responses are mocked; this never calls Google or OpenAI.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startRemainService} from './JM_SOVEREIGN_AGENT_GATEWAY_REMAIN_v0_3.mjs';

const root=await fs.mkdtemp(path.join(os.tmpdir(),'jm-m002-http-'));
const host='127.0.0.1',port=19592,base='http://'+host+':'+port;
const client='m002-readonly-client', human='m002-human-authority';
let live=null;
const providerCalls=[];
const fakeProvider=async(url,opts)=>{
  providerCalls.push({url,method:opts.method,body:JSON.parse(opts.body)});
  if(url.includes('googleapis.com'))return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'Gemini analysis: synthetic evidence'}]}}]})};
  if(url.includes('api.openai.com'))return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'OpenAI synthesis: no action authorised'}]}]})};
  throw new Error('UNKNOWN_PROVIDER');
};
const opts={host,port,dataRoot:root,clientToken:client,authorityToken:human,
  acpEnabled:false,crossAiEnabled:true,geminiKey:'offline-fake',openaiKey:'offline-fake',
  geminiModel:'mock-gemini',openaiModel:'mock-openai',
  crossAiFetchImpl:fakeProvider,durabilityTier:'M002_OFFLINE_HTTP_TEST'};
const req=async(p,method='GET',token=null,body=undefined)=>{
  const headers={};if(token)headers.authorization='Bearer '+token;
  if(body!==undefined)headers['content-type']='application/json';
  const response=await fetch(base+p,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
};
function equalStatus(r,status,why){assert.equal(r.status,status,why+': '+JSON.stringify(r.data));}
const post=(p,t,b)=>req(p,'POST',t,b);
async function stop(){if(live){await new Promise(resolve=>live.server.close(resolve));live=null;}}
try {
  live=await startRemainService(opts);
  const firstHealth=await req('/remain/health');
  equalStatus(firstHealth,200,'health');
  assert.equal(firstHealth.data.crossAi.enabled,true);
  assert.equal(firstHealth.data.crossAi.verified,true);
  const authority={expectedRevision:firstHealth.data.control.revision,expectedDigest:firstHealth.data.control.digest};
  let calls=providerCalls.length;
  equalStatus(await post('/remain/cross-ai/run',null,{taskId:'task-999',...authority}),401,'unauthenticated');
  equalStatus(await post('/remain/cross-ai/run',client,{taskId:'task-999',...authority}),403,'client may not trigger providers');
  assert.equal(providerCalls.length,calls);
  const create=await post('/api/v1/tasks',client,{agent:'jm-cross-ai:gemini>openai',prompt:'Read a made-up world fact and report disagreement'});
  equalStatus(create,201,'task created');
  const id=create.data.task.id;
  const url='/api/v1/tasks/'+encodeURIComponent(id);
  const premature=await post('/remain/cross-ai/run',human,{taskId:id,...authority});
  equalStatus(premature,422,'premature run');
  assert.equal(premature.data.reason,'HUMAN_FINAL_APPROVAL_AND_DISPATCH_REQUIRED');
  assert.equal(providerCalls.length,calls);
  equalStatus(await post(url+'/approve',human,{}),200,'human approval');
  equalStatus(await post('/remain/cross-ai/run',human,{taskId:id,...authority}),422,'not yet dispatched');
  equalStatus(await post(url+'/dispatch',human,{}),200,'human dispatch');
  const stale=await post('/remain/cross-ai/run',human,{taskId:id,expectedRevision:authority.expectedRevision+1,expectedDigest:authority.expectedDigest});
  equalStatus(stale,422,'stale control rejected');
  assert.equal(stale.data.reason,'MAGNIFYING_CONTROL_STALE_OR_UNSAFE');
  assert.equal(providerCalls.length,calls);
  const first=await post('/remain/cross-ai/run',human,{taskId:id,...authority});
  equalStatus(first,200,'two-provider round-trip');
  assert.equal(first.data.status,'COMPLETE');
  assert.equal(first.data.output,'OpenAI synthesis: no action authorised');
  assert.equal(providerCalls.length,calls+2);
  assert.equal(providerCalls.at(-2).url.includes('googleapis.com'),true);
  assert.equal(providerCalls.at(-1).url.includes('openai.com'),true);
  assert.equal(providerCalls.at(-1).body.input.includes('Gemini analysis'),true);
  equalStatus(await req('/remain/cross-ai/status?taskId='+id,'GET',client),403,'client cannot read provider output');
  const result=await req('/remain/cross-ai/status?taskId='+id,'GET',human);
  equalStatus(result,200,'status read');
  assert.equal(result.data.item.outputSha256,first.data.outputSha256);
  assert.equal(result.data.verified,true);
  assert.equal(result.data.item.stages.length,2,'two independent provider stage receipts');
  assert.equal(result.data.item.stages[0].provider,'gemini');
  assert.equal(result.data.item.stages[1].provider,'openai');
  equalStatus(await post('/remain/cross-ai/run',human,{taskId:id,...authority}),200,'idempotent run');
  assert.equal(providerCalls.length,calls+2,'idempotence MUST not bill providers again');

  // Independent reverse-route contact on the same governed service.
  const reverse=await post('/api/v1/tasks',client,{agent:'jm-cross-ai:openai>gemini',prompt:'Another synthetic task'});
  equalStatus(reverse,201,'reverse create');
  const id2=reverse.data.task.id;
  equalStatus(await post('/api/v1/tasks/'+id2+'/approve',human,{}),200,'reverse approve');
  equalStatus(await post('/api/v1/tasks/'+id2+'/dispatch',human,{}),200,'reverse dispatch');
  const beforeReverse=providerCalls.length;
  const reversed=await post('/remain/cross-ai/run',human,{taskId:id2,...authority});
  equalStatus(reversed,200,'reverse contact');
  assert.equal(reversed.data.output,'Gemini analysis: synthetic evidence');
  assert.equal(providerCalls.length,beforeReverse+2);
  assert.ok(providerCalls[beforeReverse].url.includes('openai.com'));
  assert.ok(providerCalls[beforeReverse+1].url.includes('googleapis.com'));

  const beforeRestart=providerCalls.length;
  await stop();
  live=await startRemainService(opts);
  const recovered=await req('/remain/health');
  equalStatus(recovered,200,'restarted health');
  assert.equal(recovered.data.crossAi.startupRecovered,true);
  assert.equal(recovered.data.crossAi.verified,true);
  const again=await post('/remain/cross-ai/run',human,{taskId:id,...authority});
  equalStatus(again,200,'recovered idempotence');
  assert.equal(again.data.status,'IDEMPOTENT_REPLAY');
  assert.equal(again.data.outputSha256,first.data.outputSha256);
  assert.equal(providerCalls.length,beforeRestart,'restart replay must not recall model');
  const parent=await req(url,'GET',client);
  equalStatus(parent,200,'Cading source parent unchanged');
  assert.equal(parent.data.task.status,'READY_FOR_AGENT_ROUTE');
  console.log(JSON.stringify({status:'PASS',scope:'GATEWAY_HTTP_TO_MOCKED_PROVIDER_ROUNDTRIP',routes:2,
    deniedUnauthenticated:true,deniedClientCall:true,heldBeforeApproval:true,heldBeforeDispatch:true,
    heldOnStaleControl:true,providerOrderBothDirections:true,
    receiptsVerified:true,replayNoDuplicateRequests:true,restartRecovery:true,
    cadingTaskStatePreserved:true,realProviderContact:false,providerHttpCalls:providerCalls.length},null,2));
} finally {
  await stop();
  await fs.rm(root,{recursive:true,force:true});
}
