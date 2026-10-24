// Actual JM Revolving Door + CP-C5 bridge. Strictly same-host loopback.
// Administrative signature reconciliation is kept in a SEPARATE operator process.
import fs from 'node:fs';
import {Relay} from '../bridge/revolving-door-v0_1_2_challenge/src/relay.mjs';
import {Runner} from '../bridge/revolving-door-v0_1_2_challenge/src/runner.mjs';
import {V05Bridge} from '../bridge/src/v05-bridge.mjs';
import {requireLocalCloudUrl} from './policy.mjs';
const e=process.env,origin=requireLocalCloudUrl(e.JM_HOST_URL),profile=JSON.parse(fs.readFileSync('/rdstate/member.json','utf8'));
if(profile.spaceId!==e.JM_SPACE_ID||profile.memberId!==e.JM_MEMBER_ID||!profile.memberToken||profile.memberToken.length<32)throw Error('OWNER_ENROLLMENT_INVALID');
const relay=new Relay({dbFile:'/rdstate/relay.sqlite',tokens:e});
const listener=await relay.listen({port:8787,host:'127.0.0.1'});
const runner=new Runner({relayUrl:'http://127.0.0.1:8787',dbFile:'/rdstate/runner.sqlite',tokens:e,runnerId:e.JM_ALLOWED_RUNNER_ID});
const bridge=new V05Bridge({cloudUrl:origin,spaceId:profile.spaceId,memberId:profile.memberId,memberToken:profile.memberToken,relayUrl:'http://127.0.0.1:8787',tokens:e,dbFile:'/rdstate/inbox.sqlite',localMock:true});
let busy=false,stopping=false;
async function tick(){
 if(busy||stopping)return;busy=true;
 try{
  await bridge.pollAndStage();await runner.drain(8);
  for(const c of bridge.inspect())if(['STAGED','LOCAL_VERIFIED','ACK_CONFIRMED'].includes(c.phase)){
   const result=await bridge.finalize(c.command_id);
   if(result.phase==='RESULT_HTTP_ACKNOWLEDGED')console.log('JM_OWNER_RD_AWAITING_SEPARATE_SIGNED_RECONCILIATION',c.command_id);
  }
 }catch(err){console.error('JM_OWNER_CONTACT_HOLD',err.message)}finally{busy=false}
}
const t=setInterval(()=>void tick(),Math.max(2500,Number(e.JM_POLL_MS||4000)));
const stop=async()=>{if(stopping)return;stopping=true;clearInterval(t);while(busy)await new Promise(r=>setTimeout(r,50));await runner.close();bridge.close();await new Promise(r=>listener.close(r));relay.close();process.exit(0)};
process.once('SIGTERM',()=>void stop());process.once('SIGINT',()=>void stop());
console.log('JM_OWNER_RD_READY local loopback only, probe capability only, admin reconciler separate');
await tick();
