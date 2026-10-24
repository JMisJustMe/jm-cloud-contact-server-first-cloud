// CP-C5: ACTUAL v0.5 server source, isolated localhost + ephemeral test keys.
// Exercises only the optional new digest fields. No external network or credentials.
import {spawn} from 'node:child_process';
import {createHash,randomBytes,createPublicKey,verify as verifySig} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
const sha=x=>createHash('sha256').update(x).digest('hex');
const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=mkdtempSync(path.join(tmpdir(),'jm-c5-real-server-'));
const admin=randomBytes(32).toString('hex'),secret=randomBytes(32).toString('hex');
const port=await new Promise((ok,no)=>{const s=createServer();s.once('error',no);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>ok(p));});});
const base='http://127.0.0.1:'+port;
const env={...process.env,PORT:String(port),HOST:'127.0.0.1',JM_CLOUD_MODE:'development',JM_CLOUD_ADMIN_TOKEN:admin,JM_CLOUD_SERVER_SECRET:secret,JM_CLOUD_ORIGINS:'*',JM_CLOUD_CONTACT_POSTGRES_URL:'',JM_CLOUD_DATA:path.join(tmp,'data.json'),JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(tmp,'signing.pem'),JM_CLOUD_PROFILE_DIR:path.join(root,'profiles'),JM_CLOUD_PROFILE_MANIFEST:path.join(root,'profiles','JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json')};
const child=spawn(process.execPath,[path.join(root,'JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs')],{cwd:root,env,stdio:['ignore','ignore','pipe']});
let stderr='';child.stderr.on('data',d=>{if(stderr.length<4000)stderr+=d;});
async function call(route,{method='GET',token,body}={}){
 const headers={};if(token)headers.authorization='Bearer '+token;if(body!==undefined)headers['content-type']='application/json';
 const response=await fetch(base+route,{method,headers,redirect:'error',signal:AbortSignal.timeout(4000),...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json();return {status:response.status,data};
}
async function ready(){
 for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error('server exited: '+stderr.slice(0,300));try{const r=await call('/health');if(r.status===200)return;}catch{}await new Promise(r=>setTimeout(r,100));}
 throw Error('actual server did not start: '+stderr.slice(0,300));
}
const checks=[];
function record(name){checks.push(name);}
try{
 await ready();
 let r=await call('/ready');assert.equal(r.status,200);assert.equal(r.data.ready,true);record('actual-v05-ready');
 const space='qa_c5_'+randomBytes(8).toString('hex'),member='probe_runner';
 r=await call('/v5/spaces',{method:'POST',token:admin,body:{spaceId:space,label:'CP-C5 isolated signed witness QA',kind:'test',members:[{id:member,type:'service',capabilities:['command:probe']}]}});
 assert.equal(r.status,201);const memberToken=r.data.credentials[member];assert.ok(memberToken);record('capability-limited-space');
 r=await call('/v5/spaces/'+space+'/commands',{method:'POST',token:memberToken,body:{action:'probe',target:member}});assert.equal(r.status,401);record('admin-role-isolation');
 r=await call('/v5/spaces/'+space+'/commands',{method:'POST',token:admin,body:{action:'shell',target:member}});assert.equal(r.status,403);record('arbitrary-action-rejection');
 const challenge=randomBytes(16).toString('hex'),payload={schema:'jm.revolvingdoor.probe/1',nonce:challenge};
 r=await call('/v5/spaces/'+space+'/commands',{method:'POST',token:admin,body:{action:'probe',target:member,payload,ttlMs:60000,requestId:'qa_c5_'+randomBytes(8).toString('hex')}});
 assert.equal(r.status,201);const command=r.data.command;assert.equal(command.action,'probe');record('bounded-command-queued');
 r=await call('/v5/spaces/'+space+'/commands?after=0',{token:memberToken});
 assert.equal(r.status,200);assert.ok(r.data.commands.some(c=>c.id===command.id));record('target-only-poll');
 r=await call('/v5/spaces/'+space+'/commands/'+command.id+'/ack',{method:'POST',token:memberToken,body:{status:'accepted'}});
 assert.equal(r.status,200);assert.equal(r.data.command.status,'accepted');record('target-ack');
 const detail={schema:'jm.rd.host-contact/2',challengeSha256:sha(challenge),missionId:'JM_C5_FIXTURE_'+sha(challenge).slice(0,55),localJobHash:sha('fixture-only'),localReceiptChain:sha('fixture-chain-only'),commandFingerprint:sha('fixture-fingerprint-only')};
 r=await call('/v5/spaces/'+space+'/commands/'+command.id+'/result',{method:'POST',token:memberToken,body:{ok:true,kind:'JM_RD_PROBE',detail}});
 assert.equal(r.status,200);assert.equal(r.data.command.status,'completed');record('host-result-fixture-only');
 const [key,rec,deep]=await Promise.all([call('/receipt-key'),call('/v5/spaces/'+space+'/receipt',{token:admin}),call('/v5/spaces/'+space,{token:admin})]);
 assert.equal(key.status,200);assert.equal(rec.status,200);assert.equal(deep.status,200);
 const jwk=key.data.publicKeyJwk,receipt=rec.data.receipt,snapshot=deep.data.space;
 const expectedKey=sha(canon(jwk)).slice(0,24);assert.equal(expectedKey,key.data.keyId);assert.equal(receipt.publicKeyId,expectedKey);
 const snapshotFields=['schema','spaceId','label','kind','status','createdAt','updatedAt','members','eventCount','commandCount','signalCount','chainHead'];
 const core=Object.fromEntries(snapshotFields.map(f=>[f,receipt[f]]));const digest=sha(canon(core));assert.equal(receipt.receiptHash,digest);
 assert.equal(verifySig('sha256',Buffer.from(digest),{key:createPublicKey({key:jwk,format:'jwk'}),dsaEncoding:'ieee-p1363'},Buffer.from(receipt.publicSig,'base64url')),true);record('real-server-ecdsa-snapshot');
 let head='0'.repeat(64);
 for(const e of snapshot.events){const core={seq:e.seq,at:e.at,memberId:e.memberId,source:e.source,event:e.event};assert.equal(e.prevHash,head);assert.equal(e.hash,sha(head+'\n'+canon(core)));head=e.hash;}
 assert.equal(head,receipt.chainHead);record('full-chain-hash-replay');
 const queueEvents=snapshot.events.filter(e=>e.event?.type==='command.queued'&&e.event.payload.commandId===command.id);
 const resultEvents=snapshot.events.filter(e=>e.event?.type==='command.result'&&e.event.payload.commandId===command.id);
 assert.equal(queueEvents.length,1);assert.equal(resultEvents.length,1);
 assert.equal(queueEvents[0].event.payload.payloadSha256,sha(canon(payload)));assert.equal(queueEvents[0].event.payload.requestId,command.requestId??null);record('queued-challenge-sha256-signed-chain');
 assert.equal(resultEvents[0].event.payload.detailSha256,sha(canon(detail)));record('returned-detail-sha256-signed-chain');
 assert.notEqual(queueEvents[0].event.payload.payloadSha256,sha(canon({...payload,nonce:'f'.repeat(32)})));record('challenge-alteration-detected');
 assert.notEqual(resultEvents[0].event.payload.detailSha256,sha(canon({...detail,localJobHash:'0'.repeat(64)})));record('result-alteration-detected');
 console.log(JSON.stringify({schema:'jm.cp-c5.actual-v05-server-witness-qa/1',status:'PASS',checks,checksPassed:checks.length,actualServerModule:true,remoteHostTouched:false,fixturesNotDeviceProof:true,keyId:expectedKey},null,2));
}catch(e){console.error(JSON.stringify({schema:'jm.cp-c5.actual-v05-server-witness-qa/1',status:'HOLD',checksPassed:checks.length,error:String(e.message)}));process.exitCode=1;}
finally{child.kill('SIGTERM');await new Promise(ok=>{if(child.exitCode!==null)return ok();child.once('exit',ok);setTimeout(ok,800).unref();});rmSync(tmp,{recursive:true,force:true});}
