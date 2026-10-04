import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const STORE_SCHEMA = 'jm.sovereign-agent-gateway.remain-store/0.3';
const RECEIPT_SCHEMA = 'jm.sovereign-agent-gateway.remain-receipt/0.3';
const CONTROL_PROTOCOL = 'JM.MagnifyingGlass/1.0';
const CAGE_STATUSES = new Set(['AVAILABLE','CLAIMED','COMPLETED','SKIPPED_AS_STALE','BLOCKED','HOLD','FAILED_NEEDS_RECOVERY']);
const HOST_ROLE = 'CARRIER_NOT_SOURCE_AUTHORITY';

function sha256(data) { return createHash('sha256').update(data).digest('hex'); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
    return out;
  }
  return value;
}
function canonical(value) { return JSON.stringify(stable(value)); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function controlDigest(control) {
  const body = { ...control };
  delete body.digest;
  return sha256(canonical(body));
}
function receiptHash(entry) {
  const body = { ...entry };
  delete body.hash;
  return sha256(canonical(body));
}
function safeTokenMatch(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
function bearer(req) {
  const auth = String(req.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}
async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 8_000_000) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}
function json(res, status, body, extraHeaders = {}) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    'x-jm-host-role': HOST_ROLE,
    ...extraHeaders,
  });
  res.end(text);
}
async function atomicWriteJson(filename, value) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temp = `${filename}.tmp-${process.pid}-${Date.now()}`;
  const handle = await fs.open(temp, 'w', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temp, filename);
  await fs.chmod(filename, 0o600).catch(() => {});
}

export function validateMagnifyingControl(control, { current = null, requireSuccessor = false } = {}) {
  const errors = [];
  if (!control || control.protocol !== CONTROL_PROTOCOL) errors.push('protocol');
  if (!Number.isInteger(control?.revision) || control.revision < 0) errors.push('revision');
  if (control?.digest !== controlDigest(control)) errors.push('digest');
  if (!Array.isArray(control?.credited_keys) || new Set(control.credited_keys).size !== control.credited_keys.length) errors.push('credited_keys');
  if (!control?.authority || !Array.isArray(control.authority.allowed) || !Array.isArray(control.authority.prohibited)) errors.push('authority');
  if (control?.authority?.destructive_enabled !== false) errors.push('destructive_authority_must_remain_disabled');
  for (const [id, cage] of Object.entries(control?.cages || {})) {
    if (!CAGE_STATUSES.has(cage?.status)) errors.push(`cage_status:${id}`);
    const granted = new Set(control?.authority?.allowed || []);
    for (const a of cage?.authority || []) if (!granted.has(a)) errors.push(`cage_authority:${id}:${a}`);
  }
  if (current && requireSuccessor) {
    if (control.revision !== current.revision + 1) errors.push('successor_revision');
    if (control.parent_digest !== current.digest) errors.push('parent_digest');
    const oldAllowed = canonical([...(current.authority?.allowed || [])].sort());
    const newAllowed = canonical([...(control.authority?.allowed || [])].sort());
    const oldProhibited = canonical([...(current.authority?.prohibited || [])].sort());
    const newProhibited = canonical([...(control.authority?.prohibited || [])].sort());
    if (oldAllowed !== newAllowed) errors.push('authority_allowed_changed');
    if (oldProhibited !== newProhibited) errors.push('authority_prohibited_changed');
  }
  return { ok: errors.length === 0, errors, calculatedDigest: control ? controlDigest(control) : null };
}

function verifyRemainStore(store) {
  const errors = [];
  if (!store || store.schema !== STORE_SCHEMA) errors.push('schema');
  const controlCheck = validateMagnifyingControl(store?.control || {});
  if (!controlCheck.ok) errors.push(...controlCheck.errors.map(x => `control:${x}`));
  if (!Array.isArray(store?.journal)) errors.push('journal');
  let previous = null;
  for (let i = 0; i < (store?.journal || []).length; i += 1) {
    const entry = store.journal[i];
    if (entry.sequence !== i + 1) errors.push(`sequence:${i + 1}`);
    if ((entry.previousHash ?? null) !== previous) errors.push(`previousHash:${i + 1}`);
    if (entry.hash !== receiptHash(entry)) errors.push(`hash:${i + 1}`);
    previous = entry.hash;
  }
  if ((store?.headHash ?? null) !== previous) errors.push('headHash');
  if (store?.control && store?.journal?.length && store.journal.at(-1)?.controlDigest !== store.control.digest) errors.push('controlDigest');
  return { ok: errors.length === 0, errors, headHash: previous };
}

export async function createRemainControl(options = {}) {
  const seedControlPath = path.resolve(options.seedControlPath || process.env.JM_REMAIN_SEED_CONTROL || path.join(here, 'JM_MAGNIFYING_GLASS_CONTROL.json'));
  const enginePath = path.resolve(options.enginePath || process.env.JM_REMAIN_ENGINE || path.join(here, 'JM_MAGNIFYING_GLASS_ENGINE.py'));
  const dataPath = path.resolve(options.dataPath || process.env.JM_REMAIN_DATA || path.join(here, '.data', 'JM_REMAIN_CONTROL_STORE_v0_3.json'));
  const expectedEngineSha256 = options.expectedEngineSha256 || process.env.JM_REMAIN_ENGINE_SHA256 || '975fec007d2d34b8dacbfff0b1ecd5fbb327f2f78ece89002b09ab97999744ad';

  const [engineBytes, seedText] = await Promise.all([fs.readFile(enginePath), fs.readFile(seedControlPath, 'utf8')]);
  const engineSha256 = sha256(engineBytes);
  if (engineSha256 !== expectedEngineSha256) throw new Error(`JM_REMAIN_ENGINE_HASH_MISMATCH:${engineSha256}`);
  const seedControl = JSON.parse(seedText);
  const seedCheck = validateMagnifyingControl(seedControl);
  if (!seedCheck.ok) throw new Error(`JM_REMAIN_SEED_CONTROL_INVALID:${seedCheck.errors.join(',')}`);

  let store;
  let startupRecovered = false;
  try {
    store = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    const check = verifyRemainStore(store);
    if (!check.ok) throw new Error(`JM_REMAIN_STORE_VERIFY_FAILED:${check.errors.join(',')}`);
    startupRecovered = true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    store = {
      schema: STORE_SCHEMA,
      version: '0.3.0',
      sourceAuthorities: {
        gateway: 'Cading / JM Coding Estate',
        workerControl: CONTROL_PROTOCOL,
      },
      engineSha256,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      control: seedControl,
      journal: [],
      headHash: null,
    };
  }

  let tail = Promise.resolve();
  const persistStore = (event, details = {}) => {
    tail = tail.then(async () => {
      const entry = {
        schema: RECEIPT_SCHEMA,
        sequence: store.journal.length + 1,
        receiptId: `remain-receipt-${String(store.journal.length + 1).padStart(8, '0')}`,
        at: new Date().toISOString(),
        event,
        outcome: details.outcome || 'DING',
        actor: details.actor || 'system',
        previousHash: store.headHash,
        controlRevision: store.control.revision,
        controlDigest: store.control.digest,
        engineSha256,
      };
      entry.hash = receiptHash(entry);
      store.journal.push(entry);
      store.headHash = entry.hash;
      store.updatedAt = entry.at;
      await atomicWriteJson(dataPath, store);
      return clone(entry);
    });
    return tail;
  };

  if (!startupRecovered) await persistStore('REMAIN_STORE_CREATED');
  else await persistStore('REMAIN_STORE_RECOVERED');

  async function replaceControl({ expectedRevision, expectedDigest, candidate, actor = 'authorized-worker' }) {
    const current = store.control;
    if (expectedRevision !== current.revision || expectedDigest !== current.digest) {
      const err = new Error('JM_REMAIN_CONTROL_CONFLICT');
      err.code = 'JM_REMAIN_CONTROL_CONFLICT';
      err.current = { revision: current.revision, digest: current.digest };
      throw err;
    }
    const check = validateMagnifyingControl(candidate, { current, requireSuccessor: true });
    if (!check.ok) throw new Error(`JM_REMAIN_CANDIDATE_INVALID:${check.errors.join(',')}`);
    store.control = clone(candidate);
    const receipt = await persistStore('CONTROL_ADVANCED', { actor, outcome: 'DING' });
    return { control: clone(store.control), receipt };
  }

  return {
    dataPath,
    enginePath,
    engineSha256,
    startupRecovered,
    control: () => clone(store.control),
    store: () => clone(store),
    verify: () => verifyRemainStore(store),
    replaceControl,
  };
}

function proxyToInner(req, res, port) {
  const headers = { ...req.headers, host: `127.0.0.1:${port}` };
  const p = http.request({ hostname: '127.0.0.1', port, method: req.method, path: req.url, headers }, (inner) => {
    res.writeHead(inner.statusCode || 502, inner.headers);
    inner.pipe(res);
  });
  p.on('error', (error) => json(res, 502, { error: 'INNER_GATEWAY_UNAVAILABLE', message: error.message }));
  req.pipe(p);
}

export async function startRemainService(options = {}) {
  const clientToken = options.clientToken || process.env.JM_GATEWAY_CLIENT_TOKEN || process.env.JM_GATEWAY_TOKEN;
  const authorityToken = options.authorityToken || process.env.JM_GATEWAY_AUTHORITY_TOKEN || process.env.JM_GATEWAY_TOKEN;
  if (!clientToken) throw new Error('JM_GATEWAY_CLIENT_TOKEN_REQUIRED');
  if (!authorityToken) throw new Error('JM_GATEWAY_AUTHORITY_TOKEN_REQUIRED');

  const dataRoot = path.resolve(options.dataRoot || process.env.JM_REMAIN_DATA_ROOT || '/data');
  const remain = await createRemainControl({
    dataPath: options.remainDataPath || path.join(dataRoot, 'JM_REMAIN_CONTROL_STORE_v0_3.json'),
    seedControlPath: options.seedControlPath,
    enginePath: options.enginePath,
    expectedEngineSha256: options.expectedEngineSha256,
  });

  const gatewayModulePath = options.gatewayModulePath || '../gateway-cading-v0.2/JM_SOVEREIGN_AGENT_GATEWAY_API_CARRIER_v0_2.mjs';
  const gatewayModule = await import(new URL(gatewayModulePath, import.meta.url));
  const gateway = await gatewayModule.createGatewayCarrier({
    dataPath: options.gatewayDataPath || path.join(dataRoot, 'JM_SOVEREIGN_AGENT_GATEWAY_STORE_v0_2.json'),
    clientToken,
    authorityToken,
    acpToken: options.acpToken || process.env.JM_GATEWAY_ACP_TOKEN || authorityToken,
    acpEnabled: options.acpEnabled,
    durabilityTier: options.durabilityTier || 'JM_PERSISTENT_DATA_ROOT_REQUIRED_FOR_HOSTED_DURABILITY',
  });
  await new Promise((resolve, reject) => {
    gateway.server.once('error', reject);
    gateway.server.listen(0, '127.0.0.1', resolve);
  });
  const innerPort = gateway.server.address().port;

  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    try {
      const url = new URL(req.url || '/', 'http://jm.local');
      if (req.method === 'GET' && url.pathname === '/remain/health') {
        const verify = remain.verify();
        return json(res, verify.ok ? 200 : 503, {
          status: verify.ok ? 'READY' : 'HOLD',
          body: 'JM SOVEREIGN AGENT GATEWAY — Magnifying Glass control face',
          version: '0.3.0',
          keeper: 'YOUR DOOR. MANY AGENTS. YOUR AUTHORITY.',
          control: { protocol: CONTROL_PROTOCOL, revision: remain.control().revision, digest: remain.control().digest },
          engineSha256: remain.engineSha256,
          startupRecovered: remain.startupRecovered,
          destructiveAuthority: false,
          requestId,
        });
      }
      const token = bearer(req);
      const clientOk = safeTokenMatch(token, clientToken) || safeTokenMatch(token, authorityToken);
      const authorityOk = safeTokenMatch(token, authorityToken);
      if (url.pathname.startsWith('/remain/') && !clientOk) return json(res, 401, { error: 'UNAUTHORISED', requestId });
      if (req.method === 'GET' && url.pathname === '/remain/control') {
        const control = remain.control();
        return json(res, 200, { control, requestId }, { etag: `"${control.digest}"`, 'x-jm-control-revision': String(control.revision) });
      }
      if (req.method === 'GET' && url.pathname === '/remain/reentry') {
        const control = remain.control();
        return json(res, 200, {
          instruction: 'Recover current control and its hash-bound engine; validate; claim only an AVAILABLE cage; re-contact authority bodies before any side effect.',
          control: { protocol: control.protocol, revision: control.revision, digest: control.digest },
          engineSha256: remain.engineSha256,
          nextAction: control.next_action,
          destructiveAuthority: false,
          requestId,
        });
      }
      if (req.method === 'GET' && url.pathname === '/remain/receipts') {
        const store = remain.store();
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 25)));
        return json(res, 200, { receipts: store.journal.slice(-limit), count: store.journal.length, headHash: store.headHash, requestId });
      }
      if (req.method === 'PUT' && url.pathname === '/remain/control') {
        if (!authorityOk) return json(res, 403, { error: 'HUMAN_AUTHORITY_TOKEN_REQUIRED', requestId });
        const body = await readJson(req);
        if (!body.control || !Number.isInteger(body.expectedRevision) || typeof body.expectedDigest !== 'string') {
          return json(res, 400, { error: 'expectedRevision_expectedDigest_control_required', requestId });
        }
        try {
          const advanced = await remain.replaceControl({
            expectedRevision: body.expectedRevision,
            expectedDigest: body.expectedDigest,
            candidate: body.control,
            actor: String(body.actor || 'authorized-worker'),
          });
          return json(res, 200, { ...advanced, requestId });
        } catch (error) {
          if (error?.code === 'JM_REMAIN_CONTROL_CONFLICT') return json(res, 409, { error: error.code, current: error.current, requestId });
          return json(res, 422, { error: 'CONTROL_ADVANCE_REJECTED', message: String(error?.message || error), requestId });
        }
      }
      return proxyToInner(req, res, innerPort);
    } catch (error) {
      return json(res, error?.message === 'REQUEST_TOO_LARGE' ? 413 : 500, { error: 'REMAIN_SERVICE_ERROR', message: String(error?.message || error), requestId });
    }
  });

  server.on('close', () => gateway.server.close());
  const port = Number(options.port || process.env.PORT || 8787);
  const host = options.host || process.env.HOST || '0.0.0.0';
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  return { server, remain, gateway, innerPort, host, port };
}

if (import.meta.url === new URL(`file://${process.argv[1] || ''}`).href) {
  const service = await startRemainService();
  console.log(JSON.stringify({
    status: 'LISTENING', host: service.host, port: service.port,
    version: '0.3.0', controlRevision: service.remain.control().revision,
    controlDigest: service.remain.control().digest,
    engineSha256: service.remain.engineSha256,
    destructiveAuthority: false,
  }));
}
