import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const port=18973,base='http://127.0.0.1:'+port,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-game-v03-'));
const env={...process.env,PORT:String(port),HOST:'127.0.0.1',JM_CLOUD_MODE:'development',JM_CLOUD_ADMIN_TOKEN:'A'.repeat(40),JM_CLOUD_SERVER_SECRET:'S'.repeat(40),JM_CLOUD_DATA:path.join(tmp,'cloud.json'),JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(tmp,'key.pem'),JM_GAME_DATA:path.join(tmp,'game.json'),JM_CLOUD_PROFILE_DIR:path.resolve('./profiles'),JM_CLOUD_PROFILE_MANIFEST:path.resolve('./profiles/JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json')};
const child=spawn(process.execPath,['JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs'],{env,stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));async function req(method,url,token,body){const h={'content-type':'application/json'};if(token)h.authorization='Bearer '+token;const r=await fetch(base+url,{method,headers:h,body:body==null?undefined:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(method+' '+url+' '+r.status+' '+JSON.stringify(j));return j}
async function wait(){for(let i=0;i<60;i++){try{const r=await fetch(base+'/ready');if(r.ok)return}catch{}await sleep(100)}throw Error('server did not become ready')}
try{
 await wait();
 const a=await req('POST','/game/v1/players/register',null,{handle:'Alpha03'}),b=await req('POST','/game/v1/players/register',null,{handle:'Bravo03'});
 await req('POST','/game/v1/matchmaking/join',a.token,{game:'clashfield',mode:'1v1'});
 const mb=await req('POST','/game/v1/matchmaking/join',b.token,{game:'clashfield',mode:'1v1'});if(mb.status!=='matched')throw Error('match not created');
 const id=mb.match.matchId,ma=await req('GET','/game/v1/matches/'+id,a.token),mj=await req('GET','/game/v1/matches/'+id,b.token);
 if(ma.match.role!=='host'||mj.match.role!=='join'||!ma.match.cloudAccess?.credential||!mj.match.cloudAccess?.credential)throw Error('cloud access missing');
 const sig=await req('POST',ma.match.cloudAccess.signalEndpoint,ma.match.cloudAccess.credential,{to:'join',kind:'offer',payload:{sdp:'qa-offer'}});
 const inbox=await req('GET',mj.match.cloudAccess.signalEndpoint+'?after=0',mj.match.cloudAccess.credential);if(!inbox.signals?.some(x=>x.id===sig.signal.id))throw Error('cloud signalling failed');
 const c=await req('POST','/game/v1/clans',a.token,{name:'Route Clan',tag:'RTE'});await req('POST','/game/v1/clans/'+c.clan.clanId+'/invite',a.token,{handle:'Bravo03'});await req('POST','/game/v1/clans/'+c.clan.clanId+'/join',b.token,{});
 const grant=await req('POST','/game/v1/shop/dev-grant',a.token,{sku:'supporter'});if(!grant.inventory?.length)throw Error('inventory grant failed');
 await req('POST','/game/v1/matches/'+id+'/state',a.token,{state:'active'});
 const done=await req('POST','/game/v1/matches/'+id+'/state',a.token,{state:'complete',result:{winner:'host',reason:'qa'}});
 if(!done.match.cloudReceipt?.receiptHash||!done.match.cloudReceipt?.publicSig)throw Error('signed cloud receipt missing');
 console.log(JSON.stringify({pass:true,tests:['players','matchmaking','cloud-space-mount','member-credentials','cloud-signal','clan','inventory','host-authority','cloud-close','signed-cloud-receipt'],matchId:id,spaceId:done.match.cloudSpaceId,receiptHash:done.match.cloudReceipt.receiptHash},null,2));
}finally{child.kill('SIGTERM');await sleep(150)}
