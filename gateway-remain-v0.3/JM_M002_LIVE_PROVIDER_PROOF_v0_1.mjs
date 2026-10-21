// JM M002 owner-initiated real-provider smoke. No scheduling or private prompts.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {startRemainService} from './JM_SOVEREIGN_AGENT_GATEWAY_REMAIN_v0_3.mjs';

if(process.env.JM_LIVE_PROOF_APPROVED!=='I_APPROVE_ONE_TWO_PROVIDER_API_EXCHANGE')
  throw Error('HOLD_EXPLICIT_OWNER_APPROVAL_REQUIRED');
if(!process.env.JM_OPENAI_API_KEY||!process.env.JM_GEMINI_API_KEY)
  throw Error('HOLD_TWO_PROVIDER_KEYS_REQUIRED');
const openaiModel=process.env.JM_OPENAI_MODEL||'gpt-4o-mini';
const geminiModel=process.env.JM_GEMINI_MODEL||'gemini-3.1-flash-lite';
if(!/^[a-zA-Z0-9._-]{1,100}$/.test(openaiModel)||!/^[a-zA-Z0-9._-]{1,100}$/.test(geminiModel))
  throw Error('HOLD_INVALID_MODEL_IDENTIFIER');
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'jm-m002-live-'));
const client='jm-live-client-'+Math.random().toString(36).slice(2);
const authority='jm-live-human-'+Math.random().toString(36).slice(2);
const host='127.0.0.1',port=19761,base='http://'+host+':'+port;
let service=null,count=0;
const contacts=[];
const measuredFetch=async(url,opts)=>{
  const provider=url.startsWith('https://generativelanguage.googleapis.com/v1beta/models/')?'gemini':
    url==='https://api.openai.com/v1/responses'?'openai':null;
  if(!provider)throw Error('HOLD_OUTBOUND_DOMAIN_NOT_ALLOWED');
  if(++count>2)throw Error('HOLD_LIVE_PROVIDER_REQUEST_CAP');
  contacts.push(provider);
  return fetch(url,opts);
};
const opts={host,port,dataRoot:dir,clientToken:client,authorityToken:authority,acpEnabled:false,
  crossAiEnabled:true,geminiKey:process.env.JM_GEMINI_API_KEY,openaiKey:process.env.JM_OPENAI_API_KEY,
  geminiModel,openaiModel,crossAiFetchImpl:measuredFetch,crossAiTimeoutMs:15000,
  durabilityTier:'JM_EPHEMERAL_ISOLATED_CI_LIVE_PROOF'};
async function req(p,method='GET',token=null,body){
  const headers={};if(token)headers.authorization='Bearer '+token;
  if(body!==undefined)headers['content-type']='application/json';
  const response=await fetch(base+p,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  return {status:response.status,data:await response.json()};
}
const post=(p,t,b)=>req(p,'POST',t,b);
const sha=t=>createHash('sha256').update(t).digest('hex');
async function close(){if(service){await new Promise(resolve=>service.server.close(resolve));service=null;}}
try{
  service=await startRemainService(opts);
  const health=await req('/remain/health');assert.equal(health.status,200);
  const control=health.data.control;
  const created=await post('/api/v1/tasks',client,{
    agent:'jm-cross-ai:gemini>openai',
    prompt:'Public synthetic test: A fictional planet has three blue moons. Answer in one concise sentence, state this is fictional, and do not perform actions.'
  });
  assert.equal(created.status,201);
  const id=created.data.task.id;
  assert.equal((await post('/api/v1/tasks/'+id+'/approve',authority,{})).status,200);
  assert.equal((await post('/api/v1/tasks/'+id+'/dispatch',authority,{})).status,200);
  const body={taskId:id,expectedRevision:control.revision,expectedDigest:control.digest};
  const output=await post('/remain/cross-ai/run',authority,body);
  if(output.status!==200||output.data.status!=='COMPLETE'){
    console.log(JSON.stringify({status:'HOLD',reason:output.data.reason||output.data.error||'LIVE_EXCHANGE_INCOMPLETE',providerRequests:count}));
    process.exitCode=2;
  }else{
    assert.deepEqual(contacts,['gemini','openai']);
    assert.equal(service.crossAi.verify().ok,true);
    const original=await req('/remain/cross-ai/status?taskId='+id,'GET',authority);
    assert.equal(original.status,200);
    assert.equal(original.data.item.stages.length,2);
    assert.equal(sha(output.data.output),output.data.outputSha256);
    const prior=count;
    await close();
    service=await startRemainService(opts);
    const replay=await post('/remain/cross-ai/run',authority,body);
    assert.equal(replay.status,200);
    assert.equal(replay.data.status,'IDEMPOTENT_REPLAY');
    assert.equal(replay.data.outputSha256,output.data.outputSha256);
    assert.equal(count,prior,'No duplicated billable request allowed after restart');
    const checked=service.crossAi.verify();assert.equal(checked.ok,true);
    const summary={scope:'JM_M002_REAL_PROVIDER_PROOF',status:'PASS',providerOrder:contacts,
      providerRequests:count,outputSha256:output.data.outputSha256,receiptHead:checked.headHash,
      stages:original.data.item.stages,restartRecovery:true,duplicateExternalRequests:false,
      environment:'ISOLATED_GITHUB_ACTIONS',dataDisclosure:'PUBLIC_SYNTHETIC_ONLY',
      billing:'EXTERNAL_PROVIDER_ACCOUNT_BOUNDARY',existingServiceModified:false};
    console.log(JSON.stringify(summary,null,2));
    if(process.env.GITHUB_STEP_SUMMARY)await fs.appendFile(process.env.GITHUB_STEP_SUMMARY,
      '## JM M002 real-provider proof\n\n- Result: PASS\n- Route: Gemini to OpenAI\n'+
      '- Output digest: '+summary.outputSha256+'\n- Receipt digest: '+summary.receiptHead+
      '\n- Restart and idempotence: PASS\n- No private data or automated external actions\n');
  }
}finally{
  await close();
  await fs.rm(dir,{recursive:true,force:true});
}
