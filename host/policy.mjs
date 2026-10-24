// JM CP-C17 — Narrow owner-hosted authority, no surprise external targets.
import crypto from 'node:crypto';
export const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
export const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
export function signerKeyId(privatePem){
 const key=crypto.createPrivateKey(privatePem);
 const pub=crypto.createPublicKey(key).export({format:'jwk'});
 if(pub.kty!=='EC'||pub.crv!=='P-256')throw Error('SIGNER_MUST_BE_P256');
 return sha(canon(pub)).slice(0,24);
}
export function requireLocalCustody({stateUrl,fenceUrl}){
 const check=(str,hostname,db,user)=>{
  let u;try{u=new URL(str)}catch{throw Error('POSTGRES_URL_INVALID')}
  if(u.protocol!=='postgres:'&&u.protocol!=='postgresql:')throw Error('POSTGRES_PROTOCOL_REQUIRED');
  if(u.hostname!==hostname||u.pathname!=='/'+db||u.username!==user||!u.password||u.port&&u.port!=='5432'||u.search||u.hash)throw Error('REFUSE_UNAPPROVED_DATABASE_TARGET');
  return u;
 };
 check(stateUrl,'contact-db','jm_contact','jm_contact');
 check(fenceUrl,'fence-db','jm_fence','jm_fence');
 if(stateUrl===fenceUrl)throw Error('SEPARATE_STORES_REQUIRED');
 return true;
}
export function requireConfig(env){
 const needed=['JM_CLOUD_ADMIN_TOKEN','JM_CLOUD_SERVER_SECRET','JM_CLOUD_RECEIPT_SIGNING_KEY_B64','JM_CLOUD_EXPECTED_SIGNING_KEY_ID','JM_CLOUD_WRITER_FENCE_OWNER','JM_CLOUD_WRITER_FENCE_EPOCH','JM_SPACE_ID','JM_MEMBER_ID'];
 for(const k of needed)if(!env[k])throw Error('MISSING_OWNER_SETTING_'+k);
 if(env.JM_CLOUD_ADMIN_TOKEN.length<32||env.JM_CLOUD_SERVER_SECRET.length<32)throw Error('WEAK_OWNER_TOKENS');
 if(env.JM_CLOUD_WRITER_FENCE_EPOCH!=='1')throw Error('INITIAL_OWNER_EPOCH_REQUIRED');
 if(!/^[A-Za-z0-9._:-]{1,128}$/.test(env.JM_CLOUD_WRITER_FENCE_OWNER)||!/^[A-Za-z0-9._:-]{1,128}$/.test(env.JM_SPACE_ID)||!/^[A-Za-z0-9._:-]{1,128}$/.test(env.JM_MEMBER_ID))throw Error('INVALID_SCOPE_IDENTIFIER');
 const pem=Buffer.from(env.JM_CLOUD_RECEIPT_SIGNING_KEY_B64,'base64').toString('utf8');
 if(signerKeyId(pem)!==env.JM_CLOUD_EXPECTED_SIGNING_KEY_ID)throw Error('PIN_MISMATCH');
 return {keyId:env.JM_CLOUD_EXPECTED_SIGNING_KEY_ID,owner:env.JM_CLOUD_WRITER_FENCE_OWNER,spaceId:env.JM_SPACE_ID};
}
export function requireLocalCloudUrl(url,{allowCompose=false}={}){
 let u;try{u=new URL(url)}catch{throw Error('INVALID_OWNER_CLOUD_URL')}
 if(u.protocol!=='http:'||!['127.0.0.1','localhost',...(allowCompose?['cloud']:[])].includes(u.hostname)||u.port!=='8791'||u.pathname!=='/'||u.username||u.password||u.search||u.hash)throw Error('EXTERNAL_CLOUD_REFUSED');
 return u.origin;
}
