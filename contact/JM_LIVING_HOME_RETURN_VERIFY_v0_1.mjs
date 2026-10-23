// JM Living Home CP07/09 -> existing v0.5 signed signal verifier.
// Reads one user's saved CP07 ledger; makes ONLY authenticated GET requests;
// compares the actual returned server signal bytes and independently verifies
// the server ECDSA receipt. Never stores member credentials or dispatches work.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ID=/^[A-Za-z0-9._:-]{1,128}$/;
const HEX=/^[0-9a-f]{32}$/;
export const PROOF_SCHEMA='JM.LivingHome.SignedReturnEvidence/1';
const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v):
  Array.isArray(v)?'['+v.map(canon).join(',')+']':
  '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
const sha=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
export function serverOrigin(input,{allowLocal=false}={}){
  let u;try{u=new URL(String(input))}catch{throw Error('Expected an HTTPS server origin')}
  if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||
     (u.protocol!=='https:'&&!(allowLocal&&u.protocol==='http:'&&u.hostname==='127.0.0.1'))||
     (!allowLocal&&u.port))throw Error('HTTPS server origin required; no userinfo, path, query, fragment or custom port');
  return u.origin;
}
export function verifyReceipt(receipt,originalPayload,keyMeta){
  if(!receipt||receipt.schema!=='jm.cloud-contact.signal-receipt/0.5')throw Error('Missing signed v0.5 receipt');
  if(keyMeta?.ok!==true||keyMeta.algorithm!=='ECDSA-P256-SHA256-P1363'||!keyMeta.publicKeyJwk)
    throw Error('Server public-key contract mismatch');
  const keyFingerprint=sha(canon(keyMeta.publicKeyJwk)).slice(0,24);
  if(receipt.publicKeyId!==keyMeta.keyId||receipt.publicKeyId!==keyFingerprint)
    throw Error('Receipt key ID differs from server public key');
  if(receipt.signatureAlgorithm!==keyMeta.algorithm)throw Error('Unrecognised signature algorithm');
  if(receipt.payloadSha256!==sha(canon(originalPayload)))throw Error('Exact returned payload digest mismatch');
  const core=Object.fromEntries(Object.entries(receipt).filter(([name])=>!
    ['receiptHash','publicSig','publicKeyId','signatureAlgorithm','claimBoundary'].includes(name)));
  if(receipt.receiptHash!==sha(canon(core)))throw Error('Signed receipt digest mismatch');
  let key;try{key=crypto.createPublicKey({key:keyMeta.publicKeyJwk,format:'jwk'})}
  catch{throw Error('Malformed public signing key')}
  if(typeof receipt.publicSig!=='string'||!crypto.verify('sha256',Buffer.from(receipt.receiptHash),
       {key,dsaEncoding:'ieee-p1363'},Buffer.from(receipt.publicSig,'base64url')))
     throw Error('ECDSA public-signature check failed');
  return true;
}
export async function verifyLivingHomeReturn({
  baseUrl,spaceId,memberId,memberToken,ledger,missionId,
  pinnedKeyId='',fetchImpl=fetch,allowLocal=false
}={}){
  const base=serverOrigin(baseUrl,{allowLocal});
  if(!ID.test(spaceId||'')||!ID.test(memberId||''))throw Error('Invalid member or space identifier');
  if(typeof memberToken!=='string'||memberToken.length<8)throw Error('Member bearer credential required');
  if(!ledger||ledger.schema!=='JM.LivingHome.CP07.CloudReturn/1.0'||
    !Array.isArray(ledger.missions)||ledger.missions.length>80)throw Error('Not a bounded CP07 return ledger');
  const candidates=ledger.missions.filter(x=>x?.state==='RETURN_RECEIVED_UNVERIFIED'&&
    (!missionId||x.missionId===missionId));
  if(candidates.length!==1)throw Error('Select exactly one matched CP07 mission');
  const row=candidates[0];
  if(!ID.test(row.missionId)||!HEX.test(row.challenge)||!Number.isSafeInteger(row.returnSignalId)||
    row.returnSignalId<=0||row.origin!==base||row.spaceId!==spaceId||
    !ID.test(row.to||'')||!row.outgoing||
    row.outgoing.schema!=='JM.LivingHome.CloudMission/1.0'||
    row.outgoing.missionId!==row.missionId||row.outgoing.challenge!==row.challenge||
    row.outgoing.project!==row.project||typeof row.returnText!=='string'||
    row.returnText.length>3000)throw Error('CP07 return binding invalid');
  async function get(route,secret=false){
    const headers={Accept:'application/json'};
    if(secret)headers.Authorization='Bearer '+memberToken;
    let response=await fetchImpl(base+route,{headers,signal:AbortSignal.timeout(12000),redirect:'error',cache:'no-store'});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||data.ok!==true)
      throw Error('Server GET '+route.split('?')[0]+' refused: HTTP '+response.status);
    return data;
  }
  const keyMeta=await get('/receipt-key');
  if(pinnedKeyId&&(!/^[0-9a-f]{24}$/.test(pinnedKeyId)||pinnedKeyId!==keyMeta.keyId))
    throw Error('Server signing key differs from the owner-pinned key ID');
  const root='/v4/spaces/'+encodeURIComponent(spaceId);
  const fetched=await get(root+'/signals?after=0',true);
  if(!Array.isArray(fetched.signals))throw Error('No recipient signals returned');
  const signal=fetched.signals.find(x=>x.id===row.returnSignalId);
  if(!signal||signal.kind!=='JM_LIVING_HOME_RETURN'||signal.from!==row.to||
    signal.to!==memberId||signal.payload?.schema!=='JM.LivingHome.CloudReturn/1.0'||
    signal.payload.missionId!==row.missionId||signal.payload.challenge!==row.challenge)
     throw Error('Actual server return does not match saved CP07 mission identity');
  const resultText=typeof signal.payload.result==='string'?signal.payload.result:
    JSON.stringify(signal.payload.result??'');
  if(resultText!==row.returnText)throw Error('Server reply text differs from CP07 export');
  const got=await get(root+'/signals/'+signal.id+'/receipt',true);
  const receipt=got.receipt;
  verifyReceipt(receipt,signal.payload,keyMeta);
  if(receipt.spaceId!==spaceId||receipt.signalId!==signal.id||
     receipt.to!==memberId||receipt.from!==row.to||
     receipt.kind!=='JM_LIVING_HOME_RETURN')
     throw Error('Signed signal scope does not match expected members');
  // Return only public evidence and project/mission metadata, never the member token.
  return {schema:PROOF_SCHEMA,status:'SERVER_RETURN_SIGNATURE_VERIFIED',
    claimBoundary:'Server-signed persisted signal matching CP07 local record; remote work, AI identity and physical Fold action remain independently unverified',
    origin:base,spaceId,memberId,from:row.to,missionId:row.missionId,
    project:row.project,sourceId:row.outgoing.source?.id||null,
    challenge:row.challenge,returnSignalId:signal.id,
    signalReceiptHash:receipt.receiptHash,payloadSha256:receipt.payloadSha256,
    signature:receipt.publicSig,publicKeyId:keyMeta.keyId,
    keyPinVerified:Boolean(pinnedKeyId),
    observedVia:'member-authenticated GET /v4/signals and /v4/signals/:id/receipt',
    verifiedAt:new Date().toISOString()};
}
async function main(args=process.argv.slice(2)){
  if(args.includes('--help')||!args.includes('--ledger')){
    console.log('Read-only verified return: node contact/JM_LIVING_HOME_RETURN_VERIFY_v0_1.mjs --ledger /path/to/CP07-return.json --host https://jm-cloud-contact-server-v05.onrender.com --space SPACE --member MEMBER [--mission ID] [--key-id PINNED24HEX]');
    console.log('Put member token in JM_LIVING_HOME_MEMBER_TOKEN environment privately; never in CLI flags, URL, chat or exported ledger.');
    return;
  }
  const arg=key=>{const n=args.indexOf(key);return n<0?'':args[n+1]||''};
  const input=arg('--ledger');
  const raw=await fs.readFile(input,'utf8');
  if(Buffer.byteLength(raw)>250000)throw Error('Ledger exceeds 250 KB');
  const ledger=JSON.parse(raw);
  const result=await verifyLivingHomeReturn({
    baseUrl:arg('--host'),spaceId:arg('--space'),memberId:arg('--member'),
    memberToken:process.env.JM_LIVING_HOME_MEMBER_TOKEN,ledger,
    missionId:arg('--mission')||undefined,pinnedKeyId:arg('--key-id')
  });
  console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(error=>{console.error('JM LIVING HOME HOLD · '+error.message);process.exitCode=1});
