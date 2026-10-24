// Separate admin-side READ-ONLY host verifier. No member or RD producer tokens are loaded.
// It promotes only the LOCAL inbox after a public-key-pinned ECDSA host receipt+event chain.
import {DatabaseSync} from 'node:sqlite';
import {verifySpaceReceipt,canon} from './v05-proof.mjs';
import {immutableProbeFingerprint} from './v05-bridge.mjs';
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
const safe=s=>typeof s==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(s);
function validateOrigin(origin,localMock){
 const u=new URL(origin);
 if(u.href==='https://jm-cloud-contact-server-v05.onrender.com/')return u.origin;
 if(localMock===true&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password)return u.origin;
 throw Error('ADMIN_HOST_NOT_ALLOWLISTED');
}
export async function reconcileHost({cloudUrl,spaceId,memberId,dbFile,adminToken,pinnedKeyId,fetcher=fetch,localMock=false}){
 if(!safe(spaceId)||!safe(memberId)||typeof adminToken!=='string'||adminToken.length<32)throw Error('ADMIN_AUTHORITY_REQUIRED');
 if(typeof pinnedKeyId!=='string'||!/^[a-f0-9]{24}$/.test(pinnedKeyId))throw Error('PIN_REQUIRED');
 const origin=validateOrigin(cloudUrl,localMock);
 const call=async route=>{
  const r=await fetcher(origin+route,{method:'GET',redirect:'error',headers:route==='/receipt-key'?{}:{authorization:'Bearer '+adminToken},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('ADMIN_HTTP_'+r.status);
  const t=await r.text();if(t.length>2000000)throw Error('HOST_RESPONSE_TOO_LARGE');
  const j=JSON.parse(t);if(j.ok!==true)throw Error('ADMIN_RESPONSE_HOLD');return j;
 };
 const db=new DatabaseSync(dbFile,{timeout:5000});
 try{
  const candidates=db.prepare("SELECT * FROM inbox WHERE phase IN ('REMOTE_UNCERTAIN','RESULT_HTTP_ACKNOWLEDGED') ORDER BY command_id").all();
  if(!candidates.length)return {signed_host_receipt:'NOT_REQUIRED',statuses:[]};
  const root='/v5/spaces/'+encodeURIComponent(spaceId);
  const [keyResponse,hostedReceipt,deep]=await Promise.all([call('/receipt-key'),call(root+'/receipt'),call(root)]);
  const verified=verifySpaceReceipt({receipt:hostedReceipt.receipt,keyResponse,pin:pinnedKeyId,deep:deep.space});
  if(verified.space_id!==spaceId)throw Error('SPACE_ID_MISMATCH');
  const statuses=[];
  for(const row of candidates){
   const command=deep.space.commands.find(c=>c.id===row.command_id);
   if(!command||command.target!==memberId||command.action!=='probe') {statuses.push({id:row.command_id,phase:'HOLD',reason:'COMMAND_MISSING_OR_WRONG'});continue;}
   // These immutable details were not included in v0.5's original signed journal.
   // Never resolve a lost ACK/RESULT for a command whose challenge has changed.
   try{if(immutableProbeFingerprint(command,memberId,{historical:true})!==row.fingerprint)throw Error('FINGERPRINT_CHANGED');}
   catch(e){statuses.push({id:row.command_id,phase:'HOLD',reason:'HOST_COMMAND_FINGERPRINT_DRIFT'});continue;}
   if(!/^[a-f0-9]{64}$/.test(row.challenge_hash||'')||row.challenge_hash!==sha(command.payload.nonce)){statuses.push({id:row.command_id,phase:'HOLD',reason:'LOCAL_CHALLENGE_BINDING_MISSING'});continue;}
   const queuedEvents=deep.space.events.filter(e=>e.event?.type==='command.queued'&&e.event?.payload?.commandId===row.command_id);
   if(queuedEvents.length!==1||queuedEvents[0].event.payload.payloadSha256!==sha(canon(command.payload??null))||queuedEvents[0].event.payload.requestId!==(command.requestId??null)){
     statuses.push({id:row.command_id,phase:'HOLD',reason:'QUEUED_PAYLOAD_NOT_CRYPTO_BOUND'});continue;
   }
   const resultEvidence=deep.space.events.some(e=>e.event?.type==='command.result'&&e.event?.payload?.commandId===row.command_id&&e.event?.payload?.status==='completed');
   const ackEvidence=deep.space.events.some(e=>e.event?.type==='command.ack'&&e.event?.payload?.commandId===row.command_id&&e.event?.payload?.status==='accepted');
   if(command.status==='completed'&&command.result?.ok===true&&command.result.kind==='JM_RD_PROBE'&&command.result.detail?.missionId===row.mission_id&&command.result.detail?.commandFingerprint===row.fingerprint&&command.result.detail?.localJobHash===JSON.parse(row.local_receipt).job_hash&&command.result.detail?.localReceiptChain===JSON.parse(row.local_receipt).chain_hash&&command.result.detail?.challengeSha256===row.challenge_hash&&JSON.parse(row.local_receipt).content_hash===row.challenge_hash&&resultEvidence){
    // A signed summary alone does not sign result.detail. Require chain-bound digest too.
    const resultEvents=deep.space.events.filter(e=>e.event?.type==='command.result'&&e.event?.payload?.commandId===row.command_id);
    if(resultEvents.length!==1||resultEvents[0].event.payload.detailSha256!==sha(canon(command.result?.detail??null))){
      statuses.push({id:row.command_id,phase:'HOLD',reason:'RESULT_DETAIL_NOT_CRYPTO_BOUND'});continue;
    }
    db.prepare("UPDATE inbox SET phase='RESULT_CONFIRMED',last_error=NULL WHERE command_id=? AND phase IN ('REMOTE_UNCERTAIN','RESULT_HTTP_ACKNOWLEDGED')").run(row.command_id);
    statuses.push({id:row.command_id,phase:'RESULT_CONFIRMED',proof:verified.receipt_hash,detailBinding:'ECDSA_CHAIN_BOUND'});
   }else if(command.status==='accepted'&&command.ack?.status==='accepted'&&ackEvidence&&row.phase==='REMOTE_UNCERTAIN'){
    db.prepare("UPDATE inbox SET phase='ACK_CONFIRMED',last_error=NULL WHERE command_id=? AND phase='REMOTE_UNCERTAIN'").run(row.command_id);
    statuses.push({id:row.command_id,phase:'ACK_CONFIRMED',proof:verified.receipt_hash});
   }else statuses.push({id:row.command_id,phase:'HOLD',reason:'NO_VERIFIED_CRYPTOGRAPHIC_HOST_STAGE'});
  }
  return {signed_host_receipt:'PASS',statuses};
 }finally{db.close();}
}
