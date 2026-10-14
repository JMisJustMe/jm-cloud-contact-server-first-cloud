// JM Sovereign Agent Gateway v0.3.1 — bounded external worker return ledger.
// Child carrier, not a new Cading authority or an arbitrary command executor.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const SCHEMA = 'jm.sovereign-gateway.worker-return/0.3.1';
const stable = v => Array.isArray(v) ? v.map(stable) :
  v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const canonical = v => JSON.stringify(stable(v));
const sha = v => createHash('sha256').update(v).digest('hex');
const hashReceipt = r => sha(canonical(Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'hash'))));

function verify(store) {
  const errors = [];
  if (store?.schema !== SCHEMA || !Array.isArray(store?.receipts)) errors.push('SCHEMA');
  let previous = null;
  const seen = new Set();
  for (const [i, entry] of (store?.receipts || []).entries()) {
    if (entry.sequence !== i + 1) errors.push('SEQUENCE');
    if ((entry.previousHash ?? null) !== previous) errors.push('CHAIN');
    if (entry.hash !== hashReceipt(entry)) errors.push('HASH');
    if (seen.has(entry.taskId)) errors.push('DUPLICATE_TASK');
    seen.add(entry.taskId);
    previous = entry.hash;
  }
  if ((store?.headHash ?? null) !== previous) errors.push('HEAD');
  return {ok: errors.length === 0, errors, headHash: previous};
}

export async function createWorkerReturnLedger({dataPath}) {
  let store, startupRecovered = false;
  try {
    store = JSON.parse(await fs.readFile(dataPath, 'utf8'));
    const check = verify(store);
    if (!check.ok) throw new Error('WORKER_RETURN_LEDGER_INVALID:' + check.errors.join(','));
    startupRecovered = true;
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    store = {schema:SCHEMA, receipts:[], headHash:null};
  }
  let tail = Promise.resolve();
  const get = id => store.receipts.find(r => r.taskId === id) || null;
  const submit = ({taskId, workerId, evidence, approvedTask}) => {
    const op = tail.then(async () => {
      if (!approvedTask || approvedTask.id !== taskId || !approvedTask.approved ||
          approvedTask.status !== 'READY_FOR_AGENT_ROUTE') {
        return {status:'HOLD', reason:'TASK_NOT_APPROVED_AND_DISPATCHED'};
      }
      if (typeof taskId !== 'string' || taskId.length > 128 ||
          typeof workerId !== 'string' || !/^[a-z0-9._-]{1,96}$/i.test(workerId) ||
          !evidence || Array.isArray(evidence) || typeof evidence !== 'object' ||
          evidence.kind !== 'READ_ONLY_GATEWAY_CONTACT' ||
          Buffer.byteLength(JSON.stringify(evidence)) > 16384) {
        return {status:'HOLD', reason:'BOUNDED_EVIDENCE_REQUIRED'};
      }
      const evidenceSha256 = sha(canonical(evidence));
      const old = get(taskId);
      if (old) return old.workerId === workerId && old.evidenceSha256 === evidenceSha256
        ? {status:'IDEMPOTENT_REPLAY', receipt:old}
        : {status:'CONFLICT', reason:'RESULT_ALREADY_RECORDED', receipt:old};
      const entry = {
        schema:SCHEMA, sequence:store.receipts.length+1,
        taskId, workerId, evidence, evidenceSha256,
        verifiedTaskStatus:approvedTask.status,
        verifiedApproval:true,
        event:'EXTERNAL_WORKER_RETURN_RECEIVED',
        claimBoundary:'TASK_GATE_VERIFIED; WORKER_EVIDENCE_SUPPLIED; EXECUTION_NOT_INDEPENDENTLY_ATTESTED; ORIGINAL_TASK_NOT_COMPLETED',
        previousHash:store.headHash,
      };
      entry.hash = hashReceipt(entry);
      const next = {schema:SCHEMA, receipts:[...store.receipts,entry], headHash:entry.hash};
      await fs.mkdir(path.dirname(dataPath), {recursive:true});
      const temp = dataPath + '.tmp-' + process.pid;
      const h = await fs.open(temp,'w',0o600);
      try {await h.writeFile(JSON.stringify(next,null,2)+'\n'); await h.sync();}
      finally {await h.close();}
      await fs.rename(temp,dataPath);
      store = next;
      return {status:'RETURN_RECORDED',receipt:entry};
    });
    tail = op.catch(() => {});
    return op;
  };
  return {get, submit, verify:()=>verify(store), startupRecovered, count:()=>store.receipts.length};
}
