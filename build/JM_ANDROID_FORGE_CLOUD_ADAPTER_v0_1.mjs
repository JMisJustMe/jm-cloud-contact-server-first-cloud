import JSZip from 'jszip';
import './native/android/JM_FORGE_CORE_DONOR_v1_4_1.js';

let mountedForge=null;
let mountedCertificate=null;

function needSigning(signing={}){
  const material={
    CHILD_PRIVATE_KEY_PKCS8_B64:String(signing.privateKeyPkcs8B64||''),
    CHILD_CERT_DER_B64:String(signing.certificateDerB64||''),
    CHILD_PUBLIC_KEY_SPKI_B64:String(signing.publicKeySpkiB64||''),
    CHILD_CERT_SHA256:String(signing.certificateSha256||'')
  };
  for(const [key,value] of Object.entries(material)) if(!value) throw new Error('Android APK signing custody HOLD: missing '+key);
  return material;
}

export function androidSigningFromEnv(env=process.env){
  return {
    privateKeyPkcs8B64:env.JM_ANDROID_DEBUG_PRIVATE_KEY_PKCS8_B64||'',
    certificateDerB64:env.JM_ANDROID_DEBUG_CERT_DER_B64||'',
    publicKeySpkiB64:env.JM_ANDROID_DEBUG_PUBLIC_KEY_SPKI_B64||'',
    certificateSha256:env.JM_ANDROID_DEBUG_CERT_SHA256||''
  };
}

export async function mountAndroidForge(signing){
  const material=needSigning(signing);
  if(mountedForge){
    if(mountedCertificate!==material.CHILD_CERT_SHA256) throw new Error('Android Forge signing identity already mounted with a different certificate');
    return mountedForge;
  }
  globalThis.JSZip=JSZip;
  globalThis.JM_PHONE_FORGE_SIGNING=material;
  try{
    await import('./native/android/JM_PHONE_FORGE_CLOUD_SAFE_v1_4_1.js');
  }finally{
    delete globalThis.JM_PHONE_FORGE_SIGNING;
  }
  if(!globalThis.JMForgeCore?.compileCading) throw new Error('JMForgeCore donor failed to mount');
  if(!globalThis.JMPhoneForge?.forge) throw new Error('JMPhoneForge donor failed to mount');
  mountedForge={core:globalThis.JMForgeCore,phone:globalThis.JMPhoneForge};
  mountedCertificate=material.CHILD_CERT_SHA256;
  return mountedForge;
}

export async function compileAndroidCading({source,filename='<cloud-build>'}){
  if(!globalThis.JMForgeCore?.compileCading) throw new Error('JMForgeCore donor is unavailable');
  return globalThis.JMForgeCore.compileCading(String(source||''),filename);
}

export async function buildAndroidApk({source,html,filename='<cloud-build>',signing}){
  const mounted=await mountAndroidForge(signing);
  const compiled=await mounted.core.compileCading(String(source||''),filename);
  const forged=await mounted.phone.forge({source:String(source||''),html:String(html||''),oneBody:compiled.oneBody});
  return {compiled,forged};
}
