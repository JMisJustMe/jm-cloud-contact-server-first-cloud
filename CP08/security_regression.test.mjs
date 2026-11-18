import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'CP08/JM_CLOUD_CONTACT_SERVER_v0_4_3_HARDENING_CANDIDATE.mjs');
const ADMIN='A'.repeat(48),SECRET='S'.repeat(48),ORIGIN='https://jm-cloud-contact-server.onrender.com';
function freePort(){return new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})}
function launch(port,data,origins=ORIGIN){return spawn(process.execPath,[source],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',JM_CLOUD_MODE:'production',JM_CLOUD_ADMIN_TOKEN:ADMIN,JM_CLOUD_SERVER_SECRET:SECRET,JM_CLOUD_ORIGINS:origins,JM_CLOUD_DATA:data},stdio:['ignore','pipe','pipe']})}
function exitCode(child){return new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve(code))})}
async function request(port,method,route,{headers={},body}={}){
 return new Promise((resolve,reject)=>{
  const data=body===undefined?undefined:JSON.stringify(body),h={...headers};
  if(data!==undefined){h['Content-Type']='application/json';h['Content-Length']=Buffer.byteLength(data)}
  const req=http.request({hostname:'127.0.0.1',port,method,path:route,headers:h},r=>{
   const chunks=[];r.on('data',b=>chunks.push(b));r.on('end',()=>{const raw=Buffer.concat(chunks).toString('utf8');let json;try{json=JSON.parse(raw)}catch{json=null}resolve({status:r.statusCode,headers:r.headers,json,raw})})
  });req.on('error',reject);if(data!==undefined)req.write(data);req.end()
 })
}
async function waitReady(port,child){for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('server exited: '+child.exitCode);try{if((await request(port,'GET','/ready')).status===200)return}catch{}await new Promise(r=>setTimeout(r,50))}throw Error('server never ready')}
async function stop(child){if(child.exitCode!==null)return;child.kill('SIGTERM');await Promise.race([exitCode(child),new Promise((_,reject)=>setTimeout(()=>reject(Error('shutdown timeout')),6000))])}
test('CP08 loopback full-server regression, no real keys or deployment',{timeout:30000},async t=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-cc-cp08-')),data=path.join(temp,'test.json'),port=await freePort();
 let p;
 try{
  await t.test('legacy production self origins rejected at startup',async()=>{const bad=launch(await freePort(),data,'self');assert.equal(await exitCode(bad),2)});
  p=launch(port,data);await waitReady(port,p);
  await t.test('health ready meta and hosted console',async()=>{for(const route of ['/health','/ready','/meta','/','/console'])assert.equal((await request(port,'GET',route)).status,200,route);assert.equal((await request(port,'GET','/meta')).json.version,'0.4.3-hc1')});
  await t.test('CORS rejects forged Host/Origin',async()=>{for(const method of ['GET','OPTIONS']){const r=await request(port,method,'/health',{headers:{Host:'evil.example',Origin:'https://evil.example'}});assert.equal(r.headers['access-control-allow-origin'],undefined)}const yes=await request(port,'OPTIONS','/v4/spaces',{headers:{Host:'evil.example',Origin:ORIGIN}});assert.equal(yes.status,204);assert.equal(yes.headers['access-control-allow-origin'],ORIGIN)});
  await t.test('admin bearer missing wrong and different length',async()=>{for(const token of ['', 'bad', 'A'.repeat(48)+'X']){const headers=token?{Authorization:'Bearer '+token}:{};assert.equal((await request(port,'GET','/v4/spaces',{headers})).status,401)}assert.equal((await request(port,'GET','/v4/spaces',{headers:{Authorization:'Bearer '+ADMIN}})).status,200)});
  let member,peer,commandId;
  await t.test('space member event and idempotence',async()=>{const created=await request(port,'POST','/v4/spaces',{headers:{Authorization:'Bearer '+ADMIN},body:{spaceId:'cp08_test',label:'CP08',members:[{id:'phone',capabilities:['event:write']},{id:'peer',capabilities:['command:review']}]}});assert.equal(created.status,201,created.raw);member=created.json.credentials.phone;peer=created.json.credentials.peer;assert.ok(member&&peer);const evt={requestId:'evt01',event:{kind:'source.review',detail:'dummy'}};const first=await request(port,'POST','/v4/spaces/cp08_test/events',{headers:{Authorization:'Bearer '+member},body:evt});assert.equal(first.status,201,first.raw);assert.match(first.json.record.hash,/^[a-f0-9]{64}$/);const repeated=await request(port,'POST','/v4/spaces/cp08_test/events',{headers:{Authorization:'Bearer '+member},body:evt});assert.equal(repeated.status,200);assert.equal(repeated.json.deduplicated,true)});
  await t.test('admin commands peer receipt',async()=>{const cmd=await request(port,'POST','/v4/spaces/cp08_test/commands',{headers:{Authorization:'Bearer '+ADMIN},body:{requestId:'cmd01',action:'review',target:'peer',payload:{task:'test'}}});assert.equal(cmd.status,201,cmd.raw);commandId=cmd.json.command.id;const incoming=await request(port,'GET','/v4/spaces/cp08_test/commands',{headers:{Authorization:'Bearer '+peer}});assert.equal(incoming.status,200);assert.equal(incoming.json.commands.length,1);const ack=await request(port,'POST','/v4/spaces/cp08_test/commands/'+commandId+'/ack',{headers:{Authorization:'Bearer '+peer},body:{status:'accepted'}});assert.equal(ack.status,200);const done=await request(port,'POST','/v4/spaces/cp08_test/commands/'+commandId+'/result',{headers:{Authorization:'Bearer '+peer},body:{ok:true,kind:'RESULT',detail:{status:'reviewed'}}});assert.equal(done.status,200);assert.equal(done.json.command.status,'completed');const receipt=await request(port,'GET','/v4/spaces/cp08_test/receipt',{headers:{Authorization:'Bearer '+ADMIN}});assert.equal(receipt.status,200);assert.match(receipt.json.receipt.serverSig,/^[a-f0-9]{64}$/)});
  await t.test('revoked credential rejected',async()=>{const rev=await request(port,'POST','/v4/spaces/cp08_test/members/phone/revoke',{headers:{Authorization:'Bearer '+ADMIN}});assert.equal(rev.status,200);const evt=await request(port,'POST','/v4/spaces/cp08_test/events',{headers:{Authorization:'Bearer '+member},body:{event:{kind:'after.revoke'}}});assert.equal(evt.status,401)});
  await t.test('persist and recover original room',async()=>{await stop(p);p=null;assert.ok(fs.existsSync(data));p=launch(port,data);await waitReady(port,p);const r=await request(port,'GET','/v4/spaces/cp08_test',{headers:{Authorization:'Bearer '+ADMIN}});assert.equal(r.status,200);assert.ok(r.json.space.eventCount>=4)});
 }finally{if(p)await stop(p).catch(()=>{p.kill('SIGKILL')});fs.rmSync(temp,{recursive:true,force:true})}
});
