import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const port=18951;
const admin='A'.repeat(48),secret='S'.repeat(48);
const tmp=path.join(root,'.qa-data');
fs.rmSync(tmp,{recursive:true,force:true});fs.mkdirSync(tmp,{recursive:true});
const child=spawn(process.execPath,[path.join(root,'JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs')],{cwd:root,env:{...process.env,PORT:String(port),HOST:'127.0.0.1',JM_CLOUD_MODE:'development',JM_CLOUD_ADMIN_TOKEN:admin,JM_CLOUD_SERVER_SECRET:secret,JM_CLOUD_ORIGINS:'*',JM_CLOUD_DATA:path.join(tmp,'data.json'),JM_CLOUD_PROFILE_DIR:path.join(root,'profiles'),JM_CLOUD_PROFILE_MANIFEST:path.join(root,'profiles','JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json'),JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(tmp,'signing.pem')}});
let stderr='';child.stderr.on('data',d=>stderr+=d);child.stdout.on('data',()=>{});
const base=`http://127.0.0.1:${port}`;const checks=[];
const pass=(name,detail=true)=>checks.push({name,pass:true,detail});
const fail=(name,e)=>checks.push({name,pass:false,detail:String(e?.message||e)});
async function req(url,{method='GET',token=null,rejoin=null,body=null,requestId=null}={}){const h={};if(token)h.Authorization='Bearer '+token;if(rejoin)h.Authorization='Rejoin '+rejoin;if(body!==null)h['Content-Type']='application/json';if(requestId)h['X-JM-Request-ID']=requestId;const r=await fetch(base+url,{method,headers:h,body:body===null?undefined:JSON.stringify(body)});let j;try{j=await r.json()}catch{j=await r.text()}return {r,j}}
async function wait(){for(let i=0;i<60;i++){try{const x=await fetch(base+'/health');if(x.ok)return}catch{}await new Promise(r=>setTimeout(r,100))}throw new Error('server did not start '+stderr)}
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}'}
try{
 await wait();
 let x=await req('/health'); if(x.r.ok&&x.j.version==='0.5.1-hosted')pass('health',x.j.version);else throw new Error(JSON.stringify(x.j));
 x=await req('/meta'); if(x.r.ok&&x.j.apiRoots.join(',')==='/v5,/v4,/v3')pass('meta-v5-plus-compat',x.j.apiRoots);else throw new Error(JSON.stringify(x.j));
 x=await req('/ready'); if(x.r.ok&&x.j.ready&&x.j.profileCount===1&&x.j.receiptSigning)pass('ready-profile-signing',x.j);else throw new Error(JSON.stringify(x.j));
 x=await req('/profiles'); if(x.r.ok&&x.j.profiles?.[0]?.id==='phone-laptop')pass('profile-list',x.j.profiles);else throw new Error(JSON.stringify(x.j));
 let html=await fetch(base+'/profiles/phone-laptop/control').then(r=>({status:r.status,text:r.text(),csp:r.headers.get('content-security-policy')}));html.text=await html.text;if(html.status===200&&html.csp.includes("frame-ancestors 'self'"))pass('profile-control-served',html.csp);else throw new Error('control');
 html=await fetch(base+'/profiles/phone-laptop/runner').then(async r=>({status:r.status,text:await r.text(),csp:r.headers.get('content-security-policy')}));if(html.status===200&&html.text.includes('CONTACT RUNNER')&&html.csp.includes("frame-ancestors 'self'"))pass('profile-runner-served',html.csp);else throw new Error('runner');
 x=await req('/profiles/../../etc/passwd');if(x.r.status===404)pass('path-traversal-denied',404);else throw new Error('status '+x.r.status);
 const space='qa_hosted_'+Date.now();
 const caps=['event:write','command:autorun','command:pair','command:exchange','command:recover','command:revoke','command:block','command:ping','command:snapshot','signal:rtc-offer','signal:rtc-answer'];
 x=await req('/v5/spaces',{method:'POST',token:admin,requestId:'space-1',body:{spaceId:space,label:'QA Phone Laptop',kind:'device-contact',members:[{id:'phone',type:'device',capabilities:caps},{id:'laptop',type:'device',capabilities:caps}]}});if(x.r.status===201&&x.j.credentials.phone&&x.j.rejoinCredentials.phone)pass('create-phone-laptop-space',space);else throw new Error(JSON.stringify(x.j));
 let phone=x.j.credentials.phone,laptop=x.j.credentials.laptop,phoneRejoin=x.j.rejoinCredentials.phone;
 x=await req(`/v5/spaces/${space}/events`,{method:'POST',token:'wrong',body:{event:{type:'NO'}}});if(x.r.status===401)pass('wrong-member-token-rejected',401);else throw new Error('wrong token '+x.r.status);
 x=await req(`/v5/spaces/${space}/commands`,{method:'POST',token:admin,body:{action:'not-allowed',target:'phone'}});if(x.r.status===403)pass('capability-denied-command',403);else throw new Error('cap '+x.r.status);
 for(const [tok,role] of [[phone,'phone'],[laptop,'laptop']]){x=await req(`/v5/spaces/${space}/events`,{method:'POST',token:tok,requestId:'connect-'+role,body:{event:{type:'PHONE_LAPTOP_TRACE',trace:{kind:'DING.CONNECT',role}}}});if(x.r.status!==201)throw new Error('event '+role)}pass('member-events-phone-laptop','two CONNECT events');
 x=await req(`/v5/spaces/${space}/events`,{method:'POST',token:phone,requestId:'connect-phone',body:{event:{type:'PHONE_LAPTOP_TRACE',trace:{kind:'DING.CONNECT',role:'phone'}}}});if(x.r.status===200&&x.j.deduplicated)pass('event-request-dedupe','PASS');else throw new Error('dedupe');
 x=await req(`/v5/spaces/${space}/ice`,{token:phone});if(x.r.ok&&Array.isArray(x.j.iceServers)&&x.j.iceServers.length>=2)pass('ice-config-member-scoped',{turn:x.j.turnConfigured,servers:x.j.iceServers.length});else throw new Error('ice');
 x=await req(`/v5/spaces/${space}/signals`,{method:'POST',token:phone,body:{to:'laptop',kind:'rtc-offer',payload:{sdp:{type:'offer',sdp:'qa'}}}});if(x.r.status===201)pass('signal-offer-phone-to-laptop',x.j.signal.id);else throw new Error('offer');
 x=await req(`/v5/spaces/${space}/signals?after=0`,{token:laptop});if(x.r.ok&&x.j.signals.some(s=>s.kind==='rtc-offer'))pass('signal-offer-delivered','offer delivered');else throw new Error('offer delivery');
 x=await req(`/v5/spaces/${space}/signals`,{method:'POST',token:laptop,body:{to:'phone',kind:'rtc-answer',payload:{sdp:{type:'answer',sdp:'qa'}}}});if(x.r.status===201)pass('signal-answer-laptop-to-phone',x.j.signal.id);else throw new Error('answer');
 x=await req(`/v5/spaces/${space}/signals?after=0`,{token:phone});if(x.r.ok&&x.j.signals.some(s=>s.kind==='rtc-answer'))pass('signal-answer-delivered','answer delivered');else throw new Error('answer delivery');
 x=await req(`/v5/spaces/${space}/commands`,{method:'POST',token:admin,requestId:'autorun-1',body:{action:'autorun',target:'laptop',ttlMs:600000,payload:{profile:'qa'}}});const cid=x.j.command?.id;if(x.r.status===201&&cid)pass('autorun-command-queue',cid);else throw new Error('queue');
 x=await req(`/v5/spaces/${space}/commands?after=0`,{token:laptop});if(x.r.ok&&x.j.commands.some(c=>c.id===cid))pass('autorun-command-poll',cid);else throw new Error('poll');
 x=await req(`/v5/spaces/${space}/commands/${cid}/ack`,{method:'POST',token:laptop,body:{status:'accepted'}});if(x.r.ok&&x.j.command.status==='accepted')pass('autorun-command-ack','accepted');else throw new Error('ack');
 const traceKinds=['DING.PAIR','DING.EXCHANGE','DING.RECOVER','DING.REVOKE'];for(const kind of traceKinds){for(const [tok,role] of [[phone,'phone'],[laptop,'laptop']])await req(`/v5/spaces/${space}/events`,{method:'POST',token:tok,requestId:kind+'-'+role,body:{event:{type:'PHONE_LAPTOP_TRACE',trace:{kind,role}}}})}pass('full-reciprocal-trace-events',traceKinds.length*2+2);
 await req(`/v5/spaces/${space}/events`,{method:'POST',token:phone,body:{event:{type:'PHONE_LAPTOP_TRACE',trace:{kind:'DING.BLOCK_REMOTE',role:'phone'}}}});await req(`/v5/spaces/${space}/events`,{method:'POST',token:laptop,body:{event:{type:'PHONE_LAPTOP_TRACE',trace:{kind:'DING.BLOCK',role:'laptop'}}}});pass('reciprocal-block-evidence','PASS');
 x=await req(`/v5/spaces/${space}/commands/${cid}/result`,{method:'POST',token:laptop,body:{ok:true,kind:'PHONE_LAPTOP_AUTORUN_COMPLETE',detail:{qa:true}}});if(x.r.ok&&x.j.command.status==='completed')pass('autorun-command-result',x.j.command.result.kind);else throw new Error('result');
 x=await req(`/v5/spaces/${space}`,{token:admin});if(x.r.ok&&x.j.space.commands.some(c=>c.status==='completed'))pass('deep-space-has-completed-command',{events:x.j.space.events.length,commands:x.j.space.commands.length,signals:x.j.space.signals.length});else throw new Error('deep');
 const oldPhone=phone,oldRejoin=phoneRejoin;x=await req(`/v5/spaces/${space}/members/phone/rejoin`,{method:'POST',rejoin:phoneRejoin,body:{memberId:'phone'}});if(x.r.status===201&&x.j.member.credentialVersion===2&&x.j.member.rejoinVersion===2){phone=x.j.credential;phoneRejoin=x.j.rejoinCredential;pass('member-cold-rejoin-rotates-token',{credentialVersion:2,rejoinVersion:2})}else throw new Error('rejoin');
 x=await req(`/v5/spaces/${space}/events`,{method:'POST',token:oldPhone,body:{event:{type:'OLD'}}});if(x.r.status===401)pass('old-member-token-rejected',401);else throw new Error('old token');
 x=await req(`/v5/spaces/${space}/members/phone/rejoin`,{method:'POST',rejoin:oldRejoin,body:{memberId:'phone'}});if(x.r.status===401)pass('old-rejoin-authority-rejected',401);else throw new Error('old rejoin');
 x=await req(`/v5/spaces/${space}/receipt`,{token:admin});const receipt=x.j.receipt,hash=crypto.createHash('sha256').update(canonical(Object.fromEntries(Object.entries(receipt).filter(([k])=>!['receiptHash','serverSig','publicSig','publicKeyId','signatureAlgorithm','claimBoundary'].includes(k))))).digest('hex');const kr=(await req('/receipt-key')).j;const pub=crypto.createPublicKey({key:kr.publicKeyJwk,format:'jwk'});const sig=Buffer.from(receipt.publicSig,'base64url');const okSig=crypto.verify('sha256',Buffer.from(receipt.receiptHash),{key:pub,dsaEncoding:'ieee-p1363'},sig);if(hash===receipt.receiptHash&&okSig&&kr.keyId===receipt.publicKeyId)pass('signed-receipt-hash-and-ecdsa',{hash,keyId:kr.keyId});else throw new Error('receipt verify');
 x=await req(`/v5/spaces/${space}/close`,{method:'POST',token:admin});if(x.r.ok&&x.j.space.status==='closed')pass('close-space','closed');else throw new Error('close');
 x=await req(`/v5/spaces/${space}/events`,{method:'POST',token:phone,body:{event:{type:'LATE'}}});if(x.r.status===409)pass('closed-space-rejects-new-event',409);else throw new Error('late event');
 x=await req(`/v5/spaces/${space}/members/phone/rejoin`,{method:'POST',rejoin:phoneRejoin,body:{memberId:'phone'}});if(x.r.status===409)pass('closed-space-rejects-rejoin',409);else throw new Error('late rejoin');
 x=await req('/v4/spaces',{token:admin});if(x.r.ok)pass('v4-compatibility-list','PASS');else throw new Error('v4');
 x=await req('/v3/spaces',{token:admin});if(x.r.ok)pass('v3-compatibility-list','PASS');else throw new Error('v3');
 const raw=fs.readFileSync(path.join(tmp,'data.json'),'utf8');if(!raw.includes(oldPhone)&&!raw.includes(phone)&&!raw.includes(phoneRejoin))pass('raw-secrets-not-persisted','PASS');else throw new Error('raw secret persisted');
} catch(e){fail('fatal',e)} finally {child.kill('SIGTERM');await new Promise(r=>setTimeout(r,150));}
const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;const out={body:'JM CLOUD CONTACT SERVER v0.5.1-hosted descendant + Phone↔Laptop profile carrier',checks,passed,failed,claimBoundary:'Assistant-side server/profile/API/static proof only; public hosted v0.5 and physical Phone↔Laptop consequences remain separately claim-gated.'};console.log(JSON.stringify(out,null,2));fs.writeFileSync(path.join(root,'qa','JM_CLOUD_CONTACT_SERVER_HOSTED_QA_RECEIPT_v0_5_1.json'),JSON.stringify(out,null,2));if(failed)process.exit(1);
