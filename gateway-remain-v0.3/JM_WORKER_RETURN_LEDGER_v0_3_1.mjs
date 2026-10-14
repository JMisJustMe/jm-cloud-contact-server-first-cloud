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
  const submit = ({taskId, workerId, evidence, approvedTask, expectedControl}) => {
    const op = tail.then(async () => {
      if (!approvedTask || approvedTask.id !== taskId || !approvedTask.approved ||
          approvedTask.status !== 'READY_FOR_AGENT_ROUTE') {
        return {status:'HOLD', reason:'TASK_NOT_APPROVED_AND_DISPATCHED'};
      }
      if (typeof taskId !== 'string' || taskId.length > 128 ||
          typeof workerId !== 'string' || !/^[a-z0-9._-]{1,96}$/i.test(workerId) ||
          !evidence || Array.isArray(evidence) || typeof evidence !== 'object' ||
          !['READ_ONLY_GATEWAY_CONTACT','JM_NATIVE_RUNTIME_CONFORMANCE','JM_SOURCE_PROPOSAL','JM_BOUNDED_AUTO_REPAIR'].includes(evidence.kind) ||
          Buffer.byteLength(JSON.stringify(evidence)) > 16384) {
        return {status:'HOLD', reason:'BOUNDED_EVIDENCE_REQUIRED'};
      }
      if (evidence.kind === 'JM_NATIVE_RUNTIME_CONFORMANCE' &&
          (evidence.sourceRepository !== 'JMisJustMe/JM-cading-lab' ||
           !/^[0-9a-f]{40}$/.test(evidence.sourceCommit || '') ||
           !/^[0-9a-f]{64}$/.test(evidence.externalReportSha256 || '') ||
           evidence.workerTests?.hostAdapterConformance !== true ||
           evidence.workerTests?.codingBodyPolicy !== true ||
           evidence.workerTests?.activationByteParity !== true ||
           evidence.workerTests?.negativeControlDetected !== true ||
           evidence.workerTests?.sourceRestored !== true ||
           evidence.workerTests?.coreByteParityQueries !== 4 ||
           evidence.codingIdentities !== 64 ||
           evidence.activeRoute !== 12 ||
           evidence.availableNotSelected !== 52)) {
        return {status:'HOLD',reason:'JM_NATIVE_WORKER_EVIDENCE_INVALID'};
      }
      if (evidence.kind === 'JM_SOURCE_PROPOSAL' &&
          (evidence.sourceRepository !== 'JMisJustMe/JM-cading-lab' ||
           !/^[0-9a-f]{40}$/.test(evidence.sourceCommit || '') ||
           !/^[0-9a-f]{40}$/.test(evidence.baseCommit || '') ||
           !/^[0-9a-f]{64}$/.test(evidence.sourceDiffSha256 || '') ||
           !/^[0-9a-f]{64}$/.test(evidence.externalReportSha256 || '') ||
           evidence.candidateBranch !== 'jm-host-adapter-machine-receipt-v0.1-20261014' ||
           evidence.workerTests?.machineReceiptRegression !== true ||
           evidence.workerTests?.legacyOutputPreserved !== true ||
           evidence.workerTests?.failClosedNegativeControl !== true ||
           evidence.workerTests?.sourceCheckoutClean !== true ||
           evidence.changedFilesCount !== 3 ||
           evidence.sourceWriteAuthority !== false)) {
        return {status:'HOLD',reason:'SOURCE_PROPOSAL_EVIDENCE_INVALID'};
      }
      if (evidence.kind === 'JM_BOUNDED_AUTO_REPAIR' &&
          (evidence.sourceRepository !== 'JMisJustMe/JM-cading-lab' ||
           evidence.sourceCommit !== '18cb13123020e0df7c05f6402f774a24ff8f4a8e' ||
           evidence.decision !== 'ATOMIC_RECEIPT_REPLACEMENT' ||
           !/^[0-9a-f]{64}$/.test(evidence.sourceDiffSha256 || '') ||
           !/^[0-9a-f]{64}$/.test(evidence.externalReportSha256 || '') ||
           evidence.changedFilesCount !== 1 ||
           evidence.workerTests?.baselineFaultObserved !== true ||
           evidence.workerTests?.workerSelectedAllowlistedRepair !== true ||
           evidence.workerTests?.candidateSourceActuallyModified !== true ||
           evidence.workerTests?.JMHostAdapterConformancePassed !== true ||
           evidence.workerTests?.JMExistingMachineReceiptRegressionPassed !== true ||
           evidence.workerTests?.failureBeforeAtomicCommitPreservedOldReceipt !== true ||
           evidence.workerTests?.noOrphanTempFiles !== true ||
           evidence.workerTests?.healthyAtomicCommitProducedValidReceipt !== true ||
           evidence.workerTests?.onlyAllowlistedFileChanged !== true ||
           evidence.publishedSource !== false ||
           evidence.sourceWriteAuthority !== false)) {
        return {status:'HOLD',reason:'BOUNDED_AUTO_REPAIR_WITNESS_INVALID'};
      }
      const evidenceSha256 = sha(canonical(evidence));
      const old = get(taskId);
      if (old) return old.workerId === workerId && old.evidenceSha256 === evidenceSha256
        ? {status:'IDEMPOTENT_REPLAY', receipt:old}
        : {status:'CONFLICT', reason:'RESULT_ALREADY_RECORDED', receipt:old};
      // Evidence is checked against live Cading and Magnifying Glass controls;
      // extra worker-provided details remain observations, not attestations.
      if (!expectedControl || evidence.taskId !== taskId ||
          evidence.taskStatus !== approvedTask.status ||
          evidence.remainRevision !== expectedControl.revision ||
          evidence.remainDigest !== expectedControl.digest ||
          evidence.destructiveAuthority !== false) {
        return {status:'HOLD', reason:'EVIDENCE_NOT_BOUND_TO_GATEWAY_STATE'};
      }
      const entry = {
        schema:SCHEMA, sequence:store.receipts.length+1,
        taskId, workerId, evidence, evidenceSha256,
        verifiedTaskStatus:approvedTask.status,
        verifiedApproval:true,
        event:'EXTERNAL_WORKER_RETURN_RECEIVED',
        claimBoundary:'TASK_AND_CONTROL_BOUND_TO_LIVE_GATEWAY; WORKER_REPORTED_TESTS_CONTENT_HASHED_NOT_INDEPENDENT_SIGNATURE_ATTESTED; ORIGINAL_TASK_NOT_COMPLETED',
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
