import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createBuildCellProfile} from '../build/JM_BUILD_CELL_PROFILE_v0_1.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const tmp=path.join(root,'.qa-build-v01');
fs.rmSync(tmp,{recursive:true,force:true});fs.mkdirSync(tmp,{recursive:true});
const admin='A'.repeat(48),secret='S'.repeat(48),port=18973;
const cloudSpaces=new Map(),cloudCalls=[],checks=[];
const pass=(name,detail=true)=>checks.push({name,pass:true,detail});
const fail=(name,e)=>checks.push({name,pass:false,detail:String(e?.message||e)});
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');

async function fakeCloud(method,route,token,payload){
  cloudCalls.push({method,route,token:token===admin?'ADMIN':token?'MEMBER':null});
  if(method==='POST'&&route==='/v5/spaces'){
    const s={...payload,status:'active',events:[]};cloudSpaces.set(payload.spaceId,s);
    return{ok:true,space:s,credentials:{builder:'exec_'+payload.spaceId}};
  }
  const m=route.match(/^\/v5\/spaces\/([^/]+)\/(events|close|receipt)$/);
  if(!m)throw Error('fake cloud route '+method+' '+route);
  const id=decodeURIComponent(m[1]),op=m[2],s=cloudSpaces.get(id);if(!s)throw Error('space missing');
  if(method==='POST'&&op==='events'){if(token!=='exec_'+id)throw Error('builder auth');const rec={seq:s.events.length+1,event:payload.event,hash:hash(payload.event)};s.events.push(rec);return{ok:true,record:rec}}
  if(method==='POST'&&op==='close'){if(token!==admin)throw Error('admin close');s.status='closed';return{ok:true,space:s}}
  if(method==='GET'&&op==='receipt'){if(token!==admin)throw Error('admin receipt');const receiptHash=hash({spaceId:id,status:s.status,events:s.events});return{ok:true,receipt:{schema:'jm.cloud-contact.space-receipt/0.5',spaceId:id,status:s.status,eventCount:s.events.length,receiptHash,publicSig:'QA',publicKeyId:'QA'}}}
  throw Error('unsupported cloud op');
}

const profile=createBuildCellProfile({port,adminToken:admin,serverSecret:secret,dataFile:path.join(tmp,'state.json'),artifactDir:path.join(tmp,'artifacts'),cloudRequest:fakeCloud});
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:'+port);if(await profile.handle(req,res,u))return;res.writeHead(404);res.end()});
const base='http://127.0.0.1:'+port;
const req=async(url,{method='GET',token=null,body=null}={})=>{const h={};if(token)h.authorization='Bearer '+token;if(body!==null)h['content-type']='application/json';const r=await fetch(base+url,{method,headers:h,body:body===null?undefined:JSON.stringify(body)});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={raw:t}};return{r,j}};

try{
  await new Promise((ok,no)=>server.listen(port,'127.0.0.1',e=>e?no(e):ok()));

  let x=await req('/build/v1/meta');
  if(x.r.ok&&x.j.engines?.[0]==='compilecading-native'&&x.j.targets?.[0]==='javascript'&&x.j.heldEngines?.includes('jmgradle-android'))pass('meta-native-compiler-and-jmgradle-hold',x.j);else throw Error(JSON.stringify(x.j));

  x=await req('/build/v1/ready');
  if(x.r.ok&&x.j.ready&&x.j.engineCount===1&&x.j.heldEngines?.includes('jmgradle-android'))pass('ready-one-build-engine',x.j);else throw Error(JSON.stringify(x.j));

  x=await req('/build/v1/builders',{method:'POST',body:{builderId:'compiler-cell'}});
  if(x.r.status===401)pass('builder-create-requires-admin',401);else throw Error('unauthorized '+x.r.status);

  x=await req('/build/v1/builders',{method:'POST',token:admin,body:{builderId:'compiler-cell',label:'JM Native Compiler Cell'}});
  if(x.r.status===201&&x.j.builder?.policy?.engines?.[0]==='compilecading-native'&&x.j.builder.policy.arbitraryShell===false)pass('builder-created-native-policy',x.j.builder);else throw Error(JSON.stringify(x.j));

  x=await req('/build/v1/builders/compiler-cell/jobs',{method:'POST',token:admin,body:{engine:'compilecading-native',target:'javascript',source:'open door'}});
  if(x.r.status===201&&x.j.job?.status==='completed'&&x.j.job?.nativeReceipt?.body==='compileCading API')pass('native-build-completed',x.j.job.jobId);else throw Error(JSON.stringify(x.j));
  const job=x.j.job;
  if(job.nativeReceipts?.parser?.body==='Parser'&&job.nativeReceipts?.compiler?.body==='Compiler'&&job.nativeReceipts?.emitter?.body==='JS Emitter'&&job.nativeReceipts?.api?.body==='compileCading API')pass('four-native-receipts-linked',Object.keys(job.nativeReceipts));else throw Error('native receipt chain incomplete');

  x=await req('/build/v1/artifacts/'+job.artifactHash,{token:admin});
  const payload=x.j.artifact?.payload;
  if(x.r.ok&&payload?.onebody?.schema==='jm.onebody.ir/1.0'&&payload?.onebody?.identityPreserved===true&&String(payload?.code).includes('export const landing')&&payload?.codeDigest)pass('onebody-js-artifact', {meaning:payload.onebody.meaning,codeDigest:payload.codeDigest});else throw Error(JSON.stringify(x.j));

  if(x.j.meta?.artifactHash===job.artifactHash&&/^[a-f0-9]{64}$/.test(job.artifactHash))pass('content-addressed-build-artifact',job.artifactHash);else throw Error('artifact hash');
  if(job.cloudReceiptHash&&job.buildReceiptHash&&job.codeDigest)pass('job-links-cloud-build-code-receipts',{cloud:job.cloudReceiptHash,build:job.buildReceiptHash,code:job.codeDigest});else throw Error('job receipt linkage');

  x=await req('/build/v1/builders/compiler-cell/jobs',{method:'POST',token:admin,body:{engine:'compilecading-native',target:'rust',source:'open door'}});
  if(x.r.status===400&&x.j.allowedTargets?.[0]==='javascript')pass('undeclared-target-rejected-before-job',x.j);else throw Error(JSON.stringify(x.j));

  x=await req('/build/v1/builders/compiler-cell/jobs',{method:'POST',token:admin,body:{engine:'node-shell',target:'javascript',source:'echo nope'}});
  if(x.r.status===400&&x.j.allowed?.[0]==='compilecading-native')pass('shell-engine-rejected-before-job',x.j);else throw Error(JSON.stringify(x.j));

  x=await req('/build/v1/builders/compiler-cell/jobs',{method:'POST',token:admin,body:{engine:'compilecading-native',target:'javascript',source:'open = ???'}});
  if(x.r.status===422&&x.j.job?.status==='failed'&&x.j.cloudReceipt?.status==='closed'&&x.j.receipt?.kind==='build.job.failed')pass('malformed-source-fails-closed-with-receipt',{error:x.j.job.error,cloud:x.j.cloudReceipt.receiptHash,build:x.j.receipt.receiptHash});else throw Error(JSON.stringify(x.j));

  const artifactFiles=fs.readdirSync(path.join(tmp,'artifacts')).filter(n=>n.endsWith('.json'));
  if(artifactFiles.length===1&&artifactFiles[0]===job.artifactHash+'.json')pass('failed-build-produces-no-artifact',artifactFiles);else throw Error('artifact count '+artifactFiles.length);

  const persisted=fs.readFileSync(path.join(tmp,'state.json'),'utf8');
  if(!persisted.includes('exec_build_'))pass('ephemeral-build-credential-not-persisted','PASS');else throw Error('credential persisted');

  if(cloudCalls.filter(c=>c.route==='/v5/spaces').length===2)pass('only-executed-jobs-open-cloud-spaces',2);else throw Error('cloud space count '+cloudCalls.filter(c=>c.route==='/v5/spaces').length);
}catch(e){fail('fatal',e)}
finally{await new Promise(r=>server.close(()=>r()))}

const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;
const receipt={schema:'JM.BuildCell.QA/0.1',body:'JM Build Cell v0.1',engine:'compilecading-native',passed,failed,checks,claimBoundary:'Local/profile QA proves exact Batch Five Parser -> Compiler -> OneBody IR -> JS Emitter -> compileCading API build jobs to JavaScript artifacts. JMGradle/Android build execution remains HOLD.'};
console.log(JSON.stringify(receipt,null,2));
fs.writeFileSync(path.join(root,'qa','JM_BUILD_CELL_QA_RECEIPT_v0_1.json'),JSON.stringify(receipt,null,2));
if(failed)process.exit(1);
