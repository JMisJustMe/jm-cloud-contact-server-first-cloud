import { Trace, applyAction, blocks, digest, evaluate, getPath, lines, need, parseAction, parseExpr, setPath, splitTop, stable, valueOf } from './native-core.mjs';

function fieldPath(name) { return name.includes('.') ? name : `record.${name}`; }

export const Kading = {
  parse(source) {
    const programs = blocks(source, 'kading').map(program => {
      const keys = [];
      for (const line of lines(program.body)) {
        const match = line.match(/^key\s+([A-Za-z_][\w.]*)\s*=\s*(.+)$/);
        if (match) keys.push({ type: 'KKey', path: match[1], value: valueOf(match[2]) });
      }
      const cadences = blocks(program.body, 'cadence').map(cadence => {
        const beats = [];
        let recovery = null;
        for (const line of lines(cadence.body)) {
          const beat = line.match(/^beat\s+([A-Za-z_][\w.-]*)\s+(?:when\s+(.+?)\s+)?do\s+(.+)$/);
          if (beat) {
            beats.push({ type: 'KBeat', name: beat[1], guard: beat[2] ? parseExpr(beat[2]) : null, action: parseAction(beat[3]) });
            continue;
          }
          const recover = line.match(/^recover\s+([A-Za-z_][\w.-]*)\s+do\s+(.+)$/);
          if (recover) recovery = { type: 'KRecovery', name: recover[1], action: parseAction(recover[2]) };
        }
        need(beats.length > 0, 'KADING_NO_BEATS', `Kading cadence ${cadence.name} requires beats.`);
        return { type: 'KCadence', name: cadence.name, beats, recovery };
      });
      need(cadences.length > 0, 'KADING_NO_CADENCE', `Kading program ${program.name} requires a cadence.`);
      return { type: 'KadingBody', name: program.name, keys, cadences };
    });
    need(programs.length === 1, 'KADING_ONE_BODY', 'Kading requires exactly one kading body.');
    return { type: 'KProgram', body: programs[0] };
  },
  lower(program) {
    const graphs = program.body.cadences.map(cadence => {
      const nodes = cadence.beats.map((beat, index) => ({ id: `${cadence.name}:beat:${index}`, ...beat }));
      if (cadence.recovery) nodes.push({ id: `${cadence.name}:recovery`, ...cadence.recovery });
      const edges = cadence.beats.slice(0, -1).map((beat, index) => ({ from: `${cadence.name}:beat:${index}`, to: `${cadence.name}:beat:${index + 1}`, kind: 'cadence' }));
      if (cadence.recovery) cadence.beats.forEach((beat, index) => beat.guard && edges.push({ from: `${cadence.name}:beat:${index}`, to: `${cadence.name}:recovery`, kind: 'guard-failed' }));
      return { type: 'KCadenceGraph', cadence: cadence.name, entry: nodes[0].id, nodes, edges };
    });
    return { type: 'KadingCadenceSet', body: program.body.name, keys: program.body.keys, graphs };
  },
  run(program, cadenceName, initialState = {}, services = {}) {
    const cadence = program.body.cadences.find(item => item.name === cadenceName);
    need(cadence, 'KADING_UNKNOWN_CADENCE', `Unknown Kading cadence ${cadenceName}.`);
    const state = structuredClone(initialState);
    const trace = new Trace('Kading');
    for (const key of program.body.keys) if (getPath(state, key.path) === undefined) setPath(state, key.path, structuredClone(key.value));
    const completed = [];
    for (const beat of cadence.beats) {
      const allowed = !beat.guard || evaluate(beat.guard, state, services);
      trace.emit('beat.checked', { cadence: cadence.name, beat: beat.name, allowed });
      if (!allowed) {
        if (cadence.recovery) applyAction(cadence.recovery.action, state, services, trace);
        trace.emit('cadence.recovered', { cadence: cadence.name, recovery: cadence.recovery?.name ?? null });
        return { type: 'KadingOutcome', cadence: cadence.name, completed, recovered: Boolean(cadence.recovery), state, trace: trace.events, receipt: trace.receipt('execute keyed cadence', state) };
      }
      applyAction(beat.action, state, services, trace);
      completed.push(beat.name);
      trace.emit('beat.completed', { cadence: cadence.name, beat: beat.name, stateDigest: digest(state) });
    }
    return { type: 'KadingOutcome', cadence: cadence.name, completed, recovered: false, state, trace: trace.events, receipt: trace.receipt('execute keyed cadence', state) };
  },
  execute(source, cadenceName, state = {}, services = {}) {
    const ast = this.parse(source);
    return { ast, ir: this.lower(ast), runtime: this.run(ast, cadenceName ?? ast.body.cadences[0].name, state, services) };
  }
};

export const JMP = {
  parse(source) {
    const maps = blocks(source, 'jumpmap').map(block => {
      const from = lines(block.body).map(line => line.match(/^from\s+([A-Za-z_][\w.]*)$/)).find(Boolean);
      need(from, 'JMP_MISSING_FROM', `J’MP map ${block.name} requires from.`);
      const cases = [];
      let fallback = null;
      for (const line of lines(block.body)) {
        const match = line.match(/^case\s+(.+?)(?:\s+when\s+(.+?))?\s*->\s*(.+?)(?:\s+do\s+(.+))?$/);
        if (match) {
          cases.push({ type: 'JMPCase', value: valueOf(match[1]), guard: match[2] ? parseExpr(match[2]) : null, target: valueOf(match[3]), action: match[4] ? parseAction(match[4]) : null });
          continue;
        }
        const other = line.match(/^else\s*->\s*(.+?)(?:\s+do\s+(.+))?$/);
        if (other) fallback = { type: 'JMPFallback', target: valueOf(other[1]), action: other[2] ? parseAction(other[2]) : null };
      }
      need(cases.length > 0, 'JMP_NO_CASES', `J’MP map ${block.name} requires cases.`);
      return { type: 'JMPMap', name: block.name, from: from[1], cases, fallback };
    });
    need(maps.length > 0, 'JMP_NO_MAPS', 'J’MP requires at least one jumpmap.');
    return { type: 'JMPProgram', maps };
  },
  lower(program) {
    return {
      type: 'JMPJumpGraphSet',
      graphs: program.maps.map(map => ({
        type: 'JMPJumpGraph', name: map.name, sourcePath: map.from,
        nodes: [
          { id: `${map.name}:source`, kind: 'source', path: map.from },
          ...map.cases.map((item, index) => ({ id: `${map.name}:case:${index}`, kind: 'case', ...item })),
          ...(map.fallback ? [{ id: `${map.name}:fallback`, kind: 'fallback', ...map.fallback }] : [])
        ],
        edges: map.cases.map((item, index) => ({ from: `${map.name}:source`, to: `${map.name}:case:${index}`, kind: 'guarded-jump', value: item.value, guard: item.guard }))
      }))
    };
  },
  jump(program, mapName, state = {}, services = {}) {
    const map = program.maps.find(item => item.name === mapName);
    need(map, 'JMP_UNKNOWN_MAP', `Unknown J’MP map ${mapName}.`);
    const next = structuredClone(state);
    const trace = new Trace('J’MP');
    const sourceValue = getPath(next, map.from);
    let selected = map.cases.find(item => item.value === sourceValue && (!item.guard || evaluate(item.guard, next, services))) ?? map.fallback;
    need(selected, 'JMP_NO_JUMP', `No J’MP transition matched ${map.name}.`);
    if (selected.action) applyAction(selected.action, next, services, trace);
    trace.emit('jump.selected', { map: map.name, from: sourceValue, target: selected.target });
    return { type: 'JMPTransition', map: map.name, from: sourceValue, target: selected.target, state: next, trace: trace.events, receipt: trace.receipt('resolve guarded jump', { target: selected.target, state: next }) };
  },
  execute(source, mapName, state = {}, services = {}) {
    const ast = this.parse(source);
    return { ast, ir: this.lower(ast), runtime: this.jump(ast, mapName ?? ast.maps[0].name, state, services) };
  }
};
