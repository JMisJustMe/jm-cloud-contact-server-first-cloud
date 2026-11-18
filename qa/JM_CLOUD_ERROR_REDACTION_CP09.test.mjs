/**
 * JM Cloud Contact CP09 — original server error boundary.
 * Isolated loopback-only test: dummy credentials, temporary state and key paths.
 * It does not contact Render or the owner's phones.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'JM_CLOUD_CONTACT_SERVER_v0_4_2.mjs');
const expectedVersion='0.4.2';
const admin='A'.repeat(48), secret='S'.repeat(48);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freePort(){
  const s=net.createServer();
  await new Promise((resolve,reject)=>s.once('error',reject).listen(0,'127.0.0.1',resolve));
  const port=s.address().port;
  await new Promise(resolve=>s.close(resolve));
  return port;
}
test('original Cloud Contact '+expectedVersion+' masks internal exceptions without breaking established routes',{timeout:25000},async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-cloud-cp09-'));
  const port=await freePort();
  const base='http://127.0.0.1:'+port;
  const env={...process.env,HOST:'127.0.0.1',PORT:String(port),JM_CLOUD_MODE:'development',
    JM_CLOUD_ADMIN_TOKEN:admin,JM_CLOUD_SERVER_SECRET:secret,JM_CLOUD_ORIGINS:'*',
    JM_CLOUD_DATA:path.join(tmp,'data.json'),JM_CLOUD_PUBLIC:path.join(root,'public'),
    JM_CLOUD_PROFILE_DIR:path.join(root,'profiles'),
    JM_CLOUD_PROFILE_MANIFEST:path.join(root,'profiles/JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json'),
    JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(tmp,'signing.pem'),
    JM_GAME_DATA:path.join(tmp,'game.json'),JM_SERVICE_MESH_DATA:path.join(tmp,'mesh.json'),
    JM_MARKET_DATA:path.join(tmp,'market.json'),JM_ZEZU_HISTORY_DATA:path.join(tmp,'zezu.json')};
  const child=spawn(process.execPath,[source],{cwd:root,env,stdio:['ignore','pipe','pipe']});
  let stderr='';
  child.stderr.on('data',v=>{stderr=(stderr+v.toString()).slice(-1600)});
  child.stdout.on('data',()=>{});
  try {
    let ready=false;
    for(let attempt=0;attempt<90;attempt++){
      if(child.exitCode!==null)throw Error('local fixture did not start');
      try{const r=await fetch(base+'/health',{signal:AbortSignal.timeout(1000)});if(r.ok){ready=true;break}}catch{}
      await sleep(100);
    }
    assert.ok(ready,'original local service starts');
    const meta=await fetch(base+'/meta');
    assert.equal(meta.status,200);
    const identity=await meta.json();
    assert.equal(identity.version,expectedVersion,'original version preserved');
    const unauthorized=await fetch(base+'/v4/spaces');
    assert.equal(unauthorized.status,401,'original administrative boundary preserved');
    const malformedRoute=await fetch(base+'/v4/%E0%A4%A');
    assert.equal(malformedRoute.status,400);
    const deniedRoute=await malformedRoute.json();
    assert.deepEqual(deniedRoute,{ok:false,error:'request rejected'},'decoding failure is not returned to caller');
    const malformedBody=await fetch(base+'/v4/spaces',{method:'POST',
      headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json'},
      body:'{"broken":'});
    assert.equal(malformedBody.status,400);
    const deniedBody=await malformedBody.json();
    assert.deepEqual(deniedBody,{ok:false,error:'request rejected'},'JSON parsing details not returned');
    for(const response of [deniedRoute,deniedBody]){
      const output=JSON.stringify(response);
      assert.doesNotMatch(output,/URI malformed|invalid json|node:internal|\/app\/|\.mjs:\d+/i);
    }
  } finally {
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(2500)]);
    if(child.exitCode===null)child.kill('SIGKILL');
    fs.rmSync(tmp,{recursive:true,force:true});
  }
});
