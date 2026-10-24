import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LocalStore } from '../src/local-store.mjs';
import { hmac, receiptCore } from '../src/protocol.mjs';

const cwd = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const token = () => randomBytes(32).toString('hex');
async function makeServer(result) {
  const server = http.createServer((req,res)=>{
    res.writeHead(200, {'content-type':'application/json'});
    res.end(JSON.stringify(result));
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  return {server,url:'http://127.0.0.1:'+server.address().port};
}
function runClient(url,key,missionId,withKey=true){
  return new Promise(resolve=>{
    const env = {...process.env,JM_RELAY_URL:url,JM_PRODUCER_TOKEN:token()};
    if(withKey)env.JM_RECEIPT_KEY=key;else delete env.JM_RECEIPT_KEY;
    const child=spawn(process.execPath,['src/client.mjs','status',missionId],{cwd,env});
    let stdout='',stderr='';
    child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
    child.on('close',code=>resolve({code,stdout,stderr}));
  });
}
async function signedStatus(key){
  const r={id:'mission_000026',job_hash:'a'.repeat(64),status:'PASS',code:'PROBE_OK',artifact:null,revision:0,content_hash:'b'.repeat(64),prev_chain:'GENESIS',chain_hash:'c'.repeat(64)};
  r.sig=await hmac(key,JSON.stringify(receiptCore(r)));
  return {id:r.id,job_hash:r.job_hash,state:'DONE',receipt:r};
}
test('26: empty audit is HOLD, never represented as proven contact',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'jm-c1-audit-'));
  try{const store=new LocalStore(path.join(dir,'local.sqlite'),token());
    assert.equal(store.audit().status,'HOLD');
    assert.ok(store.audit().errors.includes('EMPTY_JOURNAL_NO_CONTACT_PROOF'));
    store.close();
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('27: pending mission status explicitly lacks execution proof',async()=>{
  const key=token();const result=await signedStatus(key);delete result.receipt;result.state='PENDING';
  const {server,url}=await makeServer(result);
  try{const r=await runClient(url,key,result.id);assert.equal(r.code,0);assert.match(r.stdout,/NO_RECEIPT_YET_NOT_EXECUTION_PROOF/);}finally{await new Promise(ok=>server.close(ok));}
});
test('28: valid signed receipt verified by operator status command',async()=>{
  const key=token(),status=await signedStatus(key);const {server,url}=await makeServer(status);
  try{const r=await runClient(url,key,status.id);assert.equal(r.code,0,r.stderr);assert.match(r.stdout,/RECEIPT_SIGNATURE_PASS/);}finally{await new Promise(ok=>server.close(ok));}
});
test('29: modified signed receipt rejected by operator status command',async()=>{
  const key=token(),status=await signedStatus(key);status.receipt.revision=99;const {server,url}=await makeServer(status);
  try{const r=await runClient(url,key,status.id);assert.notEqual(r.code,0);assert.match(r.stderr,/INVALID_RECEIPT_SIGNATURE/);}finally{await new Promise(ok=>server.close(ok));}
});
test('30: a receipt with no local verification key cannot be crowned',async()=>{
  const key=token(),status=await signedStatus(key);const {server,url}=await makeServer(status);
  try{const r=await runClient(url,key,status.id,false);assert.notEqual(r.code,0);assert.match(r.stderr,/MISSING_JM_RECEIPT_KEY/);}finally{await new Promise(ok=>server.close(ok));}
});
test('31: receipt-to-mission hash mismatch cannot pass operator status',async()=>{
  const key=token(),status=await signedStatus(key);status.job_hash='d'.repeat(64);const {server,url}=await makeServer(status);
  try{const r=await runClient(url,key,status.id);assert.notEqual(r.code,0);assert.match(r.stderr,/RECEIPT_STATUS_MISMATCH/);}finally{await new Promise(ok=>server.close(ok));}
});
