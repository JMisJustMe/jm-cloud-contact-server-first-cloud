import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const now=()=>new Date().toISOString();
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const canon=v=>v===null||typeof v!=='object'
  ? JSON.stringify(v)
  : Array.isArray(v)
    ? '['+v.map(canon).join(',')+']'
    : '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';

export function createZezuHistoryReturn({serverSecret,dataFile,admissionManifest}){
  const file=dataFile||path.resolve('./JM_ZEZU_HISTORY_STATE_CURRENT.json');
  const manifestFile=admissionManifest||path.resolve('./zezu/JM_ZEZU_HISTORY_ADMISSION_MANIFEST_CURRENT.json');
  const manifestDir=path.dirname(manifestFile);
  const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
  const admissions=new Map((manifest.carriers||[]).map(x=>[x.sha256,x]));
  const maxBytes=Math.max(1024,+manifest.maxCarrierBytes||32768);
  const sig=x=>crypto.createHmac('sha256',serverSecret).update(String(x)).digest('base64url');

  let state;
  try{state=JSON.parse(fs.readFileSync(file,'utf8'))}catch{state={schema:'zezu.nwona.server-history-store/0.2',records:{}}}
  state.schema='zezu.nwona.server-history-store/0.2';
  state.records=state.records||{};

  const persist=()=>{
    fs.mkdirSync(path.dirname(file),{recursive:true});
    const tmp=file+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify(state,null,2),{mode:0o600});
    fs.renameSync(tmp,file);
  };
  const send=(r,code,value)=>{
    const raw=JSON.stringify(value);
    r.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','content-length':Buffer.byteLength(raw),'x-content-type-options':'nosniff'});
    r.end(raw);
  };
  const body=q=>new Promise((resolve,reject)=>{
    let n=0,chunks=[];
    q.on('data',c=>{n+=c.length;if(n>256*1024){reject(Error('body too large'));q.destroy()}else chunks.push(c)});
    q.on('end',()=>{try{resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{})}catch{reject(Error('invalid json'))}});
    q.on('error',reject);
  });

  function verifyCarrier(raw){
    if(!Buffer.isBuffer(raw))raw=Buffer.from(raw);
    if(raw.length<2||raw.length>maxBytes)return{ok:false,error:'carrier size outside bounded admission gate'};
    const carrierSha256=sha(raw),admission=admissions.get(carrierSha256);
    if(!admission)return{ok:false,error:'carrier SHA-256 is not present in the bounded admission manifest',carrierSha256};
    if(+admission.bytes&&raw.length!==+admission.bytes)return{ok:false,error:'admitted carrier byte count mismatch',carrierSha256,admissionId:admission.id};
    let capsule;
    try{capsule=JSON.parse(raw.toString('utf8'))}catch{return{ok:false,error:'carrier is not valid JSON',carrierSha256}};
    if(capsule.schema!==admission.schema)return{ok:false,error:'carrier schema does not match admission manifest',carrierSha256,admissionId:admission.id};
    const ledger=Array.isArray(capsule.ledger)?capsule.ledger:[];
    if(!ledger.length||ledger.length!==capsule.ledgerCount)return{ok:false,error:'ledger count mismatch',carrierSha256,admissionId:admission.id};

    const errors=[],seen=new Map();
    for(let i=0;i<ledger.length;i++){
      const r=ledger[i],rb={...r},given=String(r.receiptHash||'');
      delete rb.receiptHash;
      const computed=sha(Buffer.from(canon(rb),'utf8'));
      if(given!==computed)errors.push({index:i,code:'RECEIPT_HASH_MISMATCH'});
      const expectedPrev=i?ledger[i-1].receiptHash:null;
      if((r.ledgerPreviousHash??null)!==(expectedPrev??null))errors.push({index:i,code:'CHRONOLOGY_LINK_MISMATCH'});
      if(r.previousReceiptHash){
        const pi=seen.get(r.previousReceiptHash);
        if(pi===undefined||pi>=i)errors.push({index:i,code:'ORPHAN_CONTINUATION_PARENT'});
        else if(r.chain?.requested&&String(ledger[pi].state1??'')!==String(r.state0??''))errors.push({index:i,code:'CONTINUATION_STATE_MISMATCH'});
      }
      if(given)seen.set(given,i);
    }
    const ledgerRoot=sha(Buffer.from(ledger.map(r=>r.receiptHash).join('\n')+'\n','utf8'));
    if(ledgerRoot!==capsule.ledgerRoot)errors.push({code:'LEDGER_ROOT_MISMATCH'});

    const by=new Map(ledger.map(r=>[r.receiptHash,r])),continuationPath=[];
    let h=capsule.continuationHead,guard=new Set();
    while(h){
      if(guard.has(h)){errors.push({code:'CONTINUATION_CYCLE'});break}
      guard.add(h);
      const r=by.get(h);
      if(!r){errors.push({code:'CONTINUATION_ORPHAN',hash:h});break}
      continuationPath.push(h);
      h=r.previousReceiptHash||null;
    }
    continuationPath.reverse();
    const continuationRoot=sha(Buffer.from(continuationPath.join('\n')+'\n','utf8'));
    if(continuationRoot!==capsule.continuationRoot)errors.push({code:'CONTINUATION_ROOT_MISMATCH'});

    const blocked=ledger.filter(r=>r.continuation==='BLOCKED'||String(r.inheritance||'').includes('BLOCK'));
    const blockedExcluded=blocked.every(r=>!continuationPath.includes(r.receiptHash));

    return{
      ok:errors.length===0,
      error:errors.length?'inner history verification failed':null,
      admissionId:admission.id,
      admissionStatus:admission.status,
      carrierSchema:admission.schema,
      carrierSha256,
      bytes:raw.length,
      ledgerCount:ledger.length,
      ledgerRoot,
      continuationRoot,
      continuationHead:capsule.continuationHead,
      continuationPath,
      blockedReceiptCount:blocked.length,
      blockedReceiptsExcludedFromContinuation:blockedExcluded,
      errors
    };
  }

  function recordFor(raw,verification,sourceMode){
    const historyId='zn_'+verification.carrierSha256.slice(0,24);
    const admission=admissions.get(verification.carrierSha256);
    const core={
      schema:'zezu.nwona.server-history-receipt/0.2',
      historyId,
      admissionId:verification.admissionId,
      admittedAt:admission?.admittedAt||null,
      carrierSha256:verification.carrierSha256,
      bytes:verification.bytes,
      ledgerRoot:verification.ledgerRoot,
      continuationRoot:verification.continuationRoot,
      continuationHead:verification.continuationHead,
      continuationPath:verification.continuationPath,
      blockedReceiptsExcludedFromContinuation:verification.blockedReceiptsExcludedFromContinuation,
      sourceMode,
      recoveryMode:'bundled-canonical-admission',
      route:'ADMISSION -> SHA256 -> INNER VERIFY -> RECOVERABLE CACHE -> RETURN'
    };
    const receiptHash=sha(Buffer.from(canon(core),'utf8'));
    const receipt={...core,receiptHash,serverSig:sig('zezu-history-receipt\n'+receiptHash)};
    return{historyId,carrierBase64:raw.toString('base64'),verification,receipt};
  }

  const boot={attempted:0,recovered:0,errors:[]};
  for(const admission of manifest.carriers||[]){
    boot.attempted++;
    try{
      const raw=fs.readFileSync(path.resolve(manifestDir,admission.fixture));
      const verification=verifyCarrier(raw);
      if(!verification.ok)throw Error(verification.error||'verification failed');
      const id='zn_'+verification.carrierSha256.slice(0,24);
      if(!state.records[id]||state.records[id].verification?.carrierSha256!==verification.carrierSha256){
        state.records[id]=recordFor(raw,verification,'canonical-boot-recovery');
      }
      boot.recovered++;
    }catch(e){boot.errors.push({admissionId:admission.id,error:String(e.message||e)})}
  }
  if(boot.recovered)try{persist()}catch{}

  async function handle(q,r,u){
    const p=u.pathname;
    if(!(p==='/zezu'||p.startsWith('/zezu/')))return false;
    try{
      if(q.method==='GET'&&p==='/zezu'){send(r,200,{ok:true,name:'zezu.nwona History Return Mount',version:'0.2',route:'ADMIT -> VERIFY -> RECOVER/STORE -> RETURN -> RECEIPT',proofGate:'bounded immutable admission manifest'});return true}
      if(q.method==='GET'&&p==='/zezu/v1/meta'){send(r,200,{ok:true,schema:state.schema,manifestSchema:manifest.schema,current:manifest.current,mode:manifest.mode,maxCarrierBytes:maxBytes,admissions:(manifest.carriers||[]).map(x=>({id:x.id,status:x.status,schema:x.schema,sha256:x.sha256,bytes:x.bytes})),stored:Object.keys(state.records).length,boot,law:manifest.law,claimBoundary:'Multiple explicitly admitted immutable lineage carriers are supported. Arbitrary anonymous storage is not.'});return true}
      if(q.method==='GET'&&p==='/zezu/v1/ready'){send(r,boot.errors.length?503:200,{ok:!boot.errors.length,ready:!boot.errors.length,stored:Object.keys(state.records).length,admitted:admissions.size,boot});return true}
      if(q.method==='POST'&&p==='/zezu/v1/history'){
        const j=await body(q);
        if(typeof j.carrierBase64!=='string'){send(r,400,{ok:false,error:'carrierBase64 required'});return true}
        let raw;try{raw=Buffer.from(j.carrierBase64,'base64')}catch{send(r,400,{ok:false,error:'invalid base64'});return true}
        const verification=verifyCarrier(raw);
        if(!verification.ok){send(r,422,{ok:false,...verification});return true}
        const historyId='zn_'+verification.carrierSha256.slice(0,24);
        let rec=state.records[historyId],deduplicated=!!rec;
        if(!rec){
          rec=recordFor(raw,verification,'public-or-local-post');
          state.records[historyId]=rec;
          persist();
        }
        send(r,201,{ok:true,deduplicated,historyId,verification:rec.verification,receipt:rec.receipt,carrierBase64:rec.carrierBase64});
        return true;
      }
      const m=p.match(/^\/zezu\/v1\/history\/([A-Za-z0-9._:-]+)$/);
      if(q.method==='GET'&&m){
        const rec=state.records[m[1]];
        if(!rec){send(r,404,{ok:false,error:'history not found'});return true}
        send(r,200,{ok:true,historyId:rec.historyId,verification:rec.verification,receipt:rec.receipt,carrierBase64:rec.carrierBase64});
        return true;
      }
      send(r,404,{ok:false,error:'zezu route not found'});return true;
    }catch(e){send(r,400,{ok:false,error:String(e.message||e)});return true}
  }

  return{
    handle,
    verifyCarrier,
    status:()=>({stored:Object.keys(state.records).length,file,manifestFile,current:manifest.current,admitted:admissions.size,boot,recoveryMode:'bundled-canonical-admission'})
  };
}
