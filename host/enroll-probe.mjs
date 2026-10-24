// Bounded member registration, with owner administrative authority but NO arbitrary member capabilities.
import fs from 'node:fs';
import {requireConfig,requireLocalCloudUrl} from './policy.mjs';
const e=process.env,v=requireConfig(e),base=requireLocalCloudUrl(e.JM_HOST_URL,{allowCompose:true});
const output='/rdstate/member.json';
if(fs.existsSync(output))throw Error('RD_MEMBER_ALREADY_ENROLLED: preserve existing credential');
const hdr={authorization:'Bearer '+e.JM_CLOUD_ADMIN_TOKEN,'content-type':'application/json'};
const [ready,key]=await Promise.all([fetch(base+'/ready'),fetch(base+'/receipt-key')]);
const r=await ready.json(),k=await key.json();
if(!ready.ok||r.ready!==true||r.contactDurable!==true||!key.ok||k.keyId!==v.keyId)throw Error('OWNER_HOST_READY_OR_SIGNER_PIN_HOLD');
const listing=await fetch(base+'/v5/spaces',{headers:hdr}),found=await listing.json();
if(!listing.ok||found.spaces?.some(s=>s.spaceId===v.spaceId))throw Error('SPACE_ALREADY_EXISTS_OR_UNAVAILABLE: do not rotate member blindly');
const res=await fetch(base+'/v5/spaces',{method:'POST',headers:hdr,body:JSON.stringify({spaceId:v.spaceId,label:'JM owner-local probe only',kind:'device-contact',members:[{id:e.JM_MEMBER_ID,type:'service',capabilities:['command:probe']}]})});
const body=await res.json();
if(res.status!==201||!body.credentials?.[e.JM_MEMBER_ID])throw Error('OWNER_ENROLLMENT_HOLD:'+res.status);
fs.writeFileSync(output,JSON.stringify({schema:'jm.owner.rdmembership/1',spaceId:v.spaceId,memberId:e.JM_MEMBER_ID,memberToken:body.credentials[e.JM_MEMBER_ID],keyId:v.keyId}),{flag:'wx',mode:0o600});
console.log(JSON.stringify({status:'PROBE_MEMBER_ENROLLED',spaceId:v.spaceId,memberId:e.JM_MEMBER_ID,capabilities:['command:probe'],credentialPrinted:false}));
