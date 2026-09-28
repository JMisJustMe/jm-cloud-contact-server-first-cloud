import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {RouteCoreNative} from './native/runtime-composition-native.mjs';

const now=()=>new Date().toISOString();
const safeId=x=>/^[A-Za-z0-9._:-]{1,96}$/.test(String(x||''));
const uid=p=>p+'_'+crypto.randomBytes(8).toString('base64url');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');
const timing=(a,b)=>{const A=Buffer.from(String(a)),B=Buffer.from(String(b));return A.length===B.length&&crypto.timingSafeEqual(A,B)};

export function createComputeCellProfile({port,adminToken,serverSecret,dataFile,artifactDir,cloudRequest}){
  if(!adminToken||!serverSecret)throw new Error('Compute Cell requires cloud admin token and server secret');
  const file=dataFile||path.resolve('./JM_COMPUTE_CELL_STATE_v0_1.json');
  const artifacts=artifactDir||path.resolve('./JM_COMPUTE_CELL_ARTIFACTS_v0_1');
  const key=crypto.createHmac('sha256',serverSecret).update('JM.ComputeCell/0.1').digest();
  const sign=x=>crypto.createHmac('sha256',key).update(String(x)).digest('base64url');
  let state;
  try{state=JSON.parse(fs.readFileSync(file,'utf8'))}catch{state={schema:'JM.ComputeCell/0.1',cells:{},jobs:{},artifacts:{},receipts:[]}}
  state.schema='JM.ComputeCell/0.1';state.cells=state.cells||{};state.jobs=state.jobs||{};state.artifacts=state.artifacts||{};state.receipts=state.receipts||[];

  const persist=()=>{fs.mkdirSync(path.dirname(file),{recursive:true});const t=file+'.tmp';fs.writeFileSync(t,JSON.stringify(state,null,2),{mode:0o600});fs.renameSync(t,file)};
  const body=req=>new Promise((ok,no)=>{let n=0,a=[];req.on('data',c=>{n+=c.length;if(n>512*1024){no(Error('body too large'));req.destroy()}else a.push(c)});req.on('end',()=>{try{ok(a.length?JSON.parse(Buffer.concat(a)):{} )}catch{no(Error('invalid json'))}});req.on('error',no)});
  const send=(res,status,obj)=>{const raw=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(raw)});res.end(raw)};
  const isAdmin=req=>{const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')&&timing(h.slice(7),adminToken)};
  const requireAdmin=(req,res)=>{if(!isAdmin(req)){send(res,401,{ok:false,error:'compute admin unauthorized'});return false}return true};

  const cloud=async(method,route,token,payload)=>{
    if(cloudRequest)return await cloudRequest(method,route,token,payload);
    const headers={'content-type':'application/json'};if(token)headers.authorization='Bearer '+token;
    const r=await fetch('http://127.0.0.1:'+port+route,{method,headers,body:payload==null?undefined:JSON.stringify(payload)});
    const text=await r.text();let j;try{j=JSON.parse(text)}catch{j={raw:text}};
    if(!r.ok)throw Error('cloud '+method+' '+route+' -> '+r.status+' '+JSON.stringify(j));
    return j;
  };

  const localReceipt=(kind,payload)=>{
    const core={schema:'JM.ComputeReceipt/0.1',receiptId:uid('jmcpr'),at:now(),kind,payload};
    const receiptHash=sha(core);
    const receipt={...core,receiptHash,computeSig:sign(receiptHash)};
    state.receipts.push(receipt);state.receipts=state.receipts.slice(-5000);
    return receipt;
  };

  const writeArtifact=(job,payload)=>{
    const artifact={schema:'JM.ComputeArtifact/0.1',jobId:job.jobId,cellId:job.cellId,engine:job.engine,createdAt:now(),payload};
    const artifactHash=sha(artifact);
    fs.mkdirSync(artifacts,{recursive:true,mode:0o700});
    const target=path.join(artifacts,artifactHash+'.json');
    if(!fs.existsSync(target))fs.writeFileSync(target,JSON.stringify(artifact,null,2),{mode:0o600});
    state.artifacts[artifactHash]={artifactHash,jobId:job.jobId,cellId:job.cellId,engine:job.engine,createdAt:artifact.createdAt,file:path.basename(target),bytes:Buffer.byteLength(JSON.stringify(artifact))};
    return{artifactHash,artifact,target};
  };

  const executeRouteCore=(request)=>{
    const source=String(request?.source||'');
    if(!source.trim())throw Error('routecore source required');
    if(source.length>65536)throw Error('routecore source too large');
    const input=request?.input;
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('routecore input object required');
    const result=RouteCoreNative.execute(source,input);
    return{
      body:'RouteCore Native',
      engine:'routecore-native',
      sourceHash:sha(source),
      inputHash:sha(input),
      nativeReceipt:result.receipt,
      result
    };
  };

  const engines={
    'routecore-native':executeRouteCore
  };

  async function runJob(cell,job,request){
    const spaceId=('compute_'+job.jobId).replace(/[^A-Za-z0-9._:-]/g,'_');
    const cloudSpace=await cloud('POST','/v5/spaces',adminToken,{
      spaceId,
      label:'JM Compute Job '+job.jobId,
      kind:'jm-compute-job',
      metadata:{profile:'JM.ComputeCell/0.1',cellId:cell.cellId,jobId:job.jobId,engine:job.engine},
      members:[{id:'executor',type:'jm-compute-executor',label:'JM Compute Cell '+cell.cellId,capabilities:['event:write']}]
    });
    const executor=cloudSpace.credentials?.executor;
    if(!executor)throw Error('cloud did not return compute executor credential');
    job.cloudSpaceId=spaceId;
    await cloud('POST','/v5/spaces/'+encodeURIComponent(spaceId)+'/events',executor,{event:{type:'compute.job.queued',payload:{jobId:job.jobId,cellId:job.cellId,engine:job.engine,sourceHash:job.sourceHash}}});
    job.status='running';job.startedAt=now();persist();
    try{
      const execution=engines[job.engine](request);
      const {artifactHash}=writeArtifact(job,{request:{sourceHash:execution.sourceHash,inputHash:execution.inputHash},execution});
      job.artifactHash=artifactHash;
      job.nativeReceipt=execution.nativeReceipt;
      job.status='completed';job.completedAt=now();
      await cloud('POST','/v5/spaces/'+encodeURIComponent(spaceId)+'/events',executor,{event:{type:'compute.job.completed',payload:{jobId:job.jobId,artifactHash,nativeReceipt:execution.nativeReceipt}}});
    }catch(e){
      job.status='failed';job.failedAt=now();job.error=String(e?.message||e);
      await cloud('POST','/v5/spaces/'+encodeURIComponent(spaceId)+'/events',executor,{event:{type:'compute.job.failed',payload:{jobId:job.jobId,error:job.error}}});
    }
    await cloud('POST','/v5/spaces/'+encodeURIComponent(spaceId)+'/close',adminToken,{});
    const cloudReceipt=(await cloud('GET','/v5/spaces/'+encodeURIComponent(spaceId)+'/receipt',adminToken)).receipt;
    job.cloudReceiptHash=cloudReceipt?.receiptHash||null;
    const receipt=localReceipt('compute.job.'+job.status,{
      jobId:job.jobId,cellId:job.cellId,engine:job.engine,status:job.status,
      sourceHash:job.sourceHash,artifactHash:job.artifactHash||null,
      nativeReceiptDigest:job.nativeReceipt?.resultDigest||null,
      cloudReceiptHash:job.cloudReceiptHash
    });
    job.computeReceiptHash=receipt.receiptHash;
    persist();
    return{job,receipt,cloudReceipt};
  }

  const publicCell=c=>({cellId:c.cellId,label:c.label,policy:c.policy,createdAt:c.createdAt,jobCount:Object.values(state.jobs).filter(j=>j.cellId===c.cellId).length});
  const publicJob=j=>({jobId:j.jobId,cellId:j.cellId,engine:j.engine,status:j.status,sourceHash:j.sourceHash,createdAt:j.createdAt,startedAt:j.startedAt||null,completedAt:j.completedAt||null,failedAt:j.failedAt||null,error:j.error||null,artifactHash:j.artifactHash||null,cloudSpaceId:j.cloudSpaceId||null,cloudReceiptHash:j.cloudReceiptHash||null,computeReceiptHash:j.computeReceiptHash||null,nativeReceipt:j.nativeReceipt||null});

  async function handle(req,res,u){
    const p=u.pathname;if(!(p==='/compute'||p.startsWith('/compute/')))return false;
    try{
      if(req.method==='GET'&&p==='/compute/v1/meta'){send(res,200,{ok:true,schema:state.schema,name:'JM Compute Cell',version:'0.1',route:'SOURCE -> CELL POLICY -> JM NATIVE ENGINE -> ARTIFACT -> CLOUD TRACE -> RECEIPT',engines:Object.keys(engines),mountedBodies:['JM CLOUD CONTACT SERVER v0.5.1-hosted','RouteCore Native','JM Native Core'],forbidden:['arbitrary shell','arbitrary filesystem execution','unregistered foreign runtime'],claimBoundary:'v0.1 proves governed RouteCore Native jobs only; it does not claim VM, container, kernel, Android-build or arbitrary-program execution.'});return true}
      if(req.method==='GET'&&p==='/compute/v1/ready'){let errors=[];try{fs.mkdirSync(artifacts,{recursive:true});fs.accessSync(artifacts,fs.constants.W_OK)}catch{errors.push('artifact directory not writable')}send(res,errors.length?503:200,{ok:!errors.length,ready:!errors.length,version:'0.1',engineCount:Object.keys(engines).length,cellCount:Object.keys(state.cells).length,jobCount:Object.keys(state.jobs).length,artifactCount:Object.keys(state.artifacts).length,errors});return true}
      if(req.method==='POST'&&p==='/compute/v1/cells'){if(!requireAdmin(req,res))return true;const j=await body(req),cellId=String(j.cellId||uid('cell'));if(!safeId(cellId)||state.cells[cellId]){send(res,400,{ok:false,error:'invalid or existing cellId'});return true}const cell={cellId,label:String(j.label||cellId).slice(0,120),policy:{engines:['routecore-native'],maxSourceBytes:65536,arbitraryShell:false},createdAt:now()};state.cells[cellId]=cell;const receipt=localReceipt('compute.cell.created',{cellId,policy:cell.policy});persist();send(res,201,{ok:true,cell:publicCell(cell),receipt});return true}
      if(req.method==='GET'&&p==='/compute/v1/cells'){if(!requireAdmin(req,res))return true;send(res,200,{ok:true,cells:Object.values(state.cells).map(publicCell)});return true}
      let m=p.match(/^\/compute\/v1\/cells\/([^/]+)\/jobs$/);
      if(req.method==='POST'&&m){if(!requireAdmin(req,res))return true;const cell=state.cells[decodeURIComponent(m[1])];if(!cell){send(res,404,{ok:false,error:'compute cell not found'});return true}const j=await body(req),engine=String(j.engine||'routecore-native');if(!cell.policy.engines.includes(engine)||!engines[engine]){send(res,400,{ok:false,error:'engine not allowed',allowed:cell.policy.engines});return true}const source=String(j.source||''),jobId=uid('job');const job={jobId,cellId:cell.cellId,engine,status:'queued',sourceHash:sha(source),createdAt:now()};state.jobs[jobId]=job;persist();const result=await runJob(cell,job,{source,input:j.input});send(res,job.status==='completed'?201:422,{ok:job.status==='completed',...result,job:publicJob(job)});return true}
      m=p.match(/^\/compute\/v1\/jobs\/([^/]+)$/);
      if(req.method==='GET'&&m){if(!requireAdmin(req,res))return true;const job=state.jobs[decodeURIComponent(m[1])];if(!job){send(res,404,{ok:false,error:'compute job not found'});return true}send(res,200,{ok:true,job:publicJob(job)});return true}
      m=p.match(/^\/compute\/v1\/artifacts\/([a-f0-9]{64})$/);
      if(req.method==='GET'&&m){if(!requireAdmin(req,res))return true;const meta=state.artifacts[m[1]];if(!meta){send(res,404,{ok:false,error:'artifact not found'});return true}const target=path.join(artifacts,path.basename(meta.file));let artifact;try{artifact=JSON.parse(fs.readFileSync(target,'utf8'))}catch{send(res,410,{ok:false,error:'artifact carrier missing',meta});return true}if(sha(artifact)!==meta.artifactHash){send(res,409,{ok:false,error:'artifact hash mismatch'});return true}send(res,200,{ok:true,meta,artifact});return true}
      if(req.method==='GET'&&p==='/compute/v1/receipts'){if(!requireAdmin(req,res))return true;send(res,200,{ok:true,receipts:state.receipts.slice(-100).reverse()});return true}
      send(res,404,{ok:false,error:'compute route not found'});return true;
    }catch(e){send(res,400,{ok:false,error:String(e?.message||e)});return true}
  }
  return{handle};
}
