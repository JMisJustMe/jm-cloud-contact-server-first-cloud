/*
 * JM SOVEREIGN AGENT GATEWAY — Cading-derived JavaScript carrier v0.2
 * SOURCE AUTHORITY: JM_SOVEREIGN_AGENT_GATEWAY_v0_2.cading
 * HOST ROLE: CARRIER_NOT_SOURCE_AUTHORITY
 * This is a bounded deployment carrier, not a general Cading compiler/emitter.
 */
export const SOURCE_SHA256 = '2a1a6e82f615599c9c79f8c5d21a0978cfbf977f566957de1f8324e276ac7479';
export const SOURCE_AUTHORITY = 'Cading / JM Coding Estate';
export const HOST_ROLE = 'CARRIER_NOT_SOURCE_AUTHORITY';
export const COMPILE_PROOF = Object.freeze({
  validation: 'PASS',
  irKind: 'cading-ir',
  irVersion: '10.0-jm',
  normalizedDigest: 'jm-b38b1862',
  fullRuntimeSha256: '06caf0e5c785876bfb31a5a2eb571fba7a216152373f7d871937e5ca72a669a9',
  parityScope: 'gateway-v0.2-state-authority-routes',
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export class JMSovereignAgentGatewayCarrierRuntime {
  constructor() {
    this.keeper = 'YOUR DOOR. MANY AGENTS. YOUR AUTHORITY.';
    this.authorityMode = 'HUMAN_FINAL';
    this.contractVersion = '0.2';
    this.nextTaskId = 1;
    this.tasks = {};
    this.trace = [];
    this.outputs = [];
    this.held = false;
  }
  record(event, data = {}, outcome = 'TRACE') {
    this.trace.push({ index: this.trace.length + 1, event, data: clone(data), outcome });
  }
  ding(name, data = {}) { this.record(name, data, 'DING'); }
  hold(name, data = {}) { this.held = true; this.record(name, data, 'HOLD'); return null; }
  clearHold() { this.held = false; }
  createTask(prompt, agent) {
    this.clearHold();
    const id = `task-${this.nextTaskId}`;
    const task = { id, prompt, agent, status: 'AWAITING_APPROVAL', approved: false, dispatched: false };
    this.tasks[id] = task;
    this.nextTaskId += 1;
    this.record('TASK_CREATED', { task: id, agent });
    this.ding('TASK_CREATED');
    return id;
  }
  approveTask(id) {
    this.clearHold();
    const task = this.tasks[id] ?? null;
    if (task == null) return this.hold('APPROVAL_HOLD_NO_TASK', { task: id });
    task.approved = true;
    task.status = 'APPROVED';
    this.record('AUTHORITY_APPROVED', { task: id, authority: this.authorityMode });
    this.ding('AUTHORITY_APPROVED');
    return true;
  }
  dispatchTask(id) {
    this.clearHold();
    const task = this.tasks[id] ?? null;
    if (task == null) return this.hold('DISPATCH_HOLD_NO_TASK', { task: id });
    if (task.approved === false) return this.hold('DISPATCH_HOLD_AUTHORITY_REQUIRED', { task: id });
    task.dispatched = true;
    task.status = 'READY_FOR_AGENT_ROUTE';
    this.record('DISPATCH_AUTHORISED', { task: id, agent: task.agent });
    this.ding('DISPATCH_AUTHORISED');
    return task.status;
  }
  taskStatus(id) { return this.tasks[id] ? clone(this.tasks[id]) : null; }
  listTasks() { return clone(this.tasks); }
  exportState() {
    return clone({ contractVersion: this.contractVersion, keeper: this.keeper, authorityMode: this.authorityMode, nextTaskId: this.nextTaskId, tasks: this.tasks });
  }
  importState(state) {
    this.clearHold();
    if (state?.authorityMode !== this.authorityMode) return this.hold('STATE_IMPORT_HOLD_AUTHORITY_MISMATCH', { expected: this.authorityMode, observed: state?.authorityMode ?? null });
    if (state?.contractVersion !== this.contractVersion) return this.hold('STATE_IMPORT_HOLD_VERSION_MISMATCH', { expected: this.contractVersion, observed: state?.contractVersion ?? null });
    this.nextTaskId = Number(state.nextTaskId || 1);
    this.tasks = clone(state.tasks || {});
    this.record('STATE_IMPORTED', { authority: this.authorityMode, contract: this.contractVersion });
    this.ding('STATE_IMPORTED');
    return true;
  }
  invoke(name, args = []) {
    if (typeof this[name] !== 'function' || name === 'invoke') throw new Error(`Unknown gateway carrier function ${name}`);
    return this[name](...args);
  }
  receipt(extra = {}) {
    return { schema: 'jm.sovereign-agent-gateway.js-carrier-receipt/0.2', sourceAuthority: SOURCE_AUTHORITY, sourceSha256: SOURCE_SHA256, hostRole: HOST_ROLE, compileProof: COMPILE_PROOF, held: this.held, trace: clone(this.trace), ...clone(extra) };
  }
}

export function createGatewayRuntime() { return new JMSovereignAgentGatewayCarrierRuntime(); }
