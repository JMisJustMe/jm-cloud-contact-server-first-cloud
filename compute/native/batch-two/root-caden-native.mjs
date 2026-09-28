import { Trace, applyAction, blocks, digest, evaluate, getPath, lines, need, parseAction, parseExpr, setPath, stable, valueOf } from './native-core.mjs';
import { Kading } from './language-shape-native.mjs';

export const RootMethod = {
  parse(source) {
    const roots = blocks(source, 'root').map(block => {
      const premises = [];
      const branches = [];
      const methods = blocks(block.body, 'method').map(method => {
        const actions = lines(method.body).map(line => {
          const match = line.match(/^do\s+(.+)$/);
          need(match, 'ROOT_BAD_METHOD_ACTION', `Root Method ${method.name} requires do actions.`);
          return parseAction(match[1]);
        });
        need(actions.length, 'ROOT_EMPTY_METHOD', `Root Method ${method.name} is empty.`);
        return { type: 'RootMethodNode', name: method.name, actions };
      });
      let yielded = null;
      const bodyWithoutMethods = blocks(block.body, 'method').reduce((text, method) => text.replace(text.slice(method.start, method.end), ''), block.body);
      for (const line of lines(bodyWithoutMethods)) {
        const premise = line.match(/^premise\s+(.+)$/); if (premise) { premises.push(parseExpr(premise[1])); continue; }
        const branch = line.match(/^branch\s+([A-Za-z_][\w.-]*)(?:\s+when\s+(.+?))?\s*->\s*([A-Za-z_][\w.-]*)$/);
        if (branch) { branches.push({ type: 'RootBranch', name: branch[1], condition: branch[2] ? parseExpr(branch[2]) : null, method: branch[3] }); continue; }
        const result = line.match(/^yield\s+([A-Za-z_][\w.]*)$/); if (result) yielded = result[1];
      }
      need(premises.length && branches.length && methods.length && yielded, 'ROOT_INCOMPLETE', `Root ${block.name} requires premise, branch, method and yield.`);
      const methodNames = new Set(methods.map(method => method.name));
      branches.forEach(branch => need(methodNames.has(branch.method), 'ROOT_UNKNOWN_METHOD', `Branch ${branch.name} targets unknown method ${branch.method}.`));
      return { type: 'RootDefinition', name: block.name, premises, branches, methods, yieldPath: yielded };
    });
    need(roots.length > 0, 'ROOT_NO_DEFINITIONS', 'Root Method requires at least one root.');
    return { type: 'RootMethodProgram', roots };
  },
  lower(program) {
    return {
      type: 'RootMethodForest',
      trees: program.roots.map(root => ({
        type: 'RootedMethodTree', name: root.name,
        rootNode: { id: `${root.name}:root`, premises: root.premises },
        branchNodes: root.branches.map(branch => ({ id: `${root.name}:branch:${branch.name}`, ...branch })),
        methodNodes: root.methods.map(method => ({ id: `${root.name}:method:${method.name}`, ...method })),
        edges: [
          ...root.branches.map(branch => ({ from: `${root.name}:root`, to: `${root.name}:branch:${branch.name}`, kind: 'branch' })),
          ...root.branches.map(branch => ({ from: `${root.name}:branch:${branch.name}`, to: `${root.name}:method:${branch.method}`, kind: 'method' }))
        ],
        yieldPath: root.yieldPath
      }))
    };
  },
  invoke(program, rootName, input = {}, services = {}) {
    const root = program.roots.find(item => item.name === rootName);
    need(root, 'ROOT_UNKNOWN_DEFINITION', `Unknown Root Method ${rootName}.`);
    const state = structuredClone(input);
    const trace = new Trace('Root Method');
    for (const premise of root.premises) {
      const passed = evaluate(premise, state, services);
      trace.emit('premise.checked', { root: root.name, passed, premise });
      need(passed, 'ROOT_PREMISE_FAILED', `Premise failed for ${root.name}.`);
    }
    const branch = root.branches.find(item => !item.condition || evaluate(item.condition, state, services));
    need(branch, 'ROOT_NO_BRANCH', `No branch matched Root Method ${root.name}.`);
    const method = root.methods.find(item => item.name === branch.method);
    trace.emit('branch.selected', { root: root.name, branch: branch.name, method: method.name });
    method.actions.forEach(action => applyAction(action, state, services, trace));
    const value = getPath(state, root.yieldPath);
    const result = { type: 'RootMethodResult', root: root.name, branch: branch.name, method: method.name, value, state, provenance: [root.name, branch.name, method.name, root.yieldPath] };
    trace.emit('root.yielded', result);
    return { ...result, trace: trace.events, receipt: trace.receipt('traverse rooted method with provenance', result) };
  },
  execute(source, rootName, input = {}, services = {}) {
    const ast = this.parse(source);
    return { ast, ir: this.lower(ast), runtime: this.invoke(ast, rootName ?? ast.roots[0].name, input, services) };
  }
};

export const CADEN_OPCODES = Object.freeze({ KEY: 0x11, CHECK: 0x12, ACTION: 0x13, RECOVER: 0x14, TRACE: 0x15, HALT: 0xff });

export const CadenVM = {
  compile(kadingProgram, cadenceName) {
    need(kadingProgram?.type === 'KProgram', 'CADEN_INVALID_KADING', 'CadenVM requires a Kading AST.');
    const cadence = kadingProgram.body.cadences.find(item => item.name === cadenceName);
    need(cadence, 'CADEN_UNKNOWN_CADENCE', `CadenVM cannot find cadence ${cadenceName}.`);
    const instructions = [];
    kadingProgram.body.keys.forEach(key => instructions.push({ opcode: CADEN_OPCODES.KEY, operands: [key.path, key.value] }));
    cadence.beats.forEach(beat => {
      if (beat.guard) instructions.push({ opcode: CADEN_OPCODES.CHECK, operands: [beat.name, beat.guard] });
      instructions.push({ opcode: CADEN_OPCODES.ACTION, operands: [beat.name, beat.action] });
      instructions.push({ opcode: CADEN_OPCODES.TRACE, operands: ['beat', beat.name] });
    });
    if (cadence.recovery) instructions.push({ opcode: CADEN_OPCODES.RECOVER, operands: [cadence.recovery.name, cadence.recovery.action] });
    instructions.push({ opcode: CADEN_OPCODES.HALT, operands: [] });
    const header = { schema: 'jm.cadenvm.bytecode/1.0', body: kadingProgram.body.name, cadence: cadence.name, version: 1 };
    return { type: 'CadenBytecode', header: { ...header, checksum: digest({ header, instructions }) }, instructions };
  },
  verify(bytecode) {
    need(bytecode?.type === 'CadenBytecode', 'CADEN_BAD_BYTECODE', 'CadenVM requires Caden bytecode.');
    const { checksum, ...header } = bytecode.header;
    need(checksum === digest({ header, instructions: bytecode.instructions }), 'CADEN_BAD_CHECKSUM', 'CadenVM bytecode checksum mismatch.');
    const valid = new Set(Object.values(CADEN_OPCODES));
    bytecode.instructions.forEach((instruction, index) => need(valid.has(instruction.opcode), 'CADEN_BAD_OPCODE', `Unknown CadenVM opcode at ${index}.`));
    return true;
  },
  execute(bytecode, initialState = {}, services = {}) {
    this.verify(bytecode);
    const state = structuredClone(initialState);
    const trace = new Trace('CadenVM');
    let guardFailed = false;
    let recovered = false;
    for (let pc = 0; pc < bytecode.instructions.length; pc += 1) {
      const instruction = bytecode.instructions[pc];
      trace.emit('instruction.begin', { pc, opcode: instruction.opcode });
      if (instruction.opcode === CADEN_OPCODES.KEY) {
        const [path, value] = instruction.operands;
        if (getPath(state, path) === undefined) setPath(state, path, structuredClone(value));
      } else if (instruction.opcode === CADEN_OPCODES.CHECK) {
        const [, expression] = instruction.operands;
        guardFailed = !evaluate(expression, state, services);
        trace.emit('guard.checked', { pc, passed: !guardFailed });
      } else if (instruction.opcode === CADEN_OPCODES.ACTION) {
        if (!guardFailed) applyAction(instruction.operands[1], state, services, trace);
      } else if (instruction.opcode === CADEN_OPCODES.RECOVER) {
        if (guardFailed) { applyAction(instruction.operands[1], state, services, trace); recovered = true; }
      } else if (instruction.opcode === CADEN_OPCODES.TRACE) {
        trace.emit('cadence.trace', { label: instruction.operands[0], value: instruction.operands[1] });
      } else if (instruction.opcode === CADEN_OPCODES.HALT) break;
      trace.emit('instruction.end', { pc, stateDigest: digest(state) });
    }
    const result = { type: 'CadenVMResult', body: bytecode.header.body, cadence: bytecode.header.cadence, state, recovered, checksum: bytecode.header.checksum };
    return { ...result, trace: trace.events, receipt: trace.receipt('verify and execute cadence bytecode', result) };
  },
  executeSource(kadingSource, cadenceName, state = {}, services = {}) {
    const ast = Kading.parse(kadingSource);
    const bytecode = this.compile(ast, cadenceName ?? ast.body.cadences[0].name);
    return { ast, ir: Kading.lower(ast), bytecode, runtime: this.execute(bytecode, state, services) };
  }
};
