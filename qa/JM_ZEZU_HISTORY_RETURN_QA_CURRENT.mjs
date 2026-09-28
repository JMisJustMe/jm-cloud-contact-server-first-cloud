import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createZezuHistoryReturn} from '../zezu/JM_ZEZU_HISTORY_RETURN_PROFILE_CURRENT.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(__dirname,'..');
const f5=fs.readFileSync(path.join(root,'zezu/fixtures/ZEZU_NWONA_PORTABLE_HISTORY_CAPSULE_v0_5.json'));
const f8=fs.readFileSync(path.join(root,'zezu/fixtures/ZEZU_NWONA_PORTABLE_HISTORY_CAPSULE_v0_8.json'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const expected5='58d6cbd2ce62325b6ba75cacdd0e50949a5a05eef5e1946d8d9190ccc6b1b38f';
const expected8='133a1016ebbd8f8d84fbaa8c35db9acbf617e76a2c10c3ef08970554a606750d';
const tmp=path.join(root,'.qa-data/zezu-history-current.json');
fs.mkdirSync(path.dirname(tmp),{recursive:true});try{fs.rmSync(tmp,{force:true})}catch{}

const make=()=>createZezuHistoryReturn({
  serverSecret:'qa-secret-'.padEnd(64,'z'),
  dataFile:tmp,
  admissionManifest:path.join(root,'zezu/JM_ZEZU_HISTORY_ADMISSION_MANIFEST_CURRENT.json')
});
let profile=make(),pass=0,total=0;
const t=(name,ok,detail='')=>{total++;if(ok)pass++;console.log((ok?'PASS':'FAIL')+' | '+name+(detail?' | '+detail:''))};
const start=async pr=>{const server=http.createServer(async(q,r)=>{const u=new URL(q.url,'http://127.0.0.1');if(await pr.handle(q,r,u))return;r.writeHead(404);r.end()});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));return server};
const req=async(server,method,route,payload)=>{const rr=await fetch('http://127.0.0.1:'+server.address().port+route,{method,headers:{'content-type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});let b;try{b=await rr.json()}catch{b={}}return{status:rr.status,body:b}};

let server=await start(profile);
try{
  t('v0.5 source SHA',sha(f5)===expected5,sha(f5));
  t('v0.8 descendant SHA',sha(f8)===expected8,sha(f8));
  const st=profile.status();
  t('two carriers admitted',st.admitted===2);
  t('boot recovered both canonical carriers',st.boot.recovered===2&&st.boot.errors.length===0);

  const meta=await req(server,'GET','/zezu/v1/meta');
  t('manifest current points v0.8',meta.status===200&&meta.body.current==='v0.8-hosted-return-descendant');
  t('bounded multi-carrier metadata',meta.body.admissions?.length===2&&meta.body.mode==='bounded-immutable-admission');

  const id5='zn_'+expected5.slice(0,24),id8='zn_'+expected8.slice(0,24);
  const g5=await req(server,'GET','/zezu/v1/history/'+id5);
  t('v0.5 GET works without prior POST',g5.status===200&&sha(Buffer.from(g5.body.carrierBase64,'base64'))===expected5);
  const g8=await req(server,'GET','/zezu/v1/history/'+id8);
  t('v0.8 GET works without prior POST',g8.status===200&&sha(Buffer.from(g8.body.carrierBase64,'base64'))===expected8);
  t('v0.8 ledger root verified',g8.body.verification?.ledgerRoot==='555ce0f88790616caee5592a723cfc7bf36693a9f9560302be66b0a1ee5a746f');
  t('v0.8 continuation root verified',g8.body.verification?.continuationRoot==='c0e37c7923fa6de847e7c0c06b069183c336bd4458d99ae5164031e26629c2e0');
  t('v0.8 blocked history excluded',g8.body.verification?.blockedReceiptCount===1&&g8.body.verification?.blockedReceiptsExcludedFromContinuation===true);

  const p5=await req(server,'POST','/zezu/v1/history',{carrierBase64:f5.toString('base64')});
  t('v0.5 POST admitted/deduplicated',p5.status===201&&p5.body.deduplicated===true&&p5.body.verification?.admissionId==='v0.5-portable-return');
  const p8=await req(server,'POST','/zezu/v1/history',{carrierBase64:f8.toString('base64')});
  t('v0.8 POST admitted/deduplicated',p8.status===201&&p8.body.deduplicated===true&&p8.body.verification?.admissionId==='v0.8-hosted-return-descendant');

  const bad=Buffer.from(f8);bad[bad.length-2]^=1;
  const rb=await req(server,'POST','/zezu/v1/history',{carrierBase64:bad.toString('base64')});
  t('tampered/unlisted carrier refused',rb.status===422&&rb.body.ok===false);

  await new Promise(ok=>server.close(ok));
  fs.rmSync(tmp,{force:true});
  profile=make(); server=await start(profile);
  const after=await req(server,'GET','/zezu/v1/history/'+id8);
  t('cold recovery survives deleted runtime cache',after.status===200&&sha(Buffer.from(after.body.carrierBase64,'base64'))===expected8&&profile.status().boot.recovered===2);
  const ready=await req(server,'GET','/zezu/v1/ready');
  t('ready after cold recovery',ready.status===200&&ready.body.ready===true&&ready.body.stored===2);
}finally{
  if(server.listening)await new Promise(ok=>server.close(ok));
  try{fs.rmSync(tmp,{force:true})}catch{}
}
console.log('TOTAL '+pass+'/'+total);
if(pass!==total)process.exit(1);
