import {reconcileHost} from '../bridge/src/v05-reconcile.mjs';
import {requireLocalCloudUrl} from './policy.mjs';
const e=process.env;
const result=await reconcileHost({cloudUrl:requireLocalCloudUrl(e.JM_HOST_URL),spaceId:e.JM_SPACE_ID,memberId:e.JM_MEMBER_ID,dbFile:'/rdstate/inbox.sqlite',adminToken:e.JM_CLOUD_ADMIN_TOKEN,pinnedKeyId:e.JM_CLOUD_EXPECTED_SIGNING_KEY_ID,localMock:true});
console.log(JSON.stringify(result,null,2));
if(result.signed_host_receipt!=='PASS'||!result.statuses.length||result.statuses.some(s=>s.phase!=='RESULT_CONFIRMED')){
 console.error('JM_OWNER_SIGNED_CONTACT_HOLD: check runner logs, retry reconciliation, never claim success from HTTP alone');process.exitCode=1;
}
