import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createComputeCellProfile} from '../compute/JM_COMPUTE_CELL_PROFILE_v0_1.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const tmp=path.join(root,'.qa-compute');
fs.rmSync(tmp,{recursive:true,force:true});
fs.mkdirSync(tmp,{recursive:true});
const admin='A'.repeat(48),secret='S'.repeat(48),port=18971;
const cloudSpaces=new Map();
const cloudCalls=[];
const checks=[];
const pass=(name,detail=true)=>checks.push({name,pass:true,detail});
const fail=(name,e)=>checks.push({name,pass:false,detail:String(e?.message||e)});
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');

async function fakeCloud(method,route,token,payload){
  cloudCalls.push({method,route,token:token===admin?'ADMIN':token?'MEMBER':null});
  if(method==='POST'&&route==='/v5/spaces'){
    const s={...payload,status:'active',events:[],receiptHash:null};
    cloudSpaces.set(payload.spaceId,s);
    return {ok:true,space:s,credentials:{executor:'exec_'+payload.spaceId},rejoinCredentials:{executor:'rejoin_'+payload.spaceId}};
  }
  const m=route.match(/^\/v5\/spaces\/([^/]+)(?:\/(events|close|receipt))?$/);
  if(!m)throw Error('fake cloud route '+method+' '+route);
  const id=decodeURIComponent(m[1]),op=m[2]||'',s=cloudSpaces.get(id);
  if(!s)throw Error('space missing '+id);
  if(method==='POST'&&op==='events'){
    if(token!=='exec_'+id)throw Error('executor credential mismatch');
    const record={seq:s.events.length+1,event:payload.event,hash:hash(payload.event)};
    s.events.push(record);
    return {ok:true,record};
  }
  if(method==='POST'&&op==='close'){
    if(token!==admin)throw Error('admin required for close');
    s.status='closed';
    return {ok:true,space:s};
  }
  if(method==='GET'&&op==='receipt'){
    if(token!==admin)throw Error('admin required for receipt');
    const receiptHash=hash({spaceId:id,status:s.status,events:s.events});
    s.receiptHash=receiptHash;
    return {ok:true,receipt:{schema:'jm.cloud-contact.space-receipt/0.5',spaceId:id,status:s.status,eventCount:s.events.length,receiptHash,publicSig:'QA',publicKeyId:'QA'}};
  }
  throw Error('unsupported fake cloud operation');
}

const profile=createComputeCellProfile({
  port,
  adminToken:admin,
  serverSecret:secret,
  dataFile:path.join(tmp,'state.json'),
  artifactDir:path.join(tmp,'artifacts'),
  cloudRequest:fakeCloud
});
const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://127.0.0.1:'+port);
  if(await profile.handle(req,res,u))return;
  res.writeHead(404);res.end();
});
const base='http://127.0.0.1:'+port;
const req=async(url,{method='GET',token=null,body=null}={})=>{
  const headers={};if(token)headers.authorization='Bearer '+token;if(body!==null)headers['content-type']='application/json';
  const r=await fetch(base+url,{method,headers,body:body===null?undefined:JSON.stringify(body)});
  const text=await r.text();let j;try{j=JSON.parse(text)}catch{j={raw:text}};return{r,j};
};

try{
  await new Promise((ok,no)=>server.listen(port,'127.0.0.1',e=>e?no(e):ok()));
  let x=await req('/compute/v1/meta');
  if(x.r.ok&&x.j.engines?.includes('routecore-native')&&x.j.forbidden?.includes('arbitrary shell'))pass('meta-native-only',x.j.engines);else throw Error(JSON.stringify(x.j));

  x=await req('/compute/v1/ready');
  if(x.r.ok&&x.j.ready&&x.j.engineCount===1)pass('ready-one-engine',x.j);else throw Error(JSON.stringify(x.j));

  x=await req('/compute/v1/cells',{method:'POST',body:{cellId:'alpha'}});
  if(x.r.status===401)pass('cell-create-requires-admin',401);else throw Error('unauthorized status '+x.r.status);

  x=await req('/compute/v1/cells',{method:'POST',token:admin,body:{cellId:'alpha',label:'JM Alpha Compute Cell'}});
  if(x.r.status===201&&x.j.cell?.policy?.engines?.[0]==='routecore-native'&&x.j.cell.policy.arbitraryShell===false)pass('cell-created-native-policy',x.j.cell);else throw Error(JSON.stringify(x.j));

  const source='nativeRoute DoorNative {\n  entry = closed\n  states = [closed,open]\n  transition = press\n  abi = jm.routecore.v1\n}';
  x=await req('/compute/v1/cells/alpha/jobs',{method:'POST',token:admin,body:{engine:'routecore-native',source,input:{state:'closed',event:'press'}}});
  if(x.r.status===201&&x.j.job?.status==='completed')pass('job-completed',x.j.job.jobId);else throw Error(JSON.stringify(x.j));
  const job=x.j.job,cloudReceipt=x.j.cloudReceipt,computeReceipt=x.j.receipt;

  if(job.nativeReceipt?.body==='RouteCore Native'&&job.nativeReceipt?.eventCount===1)pass('real-routecore-native-receipt',job.nativeReceipt);else throw Error('native receipt missing');
  if(job.artifactHash&&/^[a-f0-9]{64}$/.test(job.artifactHash))pass('content-addressed-artifact',job.artifactHash);else throw Error('artifact hash');
  if(cloudReceipt?.status==='closed'&&cloudReceipt?.eventCount===2)pass('fresh-cloud-space-closed',cloudReceipt);else throw Error('cloud receipt');
  if(computeReceipt?.payload?.cloudReceiptHash===cloudReceipt.receiptHash&&computeReceipt?.payload?.artifactHash===job.artifactHash)pass('compute-cloud-artifact-receipts-linked',computeReceipt.receiptHash);else throw Error('receipt linkage');

  x=await req('/compute/v1/artifacts/'+job.artifactHash,{token:admin});
  if(x.r.ok&&x.j.artifact?.payload?.execution?.result?.state?.to==='open')pass('artifact-returned-routecore-result','open');else throw Error(JSON.stringify(x.j));

  x=await req('/compute/v1/cells/alpha/jobs',{method:'POST',token:admin,body:{engine:'node-shell',source:'rm -rf /',input:{}}});
  if(x.r.status===400&&x.j.allowed?.length===1&&x.j.allowed[0]==='routecore-native')pass('foreign-shell-engine-rejected',x.j);else throw Error('shell gate '+JSON.stringify(x.j));

  const raw=fs.readFileSync(path.join(tmp,'state.json'),'utf8');
  if(!raw.includes('exec_compute_')&&!raw.includes('rejoin_compute_'))pass('cloud-job-credentials-not-persisted','PASS');else throw Error('ephemeral cloud credential persisted');

  const artifactFiles=fs.readdirSync(path.join(tmp,'artifacts')).filter(x=>x.endsWith('.json'));
  if(artifactFiles.length===1&&artifactFiles[0]===job.artifactHash+'.json')pass('artifact-carrier-hash-name',artifactFiles[0]);else throw Error('artifact carrier mismatch');

  if(cloudCalls.filter(x=>x.route==='/v5/spaces').length===1&&cloudCalls.some(x=>x.route.endsWith('/close'))&&cloudCalls.some(x=>x.route.endsWith('/receipt')))pass('cloud-v5-route-used',cloudCalls.map(x=>x.method+' '+x.route));else throw Error('cloud route incomplete');
}catch(e){fail('fatal',e)}
finally{await new Promise(r=>server.close(()=>r()));}

const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;
const receipt={schema:'JM.ComputeCell.QA/0.1',body:'JM Compute Cell v0.1',passed,failed,checks,claimBoundary:'Local/profile QA proves RouteCore Native compute-job governance with fake v5 cloud transport. Parent-server integration/public hosting remains separately gated.'};
console.log(JSON.stringify(receipt,null,2));
fs.writeFileSync(path.join(root,'qa','JM_COMPUTE_CELL_QA_RECEIPT_v0_1.json'),JSON.stringify(receipt,null,2));
if(failed)process.exit(1);
