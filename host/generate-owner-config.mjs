// Run only on the owner's laptop. No generated private data belongs in a checkpoint or chat.
import {randomBytes,generateKeyPairSync} from 'node:crypto';
import fs from 'node:fs';import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {signerKeyId} from './policy.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'.env');
if(fs.existsSync(out))throw Error('OWNER_CONFIG_ALREADY_EXISTS: refusing to replace signing keys or passwords');
const hex=n=>randomBytes(n).toString('hex');
const signer=generateKeyPairSync('ec',{namedCurve:'prime256v1',privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}}).privateKey;
const pin=signerKeyId(signer),space='jm_owner_'+hex(6);
const pairs={
 JM_LOCAL_PORT:'8791',JM_STATE_PG_PASSWORD:hex(28),JM_FENCE_PG_PASSWORD:hex(28),
 JM_CLOUD_ADMIN_TOKEN:hex(32),JM_CLOUD_SERVER_SECRET:hex(32),
 JM_CLOUD_RECEIPT_SIGNING_KEY_B64:Buffer.from(signer).toString('base64'),
 JM_CLOUD_EXPECTED_SIGNING_KEY_ID:pin,JM_CLOUD_WRITER_FENCE_OWNER:'jm-owner-laptop',JM_CLOUD_WRITER_FENCE_EPOCH:'1',
 JM_SPACE_ID:space,JM_MEMBER_ID:'rd_probe',JM_PRODUCER_TOKEN:hex(32),JM_RUNNER_TOKEN:hex(32),
 JM_MISSION_KEY:hex(32),JM_RECEIPT_KEY:hex(32),JM_WAKE_TOKEN:hex(32),JM_OWNER_BOOTSTRAP_ACK:'HOLD'
};
const text=Object.entries(pairs).map(([k,v])=>`${k}=${v}`).join('\n')+'\n';
try{fs.writeFileSync(out,text,{flag:'wx',mode:0o600})}catch(e){throw Error('CONFIG_WRITE_FAILED '+e.code)}
console.log(JSON.stringify({status:'OWNER_CONFIG_CREATED',file:'.env',keyId:pin,spaceId:space,privateKeyPrinted:false,initialisedDatabases:false,warning:'Protect .env; never upload it or include it in FLAZ.'},null,2));
