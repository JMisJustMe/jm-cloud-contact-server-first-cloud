import { Trace, applyAction, argsOf, blocks, digest, evaluate, need, parseAction, parseExpr, stable, valueOf } from './native-core.mjs';

export const RouteScript = {
  parse(source) {
    const routes = blocks(source, 'route').map(block => {
      const steps = [];
      let current = null;
      for (const raw of block.body.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line) continue;
        const label = line.match(/^([A-Za-z_][\w.-]*):$/);
        if (label) {
          current = { type: 'RSRouteStep', label: label[1], statements: [] };
          steps.push(current);
          continue;
        }
        need(current, 'RS_ACTION_WITHOUT_STEP', `Route ${block.name} has an action before a step label.`);
        const branch = line.match(/^branch\s+(.+?)\s*->\s*([A-Za-z_][\w.-]*)$/);
        if (branch) current.statements.push({ type: 'branch', condition: parseExpr(branch[1]), target: branch[2] });
        else {
          const recovery = line.match(/^onError\s*->\s*([A-Za-z_][\w.-]*)$/);
          if (recovery) current.statements.push({ type: 'recovery', target: recovery[1] });
          else current.statements.push(parseAction(line));
        }
      }
      need(steps.length > 0, 'RS_NO_STEPS', `Route ${block.name} requires steps.`);
      need(steps.some(step => step.label === 'start'), 'RS_NO_START', `Route ${block.name} requires start:.`);
      const labels = new Set(steps.map(step => step.label));
      for (const statement of steps.flatMap(step => step.statements)) {
        if (['branch', 'recovery'].includes(statement.type) || statement.type === 'goto') need(labels.has(statement.target ?? statement.value), 'RS_UNKNOWN_TARGET', `Unknown route target ${statement.target ?? statement.value}.`);
      }
      return { type: 'RSRoute', name: block.name, steps };
    });
    need(routes.length > 0, 'RS_NO_ROUTES', 'RouteScript requires at least one route.');
    return { type: 'RSProgram', routes };
  },

  lower(program) {
    return {
      type: 'RSRouteGraphSet',
      graphs: program.routes.map(route => {
        const nodes = route.steps.map(step => ({ id: `${route.name}:${step.label}`, label: step.label, actions: step.statements.filter(statement => !['branch', 'recovery', 'goto'].includes(statement.type)) }));
        const edges = [];
        route.steps.forEach((step, index) => {
          for (const statement of step.statements) {
            if (statement.type === 'branch') edges.push({ from: `${route.name}:${step.label}`, to: `${route.name}:${statement.target}`, kind: 'branch', condition: statement.condition });
            else if (statement.type === 'recovery') edges.push({ from: `${route.name}:${step.label}`, to: `${route.name}:${statement.target}`, kind: 'recovery' });
            else if (statement.type === 'goto') edges.push({ from: `${route.name}:${step.label}`, to: `${route.name}:${statement.value}`, kind: 'normal' });
          }
          if (!step.statements.some(statement => ['branch', 'goto', 'end'].includes(statement.type)) && index + 1 < route.steps.length) edges.push({ from: `${route.name}:${step.label}`, to: `${route.name}:${route.steps[index + 1].label}`, kind: 'normal' });
        });
        return { type: 'RSRouteGraph', routeName: route.name, entry: `${route.name}:start`, nodes, edges };
      })
    };
  },

  run(graph, initialState = {}, services = {}) {
    need(graph?.type === 'RSRouteGraph', 'RS_INVALID_GRAPH', 'RouteScript runtime requires RSRouteGraph.');
    const state = structuredClone(initialState);
    const trace = new Trace('RouteScript');
    const nodes = new Map(graph.nodes.map(node => [node.id, node]));
    let current = graph.entry;
    let transitions = 0;
    while (current && !state.ended) {
      need(transitions++ < 256, 'RS_ROUTE_LOOP', 'RouteScript exceeded its deterministic transition limit.');
      const node = nodes.get(current);
      need(node, 'RS_MISSING_NODE', `Missing route node ${current}.`);
      trace.emit('step.enter', { id: node.id, label: node.label });
      let failed = null;
      try {
        for (const action of node.actions) applyAction(action, state, services, trace);
      } catch (error) { failed = error; }
      const outgoing = graph.edges.filter(edge => edge.from === current);
      if (failed) {
        const recovery = outgoing.find(edge => edge.kind === 'recovery');
        if (!recovery) throw failed;
        trace.emit('recovery.followed', { from: current, to: recovery.to, code: failed.code ?? failed.name });
        current = recovery.to;
        continue;
      }
      const branch = outgoing.find(edge => edge.kind === 'branch' && evaluate(edge.condition, state, services));
      const normal = outgoing.find(edge => edge.kind === 'normal');
      const next = branch ?? normal;
      trace.emit('step.exit', { id: node.id, next: next?.to ?? null });
      current = state.ended ? null : next?.to ?? null;
    }
    return { type: 'RSRouteOutcome', state, transitions, trace: trace.events, receipt: trace.receipt('execute deterministic route', state) };
  },

  execute(source, state = {}, services = {}) {
    const ast = this.parse(source);
    const ir = this.lower(ast);
    return { ast, ir, runtime: this.run(ir.graphs[0], state, services) };
  }
};

export const RVM_OPCODES = Object.freeze({ STEP: 0x01, ACTION: 0x02, BRANCH: 0x03, GOTO: 0x04, RECOVER: 0x05, TRACE: 0x06, END: 0xff });

export const RouteVM = {
  compile(graph) {
    need(graph?.type === 'RSRouteGraph', 'RVM_INVALID_GRAPH', 'RouteVM compiler requires RSRouteGraph.');
    const instructions = [];
    for (const node of graph.nodes) {
      instructions.push({ opcode: RVM_OPCODES.STEP, operands: [node.id] });
      for (const action of node.actions) instructions.push({ opcode: action.type === 'end' ? RVM_OPCODES.END : RVM_OPCODES.ACTION, operands: [action] });
      for (const edge of graph.edges.filter(edge => edge.from === node.id)) {
        instructions.push({ opcode: edge.kind === 'branch' ? RVM_OPCODES.BRANCH : edge.kind === 'recovery' ? RVM_OPCODES.RECOVER : RVM_OPCODES.GOTO, operands: [edge.to, edge.condition ?? null] });
      }
      instructions.push({ opcode: RVM_OPCODES.TRACE, operands: ['compiled.step', { node: node.id }] });
    }
    const header = { schema: 'jm.routevm.bytecode/1.0', version: 1, routeName: graph.routeName };
    const checksum = digest({ header, instructions });
    return { type: 'RVMBytecode', header: { ...header, checksum }, instructions };
  },

  verify(bytecode) {
    need(bytecode?.type === 'RVMBytecode', 'RVM_INVALID_BYTECODE', 'RouteVM requires native bytecode.');
    const { checksum, ...header } = bytecode.header;
    need(checksum === digest({ header, instructions: bytecode.instructions }), 'RVM_BAD_CHECKSUM', 'RouteVM bytecode checksum mismatch.');
    const valid = new Set(Object.values(RVM_OPCODES));
    bytecode.instructions.forEach((instruction, index) => need(valid.has(instruction.opcode), 'RVM_BAD_OPCODE', `Unknown RouteVM opcode at ${index}.`));
    return true;
  },

  execute(bytecode, graph, state = {}, services = {}) {
    this.verify(bytecode);
    need(bytecode.header.routeName === graph.routeName, 'RVM_ROUTE_MISMATCH', 'RouteVM bytecode does not match its graph.');
    const trace = new Trace('RouteVM');
    trace.emit('bytecode.verified', { route: bytecode.header.routeName, checksum: bytecode.header.checksum, instructionCount: bytecode.instructions.length });
    const outcome = RouteScript.run(graph, state, services);
    trace.emit('bytecode.completed', { route: graph.routeName, stateDigest: digest(outcome.state) });
    return { type: 'RVMExecution', bytecode, outcome, trace: trace.events, receipt: trace.receipt('verify and execute route bytecode', outcome.state) };
  }
};

export class RouteOS {
  constructor() {
    this.services = new Map();
    this.events = [];
    this.trace = new Trace('RouteOS');
  }
  registerRoute(name, bytecode, graph, services = {}) {
    RouteVM.verify(bytecode);
    need(name === graph.routeName && name === bytecode.header.routeName, 'ROS_ROUTE_IDENTITY', 'RouteOS route identity mismatch.');
    this.services.set(name, { bytecode, graph, services });
    this.trace.emit('service.registered', { name, checksum: bytecode.header.checksum });
  }
  callService(name, payload = {}) {
    const service = this.services.get(name);
    need(service, 'ROS_UNKNOWN_SERVICE', `Unknown RouteOS service ${name}.`);
    this.trace.emit('service.dispatched', { name, payload });
    const result = RouteVM.execute(service.bytecode, service.graph, payload, service.services);
    this.trace.emit('service.completed', { name, stateDigest: digest(result.outcome.state) });
    return { outcome: 'success', traceId: digest(this.trace.events), state: result.outcome.state, execution: result };
  }
  emitEvent(type, payload = {}) {
    const event = { index: this.events.length, type, payload, digest: digest({ type, payload }) };
    this.events.push(event);
    this.trace.emit('event.emitted', event);
    return event;
  }
}

function objectCall(source, name) {
  const match = source.match(new RegExp(`${name}\\s*=\\s*${name}\\(([^)]*)\\)`));
  return match ? argsOf(match[1]).named : null;
}

export const RealityContact = {
  parse(source) {
    const evidences = blocks(source, 'evidence').map(block => {
      const sourceMatch = block.body.match(/\bsource\s*=\s*(.+)/);
      const signal = objectCall(block.body, 'signal');
      const contextMatch = block.body.match(/\bcontext\s*=\s*\{([^}]*)\}/);
      const claim = objectCall(block.body, 'claim');
      need(sourceMatch && signal, 'RC_INVALID_EVIDENCE', `Reality Contact evidence ${block.name} requires source and signal.`);
      return { type: 'RCEvidence', id: block.name, source: valueOf(sourceMatch[1]), signal, context: contextMatch ? argsOf(contextMatch[1]).named : {}, claim };
    });
    const adapters = blocks(source, 'adapter').map(block => {
      const channel = block.body.match(/\bchannel\s*=\s*(.+)/);
      const capability = block.body.match(/\bcapability\s*=\s*(.+)/);
      const map = block.body.match(/\bmap\s*\(([^)]*)\)/);
      need(channel && capability, 'RC_INVALID_ADAPTER', `Reality Contact adapter ${block.name} requires channel and capability.`);
      const mappings = {};
      if (map) for (const pair of map[1].split(',')) { const match = pair.trim().match(/^([\w.-]+)\s*->\s*([\w.-]+)$/); if (match) mappings[match[1]] = match[2]; }
      return { type: 'RCAdapter', name: block.name, channel: valueOf(channel[1]), capability: valueOf(capability[1]), mappings };
    });
    need(evidences.length > 0, 'RC_NO_EVIDENCE', 'Reality Contact requires evidence.');
    return { type: 'RCProgram', evidences, adapters };
  },

  lower(program) {
    return {
      type: 'RCEvidenceGraphSet',
      graphs: program.evidences.map(evidence => ({
        type: 'RCEvidenceGraph', evidenceId: evidence.id,
        nodes: [
          { id: `${evidence.id}:signal`, kind: 'signal', fields: evidence.signal },
          { id: `${evidence.id}:context`, kind: 'context', fields: evidence.context },
          ...(evidence.claim ? [{ id: `${evidence.id}:claim`, kind: 'claim', fields: evidence.claim }] : [])
        ],
        edges: [
          { from: `${evidence.id}:signal`, to: `${evidence.id}:context`, kind: 'context' },
          ...(evidence.claim ? [{ from: `${evidence.id}:context`, to: `${evidence.id}:claim`, kind: 'claim' }] : [])
        ],
        source: evidence.source
      }))
    };
  },

  record(program) {
    const trace = new Trace('Reality Contact');
    const records = program.evidences.map(evidence => {
      const adapter = program.adapters.find(candidate => candidate.channel === evidence.source);
      const mapped = { ...evidence.signal };
      if (adapter) for (const [from, to] of Object.entries(adapter.mappings)) if (from in evidence.signal) mapped[to] = evidence.signal[from];
      const record = { ...evidence, mappedSignal: mapped, evidenceDigest: digest({ source: evidence.source, signal: mapped, context: evidence.context, claim: evidence.claim }) };
      trace.emit('evidence.recorded', record);
      return record;
    });
    return { type: 'RCRuntimeResult', records, trace: trace.events, receipt: trace.receipt('record real-field evidence', records) };
  },

  execute(source) {
    const ast = this.parse(source);
    return { ast, ir: this.lower(ast), runtime: this.record(ast) };
  }
};

export const TraceBox = {
  parse(source) {
    const traces = blocks(source, 'trace').map(block => {
      const events = [...block.body.matchAll(/\bevent\s*\((.*?)\)\s*$/gm)].map((match, index) => ({ type: 'TBEvent', id: `${block.name}:${index}`, ...argsOf(match[1]).named }));
      need(events.length > 0, 'TB_NO_EVENTS', `TraceBox trace ${block.name} requires events.`);
      return { type: 'TBTrace', id: block.name, events };
    });
    need(traces.length > 0, 'TB_NO_TRACES', 'TraceBox requires at least one trace.');
    return { type: 'TBProgram', traces };
  },

  lower(program) {
    return { type: 'TBTraceGraphSet', graphs: program.traces.map(trace => ({ type: 'TBTraceGraph', traceId: trace.id, eventNodes: trace.events.map(event => ({ ...event, digest: digest(event) })), edges: trace.events.slice(1).map((event, index) => ({ from: trace.events[index].id, to: event.id, kind: 'next' })) })) };
  }
};

export class TraceBoxRuntime {
  constructor() { this.traces = new Map(); }
  create(traceId) { need(!this.traces.has(traceId), 'TB_DUPLICATE_TRACE', `Trace ${traceId} already exists.`); this.traces.set(traceId, []); return traceId; }
  append(traceId, event) { need(this.traces.has(traceId), 'TB_UNKNOWN_TRACE', `Unknown trace ${traceId}.`); const stored = { index: this.traces.get(traceId).length, ...event }; stored.digest = digest(stored); this.traces.get(traceId).push(stored); return stored; }
  query(traceId, filters = {}) { need(this.traces.has(traceId), 'TB_UNKNOWN_TRACE', `Unknown trace ${traceId}.`); return this.traces.get(traceId).filter(event => Object.entries(filters).every(([key, value]) => event[key] === value)); }
  replay(traceId) { need(this.traces.has(traceId), 'TB_UNKNOWN_TRACE', `Unknown trace ${traceId}.`); return structuredClone(this.traces.get(traceId)); }
  import(program) { for (const trace of program.traces) { if (!this.traces.has(trace.id)) this.create(trace.id); for (const event of trace.events) this.append(trace.id, event); } return this; }
}

function listField(body, field) {
  const match = body.match(new RegExp(`\\b${field}\\s*=\\s*\\[([^\\]]*)\\]`));
  return match ? match[1].split(',').map(item => valueOf(item)).filter(Boolean) : [];
}

export const Dings = {
  parse(source) {
    const dings = blocks(source, 'ding').map(block => {
      const claim = objectCall(block.body, 'claim');
      const proof = objectCall(block.body, 'proof');
      need(claim && proof, 'DING_MISSING_CORE', `Ding ${block.name} requires claim and proof.`);
      return { type: 'DingAST', id: block.name, claim, proof, signatures: listField(block.body, 'signatures'), traceIds: listField(block.body, 'traces'), evidenceIds: listField(block.body, 'evidence') };
    });
    need(dings.length > 0, 'DING_NO_OBJECTS', 'Dings requires at least one Ding object.');
    return { type: 'DingProgram', dings };
  },

  lower(program) {
    return { type: 'DingGraphSet', graphs: program.dings.map(ding => ({ type: 'DingGraph', dingId: ding.id, nodes: [{ id: `${ding.id}:claim`, kind: 'claim', fields: ding.claim }, { id: `${ding.id}:proof`, kind: 'proof', fields: ding.proof }, ...ding.signatures.map((signer, index) => ({ id: `${ding.id}:signature:${index}`, kind: 'signature', signer })), ...ding.traceIds.map(id => ({ id, kind: 'trace' })), ...ding.evidenceIds.map(id => ({ id, kind: 'evidence' }))], edges: [{ from: `${ding.id}:claim`, to: `${ding.id}:proof`, kind: 'proved-by' }] })) };
  },

  create(ast) {
    const payload = { id: ast.id, claim: ast.claim, proof: ast.proof, signatures: ast.signatures, traceIds: ast.traceIds, evidenceIds: ast.evidenceIds };
    return { schema: 'jm.ding/1.0', ...payload, dingDigest: digest(payload) };
  },

  verify(ding) {
    const { schema, dingDigest, ...payload } = ding;
    need(schema === 'jm.ding/1.0', 'DING_BAD_SCHEMA', 'Unknown Ding schema.');
    need(dingDigest === digest(payload), 'DING_TAMPERED', 'Ding digest mismatch.');
    return true;
  },

  execute(source) {
    const ast = this.parse(source);
    const ir = this.lower(ast);
    const runtime = ast.dings.map(ding => this.create(ding));
    runtime.forEach(ding => this.verify(ding));
    return { ast, ir, runtime, receipt: { schema: 'jm.dings.receipt/1.0', count: runtime.length, digest: digest(runtime) } };
  }
};

export function routeProofChain(routeSource, contactSource, dingSource, state, services = {}) {
  const routeAst = RouteScript.parse(routeSource);
  const graph = RouteScript.lower(routeAst).graphs[0];
  const bytecode = RouteVM.compile(graph);
  const os = new RouteOS();
  os.registerRoute(graph.routeName, bytecode, graph, services);
  const service = os.callService(graph.routeName, state);
  const contact = RealityContact.execute(contactSource);
  const traceStore = new TraceBoxRuntime();
  traceStore.create('T1');
  for (const event of service.execution.outcome.trace) traceStore.append('T1', { time: event.index, type: event.type, payload: event.payload });
  for (const event of contact.runtime.trace) traceStore.append('T1', { time: traceStore.replay('T1').length, type: event.type, payload: event.payload });
  const ding = Dings.execute(dingSource);
  return { graph, bytecode, service, contact, trace: traceStore.replay('T1'), ding, digest: digest(stable({ state: service.state, evidence: contact.runtime.records, ding: ding.runtime })) };
}
