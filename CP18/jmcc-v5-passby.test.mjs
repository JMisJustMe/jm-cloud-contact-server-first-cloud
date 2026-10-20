import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {DominoPassby} from './jmcc-domino-passby.mjs';
import {makeV5Passby,v5ContactRoute} from './jmcc-v5-passby.mjs';
const source=path.resolve(import.meta.dirname,'..'),entry='JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs';
const admin='A'.repeat(48),secret='B'.repeat(48);
async function randomPort(){const s=net.createServer();s.listen(0,'127.0.0.1');await once(s,'listening');const p=s.address().port;await new Promise(r=>s.close(r));return p}
async function call(url,token,method='GET',body){const r=await fetch(url,{method,headers:{authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,result:await r.json()}}
const contact=id=>({schema:'JMCC.DominoContact/1.0',classification:'NON_SENSITIVE',id,mission:'JMCC_CP18',route:'CP18_JM_SIGNED',payload:'non-sensitive synthetic server contact',source:'OWNER',ownerApproved:true,autonomousSpend:false,storeCredentials:false,issuedAt:new Date(Date.now()-10000).toISOString(),expiresAt:new Date(Date.now()+120000).toISOString()});
test('CP18 default OFF; pinned production signer; loopback gate',()=>{
 assert.throws(()=>makeV5Passby({}),/JM_V5_PORT_DISABLED/);
 assert.throws(()=>makeV5Passby({enabled:true,baseUrl:'http://example.com/',spaceId:'s',memberToken:admin,adminToken:secret}),/PRODUCTION_REQUIRES_HTTPS/);
 assert.throws(()=>makeV5Passby({enabled:true,baseUrl:'https://example.com/',spaceId:'s',memberToken:admin,adminToken:secret}),/PINNED_SERVER_SIGNER_REQUIRED/);
 assert.throws(()=>makeV5Passby({enabled:true,testMode:true,baseUrl:'http://localhost:77/',spaceId:'s',memberToken:admin,adminToken:secret}),/TEST_SERVER_REQUIRES_LOOPBACK/);
});
test('CP18 real inherited V5: signed contact + exactly once/replay/tamper gates', {timeout:25000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jmcc-gh-cp18-')),port=await randomPort(),root='http://127.0.0.1:'+port;
 const proc=spawn(process.execPath,[path.join(source,entry)],{cwd:source,env:{...process.env,HOST:'127.0.0.1',PORT:String(port),JM_CLOUD_MODE:'development',JM_CLOUD_ORIGINS:'*',JM_CLOUD_ADMIN_TOKEN:admin,JM_CLOUD_SERVER_SECRET:secret,JM_CLOUD_DATA:path.join(dir,'state.json'),JM_CLOUD_PROFILE_DIR:path.join(source,'profiles'),JM_CLOUD_PROFILE_MANIFEST:path.join(source,'profiles','JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json'),JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(dir,'identity.pem'),JM_MARKET_PULSE_ENABLED:'0',JM_MARKET_DATABASE_URL:''},stdio:['ignore','pipe','pipe']});
 let err='';proc.stderr.on('data',x=>err+=x);
 try{
  let ready=false;for(let i=0;i<80;i++){try{if((await call(root+'/ready','')).status===200){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,60))}assert.ok(ready,'not ready: '+err);
  const newSpace=await call(root+'/v5/spaces',admin,'POST',{spaceId:'cp18_ci_space',members:[{id:'passby',capabilities:['event:write']}]});
  assert.equal(newSpace.status,201);
  const member=newSpace.result.credentials.passby;
  const portV5=makeV5Passby({enabled:true,testMode:true,baseUrl:root+'/',spaceId:'cp18_ci_space',memberToken:member,adminToken:admin});
  const router=new DominoPassby({journalDir:path.join(dir,'journal'),routes:[v5ContactRoute],ports:{jmV5:portV5},enabled:true});
  const c=contact('cp18_ci_contact');
  const first=await router.run(c);assert.equal(first.status,'COMPLETE');
  assert.equal((await router.run(c)).replayed,true);
  const state=(await call(root+'/v5/spaces/cp18_ci_space',admin)).result.space;
  const events=state.events.filter(x=>x.event.type==='jmcc.domino.passby');
  assert.equal(events.length,1);assert.equal(events[0].memberId,'passby');
  const falsePin=makeV5Passby({enabled:true,testMode:true,baseUrl:root+'/',spaceId:'cp18_ci_space',memberToken:member,adminToken:admin,expectedPublicKeyId:'WRONG'});
  assert.equal(await falsePin.verify({stage:v5ContactRoute.stages[0],contact:c,ack:{eventHash:events[0].hash,requestId:events[0].event.requestId,contactHash:events[0].event.contactHash,contactId:c.id,stageId:'JM_AUTHORITATIVE_EVENT'}}),false);
  await assert.rejects(router.run({...c,payload:'changed'}),/ID_COLLISION_OR_TAMPER/);
  assert.ok(!fs.readFileSync(path.join(dir,'journal','cp18_ci_contact.jsonl'),'utf8').includes(member));
 }finally{proc.kill('SIGTERM');await Promise.race([once(proc,'exit').catch(()=>{}),new Promise(r=>setTimeout(r,2000))]);fs.rmSync(dir,{recursive:true,force:true})}
});
