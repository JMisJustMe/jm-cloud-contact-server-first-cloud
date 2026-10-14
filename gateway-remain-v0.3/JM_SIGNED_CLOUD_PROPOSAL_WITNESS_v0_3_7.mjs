// JM v0.3.7 external JM Cloud Service Mesh witness for reviewed JM source.
// Existing public v0.5.1 service; one scoped test pipeline; no admin credential.
// Cloud signs a closed cloud space, NOT any model's authorship or a Render disk.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve('.handoff');
const server='https://jm-cloud-contact-server-v05.onrender.com';
const read=async n=>JSON.parse(await fs.readFile(path.join(root,n),'utf8'));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const check=(yes,msg)=>{if(!yes)throw Error('JM_CLOUD_WITNESS_HOLD:'+msg)};
const proof=await read('proposal-proof.json'),report=await read('worker-report.json'),route=await read('sovereign-route.json');
check(proof.schema==='JM.ProposalIndependentVerification/0.3.7'&&proof.status==='PASS'&&
      proof.sourceCommit==='960b7455030701d1d9484fda6f8a7d0695e5670e'&&
      proof.proposal?.providerClass==='ASSISTANT_AUTHORED_DRAFT_PR_NOT_LLM'&&
      proof.adversarialMutationsRejected===15&&
      proof.nativeWork?.durableAtomicFaultRegression===true&&
      proof.nativeWork?.sourceTreeUnchanged===true&&
      proof.nativeWork?.sourceDiffSha256==='2cbe5c3367fb9cdf73bbc66bc2b045806ff8704e9b1f4515644cc76d2de5c9a2','PROPOSAL_SCOPE');
check(report.schema==='JM.SovereignRoutedRepairReport/0.3.6'&&report.result==='PASS'&&
      report.repair?.status==='PASS'&&report.repair?.publishedSource===false&&
      report.repair?.sourceDiffSha256===proof.nativeWork.sourceDiffSha256&&
      report.routerDecisionSha256===route.decisionSha256,'WORKER_SCOPE');
const proposalSha=sha(canonical(proof)),repairSha=sha(JSON.stringify(report)),routeSha=route.decisionSha256;
const witnessMarker='JM_PROPOSAL_V037 '+proposalSha+' '+repairSha+' '+routeSha;
async function request(method,urlPath,token=null,body=null){
 let last;
 for(let attempt=0;attempt<4;attempt++){
  try{
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),25000);
   const r=await fetch(server+urlPath,{method,headers:{accept:'application/json',...(token?{authorization:'Bearer '+token}:{}),...(body!==null?{'content-type':'application/json'}:{})},body:body===null?undefined:JSON.stringify(body),signal:controller.signal});
   clearTimeout(timer);
   const raw=await r.text();let j;try{j=JSON.parse(raw)}catch{j={raw:raw.slice(0,500)}}
   if(!r.ok)throw Error('HTTP '+r.status+' '+urlPath+' '+JSON.stringify(j).slice(0,400));
   return j;
  }catch(e){last=e;if(attempt<3)await new Promise(ok=>setTimeout(ok,1000*(attempt+1)))}
 }
 throw Error('JM_MESH_ROUTE_'+urlPath+':'+String(last));
}
const ready=await request('GET','/ready');
check(ready.ready===true&&ready.receiptSigning,'CLOUD_SIGNING_NOT_READY');
const handle=('JM037'+String(process.env.GITHUB_RUN_ID||Date.now())).slice(0,24);
const auth=await request('POST','/mesh/v1/auth/register',null,{handle});
check(typeof auth.token==='string'&&auth.token.length>10,'NO_MESH_SESSION');
const token=auth.token;
const source='Independent code review of JM host receipt PR #370. Evidence ONLY: '+witnessMarker+'. Scope is synthetic/test job, no user-authorised production change, no auto merge.';
const created=await request('POST','/mesh/v2/pipelines',token,{source,sourceLabel:'JM v0.3.7 Verified Proposal Evidence',lane:'Public Output'});
const pipelineId=created.pipeline?.pipelineId;
check(typeof pipelineId==='string'&&pipelineId.length>0,'NO_PIPELINE_ID');
await request('POST','/mesh/v2/pipelines/'+encodeURIComponent(pipelineId)+'/gem',token,{
 gem:'A second JM cloud body recorded the proposal, source diff and bounded-work return digests: '+witnessMarker,
 why:'Verify cross-body readback and JM Cloud signed receipt of this narrow synthetic proposal test.',
 keeper:'CONTACT BEFORE CROWN',
 homes:['Build Mesh','Sovereign Agent Gateway'],
 tags:['cloud-witness','bounded-proposal','no-ding-no-claim']
});
await request('POST','/mesh/v2/pipelines/'+encodeURIComponent(pipelineId)+'/claim',token,{
 claim:'This specific verified proposal was recorded as a bounded cloud test contact.',
 class:'Testable / falsifiable',
 evidence:'Pinned JM CI receipts and exact three digests: '+witnessMarker,
 confidence:'High for this test route only',
 support:'GitHub independent tests -> JM Service Mesh -> signed JM Cloud receipt',
 recourse:'HOLD if any source hash, chain hash, mesh verification, signature or readback differs.',
 radius:'Synthetic test only; not owner approval, model invention or production persistence.'
});
const pub=await request('POST','/mesh/v2/pipelines/'+encodeURIComponent(pipelineId)+'/public',token,{
 title:'JM v0.3.7 Bounded Source Proposal Witness',
 publicText:'Scoped synthetic JM proposal and repair witness. Hashes '+witnessMarker+'. Neither source nor final authority was promoted.'
});
const trace=await request('GET','/mesh/v2/pipelines/'+encodeURIComponent(pipelineId),token);
check(trace.pipeline?.stage==='PUBLIC_OUTPUT'&&trace.pipeline?.status==='complete','PIPELINE_READBACK_OPEN');
for(const stage of ['collector','gem','claim','public'])check(trace.pipeline?.packets?.[stage],'MISSING_PACKET_'+stage);
const serializedTrace=JSON.stringify(trace.pipeline);
check(serializedTrace.includes(proposalSha)&&serializedTrace.includes(repairSha)&&serializedTrace.includes(routeSha),'PROPOSAL_HASHES_NOT_IN_READBACK');
const verified=await request('POST','/mesh/v1/verify',token,{receiptHash:pub.receipt?.receiptHash});
check(verified.valid===true&&verified.found==='mesh','MESH_RECEIPT_NOT_VERIFIED');
const receipt=pub.cloudReceipt;
check(receipt?.publicSig&&receipt.status==='closed'&&receipt.signatureAlgorithm,'CLOUD_CLOSED_RECEIPT_ABSENT');
const snap={schema:receipt.schema,spaceId:receipt.spaceId,label:receipt.label,kind:receipt.kind,status:receipt.status,createdAt:receipt.createdAt,updatedAt:receipt.updatedAt,members:receipt.members,eventCount:receipt.eventCount,commandCount:receipt.commandCount,signalCount:receipt.signalCount,chainHead:receipt.chainHead};
const localHash=sha(canonical(snap));
check(localHash===receipt.receiptHash,'CLOUD_RECEIPT_CANONICAL_HASH');
const jwks=await request('GET','/receipt-key');
check(jwks.keyId===receipt.publicKeyId,'PUBLIC_KEY_ID_MISMATCH');
const pubkey=crypto.createPublicKey({key:jwks.publicKeyJwk,format:'jwk'});
check(crypto.verify('sha256',Buffer.from(receipt.receiptHash),{key:pubkey,dsaEncoding:'ieee-p1363'},Buffer.from(receipt.publicSig,'base64url')),'ECDSA_P256_VERIFY');
check(trace.pipeline.cloudReceiptHash===receipt.receiptHash,'SIGNED_CLOUD_READBACK_DRIFT');
const witness={
 schema:'JM.ExternalSignedSourceWitness/0.3.7',
 status:'PASS',
 cloudService:'JM CLOUD CONTACT SERVER v0.5.1-hosted / JM Service Mesh',
 sourceProposalSha256:proposalSha,
 workerReportSha256:repairSha,
 routeDecisionSha256:routeSha,
 sourceCommit:proof.sourceCommit,
 repairSourceDiffSha256:proof.nativeWork.sourceDiffSha256,
 pipelineId,
 meshReceiptHash:pub.receipt.receiptHash,
 cloudReceipt:receipt,
 cloudReceiptSha256:receipt.receiptHash,
 cloudPublicKey:jwks.publicKeyJwk,
 cloudPublicKeyId:jwks.keyId,
 readbackStage:trace.pipeline.stage,
 readbackStatus:trace.pipeline.status,
 readbackHash:trace.pipeline.cloudReceiptHash,
 hashesFoundInReadback:true,
 sourcePromoted:false,
 productionDurabilityClaim:false,
 boundary:'JM_CLOUD_SIGNED_CLOSED_SPACE_AND_HASHED_PUBLIC_MESH_PIPELINE_READBACK; FREE_RENDER_STORAGE_SURVIVAL_NOT_PROVEN; NO_MODEL_AUTHORSHIP_ATTESTATION'
};
await fs.mkdir(root,{recursive:true});
await fs.writeFile(path.join(root,'signed-cloud-witness.json'),JSON.stringify(witness,null,2)+'\n');
console.log(JSON.stringify({schema:witness.schema,status:'PASS',sourceProposalSha256:proposalSha,workerReportSha256:repairSha,
 pipelineId,meshReceiptHash:witness.meshReceiptHash,cloudReceiptHash:witness.cloudReceiptSha256,
 signatureValid:true,hashesFoundInReadback:true,boundary:witness.boundary}));
