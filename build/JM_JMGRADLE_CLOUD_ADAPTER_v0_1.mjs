import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {JMGradleGraph} from './native/android/jmgradle/src/jmgradle.mjs';
import {compileAndroidCading,buildAndroidApk,androidSigningFromEnv} from './JM_ANDROID_FORGE_CLOUD_ADAPTER_v0_1.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const schedulerPath=path.join(here,'native','android','jmgradle','src','jmgradle.mjs');
const utilPath=path.join(here,'native','android','jmgradle','src','util.mjs');
export const RECOVERED_JMGRADLE_SCHEDULER_SHA256='6dd2e5f91f5f99cc093a43b915e1213def469aa18a7cb6aca4035d7b4f99348e';
export const RECOVERED_JMGRADLE_UTIL_SHA256='d70644f8f118f3e67a484d42c20615734a3cdd78455fa140d7490f95fa8dc8be';
export const RECOVERED_JMGRADLE_CLI_SHA256='6026c8b0e29e78c13039c88e2e1c8ba1eea5cd295f4ca02a55e9d14054ac281c';
const shaFile=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');

export function verifyRecoveredJMGradleMount(){
  const schedulerSha256=shaFile(schedulerPath),utilSha256=shaFile(utilPath);
  if(schedulerSha256!==RECOVERED_JMGRADLE_SCHEDULER_SHA256)throw Error('Recovered JMGradle scheduler hash mismatch');
  if(utilSha256!==RECOVERED_JMGRADLE_UTIL_SHA256)throw Error('Recovered JMGradle util hash mismatch');
  return{status:'PASS',schedulerSha256,utilSha256,cliReferenceSha256:RECOVERED_JMGRADLE_CLI_SHA256};
}

function requiredBodies(){
  return ['Cading','Kading','JMLogic','FlowTalk','RouteCode','Quadze','OneBody IR','CadenVM','CodeHand','RouteOS','TraceBox','THEO','Build Gates','Zionfolder'];
}

export function createJMGradleCloudGraph(){
  return new JMGradleGraph('JMGradle / Build Cell Cloud Adapter')
    .task('sourceGate',{body:'Cading',quadze:'Q0',description:'Compile the authored Android Cading source through the recovered Forge compiler body.',run:async c=>{
      if(!String(c.source||'').trim())throw Error('Source Gate HOLD: source required');
      c.compiled=await compileAndroidCading({source:c.source,filename:c.filename});
    }})
    .task('intentLock',{dependsOn:['sourceGate'],body:'FlowTalk',quadze:'Q0',description:'Require a build flow and route before cloud emission.',run:async c=>{
      const flows=c.compiled?.model?.flows||[],routes=c.compiled?.model?.routes||[];
      if(!flows.some(x=>x.name==='build'))throw Error('Intent Lock HOLD: build flow required');
      if(!routes.some(x=>x.from==='build'||x.to==='build'))throw Error('Intent Lock HOLD: build route required');
    }})
    .task('logicGate',{dependsOn:['intentLock'],body:'JMLogic + Build Gates',quadze:'Q1',description:'Require the fourteen governing Android bodies.',run:async c=>{
      const present=new Set(c.compiled?.oneBody?.bodies||[]);
      const missing=requiredBodies().filter(x=>!present.has(x));
      if(missing.length)throw Error('Logic Gate HOLD: missing '+missing.join(', '));
    }})
    .task('oneBody',{dependsOn:['logicGate'],body:'Kading + OneBody IR',quadze:'Q1',description:'Hold the recovered Forge OneBody as the cloud build map.',run:async c=>{
      if(c.compiled?.oneBody?.schema!=='jm.onebody.android/v1')throw Error('OneBody HOLD: unexpected schema');
      c.oneBody=c.compiled.oneBody;
    }})
    .task('androidCarrier',{dependsOn:['oneBody'],body:'CodeHand + CadenVM + Android Forge',quadze:'Q2',description:'Emit the signed cloud-safe Android carrier using the already-proved Forge descendant.',run:async c=>{
      const signing=c.signing||androidSigningFromEnv();
      const result=await buildAndroidApk({source:c.source,html:c.html,filename:c.filename,signing});
      c.forged=result.forged;c.emittedOneBody=result.compiled.oneBody;
    }})
    .task('verifyPackage',{dependsOn:['androidCarrier'],body:'TraceBox + THEO',quadze:'Q3',description:'Require APK signature, alignment, identity and SHA evidence returned by the Forge.',run:async c=>{
      const r=c.forged?.receipt;
      if(r?.status!=='PASS_STATIC_PHONE_EMISSION'||r?.signatureVerifiedInForge!==true||r?.zipAlignment?.pass!==true)throw Error('Verification HOLD: Forge receipt incomplete');
      if(!/^[a-f0-9]{64}$/.test(String(c.forged?.apkSha256||'')))throw Error('Verification HOLD: APK SHA-256 missing');
      if(c.forged?.emittedOneBody?.identity?.module!==c.oneBody?.identity?.module)throw Error('Verification HOLD: OneBody identity drift');
    }})
    .task('receipt',{dependsOn:['verifyPackage'],body:'TraceBox + Zionfolder',quadze:'Q3',description:'Issue a bounded JMGradle cloud receipt without claiming the historical local host.',run:async c=>{
      c.jmgradleReceipt={
        schema:'JM.JMGradle.CloudReceipt/0.1',
        status:'PASS',
        scheduler:'EXACT_RECOVERED_BYTES',
        schedulerSha256:RECOVERED_JMGRADLE_SCHEDULER_SHA256,
        utilSha256:RECOVERED_JMGRADLE_UTIL_SHA256,
        historicalCliReferenceSha256:RECOVERED_JMGRADLE_CLI_SHA256,
        graph:createJMGradleCloudGraph().describe('receipt'),
        apkSha256:c.forged.apkSha256,
        forgeReceipt:c.forged.receipt,
        claimBoundary:'Exact recovered JMGradle scheduler bytes execute this cloud-adapter graph. The task implementations use the already-proved cloud-safe Android Forge descendant; this does not impersonate the historical local JMGradle HTTP host or its complete offline builder/toolchain carrier.'
      };
    }});
}

export function describeJMGradleCloudGraph(){return createJMGradleCloudGraph().describe('receipt')}

export async function buildAndroidApkViaJMGradle({source,html,filename='<jmgradle-cloud-build>',signing}){
  const mount=verifyRecoveredJMGradleMount();
  const context={source:String(source||''),html:String(html||''),filename,signing,trace:[],mount};
  await createJMGradleCloudGraph().execute('receipt',context);
  return{compiled:context.compiled,forged:context.forged,jmgradleReceipt:context.jmgradleReceipt,trace:context.trace,mount};
}
