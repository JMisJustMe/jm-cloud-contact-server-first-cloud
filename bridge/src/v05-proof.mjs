// Verify the JM Cloud Contact v0.5 canonical receipt format recovered from upstream GitHub.
// Signature: ECDSA-P256 SHA256, P1363, signed over UTF-8 receiptHash HEX (not raw digest).
import {createHash,createPublicKey,verify as cryptoVerify} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function canon(v){
  if(v===null||typeof v!=='object')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
}
const validKeyId=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
export function keyIdFor(jwk){
  if(!jwk||jwk.kty!=='EC'||jwk.crv!=='P-256'||typeof jwk.x!=='string'||typeof jwk.y!=='string'||!jwk.x||!jwk.y)throw Error('BAD_PUBLIC_KEY');
  const k=createPublicKey({key:jwk,format:'jwk'});
  if(k.asymmetricKeyType!=='ec'||k.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('BAD_PUBLIC_CURVE');
  return hash(canon(jwk)).slice(0,24);
}
const receiptFields=['schema','spaceId','label','kind','status','createdAt','updatedAt','members','eventCount','commandCount','signalCount','chainHead'];
export function verifySpaceReceipt({receipt,keyResponse,pin,deep,commandId,expectedTarget,expectedMissionId,expectedCommandFingerprint,expectedLocalReceiptChain,expectedLocalJobHash,requireBoundDetails=false}){
  if(!validKeyId(pin))throw Error('PIN_REQUIRED');
  if(!keyResponse||keyResponse.ok!==true||keyResponse.algorithm!=='ECDSA-P256-SHA256-P1363')throw Error('BAD_KEY_RESPONSE');
  const id=keyIdFor(keyResponse.publicKeyJwk);
  if(keyResponse.keyId!==id||pin!==id)throw Error('SIGNER_ID_MISMATCH');
  if(!receipt||receipt.schema!=='jm.cloud-contact.space-receipt/0.5'||receipt.publicKeyId!==id||receipt.signatureAlgorithm!=='ECDSA-P256-SHA256-P1363')throw Error('BAD_RECEIPT_SCHEMA');
  const snapshot=Object.fromEntries(receiptFields.map(k=>[k,receipt[k]]));
  if(!receiptFields.every(k=>Object.hasOwn(receipt,k)))throw Error('RECEIPT_FIELDS_MISSING');
  const digest=hash(canon(snapshot));
  if(!/^[a-f0-9]{64}$/.test(receipt.receiptHash||'')||receipt.receiptHash!==digest)throw Error('RECEIPT_HASH_MISMATCH');
  if(typeof receipt.publicSig!=='string'||!/^[-_A-Za-z0-9]{86}$/.test(receipt.publicSig))throw Error('MALFORMED_SIGNATURE');
  const signature=Buffer.from(receipt.publicSig,'base64url');
  if(signature.length!==64||!cryptoVerify('sha256',Buffer.from(digest),{key:createPublicKey({key:keyResponse.publicKeyJwk,format:'jwk'}),dsaEncoding:'ieee-p1363'},signature))throw Error('INVALID_PUBLIC_SIGNATURE');
  const evidence={signer_id:id,receipt_hash:digest,receipt_status:receipt.status,space_id:receipt.spaceId,cryptographic_receipt:'PASS',command_evidence:'NOT_REQUESTED'};
  if(deep!==undefined){
    if(!deep||deep.spaceId!==receipt.spaceId||deep.eventCount!==receipt.eventCount||deep.commandCount!==receipt.commandCount||deep.signalCount!==receipt.signalCount||deep.chainHead!==receipt.chainHead)throw Error('SNAPSHOT_MISMATCH');
    if(!Array.isArray(deep.events)||!Array.isArray(deep.commands))throw Error('BAD_SNAPSHOT');
    // The hosted receipt signs the public snapshot; do not accept a different admin deep-read public snapshot.
    for(const field of ['label','kind','status','createdAt','updatedAt','members'])
      if(canon(deep[field])!==canon(receipt[field]))throw Error('PUBLIC_SNAPSHOT_DRIFT');
    let chain='0'.repeat(64);
    if(deep.events.length&&deep.events[0].seq!==1)throw Error('TRUNCATED_EVENT_HISTORY_HOLD');
    for(const event of deep.events){
      const core={seq:event.seq,at:event.at,memberId:event.memberId,source:event.source,event:event.event};
      const expected=hash(chain+'\n'+canon(core));
      if(event.prevHash!==chain||event.hash!==expected)throw Error('BROKEN_EVENT_CHAIN');
      chain=expected;
    }
    if(chain!==receipt.chainHead||deep.events.length!==receipt.eventCount)throw Error('CHAIN_HEAD_MISMATCH');
    evidence.event_chain='PASS';
    if(commandId!==undefined){
      const command=deep.commands.find(c=>c.id===commandId);
      if(!command||command.action!=='probe'||command.target!==expectedTarget||command.status!=='completed'||command.ack?.status!=='accepted'||command.result?.ok!==true||command.result?.kind!=='JM_RD_PROBE'||command.result?.detail?.missionId!==expectedMissionId)throw Error('HOSTED_COMMAND_NOT_CONFIRMED');
      const hasResult=deep.events.some(e=>e.event?.type==='command.result'&&e.event?.payload?.commandId===commandId&&e.event?.payload?.status==='completed');
      if(!hasResult)throw Error('HOSTED_RESULT_EVENT_MISSING');
      if(expectedCommandFingerprint!==undefined&&command.result.detail?.commandFingerprint!==expectedCommandFingerprint)throw Error('HOSTED_FINGERPRINT_MISMATCH');
      if(expectedLocalReceiptChain!==undefined&&command.result.detail?.localReceiptChain!==expectedLocalReceiptChain)throw Error('HOSTED_LOCAL_CHAIN_MISMATCH');
      if(expectedLocalJobHash!==undefined&&command.result.detail?.localJobHash!==expectedLocalJobHash)throw Error('HOSTED_LOCAL_JOB_MISMATCH');
      if(requireBoundDetails){
        const queuedEvents=deep.events.filter(e=>e.event?.type==='command.queued'&&e.event?.payload?.commandId===commandId);
        const resultEvents=deep.events.filter(e=>e.event?.type==='command.result'&&e.event?.payload?.commandId===commandId&&e.event?.payload?.status==='completed');
        if(queuedEvents.length!==1||resultEvents.length!==1)throw Error('BOUND_COMMAND_EVENT_CARDINALITY_HOLD');
        const queued=queuedEvents[0].event.payload,finished=resultEvents[0].event.payload;
        if(queued.payloadSha256!==hash(canon(command.payload??null)) || queued.requestId!==(command.requestId??null))throw Error('QUEUED_PAYLOAD_NOT_CRYPTO_BOUND');
        if(finished.detailSha256!==hash(canon(command.result?.detail??null)))throw Error('RESULT_DETAIL_NOT_CRYPTO_BOUND');
        evidence.command_evidence='ECDSA_CHAIN_BINDS_PAYLOAD_AND_RESULT_DETAIL';
      }else{
        // Legacy host journal signs status/kind, NOT full command payload or result detail.
        // Authenticated HTTPS admin readback is a different, weaker assurance boundary.
        evidence.command_evidence='SIGNED_STATUS_PLUS_TLS_DETAIL_READBACK_NOT_CRYPTO_BOUND';
      }
    }
  }
  return evidence;
}
