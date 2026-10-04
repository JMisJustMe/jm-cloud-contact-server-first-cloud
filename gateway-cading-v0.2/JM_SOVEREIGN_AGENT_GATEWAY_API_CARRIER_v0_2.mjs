import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, timingSafeEqual, randomUUID } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXPECTED_JS_CARRIER_SHA256 = 'f3330a26238be993dc0ad0a0dc8cf3c9a2c703fe6e577a52be3eb4482c228b7b';
const EXPECTED_SOURCE_SHA256 = '2a1a6e82f615599c9c79f8c5d21a0978cfbf977f566957de1f8324e276ac7479';
const SOURCE_AUTHORITY = 'Cading / JM Coding Estate';
const HOST_ROLE = 'CARRIER_NOT_SOURCE_AUTHORITY';
const STORE_SCHEMA = 'jm.sovereign-agent-gateway.store/0.2';
const RECEIPT_SCHEMA = 'jm.sovereign-agent-gateway.durable-receipt/0.2';

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}
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
function safeTokenMatch(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
function bearer(req) {
  const auth = String(req.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}
function json(res, status, body, extraHeaders = {}) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
    'x-jm-source-authority': 'cading',
    'x-jm-host-role': HOST_ROLE,
    ...extraHeaders,
  });
  res.end(text);
}
async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 1_000_000) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function allowedOrigin(origin, configured) {
  if (!origin) return null;
  return configured.includes(origin) ? origin : null;
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
function receiptHash(entry) {
  const basis = { ...entry };
  delete basis.hash;
  return sha256(canonical(basis));
}
function verifyStore(store) {
  const errors = [];
  if (!store || store.schema !== STORE_SCHEMA) errors.push('schema');
  if (store?.sourceSha256 !== EXPECTED_SOURCE_SHA256) errors.push('sourceSha256');
  if (!Array.isArray(store?.journal)) errors.push('journal');
  let previous = null;
  if (Array.isArray(store?.journal)) {
    for (let i = 0; i < store.journal.length; i += 1) {
      const entry = store.journal[i];
      if (entry.sequence !== i + 1) errors.push(`sequence:${i + 1}`);
      if ((entry.previousHash ?? null) !== previous) errors.push(`previousHash:${i + 1}`);
      const expected = receiptHash(entry);
      if (entry.hash !== expected) errors.push(`hash:${i + 1}`);
      previous = entry.hash;
    }
  }
  if ((store?.headHash ?? null) !== previous) errors.push('headHash');
  if (store?.state && store.journal?.length) {
    const stateDigest = sha256(canonical(store.state));
    if (store.journal.at(-1)?.stateDigest !== stateDigest) errors.push('stateDigest');
  }
  return { ok: errors.length === 0, errors, headHash: previous };
}

export async function createGatewayCarrier(options = {}) {
  const carrierRuntimePath = path.resolve(options.carrierRuntimePath || process.env.JM_GATEWAY_CADING_JS_CARRIER || path.join(here, 'JM_SOVEREIGN_AGENT_GATEWAY_CADING_JS_CARRIER_v0_2.mjs'));
  const sourcePath = path.resolve(options.sourcePath || process.env.JM_GATEWAY_CADING_SOURCE || path.join(here, 'JM_SOVEREIGN_AGENT_GATEWAY_v0_2.cading'));
  const dataPath = path.resolve(options.dataPath || process.env.JM_GATEWAY_DATA || path.join(here, '.data', 'JM_SOVEREIGN_AGENT_GATEWAY_STORE_v0_2.json'));
  const clientToken = options.clientToken || process.env.JM_GATEWAY_CLIENT_TOKEN || process.env.JM_GATEWAY_TOKEN;
  const authorityToken = options.authorityToken || process.env.JM_GATEWAY_AUTHORITY_TOKEN || process.env.JM_GATEWAY_TOKEN;
  const acpToken = options.acpToken || process.env.JM_GATEWAY_ACP_TOKEN || authorityToken;
  const origins = String(options.origins ?? process.env.JM_GATEWAY_ORIGINS ?? '').split(',').map(x => x.trim()).filter(Boolean);
  const configuredDurabilityTier = options.durabilityTier || process.env.JM_GATEWAY_DURABILITY_TIER || 'FILESYSTEM_LOCAL_OR_EPHEMERAL_UNLESS_HOST_PERSISTS_PATH';
  const acpEnabled = options.acpEnabled ?? String(process.env.JM_GATEWAY_ACP_ENABLED || '').toLowerCase() === 'true';
  if (!clientToken) throw new Error('JM_GATEWAY_CLIENT_TOKEN_REQUIRED');
  if (!authorityToken) throw new Error('JM_GATEWAY_AUTHORITY_TOKEN_REQUIRED');

  const [carrierBytes, source] = await Promise.all([fs.readFile(carrierRuntimePath), fs.readFile(sourcePath, 'utf8')]);
  const carrierSha256 = sha256(carrierBytes);
  const sourceSha256 = sha256(source);
  if (carrierSha256 !== EXPECTED_JS_CARRIER_SHA256) throw new Error(`JM_JS_CARRIER_HASH_MISMATCH:${carrierSha256}`);
  if (sourceSha256 !== EXPECTED_SOURCE_SHA256) throw new Error(`JM_CADING_SOURCE_HASH_MISMATCH:${sourceSha256}`);

  const carrierModule = await import(pathToFileURL(carrierRuntimePath).href);
  if (carrierModule.SOURCE_SHA256 !== sourceSha256) throw new Error('JM_JS_CARRIER_SOURCE_AUTHORITY_MISMATCH');
  if (carrierModule.HOST_ROLE !== HOST_ROLE) throw new Error('JM_JS_CARRIER_HOST_ROLE_MISMATCH');
  if (carrierModule.COMPILE_PROOF?.validation !== 'PASS') throw new Error('JM_JS_CARRIER_COMPILE_PROOF_NOT_PASS');
  if (typeof carrierModule.createGatewayRuntime !== 'function') throw new Error('JM_JS_CARRIER_RUNTIME_FACTORY_MISSING');
  const runtime = carrierModule.createGatewayRuntime();
  const compileProof = carrierModule.COMPILE_PROOF;
  const invoke = (name, args = []) => runtime.invoke(name, args);
  const exportState = () => clone(invoke('exportState', []));
  const statusOf = (id) => invoke('taskStatus', [id]);

  let store;
  let startupRecovered = false;
  try {
    store = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    const verified = verifyStore(store);
    if (!verified.ok) throw new Error(`JM_GATEWAY_STORE_VERIFY_FAILED:${verified.errors.join(',')}`);
    const imported = invoke('importState', [clone(store.state)]);
    if (imported !== true) throw new Error('JM_GATEWAY_STORE_IMPORT_HELD');
    startupRecovered = true;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    store = {
      schema: STORE_SCHEMA,
      version: '0.2.0',
      sourceSha256,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      state: exportState(),
      journal: [],
      headHash: null,
    };
  }

  let persistenceTail = Promise.resolve();
  const persist = (event, details = {}) => {
    persistenceTail = persistenceTail.then(async () => {
      const state = exportState();
      const entry = {
        schema: RECEIPT_SCHEMA,
        sequence: store.journal.length + 1,
        receiptId: `gw-receipt-${String(store.journal.length + 1).padStart(8, '0')}`,
        at: new Date().toISOString(),
        event,
        taskId: details.taskId ?? null,
        outcome: details.outcome ?? 'DING',
        sourceAuthority: SOURCE_AUTHORITY,
        hostRole: HOST_ROLE,
        previousHash: store.headHash,
        stateDigest: sha256(canonical(state)),
        sourceSha256,
      };
      entry.hash = receiptHash(entry);
      store.state = state;
      store.journal.push(entry);
      store.headHash = entry.hash;
      store.updatedAt = entry.at;
      await atomicWriteJson(dataPath, store);
      return entry;
    });
    return persistenceTail;
  };

  if (startupRecovered) await persist('STORE_RECOVERED', { outcome: 'DING' });
  else await persist('STORE_CREATED', { outcome: 'DING' });

  async function mutate(name, args, event, taskId = null, outcome = 'DING') {
    const before = exportState();
    const result = invoke(name, args);
    try {
      const receipt = await persist(event, { taskId, outcome });
      return { result, receipt };
    } catch (error) {
      const restored = invoke('importState', [before]);
      if (restored !== true) throw new Error(`PERSISTENCE_FAILED_AND_ROLLBACK_HELD:${error?.message || error}`);
      throw error;
    }
  }

  let acpState = acpEnabled ? 'INITIALISING' : 'DISABLED';
  let acpHttpHandler = null;
  let acpWebSocketUpgradeHandler = null;
  const acpSessions = new Map();

  if (acpEnabled) {
    if (!acpToken) throw new Error('JM_GATEWAY_ACP_TOKEN_REQUIRED');
    const [acp, serverModule, nodeModule, wsModule] = await Promise.all([
      import('@agentclientprotocol/sdk'),
      import('@agentclientprotocol/sdk/experimental/server'),
      import('@agentclientprotocol/sdk/experimental/node'),
      import('ws'),
    ]);
    const implementation = {
      async initialize() {
        return { protocolVersion: acp.PROTOCOL_VERSION, agentCapabilities: { loadSession: false } };
      },
      async newSession(params) {
        const sessionId = randomUUID();
        acpSessions.set(sessionId, { cwd: params.cwd || null, createdAt: new Date().toISOString() });
        return { sessionId };
      },
      async authenticate() { return {}; },
      async prompt(params, client) {
        if (!acpSessions.has(params.sessionId)) throw new Error(`Session ${params.sessionId} not found`);
        const text = (params.prompt || []).map((block) => block?.type === 'text' ? block.text : `[${block?.type || 'content'}]`).join('\n').trim();
        const created = await mutate('createTask', [text || 'ACP prompt', 'acp-unbound-agent'], 'ACP_TASK_CREATED', null, 'DING');
        const taskId = created.result;
        await client.notify(acp.methods.client.session.update, {
          sessionId: params.sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId: taskId,
            title: `JM authority gate for ${taskId}`,
            kind: 'other',
            status: 'pending',
            rawInput: { taskId, sourceAuthority: SOURCE_AUTHORITY },
          },
        });
        const permission = await client.request(acp.methods.client.session.requestPermission, {
          sessionId: params.sessionId,
          toolCall: {
            toolCallId: taskId,
            title: `Authorise JM task ${taskId}`,
            kind: 'other',
            status: 'pending',
            rawInput: { taskId, authority: 'HUMAN_FINAL' },
          },
          options: [
            { kind: 'allow_once', name: 'Authorise this JM task', optionId: 'allow' },
            { kind: 'reject_once', name: 'Hold this JM task', optionId: 'reject' },
          ],
        });
        if (permission.outcome.outcome === 'cancelled' || permission.outcome.optionId !== 'allow') {
          await persist('ACP_PERMISSION_HELD', { taskId, outcome: 'HOLD' });
          await client.notify(acp.methods.client.session.update, {
            sessionId: params.sessionId,
            update: { sessionUpdate: 'tool_call_update', toolCallId: taskId, status: 'failed', rawOutput: { taskId, status: 'HOLD_AUTHORITY_REQUIRED' } },
          });
          await client.notify(acp.methods.client.session.update, {
            sessionId: params.sessionId,
            update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `JM task ${taskId} remains held. No authority was granted.` } },
          });
          return { stopReason: 'end_turn' };
        }
        await mutate('approveTask', [taskId], 'ACP_AUTHORITY_APPROVED', taskId, 'DING');
        await mutate('dispatchTask', [taskId], 'ACP_DISPATCH_AUTHORISED', taskId, 'DING');
        await client.notify(acp.methods.client.session.update, {
          sessionId: params.sessionId,
          update: { sessionUpdate: 'tool_call_update', toolCallId: taskId, status: 'completed', rawOutput: { taskId, status: statusOf(taskId)?.status } },
        });
        await client.notify(acp.methods.client.session.update, {
          sessionId: params.sessionId,
          update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: `JM task ${taskId} is authorised and ready for an external agent route.` } },
        });
        return { stopReason: 'end_turn' };
      },
      async cancel() {},
    };
    const agent = acp
      .agent({ name: 'jm-sovereign-agent-gateway' })
      .onRequest(acp.methods.agent.initialize, (ctx) => implementation.initialize(ctx.params))
      .onRequest(acp.methods.agent.session.new, (ctx) => implementation.newSession(ctx.params))
      .onRequest(acp.methods.agent.authenticate, (ctx) => implementation.authenticate(ctx.params))
      .onRequest(acp.methods.agent.session.prompt, (ctx) => implementation.prompt(ctx.params, ctx.client))
      .onNotification(acp.methods.agent.session.cancel, (ctx) => implementation.cancel(ctx.params));
    const acpServer = new serverModule.AcpServer({ agent });
    acpHttpHandler = nodeModule.createNodeHttpHandler(acpServer);
    const webSocketServer = new wsModule.WebSocketServer({ noServer: true });
    acpWebSocketUpgradeHandler = nodeModule.createNodeWebSocketUpgradeHandler(acpServer, webSocketServer);
    acpState = 'ACP_V1_HTTP_WEBSOCKET_MOUNTED';
  }

  const meta = () => ({
    schema: 'jm.sovereign-agent-gateway.api-carrier/0.2',
    name: 'JM SOVEREIGN AGENT GATEWAY',
    version: '0.2.0',
    keeper: 'YOUR DOOR. MANY AGENTS. YOUR AUTHORITY.',
    sourceAuthority: SOURCE_AUTHORITY,
    hostRole: HOST_ROLE,
    source: { language: 'Cading', sha256: sourceSha256, irKind: compileProof.irKind, irVersion: compileProof.irVersion, validation: compileProof.validation, normalizedDigest: compileProof.normalizedDigest },
    runtime: { body: 'JM_SOVEREIGN_AGENT_GATEWAY_CADING_JS_CARRIER_v0_2', sha256: carrierSha256, hostRole: HOST_ROLE, fullCompilerRuntimeSha256: compileProof.fullRuntimeSha256 },
    persistence: { schema: STORE_SCHEMA, configuredDurabilityTier, startupRecovered, verified: verifyStore(store).ok, receiptCount: store.journal.length, headHash: store.headHash },
    auth: { clientToken: 'REQUIRED', authorityToken: 'REQUIRED', splitAuthority: clientToken !== authorityToken, acpTokenConfigured: Boolean(acpToken) },
    adapters: { jmHttpApi: 'ACTIVE', acp: acpState, externalAgents: 'NOT_YET_MOUNTED' },
    claimBoundary: 'CADING_SOURCE_AND_DURABLE_FILESYSTEM_RECOVERY_PROVABLE; HOST_DISK_DURABILITY_ONLY_EARNED_AFTER_DEPLOY_RESTART_DING; EXTERNAL_AGENT_EXECUTION_NOT_CLAIMED',
  });

  const clientAuth = (req) => safeTokenMatch(bearer(req), clientToken) || safeTokenMatch(bearer(req), authorityToken);
  const authorityAuth = (req) => safeTokenMatch(bearer(req), authorityToken);

  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    try {
      const url = new URL(req.url || '/', 'http://jm.local');
      const origin = allowedOrigin(String(req.headers.origin || ''), origins);
      const corsHeaders = origin ? { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'vary': 'Origin' } : {};
      if (req.method === 'OPTIONS') return json(res, origin ? 204 : 403, origin ? {} : { error: 'ORIGIN_NOT_ALLOWED' }, corsHeaders);
      if (req.method === 'GET' && url.pathname === '/health') return json(res, 200, { status: 'UP', body: 'JM SOVEREIGN AGENT GATEWAY', version: '0.2.0', hostRole: HOST_ROLE, requestId }, corsHeaders);
      if (req.method === 'GET' && url.pathname === '/ready') {
        const verification = verifyStore(store);
        return json(res, verification.ok ? 200 : 503, { status: verification.ok ? 'READY' : 'HOLD', cading: 'PASS', runtime: 'PASS', persistence: verification.ok ? 'PASS' : 'HOLD', configuredDurabilityTier, startupRecovered, requestId }, corsHeaders);
      }
      if (url.pathname === '/acp') {
        if (!acpEnabled || !acpHttpHandler) return json(res, 503, { error: 'ACP_NOT_ENABLED', state: acpState, requestId }, corsHeaders);
        if (!safeTokenMatch(bearer(req), acpToken)) return json(res, 401, { error: 'ACP_UNAUTHORISED', requestId }, corsHeaders);
        return acpHttpHandler(req, res);
      }
      if (!clientAuth(req)) return json(res, 401, { error: 'UNAUTHORISED', requestId }, corsHeaders);

      if (req.method === 'GET' && url.pathname === '/api/v1/meta') return json(res, 200, meta(), corsHeaders);
      if (req.method === 'GET' && url.pathname === '/api/v1/agents') return json(res, 200, { agents: [], state: 'NO_EXTERNAL_AGENT_ADAPTER_MOUNTED', requestId }, corsHeaders);
      if (req.method === 'GET' && url.pathname === '/api/v1/tasks') {
        const tasks = Object.values(invoke('listTasks', []) || {});
        return json(res, 200, { tasks, count: tasks.length, requestId }, corsHeaders);
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/receipts') {
        const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || 25)));
        return json(res, 200, { receipts: store.journal.slice(-limit), count: store.journal.length, headHash: store.headHash, requestId }, corsHeaders);
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/receipts/runtime') return json(res, 200, runtime.receipt({ sourceAuthority: SOURCE_AUTHORITY, hostRole: HOST_ROLE }), corsHeaders);

      if (req.method === 'POST' && url.pathname === '/api/v1/tasks') {
        const bodyJson = await readJson(req);
        if (!bodyJson.prompt || !bodyJson.agent) return json(res, 400, { error: 'prompt_and_agent_required', requestId }, corsHeaders);
        const created = await mutate('createTask', [String(bodyJson.prompt), String(bodyJson.agent)], 'TASK_CREATED', null, 'DING');
        const id = created.result;
        return json(res, 201, { task: statusOf(id), receipt: created.receipt, requestId }, corsHeaders);
      }

      const match = url.pathname.match(/^\/api\/v1\/tasks\/([^/]+)(?:\/(approve|dispatch))?$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        const action = match[2] || null;
        if (req.method === 'GET' && !action) {
          const task = statusOf(id);
          return task ? json(res, 200, { task, requestId }, corsHeaders) : json(res, 404, { error: 'TASK_NOT_FOUND', id, requestId }, corsHeaders);
        }
        if (req.method === 'POST' && action === 'approve') {
          if (!authorityAuth(req)) return json(res, 403, { error: 'HUMAN_AUTHORITY_TOKEN_REQUIRED', id, requestId }, corsHeaders);
          const existing = statusOf(id);
          if (!existing) {
            await persist('APPROVAL_HOLD_NO_TASK', { taskId: id, outcome: 'HOLD' });
            return json(res, 404, { error: 'TASK_NOT_FOUND', id, requestId }, corsHeaders);
          }
          const approved = await mutate('approveTask', [id], 'AUTHORITY_APPROVED', id, 'DING');
          return json(res, 200, { result: approved.result, task: statusOf(id), receipt: approved.receipt, requestId }, corsHeaders);
        }
        if (req.method === 'POST' && action === 'dispatch') {
          if (!authorityAuth(req)) return json(res, 403, { error: 'HUMAN_AUTHORITY_TOKEN_REQUIRED', id, requestId }, corsHeaders);
          const existing = statusOf(id);
          if (!existing) {
            await persist('DISPATCH_HOLD_NO_TASK', { taskId: id, outcome: 'HOLD' });
            return json(res, 404, { error: 'TASK_NOT_FOUND', id, requestId }, corsHeaders);
          }
          const outcome = existing.approved ? 'DING' : 'HOLD';
          const dispatched = await mutate('dispatchTask', [id], existing.approved ? 'DISPATCH_AUTHORISED' : 'DISPATCH_HOLD_AUTHORITY_REQUIRED', id, outcome);
          const task = statusOf(id);
          return json(res, task?.approved ? 200 : 409, { result: dispatched.result, task, receipt: dispatched.receipt, authorityRequired: !task?.approved, requestId }, corsHeaders);
        }
      }
      return json(res, 404, { error: 'NOT_FOUND', requestId }, corsHeaders);
    } catch (error) {
      const status = error?.message === 'REQUEST_TOO_LARGE' ? 413 : 500;
      return json(res, status, { error: 'GATEWAY_CARRIER_ERROR', message: String(error?.message || error), requestId });
    }
  });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://jm.local');
    if (url.pathname !== '/acp' || !acpEnabled || !acpWebSocketUpgradeHandler || !safeTokenMatch(bearer(req), acpToken)) {
      socket.destroy();
      return;
    }
    acpWebSocketUpgradeHandler(req, socket, head);
  });

  return { server, meta, runtime, compileProof, store: () => clone(store), dataPath, persist, mutate, acpState: () => acpState };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  const gateway = await createGatewayCarrier();
  gateway.server.listen(port, host, () => console.log(JSON.stringify({ status: 'LISTENING', host, port, version: '0.2.0', sourceAuthority: SOURCE_AUTHORITY, hostRole: HOST_ROLE, dataPath: gateway.dataPath })));
}
