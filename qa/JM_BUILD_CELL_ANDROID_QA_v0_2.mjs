import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
import {createBuildCellProfile} from '../build/JM_BUILD_CELL_PROFILE_v0_2.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const tmp=path.join(root,'.qa-build-v02-android');
fs.rmSync(tmp,{recursive:true,force:true});fs.mkdirSync(tmp,{recursive:true});
const admin='A'.repeat(48),secret='S'.repeat(48),port=18974;
const checks=[],cloudSpaces=new Map(),cloudCalls=[];
const pass=(name,detail=true)=>checks.push({name,pass:true,detail});
const fail=(name,e)=>checks.push({name,pass:false,detail:String(e?.message||e)});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');

function makeSigning(){
  const keyPem=path.join(tmp,'qa-key.pem'),certPem=path.join(tmp,'qa-cert.pem');
  const keyDer=path.join(tmp,'qa-key.pk8'),certDer=path.join(tmp,'qa-cert.der'),pubDer=path.join(tmp,'qa-pub.der');
  execFileSync('openssl',['genpkey','-algorithm','RSA','-pkeyopt','rsa_keygen_bits:2048','-out',keyPem],{stdio:'ignore'});
  execFileSync('openssl',['req','-new','-x509','-key',keyPem,'-out',certPem,'-days','2','-subj','/CN=JM Build Cloud Ephemeral QA/O=JM/C=GB'],{stdio:'ignore'});
  execFileSync('openssl',['pkcs8','-topk8','-nocrypt','-in',keyPem,'-outform','DER','-out',keyDer],{stdio:'ignore'});
  execFileSync('openssl',['x509','-in',certPem,'-outform','DER','-out',certDer],{stdio:'ignore'});
  execFileSync('openssl',['pkey','-in',keyPem,'-pubout','-outform','DER','-out',pubDer],{stdio:'ignore'});
  const cert=fs.readFileSync(certDer);
  return{
    privateKeyPkcs8B64:fs.readFileSync(keyDer).toString('base64'),
    certificateDerB64:cert.toString('base64'),
    publicKeySpkiB64:fs.readFileSync(pubDer).toString('base64'),
    certificateSha256:hash(cert)
  };
}

async function fakeCloud(method,route,token,payload){
  cloudCalls.push({method,route});
  if(method==='POST'&&route==='/v5/spaces'){
    const s={...payload,status:'active',events:[]};cloudSpaces.set(payload.spaceId,s);
    return{ok:true,space:s,credentials:{builder:'exec_'+payload.spaceId}};
  }
  const m=route.match(/^\/v5\/spaces\/([^/]+)\/(events|close|receipt)$/);
  if(!m)throw Error('fake cloud route '+method+' '+route);
  const id=decodeURIComponent(m[1]),op=m[2],s=cloudSpaces.get(id);if(!s)throw Error('space missing');
  if(method==='POST'&&op==='events'){if(token!=='exec_'+id)throw Error('builder auth');s.events.push({event:payload.event});return{ok:true}}
  if(method==='POST'&&op==='close'){if(token!==admin)throw Error('admin close');s.status='closed';return{ok:true,space:s}}
  if(method==='GET'&&op==='receipt'){if(token!==admin)throw Error('admin receipt');const receiptHash=hash(Buffer.from(JSON.stringify({id,status:s.status,events:s.events})));return{ok:true,receipt:{schema:'jm.cloud-contact.space-receipt/0.5',spaceId:id,status:s.status,eventCount:s.events.length,receiptHash,publicSig:'QA',publicKeyId:'QA'}}}
  throw Error('unsupported cloud op');
}

const signing=makeSigning();
const profile=createBuildCellProfile({
  port,adminToken:admin,serverSecret:secret,
  dataFile:path.join(tmp,'state.json'),
  artifactDir:path.join(tmp,'artifacts'),
  cloudRequest:fakeCloud,
  androidSigning:signing
});
const server=http.createServer(async(req,res)=>{const u=new URL(req.url,'http://127.0.0.1:'+port);if(await profile.handle(req,res,u))return;res.writeHead(404);res.end()});
const base='http://127.0.0.1:'+port;
async function jsonReq(url,{method='GET',token=null,body=null}={}){
  const h={};if(token)h.authorization='Bearer '+token;if(body!==null)h['content-type']='application/json';
  const r=await fetch(base+url,{method,headers:h,body:body===null?undefined:JSON.stringify(body)});
  const t=await r.text();let j;try{j=JSON.parse(t)}catch{j={raw:t}};return{r,j};
}
async function bytesReq(url,token){
  const r=await fetch(base+url,{headers:{authorization:'Bearer '+token}});
  return{r,bytes:new Uint8Array(await r.arrayBuffer())};
}

const bodies=['Cading','Kading','JMLogic','FlowTalk','RouteCode','Quadze','OneBody IR','CadenVM','CodeHand','RouteOS','TraceBox','THEO','Build Gates','Zionfolder'];
const source=`module com.jm.cloud.apkqa
family: JM Cloud APK QA
owner: Theodore Benjamin Scott / JM
version: 1.0.0

${bodies.map(x=>'body '+x).join('\n')}

android:
  package: com.jm.cloud.apkqa
  appName: JM Cloud APK QA
  artifactName: JM_CLOUD_APK_QA
  versionName: 1.0.0
  versionCode: 1
  minSdk: 23
  targetSdk: 35
  compileSdk: 35
  asset: app/index.html
end

flow build:
  step sourceGate
  step intentLock
  step oneBody
  step androidProject
  step packageUnsigned
  step alignPackage
  step signDebug
  step verifyPackage
  goto receipt
end

route build -> receipt
`;
const html='<!doctype html><meta charset="utf-8"><title>JM Cloud APK QA</title><h1>JM-owned cloud APK contact</h1>';

try{
  await new Promise((ok,no)=>server.listen(port,'127.0.0.1',e=>e?no(e):ok()));
  let x=await jsonReq('/build/v1/meta');
  if(x.r.ok&&x.j.version==='0.2'&&x.j.engines.includes('android-apk-native')&&x.j.heldEngines.includes('jmgradle-local-host'))pass('meta-android-engine-plus-host-hold',x.j);else throw Error(JSON.stringify(x.j));

  x=await jsonReq('/build/v1/ready');
  if(x.r.ok&&x.j.engineCount===2)pass('ready-two-build-engines',x.j.engineCount);else throw Error(JSON.stringify(x.j));

  x=await jsonReq('/build/v1/builders',{method:'POST',token:admin,body:{builderId:'android-cloud'}});
  if(x.r.status===201&&x.j.builder.policy.engines.includes('android-apk-native')&&x.j.builder.policy.signingCustody==='runtime-injected')pass('android-builder-policy',x.j.builder.policy);else throw Error(JSON.stringify(x.j));

  x=await jsonReq('/build/v1/builders/android-cloud/jobs',{method:'POST',token:admin,body:{engine:'android-apk-native',target:'android-apk',source,html,filename:'qa/app.jm.cading'}});
  if(x.r.status===201&&x.j.job.status==='completed')pass('android-cloud-job-completed',x.j.job.jobId);else throw Error(JSON.stringify(x.j));
  const job=x.j.job;
  if(job.nativeReceipt?.status==='PASS_STATIC_PHONE_EMISSION'&&job.nativeReceipt?.signatureVerifiedInForge===true&&job.nativeReceipt?.zipAlignment?.pass===true)pass('jmphoneforge-static-sign-alignment-receipt',{status:job.nativeReceipt.status,signature:job.nativeReceipt.signatureScheme});else throw Error('forge receipt incomplete');
  if(job.nativeReceipts?.androidCompiler?.schema==='jm.onebody.android/v1'&&job.nativeReceipts?.phoneForge?.apkSha256===job.apkSha256)pass('jmforgecore-onebody-to-phoneforge-receipts',job.apkSha256);else throw Error('android receipt chain mismatch');
  if(job.artifactHash===job.apkSha256&&/^[a-f0-9]{64}$/.test(job.artifactHash))pass('apk-content-addressed-by-own-sha',job.artifactHash);else throw Error('apk content address');

  x=await jsonReq('/build/v1/artifacts/'+job.artifactHash,{token:admin});
  if(x.r.ok&&x.j.meta?.mime==='application/vnd.android.package-archive'&&x.j.download?.endsWith('/download')&&x.j.artifact?.onebody?.schema==='jm.onebody.android/v1')pass('apk-metadata-artifact',x.j.download);else throw Error(JSON.stringify(x.j));

  const dl=await bytesReq('/build/v1/artifacts/'+job.artifactHash+'/download',admin);
  if(dl.r.ok&&dl.bytes[0]===0x50&&dl.bytes[1]===0x4b&&hash(Buffer.from(dl.bytes))===job.apkSha256)pass('apk-download-bytes-and-sha',{bytes:dl.bytes.length,sha:job.apkSha256});else throw Error('apk download verification');

  const zip=await JSZip.loadAsync(dl.bytes);
  const embeddedSource=await zip.file('assets/JM_SOURCE.jm.cading')?.async('text');
  const embeddedHtml=await zip.file('assets/index.html')?.async('text');
  const embeddedOneBody=JSON.parse(await zip.file('assets/JM_ONEBODY.json')?.async('text'));
  if(embeddedSource===source&&embeddedHtml===html&&embeddedOneBody.schema==='jm.onebody.android/v1'&&embeddedOneBody.identity?.owner==='Theodore Benjamin Scott / JM')pass('apk-roundtrip-source-html-onebody',{package:embeddedOneBody.android.package,bodies:embeddedOneBody.bodies.length});else throw Error('APK embedded-body roundtrip failed');

  x=await jsonReq('/build/v1/builders/android-cloud/jobs',{method:'POST',token:admin,body:{engine:'node-shell',target:'android-apk',source,html}});
  if(x.r.status===400&&!x.j.allowed.includes('node-shell'))pass('foreign-shell-build-engine-rejected',x.j.allowed);else throw Error('shell engine gate');

  const stateRaw=fs.readFileSync(path.join(tmp,'state.json'),'utf8');
  if(!stateRaw.includes(signing.privateKeyPkcs8B64)&&!stateRaw.includes(signing.certificateDerB64))pass('signing-material-not-persisted-in-build-state','PASS');else throw Error('signing material persisted');

  if(cloudSpaces.size===1&&[...cloudSpaces.values()][0].status==='closed')pass('android-build-cloud-space-closed',1);else throw Error('cloud space closure');
}catch(e){fail('fatal',e)}
finally{await new Promise(r=>server.close(()=>r()))}

const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;
const receipt={schema:'JM.BuildCell.QA/0.2',body:'JM Build Cell v0.2 Android APK',passed,failed,checks,claimBoundary:'QA proves JMForgeCore -> JMPhoneForge static signed APK emission with ephemeral QA signing identity. It does not prove release signing, physical install, local JMGradle host recovery or AOSP system-image construction.'};
console.log(JSON.stringify(receipt,null,2));
fs.writeFileSync(path.join(root,'qa','JM_BUILD_CELL_ANDROID_QA_RECEIPT_v0_2.json'),JSON.stringify(receipt,null,2));
if(failed)process.exit(1);
