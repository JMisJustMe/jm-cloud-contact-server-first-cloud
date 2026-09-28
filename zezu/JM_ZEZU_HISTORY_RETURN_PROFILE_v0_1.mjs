import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const EXPECTED_SHA='58d6cbd2ce62325b6ba75cacdd0e50949a5a05eef5e1946d8d9190ccc6b1b38f';
const EXPECTED_SCHEMA='zezu.nwona.portable-history-return/0.5';
const MAX_CARRIER_BYTES=16*1024;

const now=()=>new Date().toISOString();
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const canon=v=>v===null||typeof v!=='object'
  ? JSON.stringify(v)
  : Array.isArray(v)
    ? '['+v.map(canon).join(',')+']'
    : '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';

export function createZezuHistoryReturn({serverSecret,dataFile}){
  const file=dataFile||path.resolve('./JM_ZEZU_HISTORY_STATE_v0_1.json');
  const sig=x=>crypto.createHmac('sha256',serverSecret).update(String(x)).digest('base64url');
  let state;
  try{state=JSON.parse(fs.readFileSync(file,'utf8'))}catch{state={schema:'zezu.nwona.server-history-store/0.1',records:{}}}
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
    q.on('data',c=>{n+=c.length;if(n>128*1024){reject(Error('body too large'));q.destroy()}else chunks.push(c)});
    q.on('end',()=>{try{resolve(chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{})}catch{reject(Error('invalid json'))}});
    q.on('error',reject);
  });

  function verifyCarrier(raw){
    if(!Buffer.isBuffer(raw))raw=Buffer.from(raw);
    if(raw.length<2||raw.length>MAX_CARRIER_BYTES)return{ok:false,error:'carrier size outside bounded proof gate'};
    const carrierSha256=sha(raw);
    if(carrierSha256!==EXPECTED_SHA)return{ok:false,error:'carrier SHA-256 is not the admitted v0.5 proof carrier',carrierSha256};
    let capsule;
    try{capsule=JSON.parse(raw.toString('utf8'))}catch{return{ok:false,error:'carrier is not valid JSON'}};
    if(capsule.schema!==EXPECTED_SCHEMA)return{ok:false,error:'unexpected capsule schema'};
    const ledger=Array.isArray(capsule.ledger)?capsule.ledger:[];
    if(!ledger.length||ledger.length!==capsule.ledgerCount)return{ok:false,error:'ledger count mismatch'};

    const errors=[],seen=new Map();
    for(let i=0;i<ledger.length;i++){
      const r=ledger[i],body={...r},given=String(r.receiptHash||'');
      delete body.receiptHash;
      const computed=sha(Buffer.from(canon(body),'utf8'));
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

    const by=new Map(ledger.map(r=>[r.receiptHash,r]));
    const continuationPath=[];
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

  async function handle(q,r,u){
    const p=u.pathname;
    if(!(p==='/zezu'||p.startsWith('/zezu/')))return false;
    try{
      if(q.method==='GET'&&p==='/zezu'){send(r,200,{ok:true,name:'zezu.nwona History Return Mount',version:'0.1',route:'CONTACT -> VERIFY -> STORE -> RETURN -> RECEIPT',proofGate:'exact v0.5 capsule only'});return true}
      if(q.method==='GET'&&p==='/zezu/v1/meta'){send(r,200,{ok:true,schema:'zezu.nwona.server-history-store/0.1',expectedCarrierSha256:EXPECTED_SHA,maxCarrierBytes:MAX_CARRIER_BYTES,stored:Object.keys(state.records).length,law:'CHRONOLOGY != CONTINUATION LINEAGE',claimBoundary:'This mount proves bounded server-side history verification/store/return for the admitted proof carrier; it is not a generic anonymous storage service.'});return true}
      if(q.method==='GET'&&p==='/zezu/v1/ready'){send(r,200,{ok:true,ready:true,stored:Object.keys(state.records).length});return true}
      if(q.method==='POST'&&p==='/zezu/v1/history'){
        const j=await body(q);
        if(typeof j.carrierBase64!=='string') {send(r,400,{ok:false,error:'carrierBase64 required'});return true}
        let raw;
        try{raw=Buffer.from(j.carrierBase64,'base64')}catch{send(r,400,{ok:false,error:'invalid base64'});return true}
        const verification=verifyCarrier(raw);
        if(!verification.ok){send(r,422,{ok:false,...verification});return true}
        const historyId='zn_'+verification.carrierSha256.slice(0,24);
        let rec=state.records[historyId],deduplicated=!!rec;
        if(!rec){
          const core={
            schema:'zezu.nwona.server-history-receipt/0.1',
            historyId,
            storedAt:now(),
            carrierSha256:verification.carrierSha256,
            bytes:verification.bytes,
            ledgerRoot:verification.ledgerRoot,
            continuationRoot:verification.continuationRoot,
            continuationHead:verification.continuationHead,
            continuationPath:verification.continuationPath,
            blockedReceiptsExcludedFromContinuation:verification.blockedReceiptsExcludedFromContinuation,
            route:'POST -> SHA256 -> INNER VERIFY -> STORE EXACT BYTES -> RETURN'
          };
          const receiptHash=sha(Buffer.from(canon(core),'utf8'));
          const receipt={...core,receiptHash,serverSig:sig('zezu-history-receipt\n'+receiptHash)};
          rec={historyId,carrierBase64:raw.toString('base64'),verification,receipt};
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

  return{handle,verifyCarrier,status:()=>({stored:Object.keys(state.records).length,file})};
}
