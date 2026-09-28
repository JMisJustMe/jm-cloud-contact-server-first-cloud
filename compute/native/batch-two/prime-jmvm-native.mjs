import { Trace, applyAction, blocks, digest, evaluate, getPath, lines, need, parseAction, parseExpr, setPath, stable, valueOf } from './native-core.mjs';

export const THEOPrimeBody = {
  parse(source) {
    const primes = blocks(source, 'prime').map(block => {
      let sourceBody = null;
      const stages = [];
      let proof = null;
      for (const line of lines(block.body)) {
        const sourceLine = line.match(/^source\s+([A-Za-z_][\w.-]*)$/); if (sourceLine) { sourceBody = sourceLine[1]; continue; }
        const stage = line.match(/^stage\s+([A-Za-z_][\w.-]*)\s+using\s+([A-Za-z_][\w.]*)$/); if (stage) { stages.push({ type: 'PrimeStage', name: stage[1], operation: stage[2] }); continue; }
        const prove = line.match(/^prove\s+([A-Za-z_][\w.-]*)$/); if (prove) proof = prove[1];
      }
      need(sourceBody && stages.length && proof, 'PRIME_INCOMPLETE', `PrimeBody ${block.name} requires source, stages and proof.`);
      return { type: 'PrimeBody', name: block.name, sourceBody, stages, proof };
    });
    need(primes.length > 0, 'PRIME_NO_BODIES', 'THEO/PrimeBody requires a prime body.');
    return { type: 'PrimeProgram', primes };
  },
  lower(program) {
    return {
      type: 'PrimePipelineSet',
      pipelines: program.primes.map(prime => ({
        type: 'PrimePipeline', name: prime.name, sourceBody: prime.sourceBody,
        stageNodes: prime.stages.map((stage, index) => ({ id: `${prime.name}:stage:${index}`, ...stage })),
        edges: prime.stages.slice(1).map((stage, index) => ({ from: `${prime.name}:stage:${index}`, to: `${prime.name}:stage:${index + 1}`, kind: 'pipeline' })),
        proof: prime.proof
      }))
    };
  },
  run(program, primeName, input, operations = {}) {
    const prime = program.primes.find(item => item.name === primeName);
    need(prime, 'PRIME_UNKNOWN_BODY', `Unknown PrimeBody ${primeName}.`);
    const trace = new Trace('THEO / PrimeBody');
    let value = input;
    const stages = [];
    for (const stage of prime.stages) {
      need(typeof operations[stage.operation] === 'function', 'PRIME_UNKNOWN_OPERATION', `Unknown PrimeBody operation ${stage.operation}.`);
      const before = digest(value);
      value = operations[stage.operation](value);
      const record = { stage: stage.name, operation: stage.operation, before, after: digest(value) };
      stages.push(record);
      trace.emit('stage.completed', record);
    }
    const proof = { schema: 'jm.primebody.proof/1.0', pipeline: prime.name, sourceBody: prime.sourceBody, proof: prime.proof, stages, resultDigest: digest(value) };
    proof.proofDigest = digest(proof);
    trace.emit('pipeline.proved', proof);
    return { type: 'PrimePipelineResult', pipeline: prime.name, value, proof, trace: trace.events, receipt: trace.receipt('execute compiler pipeline and prove each stage', proof) };
  },
  execute(source, primeName, input, operations = {}) {
    const ast = this.parse(source);
    return { ast, ir: this.lower(ast), runtime: this.run(ast, primeName ?? ast.primes[0].name, input, operations) };
  }
};

export const JMVM_OPCODES = Object.freeze({ CONST: 0x21, LOAD: 0x22, SET: 0x23, CALL: 0x24, ASSERT: 0x25, TRACE: 0x26, DING: 0x27, HALT: 0xff });

export const JMVM = {
  parse(source) {
    const machines = blocks(source, 'machine').map(block => {
      const constants = {};
      const instructions = [];
      for (const line of lines(block.body)) {
        const constant = line.match(/^const\s+([A-Za-z_][\w.-]*)\s*=\s*(.+)$/); if (constant) { constants[constant[1]] = valueOf(constant[2]); continue; }
        const instruction = line.match(/^instruction\s+(CONST|LOAD|SET|CALL|ASSERT|TRACE|DING|HALT)(?:\s+(.+))?$/);
        if (instruction) instructions.push({ type: 'JMVMInstructionAST', op: instruction[1], raw: instruction[2] ?? '' });
      }
      need(instructions.length && instructions.at(-1).op === 'HALT', 'JMVM_HALT_REQUIRED', `JMVM machine ${block.name} must end with HALT.`);
      need(instructions.some(item => item.op === 'DING'), 'JMVM_DING_REQUIRED', `JMVM machine ${block.name} requires DING.`);
      return { type: 'JMVMMachine', name: block.name, constants, instructions };
    });
    need(machines.length > 0, 'JMVM_NO_MACHINE', 'JMVM requires a machine.');
    return { type: 'JMVMProgram', machines };
  },
  lower(program) {
    const machines = program.machines.map(machine => {
      const instructions = machine.instructions.map(instruction => {
        const opcode = JMVM_OPCODES[instruction.op];
        let operands = [];
        if (instruction.op === 'SET') {
          const match = instruction.raw.match(/^([A-Za-z_][\w.]*)\s*=\s*(.+)$/); need(match, 'JMVM_BAD_SET', 'JMVM SET requires path = value.'); operands = [match[1], valueOf(match[2])];
        } else if (instruction.op === 'CALL') {
          const match = instruction.raw.match(/^([A-Za-z_][\w.]*)\((.*)\)$/); need(match, 'JMVM_BAD_CALL', 'JMVM CALL requires function(args).'); operands = [match[1], match[2].split(',').map(item => valueOf(item.trim())).filter(item => item !== null)];
        } else if (instruction.op === 'ASSERT') operands = [parseExpr(instruction.raw)];
        else if (instruction.op !== 'HALT') operands = [valueOf(instruction.raw)];
        return { opcode, operands };
      });
      const header = { schema: 'jm.jmvm.bytecode/1.0', machine: machine.name, constants: machine.constants, version: 1 };
      return { type: 'JMVMBytecode', header: { ...header, checksum: digest({ header, instructions }) }, instructions };
    });
    return { type: 'JMVMBytecodeSet', machines };
  },
  verify(bytecode) {
    need(bytecode?.type === 'JMVMBytecode', 'JMVM_BAD_BYTECODE', 'JMVM requires JMVM bytecode.');
    const { checksum, ...header } = bytecode.header;
    need(checksum === digest({ header, instructions: bytecode.instructions }), 'JMVM_BAD_CHECKSUM', 'JMVM bytecode checksum mismatch.');
    const valid = new Set(Object.values(JMVM_OPCODES));
    bytecode.instructions.forEach((instruction, index) => need(valid.has(instruction.opcode), 'JMVM_BAD_OPCODE', `Unknown JMVM opcode at ${index}.`));
    return true;
  },
  run(bytecode, initialState = {}, services = {}) {
    this.verify(bytecode);
    const state = structuredClone(initialState);
    const stack = [];
    const trace = new Trace('JMVM');
    let ding = null;
    for (let pc = 0; pc < bytecode.instructions.length; pc += 1) {
      const { opcode, operands } = bytecode.instructions[pc];
      trace.emit('instruction.begin', { pc, opcode, stackDepth: stack.length });
      if (opcode === JMVM_OPCODES.CONST) stack.push(bytecode.header.constants[operands[0]]);
      else if (opcode === JMVM_OPCODES.LOAD) stack.push(getPath(state, operands[0]));
      else if (opcode === JMVM_OPCODES.SET) setPath(state, operands[0], structuredClone(operands[1]));
      else if (opcode === JMVM_OPCODES.CALL) {
        need(typeof services[operands[0]] === 'function', 'JMVM_UNKNOWN_SERVICE', `Unknown JMVM service ${operands[0]}.`);
        stack.push(services[operands[0]](...operands[1], state));
      } else if (opcode === JMVM_OPCODES.ASSERT) need(evaluate(operands[0], state, services), 'JMVM_ASSERT_FAILED', 'JMVM assertion failed.', { expression: operands[0] });
      else if (opcode === JMVM_OPCODES.TRACE) trace.emit('machine.trace', { value: operands[0], stateDigest: digest(state) });
      else if (opcode === JMVM_OPCODES.DING) ding = { value: operands[0], stateDigest: digest(state), pc };
      else if (opcode === JMVM_OPCODES.HALT) break;
      trace.emit('instruction.end', { pc, stateDigest: digest(state), stackDepth: stack.length });
    }
    need(ding, 'JMVM_NO_DING', 'JMVM execution ended without Ding.');
    const result = { type: 'JMVMResult', machine: bytecode.header.machine, state, stack, ding, checksum: bytecode.header.checksum };
    return { ...result, trace: trace.events, receipt: trace.receipt('execute verified JM machine', result) };
  },
  execute(source, machineName, state = {}, services = {}) {
    const ast = this.parse(source);
    const ir = this.lower(ast);
    const bytecode = ir.machines.find(item => item.header.machine === (machineName ?? ast.machines[0].name));
    need(bytecode, 'JMVM_UNKNOWN_MACHINE', `Unknown JMVM machine ${machineName}.`);
    return { ast, ir, runtime: this.run(bytecode, state, services) };
  }
};
