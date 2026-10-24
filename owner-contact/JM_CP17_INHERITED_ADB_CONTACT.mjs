#!/usr/bin/env node
// JM CP-C17 inherited contact overlay v0.1 — 24 October 2026
// Inherits JM ADB Localhost Bridge v0.1 physical transport without copying JMC5 launch credentials.
// Every operation is bounded to CP-C17's already-configured localhost port 8791.
// No Fold mission, signed RD execution or actual HTTP content on the phone is claimed by ADB intent dispatch.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

export const PORT=8791, LOCAL=`http://127.0.0.1:${PORT}`;
const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canon).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
export const signerPublicId=jwk=>createHash('sha256').update(canon(jwk)).digest('hex').slice(0,24);
const HEX24=/^[0-9a-f]{24}$/;
export class ContactHold extends Error {constructor(code){super(code);this.name='ContactHold';this.code=code;}}
function hold(code){throw new ContactHold(code)}

export function expectedSignerFromEnv(text){
 const lines=String(text).split(/\r?\n/).filter(x=>x.startsWith('JM_CLOUD_EXPECTED_SIGNING_KEY_ID='));
 if(lines.length!==1)hold('HOLD_OWNER_SIGNER_PIN_NOT_UNIQUE');
 const id=lines[0].split('=')[1];if(!HEX24.test(id))hold('HOLD_OWNER_SIGNER_PIN_INVALID');
 return id;
}
export function parseDevices(text){
 const records=String(text).split(/\r?\n/).slice(1).map(x=>x.trim()).filter(Boolean).map(line=>{
   const m=line.match(/^(\S+)\s+(device|unauthorized|offline|recovery|sideload|bootloader)(?:\s|$)/);
   return m?{serial:m[1],state:m[2]}:null;
 });
 if(records.some(x=>!x))hold('HOLD_ADB_DEVICE_RESPONSE_UNKNOWN');
 if(records.length!==1)hold(records.length?'HOLD_MULTIPLE_ANDROID_TARGETS':'HOLD_NO_ANDROID_TARGET');
 const r=records[0];
 if(r.state!=='device')hold('HOLD_ANDROID_NOT_AUTHORISED');
 if(r.serial.startsWith('emulator-'))hold('HOLD_EMULATOR_NOT_OWNER_DEVICE');
 return r;
}
export function inspectReverse(text){
 const lines=String(text).split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 const match=lines.filter(s=>/\btcp:8791\b/.test(s)).map(s=>s.match(/^(\S+)\s+(tcp:8791)\s+(tcp:\d+)$/));
 if(match.some(x=>!x))hold('HOLD_ADB_REVERSE_FORMAT_UNKNOWN');
 if(match.some(x=>x[3]!=='tcp:8791'))hold('HOLD_ADB_REVERSE_CONFLICT');
 if(match.length>1)hold('HOLD_ADB_REVERSE_DUPLICATE');
 return match.length===1;
}
export function defaultAdb(args){
 try {return String(execFileSync('adb',args,{encoding:'utf8',timeout:12000,windowsHide:true,stdio:['ignore','pipe','ignore']}));}
 catch {hold('HOLD_ADB_COMMAND_FAILED');}
}
const getJSON=async(fetchImpl,url)=>{
 let response;
 try{response=await fetchImpl(url,{signal:AbortSignal.timeout(3500),redirect:'error',cache:'no-store'});}catch{hold('HOLD_CP17_LOCAL_HTTP_UNREACHABLE');}
 if(!response?.ok)hold('HOLD_CP17_LOCAL_HTTP_NOT_READY');
 try{return await response.json();}catch{hold('HOLD_CP17_HTTP_NOT_JSON');}
};
export async function inspectHost({fetchImpl=fetch,configDir=process.cwd(),readFile=fs.readFileSync}={}){
 const compose=path.join(configDir,'compose.yaml'),env=path.join(configDir,'.env');
 if(!fs.existsSync(compose))hold('HOLD_CP17_COMPOSE_NOT_FOUND');
 let expected;
 try{expected=expectedSignerFromEnv(readFile(env,'utf8'));}catch(e){if(e instanceof ContactHold)throw e;hold('HOLD_CP17_LOCAL_ENV_ABSENT');}
 const health=await getJSON(fetchImpl,LOCAL+'/health');
 const ready=await getJSON(fetchImpl,LOCAL+'/ready');
 const meta=await getJSON(fetchImpl,LOCAL+'/meta');
 const key=await getJSON(fetchImpl,LOCAL+'/receipt-key');
 if(health.ok!==true||health.version!=='0.5.1-hosted'||health.schema!=='jm.cloud-contact.server/0.5')hold('HOLD_WRONG_SERVER_ON_PORT_8791');
 if(ready.ok!==true||ready.ready!==true||ready.contactDurable!==true||ready.receiptSigning!==true)hold('HOLD_CP17_NOT_DURABLE_OR_SIGNING');
 if(!Array.isArray(meta.apiRoots)||!meta.apiRoots.includes('/v5'))hold('HOLD_CP17_PROTOCOL_ROOT_MISSING');
 if(key.ok!==true||key.algorithm!=='ECDSA-P256-SHA256-P1363'||key.publicKeyJwk?.kty!=='EC'||key.publicKeyJwk?.crv!=='P-256'||signerPublicId(key.publicKeyJwk)!==key.keyId||key.keyId!==expected)hold('HOLD_LOCAL_SIGNER_IDENTITY_MISMATCH');
 return {version:health.version,keyId:key.keyId,contactDurable:true,receiptSigning:true,localhost:LOCAL};
}
export async function runContact({mode='inspect',configDir=process.cwd(),fetchImpl=fetch,adb=defaultAdb}={}){
 if(!['inspect','connect','open'].includes(mode))hold('HOLD_UNKNOWN_MODE');
 const host=await inspectHost({fetchImpl,configDir});
 let d;try{d=parseDevices(adb(['devices','-l']));}catch(e){if(e instanceof ContactHold)throw e;hold('HOLD_ADB_COMMAND_FAILED');}
 let mapping=inspectReverse(adb(['-s',d.serial,'reverse','--list']));
 let changed=false,viewIntent=false;
 if(mode==='connect'&&!mapping){
  adb(['-s',d.serial,'reverse','tcp:8791','tcp:8791']);
  mapping=inspectReverse(adb(['-s',d.serial,'reverse','--list']));
  if(!mapping)hold('HOLD_ADB_REVERSE_NOT_OBSERVED');changed=true;
 }
 if(mode==='open'){
  if(!mapping)hold('HOLD_EXISTING_REVERSE_REQUIRED');
  adb(['-s',d.serial,'shell','am','start','-a','android.intent.action.VIEW','-d',LOCAL+'/health']);
  viewIntent=true;
 }
 return {
  schema:'jm.cp17.inherited-owner-physical-contact/0.1',mode,
  status:'BOUNDED_LOCAL_TRANSPORT_ONLY',
  cp17Version:host.version,publicSignerKeyId:host.keyId,cp17LocalReady:true,
  adbOwnerDeviceAuthorised:true,adbReverseObserved:mapping,adbReverseNewlyCreated:changed,
  phoneBrowserIntentDispatched:viewIntent,phoneHttpContentConfirmed:false,
  cp17MissionExecutedByPhone:false,cp17SignedReturnFromPhone:false,
  reusedFrom:'JM ADB Localhost Bridge v0.1 + JM Phone↔Laptop Contact Runner v0.2',
  nextDistinctBoundary:'OWNER_PHONE_CP17_RESPONSE_AND_SIGNED_PHONE_SPECIFIC_RETURN',
  secretsLogged:false,deviceSerialLogged:false
 };
}
const isEntry=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isEntry){
 const mode=process.argv[2]||'inspect';
 try{console.log(JSON.stringify(await runContact({mode,configDir:process.cwd()}),null,2));}
 catch(e){console.error(JSON.stringify({status:'HOLD',code:e instanceof ContactHold?e.code:'HOLD_UNEXPECTED_FAILURE',productionTouched:false,privateKeysExposed:false}));process.exitCode=2;}
}
