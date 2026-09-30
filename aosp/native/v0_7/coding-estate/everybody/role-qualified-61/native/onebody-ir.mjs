/* OneBody IR — authorised forward descendant. Historical exact schema remains open. */
import { PORTABLE_SCHEMA, executePortable, fnv1a } from '../../compiler-core.mjs';

export const ONEBODY_IR_BRIDGE = Object.freeze({
  status: 'AUTHORISED_FORWARD_NATIVE_BRIDGE',
  historicalRecoveryClaim: false,
  law: 'Body Meaning -> Neutral Body Structure -> Target Output',
  backendDonor: 'coding-estate/everybody/compiler-core.mjs'
});

export class OneBodyIRError extends Error {
  constructor(code, message) { super(message); this.name = 'OneBodyIRError'; this.code = code; }
}
function need(ok, code, message) { if (!ok) throw new OneBodyIRError(code, message); }
const OPS = new Set(['SET','ADD','SUB','MUL','DIV','COPY','CONCAT','ROUTE','TRACE','ASSERT','DING']);

export function createOneBodyIR(spec = {}) {
  need(/^[a-z0-9][a-z0-9.-]*$/.test(spec.bodyId ?? ''), 'OBIR_BAD_BODY_ID', 'Stable lowercase bodyId required.');
  need(spec.bodyName, 'OBIR_BODY_NAME_REQUIRED', 'bodyName required.');
  need(spec.sourceAuthority, 'OBIR_SOURCE_AUTHORITY_REQUIRED', 'sourceAuthority required.');
  const ir = {
    schema: 'jm.onebody-ir/1.0',
    body: { id: spec.bodyId, name: spec.bodyName, sourceAuthority: spec.sourceAuthority },
    nodes: structuredClone(spec.nodes ?? []),
    links: structuredClone(spec.links ?? []),
    operations: (spec.operations ?? []).map((op, index) => ({ index, ...structuredClone(op), op: String(op.op ?? '').toUpperCase() })),
    contracts: { identityPreserved: true, sourceAuthorityPreserved: true, targetAuthority: false, lossy: false, traceRequired: true, dingRequired: true },
    bridge: ONEBODY_IR_BRIDGE
  };
  ir.hash = fnv1a(ir);
  return ir;
}

export function verifyOneBodyIR(ir) {
  need(ir?.schema === 'jm.onebody-ir/1.0', 'OBIR_BAD_SCHEMA', 'Expected jm.onebody-ir/1.0.');
  const ids = new Set();
  for (const node of ir.nodes) { need(node.id && !ids.has(node.id), 'OBIR_DUPLICATE_NODE', `Invalid/duplicate node ${node.id}.`); ids.add(node.id); }
  for (const link of ir.links) need(ids.has(link.from) && ids.has(link.to), 'OBIR_DANGLING_LINK', `Dangling link ${link.from} -> ${link.to}.`);
  const known = new Set(); let dings = 0;
  for (const op of ir.operations) {
    need(OPS.has(op.op), 'OBIR_BAD_OPCODE', `Unsupported operation ${op.op}.`);
    if (op.op === 'SET') known.add(op.name);
    if (['ADD','SUB','MUL','DIV','CONCAT','ASSERT'].includes(op.op)) need(known.has(op.name), 'OBIR_STATE_BEFORE_SET', `${op.name} must be SET before ${op.op}.`);
    if (op.op === 'COPY') { need(known.has(op.sourceName), 'OBIR_COPY_SOURCE_MISSING', `Missing COPY source ${op.sourceName}.`); known.add(op.name); }
    if (op.op === 'DING') dings += 1;
  }
  need(dings > 0, 'OBIR_DING_REQUIRED', 'At least one DING is required.');
  return { ok: true, nodes: ir.nodes.length, links: ir.links.length, operations: ir.operations.length, dings, hash: ir.hash };
}

export function lowerOneBodyToPortable(ir) {
  verifyOneBodyIR(ir);
  const portable = {
    schema: PORTABLE_SCHEMA,
    body: { id: ir.body.id, name: ir.body.name, kind: 'onebody_ir_descendant', status: ONEBODY_IR_BRIDGE.status, law: ONEBODY_IR_BRIDGE.law, nativeParserRecovered: false },
    sourceVersion: 'onebody-ir-1.0',
    operations: ir.operations.map((op, index) => ({ ...structuredClone(op), index })),
    contracts: { identityPreserved: true, sourceAuthority: ir.body.sourceAuthority, targetAuthority: false, lossy: false, traceRequired: true, dingRequired: true }
  };
  portable.hash = fnv1a(portable);
  return portable;
}

export function executeOneBodyIR(ir) {
  const portable = lowerOneBodyToPortable(ir);
  return { type: 'OneBodyIRExecution', ir, portable, receipt: executePortable(portable), bridge: ONEBODY_IR_BRIDGE };
}
