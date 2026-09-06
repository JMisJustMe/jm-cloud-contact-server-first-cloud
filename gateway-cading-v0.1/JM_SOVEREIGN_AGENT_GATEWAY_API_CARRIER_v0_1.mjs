import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, timingSafeEqual } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXPECTED_RUNTIME_SHA256 = '06caf0e5c785876bfb31a5a2eb571fba7a216152373f7d871937e5ca72a669a9';
const EXPECTED_SOURCE_SHA256 = '3f278782a375551a409562d1a701604c464138ad1e6c22546244e521d884d4df';
const SOURCE_AUTHORITY = 'Cading / JM Coding Estate';
const HOST_ROLE = 'CARRIER_NOT_SOURCE_AUTHORITY';

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function safeTokenMatch(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

function json(res, status, body) {
  const text = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
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

export async function createGatewayCarrier(options = {}) {
  const runtimePath = path.resolve(options.runtimePath || process.env.JM_CODING_ESTATE_RUNTIME || path.join(here, 'JM_CODING_ESTATE_REAL_BUILD_v1_0.mjs'));
  const sourcePath = path.resolve(options.sourcePath || process.env.JM_GATEWAY_CADING_SOURCE || path.join(here, 'JM_SOVEREIGN_AGENT_GATEWAY_v0_1.cading'));
  const gatewayToken = options.gatewayToken || process.env.JM_GATEWAY_TOKEN;
  if (!gatewayToken) throw new Error('JM_GATEWAY_TOKEN_REQUIRED');

  const [runtimeBytes, source] = await Promise.all([
    fs.readFile(runtimePath),
    fs.readFile(sourcePath, 'utf8'),
  ]);
  const runtimeSha256 = sha256(runtimeBytes);
  const sourceSha256 = sha256(source);
  if (runtimeSha256 !== EXPECTED_RUNTIME_SHA256) throw new Error(`JM_RUNTIME_HASH_MISMATCH:${runtimeSha256}`);
  if (sourceSha256 !== EXPECTED_SOURCE_SHA256) throw new Error(`JM_CADING_SOURCE_HASH_MISMATCH:${sourceSha256}`);

  const jm = await import(pathToFileURL(runtimePath).href);
  if (typeof jm.createEstate !== 'function') throw new Error('JM_RUNTIME_CREATE_ESTATE_MISSING');
  const estate = jm.createEstate();
  const body = estate.getBody('cading');
  const ir = body.compile(source);
  if (ir?.validation?.status && ir.validation.status !== 'PASS') {
    throw new Error(`JM_CADING_COMPILE_${ir.validation.status}`);
  }
  const runtime = body.createRuntime(ir, estate);
  estate.mountRuntime(body.id, runtime);

  const meta = {
    schema: 'jm.sovereign-agent-gateway.api-carrier/0.1',
    name: 'JM SOVEREIGN AGENT GATEWAY',
    version: '0.1.0',
    keeper: 'YOUR DOOR. MANY AGENTS. YOUR AUTHORITY.',
    sourceAuthority: SOURCE_AUTHORITY,
    hostRole: HOST_ROLE,
    runtimeExecutionClaimed: true,
    source: {
      language: 'Cading',
      sha256: sourceSha256,
      irKind: ir?.kind || null,
      irVersion: ir?.version || null,
      validation: ir?.validation?.status || 'PASS_RUNTIME_COMPILE',
      normalizedDigest: ir?.normalized?.digest || null,
    },
    runtime: {
      body: 'JM_CODING_ESTATE_REAL_BUILD_v1_0',
      sha256: runtimeSha256,
    },
    adapters: {
      jmHttpApi: 'ACTIVE_LOCAL_CARRIER',
      acp: 'NOT_YET_MOUNTED',
      externalAgents: 'NOT_YET_MOUNTED',
    },
    claimBoundary: 'HTTP_API_TO_CADING_RUNTIME_PROVABLE_HERE; ACP_AND_EXTERNAL_AGENT_EXECUTION_NOT_CLAIMED',
  };

  const invoke = (name, args = []) => runtime.invoke(name, args);
  const statusOf = (id) => invoke('taskStatus', [id]);

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://jm.local');
      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { status: 'UP', body: 'JM SOVEREIGN AGENT GATEWAY', hostRole: HOST_ROLE });
      }
      if (req.method === 'GET' && url.pathname === '/ready') {
        return json(res, 200, { status: 'READY', cading: 'PASS', runtime: 'PASS' });
      }

      const auth = String(req.headers.authorization || '');
      const supplied = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!safeTokenMatch(supplied, gatewayToken)) return json(res, 401, { error: 'UNAUTHORISED' });

      if (req.method === 'GET' && url.pathname === '/api/v1/meta') return json(res, 200, meta);
      if (req.method === 'GET' && url.pathname === '/api/v1/agents') {
        return json(res, 200, { agents: [], state: 'NO_EXTERNAL_AGENT_ADAPTER_MOUNTED' });
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/receipts/runtime') {
        return json(res, 200, runtime.receipt({ sourceAuthority: SOURCE_AUTHORITY, hostRole: HOST_ROLE }));
      }

      if (req.method === 'POST' && url.pathname === '/api/v1/tasks') {
        const bodyJson = await readJson(req);
        if (!bodyJson.prompt || !bodyJson.agent) return json(res, 400, { error: 'prompt_and_agent_required' });
        const id = invoke('createTask', [String(bodyJson.prompt), String(bodyJson.agent)]);
        return json(res, 201, { task: statusOf(id) });
      }

      const match = url.pathname.match(/^\/api\/v1\/tasks\/([^/]+)(?:\/(approve|dispatch))?$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        const action = match[2] || null;
        if (req.method === 'GET' && !action) {
          const task = statusOf(id);
          return task ? json(res, 200, { task }) : json(res, 404, { error: 'TASK_NOT_FOUND', id });
        }
        if (req.method === 'POST' && action === 'approve') {
          const result = invoke('approveTask', [id]);
          const task = statusOf(id);
          return task ? json(res, 200, { result, task }) : json(res, 404, { error: 'TASK_NOT_FOUND', id });
        }
        if (req.method === 'POST' && action === 'dispatch') {
          const result = invoke('dispatchTask', [id]);
          const task = statusOf(id);
          if (!task) return json(res, 404, { error: 'TASK_NOT_FOUND', id });
          const status = task.approved ? 200 : 409;
          return json(res, status, { result, task, authorityRequired: !task.approved });
        }
      }

      return json(res, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      return json(res, error?.message === 'REQUEST_TOO_LARGE' ? 413 : 500, {
        error: 'GATEWAY_CARRIER_ERROR',
        message: String(error?.message || error),
      });
    }
  });

  return { server, meta, runtime, ir, estate };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '127.0.0.1';
  const gateway = await createGatewayCarrier();
  gateway.server.listen(port, host, () => {
    console.log(JSON.stringify({ status: 'LISTENING', host, port, sourceAuthority: SOURCE_AUTHORITY, hostRole: HOST_ROLE }));
  });
}
