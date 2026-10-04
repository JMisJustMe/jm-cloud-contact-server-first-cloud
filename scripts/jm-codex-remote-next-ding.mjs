import fs from 'node:fs';
import crypto from 'node:crypto';

const base = process.env.JM_CLOUD || 'https://jm-cloud-contact-server-v05.onrender.com';
const hostLabel = process.env.JM_CODEX_HOST_LABEL || '';
const operationId = 'JMOP-070f1186f1b59e4c9a084842';

if (!['GroundZeroJM','Codex Cloud'].includes(hostLabel)) {
  throw new Error('Set JM_CODEX_HOST_LABEL to GroundZeroJM or Codex Cloud.');
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function req(method, path, token=null, body=null) {
  const headers = {accept:'application/json'};
  if (token) headers.authorization = 'Bearer ' + token;
  if (body !== null) headers['content-type'] = 'application/json';
  const r = await fetch(base + path, {
    method, headers,
    body: body === null ? undefined : JSON.stringify(body)
  });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = {raw:text}; }
  if (!r.ok) throw new Error(method+' '+path+' -> '+r.status+' '+JSON.stringify(j));
  return j;
}
async function waitReady() {
  let last='';
  for (let i=1;i<=50;i++) {
    try {
      const r=await fetch(base+'/ready',{headers:{accept:'application/json'}});
      const j=await r.json();
      if (r.ok && j.ready && j.receiptSigning) return j;
      last=JSON.stringify(j);
    } catch(e) { last=String(e?.message||e); }
    await sleep(3000);
  }
  throw new Error('JM Cloud not ready: '+last);
}
function canon(v) {
  if (v===null || typeof v!=='object') return JSON.stringify(v);
  if (Array.isArray(v)) return '['+v.map(canon).join(',')+']';
  return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
}

const ready = await waitReady();
const handle = ('JMCodex'+Date.now().toString(36)).slice(0,24);
const auth = await req('POST','/mesh/v1/auth/register',null,{handle});
const token = auth.token;

const p = await req('POST','/mesh/v2/pipelines',token,{
  source:'GroundZeroJM Codex Remote is executing one disposable bounded JM Service Mesh action. Route-specific evidence is required before any Ding is claimed.',
  sourceLabel:'JM Codex Remote GroundZeroJM Next Ding',
  lane:'Public Output'
});
const pipelineId = p.pipeline.pipelineId;

await req('POST','/mesh/v2/pipelines/'+encodeURIComponent(pipelineId)+'/gem',token,{
  gem:'This GroundZeroJM recipient caused a bounded JM Service Mesh state transition and must receive its own returned evidence.',
  why:'Proves recipient-specific consequence-and-return without borrowing the prior GitHub Actions Ding.',
  keeper:'CONTACT BEFORE CROWN',
  homes:['Build Mesh','Cross-Surface Contact'],
  tags:['groundzerojm','codex-remote','bounded-action','route-proof']
});

const claim = await req('POST','/mesh/v2/pipelines/'+encodeURIComponent(pipelineId)+'/claim',token,{
  claim:'This specific GroundZeroJM Codex Remote route produced a bounded server-side consequence.',
  class:'Testable / falsifiable',
  evidence:'Live HTTP stage responses plus completed pipeline readback and cryptographically verified signed cloud receipt.',
  confidence:'High at this route-specific scope',
  support:'GroundZeroJM Codex Remote -> public JM Service Mesh -> underlying JM Cloud space.',
  recourse:'Withhold Ding if any stage, readback, hash, signature, host identity or return-path check fails.',
  radius:'GroundZeroJM recipient only; no transfer to Codex Cloud, GitHub Actions, phone, or other recipient.'
});

const pub = await req('POST','/mesh/v2/pipelines/'+encodeURIComponent(pipelineId)+'/public',token,{
  title:'JM GroundZeroJM Codex Remote Bounded Action',
  publicText:'GroundZeroJM Codex Remote completed one bounded JM Service Mesh action and returned route-specific evidence.'
});

const trace = await req('GET','/mesh/v2/pipelines/'+encodeURIComponent(pipelineId),token);
if (trace.pipeline?.stage!=='PUBLIC_OUTPUT' || trace.pipeline?.status!=='complete') throw new Error('pipeline readback is not complete');
for (const stage of ['collector','gem','claim','public']) if (!trace.pipeline?.packets?.[stage]) throw new Error('missing packet '+stage);

const meshVerify = await req('POST','/mesh/v1/verify',token,{receiptHash:pub.receipt.receiptHash});
if (!meshVerify.valid || meshVerify.found!=='mesh') throw new Error('mesh receipt verification failed');

const cloudReceipt = pub.cloudReceipt;
if (!cloudReceipt?.publicSig || cloudReceipt.status!=='closed') throw new Error('closed signed cloud receipt missing');

const snap = {
  schema:cloudReceipt.schema,
  spaceId:cloudReceipt.spaceId,
  label:cloudReceipt.label,
  kind:cloudReceipt.kind,
  status:cloudReceipt.status,
  createdAt:cloudReceipt.createdAt,
  updatedAt:cloudReceipt.updatedAt,
  members:cloudReceipt.members,
  eventCount:cloudReceipt.eventCount,
  commandCount:cloudReceipt.commandCount,
  signalCount:cloudReceipt.signalCount,
  chainHead:cloudReceipt.chainHead
};
const localHash = crypto.createHash('sha256').update(canon(snap)).digest('hex');
if (localHash !== cloudReceipt.receiptHash) throw new Error('cloud receipt canonical hash mismatch');

const key = await req('GET','/receipt-key');
if (key.keyId !== cloudReceipt.publicKeyId) throw new Error('public key id mismatch');
const pubKey = crypto.createPublicKey({key:key.publicKeyJwk,format:'jwk'});
const signature = Buffer.from(cloudReceipt.publicSig,'base64url');
const signatureValid = crypto.verify('sha256',Buffer.from(cloudReceipt.receiptHash),{key:pubKey,dsaEncoding:'ieee-p1363'},signature);
if (!signatureValid) throw new Error('ECDSA verification failed');

const returnedHashMatches = trace.pipeline.cloudReceiptHash === cloudReceipt.receiptHash;
if (!returnedHashMatches) throw new Error('pipeline returned cloud hash mismatch');

const receipt = {
  schema:'JM.CodexRemoteRecipientDingCandidate/1',
  state:'DING_CANDIDATE_RETURN_REQUIRED',
  operationId,
  recipient:hostLabel,
  executedAt:new Date().toISOString(),
  target:'JM Service Mesh v0.2 on JM CLOUD CONTACT SERVER v0.5.1-hosted',
  readiness:{serverVersion:ready.version,receiptSigning:ready.receiptSigning},
  pipeline:{
    pipelineId,
    cloudSpaceId:trace.pipeline.cloudSpaceId,
    stage:trace.pipeline.stage,
    status:trace.pipeline.status,
    claimVerdict:claim.packet?.payload?.verdict ?? null,
    releaseState:pub.packet?.payload?.release_state ?? null
  },
  meshReceipt:{receiptHash:pub.receipt.receiptHash,verified:true},
  cloudReceipt:{
    receiptHash:cloudReceipt.receiptHash,
    canonicalHashMatch:true,
    publicKeyId:cloudReceipt.publicKeyId,
    signatureAlgorithm:cloudReceipt.signatureAlgorithm,
    signatureValid:true,
    status:cloudReceipt.status,
    chainHead:cloudReceipt.chainHead
  },
  readback:{
    complete:true,
    stage:trace.pipeline.stage,
    cloudReceiptHash:trace.pipeline.cloudReceiptHash,
    returnedHashMatches:true
  },
  finalGate:'Return this receipt visibly through the actual '+hostLabel+' Codex Remote session to the initiating user surface before final DING.',
  boundary:'Recipient-specific only. Does not transfer to other hosts, devices, apps, tools or games.'
};

const safe = hostLabel.toUpperCase().replace(/[^A-Z0-9]+/g,'_');
const out = 'JM_CODEX_REMOTE_'+safe+'_DING_RECEIPT.json';
fs.writeFileSync(out,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
console.log('\nRECEIPT_FILE='+out);
