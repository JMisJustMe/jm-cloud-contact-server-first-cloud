import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createCrossAiRelay} from './JM_CROSS_AI_RELAY_v0_1.mjs';
const control={revision:19,digest:'correct',authority:{destructive_enabled:false}};
const task=(id,agent='jm-cross-ai:gemini>openai')=>({id,agent,prompt:'Evaluate evidence from a harmless synthetic scenario',approved:true,dispatched:true,status:'READY_FOR_AGENT_ROUTE'});
const args=id=>({taskId:id,approvedTask:task(id),control,expectedRevision:19,expectedDigest:'correct'});
const pathFor=async()=>path.join(await fs.mkdtemp(path.join(os.tmpdir(),'jm-cross-ai-')),'relay.json');
const calls=[];
const mock=async(url,opts)=>{calls.push({url,opts});if(url.includes('googleapis'))return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:'gemini bounded output'}]}}]})};return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'openai final output'}]}]})};};
const make=async(dataPath,extra={})=>createCrossAiRelay({dataPath,enabled:true,geminiKey:'offline-test',openaiKey:'offline-test',geminiModel:'test-gemini',openaiModel:'test-openai',fetchImpl:mock,...extra});
test('disabled fails closed',async()=>{const a=await createCrossAiRelay({dataPath:await pathFor()});assert.equal((await a.run(args('t1'))).reason,'CROSS_AI_DISABLED');});
test('approved task two-provider route, idempotent and restart-recovered',async()=>{
  const p=await pathFor(),a=await make(p),start=calls.length;
  const out=await a.run(args('t1'));assert.equal(out.status,'COMPLETE');assert.equal(out.output,'openai final output');assert.equal(calls.length-start,2);
  assert.equal((await a.run(args('t1'))).status,'IDEMPOTENT_REPLAY');assert.equal(calls.length-start,2);
  assert.equal(a.verify().ok,true);const b=await make(p);assert.equal(b.startupRecovered,true);assert.equal((await b.run(args('t1'))).status,'IDEMPOTENT_REPLAY');
  const forward=calls.slice(start);assert.ok(forward[0].url.includes('googleapis'));assert.ok(forward[1].url.includes('openai.com'));assert.ok(JSON.parse(forward[1].opts.body).input.includes('untrusted evidence'));
});
test('approval, route and stale control hold before network',async()=>{
  const a=await make(await pathFor()),start=calls.length;
  assert.equal((await a.run({...args('t2'),approvedTask:{...task('t2'),approved:false}})).reason,'HUMAN_FINAL_APPROVAL_AND_DISPATCH_REQUIRED');
  assert.equal((await a.run({...args('t3'),approvedTask:task('t3','other-route')})).reason,'TASK_ROUTE_NOT_ALLOWED');
  assert.equal((await a.run({...args('t4'),expectedRevision:18})).reason,'MAGNIFYING_CONTROL_STALE_OR_UNSAFE');
  assert.equal(calls.length,start);
});
test('failed provider leaves durable HOLD and cannot auto retry',async()=>{
  const p=await pathFor();let count=0;
  const a=await make(p,{fetchImpl:async()=>{count++;throw Error('no network');}});
  assert.equal((await a.run(args('t5'))).status,'HOLD');assert.equal(count,1);
  const b=await make(p);assert.equal((await b.run(args('t5'))).reason,'PRIOR_ATTEMPT_REQUIRES_RECONCILIATION');assert.equal(count,1);
});
test('tampered journal is refused during recovery',async()=>{
  const p=await pathFor(),a=await make(p);await a.run(args('t6'));
  const v=JSON.parse(await fs.readFile(p,'utf8'));v.journal[0].status='COMPLETE';await fs.writeFile(p,JSON.stringify(v));
  await assert.rejects(()=>make(p),/CROSS_AI_LEDGER_INVALID/);
});

test('task identity cannot be swapped after result completed',async()=>{
  const p=await pathFor(),a=await make(p),start=calls.length;
  await a.run(args('t8'));assert.equal(calls.length-start,2);
  const changed={...task('t8'),prompt:'Different approved task'};
  assert.equal((await a.run({...args('t8'),approvedTask:changed})).reason,'TASK_IDENTITY_CONFLICT');
  assert.equal(calls.length-start,2);
});
