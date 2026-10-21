// JM Mission 002 - offline independent source-return verifier.
// Verifies content and challenge binding, NOT that Gemini (or any named AI) authored a return.
// No model APIs, no Dropbox/GitHub writes, no external network requests.
import fs from 'node:fs/promises';
import {createHash, timingSafeEqual} from 'node:crypto';
import {pathToFileURL} from 'node:url';

export const REQUEST_SCHEMA='JM.M002.SourceContactChallenge/0.1';
export const RETURN_SCHEMA='JM.M002.SourceContactReturn/0.1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const validDigest=x=>typeof x==='string' && /^[0-9a-f]{64}$/.test(x);
const validId=x=>typeof x==='string' && /^[A-Za-z0-9._-]{12,128}$/.test(x);
const same=(x,y)=>{
  if(typeof x!=='string'||typeof y!=='string')return false;
  const a=Buffer.from(x),b=Buffer.from(y);
  return a.length===b.length && timingSafeEqual(a,b);
};

export function verifySourceReturn({request,returned,sourceBytes}={}){
  const errors=[];
  if(!request||request.schema!==REQUEST_SCHEMA||!validId(request.challengeId)||
    !validId(request.nonce)||!request.source||!validDigest(request.source.sha256)||
    !Number.isSafeInteger(request.source.bytes)||request.source.bytes<1||
    request.source.bytes>50_000_000)errors.push('CHALLENGE_INVALID');
  if(!returned||returned.schema!==RETURN_SCHEMA ||
    typeof returned.claimedProvider!=='string' || returned.claimedProvider.length>32 ||
    !['gemini','openai','copilot','perplexity','other'].includes(returned.claimedProvider)||
    typeof returned.analysis!=='string'||returned.analysis.length<1||returned.analysis.length>2400||
    !validDigest(returned.sourceSha256))errors.push('RETURN_INVALID');
  if(!Buffer.isBuffer(sourceBytes) && !(sourceBytes instanceof Uint8Array))errors.push('SOURCE_BYTES_MISSING');
  if(errors.length)return {status:'HOLD',errors,localSourceBytesVerified:false,providerIdentityVerified:false,providerExecutionVerified:false,externalProviderContactVerified:false};
  const observed=sha(sourceBytes);
  if(sourceBytes.length!==request.source.bytes)errors.push('SOURCE_BYTE_COUNT_MISMATCH');
  if(!same(observed,request.source.sha256))errors.push('SOURCE_SHA256_MISMATCH');
  if(!same(returned.challengeId,request.challengeId))errors.push('CHALLENGE_ID_MISMATCH');
  if(!same(returned.nonce,request.nonce))errors.push('NONCE_MISMATCH');
  if(!same(returned.sourceSha256,observed))errors.push('RETURN_SOURCE_HASH_MISMATCH');
  if(request.source.fileName && typeof request.source.fileName!=='string')errors.push('FILENAME_INVALID');
  const pass=errors.length===0;
  return {
    status:pass?'SOURCE_RETURN_BYTES_BOUND':'HOLD',
    errors,
    localSourceBytesVerified:pass,
    returnedAnalysisSha256:pass?sha(Buffer.from(returned.analysis,'utf8')):null,
    sourceSha256:observed,
    claimedProvider:returned.claimedProvider,
    providerIdentityVerified:false,
    providerExecutionVerified:false,
    externalProviderContactVerified:false,
    boundary:pass?'LOCAL_SOURCE_BYTES_AND_RETURN_NONCE_BINDING_PASS_EXTERNAL_PROVIDER_CONTACT_UNVERIFIED':'NO_COMPLETION_CLAIM'
  };
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  const [requestPath,returnPath,sourcePath]=process.argv.slice(2);
  if(!requestPath||!returnPath||!sourcePath){
    console.error('Usage: node JM_M002_SOURCE_RETURN_GATE_v0_1.mjs challenge.json return.json source.bin');
    process.exitCode=2;
  }else{
    try{
      const [r,s,b]=await Promise.all([fs.readFile(requestPath,'utf8'),fs.readFile(returnPath,'utf8'),fs.readFile(sourcePath)]);
      const out=verifySourceReturn({request:JSON.parse(r),returned:JSON.parse(s),sourceBytes:b});
      console.log(JSON.stringify(out,null,2));
      if(out.status==='HOLD')process.exitCode=3;
    }catch(e){console.error('HOLD:INVALID_INPUT_OR_FILE');process.exitCode=3;}
  }
}
