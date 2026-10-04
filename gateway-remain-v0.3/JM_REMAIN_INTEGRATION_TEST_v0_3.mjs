import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { startRemainService } from './JM_SOVEREIGN_AGENT_GATEWAY_REMAIN_v0_3.mjs';

const host = '127.0.0.1';
const port = 18887;
const base = `http://${host}:${port}`;
const clientToken = 'jm-v03-integration-client';
const authorityToken = 'jm-v03-integration-authority';
const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'jm-remain-integration-'));

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) o[k] = stable(v[k]);
    return o;
  }
  return v;
}
function digestControl(c) {
  const body = { ...c };
  delete body.digest;
  return createHash('sha256').update(JSON.stringify(stable(body))).digest('hex');
}
async function request(pathname, { method='GET', token=null, body=null } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== null) headers['content-type'] = 'application/json';
  const res = await fetch(base + pathname, {
    method, headers, body: body === null ? undefined : JSON.stringify(body)
  });
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, json, headers: res.headers };
}
async function close(service) {
  await new Promise((resolve) => service.server.close(resolve));
  await new Promise((resolve) => setTimeout(resolve, 100));
}

let service = await startRemainService({
  host, port, dataRoot, clientToken, authorityToken, acpEnabled: false,
  durabilityTier: 'INTEGRATION_TEST_PERSISTENT_DIRECTORY'
});

const health1 = await request('/remain/health');
if (health1.status !== 200 || health1.json?.control?.revision !== 19 || health1.json?.destructiveAuthority !== false) {
  throw new Error(`initial health failed: ${JSON.stringify(health1)}`);
}

const read1 = await request('/remain/control', { token: clientToken });
if (read1.status !== 200) throw new Error(`control read failed: ${read1.status}`);
const current = read1.json.control;
const candidate = structuredClone(current);
candidate.revision = current.revision + 1;
candidate.parent_digest = current.digest;
candidate.next_action = 'integration-test-successor';
candidate.digest = digestControl(candidate);

const advance = await request('/remain/control', {
  method: 'PUT', token: authorityToken,
  body: { expectedRevision: current.revision, expectedDigest: current.digest, control: candidate, actor: 'integration-test-worker' }
});
if (advance.status !== 200 || advance.json?.control?.revision !== candidate.revision) {
  throw new Error(`control advance failed: ${JSON.stringify(advance)}`);
}

const stale = await request('/remain/control', {
  method: 'PUT', token: authorityToken,
  body: { expectedRevision: current.revision, expectedDigest: current.digest, control: candidate, actor: 'stale-integration-worker' }
});
if (stale.status !== 409) throw new Error(`stale write not rejected: ${JSON.stringify(stale)}`);

const created = await request('/api/v1/tasks', {
  method: 'POST', token: clientToken, body: { prompt: 'v0.3 integration task', agent: 'replaceable-test-agent' }
});
if (created.status !== 201) throw new Error(`gateway create failed: ${JSON.stringify(created)}`);
const taskId = created.json.task.id;

const preDispatch = await request(`/api/v1/tasks/${encodeURIComponent(taskId)}/dispatch`, {
  method: 'POST', token: authorityToken, body: {}
});
if (preDispatch.status !== 409 || preDispatch.json?.authorityRequired !== true) {
  throw new Error(`pre-authority HOLD failed: ${JSON.stringify(preDispatch)}`);
}

const approved = await request(`/api/v1/tasks/${encodeURIComponent(taskId)}/approve`, {
  method: 'POST', token: authorityToken, body: {}
});
if (approved.status !== 200) throw new Error(`approve failed: ${JSON.stringify(approved)}`);

const dispatched = await request(`/api/v1/tasks/${encodeURIComponent(taskId)}/dispatch`, {
  method: 'POST', token: authorityToken, body: {}
});
if (dispatched.status !== 200 || dispatched.json?.task?.status !== 'READY_FOR_AGENT_ROUTE') {
  throw new Error(`dispatch failed: ${JSON.stringify(dispatched)}`);
}

await close(service);

service = await startRemainService({
  host, port, dataRoot, clientToken, authorityToken, acpEnabled: false,
  durabilityTier: 'INTEGRATION_TEST_PERSISTENT_DIRECTORY'
});

const health2 = await request('/remain/health');
if (health2.status !== 200 || health2.json?.control?.revision !== candidate.revision || health2.json?.startupRecovered !== true) {
  throw new Error(`restart recovery health failed: ${JSON.stringify(health2)}`);
}
const taskAfter = await request(`/api/v1/tasks/${encodeURIComponent(taskId)}`, { token: clientToken });
if (taskAfter.status !== 200 || taskAfter.json?.task?.status !== 'READY_FOR_AGENT_ROUTE') {
  throw new Error(`gateway restart recovery failed: ${JSON.stringify(taskAfter)}`);
}
const receipts = await request('/remain/receipts?limit=100', { token: clientToken });
if (receipts.status !== 200 || receipts.json?.count < 3) {
  throw new Error(`remain receipts failed: ${JSON.stringify(receipts)}`);
}

await close(service);

console.log(JSON.stringify({
  status: 'PASS',
  initialRevision: current.revision,
  landedRevision: candidate.revision,
  staleWriteRejected: true,
  authorityHoldBeforeApproval: true,
  taskRecoveredAfterRestart: true,
  controlRecoveredAfterRestart: true,
  destructiveAuthority: false,
  remainReceiptCount: receipts.json.count,
  taskId
}));
