import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createZezuHistoryReturn} from '../zezu/JM_ZEZU_HISTORY_RETURN_PROFILE_v0_1.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const fixture=fs.readFileSync(path.resolve(__dirname,'../zezu/fixtures/ZEZU_NWONA_PORTABLE_HISTORY_CAPSULE_v0_5.json'));
const expectedSha='58d6cbd2ce62325b6ba75cacdd0e50949a5a05eef5e1946d8d9190ccc6b1b38f';
const tmp=path.resolve(__dirname,'../.qa-data/zezu-history-v0-1.json');
fs.mkdirSync(path.dirname(tmp),{recursive:true});
try{fs.rmSync(tmp,{force:true})}catch{}
const profile=createZezuHistoryReturn({serverSecret:'qa-secret-'.padEnd(64,'z'),dataFile:tmp});
const server=http.createServer(async(q,r)=>{
  const u=new URL(q.url,'http://127.0.0.1');
  if(await profile.handle(q,r,u))return;
  r.writeHead(404);r.end();
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port;
let pass=0,total=0;
function t(name,ok,detail=''){total++;if(ok)pass++;console.log((ok?'PASS':'FAIL')+' | '+name+(detail?' | '+detail:''))}
async function j(method,route,payload){
  const rr=await fetch(base+route,{method,headers:{'content-type':'application/json'},body:payload===undefined?undefined:JSON.stringify(payload)});
  let body;try{body=await rr.json()}catch{body={}};
  return{status:rr.status,body};
}
try{
  const sourceSha=crypto.createHash('sha256').update(fixture).digest('hex');
  t('fixture exact source SHA',sourceSha===expectedSha,sourceSha);

  const meta=await j('GET','/zezu/v1/meta');
  t('meta exposes bounded proof gate',meta.status===200&&meta.body.expectedCarrierSha256===expectedSha);

  const post=await j('POST','/zezu/v1/history',{carrierBase64:fixture.toString('base64')});
  t('server accepts exact capsule',post.status===201&&post.body.ok===true);
  t('outer SHA verified server-side',post.body.verification?.carrierSha256===expectedSha);
  t('inner ledger root verified',post.body.verification?.ledgerRoot==='b4fa1ab09394cd106d5e3e3264f98357b4bd2c36a42f7d10acc8baa325829951');
  t('inner continuation root verified',post.body.verification?.continuationRoot==='15d462dcd575c1d81632f47b58046a322bbce61c1c0964b1d923601b5c4fa1d6');
  t('blocked receipt remembered but excluded',post.body.verification?.blockedReceiptCount===1&&post.body.verification?.blockedReceiptsExcludedFromContinuation===true);
  const returned=Buffer.from(post.body.carrierBase64,'base64');
  t('POST returns exact bytes',Buffer.compare(returned,fixture)===0);
  t('server receipt issued',!!post.body.receipt?.receiptHash&&!!post.body.receipt?.serverSig);

  const get=await j('GET','/zezu/v1/history/'+encodeURIComponent(post.body.historyId));
  t('GET returns stored exact bytes',get.status===200&&Buffer.compare(Buffer.from(get.body.carrierBase64,'base64'),fixture)===0);

  const again=await j('POST','/zezu/v1/history',{carrierBase64:fixture.toString('base64')});
  t('exact repeat deduplicates',again.status===201&&again.body.deduplicated===true&&again.body.receipt?.receiptHash===post.body.receipt?.receiptHash);

  const tampered=Buffer.from(fixture);tampered[tampered.length-2]^=1;
  const bad=await j('POST','/zezu/v1/history',{carrierBase64:tampered.toString('base64')});
  t('tampered carrier refused',bad.status===422&&bad.body.ok===false);

  const ready=await j('GET','/zezu/v1/ready');
  t('ready reports one bounded stored history',ready.status===200&&ready.body.stored===1);
}finally{
  await new Promise(ok=>server.close(ok));
  try{fs.rmSync(tmp,{force:true})}catch{}
}
console.log('TOTAL '+pass+'/'+total);
if(pass!==total)process.exit(1);
