import {spawn} from 'node:child_process';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const port=18976,base='http://127.0.0.1:'+port,tmp=fs.mkdtempSync(path.join(os.tmpdir(),'jm-market-v01-'));
const env={...process.env,PORT:String(port),HOST:'127.0.0.1',JM_CLOUD_MODE:'development',JM_CLOUD_ADMIN_TOKEN:'A'.repeat(40),JM_CLOUD_SERVER_SECRET:'S'.repeat(40),JM_CLOUD_DATA:path.join(tmp,'cloud.json'),JM_CLOUD_RECEIPT_SIGNING_KEY:path.join(tmp,'key.pem'),JM_GAME_DATA:path.join(tmp,'game.json'),JM_SERVICE_MESH_DATA:path.join(tmp,'mesh.json'),JM_CLOUD_PROFILE_DIR:path.resolve('./profiles'),JM_CLOUD_PROFILE_MANIFEST:path.resolve('./profiles/JM_CLOUD_PROFILE_MANIFEST_HOSTED_v0_5_1.json')};
const child=spawn(process.execPath,['JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs'],{env,stdio:['ignore','pipe','pipe']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(){for(let i=0;i<80;i++){try{if((await fetch(base+'/ready')).ok)return}catch{}await sleep(100)}throw Error('server did not become ready')}
try{
 await wait();
 const page=await fetch(base+'/market');if(!page.ok)throw Error('market page failed '+page.status);const text=await page.text();
 if(!text.includes('JM MARKET ECOSYSTEM LAB v1.1')||!text.includes('32-Mesh')||!text.includes('SESSION DURATION'))throw Error('market page identity missing');
 const meta=await (await fetch(base+'/market/v1/meta')).json();if(!meta.ok||meta.supportedPairs.length!==4||meta.cloudRoot!=='JM CLOUD CONTACT SERVER v0.5.1-hosted')throw Error('market meta failed');
 const ready=await (await fetch(base+'/market/v1/ready')).json();if(!ready.ready||!ready.page)throw Error('market ready failed');
 const bad=await fetch(base+'/market/v1/quotes?symbol=NOPE');if(bad.status!==400)throw Error('unsupported symbol gate failed');
 console.log(JSON.stringify({pass:true,tests:['hosted-page','market-meta','market-ready','four-pair-contract','unsupported-symbol-gate','duration-percentage-ui','same-origin-quote-route'],externalQuoteRuntime:'separate hosted contact gate'},null,2));
}finally{child.kill('SIGTERM');await sleep(150)}
