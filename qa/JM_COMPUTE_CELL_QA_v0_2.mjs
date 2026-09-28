import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createComputeCellProfile} from '../compute/JM_COMPUTE_CELL_PROFILE_v0_2.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const tmp=path.join(root,'.qa-compute-v02');
fs.rmSync(tmp,{recursive:true,force:true});fs.mkdirSync(tmp,{recursive:true});
const admin='A'.repeat(48),secret='S'.repeat(48),port=18972;
const cloudSpaces=new Map(),cloudCalls=[],checks=[];
const pass=(name,detail=true)=>checks.push({name,pass:true,detail});
const fail=(name,e)=>checks.push({name,pass:false,detail:String(e?.message||e)});
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');

async function fakeCloud(method,route,token,payload){
  cloudCalls.push({method,route,token:token===admin?'ADMIN':token?'MEMBER':null});
  if(method==='POST'&&route==='/v5/spaces'){
    const s={...payload,status:'active',events:[]};cloudSpaces.set(payload.spaceId,s);
    return{ok:true,space:s,credentials:{executor:'exec_'+payload.spaceId}};
  }
  const m=route.match(/^\/v5\/spaces\/([^/]+)\/(events|close|receipt)$/);
  if(!m)throw Error('fake cloud route '+method+' '+route);
  const id=decodeURIComponent(m[1]),op=m[2],s=cloudSpaces.get(id);if(!s)throw Error('space missing');
  if(method==='POST'&&op==='events'){if(token!=='exec_'+id)throw Error('executor auth');const rec={seq:s.events.length+1,event:payload.event,hash:hash(payload.event)};s.events.push(rec);return{ok:true,record:rec}}
  if(method==='POST'&&op==='close'){if(token!==admin)throw Error('admin close');s.status='closed';return{ok:true,space:s}}
  if(method==='GET'&&op==='receipt'){if(token!==admin)throw Error('admin receipt');const receiptHash=hash({spaceId:id,status:s.status,events:s.events});return{ok:true,receipt:{schema:'jm.cloud-contact.space-receipt/0.5',spaceId:id,status:s.status,eventCount:s.events.length,receiptHash,publicSig:'QA',publicKeyId:'QA'}}}
  throw Error('unsupported cloud op');
}
const profile=createComputeCellProfile({port,adminToken:admin,serverSecret:secret,dataFile:path.join(tmp,'state.json'),artifactDir:path.join(tmp,'artifacts'),cloudRequest:fakeCloud});
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:'+port);if(await profile.handle(req,res,u))return;res.writeHead(404);res.end()});
const base='http://127.0.0.1:'+port;
const req=async(url,{method='GET',token=null,body=null}={})=>{const h={};if(token)h.authorization='Bearer '+token;if(body!==null)h['content-type']='application/json';const r=await fetch(base+url,{method,headers:h,body:body===null?undefined:JSON.stringify(body)});const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={raw:t}};return{r,j}};

try{
  await new Promise((ok,no)=>server.listen(port,'127.0.0.1',e=>e?no(e):ok()));
  let x=await req('/compute/v1/meta');
  if(x.r.ok&&x.j.version==='0.2'&&JSON.stringify(x.j.engines)==='["routecore-native","cadenvm-native","jmvm-native"]')pass('three-jm-engines',x.j.engines);else throw Error(JSON.stringify(x.j));
  if(x.j.forbidden?.includes('external callback services'))pass('external-services-forbidden',x.j.forbidden);else throw Error('service boundary absent');

  x=await req('/compute/v1/cells',{method:'POST',token:admin,body:{cellId:'vm-cell'}});
  if(x.r.status===201&&x.j.cell.policy.engines.length===3&&x.j.cell.policy.externalServices===false)pass('vm-cell-policy',x.j.cell.policy);else throw Error(JSON.stringify(x.j));

  const routeSource=`nativeRoute DoorNative {
  entry = closed
  states = [closed,open]
  transition = press
  abi = jm.routecore.v1
}`;
  x=await req('/compute/v1/cells/vm-cell/jobs',{method:'POST',token:admin,body:{engine:'routecore-native',source:routeSource,input:{state:'closed',event:'press'}}});
  if(x.r.status===201&&x.j.job.nativeReceipt?.body==='RouteCore Native')pass('routecore-still-passes',x.j.job.nativeReceipt.resultDigest);else throw Error(JSON.stringify(x.j));

  const cadenSource=`kading DoorCadence {
  key door.state = "closed"
  cadence OpenDoor {
    beat open do door.state = "open"
  }
}`;
  x=await req('/compute/v1/cells/vm-cell/jobs',{method:'POST',token:admin,body:{engine:'cadenvm-native',entry:'OpenDoor',source:cadenSource,input:{door:{state:'closed'}}}});
  if(x.r.status===201&&x.j.job.nativeReceipt?.body==='CadenVM')pass('cadenvm-native-receipt',x.j.job.nativeReceipt);else throw Error(JSON.stringify(x.j));
  const cadenJob=x.j.job;
  x=await req('/compute/v1/artifacts/'+cadenJob.artifactHash,{token:admin});
  if(x.r.ok&&x.j.artifact.payload.execution.result.runtime.state.door.state==='open'&&x.j.artifact.payload.execution.result.bytecode.type==='CadenBytecode')pass('cadenvm-bytecode-state-artifact','open');else throw Error(JSON.stringify(x.j));

  const jmvmSource=`machine CloudMachine {
  instruction SET cloud.vmVerified = true
  instruction ASSERT cloud.vmVerified == true
  instruction TRACE "cloud-vm-state"
  instruction DING "JMVM_CLOUD_PASS"
  instruction HALT
}`;
  x=await req('/compute/v1/cells/vm-cell/jobs',{method:'POST',token:admin,body:{engine:'jmvm-native',entry:'CloudMachine',source:jmvmSource,input:{cloud:{}}}});
  if(x.r.status===201&&x.j.job.nativeReceipt?.body==='JMVM')pass('jmvm-native-receipt',x.j.job.nativeReceipt);else throw Error(JSON.stringify(x.j));
  const jmvmJob=x.j.job;
  x=await req('/compute/v1/artifacts/'+jmvmJob.artifactHash,{token:admin});
  if(x.r.ok&&x.j.artifact.payload.execution.result.runtime.state.cloud.vmVerified===true&&x.j.artifact.payload.execution.result.runtime.ding.value==='JMVM_CLOUD_PASS')pass('jmvm-ding-state-artifact',x.j.artifact.payload.execution.result.runtime.ding);else throw Error(JSON.stringify(x.j));

  const callSource=`machine CallMachine {
  instruction CALL hostEscape("x")
  instruction DING "SHOULD_NOT_PASS"
  instruction HALT
}`;
  x=await req('/compute/v1/cells/vm-cell/jobs',{method:'POST',token:admin,body:{engine:'jmvm-native',entry:'CallMachine',source:callSource,input:{}}});
  if(x.r.status===422&&x.j.job.status==='failed'&&String(x.j.job.error).includes('Unknown JMVM service hostEscape'))pass('jmvm-host-service-fails-closed',x.j.job.error);else throw Error(JSON.stringify(x.j));
  if(x.j.cloudReceipt?.status==='closed'&&x.j.receipt?.kind==='compute.job.failed')pass('failed-vm-job-still-closes-and-receipts',{cloud:x.j.cloudReceipt.receiptHash,compute:x.j.receipt.receiptHash});else throw Error('failed receipt missing');

  x=await req('/compute/v1/cells/vm-cell/jobs',{method:'POST',token:admin,body:{engine:'node-shell',source:'echo nope',input:{}}});
  if(x.r.status===400&&x.j.allowed?.length===3&&!x.j.allowed.includes('node-shell'))pass('shell-still-rejected',x.j.allowed);else throw Error(JSON.stringify(x.j));

  const artifacts=fs.readdirSync(path.join(tmp,'artifacts')).filter(n=>n.endsWith('.json'));
  if(artifacts.length===3)pass('only-successful-jobs-produce-artifacts',artifacts.length);else throw Error('artifact count '+artifacts.length);
  const persisted=fs.readFileSync(path.join(tmp,'state.json'),'utf8');
  if(!persisted.includes('exec_compute_'))pass('ephemeral-cloud-credentials-not-persisted','PASS');else throw Error('credential persisted');
  if(cloudCalls.filter(c=>c.route==='/v5/spaces').length===4)pass('all-attempted-jobs-have-cloud-spaces',4);else throw Error('space count');
}catch(e){fail('fatal',e)}
finally{await new Promise(r=>server.close(()=>r()))}

const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;
const receipt={schema:'JM.ComputeCell.QA/0.2',body:'JM Compute Cell v0.2',engines:['routecore-native','cadenvm-native','jmvm-native'],passed,failed,checks,claimBoundary:'Local/profile QA proves registered JM RouteCore Native, CadenVM and JMVM cloud jobs without external callback services. Parent-server integration/public hosting remain separately gated.'};
console.log(JSON.stringify(receipt,null,2));
fs.writeFileSync(path.join(root,'qa','JM_COMPUTE_CELL_QA_RECEIPT_v0_2.json'),JSON.stringify(receipt,null,2));
if(failed)process.exit(1);
