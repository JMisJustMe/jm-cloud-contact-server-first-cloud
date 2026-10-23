// JM ECOSTATE — READ-ONLY owner-authorised hosted cutover preflight.
// This does not migrate/create tables, read private contact payloads into output,
// deploy Render, issue tokens or change PostgreSQL permissions.
import crypto from 'node:crypto';
import pg from 'pg';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const {Pool}=pg;
const hex24=/^[0-9a-f]{24}$/;
const hex64=/^[0-9a-f]{64}$/;
const canon=v=>v===null||typeof v!=='object'?JSON.stringify(v):
  Array.isArray(v)?'['+v.map(canon).join(',')+']':
  '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
const sha=x=>crypto.createHash('sha256').update(String(x)).digest('hex');
function cleanHost(value,{allowLoopback=false}={}){
  let u;try{u=new URL(String(value))}catch{throw Error('Host URL invalid')}
  if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||
    (u.protocol!=='https:'&&!(allowLoopback&&u.protocol==='http:'&&u.hostname==='127.0.0.1')))
    throw Error('Only a clean HTTPS origin is permitted');
  return u.origin;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function getPublic(base,endpoint,fetchImpl){
  let error;
  for(let i=0;i<2;i++){
    try{
      const r=await fetchImpl(base+endpoint,{
        method:'GET',headers:{Accept:'application/json'},
        redirect:'error',cache:'no-store',signal:AbortSignal.timeout(13000)});
      if(!r.ok)throw Error(endpoint+' returned HTTP '+r.status);
      const j=await r.json();
      if(j?.ok!==true)throw Error(endpoint+' returned no affirmative JSON contract');
      return j;
    }catch(e){error=e;if(i===0)await sleep(250)}
  }
  throw Error('Public '+endpoint+' contact unavailable: '+String(error?.message||error));
}
function signerKey(value){
  if(typeof value!=='string'||value.length<64||value.length>20000||!/^[a-zA-Z0-9+/=\r\n]+$/.test(value))
    throw Error('Owner-controlled PEM private key is required in environment, never in CLI');
  const pem=Buffer.from(value,'base64').toString('utf8');
  if(!pem.includes('BEGIN PRIVATE KEY'))throw Error('Expected PKCS8 PEM private key');
  const key=crypto.createPrivateKey(pem);
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')
    throw Error('Expected EC prime256v1 private signing authority');
  const publicJwk=crypto.createPublicKey(key).export({format:'jwk'});
  return {fingerprint:sha(canon(publicJwk)).slice(0,24)};
}
/**
 * Read-only preflight. Returns public, credential-free status with explicit
 * HOLDs. No such status grants permission for a production deploy.
 */
export async function inspectCutover({
  host,pgUrl,approvedDatabase,expectedSigningKeyId,signingKeyB64,
  memberHmacSecret,previouslyObservedKeyId='',allowLoopback=false,
  reviewedExistingState=null,bootstrapRekeyApproval='',approvedLiveKeyId='',
  pool=null,fetchImpl=fetch
}={}){
  if(!hex24.test(expectedSigningKeyId||''))throw Error('Independent expected key ID missing');
  if(previouslyObservedKeyId&&!hex24.test(previouslyObservedKeyId))
    throw Error('Previously observed key ID invalid');
  if(bootstrapRekeyApproval&&
     bootstrapRekeyApproval!=='JM_OWNER_APPROVED_ZERO_SPACE_REKEY_V1')
    throw Error('Unrecognised owner bootstrap rekey approval');
  if(bootstrapRekeyApproval&&!hex24.test(approvedLiveKeyId))
    throw Error('Explicit old live key ID required for a planned rekey');
  if(!approvedDatabase||!/^[a-zA-Z][a-zA-Z0-9_]{0,62}$/.test(approvedDatabase))
    throw Error('Owner must independently approve exact existing database name');
  if(typeof memberHmacSecret!=='string'||memberHmacSecret.length<32)
    throw Error('Existing stable member-token HMAC secret required privately');
  if(!pgUrl&&!pool)throw Error('Owner-approved PostgreSQL connection is required');
  // A reviewed witness is only accepted when it exactly matches the existing
  // singleton state revision, SHA-256 and observed production space count.
  // It is not permission to initialise or overwrite this database.
  const reviewed=reviewedExistingState||null;
  if(reviewed&&(typeof reviewed!=='object'||!Number.isSafeInteger(reviewed.revision)||
      reviewed.revision<1||!hex64.test(reviewed.sha256||'')||
      !Number.isSafeInteger(reviewed.liveSpaces)||reviewed.liveSpaces<0))
    throw Error('Invalid owner-reviewed existing-state witness');
  const base=cleanHost(host,{allowLoopback});
  const privateKey=signerKey(signingKeyB64);
  const authKeyCheck=crypto.createHmac('sha256',memberHmacSecret)
    .update('JM-CLOUD-CONTACT-SECRET-ID-v1').digest('hex');
  const evidence={
    schema:'JM.CloudContact.HostedCutoverPreflight/1',
    mode:'READ_ONLY',
    target:base,
    deploymentAuthorized:false,
    migrationPerformed:false,
    personalSecretsEmitted:false,
    observed:{},gates:[],holds:[],status:'HOLD'
  };
  function gate(name,pass,detail){
    evidence.gates.push({name,result:pass?'PASS':'HOLD',detail});
    if(!pass)evidence.holds.push(name);
  }
  gate('owner_secret_matches_expected_public_key',
    privateKey.fingerprint===expectedSigningKeyId,
    'Private PEM public identity must match the independent owner-approved key ID');
  const [meta,ready,publicKey,health]=await Promise.all([
    getPublic(base,'/meta',fetchImpl),getPublic(base,'/ready',fetchImpl),
    getPublic(base,'/receipt-key',fetchImpl),getPublic(base,'/health',fetchImpl)]);
  if(meta.version!=='0.5.1-hosted'||ready.ready!==true||
    !Array.isArray(meta.apiRoots)||!meta.apiRoots.includes('/v4'))
    throw Error('Unexpected production version/API/readiness; halt cutover');
  if(publicKey.algorithm!=='ECDSA-P256-SHA256-P1363'||!publicKey.publicKeyJwk)
    throw Error('Hosted server signature contract invalid');
  const actualPublicFingerprint=sha(canon(publicKey.publicKeyJwk)).slice(0,24);
  if(actualPublicFingerprint!==publicKey.keyId)
    throw Error('Hosted public-key fingerprint disagrees with reported ID');
  const spaces=Number(health.spaces);
  if(!Number.isSafeInteger(spaces)||spaces<0)
    throw Error('Server cannot prove contact-space count');
  evidence.observed={deployedVersion:meta.version,hostedKeyId:actualPublicFingerprint,
    ownerExpectedKeyId:expectedSigningKeyId,
    previouslyObservedKeyId:previouslyObservedKeyId||null,
    currentSpaces:spaces,hostedReady:true};
  // An explicitly owner-reviewed first bootstrap may replace an ephemeral
  // zero-space public signer ONCE. No key is generated, stored or rotated here.
  const planningRekey=bootstrapRekeyApproval==='JM_OWNER_APPROVED_ZERO_SPACE_REKEY_V1';
  const rekeyWindow=planningRekey&&spaces===0&&
    approvedLiveKeyId===actualPublicFingerprint&&
    previouslyObservedKeyId===actualPublicFingerprint&&
    expectedSigningKeyId!==actualPublicFingerprint;
  evidence.plannedKeyTransition=rekeyWindow?{
    oldLiveKeyId:actualPublicFingerprint,newOwnerKeyId:expectedSigningKeyId,
    executed:false,ownerDeploymentApprovalStillRequired:true
  }:null;
  gate('hosted_key_continuity_or_explicit_zero_space_rekey',
    actualPublicFingerprint===expectedSigningKeyId||rekeyWindow,
    'Only exact continuity or independently authorised zero-space, one-time rekey is eligible; no key is rotated by this check');
  if(previouslyObservedKeyId)
    gate('signer_unchanged_since_prior_observation',
      previouslyObservedKeyId===actualPublicFingerprint,
      'An observed signing-key change requires investigation, not a silent trust update');
  // Delay inventory gate until the actual durable snapshot can be examined.
  // No nonzero live inventory can be accepted on a virgin/empty database.
  const ownPool=pool||new Pool({connectionString:pgUrl,max:1,connectionTimeoutMillis:5500,
    idleTimeoutMillis:3000,statement_timeout:7000});
  let connection;
  try{
    connection=await ownPool.connect();
    await connection.query('BEGIN READ ONLY');
    const id=await connection.query("SELECT current_database() AS db, current_user AS role");
    const actualDb=id.rows[0]?.db;
    evidence.observed.databaseName=actualDb;
    gate('database_approved_name_matches',actualDb===approvedDatabase,
      'Only the explicitly approved existing PostgreSQL database may be inspected');
    const q=await connection.query(
      "SELECT to_regclass('jm_cloud_contact_v1.state')::text AS table_name");
    const hasState=Boolean(q.rows[0]?.table_name);
    const ns=await connection.query(
      "SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='jm_cloud_contact_v1') AS exists");
    evidence.observed.contactNamespaceExists=Boolean(ns.rows[0]?.exists);
    evidence.observed.contactStateTableExists=hasState;
    let reviewedRowMatch=false;
    if(hasState){
      const state=await connection.query(
        'SELECT revision,document_sha256,signer_key_id,auth_key_check,length(document) AS bytes FROM jm_cloud_contact_v1.state WHERE singleton=1');
      evidence.observed.durableRows=state.rowCount;
      if(state.rowCount===1){
        const row=state.rows[0];
        evidence.observed.durableRevision=Number(row.revision);
        evidence.observed.snapshotBytes=Number(row.bytes);
        const actualHash=String(row.document_sha256).trim();
        reviewedRowMatch=!!reviewed&&reviewed.revision===Number(row.revision)&&
          reviewed.sha256===actualHash&&reviewed.liveSpaces===spaces;
        gate('stored_signing_key_matches_owner_key',
          String(row.signer_key_id).trim()===expectedSigningKeyId,
          'Existing durable state may never silently adopt another signing identity');
        gate('stored_member_hmac_authority_matches',
          String(row.auth_key_check).trim()===authKeyCheck,
          'Member credential hashing secret must remain stable');
        gate('stored_snapshot_digest_format_valid',
          hex64.test(String(row.document_sha256).trim()),
          'Actual content checksum is checked by the server at controlled boot');
      }
      gate('existing_durable_state_requires_review',
        state.rowCount===0||reviewedRowMatch,
        'Existing state requires independent owner-reviewed revision, checksum and live-space count; no overwrite');
    }else evidence.observed.durableRows=0;
    gate('live_space_inventory_safe_for_cutover',
      spaces===0||reviewedRowMatch,
      'Nonzero hosted space inventory requires exact reviewed durable snapshot and no empty-store bootstrap');
    gate('bootstrap_rekey_requires_virgin_durable_state',
      !planningRekey||(rekeyWindow&&evidence.observed.durableRows===0),
      'A planned signer replacement is forbidden if durable contact records already exist');
    const dbSize=await connection.query('SELECT pg_database_size(current_database()) AS bytes');
    evidence.observed.databaseBytes=Number(dbSize.rows[0]?.bytes);
    gate('database_size_below_initial_cap',
      Number.isFinite(evidence.observed.databaseBytes)&&
      evidence.observed.databaseBytes<512*1024*1024,
      'Initial 1 GiB instance: requires space headroom; no market rows queried');
    gate('no_unreviewed_schema_collision',!evidence.observed.contactNamespaceExists||hasState,
      'Pre-existing empty/unrecognised contact namespace needs manual review');
    await connection.query('ROLLBACK');
  }catch(e){
    if(connection)await connection.query('ROLLBACK').catch(()=>{});
    throw Error('Read-only PostgreSQL preflight unavailable: '+String(e?.message||e));
  }finally{
    if(connection)connection.release();
    // pool.connect() clients are released after read-only transaction in finally below.
    if(!pool)await ownPool.end();
  }
  const secondKey=await getPublic(base,'/receipt-key',fetchImpl);
  if(secondKey.algorithm!=='ECDSA-P256-SHA256-P1363'||!secondKey.publicKeyJwk||
    sha(canon(secondKey.publicKeyJwk)).slice(0,24)!==secondKey.keyId)
    throw Error('Second hosted signing-key observation invalid');
  gate('signer_stable_during_read_only_preflight',
    secondKey.keyId===actualPublicFingerprint,
    'Hosting process changed public signer during preflight: no trust/promotion');
  evidence.status=evidence.holds.length?'HOLD':'TECHNICAL_PREFLIGHT_PASS_OWNER_APPROVAL_REQUIRED';
  return evidence;
}
async function main(){
  const env=process.env;
  const report=await inspectCutover({
    host:env.JM_CLOUD_HOSTED_ORIGIN||'https://jm-cloud-contact-server-v05.onrender.com',
    pgUrl:env.JM_CLOUD_CONTACT_POSTGRES_URL,
    approvedDatabase:env.JM_CLOUD_APPROVED_DATABASE,
    expectedSigningKeyId:env.JM_CLOUD_EXPECTED_SIGNING_KEY_ID,
    signingKeyB64:env.JM_CLOUD_RECEIPT_SIGNING_KEY_B64,
    memberHmacSecret:env.JM_CLOUD_SERVER_SECRET,
    previouslyObservedKeyId:env.JM_CLOUD_PREVIOUS_OBSERVED_KEY_ID||'',
    bootstrapRekeyApproval:env.JM_CLOUD_BOOTSTRAP_REKEY_APPROVAL||'',
    approvedLiveKeyId:env.JM_CLOUD_BOOTSTRAP_REKEY_OLD_KEY_ID||'',
    reviewedExistingState:env.JM_CLOUD_REVIEWED_STATE_SHA256?{
      sha256:env.JM_CLOUD_REVIEWED_STATE_SHA256,
      revision:Number(env.JM_CLOUD_REVIEWED_STATE_REVISION),
      liveSpaces:Number(env.JM_CLOUD_REVIEWED_LIVE_SPACES)
    }:null,
    allowLoopback:env.JM_CLOUD_QA_LOOPBACK==='1'
  });
  console.log(JSON.stringify(report,null,2));
  if(report.status!=='TECHNICAL_PREFLIGHT_PASS_OWNER_APPROVAL_REQUIRED')process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main().catch(e=>{console.error('JM_CONTACT_CUTOVER_HOLD: '+String(e?.message||e));process.exitCode=2});
