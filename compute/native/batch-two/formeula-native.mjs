import { Trace, applyAction, blocks, digest, evaluate, getPath, lines, need, parseAction, parseExpr, setPath, splitTop, stable, valueOf } from './native-core.mjs';

function formeBlocks(source) {
  const output = [];
  const pattern = /\bforme\s+([A-Za-z_][\w.-]*)\s*\(([^)]*)\)\s*\{/g;
  let match;
  while ((match = pattern.exec(source))) {
    const open = pattern.lastIndex - 1;
    let depth = 1;
    let quote = '';
    let index = open + 1;
    for (; index < source.length && depth; index += 1) {
      const char = source[index];
      if (quote) {
        if (char === '\\') index += 1;
        else if (char === quote) quote = '';
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
    }
    need(depth === 0, 'FORMEULA_UNCLOSED_FORM', `Unclosed FormeULA form ${match[1]}.`);
    output.push({ name: match[1], paramsRaw: match[2], body: source.slice(open + 1, index - 1), start: match.index, end: index });
    pattern.lastIndex = index;
  }
  return output;
}

function tokenizeFormula(text) {
  const tokens = [];
  const re = /\s*(\d+(?:\.\d+)?|[A-Za-z_][\w.]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|==|!=|>=|<=|[()+\-*/%,<>])/gy;
  let index = 0;
  while (index < text.length) {
    re.lastIndex = index;
    const match = re.exec(text);
    need(match && match.index === index, 'FORMEULA_BAD_TOKEN', `Invalid FormeULA token near ${text.slice(index)}.`);
    tokens.push(match[1]);
    index = re.lastIndex;
  }
  return tokens;
}

function parseFormulaExpression(text) {
  const tokens = tokenizeFormula(text);
  let index = 0;
  function primary() {
    const token = tokens[index++];
    need(token !== undefined, 'FORMEULA_UNEXPECTED_END', 'Unexpected end of FormeULA expression.');
    if (token === '(') { const value = comparison(); need(tokens[index++] === ')', 'FORMEULA_EXPECTED_CLOSE', 'Expected ).'); return value; }
    if (/^-?\d/.test(token)) return { type: 'literal', value: Number(token) };
    if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) return { type: 'literal', value: token.slice(1, -1) };
    if (tokens[index] === '(') {
      index += 1;
      const args = [];
      if (tokens[index] !== ')') {
        do { args.push(comparison()); } while (tokens[index] === ',' && ++index);
      }
      need(tokens[index++] === ')', 'FORMEULA_EXPECTED_CLOSE', 'Expected function close ).');
      return { type: 'function', name: token, args };
    }
    return { type: 'reference', path: token };
  }
  function unary() {
    if (tokens[index] === '-') { index += 1; return { type: 'unary', op: '-', value: unary() }; }
    return primary();
  }
  function product() {
    let left = unary();
    while (['*', '/', '%'].includes(tokens[index])) { const op = tokens[index++]; left = { type: 'binary', op, left, right: unary() }; }
    return left;
  }
  function sum() {
    let left = product();
    while (['+', '-'].includes(tokens[index])) { const op = tokens[index++]; left = { type: 'binary', op, left, right: product() }; }
    return left;
  }
  function comparison() {
    let left = sum();
    while (['==', '!=', '>', '<', '>=', '<='].includes(tokens[index])) { const op = tokens[index++]; left = { type: 'binary', op, left, right: sum() }; }
    return left;
  }
  const ast = comparison();
  need(index === tokens.length, 'FORMEULA_TRAILING_TOKEN', `Unexpected FormeULA token ${tokens[index]}.`);
  return ast;
}

function formulaRefs(node, output = new Set()) {
  if (node.type === 'reference') output.add(node.path);
  if (node.value && typeof node.value === 'object') formulaRefs(node.value, output);
  if (node.left) formulaRefs(node.left, output);
  if (node.right) formulaRefs(node.right, output);
  if (node.args) node.args.forEach(arg => formulaRefs(arg, output));
  return [...output];
}

function evalFormula(node, scope, functions) {
  if (node.type === 'literal') return node.value;
  if (node.type === 'reference') return getPath(scope, node.path);
  if (node.type === 'unary') return -Number(evalFormula(node.value, scope, functions));
  if (node.type === 'function') {
    need(typeof functions[node.name] === 'function', 'FORMEULA_UNKNOWN_FUNCTION', `Unknown FormeULA function ${node.name}.`);
    return functions[node.name](...node.args.map(arg => evalFormula(arg, scope, functions)));
  }
  if (node.type === 'binary') {
    const left = evalFormula(node.left, scope, functions);
    const right = evalFormula(node.right, scope, functions);
    return ({ '+': () => left + right, '-': () => left - right, '*': () => left * right, '/': () => left / right, '%': () => left % right, '==': () => left === right, '!=': () => left !== right, '>': () => left > right, '<': () => left < right, '>=': () => left >= right, '<=': () => left <= right })[node.op]();
  }
  throw new Error(`Unknown FormeULA node ${node.type}`);
}

export const FormeULA = {
  parse(source) {
    const forms = formeBlocks(source).map(block => {
      const params = splitTop(block.paramsRaw).map(item => item.trim());
      const bindings = [];
      let yielded = null;
      for (const line of lines(block.body)) {
        const bind = line.match(/^bind\s+([A-Za-z_][\w.-]*)\s*=\s*(.+)$/);
        if (bind) { bindings.push({ type: 'FormBinding', name: bind[1], expression: parseFormulaExpression(bind[2]) }); continue; }
        const result = line.match(/^yield\s+(.+)$/); if (result) yielded = parseFormulaExpression(result[1]);
      }
      need(bindings.length && yielded, 'FORMEULA_INCOMPLETE', `FormeULA form ${block.name} requires bindings and yield.`);
      return { type: 'Forme', name: block.name, params, bindings, yield: yielded };
    });
    need(forms.length > 0, 'FORMEULA_NO_FORMS', 'FormeULA requires at least one forme.');
    return { type: 'FormeULAProgram', forms };
  },
  lower(program) {
    return {
      type: 'FormeULAGraphSet',
      graphs: program.forms.map(form => ({
        type: 'FormulaDependencyGraph', name: form.name,
        nodes: form.bindings.map(binding => ({ id: `${form.name}:${binding.name}`, name: binding.name, expression: binding.expression })),
        edges: form.bindings.flatMap(binding => formulaRefs(binding.expression).filter(ref => form.bindings.some(candidate => candidate.name === ref)).map(ref => ({ from: `${form.name}:${ref}`, to: `${form.name}:${binding.name}`, kind: 'dependency' }))),
        yield: form.yield
      }))
    };
  },
  evaluate(program, formName, args = {}, customFunctions = {}) {
    const form = program.forms.find(item => item.name === formName);
    need(form, 'FORMEULA_UNKNOWN_FORM', `Unknown FormeULA form ${formName}.`);
    const scope = { ...args };
    const trace = new Trace('FormeULA');
    const functions = {
      clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
      min: Math.min,
      max: Math.max,
      abs: Math.abs,
      round: Math.round,
      ...customFunctions
    };
    const remaining = [...form.bindings];
    let guard = 0;
    while (remaining.length) {
      need(guard++ < form.bindings.length * 2 + 2, 'FORMEULA_DEPENDENCY_CYCLE', `FormeULA dependency cycle in ${form.name}.`);
      const before = remaining.length;
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        const binding = remaining[index];
        const refs = formulaRefs(binding.expression);
        if (refs.every(ref => getPath(scope, ref) !== undefined || typeof functions[ref] === 'function')) {
          scope[binding.name] = evalFormula(binding.expression, scope, functions);
          trace.emit('binding.evaluated', { form: form.name, binding: binding.name, value: scope[binding.name] });
          remaining.splice(index, 1);
        }
      }
      need(remaining.length < before, 'FORMEULA_UNRESOLVED_REFERENCE', `Unresolved FormeULA references in ${form.name}.`, { remaining: remaining.map(item => item.name) });
    }
    const value = evalFormula(form.yield, scope, functions);
    const result = { type: 'FormeULAResult', form: form.name, scope, value, valueDigest: digest(value) };
    trace.emit('form.yielded', result);
    return { ...result, trace: trace.events, receipt: trace.receipt('evaluate dependency formula', result) };
  },
  execute(source, formName, args = {}, functions = {}) {
    const ast = this.parse(source);
    return { ast, ir: this.lower(ast), runtime: this.evaluate(ast, formName ?? ast.forms[0].name, args, functions) };
  }
};
