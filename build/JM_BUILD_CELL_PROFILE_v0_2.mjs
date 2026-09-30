import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Parser,Compiler,JSEmitter,CompileCadingAPI} from './native/compiler-lab-native.mjs';
import {PARSER_SOURCE,COMPILER_SOURCE,JS_EMITTER_SOURCE,API_SOURCE} from './native/native-corpus.mjs';
import {buildAndroidApk,androidSigningFromEnv} from './JM_ANDROID_FORGE_CLOUD_ADAPTER_v0_1.mjs';

const now=()=>new Date().toISOString();
const safeId=x=>/^[A-Za-z0-9._:-]{1,96}$/.test(String(x||''));
const uid=p=>p+'_'+crypto.randomBytes(8).toString('base64url');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:canonical(x)).digest('hex');
const timing=(a,b)=>{const A=Buffer.from(String(a)),B=Buffer.from(String(b));return A.length===B.length&&crypto.timingSafeEqual(A,B)};

export function createBuildCellProfile({port,adminToken,serverSecret,dataFile,artifactDir,cloudRequest,androidSigning}){
  if(!adminToken||!serverSecret)throw new Error('Build Cell requires cloud admin token and server secret');
  const file=dataFile||path.resolve('./JM_BUILD_CELL_STATE_v0_2.json');
  const artifacts=artifactDir||path.resolve('./JM_BUILD_CELL_ARTIFACTS_v0_2');
  const key=crypto.createHmac('sha256',serverSecret).update('JM.BuildCell/0.2').digest();
  const sign=x=>crypto.createHmac('sha256',key).update(String(x)).digest('base64url');
  let state;
  try{state=JSON.parse(fs.readFileSync(file,'utf8'))}catch{state={schema:'JM.BuildCell/0.2',builders:{},jobs:{},artifacts:{},receipts:[]}}
  state.schema='JM.BuildCell/0.2';state.builders=state.builders||{};state.jobs=state.jobs||{};state.artifacts=state.artifacts||{};state.receipts=state.receipts||[];

  const persist=()=>{fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});const t=file+'.tmp';fs.writeFileSync(t,JSON.stringify(state,null,2),{mode:0o600});fs.renameSync(t,file)};
  const body=req=>new Promise((ok,no)=>{let n=0,a=[];req.on('data',c=>{n+=c.length;if(n>3*1024*1024){no(Error('body too large'));req.destroy()}else a.push(c)});req.on('end',()=>{try{ok(a.length?JSON.parse(Buffer.concat(a)):{} )}catch{no(Error('invalid json'))}});req.on('error',no)});
  const send=(res,status,obj)=>{const raw=JSON.stringify(obj);res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(raw)});res.end(raw)};
  const isAdmin=req=>{const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')&&timing(h.slice(7),adminToken)};
  const requireAdmin=(req,res)=>{if(!isAdmin(req)){send(res,401,{ok:false,error:'build admin unauthorized'});return false}return true};

  const cloud=async(method,route,token,payload)=>{
    if(cloudRequest)return await cloudRequest(method,route,token,payload);
    const headers={'content-type':'application/json'};if(token)headers.authorization='Bearer '+token;
    const r=await fetch('http://127.0.0.1:'+port+route,{method,headers,body:payload==null?undefined:JSON.stringify(payload)});
    const text=await r.text();let j;try{j=JSON.parse(text)}catch{j={raw:text}};
    if(!r.ok)throw Error('cloud '+method+' '+route+' -> '+r.status+' '+JSON.stringify(j));
    return j;
  };

  const localReceipt=(kind,payload)=>{
    const core={schema:'JM.BuildReceipt/0.2',receiptId:uid('jmbr'),at:now(),kind,payload};
    const receiptHash=sha(core);
    const receipt={...core,receiptHash,buildSig:sign(receiptHash)};
    state.receipts.push(receipt);state.receipts=state.receipts.slice(-5000);
    return receipt;
  };

  const writeArtifact=(job,payload)=>{
    const artifact={schema:'JM.BuildArtifact/0.2',jobId:job.jobId,builderId:job.builderId,engine:job.engine,target:job.target,createdAt:now(),payload};
    const artifactHash=sha(artifact);
    fs.mkdirSync(artifacts,{recursive:true,mode:0o700});
    const target=path.join(artifacts,artifactHash+'.json');
    if(!fs.existsSync(target))fs.writeFileSync(target,JSON.stringify(artifact,null,2),{mode:0o600});
    state.artifacts[artifactHash]={artifactHash,jobId:job.jobId,builderId:job.builderId,engine:job.engine,target:job.target,createdAt:artifact.createdAt,file:path.basename(target),bytes:Buffer.byteLength(JSON.stringify(artifact))};
    return{artifactHash,artifact};
  };

  const writeBinaryArtifact=(job,build)=>{
    const bytes=Buffer.from(build.binaryArtifact);
    const artifactHash=crypto.createHash('sha256').update(bytes).digest('hex');
    if(build.artifactSha256&&artifactHash!==build.artifactSha256)throw Error('binary artifact hash mismatch before persistence');
    fs.mkdirSync(artifacts,{recursive:true,mode:0o700});
    const ext=build.artifactExtension||'.bin';
    const fileName=artifactHash+ext;
    const target=path.join(artifacts,fileName);
    if(!fs.existsSync(target))fs.writeFileSync(target,bytes,{mode:0o600});
    const meta={
      schema:'JM.BuildBinaryArtifact/0.2',artifactHash,jobId:job.jobId,builderId:job.builderId,
      engine:job.engine,target:job.target,createdAt:now(),file:fileName,mime:build.artifactMime||'application/octet-stream',
      bytes:bytes.length,filename:build.artifactName||fileName,sourceHash:build.sourceHash,
      receipt:build.nativeReceipt||null,onebody:build.onebody||null
    };
    fs.writeFileSync(path.join(artifacts,artifactHash+'.meta.json'),JSON.stringify(meta,null,2),{mode:0o600});
    state.artifacts[artifactHash]={...meta,receipt:undefined,onebody:undefined};
    return{artifactHash,artifact:meta};
  };

  function compileCadingNative(request){
    const source=String(request?.source||'');
    const target=String(request?.target||'javascript');
    if(!source.trim())throw Error('build source required');
    if(source.length>65536)throw Error('build source too large');
    if(target!=='javascript')throw Error('Build Cell v0.1 only registers javascript emission');
    let pipeline=null;
    const api=CompileCadingAPI.execute(API_SOURCE,{source,target},{
      compile:(input,requestedTarget)=>{
        const parsed=Parser.execute(PARSER_SOURCE,input);
        const compiled=Compiler.execute(COMPILER_SOURCE,parsed,requestedTarget);
        const emitted=JSEmitter.execute(JS_EMITTER_SOURCE,compiled.onebody);
        pipeline={
          parsed:{tree:parsed.tree,receipt:parsed.receipt},
          compiled:{onebody:compiled.onebody,output:compiled.output,receipt:compiled.receipt},
          emitted:{state:emitted.state,receipt:emitted.receipt}
        };
        return{receipt:emitted.receipt,onebody:compiled.onebody,code:emitted.state.code};
      }
    });
    if(!pipeline)throw Error('native compile pipeline returned no body');
    return{
      body:'compileCading API',
      engine:'compilecading-native',
      target,
      sourceHash:sha(source),
      nativeReceipt:api.receipt,
      nativeReceipts:{
        parser:pipeline.parsed.receipt,
        compiler:pipeline.compiled.receipt,
        emitter:pipeline.emitted.receipt,
        api:api.receipt
      },
      onebody:pipeline.compiled.onebody,
      output:pipeline.compiled.output,
      code:pipeline.emitted.state.code,
      codeDigest:pipeline.emitted.state.codeDigest,
      apiState:api.state
    };
  }

  async function buildAndroidNative(request){
    const source=String(request?.source||'');
    const html=String(request?.html||'');
    const target=String(request?.target||'android-apk');
    if(!source.trim())throw Error('android build source required');
    if(!html.trim())throw Error('android HTML body required');
    if(source.length>262144)throw Error('android Cading source too large');
    if(html.length>2_000_000)throw Error('android HTML body exceeds 2 MB ceiling');
    if(target!=='android-apk')throw Error('android-apk-native only registers android-apk target');
    const signing=androidSigning||androidSigningFromEnv();
    const result=await buildAndroidApk({source,html,filename:request?.filename||'<jm-build-cloud>',signing});
    const forged=result.forged;
    return{
      body:'JM Android Forge v1.4.1 / JMPhoneForge',
      engine:'android-apk-native',
      target,
      sourceHash:result.compiled.oneBody.provenance.sourceSha256,
      nativeReceipt:forged.receipt,
      nativeReceipts:{androidCompiler:{body:'JMForgeCore',schema:result.compiled.oneBody.schema,sourceSha256:result.compiled.oneBody.provenance.sourceSha256},phoneForge:forged.receipt},
      onebody:forged.emittedOneBody,
      output:{packageName:forged.packageName,filename:forged.filename,apkSha256:forged.apkSha256,apkBytes:forged.apk.length,signatureVerifiedInForge:forged.signatureVerified,signingBackend:forged.signingBackend,zipAlignment:forged.receipt.zipAlignment},
      binaryArtifact:forged.apk,
      artifactName:forged.filename,
      artifactExtension:'.apk',
      artifactMime:'application/vnd.android.package-archive',
      artifactSha256:forged.apkSha256,
      codeDigest:null,
      apiState:null
    };
  }

  const engines={'compilecading-native':compileCadingNative,'android-apk-native':buildAndroidNative};

  async function runJob(builder,job,request){
    const spaceId=('build_'+job.jobId).replace(/[^A-Za-z0-9._:-]/g,'_');
    const cloudSpace=await cloud('POST','/v5/spaces',adminToken,{
      spaceId,
      label:'JM Build Job '+job.jobId,
      kind:'jm-build-job',
      metadata:{profile:'JM.BuildCell/0.2',builderId:builder.builderId,jobId:job.jobId,engine:job.engine,target:job.target},
      members:[{id:'builder',type:'jm-build-executor',label:'JM Build Cell '+builder.builderId,capabilities:['event:write']}]
    });
    const executor=cloudSpace.credentials?.builder;
    if(!executor)throw Error('cloud did not return build executor credential');
    job.cloudSpaceId=spaceId;
    await cloud('POST','/v5/spaces/'+encodeURIComponent(spaceId)+'/events',executor,{event:{type:'build.job.queued',payload:{jobId:job.jobId,builderId:job.builderId,engine:job.engine,target:job.target,sourceHash:job.sourceHash}}});
    job.status='running';job.startedAt=now();persist();
    try{
      const build=await engines[job.engine](request);
      const {artifactHash}=build.binaryArtifact
        ? writeBinaryArtifact(job,build)
        : writeArtifact(job,{sourceHash:build.sourceHash,onebody:build.onebody,output:build.output,code:build.code,codeDigest:build.codeDigest,nativeReceipts:build.nativeReceipts,apiState:build.apiState});
      job.artifactHash=artifactHash;
      job.nativeReceipt=build.nativeReceipt;
      job.nativeReceipts=build.nativeReceipts;
      job.codeDigest=build.codeDigest||null;
      job.artifactName=build.artifactName||null;
      job.artifactMime=build.artifactMime||'application/json';
      job.apkSha256=build.artifactSha256||null;
      job.status='completed';job.completedAt=now();
      await cloud('POST','/v5/spaces/'+encodeURIComponent(spaceId)+'/events',executor,{event:{type:'build.job.completed',payload:{jobId:job.jobId,artifactHash,codeDigest:job.codeDigest,nativeReceipt:job.nativeReceipt}}});
    }catch(e){
      job.status='failed';job.failedAt=now();job.error=String(e?.message||e);
      await cloud('POST','/v5/spaces/'+encodeURIComponent(spaceId)+'/events',executor,{event:{type:'build.job.failed',payload:{jobId:job.jobId,error:job.error}}});
    }
    await cloud('POST','/v5/spaces/'+encodeURIComponent(spaceId)+'/close',adminToken,{});
    const cloudReceipt=(await cloud('GET','/v5/spaces/'+encodeURIComponent(spaceId)+'/receipt',adminToken)).receipt;
    job.cloudReceiptHash=cloudReceipt?.receiptHash||null;
    const receipt=localReceipt('build.job.'+job.status,{
      jobId:job.jobId,builderId:job.builderId,engine:job.engine,target:job.target,status:job.status,
      sourceHash:job.sourceHash,artifactHash:job.artifactHash||null,codeDigest:job.codeDigest||null,
      nativeReceiptDigest:job.nativeReceipt?.resultDigest||sha(job.nativeReceipt||null),cloudReceiptHash:job.cloudReceiptHash
    });
    job.buildReceiptHash=receipt.receiptHash;persist();
    return{job,receipt,cloudReceipt};
  }

  const publicBuilder=b=>({builderId:b.builderId,label:b.label,policy:b.policy,createdAt:b.createdAt,jobCount:Object.values(state.jobs).filter(j=>j.builderId===b.builderId).length});
  const publicJob=j=>({jobId:j.jobId,builderId:j.builderId,engine:j.engine,target:j.target,status:j.status,sourceHash:j.sourceHash,createdAt:j.createdAt,startedAt:j.startedAt||null,completedAt:j.completedAt||null,failedAt:j.failedAt||null,error:j.error||null,artifactHash:j.artifactHash||null,artifactName:j.artifactName||null,artifactMime:j.artifactMime||null,apkSha256:j.apkSha256||null,codeDigest:j.codeDigest||null,cloudSpaceId:j.cloudSpaceId||null,cloudReceiptHash:j.cloudReceiptHash||null,buildReceiptHash:j.buildReceiptHash||null,nativeReceipt:j.nativeReceipt||null,nativeReceipts:j.nativeReceipts||null});

  async function handle(req,res,u){
    const p=u.pathname;if(!(p==='/build'||p.startsWith('/build/')))return false;
    try{
      if(req.method==='GET'&&p==='/build/v1/meta'){send(res,200,{ok:true,schema:state.schema,name:'JM Build Cell',version:'0.2',route:'SOURCE -> REGISTERED JM BUILD ENGINE -> ARTIFACT -> CLOUD TRACE -> RECEIPT',engines:Object.keys(engines),targets:['javascript','android-apk'],mountedBodies:['Parser','Compiler','OneBody IR','JS Emitter','compileCading API','JMForgeCore v1.4.1','JMPhoneForge v1.4.1','JM CLOUD CONTACT SERVER'],heldEngines:['jmgradle-local-host','aosp-system-image'],forbidden:['arbitrary shell','arbitrary process execution','unregistered build engine','undeclared target','embedded recovered private signing key'],claimBoundary:'v0.2 proves Batch Five JavaScript compilation plus JM Android Forge v1.4.1 static APK emission with runtime signing custody. The historical local JMGradle host server, AOSP system images, release signing and physical install remain separately gated.'});return true}
      if(req.method==='GET'&&p==='/build/v1/ready'){let errors=[];try{fs.mkdirSync(artifacts,{recursive:true});fs.accessSync(artifacts,fs.constants.W_OK)}catch{errors.push('artifact directory not writable')}send(res,errors.length?503:200,{ok:!errors.length,ready:!errors.length,version:'0.2',engineCount:Object.keys(engines).length,builderCount:Object.keys(state.builders).length,jobCount:Object.keys(state.jobs).length,artifactCount:Object.keys(state.artifacts).length,heldEngines:['jmgradle-local-host','aosp-system-image'],errors});return true}
      if(req.method==='POST'&&p==='/build/v1/builders'){if(!requireAdmin(req,res))return true;const j=await body(req),builderId=String(j.builderId||uid('builder'));if(!safeId(builderId)||state.builders[builderId]){send(res,400,{ok:false,error:'invalid or existing builderId'});return true}const builder={builderId,label:String(j.label||builderId).slice(0,120),policy:{engines:['compilecading-native','android-apk-native'],targets:['javascript','android-apk'],maxSourceBytes:262144,maxHtmlBytes:2000000,arbitraryShell:false,arbitraryProcess:false,signingCustody:'runtime-injected'},createdAt:now()};state.builders[builderId]=builder;const receipt=localReceipt('build.builder.created',{builderId,policy:builder.policy});persist();send(res,201,{ok:true,builder:publicBuilder(builder),receipt});return true}
      if(req.method==='GET'&&p==='/build/v1/builders'){if(!requireAdmin(req,res))return true;send(res,200,{ok:true,builders:Object.values(state.builders).map(publicBuilder)});return true}
      let m=p.match(/^\/build\/v1\/builders\/([^/]+)\/jobs$/);
      if(req.method==='POST'&&m){if(!requireAdmin(req,res))return true;const builder=state.builders[decodeURIComponent(m[1])];if(!builder){send(res,404,{ok:false,error:'builder not found'});return true}const j=await body(req),engine=String(j.engine||'compilecading-native'),target=String(j.target||'javascript');if(!builder.policy.engines.includes(engine)||!engines[engine]){send(res,400,{ok:false,error:'engine not allowed',allowed:builder.policy.engines});return true}if(!builder.policy.targets.includes(target)){send(res,400,{ok:false,error:'target not allowed',allowedTargets:builder.policy.targets});return true}const source=String(j.source||''),jobId=uid('buildjob');const job={jobId,builderId:builder.builderId,engine,target,status:'queued',sourceHash:sha(source),createdAt:now()};state.jobs[jobId]=job;persist();const result=await runJob(builder,job,{source,target,html:j.html,filename:j.filename});send(res,job.status==='completed'?201:422,{ok:job.status==='completed',...result,job:publicJob(job)});return true}
      m=p.match(/^\/build\/v1\/jobs\/([^/]+)$/);
      if(req.method==='GET'&&m){if(!requireAdmin(req,res))return true;const job=state.jobs[decodeURIComponent(m[1])];if(!job){send(res,404,{ok:false,error:'build job not found'});return true}send(res,200,{ok:true,job:publicJob(job)});return true}
      m=p.match(/^\/build\/v1\/artifacts\/([a-f0-9]{64})\/download$/);
      if(req.method==='GET'&&m){if(!requireAdmin(req,res))return true;const meta=state.artifacts[m[1]];if(!meta){send(res,404,{ok:false,error:'build artifact not found'});return true}if(!String(meta.mime||'').includes('android.package-archive')){send(res,409,{ok:false,error:'artifact is not a downloadable APK'});return true}const target=path.join(artifacts,path.basename(meta.file));let bytes;try{bytes=fs.readFileSync(target)}catch{send(res,410,{ok:false,error:'APK artifact carrier missing',meta});return true}const actual=crypto.createHash('sha256').update(bytes).digest('hex');if(actual!==meta.artifactHash){send(res,409,{ok:false,error:'APK artifact hash mismatch'});return true}res.writeHead(200,{'content-type':meta.mime,'content-length':bytes.length,'content-disposition':'attachment; filename="'+String(meta.filename||meta.file).replace(/"/g,'')+'"','cache-control':'no-store'});res.end(bytes);return true}
      m=p.match(/^\/build\/v1\/artifacts\/([a-f0-9]{64})$/);
      if(req.method==='GET'&&m){if(!requireAdmin(req,res))return true;const meta=state.artifacts[m[1]];if(!meta){send(res,404,{ok:false,error:'build artifact not found'});return true}const target=path.join(artifacts,path.basename(meta.file));if(String(meta.mime||'')==='application/vnd.android.package-archive'){let artifact;try{artifact=JSON.parse(fs.readFileSync(path.join(artifacts,meta.artifactHash+'.meta.json'),'utf8'))}catch{send(res,410,{ok:false,error:'APK artifact metadata missing',meta});return true}send(res,200,{ok:true,meta,artifact,download:'/build/v1/artifacts/'+meta.artifactHash+'/download'});return true}let artifact;try{artifact=JSON.parse(fs.readFileSync(target,'utf8'))}catch{send(res,410,{ok:false,error:'build artifact carrier missing',meta});return true}if(sha(artifact)!==meta.artifactHash){send(res,409,{ok:false,error:'build artifact hash mismatch'});return true}send(res,200,{ok:true,meta,artifact});return true}
      if(req.method==='GET'&&p==='/build/v1/receipts'){if(!requireAdmin(req,res))return true;send(res,200,{ok:true,receipts:state.receipts.slice(-100).reverse()});return true}
      send(res,404,{ok:false,error:'build route not found'});return true;
    }catch(e){send(res,400,{ok:false,error:String(e?.message||e)});return true}
  }
  return{handle};
}
