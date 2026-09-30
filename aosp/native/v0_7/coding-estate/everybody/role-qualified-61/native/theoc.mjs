/* TheoC Contract + TheoC IR — authorised forward descendant. Historical exact source remains open. */
import { emitCppHeader, emitJavaScriptModule } from '../../compiler-core.mjs';
import { ONEBODY_IR_BRIDGE, createOneBodyIR, lowerOneBodyToPortable, verifyOneBodyIR } from './onebody-ir.mjs';

export const THEOC_BRIDGE = Object.freeze({
  status: 'AUTHORISED_FORWARD_NATIVE_BRIDGE',
  historicalRecoveryClaim: false,
  law: 'Contracts and IR preserve JM permission and meaning before host compilation.',
  irDonor: 'IR / OneBody IR',
  backendDonor: 'coding-estate/everybody/compiler-core.mjs'
});

export class TheoCError extends Error {
  constructor(code, message) { super(message); this.name = 'TheoCError'; this.code = code; }
}
function need(ok, code, message) { if (!ok) throw new TheoCError(code, message); }

export function parseTheoC(source) {
  need(typeof source === 'string' && source.trim(), 'THEOC_EMPTY_SOURCE', 'TheoC source is empty.');
  const match = source.match(/\btheoc\s+([A-Za-z_][\w.-]*)\s*\{([\s\S]*)\}\s*$/);
  need(match, 'THEOC_CONTRACT_REQUIRED', 'TheoC requires theoc NAME { ... }.');
  let sourceBody = null;
  const requirements = new Set();
  const targets = [];
  const unknown = [];
  for (const raw of match[2].replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/\s*(?:#|\/\/).*$/, '').trim();
    if (!line) continue;
    let m = line.match(/^source\s+([a-z0-9][a-z0-9.-]*)$/);
    if (m) { sourceBody = m[1]; continue; }
    m = line.match(/^require\s+(identity|source-authority|trace|ding|lossless)$/);
    if (m) { requirements.add(m[1]); continue; }
    m = line.match(/^target\s+(javascript|cpp)$/);
    if (m) { targets.push(m[1]); continue; }
    unknown.push(line);
  }
  need(unknown.length === 0, 'THEOC_UNKNOWN_DECLARATION', 'TheoC contains unknown declarations.');
  need(sourceBody, 'THEOC_SOURCE_REQUIRED', 'TheoC contract requires source BODY.');
  need(targets.length > 0, 'THEOC_TARGET_REQUIRED', 'TheoC requires at least one target.');
  need(new Set(targets).size === targets.length, 'THEOC_DUPLICATE_TARGET', 'TheoC targets must be unique.');
  return { type: 'TheoCContract', name: match[1], sourceBody, requirements: [...requirements], targets, bridge: THEOC_BRIDGE };
}

export function lowerTheoC(contract, oneBodySpec) {
  need(contract?.type === 'TheoCContract', 'THEOC_BAD_CONTRACT', 'TheoC lowering requires TheoCContract.');
  need(oneBodySpec?.sourceAuthority === contract.sourceBody, 'THEOC_SOURCE_MISMATCH', `TheoC source ${contract.sourceBody} does not match OneBody source authority ${oneBodySpec?.sourceAuthority}.`);
  const oneBodyIR = createOneBodyIR(oneBodySpec);
  const oneBodyProof = verifyOneBodyIR(oneBodyIR);
  const ir = {
    type: 'TheoCIR',
    schema: 'jm.theoc.ir/1.0',
    contractName: contract.name,
    sourceBody: contract.sourceBody,
    requirements: contract.requirements,
    targets: contract.targets,
    oneBodyIR,
    oneBodyHash: oneBodyProof.hash,
    bridge: THEOC_BRIDGE,
    contracts: {
      identity: oneBodyIR.contracts.identityPreserved,
      sourceAuthority: oneBodyIR.contracts.sourceAuthorityPreserved,
      trace: oneBodyIR.contracts.traceRequired,
      ding: oneBodyIR.contracts.dingRequired,
      lossless: !oneBodyIR.contracts.lossy
    }
  };
  return ir;
}

export function verifyTheoCIR(ir, target = null) {
  need(ir?.type === 'TheoCIR', 'THEOC_BAD_IR', 'Expected TheoCIR.');
  verifyOneBodyIR(ir.oneBodyIR);
  for (const requirement of ir.requirements) need(ir.contracts[requirement === 'source-authority' ? 'sourceAuthority' : requirement] === true, 'THEOC_CONTRACT_FAILED', `TheoC requirement failed: ${requirement}.`);
  if (target) need(ir.targets.includes(target), 'THEOC_TARGET_NOT_ALLOWED', `TheoC target ${target} is not authorised by the contract.`);
  return { ok: true, sourceBody: ir.sourceBody, targets: ir.targets, oneBodyHash: ir.oneBodyHash };
}

export function compileTheoC(source, oneBodySpec, target) {
  const contract = parseTheoC(source);
  const ir = lowerTheoC(contract, oneBodySpec);
  verifyTheoCIR(ir, target);
  const portable = lowerOneBodyToPortable(ir.oneBodyIR);
  const output = target === 'javascript' ? emitJavaScriptModule(portable) : emitCppHeader(portable);
  return { type: 'TheoCCompilation', contract, ir, portable, target, output, bridge: THEOC_BRIDGE, oneBodyBridge: ONEBODY_IR_BRIDGE };
}
