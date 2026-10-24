// Isomorphic protocol: no shell commands, filesystem paths or external imports.
const te = new TextEncoder();
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
const fail = code => { const e = new Error(code); e.code = code; throw e; };
export const LIMIT = 16384;
export function validateMission(m) {
  if (!m || Array.isArray(m) || typeof m !== 'object') fail('BAD_MISSION');
  const allowed = new Set(['id','op','target','artifact','expected_revision','content','source_revision','challenge','sig']);
  if (Object.keys(m).some(k => !allowed.has(k))) fail('UNKNOWN_FIELD');
  if (typeof m.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{5,79}$/.test(m.id)) fail('BAD_ID');
  if (typeof m.target !== 'string' || !/^[A-Za-z0-9_-]{2,48}$/.test(m.target)) fail('BAD_TARGET');
  if (!['probe','put','restore'].includes(m.op)) fail('BAD_OPERATION');
  if (m.op === 'probe') {
    if (m.artifact !== undefined || m.content !== undefined || m.expected_revision !== undefined || m.source_revision !== undefined) fail('PROBE_FIELDS');
    if(m.challenge!==undefined&&(typeof m.challenge!=='string'||!/^[a-f0-9]{32}$/.test(m.challenge)))fail('BAD_PROBE_CHALLENGE');
  } else {
    if(m.challenge!==undefined)fail('CHALLENGE_ONLY_ON_PROBE');
    if (typeof m.artifact !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(m.artifact) || m.artifact === '..') fail('BAD_ARTIFACT');
    if (!Number.isSafeInteger(m.expected_revision) || m.expected_revision < 0) fail('BAD_REVISION');
    if (m.op === 'put') {
      if (typeof m.content !== 'string' || te.encode(m.content).byteLength > LIMIT || m.source_revision !== undefined) fail('BAD_CONTENT');
    } else {
      if (!Number.isSafeInteger(m.source_revision) || m.source_revision < 1 || m.content !== undefined) fail('BAD_SOURCE_REVISION');
    }
  }
  if (typeof m.sig !== 'string' || !/^[a-f0-9]{64}$/.test(m.sig)) fail('BAD_SIGNATURE');
  return m;
}
export function missionCore(m) {
  const o = { id:m.id, op:m.op, target:m.target };
  if(m.op==='probe'&&m.challenge!==undefined)o.challenge=m.challenge;
  if (m.op !== 'probe') {
    o.artifact=m.artifact;
    o.expected_revision=m.expected_revision;
    if (m.op === 'put') o.content=m.content;
    else o.source_revision=m.source_revision;
  }
  return o;
}
export const missionText = m => JSON.stringify(missionCore(m));
export const receiptCore = r => ({
  id:r.id, job_hash:r.job_hash, status:r.status, code:r.code,
  artifact:r.artifact, revision:r.revision, content_hash:r.content_hash,
  prev_chain:r.prev_chain, chain_hash:r.chain_hash
});
export async function sha256(s) { return hex(await crypto.subtle.digest('SHA-256',te.encode(s))); }
export async function hmac(key, text) {
  const k = await crypto.subtle.importKey('raw',te.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',k,te.encode(text)));
}
export function fixedEqualHex(a,b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let n=0; for(let i=0;i<a.length;i++) n |= a.charCodeAt(i)^b.charCodeAt(i); return n===0;
}
export async function checkMission(m,key) {
  validateMission(m);
  if (!fixedEqualHex(m.sig,await hmac(key,missionText(m)))) fail('INVALID_MISSION_SIGNATURE');
  return sha256(missionText(m));
}
export async function signMission(core,key) {
  const m={...core,sig:'0'.repeat(64)};
  validateMission(m);
  m.sig=await hmac(key,missionText(m)); return m;
}
export async function checkReceipt(r,key) {
  if (!r || typeof r !== 'object' || !/^[a-f0-9]{64}$/.test(r.sig||'')) fail('BAD_RECEIPT');
  if (!['PASS','HOLD'].includes(r.status) || !/^[a-f0-9]{64}$/.test(r.job_hash || '')) fail('BAD_RECEIPT');
  if (!fixedEqualHex(await hmac(key, JSON.stringify(receiptCore(r))),r.sig)) fail('INVALID_RECEIPT_SIGNATURE');
  return true;
}
export const json = (body,status=200) => new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export function assertSecrets(e,keys) { for(const k of keys) if(typeof e[k] !== 'string' || e[k].length<32) fail(`MISSING_${k}`); }
