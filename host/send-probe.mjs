import {randomBytes} from 'node:crypto';
import {requireLocalCloudUrl} from './policy.mjs';
const e=process.env,base=requireLocalCloudUrl(e.JM_HOST_URL),nonce=randomBytes(16).toString('hex');
const res=await fetch(base+'/v5/spaces/'+encodeURIComponent(e.JM_SPACE_ID)+'/commands',{method:'POST',headers:{authorization:'Bearer '+e.JM_CLOUD_ADMIN_TOKEN,'content-type':'application/json'},body:JSON.stringify({action:'probe',target:e.JM_MEMBER_ID,payload:{schema:'jm.revolvingdoor.probe/1',nonce},requestId:'jm_owner_'+nonce,ttlMs:120000})});const j=await res.json();
if(res.status!==201||j.command?.action!=='probe')throw Error('OWNER_PROBE_NOT_ACCEPTED:'+res.status);
console.log(JSON.stringify({status:'PROBE_QUEUED_NOT_YET_PROVEN',commandId:j.command.id,spaceId:e.JM_SPACE_ID,requiredNext:'Reconcile ECDSA signed host receipt with local RD receipt'}));
