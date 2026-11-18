import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';

const reservePort=()=>new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>resolve(port))})});
test('admin-only assessment is read-only and fail-closed', {timeout:15000}, async()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'jm-tbs-'));
  const port=await reservePort();
  const token='jm-test-admin-secret';
  const child=spawn(process.execPath,['JM_CLOUD_CONTACT_SERVER_v0_4_2.mjs'],{cwd:process.cwd(),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',JM_CLOUD_MODE:'development',JM_CLOUD_ADMIN_TOKEN:token,JM_CLOUD_SERVER_SECRET:'jm-test-server-secret',JM_CLOUD_DATA:path.join(dir,'state.json')},stdio:'ignore'});
  try{
    const url='http://127.0.0.1:'+port;
    let ready=false;
    for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error('server exited');try{const r=await fetch(url+'/health');if(r.ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,75))}
    assert.equal(ready,true,'server started');
    const payload={sourceId:'jm:braidge',fromBody:'A',toBody:'B',kind:'branch',traceId:'trace:1',sourceProof:{sourceId:'jm:braidge',verified:true},authority:{granted:true,sourceId:'jm:braidge',fromBody:'A',toBody:'B',kind:'branch',receiptId:'receipt:1'}};
    const unauthorized=await fetch(url+'/v4/tbs/assess',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(unauthorized.status,401);
    const authorized=await fetch(url+'/v4/tbs/assess',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(payload)});
    assert.equal(authorized.status,200);
    const data=await authorized.json();
    assert.equal(data.assessment.state,'PLAN_ONLY');
    assert.equal(data.assessment.allowed,false);
    assert.equal(data.assessment.eligibleForReview,true);
    const spaces=await fetch(url+'/v4/spaces',{headers:{authorization:'Bearer '+token}});
    assert.deepEqual((await spaces.json()).spaces,[]);
  }finally{child.kill('SIGTERM');rmSync(dir,{recursive:true,force:true})}
});
