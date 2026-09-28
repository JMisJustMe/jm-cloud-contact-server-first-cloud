import { Trace, applyAction, blocks, digest, evaluate, getPath, lines, need, parseAction, parseExpr, setPath, splitTop, stable, valueOf } from './native-core.mjs';

const TYPE_CHECKS = {
  text: value => typeof value === 'string',
  number: value => typeof value === 'number' && Number.isFinite(value),
  bool: value => typeof value === 'boolean',
  object: value => value && typeof value === 'object' && !Array.isArray(value),
  list: value => Array.isArray(value)
};

export const Codifying = {
  parse(source) {
    const codices = blocks(source, 'codex').map(block => {
      const fields = [];
      const requirements = [];
      const emissions = [];
      for (const line of lines(block.body)) {
        const field = line.match(/^field\s+([A-Za-z_][\w.-]*)\s*:\s*(text|number|bool|object|list)(?:\s*=\s*(.+))?$/);
        if (field) { fields.push({ type: 'CodexField', name: field[1], valueType: field[2], defaultValue: field[3] === undefined ? undefined : valueOf(field[3]) }); continue; }
        const require = line.match(/^require\s+(.+)$/);
        if (require) { requirements.push(parseExpr(require[1])); continue; }
        const emit = line.match(/^emit\s+([A-Za-z_][\w.-]*)$/);
        if (emit) emissions.push(emit[1]);
      }
      need(fields.length > 0, 'CODIFY_NO_FIELDS', `Codifying codex ${block.name} requires fields.`);
      const names = new Set(fields.map(field => field.name));
      need(names.size === fields.length, 'CODIFY_DUPLICATE_FIELD', `Codifying codex ${block.name} contains duplicate fields.`);
      return { type: 'Codex', name: block.name, fields, requirements, emissions };
    });
    need(codices.length > 0, 'CODIFY_NO_CODEX', 'Codifying requires at least one codex.');
    return { type: 'CodifyingProgram', codices };
  },
  lower(program) {
    return {
      type: 'CodexSchemaSet',
      schemas: program.codices.map(codex => ({
        type: 'CodexSchemaIR', name: codex.name,
        fieldNodes: codex.fields.map(field => ({ id: `${codex.name}:field:${field.name}`, ...field })),
        constraintNodes: codex.requirements.map((expr, index) => ({ id: `${codex.name}:constraint:${index}`, expr })),
        emissionNodes: codex.emissions.map(name => ({ id: `${codex.name}:emit:${name}`, name }))
      }))
    };
  },
  materialise(program, codexName, input = {}) {
    const codex = program.codices.find(item => item.name === codexName);
    need(codex, 'CODIFY_UNKNOWN_CODEX', `Unknown Codifying codex ${codexName}.`);
    const trace = new Trace('Codifying');
    const record = {};
    for (const field of codex.fields) {
      const value = input[field.name] === undefined ? structuredClone(field.defaultValue) : structuredClone(input[field.name]);
      need(value !== undefined, 'CODIFY_REQUIRED_FIELD', `Missing Codifying field ${field.name}.`);
      need(TYPE_CHECKS[field.valueType](value), 'CODIFY_TYPE_MISMATCH', `Field ${field.name} must be ${field.valueType}.`, { value });
      record[field.name] = value;
      trace.emit('field.materialised', { codex: codex.name, field: field.name, valueType: field.valueType });
    }
    const facts = { record, ...record };
    for (const requirement of codex.requirements) need(evaluate(requirement, facts), 'CODIFY_CONSTRAINT_FAILED', `Codifying constraint failed in ${codex.name}.`, { requirement });
    const encoded = stable(record);
    const result = { type: 'CodifiedRecord', codex: codex.name, record, emissions: codex.emissions, encoded, recordDigest: digest(record) };
    trace.emit('record.codified', result);
    return { ...result, trace: trace.events, receipt: trace.receipt('materialise typed codex', result) };
  },
  execute(source, codexName, input = {}) {
    const ast = this.parse(source);
    return { ast, ir: this.lower(ast), runtime: this.materialise(ast, codexName ?? ast.codices[0].name, input) };
  }
};

export const Kocodifying = {
  parse(source) {
    const bindings = blocks(source, 'cocode').map(block => {
      let left = null;
      let right = null;
      let conflict = 'reject';
      let recovery = null;
      const maps = [];
      for (const line of lines(block.body)) {
        const l = line.match(/^left\s+([A-Za-z_][\w.-]*)$/); if (l) { left = l[1]; continue; }
        const r = line.match(/^right\s+([A-Za-z_][\w.-]*)$/); if (r) { right = r[1]; continue; }
        const bind = line.match(/^bind\s+left\.([A-Za-z_][\w.]*)\s*<->\s*right\.([A-Za-z_][\w.]*)$/); if (bind) { maps.push({ left: bind[1], right: bind[2] }); continue; }
        const c = line.match(/^conflict\s+(left|right|reject)$/); if (c) { conflict = c[1]; continue; }
        const recover = line.match(/^recover\s+(rollback|commit)$/); if (recover) recovery = recover[1];
      }
      need(left && right && maps.length, 'KOCODIFY_INCOMPLETE', `Kocodifying body ${block.name} requires left, right and bindings.`);
      return { type: 'CoCodex', name: block.name, left, right, maps, conflict, recovery };
    });
    need(bindings.length > 0, 'KOCODIFY_NO_BODY', 'Kocodifying requires at least one cocode body.');
    return { type: 'KocodifyingProgram', bindings };
  },
  lower(program) {
    return {
      type: 'CoCodexBindingSet',
      graphs: program.bindings.map(binding => ({
        type: 'BidirectionalBindingGraph', name: binding.name, leftIdentity: binding.left, rightIdentity: binding.right,
        nodes: binding.maps.flatMap((map, index) => [{ id: `${binding.name}:left:${index}`, side: 'left', path: map.left }, { id: `${binding.name}:right:${index}`, side: 'right', path: map.right }]),
        edges: binding.maps.map((map, index) => ({ from: `${binding.name}:left:${index}`, to: `${binding.name}:right:${index}`, kind: 'bidirectional' })),
        conflict: binding.conflict, recovery: binding.recovery
      }))
    };
  },
  sync(program, name, leftInput = {}, rightInput = {}) {
    const binding = program.bindings.find(item => item.name === name);
    need(binding, 'KOCODIFY_UNKNOWN_BODY', `Unknown Kocodifying body ${name}.`);
    const left = structuredClone(leftInput);
    const right = structuredClone(rightInput);
    const trace = new Trace('Kocodifying');
    const conflicts = [];
    for (const map of binding.maps) {
      const lv = getPath(left, map.left);
      const rv = getPath(right, map.right);
      if (lv !== undefined && rv !== undefined && stable(lv) !== stable(rv)) conflicts.push({ map, left: lv, right: rv });
      if (lv !== undefined && (rv === undefined || binding.conflict === 'left')) setPath(right, map.right, structuredClone(lv));
      else if (rv !== undefined && (lv === undefined || binding.conflict === 'right')) setPath(left, map.left, structuredClone(rv));
      else if (lv === undefined && rv === undefined) continue;
      else if (stable(lv) !== stable(rv) && binding.conflict === 'reject') {
        trace.emit('binding.conflict', { map, left: lv, right: rv });
        if (binding.recovery === 'rollback') return { type: 'CoCodexSync', name, status: 'rolled-back', left: leftInput, right: rightInput, conflicts, trace: trace.events, receipt: trace.receipt('reject conflicting co-codification', conflicts) };
        need(false, 'KOCODIFY_CONFLICT', `Kocodifying conflict at ${map.left} <-> ${map.right}.`);
      }
      trace.emit('binding.synced', { map, left: getPath(left, map.left), right: getPath(right, map.right) });
    }
    const result = { type: 'CoCodexSync', name, status: 'synced', left, right, conflicts };
    return { ...result, trace: trace.events, receipt: trace.receipt('synchronise two codices without identity collapse', result) };
  },
  execute(source, name, left = {}, right = {}) {
    const ast = this.parse(source);
    return { ast, ir: this.lower(ast), runtime: this.sync(ast, name ?? ast.bindings[0].name, left, right) };
  }
};
