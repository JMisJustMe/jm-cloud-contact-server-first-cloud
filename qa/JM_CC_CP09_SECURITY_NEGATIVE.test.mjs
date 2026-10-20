import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import http from 'node:http';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SOURCE=path.join(root,'JM_CLOUD_CONTACT_SERVER_v0_5_2_SECURITY_CANDIDATE.mjs');
const GOOD='https://jm-cloud-contact-server-v05.onrender.com',ADMIN='A'.repeat(48),SECRET='S'.repeat(48);
async function port(){return new Promise((ok,no)=>{const s=net.createServer();s.once('error',no);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p))})})}
function child(p,dir,origin=GOOD){return spawn(process.execPath,[SOURCE],{cwd:root,env:{...process.env,PORT:String(p),HOST:'127.0.0.1',JM_CLOUD_MODE:'production',JM_CLOUD_ORIGINS:origin,JM_CLOUD_ADMIN_TOKEN:ADMIN,JM_CLOUD_SERVER_SECRET:SECRET,JM_CLOUD_DATA:path.join(dir,'data.json'),JM_CLOUD_PROFILE_DIR:path.join(root,'profiles'),JM_CLOUD_PROFILE_MANIFEST:path.join(root,'profiles','JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json'),JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(dir,'signing.pem')},stdio:['ignore','pipe','pipe']})}
const ended=c=>new Promise((ok,no)=>{if(c.exitCode!==null)return ok(c.exitCode);c.once('error',no);c.once('exit',ok)});
async function httpReq(p,method,url,headers={}){return new Promise((ok,no)=>{const q=http.request({host:'127.0.0.1',port:p,method,path:url,headers},r=>{const chunks=[];r.on('data',b=>chunks.push(b));r.on('end',()=>{const raw=Buffer.concat(chunks).toString();let body;try{body=JSON.parse(raw)}catch{body=null}ok({status:r.statusCode,headers:r.headers,body})})});q.on('error',no);q.end()})}
async function wait(p,c){for(let i=0;i<100;i++){if(c.exitCode!==null)throw Error('server exited '+c.exitCode);try{const r=await httpReq(p,'GET','/ready');if(r.status===200)return r}catch{}await new Promise(ok=>setTimeout(ok,50))}throw Error('not ready')}
async function stop(c){if(c.exitCode!==null)return;c.kill('SIGTERM');await Promise.race([ended(c),new Promise((_,no)=>setTimeout(()=>no(Error('stop timeout')),6000))])}
test('CP09 production-mode negative regression on actual v5 descendant',{timeout:30000},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jm-cp09-'));let c=null;
 try{
  await t.test('production rejects self wildcard and HTTP origins',async()=>{for(const origin of ['self','*','http://localhost:9090']){const tmp=child(await port(),dir,origin);assert.equal(await ended(tmp),2,origin)}});
  const p=await port();c=child(p,dir);const ready=await wait(p,c);
  await t.test('ready, mounted v5 and meta version',async()=>{assert.equal(ready.status,200);assert.equal(ready.body.ready,true,JSON.stringify(ready.body));const h=await httpReq(p,'GET','/health');assert.equal(h.status,200);assert.equal(h.body.version,'0.5.2-hc1');const m=await httpReq(p,'GET','/meta');assert.deepEqual(m.body.apiRoots,['/v5','/v4','/v3'])});
  await t.test('forged hostile Host and Origin cannot earn ACAO',async()=>{for(const method of ['GET','OPTIONS']){const q=await httpReq(p,method,'/health',{Host:'evil.example',Origin:'https://evil.example'});assert.equal(q.headers['access-control-allow-origin'],undefined,method)}});
  await t.test('canonical origin accepted even with hostile Host',async()=>{const q=await httpReq(p,'OPTIONS','/v5/spaces',{Host:'evil.example',Origin:GOOD});assert.equal(q.status,204);assert.equal(q.headers['access-control-allow-origin'],GOOD)});
  await t.test('malformed and opaque origins are refused',async()=>{for(const origin of ['null',GOOD+'/foo','http://jm-cloud-contact-server-v05.onrender.com','https://jm-cloud-contact-server-v05.onrender.com.evil.example']){const q=await httpReq(p,'GET','/health',{Origin:origin});assert.equal(q.headers['access-control-allow-origin'],undefined,origin)}});
  await t.test('admin bearer credentials required',async()=>{for(const auth of ['', 'Bearer WRONG','Bearer '+ADMIN+'X']){const h=auth?{Authorization:auth}:{};const q=await httpReq(p,'GET','/v5/spaces',h);assert.equal(q.status,401)}const ok=await httpReq(p,'GET','/v5/spaces',{Authorization:'Bearer '+ADMIN});assert.equal(ok.status,200)});
  await t.test('v5, v4, v3 keep protected list semantics',async()=>{for(const ver of ['v5','v4','v3']){const q=await httpReq(p,'GET','/'+ver+'/spaces',{Authorization:'Bearer '+ADMIN});assert.equal(q.status,200,ver)}});
 }finally{if(c)await stop(c).catch(()=>c.kill('SIGKILL'));fs.rmSync(dir,{recursive:true,force:true})}
});
