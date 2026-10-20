/** CP18: JM-authoritative V5 passby. Creates a real event and checks signed owner-space receipt.
 * No third-party sends, no provider spend, no embedded secrets. Separate from deployed source.
 */
import {createHash,createPublicKey,verify as verifySignature} from 'node:crypto';
import {canonical} from './jmcc-domino-passby.mjs';
const hash = x => createHash('sha256').update(x).digest('hex');
const fail=x=>{throw Error(x)};
function limitedUrl(value,testMode){
 const u=new URL(value);
 if(u.username||u.password||u.hash||u.search||u.pathname!=='/')fail('URL_NOT_ROOT_OR_HAS_SECRETS');
 if(testMode){if(u.protocol!=='http:'||u.hostname!=='127.0.0.1')fail('TEST_SERVER_REQUIRES_LOOPBACK')}
 else if(u.protocol!=='https:')fail('PRODUCTION_REQUIRES_HTTPS');
 return u.origin;
}
async function readJSON(url,token,method='GET',body=undefined){
 const res=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(8000),headers:{'authorization':'Bearer '+token,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 let raw=''; for await(const x of res.body){raw+=Buffer.from(x).toString();if(Buffer.byteLength(raw)>131072)fail('RESPONSE_TOO_LARGE')}
 let v;try{v=JSON.parse(raw)}catch{fail('BAD_SERVER_JSON')}
 if(!res.ok||v.ok===false)fail('SERVER_HTTP_'+res.status);
 return v;
}
export function makeV5Passby({baseUrl,spaceId,memberToken,adminToken,testMode=false,enabled=false,expectedPublicKeyId=null}={}){
 if(!enabled)fail('JM_V5_PORT_DISABLED');
 if(!/^[A-Za-z0-9._:-]{1,128}$/.test(spaceId||''))fail('BAD_SPACE_ID');
 if(typeof memberToken!=='string'||memberToken.length<32||typeof adminToken!=='string'||adminToken.length<32||memberToken===adminToken)fail('SEPARATE_TOKENS_REQUIRED');
 const root=limitedUrl(baseUrl,testMode), prefix=root+'/v5/spaces/'+encodeURIComponent(spaceId);
 if(!testMode&&(!expectedPublicKeyId||!/^[-_a-zA-Z0-9]{8,128}$/.test(expectedPublicKeyId)))fail('PINNED_SERVER_SIGNER_REQUIRED');
 return {
  async execute({stage,contact,nonce}){
   if(stage.action!=='jm.submit')fail('ACTION_NOT_ALLOWED');
   if(!contact?.id||!nonce)fail('CONTACT_REQUIRED');
   const contactHash=hash(canonical(contact));
   const requestId=`jmcc-cp18-${hash(contact.id).slice(0,24)}`;
   const event={type:'jmcc.domino.passby',contactId:contact.id,route:contact.route,contactHash,stage:stage.id,nonce};
   const r=await readJSON(prefix+'/events',memberToken,'POST',{requestId,event});
   if(!r.record?.hash||r.record?.event?.requestId!==requestId||r.record.event.contactHash!==contactHash)fail('ACK_MISSING_OR_MISMATCH');
   return {eventHash:r.record.hash,requestId,contactHash,contactId:contact.id,stageId:stage.id,deduplicated:r.deduplicated===true};
  },
  async verify({stage,contact,ack}){
   if(!ack||ack.contactId!==contact.id||ack.stageId!==stage.id||ack.contactHash!==hash(canonical(contact)))return false;
   const [state,proof,key]=await Promise.all([readJSON(prefix,adminToken),readJSON(prefix+'/receipt',adminToken),readJSON(root+'/receipt-key','')]);
   const event=state.space?.events?.find(x=>x.hash===ack.eventHash);
   if(!event||event.event?.contactId!==contact.id||event.event?.contactHash!==ack.contactHash||event.event.requestId!==ack.requestId)return false;
   const p=proof.receipt;
   if(!p||!p.publicSig||p.spaceId!==spaceId||p.chainHead!==state.space.chainHead||p.publicKeyId!==key.keyId||!key.publicKeyJwk)return false;
   if(expectedPublicKeyId&&p.publicKeyId!==expectedPublicKeyId)return false;
   // Receipt key binding: publicly exposed by the contacted server; production requires an owner-pinned key ID.
   const pub=createPublicKey({key:key.publicKeyJwk,format:'jwk'});
   return verifySignature('sha256',Buffer.from(p.receiptHash),{key:pub,dsaEncoding:'ieee-p1363'},Buffer.from(p.publicSig,'base64url'));
  }
 }
}
export const v5ContactRoute={id:'CP18_JM_SIGNED',stages:[{id:'JM_AUTHORITATIVE_EVENT',action:'jm.submit',port:'jmV5'}]};
