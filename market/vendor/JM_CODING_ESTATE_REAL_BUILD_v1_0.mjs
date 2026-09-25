/*
 * JM CODING ESTATE — REAL BUILD v1.0
 * ------------------------------------------------------------
 * A dependency-free implementation of the coding-body brief in
 * Pasted text(173).txt. This is an operational JM implementation,
 * not a claim to overwrite fuller historical source bodies.
 *
 * Works in Node 18+ and in a direct-open browser bundle.
 */

const VERSION = '1.0.0';
const BUILD_ID = 'JM_CODING_ESTATE_REAL_BUILD_v1_0';

class JMError extends Error {
  constructor(message, token = null, code = 'JM_ERROR') {
    const location = token && token.line ? ` at ${token.line}:${token.col}` : '';
    super(`${message}${location}`);
    this.name = 'JMError';
    this.code = code;
    this.token = token;
  }
}

function invariant(condition, message, token = null) {
  if (!condition) throw new JMError(message, token, 'INVARIANT');
}

function deepClone(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normaliseName(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function pathParts(path) {
  if (Array.isArray(path)) return path;
  return String(path).split('.').filter(Boolean);
}

function getPath(root, path, fallback = undefined) {
  const parts = pathParts(path);
  let current = root;
  for (const part of parts) {
    if (current == null) return fallback;
    if (current instanceof Map) current = current.get(part);
    else current = current[part];
  }
  return current === undefined ? fallback : current;
}

function setPath(root, path, value) {
  const parts = pathParts(path);
  invariant(parts.length > 0, 'Cannot set an empty path');
  let current = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    let next;
    if (current instanceof Map) {
      next = current.get(part);
      if (next == null) {
        next = {};
        current.set(part, next);
      }
    } else {
      next = current[part];
      if (next == null) {
        next = {};
        current[part] = next;
      }
    }
    current = next;
  }
  const last = parts.at(-1);
  if (current instanceof Map) current.set(last, value);
  else current[last] = value;
  return value;
}

class DeterministicClock {
  constructor(seed = 0) {
    this.value = seed;
  }
  now() {
    this.value += 1;
    return this.value;
  }
}

class TraceBox {
  constructor(body = 'estate', clock = new DeterministicClock()) {
    this.body = body;
    this.clock = clock;
    this.events = [];
    this.sequence = 0;
  }
  push(type, payload = {}) {
    const event = {
      seq: ++this.sequence,
      at: this.clock.now(),
      body: this.body,
      type,
      ...deepClone(payload),
    };
    this.events.push(event);
    if (this.debugger && typeof this.debugger.record === 'function') this.debugger.record(event);
    return event;
  }
  ding(symbol, payload = {}) {
    return this.push('ding', { symbol, ...payload });
  }
  hold(route, payload = {}) {
    return this.push('hold', { route, ...payload });
  }
  collapse(state, label = 'snapshot') {
    const snapshot = deepClone(state);
    const snapshotId = `${normaliseName(this.body)}-${this.sequence + 1}`;
    this.push('collapse', { snapshotId, label, snapshot });
    return { snapshotId, snapshot };
  }
  symbolise(name, value = null, bind = null) {
    return this.push('symbolise', { name, value: deepClone(value), bind });
  }
  receipt(status = 'PASS', extra = {}) {
    return {
      build: BUILD_ID,
      version: VERSION,
      body: this.body,
      status,
      eventCount: this.events.length,
      dings: this.events.filter((event) => event.type === 'ding').map((event) => event.symbol),
      holds: this.events.filter((event) => event.type === 'hold').map((event) => event.route),
      ...deepClone(extra),
      trace: deepClone(this.events),
    };
  }
}

const TOKEN_OPERATORS = ['=>', '->', '==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/=', '::'];
const TOKEN_SINGLE = new Set('{}()[],:;.+-*/%=<>!'.split(''));

function tokenize(source) {
  const text = String(source ?? '');
  const tokens = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const push = (type, value, startLine = line, startCol = col) => {
    tokens.push({ type, value, line: startLine, col: startCol });
  };

  const advance = () => {
    const ch = text[i++];
    if (ch === '\n') {
      line += 1;
      col = 1;
    } else {
      col += 1;
    }
    return ch;
  };

  while (i < text.length) {
    const ch = text[i];

    if (/\s/.test(ch)) {
      advance();
      continue;
    }

    if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') advance();
      continue;
    }
    if (ch === '#') {
      while (i < text.length && text[i] !== '\n') advance();
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      advance();
      advance();
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) advance();
      if (i < text.length) {
        advance();
        advance();
      }
      continue;
    }

    const startLine = line;
    const startCol = col;

    if (ch === '"' || ch === "'") {
      const quote = advance();
      let value = '';
      let closed = false;
      while (i < text.length) {
        const next = advance();
        if (next === quote) {
          closed = true;
          break;
        }
        if (next === '\\') {
          const escaped = advance();
          const escapes = { n: '\n', r: '\r', t: '\t', '"': '"', "'": "'", '\\': '\\' };
          value += escapes[escaped] ?? escaped;
        } else {
          value += next;
        }
      }
      if (!closed) throw new JMError('Unterminated string', { line: startLine, col: startCol });
      push('string', value, startLine, startCol);
      continue;
    }

    if (/\d/.test(ch) || (ch === '.' && /\d/.test(text[i + 1]))) {
      let raw = '';
      let dotSeen = false;
      while (i < text.length) {
        const next = text[i];
        if (next === '.' && !dotSeen) {
          dotSeen = true;
          raw += advance();
        } else if (/\d/.test(next)) {
          raw += advance();
        } else {
          break;
        }
      }
      push('number', Number(raw), startLine, startCol);
      continue;
    }

    if (/[A-Za-z_$Ø]/.test(ch)) {
      let raw = '';
      while (i < text.length && /[A-Za-z0-9_$\-Ø]/.test(text[i])) raw += advance();
      push('identifier', raw, startLine, startCol);
      continue;
    }

    let matchedOperator = null;
    for (const op of TOKEN_OPERATORS) {
      if (text.startsWith(op, i)) {
        matchedOperator = op;
        break;
      }
    }
    if (matchedOperator) {
      for (let n = 0; n < matchedOperator.length; n += 1) advance();
      push('operator', matchedOperator, startLine, startCol);
      continue;
    }

    if (TOKEN_SINGLE.has(ch)) {
      push('operator', advance(), startLine, startCol);
      continue;
    }

    throw new JMError(`Unexpected character ${JSON.stringify(ch)}`, { line: startLine, col: startCol }, 'LEX');
  }

  tokens.push({ type: 'eof', value: '<eof>', line, col });
  return tokens;
}

class TokenStream {
  constructor(source) {
    this.source = String(source ?? '');
    this.tokens = tokenize(this.source);
    this.index = 0;
  }
  peek(offset = 0) {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }
  next() {
    const token = this.peek();
    this.index = Math.min(this.index + 1, this.tokens.length - 1);
    return token;
  }
  eof() {
    return this.peek().type === 'eof';
  }
  is(value, offset = 0) {
    return this.peek(offset).value === value;
  }
  isType(type, offset = 0) {
    return this.peek(offset).type === type;
  }
  match(value) {
    if (this.is(value)) return this.next();
    return null;
  }
  expect(value, message = null) {
    const token = this.peek();
    if (token.value !== value) throw new JMError(message ?? `Expected ${value}, found ${token.value}`, token, 'PARSE');
    return this.next();
  }
  expectType(type, message = null) {
    const token = this.peek();
    if (token.type !== type) throw new JMError(message ?? `Expected ${type}, found ${token.value}`, token, 'PARSE');
    return this.next();
  }
  identifier() {
    return this.expectType('identifier', 'Expected an identifier').value;
  }
  skipSeparators() {
    while (this.match(';') || this.match(',')) {
      // intentional
    }
  }
}

const PRECEDENCE = new Map([
  ['or', 1], ['||', 1],
  ['and', 2], ['&&', 2],
  ['==', 3], ['!=', 3],
  ['<', 4], ['<=', 4], ['>', 4], ['>=', 4],
  ['+', 5], ['-', 5],
  ['*', 6], ['/', 6], ['%', 6],
]);

function parseExpression(stream, minPrecedence = 0) {
  let left = parseUnary(stream);
  while (true) {
    const op = stream.peek().value;
    const precedence = PRECEDENCE.get(op);
    if (precedence == null || precedence < minPrecedence) break;
    stream.next();
    const right = parseExpression(stream, precedence + 1);
    left = { kind: 'binary', op, left, right };
  }
  return left;
}

function parseUnary(stream) {
  const token = stream.peek();
  if (['not', '!', '-'].includes(token.value)) {
    stream.next();
    return { kind: 'unary', op: token.value, value: parseUnary(stream) };
  }
  return parsePostfix(stream, parsePrimary(stream));
}

function parsePrimary(stream) {
  const token = stream.peek();
  if (token.type === 'number' || token.type === 'string') {
    stream.next();
    return { kind: 'literal', value: token.value };
  }
  if (token.value === 'true' || token.value === 'false') {
    stream.next();
    return { kind: 'literal', value: token.value === 'true' };
  }
  if (token.value === 'null' || token.value === 'none' || token.value === 'None') {
    stream.next();
    return { kind: 'literal', value: null };
  }
  if (stream.match('(')) {
    const first = parseExpression(stream);
    if (stream.match(',')) {
      const items = [first];
      while (!stream.is(')')) {
        items.push(parseExpression(stream));
        if (!stream.match(',')) break;
      }
      stream.expect(')');
      return { kind: 'list', items, vector: items.length === 2 };
    }
    stream.expect(')');
    return first;
  }
  if (stream.match('[')) {
    const items = [];
    while (!stream.is(']')) {
      items.push(parseExpression(stream));
      if (!stream.match(',')) break;
    }
    stream.expect(']');
    return { kind: 'list', items };
  }
  if (stream.match('{')) {
    const entries = [];
    while (!stream.is('}')) {
      const keyToken = stream.peek();
      let key;
      if (keyToken.type === 'string' || keyToken.type === 'identifier') key = stream.next().value;
      else throw new JMError('Expected map key', keyToken, 'PARSE');
      stream.expect(':');
      entries.push([key, parseExpression(stream)]);
      if (!stream.match(',')) break;
    }
    stream.expect('}');
    return { kind: 'map', entries };
  }
  if (token.type === 'identifier') {
    stream.next();
    return { kind: 'var', name: token.value };
  }
  throw new JMError(`Expected expression, found ${token.value}`, token, 'PARSE');
}

function parsePostfix(stream, base) {
  let expr = base;
  while (true) {
    if (stream.match('.')) {
      expr = { kind: 'access', object: expr, property: stream.identifier() };
      continue;
    }
    if (stream.match('[')) {
      const index = parseExpression(stream);
      stream.expect(']');
      expr = { kind: 'index', object: expr, index };
      continue;
    }
    if (stream.match('(')) {
      const args = [];
      while (!stream.is(')')) {
        args.push(parseExpression(stream));
        if (!stream.match(',')) break;
      }
      stream.expect(')');
      expr = { kind: 'call', callee: expr, args };
      continue;
    }
    break;
  }
  return expr;
}

function astPath(expr) {
  if (expr?.kind === 'var') return [expr.name];
  if (expr?.kind === 'access') {
    const base = astPath(expr.object);
    if (!base) return null;
    return [...base, expr.property];
  }
  return null;
}

class Scope {
  constructor(values = {}, parent = null) {
    this.values = values instanceof Map ? values : new Map(Object.entries(values));
    this.parent = parent;
  }
  hasOwn(name) {
    return this.values.has(name);
  }
  has(name) {
    return this.hasOwn(name) || Boolean(this.parent?.has(name));
  }
  get(name) {
    if (this.values.has(name)) return this.values.get(name);
    if (this.parent) return this.parent.get(name);
    return undefined;
  }
  define(name, value) {
    this.values.set(name, value);
    return value;
  }
  set(name, value) {
    if (this.values.has(name)) {
      this.values.set(name, value);
      return value;
    }
    if (this.parent?.has(name)) return this.parent.set(name, value);
    this.values.set(name, value);
    return value;
  }
  toObject() {
    const out = this.parent ? this.parent.toObject() : {};
    for (const [key, value] of this.values.entries()) out[key] = value;
    return out;
  }
}

const BUILTINS = {
  len: (value) => value?.length ?? (value instanceof Map ? value.size : Object.keys(value ?? {}).length),
  push: (list, value) => { list.push(value); return list.length; },
  pop: (list) => list.pop(),
  get: (object, key, fallback = null) => object instanceof Map ? (object.has(key) ? object.get(key) : fallback) : (object?.[key] ?? fallback),
  set: (object, key, value) => { if (object instanceof Map) object.set(key, value); else object[key] = value; return value; },
  keys: (object) => object instanceof Map ? [...object.keys()] : Object.keys(object ?? {}),
  values: (object) => object instanceof Map ? [...object.values()] : Object.values(object ?? {}),
  number: (value) => Number(value),
  text: (value) => String(value),
  bool: (value) => Boolean(value),
  min: (...values) => Math.min(...values),
  max: (...values) => Math.max(...values),
  abs: (value) => Math.abs(value),
  round: (value) => Math.round(value),
  some: (value) => ({ some: true, value }),
  none: () => ({ some: false, value: null }),
};

function evaluateExpression(ast, scope, runtime = null) {
  if (!ast) return null;
  const getValue = (name) => {
    const value = scope instanceof Scope ? scope.get(name) : scope?.[name];
    if (value !== undefined) return value;
    if (runtime?.builtins?.[name]) return runtime.builtins[name];
    if (BUILTINS[name]) return BUILTINS[name];
    if (runtime?.resolveName) return runtime.resolveName(name, scope);
    return undefined;
  };

  switch (ast.kind) {
    case 'literal': return ast.value;
    case 'var': return getValue(ast.name);
    case 'list': return ast.items.map((item) => evaluateExpression(item, scope, runtime));
    case 'map': return Object.fromEntries(ast.entries.map(([key, value]) => [key, evaluateExpression(value, scope, runtime)]));
    case 'access': {
      const object = evaluateExpression(ast.object, scope, runtime);
      if (object instanceof Map) return object.get(ast.property);
      return object?.[ast.property];
    }
    case 'index': {
      const object = evaluateExpression(ast.object, scope, runtime);
      const index = evaluateExpression(ast.index, scope, runtime);
      return object instanceof Map ? object.get(index) : object?.[index];
    }
    case 'unary': {
      const value = evaluateExpression(ast.value, scope, runtime);
      if (ast.op === 'not' || ast.op === '!') return !value;
      if (ast.op === '-') return -Number(value);
      throw new JMError(`Unknown unary operator ${ast.op}`);
    }
    case 'binary': {
      if (ast.op === 'and' || ast.op === '&&') return Boolean(evaluateExpression(ast.left, scope, runtime)) && Boolean(evaluateExpression(ast.right, scope, runtime));
      if (ast.op === 'or' || ast.op === '||') return Boolean(evaluateExpression(ast.left, scope, runtime)) || Boolean(evaluateExpression(ast.right, scope, runtime));
      const left = evaluateExpression(ast.left, scope, runtime);
      const right = evaluateExpression(ast.right, scope, runtime);
      switch (ast.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        case '==': return left === right;
        case '!=': return left !== right;
        case '<': return left < right;
        case '<=': return left <= right;
        case '>': return left > right;
        case '>=': return left >= right;
        default: throw new JMError(`Unknown binary operator ${ast.op}`);
      }
    }
    case 'call': {
      const fn = evaluateExpression(ast.callee, scope, runtime);
      const args = ast.args.map((arg) => evaluateExpression(arg, scope, runtime));
      if (typeof fn !== 'function') throw new JMError('Expression target is not callable');
      return fn(...args);
    }
    default: throw new JMError(`Unknown expression kind ${ast.kind}`);
  }
}

function assignAstPath(targetAst, value, scope, runtime = null) {
  const parts = astPath(targetAst);
  if (!parts) throw new JMError('Assignment target must be a name or property path');
  if (parts.length === 1) {
    if (scope instanceof Scope) return scope.set(parts[0], value);
    scope[parts[0]] = value;
    return value;
  }
  const rootName = parts[0];
  let root = scope instanceof Scope ? scope.get(rootName) : scope[rootName];
  if (root == null && runtime?.resolveName) root = runtime.resolveName(rootName, scope);
  if (root == null) {
    root = {};
    if (scope instanceof Scope) scope.define(rootName, root);
    else scope[rootName] = root;
  }
  return setPath(root, parts.slice(1), value);
}

function interpolateText(template, scope, runtime = null) {
  return String(template).replace(/\{([^}]+)\}/g, (_, path) => {
    const parts = path.trim().split('.');
    let value = scope instanceof Scope ? scope.get(parts.shift()) : scope?.[parts.shift()];
    for (const part of parts) value = value?.[part];
    return value == null ? '' : String(value);
  });
}

function parseType(stream) {
  const name = stream.identifier();
  if (stream.match('<')) {
    const args = [parseType(stream)];
    while (stream.match(',')) args.push(parseType(stream));
    stream.expect('>');
    return { name, args };
  }
  return { name, args: [] };
}

function parseParameterList(stream) {
  const params = [];
  stream.expect('(');
  while (!stream.is(')')) {
    const name = stream.identifier();
    let type = { name: 'any', args: [] };
    if (stream.match(':')) type = parseType(stream);
    params.push({ name, type });
    if (!stream.match(',')) break;
  }
  stream.expect(')');
  return params;
}

function parseActionTarget(stream) {
  let target = { kind: 'var', name: stream.identifier() };
  while (stream.match('.')) target = { kind: 'access', object: target, property: stream.identifier() };
  return target;
}

function parseGenericStatement(stream, options = {}) {
  const allow = (name) => options[name] !== false;
  const token = stream.peek();

  if (allow('let') && stream.match('let')) {
    const name = stream.identifier();
    let type = { name: 'any', args: [] };
    if (stream.match(':')) type = parseType(stream);
    stream.expect('=');
    const value = parseExpression(stream);
    stream.match(';');
    return { kind: 'let', name, type, value };
  }

  if (allow('set') && stream.match('set')) {
    const target = parseActionTarget(stream);
    stream.expect('=');
    const value = parseExpression(stream);
    stream.match(';');
    return { kind: 'set', target, value };
  }

  if (allow('if') && stream.match('if')) {
    const condition = parseExpression(stream);
    const then = parseStatementBlock(stream, options);
    let otherwise = [];
    if (stream.match('else')) otherwise = parseStatementBlock(stream, options);
    return { kind: 'if', condition, then, otherwise };
  }

  if (allow('return') && stream.match('return')) {
    const value = stream.is(';') || stream.is('}') ? { kind: 'literal', value: null } : parseExpression(stream);
    stream.match(';');
    return { kind: 'return', value };
  }

  if (allow('emit') && stream.match('emit')) {
    const value = parseExpression(stream);
    stream.match(';');
    return { kind: 'emit', value };
  }

  if (allow('ding') && stream.match('ding')) {
    const value = parseExpression(stream);
    stream.match(';');
    return { kind: 'ding', value };
  }

  if (allow('hold') && stream.match('hold')) {
    stream.match(';');
    return { kind: 'hold' };
  }

  if (allow('resume') && stream.match('resume')) {
    stream.match(';');
    return { kind: 'resume' };
  }

  if (allow('collapse') && stream.match('collapse')) {
    let label = { kind: 'literal', value: 'snapshot' };
    if (!stream.is(';') && !stream.is('}')) label = parseExpression(stream);
    stream.match(';');
    return { kind: 'collapse', label };
  }

  if (allow('symbolise') && stream.match('symbolise')) {
    const name = parseExpression(stream);
    let value = { kind: 'literal', value: null };
    if (stream.match('with')) value = parseExpression(stream);
    stream.match(';');
    return { kind: 'symbolise', name, value };
  }

  if (allow('trace') && stream.match('trace')) {
    const value = parseExpression(stream);
    stream.match(';');
    return { kind: 'trace', value };
  }

  if (allow('deliver') && stream.match('deliver')) {
    let channel = 'text';
    if (stream.peek().type === 'identifier' && !['true', 'false'].includes(stream.peek().value)) channel = stream.next().value;
    const value = parseExpression(stream);
    stream.match(';');
    return { kind: 'deliver', channel, value };
  }

  if (allow('say') && stream.match('say')) {
    const value = parseExpression(stream);
    stream.match(';');
    return { kind: 'say', value };
  }

  if (allow('goto') && stream.match('goto')) {
    const target = stream.identifier();
    stream.match(';');
    return { kind: 'goto', target };
  }

  if (allow('call') && stream.match('call')) {
    const target = parseActionTarget(stream);
    const args = stream.is('(') ? parseCallArguments(stream) : [];
    stream.match(';');
    return { kind: 'body-call', target: astPath(target).join('.'), args };
  }

  if (allow('fusion') && stream.match('fusion')) {
    const route = parseExpression(stream);
    stream.match(';');
    return { kind: 'fusion-call', route };
  }

  if (allow('generate') && stream.match('generate')) {
    const formula = stream.identifier();
    stream.expect('.');
    const gate = stream.identifier();
    stream.match(';');
    return { kind: 'formula-generate', formula, gate };
  }

  if (allow('phase') && stream.match('phase')) {
    const value = parseExpression(stream);
    stream.match(';');
    return { kind: 'phase', value };
  }

  if (token.type === 'identifier') {
    const target = parseActionTarget(stream);
    if (stream.match('=')) {
      const value = parseExpression(stream);
      stream.match(';');
      return { kind: 'set', target, value };
    }
    if (stream.is('(')) {
      const args = parseCallArguments(stream);
      stream.match(';');
      return { kind: 'expr-call', target, args };
    }
  }

  throw new JMError(`Unknown statement starting with ${stream.peek().value}`, stream.peek(), 'PARSE');
}

function parseCallArguments(stream) {
  const args = [];
  stream.expect('(');
  while (!stream.is(')')) {
    args.push(parseExpression(stream));
    if (!stream.match(',')) break;
  }
  stream.expect(')');
  return args;
}

function parseStatementBlock(stream, options = {}) {
  const body = [];
  stream.expect('{');
  while (!stream.is('}')) {
    body.push(parseGenericStatement(stream, options));
    stream.skipSeparators();
  }
  stream.expect('}');
  return body;
}

function executeStatements(statements, scope, runtime, control = {}) {
  for (const statement of statements) {
    const result = executeStatement(statement, scope, runtime, control);
    if (result?.signal) return result;
  }
  return null;
}

function executeStatement(statement, scope, runtime, control = {}) {
  if (runtime?.debugger && typeof runtime.debugger.statement === 'function') {
    runtime.debugger.statement({
      phase: 'before',
      body: runtime.bodyId,
      path: statement?.__jmPath ?? null,
      kind: statement?.kind ?? 'unknown',
      control: jmDebugClone(control),
      scope: scope?.toObject ? jmDebugClone(scope.toObject()) : jmDebugClone(scope ?? {}),
    });
  }
  const evaluate = (expr) => evaluateExpression(expr, scope, runtime);
  switch (statement.kind) {
    case 'let':
      scope.define(statement.name, evaluate(statement.value));
      return null;
    case 'set': {
      const value = evaluate(statement.value);
      assignAstPath(statement.target, value, scope, runtime);
      runtime.trace?.push('set', { target: astPath(statement.target).join('.'), value });
      return null;
    }
    case 'if':
      return executeStatements(evaluate(statement.condition) ? statement.then : statement.otherwise, new Scope({}, scope), runtime, control);
    case 'return': return { signal: 'return', value: evaluate(statement.value) };
    case 'emit': {
      const value = evaluate(statement.value);
      runtime.outputs?.push({ channel: 'symbol', value });
      runtime.trace?.push('emit', { value });
      return null;
    }
    case 'ding': {
      const symbol = String(evaluate(statement.value));
      runtime.trace?.ding(symbol, { route: control.route ?? null });
      runtime.host?.fusion?.emitSymbol(symbol, { body: runtime.bodyId, route: control.route });
      return null;
    }
    case 'hold':
      if (control.routeInstance) control.routeInstance.status = 'held';
      runtime.held = true;
      runtime.trace?.hold(control.route ?? runtime.bodyId);
      return { signal: 'hold' };
    case 'resume':
      if (control.routeInstance) control.routeInstance.status = 'running';
      runtime.held = false;
      runtime.trace?.push('resume', { route: control.route ?? runtime.bodyId });
      return null;
    case 'collapse': {
      const label = String(evaluate(statement.label));
      const snapshot = runtime.snapshot ? runtime.snapshot() : scope.toObject();
      runtime.trace?.collapse(snapshot, label);
      return null;
    }
    case 'symbolise': {
      const name = String(evaluate(statement.name));
      const value = evaluate(statement.value);
      runtime.trace?.symbolise(name, value, control.route ?? null);
      runtime.host?.fusion?.registerSymbol(name, { body: runtime.bodyId, value });
      return null;
    }
    case 'trace':
      runtime.trace?.push('trace', { value: deepClone(evaluate(statement.value)) });
      return null;
    case 'deliver': {
      const value = evaluate(statement.value);
      runtime.host?.delivery?.send(statement.channel, value, { body: runtime.bodyId });
      runtime.outputs?.push({ channel: statement.channel, value });
      runtime.trace?.push('deliver', { channel: statement.channel, value });
      return null;
    }
    case 'say': {
      const raw = evaluate(statement.value);
      const value = interpolateText(raw, scope, runtime);
      runtime.outputs?.push({ channel: 'text', value });
      runtime.trace?.push('say', { value });
      return null;
    }
    case 'goto': return { signal: 'goto', target: statement.target };
    case 'body-call': {
      const args = statement.args.map(evaluate);
      const value = runtime.host?.call(statement.target, args, scope.toObject());
      runtime.trace?.push('body-call', { target: statement.target, args, value });
      return null;
    }
    case 'fusion-call': {
      const route = String(evaluate(statement.route));
      runtime.host?.fusion?.runRoute(route, scope.toObject(), runtime.host);
      runtime.trace?.push('fusion-call', { route });
      return null;
    }
    case 'formula-generate': {
      const generated = runtime.host?.formulaBorn?.generate(statement.formula, statement.gate, scope.toObject());
      scope.set('generated', generated);
      runtime.trace?.push('formula-generate', { formula: statement.formula, gate: statement.gate, generated });
      return null;
    }
    case 'phase': {
      const value = evaluate(statement.value);
      const gameState = runtime.states?.get('GameState') ?? runtime.states?.get('gameState');
      if (gameState) gameState.phase = value;
      scope.set('phase', value);
      runtime.trace?.push('phase', { value });
      return null;
    }
    case 'expr-call': {
      const fn = evaluateExpression(statement.target, scope, runtime);
      if (typeof fn !== 'function') throw new JMError('Statement target is not callable');
      fn(...statement.args.map(evaluate));
      return null;
    }
    default: throw new JMError(`Unknown statement kind ${statement.kind}`);
  }
}

class BodyMembrane {
  constructor(runtime) {
    this.runtime = runtime;
    this.inner = { body: runtime.bodyId, state: 'stable' };
    this.outer = { callable: true, version: VERSION };
    this.route = { inbound: [], outbound: [] };
    this.symbol = { inbound: [], outbound: [] };
    this.glyph = { inbound: [], outbound: [] };
    this.formula = { inbound: [], outbound: [] };
    this.bindings = new Map();
  }
  bind(name, value) {
    this.bindings.set(name, deepClone(value));
    this.runtime.trace.push('membrane-bind', { name, value });
    return value;
  }
  receive(channel, packet) {
    const surface = this[channel];
    invariant(surface && Array.isArray(surface.inbound), `Unknown membrane channel ${channel}`);
    const copy = deepClone(packet);
    surface.inbound.push(copy);
    this.runtime.trace.push('membrane-in', { channel, packet: copy });
    return copy;
  }
  emit(channel, packet) {
    const surface = this[channel];
    invariant(surface && Array.isArray(surface.outbound), `Unknown membrane channel ${channel}`);
    const copy = deepClone(packet);
    surface.outbound.push(copy);
    this.runtime.trace.push('membrane-out', { channel, packet: copy });
    return copy;
  }
  snapshot() {
    return {
      inner: deepClone(this.inner),
      outer: deepClone(this.outer),
      route: deepClone(this.route),
      symbol: deepClone(this.symbol),
      glyph: deepClone(this.glyph),
      formula: deepClone(this.formula),
      bindings: Object.fromEntries(this.bindings),
    };
  }
}

class BodyRuntime {
  constructor(bodyId, host = null) {
    this.bodyId = bodyId;
    this.host = host;
    this.trace = new TraceBox(bodyId, host?.clock ?? new DeterministicClock());
    this.outputs = [];
    this.held = false;
    this.builtins = { ...BUILTINS };
    this.identity = {
      core: bodyId,
      form: { body: bodyId, version: VERSION },
      route: [],
      symbols: [],
      collapses: [],
      traces: [],
    };
    this.membrane = new BodyMembrane(this);
  }
  bindIdentity(patch = {}) {
    this.identity = { ...this.identity, ...deepClone(patch) };
    this.host?.fusion?.bindIdentity(this.bodyId, this.identity);
    this.trace.push('identity-bind', { identity: this.identity });
    return this.identity;
  }
  receiveGlyph(glyph) {
    const packet = this.membrane.receive('glyph', glyph);
    this.trace.push('glyph-in', { glyph: packet });
    return packet;
  }
  emitGlyph(glyph) {
    const packet = this.membrane.emit('glyph', glyph);
    this.host?.fusion?.registerGlyph(glyph.name ?? `${this.bodyId}-glyph-${this.trace.sequence + 1}`, glyph);
    this.trace.push('glyph-out', { glyph: packet });
    return packet;
  }
  generateFormula(formula, gate, context = {}) {
    const request = this.membrane.emit('formula', { formula, gate, context });
    const generated = this.host?.formulaBorn?.generate(formula, gate, context);
    this.membrane.receive('formula', generated ?? { status: 'HOLD', request });
    return generated;
  }
  collapseState(label = 'snapshot') {
    const collapse = this.trace.collapse(this.snapshot(), label);
    this.identity.collapses.push(collapse.snapshotId);
    return collapse;
  }
  snapshot() {
    return {
      bodyId: this.bodyId,
      identity: deepClone(this.identity),
      membrane: this.membrane.snapshot(),
      outputs: deepClone(this.outputs),
      held: this.held,
    };
  }
  receipt(extra = {}) {
    return this.trace.receipt('PASS', { outputs: deepClone(this.outputs), ...extra });
  }
}

class CodingBody {
  constructor({ id, name, kind, version = '1.0-jm', capabilities = [], parser, runtimeFactory, description = '' }) {
    this.id = id;
    this.name = name;
    this.kind = kind;
    this.version = version;
    this.description = description;
    this.capabilities = new Set(capabilities);
    this.parser = parser;
    this.runtimeFactory = runtimeFactory;
  }
  parse(source) {
    invariant(this.parser?.parse, `${this.name} has no parser`);
    return this.parser.parse(source);
  }
  compile(sourceOrAst) {
    const ast = typeof sourceOrAst === 'string' ? this.parse(sourceOrAst) : sourceOrAst;
    return { kind: `${this.id}-ir`, body: this.id, version: this.version, ast: deepClone(ast) };
  }
  createRuntime(programOrIr, host = null) {
    const program = programOrIr?.ast ?? programOrIr;
    return this.runtimeFactory(program, host);
  }
  run(source, host = null, input = {}) {
    const ir = this.compile(source);
    const runtime = this.createRuntime(ir, host);
    const value = runtime.run ? runtime.run(input) : runtime.init?.(input);
    return { ir, runtime, value, receipt: runtime.receipt?.() };
  }
  manifest() {
    return {
      id: this.id,
      name: this.name,
      kind: this.kind,
      version: this.version,
      description: this.description,
      capabilities: [...this.capabilities].sort(),
      sourceState: 'implemented-v0.3',
    };
  }
}

// -----------------------------------------------------------------------------
// CADING
// -----------------------------------------------------------------------------

class CadingParser {
  parse(source) {
    const stream = new TokenStream(source);
    stream.expect('module');
    const name = stream.identifier();
    const globals = [];
    const functions = [];
    stream.expect('{');
    while (!stream.is('}')) {
      if (stream.match('let')) {
        const fieldName = stream.identifier();
        let type = { name: 'any', args: [] };
        if (stream.match(':')) type = parseType(stream);
        stream.expect('=');
        const value = parseExpression(stream);
        stream.match(';');
        globals.push({ kind: 'global', name: fieldName, type, value });
      } else if (stream.match('func')) {
        const funcName = stream.identifier();
        const params = parseParameterList(stream);
        let returnType = { name: 'any', args: [] };
        if (stream.match('->')) returnType = parseType(stream);
        const body = parseStatementBlock(stream);
        functions.push({ kind: 'function', name: funcName, params, returnType, body });
      } else {
        throw new JMError(`Expected let or func, found ${stream.peek().value}`, stream.peek(), 'PARSE');
      }
      stream.skipSeparators();
    }
    stream.expect('}');
    return { kind: 'cading-program', name, globals, functions };
  }
}

class CadingRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('cading', host);
    this.program = program;
    this.globals = new Scope();
    this.functions = new Map(program.functions.map((fn) => [fn.name, fn]));
    this.initialised = false;
    this.builtins = {
      ...this.builtins,
      print: (...values) => { this.outputs.push({ channel: 'text', value: values.join(' ') }); return values.at(-1); },
    };
  }
  init() {
    if (this.initialised) return this;
    for (const global of this.program.globals) {
      this.globals.define(global.name, evaluateExpression(global.value, this.globals, this));
    }
    this.initialised = true;
    this.trace.push('init', { module: this.program.name, globals: this.globals.toObject() });
    return this;
  }
  resolveName(name) {
    if (this.functions.has(name)) return (...args) => this.invoke(name, args);
    return undefined;
  }
  invoke(name, args = []) {
    this.init();
    const fn = this.functions.get(name);
    invariant(fn, `Unknown Cading function ${name}`);
    const local = new Scope({}, this.globals);
    fn.params.forEach((param, index) => local.define(param.name, args[index]));
    this.trace.push('call', { function: name, args });
    const result = executeStatements(fn.body, local, this, { function: name });
    const value = result?.signal === 'return' ? result.value : null;
    this.trace.push('return', { function: name, value });
    return value;
  }
  run(input = {}) {
    this.init();
    const entry = input.entry ?? (this.functions.has('main') ? 'main' : this.program.functions[0]?.name);
    return entry ? this.invoke(entry, input.args ?? []) : this.globals.toObject();
  }
  snapshot() {
    return { module: this.program.name, globals: this.globals.toObject(), outputs: deepClone(this.outputs) };
  }
}

// -----------------------------------------------------------------------------
// KADING
// -----------------------------------------------------------------------------

class KadingParser {
  parse(source) {
    const stream = new TokenStream(source);
    const flows = [];
    while (!stream.eof()) {
      stream.expect('flow');
      const name = stream.identifier();
      stream.expect('{');
      stream.expect('from');
      const from = [stream.identifier()];
      while (stream.match(',')) from.push(stream.identifier());
      stream.expect('to');
      const to = stream.identifier();
      stream.expect('map');
      const mappings = parseStatementBlock(stream, {
        let: false, return: false, say: false, goto: false, hold: false,
        resume: false, phase: false, generate: true,
      });
      stream.expect('}');
      flows.push({ kind: 'flow', name, from, to, mappings });
      stream.skipSeparators();
    }
    return { kind: 'kading-program', flows };
  }
}

class KadingRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('kading', host);
    this.program = program;
    this.flows = new Map(program.flows.map((flow) => [flow.name, flow]));
  }
  runFlow(name, sources = {}) {
    const flow = this.flows.get(name);
    invariant(flow, `Unknown Kading flow ${name}`);
    const target = {};
    const sourceObject = flow.from.length === 1 && !Object.prototype.hasOwnProperty.call(sources, flow.from[0])
      ? sources
      : sources;
    const scopeValues = { ...sourceObject, [flow.to]: target, target };
    if (flow.from.length === 1 && !scopeValues[flow.from[0]]) scopeValues[flow.from[0]] = sources;
    const scope = new Scope(scopeValues);
    this.trace.push('flow-start', { flow: name, from: flow.from, to: flow.to });
    executeStatements(flow.mappings, scope, this, { route: name });
    this.trace.push('flow-end', { flow: name, target });
    return target;
  }
  run(input = {}) {
    const name = input.flow ?? this.program.flows[0]?.name;
    return this.runFlow(name, input.sources ?? input);
  }
  snapshot() {
    return { flows: [...this.flows.keys()], outputs: deepClone(this.outputs) };
  }
}

// -----------------------------------------------------------------------------
// JMLOGIC
// -----------------------------------------------------------------------------

function parseLogicAction(stream) {
  if (stream.peek().type === 'string') return { kind: 'symbol', value: stream.next().value };
  const target = parseActionTarget(stream);
  const args = stream.is('(') ? parseCallArguments(stream) : [];
  return { kind: 'call', target: astPath(target).join('.'), args };
}

class JMLogicParser {
  parse(source) {
    const stream = new TokenStream(source);
    stream.expect('logic');
    const name = stream.identifier();
    const rules = [];
    stream.expect('{');
    while (!stream.is('}')) {
      if (stream.match('group')) {
        const group = stream.identifier();
        stream.expect('{');
        while (!stream.is('}')) rules.push(this.parseRule(stream, group));
        stream.expect('}');
      } else {
        rules.push(this.parseRule(stream, 'default'));
      }
      stream.skipSeparators();
    }
    stream.expect('}');
    return { kind: 'jmlogic-program', name, rules };
  }
  parseRule(stream, group) {
    stream.expect('rule');
    const name = stream.identifier();
    let priority = 0;
    if (stream.match('priority')) priority = stream.expectType('number').value;
    stream.expect('{');
    stream.expect('when');
    const condition = parseExpression(stream);
    stream.expect('then');
    const action = parseLogicAction(stream);
    stream.match(';');
    stream.expect('}');
    return { kind: 'rule', name, group, priority, condition, action };
  }
}

class JMLogicRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('jmlogic', host);
    this.program = program;
    this.rules = [...program.rules].sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name));
  }
  evaluate(context = {}, options = {}) {
    const scope = new Scope(context);
    const actions = [];
    const group = options.group ?? null;
    for (const rule of this.rules) {
      if (group && rule.group !== group) continue;
      const matched = Boolean(evaluateExpression(rule.condition, scope, this));
      this.trace.push('rule-check', { rule: rule.name, group: rule.group, matched, priority: rule.priority });
      if (!matched) continue;
      if (rule.action.kind === 'symbol') {
        actions.push(rule.action.value);
        this.trace.ding(rule.action.value, { rule: rule.name });
      } else {
        const args = rule.action.args.map((arg) => evaluateExpression(arg, scope, this));
        const value = this.host?.call(rule.action.target, args, context);
        actions.push({ target: rule.action.target, args, value });
      }
      if (options.first) break;
    }
    return actions;
  }
  run(input = {}) {
    return this.evaluate(input.context ?? input, input.options ?? {});
  }
}

// -----------------------------------------------------------------------------
// FLOWTALK
// -----------------------------------------------------------------------------

class FlowTalkParser {
  parse(source) {
    const stream = new TokenStream(source);
    const flows = [];
    while (!stream.eof()) {
      stream.expect('flow');
      const name = stream.identifier();
      const steps = [];
      stream.expect('{');
      while (!stream.is('}')) {
        stream.expect('step');
        const stepName = stream.identifier();
        const body = [];
        stream.expect('{');
        while (!stream.is('}')) {
          if (stream.match('if')) {
            const condition = parseExpression(stream);
            if (stream.match('goto')) {
              const target = stream.identifier();
              stream.match(';');
              body.push({ kind: 'if-goto', condition, target });
            } else {
              const then = parseStatementBlock(stream);
              let otherwise = [];
              if (stream.match('else')) otherwise = parseStatementBlock(stream);
              body.push({ kind: 'if', condition, then, otherwise });
            }
          } else {
            body.push(parseGenericStatement(stream, { return: false, phase: false }));
          }
          stream.skipSeparators();
        }
        stream.expect('}');
        steps.push({ name: stepName, body });
      }
      stream.expect('}');
      flows.push({ kind: 'flowtalk-flow', name, steps });
      stream.skipSeparators();
    }
    return { kind: 'flowtalk-program', flows };
  }
}

class FlowTalkRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('flowtalk', host);
    this.program = program;
    this.flows = new Map(program.flows.map((flow) => [flow.name, flow]));
  }
  runFlow(name, context = {}, options = {}) {
    const flow = this.flows.get(name);
    invariant(flow, `Unknown FlowTalk flow ${name}`);
    const steps = new Map(flow.steps.map((step) => [step.name, step]));
    let current = options.start ?? flow.steps[0]?.name;
    const scope = new Scope({ ...context });
    const visited = [];
    const maxSteps = options.maxSteps ?? 100;
    for (let count = 0; current && count < maxSteps; count += 1) {
      const step = steps.get(current);
      invariant(step, `Unknown FlowTalk step ${current}`);
      visited.push(current);
      this.trace.push('step', { flow: name, step: current });
      let next = null;
      for (const statement of step.body) {
        if (statement.kind === 'if-goto') {
          if (evaluateExpression(statement.condition, scope, this)) {
            next = statement.target;
            break;
          }
          continue;
        }
        const result = executeStatement(statement, scope, this, { route: `${name}.${current}` });
        if (result?.signal === 'goto') {
          next = result.target;
          break;
        }
        if (result?.signal === 'hold') {
          current = null;
          next = null;
          break;
        }
      }
      current = next;
      if (!next) break;
    }
    return { output: deepClone(this.outputs), variables: scope.toObject(), visited };
  }
  run(input = {}) {
    const name = input.flow ?? this.program.flows[0]?.name;
    return this.runFlow(name, input.context ?? {}, input.options ?? {});
  }
}

// -----------------------------------------------------------------------------
// ROUTE-CODE
// -----------------------------------------------------------------------------

class RouteCodeParser {
  parse(source) {
    const stream = new TokenStream(source);
    const routes = [];
    while (!stream.eof()) {
      stream.expect('route');
      const name = stream.identifier();
      const handlers = [];
      stream.expect('{');
      while (!stream.is('}')) {
        stream.expect('on');
        const event = stream.identifier();
        const params = stream.is('(') ? parseParameterList(stream) : [];
        const body = parseStatementBlock(stream);
        handlers.push({ event, params, body });
      }
      stream.expect('}');
      routes.push({ kind: 'route', name, handlers });
      stream.skipSeparators();
    }
    return { kind: 'routecode-program', routes };
  }
}

class RouteCodeRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('route-code', host);
    this.program = program;
    this.routes = new Map(program.routes.map((route) => [route.name, route]));
    this.state = {};
  }
  dispatch(routeName, eventName, args = [], context = {}) {
    const route = this.routes.get(routeName);
    invariant(route, `Unknown route ${routeName}`);
    const handler = route.handlers.find((candidate) => candidate.event === eventName);
    if (!handler) return null;
    const scope = new Scope({ ...this.state, ...context });
    handler.params.forEach((param, index) => scope.define(param.name, args[index]));
    const routeInstance = { status: 'running' };
    this.trace.push('route-enter', { route: routeName, event: eventName, args });
    const result = executeStatements(handler.body, scope, this, { route: routeName, routeInstance });
    this.state = { ...this.state, ...scope.toObject() };
    this.trace.push('route-exit', { route: routeName, event: eventName, status: routeInstance.status });
    return result?.value ?? this.state;
  }
  run(input = {}) {
    const route = input.route ?? this.program.routes[0]?.name;
    const event = input.event ?? 'start';
    return this.dispatch(route, event, input.args ?? [], input.context ?? {});
  }
  snapshot() {
    return { state: deepClone(this.state), outputs: deepClone(this.outputs) };
  }
}

// -----------------------------------------------------------------------------
// QUADZE
// -----------------------------------------------------------------------------

function parseFieldDeclarations(stream) {
  const fields = [];
  stream.expect('{');
  while (!stream.is('}')) {
    stream.expect('field');
    const name = stream.identifier();
    stream.expect(':');
    const type = parseType(stream);
    let initial = { kind: 'literal', value: null };
    if (stream.match('=')) initial = parseExpression(stream);
    stream.match(';');
    fields.push({ name, type, initial });
  }
  stream.expect('}');
  return fields;
}

class QuadzeParser {
  parse(source) {
    const stream = new TokenStream(source);
    stream.expect('game');
    const name = stream.identifier();
    const entities = [];
    const states = [];
    const routes = [];
    stream.expect('{');
    while (!stream.is('}')) {
      if (stream.match('entity')) {
        const entityName = stream.identifier();
        entities.push({ kind: 'entity', name: entityName, fields: parseFieldDeclarations(stream) });
      } else if (stream.match('state')) {
        const stateName = stream.identifier();
        states.push({ kind: 'state', name: stateName, fields: parseFieldDeclarations(stream) });
      } else if (stream.match('route')) {
        const routeName = stream.identifier();
        const handlers = [];
        stream.expect('{');
        while (!stream.is('}')) {
          stream.expect('on');
          const event = stream.identifier();
          const params = stream.is('(') ? parseParameterList(stream) : [];
          const body = parseStatementBlock(stream);
          handlers.push({ event, params, body });
        }
        stream.expect('}');
        routes.push({ kind: 'route', name: routeName, handlers });
      } else {
        throw new JMError(`Expected entity, state or route, found ${stream.peek().value}`, stream.peek(), 'PARSE');
      }
      stream.skipSeparators();
    }
    stream.expect('}');
    return { kind: 'quadze-program', name, entities, states, routes };
  }
}

class QuadzeRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('quadze', host);
    this.program = program;
    this.entities = new Map();
    this.states = new Map();
    this.routes = new Map();
    this.initialised = false;
    this.tickCount = 0;
  }
  resolveName(name) {
    if (this.entities.has(name)) return this.entities.get(name);
    if (this.states.has(name)) return this.states.get(name);
    return undefined;
  }
  init(context = {}) {
    if (this.initialised) return this;
    const rootScope = new Scope(context);
    for (const declaration of this.program.entities) {
      const instance = {};
      const local = new Scope({ ...context, ...Object.fromEntries(this.entities), ...Object.fromEntries(this.states) }, rootScope);
      for (const field of declaration.fields) instance[field.name] = evaluateExpression(field.initial, local, this);
      this.entities.set(declaration.name, instance);
      rootScope.define(declaration.name, instance);
    }
    for (const declaration of this.program.states) {
      const instance = {};
      const local = new Scope({ ...context, ...Object.fromEntries(this.entities), ...Object.fromEntries(this.states) }, rootScope);
      for (const field of declaration.fields) instance[field.name] = evaluateExpression(field.initial, local, this);
      this.states.set(declaration.name, instance);
      rootScope.define(declaration.name, instance);
    }
    for (const route of this.program.routes) this.routes.set(route.name, { route, status: 'running' });
    this.initialised = true;
    this.trace.push('init', { game: this.program.name, entities: [...this.entities.keys()], states: [...this.states.keys()] });
    for (const name of this.routes.keys()) this.dispatch(name, 'start', [], context);
    return this;
  }
  createScope(context = {}) {
    return new Scope({
      ...context,
      ...Object.fromEntries(this.entities.entries()),
      ...Object.fromEntries(this.states.entries()),
      tick: this.tickCount,
      q0: () => this.setPhase('Q0'),
      q1: () => this.setPhase('Q1'),
      q2: () => this.setPhase('Q2'),
      q3: () => this.setPhase('Q3'),
      z0: () => this.setPhase('Z0'),
    });
  }
  setPhase(value) {
    let state = this.states.get('GameState');
    if (!state) {
      state = { phase: value };
      this.states.set('GameState', state);
    }
    state.phase = value;
    this.trace.push('phase', { value });
    return value;
  }
  dispatch(routeName, eventName, args = [], context = {}) {
    if (!this.initialised && eventName !== 'start') this.init(context);
    const routeInstance = this.routes.get(routeName);
    invariant(routeInstance, `Unknown Quadze route ${routeName}`);
    if (routeInstance.status !== 'running' && eventName !== 'resume') return null;
    const handler = routeInstance.route.handlers.find((candidate) => candidate.event === eventName);
    if (!handler) return null;
    const scope = this.createScope(context);
    handler.params.forEach((param, index) => scope.define(param.name, args[index]));
    this.trace.push('route-enter', { route: routeName, event: eventName, args });
    const result = executeStatements(handler.body, scope, this, { route: routeName, routeInstance });
    this.trace.push('route-exit', { route: routeName, event: eventName, status: routeInstance.status });
    return result?.value ?? null;
  }
  tick(context = {}) {
    this.init(context);
    this.tickCount += 1;
    for (const [name, routeInstance] of this.routes.entries()) {
      if (routeInstance.status === 'running') this.dispatch(name, 'tick', [], context);
    }
    return this.snapshot();
  }
  resume(routeName = null) {
    if (routeName) {
      const route = this.routes.get(routeName);
      invariant(route, `Unknown Quadze route ${routeName}`);
      route.status = 'running';
    } else {
      for (const route of this.routes.values()) route.status = 'running';
    }
    this.held = false;
    this.trace.push('resume', { route: routeName ?? '*' });
  }
  run(input = {}) {
    this.init(input.context ?? {});
    const ticks = input.ticks ?? 1;
    for (let index = 0; index < ticks; index += 1) this.tick(input.context ?? {});
    if (input.event) this.dispatch(input.route ?? this.program.routes[0]?.name, input.event, input.args ?? [], input.context ?? {});
    return this.snapshot();
  }
  snapshot() {
    return {
      game: this.program.name,
      tick: this.tickCount,
      entities: deepClone(Object.fromEntries(this.entities.entries())),
      states: deepClone(Object.fromEntries(this.states.entries())),
      routes: Object.fromEntries([...this.routes.entries()].map(([name, route]) => [name, route.status])),
      outputs: deepClone(this.outputs),
    };
  }
}

// -----------------------------------------------------------------------------
// FORMULA-BORN CODE + GENERATIVE LAWS
// -----------------------------------------------------------------------------

class FormulaBornParser {
  parse(source) {
    const stream = new TokenStream(source);
    const formulas = [];
    while (!stream.eof()) {
      stream.expect('formula');
      const name = stream.identifier();
      const gates = [];
      stream.expect('{');
      while (!stream.is('}')) {
        stream.expect('gate');
        const gateName = stream.identifier();
        const glyphs = [];
        stream.expect('{');
        while (!stream.is('}')) {
          stream.expect('glyph');
          const glyphName = stream.identifier();
          const glyph = {
            name: glyphName,
            shape: 'point',
            tone: 'neutral',
            route: 'NeutralRoute',
            identity: 'unknown',
            symbol: `glyph-${glyphName}`,
            weight: 1,
            when: { kind: 'literal', value: true },
            payload: {},
          };
          stream.expect('{');
          while (!stream.is('}')) {
            const key = stream.identifier();
            if (key === 'when') {
              glyph.when = parseExpression(stream);
            } else {
              stream.expect(':');
              const expr = parseExpression(stream);
              if (key === 'payload') glyph.payload = expr;
              else glyph[key] = expr;
            }
            stream.match(';');
            stream.match(',');
          }
          stream.expect('}');
          glyphs.push(glyph);
        }
        stream.expect('}');
        gates.push({ name: gateName, glyphs });
      }
      stream.expect('}');
      formulas.push({ kind: 'formula', name, gates });
      stream.skipSeparators();
    }
    return { kind: 'formula-born-program', formulas };
  }
}

class GenerativeLaws {
  constructor({ identityLaw, routeLaw, symbolLaw, collapseLaw, traceLaw, evolutionLaw } = {}) {
    this.identityLaw = identityLaw ?? this.defaultIdentityLaw;
    this.routeLaw = routeLaw ?? this.defaultRouteLaw;
    this.symbolLaw = symbolLaw ?? this.defaultSymbolLaw;
    this.collapseLaw = collapseLaw ?? this.defaultCollapseLaw;
    this.traceLaw = traceLaw ?? this.defaultTraceLaw;
    this.evolutionLaw = evolutionLaw ?? this.defaultEvolutionLaw;
  }
  run({ formula, gate, matchedGlyphs, context, trace }) {
    const identity = this.identityLaw(context, formula, gate);
    const route = this.routeLaw(identity, gate, matchedGlyphs, context);
    const symbols = this.symbolLaw(route, matchedGlyphs, context);
    const collapse = this.collapseLaw(symbols, context, identity, route, trace);
    const generatedTrace = this.traceLaw(collapse, matchedGlyphs, trace);
    const evolvedIdentity = this.evolutionLaw(generatedTrace, identity, symbols, route);
    return {
      formula: formula.name,
      gate: gate.name,
      identity: evolvedIdentity,
      route,
      symbols,
      collapse,
      trace: generatedTrace,
      glyphs: matchedGlyphs.map((glyph) => deepClone(glyph)),
    };
  }
  defaultIdentityLaw(context) {
    return {
      actor: context.actor ?? context.identity ?? 'Player',
      state: context.state ?? 'unknown',
      phase: context.phase ?? context.GameState?.phase ?? null,
    };
  }
  defaultRouteLaw(identity, gate, glyphs) {
    const sorted = [...glyphs].sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));
    return sorted[0]?.route ?? `${gate.name}.NeutralRoute`;
  }
  defaultSymbolLaw(route, glyphs) {
    const symbols = new Set();
    if (route) symbols.add(`route:${route}`);
    for (const glyph of glyphs) {
      symbols.add(glyph.symbol ?? `glyph:${glyph.name}`);
      symbols.add(`glyph:${glyph.name}`);
      if (glyph.tone) symbols.add(`tone:${glyph.tone}`);
    }
    return [...symbols];
  }
  defaultCollapseLaw(symbols, context, identity, route, trace) {
    return {
      id: `collapse-${trace.sequence + 1}`,
      route,
      identity: deepClone(identity),
      symbols: deepClone(symbols),
      context: deepClone(context),
    };
  }
  defaultTraceLaw(collapse, glyphs, trace) {
    const event = trace.push('formula-collapse', {
      collapseId: collapse.id,
      route: collapse.route,
      symbols: collapse.symbols,
      glyphs: glyphs.map((glyph) => glyph.name),
    });
    return { events: [event], collapseId: collapse.id };
  }
  defaultEvolutionLaw(generatedTrace, identity, symbols, route) {
    const danger = symbols.some((symbol) => /danger|warn|low-health|tone:red/i.test(symbol));
    return {
      ...identity,
      state: danger ? 'danger' : identity.state,
      lastRoute: route,
      traceRef: generatedTrace.collapseId,
    };
  }
}

class FormulaBornHost extends BodyRuntime {
  constructor(program = { formulas: [] }, host = null, laws = new GenerativeLaws()) {
    super('formula-born-code', host);
    this.program = program;
    this.formulas = new Map();
    this.laws = laws;
    for (const formula of program.formulas ?? []) this.registerFormula(formula);
  }
  registerFormula(formula) {
    const compiled = deepClone(formula);
    for (const gate of compiled.gates) {
      for (const glyph of gate.glyphs) {
        for (const key of ['shape', 'tone', 'route', 'identity', 'symbol', 'weight', 'payload']) {
          if (glyph[key]?.kind) glyph[key] = evaluateExpression(glyph[key], new Scope(), this);
        }
      }
    }
    this.formulas.set(compiled.name, compiled);
    this.trace.push('formula-register', { formula: compiled.name, gates: compiled.gates.map((gate) => gate.name) });
    return compiled;
  }
  registerLaw(name, fn) {
    invariant(typeof fn === 'function', `Law ${name} must be callable`);
    const property = `${name}Law`;
    invariant(property in this.laws, `Unknown generative law ${name}`);
    this.laws[property] = fn;
    this.trace.push('law-register', { law: name });
  }
  generate(formulaName, gateName, context = {}) {
    const formula = this.formulas.get(formulaName);
    invariant(formula, `Unknown Formula-Born formula ${formulaName}`);
    const gate = formula.gates.find((candidate) => candidate.name === gateName);
    invariant(gate, `Unknown gate ${formulaName}.${gateName}`);
    const scope = new Scope(context);
    const matchedGlyphs = gate.glyphs
      .filter((glyph) => Boolean(evaluateExpression(glyph.when, scope, this)))
      .map((glyph) => deepClone(glyph));
    this.trace.push('gate-evaluate', { formula: formulaName, gate: gateName, matched: matchedGlyphs.map((glyph) => glyph.name) });
    const generated = this.laws.run({ formula, gate, matchedGlyphs, context, trace: this.trace });
    this.host?.fusion?.registerSymbolBatch(generated.symbols, { formula: formulaName, gate: gateName });
    for (const glyph of matchedGlyphs) this.host?.fusion?.registerGlyph(glyph.name, glyph);
    return generated;
  }
  run(input = {}) {
    const formula = input.formula ?? this.program.formulas[0]?.name;
    const gate = input.gate ?? this.program.formulas[0]?.gates[0]?.name;
    return this.generate(formula, gate, input.context ?? {});
  }
  snapshot() {
    return { formulas: [...this.formulas.keys()], outputs: deepClone(this.outputs) };
  }
}

// -----------------------------------------------------------------------------
// NONCODING-CODE
// -----------------------------------------------------------------------------

class NoncodingCodeParser {
  parse(source) {
    const stream = new TokenStream(source);
    stream.expect('noncode');
    const name = stream.identifier();
    const phrases = [];
    stream.expect('{');
    while (!stream.is('}')) {
      stream.expect('phrase');
      const phrase = stream.expectType('string').value;
      stream.expect('=>');
      const actionType = stream.identifier();
      const value = stream.peek().type === 'string' ? stream.next().value : stream.identifier();
      stream.match(';');
      phrases.push({ phrase, actionType, value });
    }
    stream.expect('}');
    return { kind: 'noncoding-program', name, phrases };
  }
}

class NoncodingCodeRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('noncoding-code', host);
    this.program = program;
  }
  interpret(text, context = {}) {
    const normal = String(text).trim().toLowerCase();
    const matches = this.program.phrases.filter((entry) => normal.includes(entry.phrase.toLowerCase()));
    const outputs = [];
    for (const match of matches) {
      const result = { type: match.actionType, value: match.value, phrase: match.phrase };
      outputs.push(result);
      this.trace.push('phrase-match', result);
      if (match.actionType === 'symbol') this.host?.fusion?.emitSymbol(match.value, context);
      if (match.actionType === 'route') this.host?.fusion?.runRoute(match.value, context, this.host);
      if (match.actionType === 'deliver') this.host?.delivery?.send('text', match.value, context);
    }
    return outputs;
  }
  run(input = {}) {
    return this.interpret(input.text ?? String(input), input.context ?? {});
  }
}

// -----------------------------------------------------------------------------
// CONTACTCODE
// -----------------------------------------------------------------------------

class ContactCodeParser {
  parse(source) {
    const stream = new TokenStream(source);
    stream.expect('contact');
    const name = stream.identifier();
    const rules = [];
    stream.expect('{');
    while (!stream.is('}')) {
      stream.expect('when');
      const left = stream.identifier();
      const relation = stream.identifier();
      const right = stream.identifier();
      const body = parseStatementBlock(stream, { set: true, return: false, goto: false, say: false, phase: false });
      rules.push({ left, relation, right, body });
    }
    stream.expect('}');
    return { kind: 'contactcode-program', name, rules };
  }
}

class ContactCodeRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('contactcode', host);
    this.program = program;
  }
  contact(left, right, context = {}, relation = 'touches') {
    const scope = new Scope({ ...context, left, right, relation });
    const matched = [];
    for (const rule of this.program.rules) {
      const direct = rule.left === left && rule.right === right;
      const reverse = rule.left === right && rule.right === left;
      if (rule.relation === relation && (direct || reverse)) {
        executeStatements(rule.body, scope, this, { route: `${left}:${relation}:${right}` });
        matched.push(rule);
        this.trace.push('contact-match', { left, right, relation, rule: `${rule.left}-${rule.right}` });
      }
    }
    return { matched: matched.length, outputs: deepClone(this.outputs), context: scope.toObject() };
  }
  run(input = {}) {
    return this.contact(input.left, input.right, input.context ?? {}, input.relation ?? 'touches');
  }
}

// -----------------------------------------------------------------------------
// MORSEMINUS
// -----------------------------------------------------------------------------

const STANDARD_MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---',
  K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-',
  U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};

class MorseMinusParser {
  parse(source) {
    const stream = new TokenStream(source);
    stream.expect('morse');
    const name = stream.identifier();
    const map = {};
    let letterSeparator = ' ';
    let wordSeparator = '/';
    stream.expect('{');
    while (!stream.is('}')) {
      if (stream.match('map')) {
        const code = stream.expectType('string').value;
        stream.expect('=');
        const letter = stream.expectType('string').value.toUpperCase();
        map[letter] = code;
      } else if (stream.match('letter-separator')) {
        stream.expect('=');
        letterSeparator = stream.expectType('string').value;
      } else if (stream.match('word-separator')) {
        stream.expect('=');
        wordSeparator = stream.expectType('string').value;
      } else {
        throw new JMError(`Unknown MorseMinus declaration ${stream.peek().value}`, stream.peek(), 'PARSE');
      }
      stream.match(';');
    }
    stream.expect('}');
    return { kind: 'morseminus-program', name, map: { ...STANDARD_MORSE, ...map }, letterSeparator, wordSeparator };
  }
}

class MorseMinusRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('morseminus', host);
    this.program = program;
    this.reverse = Object.fromEntries(Object.entries(program.map).map(([letter, code]) => [code, letter]));
  }
  encode(text) {
    const output = String(text).toUpperCase().split(/\s+/).map((word) =>
      [...word].map((letter) => this.program.map[letter] ?? '?').join(this.program.letterSeparator)
    ).join(this.program.wordSeparator);
    this.trace.push('encode', { input: text, output });
    return output;
  }
  decode(code) {
    const output = String(code).split(this.program.wordSeparator).map((word) =>
      word.split(this.program.letterSeparator).filter(Boolean).map((part) => this.reverse[part] ?? '?').join('')
    ).join(' ');
    this.trace.push('decode', { input: code, output });
    return output;
  }
  run(input = {}) {
    return input.mode === 'decode' ? this.decode(input.value ?? '') : this.encode(input.value ?? '');
  }
}

// -----------------------------------------------------------------------------
// MUDRA CODE
// -----------------------------------------------------------------------------

class MudraCodeParser {
  parse(source) {
    const stream = new TokenStream(source);
    stream.expect('mudra');
    const name = stream.identifier();
    const gestures = [];
    stream.expect('{');
    while (!stream.is('}')) {
      stream.expect('gesture');
      const gesture = stream.expectType('string').value;
      stream.expect('=>');
      const actionType = stream.identifier();
      const value = stream.peek().type === 'string' ? stream.next().value : stream.identifier();
      stream.match(';');
      gestures.push({ gesture, actionType, value });
    }
    stream.expect('}');
    return { kind: 'mudra-program', name, gestures };
  }
}

class MudraCodeRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('mudra-code', host);
    this.program = program;
  }
  perform(gesture, context = {}) {
    const action = this.program.gestures.find((entry) => normaliseName(entry.gesture) === normaliseName(gesture));
    if (!action) return null;
    this.trace.push('gesture', { gesture, actionType: action.actionType, value: action.value });
    if (action.actionType === 'symbol') this.host?.fusion?.emitSymbol(action.value, context);
    if (action.actionType === 'route') this.host?.fusion?.runRoute(action.value, context, this.host);
    if (action.actionType === 'deliver') this.host?.delivery?.send('gesture', action.value, context);
    return deepClone(action);
  }
  run(input = {}) {
    return this.perform(input.gesture ?? String(input), input.context ?? {});
  }
}

// -----------------------------------------------------------------------------
// JICKMA
// -----------------------------------------------------------------------------

class JickMaParser {
  parse(source) {
    const stream = new TokenStream(source);
    stream.expect('jickma');
    const name = stream.identifier();
    const marks = [];
    const sequences = [];
    stream.expect('{');
    while (!stream.is('}')) {
      const kind = stream.identifier();
      invariant(kind === 'mark' || kind === 'sequence', `Expected mark or sequence, found ${kind}`);
      const pattern = stream.expectType('string').value;
      stream.expect('=>');
      const actionType = stream.identifier();
      const value = stream.peek().type === 'string' ? stream.next().value : stream.identifier();
      stream.match(';');
      (kind === 'mark' ? marks : sequences).push({ pattern, actionType, value });
    }
    stream.expect('}');
    return { kind: 'jickma-program', name, marks, sequences };
  }
}

class JickMaRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('jickma', host);
    this.program = program;
  }
  read(input, context = {}) {
    const text = Array.isArray(input) ? input.join(' ') : String(input);
    const exactSequence = this.program.sequences.find((entry) => entry.pattern === text);
    const actions = [];
    if (exactSequence) actions.push(exactSequence);
    for (const mark of this.program.marks) {
      if (text.split(/\s+/).includes(mark.pattern)) actions.push(mark);
    }
    for (const action of actions) {
      this.trace.push('mark-action', { pattern: action.pattern, actionType: action.actionType, value: action.value });
      if (action.actionType === 'symbol') this.host?.fusion?.emitSymbol(action.value, context);
      if (action.actionType === 'route') this.host?.fusion?.runRoute(action.value, context, this.host);
    }
    return deepClone(actions);
  }
  run(input = {}) {
    return this.read(input.input ?? input.value ?? input, input.context ?? {});
  }
}

// -----------------------------------------------------------------------------
// VIRTUAL MACHINES
// -----------------------------------------------------------------------------

function parseAssemblyValue(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return JSON.parse(trimmed.startsWith("'") ? `"${trimmed.slice(1, -1).replace(/"/g, '\\"')}"` : trimmed);
  }
  return trimmed;
}

class AssemblyParser {
  constructor(bodyId = 'vm') {
    this.bodyId = bodyId;
  }
  parse(source) {
    const lines = String(source).split(/\r?\n/);
    const code = [];
    const labels = new Map();
    for (let index = 0; index < lines.length; index += 1) {
      const stripped = lines[index].replace(/\/\/.*$/, '').replace(/#.*$/, '').trim();
      if (!stripped) continue;
      if (/^[A-Za-z_$][\w$-]*:$/.test(stripped)) {
        labels.set(stripped.slice(0, -1), code.length);
        continue;
      }
      const match = stripped.match(/^([^\s]+)(?:\s+(.*))?$/);
      const op = match[1].toUpperCase();
      const rawArgs = match[2] ?? '';
      const args = [];
      let current = '';
      let quote = null;
      for (let i = 0; i < rawArgs.length; i += 1) {
        const ch = rawArgs[i];
        if (quote) {
          current += ch;
          if (ch === quote && rawArgs[i - 1] !== '\\') quote = null;
        } else if (ch === '"' || ch === "'") {
          quote = ch;
          current += ch;
        } else if (/\s|,/.test(ch)) {
          if (current.trim()) {
            args.push(parseAssemblyValue(current.trim()));
            current = '';
          }
        } else {
          current += ch;
        }
      }
      if (current.trim()) args.push(parseAssemblyValue(current.trim()));
      code.push({ op, args, line: index + 1, raw: stripped });
    }
    for (const instruction of code) {
      if (['JMP', 'JZ', 'JNZ', 'CALL'].includes(instruction.op) && typeof instruction.args[0] === 'string') {
        const label = instruction.args[0];
        invariant(labels.has(label), `Unknown VM label ${label}`);
        instruction.args[0] = labels.get(label);
      }
    }
    return { kind: `${this.bodyId}-assembly`, code, labels: Object.fromEntries(labels.entries()) };
  }
}

class StackVM extends BodyRuntime {
  constructor(bodyId, program, host = null) {
    super(bodyId, host);
    this.program = program;
    this.code = program.code ?? [];
    this.ip = 0;
    this.stack = [];
    this.locals = new Map();
    this.callStack = [];
    this.halted = false;
  }
  push(value) { this.stack.push(value); return value; }
  pop() {
    invariant(this.stack.length > 0, `${this.bodyId} stack underflow`);
    return this.stack.pop();
  }
  binary(fn) {
    const right = this.pop();
    const left = this.pop();
    this.push(fn(left, right));
  }
  step() {
    if (this.halted || this.ip < 0 || this.ip >= this.code.length) {
      this.halted = true;
      return null;
    }
    const instruction = this.code[this.ip];
    const [a, b] = instruction.args;
    this.trace.push('instruction', { ip: this.ip, op: instruction.op, args: instruction.args, stackDepth: this.stack.length });
    this.ip += 1;
    switch (instruction.op) {
      case 'PUSH': this.push(a); break;
      case 'LOAD': this.push(this.locals.get(a)); break;
      case 'STORE': this.locals.set(a, this.pop()); break;
      case 'SET': this.locals.set(a, b); break;
      case 'POP': this.pop(); break;
      case 'DUP': this.push(this.stack.at(-1)); break;
      case 'ADD': this.binary((x, y) => x + y); break;
      case 'SUB': this.binary((x, y) => x - y); break;
      case 'MUL': this.binary((x, y) => x * y); break;
      case 'DIV': this.binary((x, y) => x / y); break;
      case 'MOD': this.binary((x, y) => x % y); break;
      case 'EQ': this.binary((x, y) => x === y); break;
      case 'NE': this.binary((x, y) => x !== y); break;
      case 'LT': this.binary((x, y) => x < y); break;
      case 'LE': this.binary((x, y) => x <= y); break;
      case 'GT': this.binary((x, y) => x > y); break;
      case 'GE': this.binary((x, y) => x >= y); break;
      case 'AND': this.binary((x, y) => Boolean(x) && Boolean(y)); break;
      case 'OR': this.binary((x, y) => Boolean(x) || Boolean(y)); break;
      case 'NOT': this.push(!this.pop()); break;
      case 'JMP': this.ip = a; break;
      case 'JZ': if (!this.pop()) this.ip = a; break;
      case 'JNZ': if (this.pop()) this.ip = a; break;
      case 'CALL': this.callStack.push(this.ip); this.ip = a; break;
      case 'RET': this.ip = this.callStack.length ? this.callStack.pop() : this.code.length; break;
      case 'EMIT': {
        const value = a ?? this.pop();
        this.outputs.push({ channel: 'symbol', value });
        this.trace.push('emit', { value });
        break;
      }
      case 'DING': this.trace.ding(String(a ?? this.pop())); break;
      case 'HOLD': this.held = true; this.trace.hold(this.bodyId); break;
      case 'RESUME': this.held = false; this.trace.push('resume', {}); break;
      case 'COLLAPSE': this.trace.collapse(this.snapshot(), String(a ?? 'vm')); break;
      case 'SYMBOL': this.trace.symbolise(String(a), b ?? this.stack.at(-1)); break;
      case 'DELIVER': {
        const value = b ?? this.pop();
        this.host?.delivery?.send(String(a ?? 'text'), value, { body: this.bodyId });
        this.outputs.push({ channel: String(a ?? 'text'), value });
        break;
      }
      case 'BODYCALL': {
        const value = this.host?.call(String(a), Array.isArray(b) ? b : [], Object.fromEntries(this.locals));
        this.push(value);
        break;
      }
      case 'HALT': this.halted = true; break;
      default: throw new JMError(`Unknown VM opcode ${instruction.op}`, { line: instruction.line, col: 1 }, 'VM');
    }
    return instruction;
  }
  run(input = {}) {
    this.ip = input.ip ?? 0;
    if (input.locals) this.locals = new Map(Object.entries(input.locals));
    const maxSteps = input.maxSteps ?? 10000;
    let steps = 0;
    while (!this.halted && !this.held && this.ip < this.code.length && steps < maxSteps) {
      this.step();
      steps += 1;
    }
    invariant(steps < maxSteps || this.halted || this.held, `${this.bodyId} exceeded maxSteps`);
    return {
      top: this.stack.at(-1),
      stack: deepClone(this.stack),
      locals: Object.fromEntries(this.locals.entries()),
      halted: this.halted,
      held: this.held,
      steps,
      outputs: deepClone(this.outputs),
    };
  }
  snapshot() {
    return {
      ip: this.ip,
      stack: deepClone(this.stack),
      locals: Object.fromEntries(this.locals.entries()),
      callStack: deepClone(this.callStack),
      halted: this.halted,
      held: this.held,
    };
  }
}

class RouteVMParser {
  parse(source) {
    const stream = new TokenStream(source);
    stream.expect('routevm');
    const name = stream.identifier();
    const routes = [];
    stream.expect('{');
    while (!stream.is('}')) {
      stream.expect('route');
      const routeName = stream.identifier();
      stream.expect('{');
      let raw = '';
      let depth = 1;
      while (depth > 0) {
        const token = stream.next();
        if (token.value === '{') depth += 1;
        if (token.value === '}') depth -= 1;
        if (depth > 0) {
          if (token.type === 'string') raw += ` ${JSON.stringify(token.value)}`;
          else raw += ` ${token.value}`;
          if (token.value === ';') raw += '\n';
        }
      }
      const assembly = new AssemblyParser('routevm').parse(raw.replace(/;/g, '\n'));
      routes.push({ name: routeName, program: assembly });
    }
    stream.expect('}');
    return { kind: 'routevm-program', name, routes };
  }
}

class RouteVMRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('routevm', host);
    this.program = program;
    this.routes = new Map(program.routes.map((route) => [route.name, route.program]));
  }
  runRoute(name, input = {}) {
    const program = this.routes.get(name);
    invariant(program, `Unknown RouteVM route ${name}`);
    const vm = new StackVM('routevm', program, this.host);
    const result = vm.run(input);
    this.outputs.push(...vm.outputs);
    for (const event of vm.trace.events) this.trace.push(`child:${event.type}`, event);
    return result;
  }
  run(input = {}) {
    return this.runRoute(input.route ?? this.program.routes[0]?.name, input);
  }
}

// -----------------------------------------------------------------------------
// DELIVERY, FUSION, REGISTRIES AND INFRASTRUCTURE
// -----------------------------------------------------------------------------

class OneBodyDeliveryRuntime extends BodyRuntime {
  constructor(config = { channels: ['text', 'symbol', 'event'] }, host = null) {
    super('onebody-delivery', host);
    this.config = config;
    this.channels = new Map();
    for (const channel of config.channels ?? ['text', 'symbol', 'event']) this.channels.set(channel, []);
  }
  send(channel, value, meta = {}) {
    if (!this.channels.has(channel)) this.channels.set(channel, []);
    const packet = { seq: this.trace.sequence + 1, channel, value: deepClone(value), meta: deepClone(meta) };
    this.channels.get(channel).push(packet);
    this.outputs.push(packet);
    this.trace.push('send', packet);
    return packet;
  }
  drain(channel = null) {
    if (channel) {
      const packets = this.channels.get(channel) ?? [];
      this.channels.set(channel, []);
      return packets;
    }
    const all = deepClone(this.outputs);
    this.outputs = [];
    for (const key of this.channels.keys()) this.channels.set(key, []);
    return all;
  }
  run(input = {}) {
    return this.send(input.channel ?? 'text', input.value, input.meta ?? {});
  }
  snapshot() {
    return { channels: Object.fromEntries([...this.channels.entries()].map(([key, value]) => [key, deepClone(value)])) };
  }
}

class FusionRegistry {
  constructor(clock = new DeterministicClock()) {
    this.clock = clock;
    this.routes = new Map();
    this.symbols = new Map();
    this.glyphs = new Map();
    this.identities = new Map();
    this.trace = new TraceBox('fusion', clock);
  }
  registerRoute(name, body, target, options = {}) {
    if (!this.routes.has(name)) this.routes.set(name, []);
    this.routes.get(name).push({ body, target, order: options.order ?? this.routes.get(name).length, required: options.required !== false });
    this.routes.get(name).sort((a, b) => a.order - b.order);
    this.trace.push('route-register', { name, body, target });
  }
  runRoute(name, context = {}, host) {
    const hops = this.routes.get(name) ?? [];
    const receipt = { route: name, context: deepClone(context), hops: [], status: 'PASS' };
    for (const hop of hops) {
      try {
        const value = host.call(`${hop.body}.${hop.target}`, [], context);
        receipt.hops.push({ ...hop, status: 'PASS', value: deepClone(value) });
      } catch (error) {
        receipt.hops.push({ ...hop, status: 'FAIL', error: error.message });
        if (hop.required) {
          receipt.status = 'HOLD';
          break;
        }
      }
    }
    this.trace.push('route-run', receipt);
    return receipt;
  }
  registerSymbol(name, payload = {}) {
    this.symbols.set(name, deepClone(payload));
    this.trace.push('symbol-register', { name, payload });
  }
  registerSymbolBatch(names, payload = {}) {
    for (const name of names) this.registerSymbol(name, payload);
  }
  emitSymbol(name, payload = {}) {
    this.registerSymbol(name, payload);
    this.trace.ding(name, payload);
    return { name, payload: deepClone(payload) };
  }
  registerGlyph(name, glyph) {
    this.glyphs.set(name, deepClone(glyph));
    this.trace.push('glyph-register', { name, glyph });
  }
  bindIdentity(name, identity) {
    this.identities.set(name, deepClone(identity));
    this.trace.push('identity-bind', { name, identity });
  }
  validateContinuity() {
    const holds = [];
    for (const [name, hops] of this.routes.entries()) {
      if (!hops.length) holds.push(`Fusion route ${name} has no hops`);
    }
    return { status: holds.length ? 'HOLD' : 'PASS', holds };
  }
}

class SimpleDeclarationParser {
  constructor(keyword) {
    this.keyword = keyword;
  }
  parse(source) {
    const stream = new TokenStream(source);
    stream.expect(this.keyword);
    const name = stream.identifier();
    const commands = [];
    stream.expect('{');
    while (!stream.is('}')) {
      const command = stream.identifier();
      const args = [];
      while (!stream.is(';') && !stream.is('}')) {
        if (stream.match(',')) continue;
        const token = stream.next();
        args.push(token.value);
      }
      stream.match(';');
      commands.push({ command, args });
    }
    stream.expect('}');
    return { kind: `${this.keyword}-program`, name, commands };
  }
}

class RegistryRuntime extends BodyRuntime {
  constructor(bodyId, program, host = null) {
    super(bodyId, host);
    this.program = program;
    this.registry = new Map();
    this.routes = new Map();
    this.metadata = {};
    this.apply(program.commands ?? []);
  }
  apply(commands) {
    for (const entry of commands) {
      const [first, ...rest] = entry.args;
      switch (entry.command) {
        case 'mount':
        case 'body':
        case 'language':
        case 'room':
        case 'channel':
        case 'bridge':
          this.registry.set(String(first), rest.length <= 1 ? rest[0] ?? true : rest);
          break;
        case 'route':
          this.routes.set(String(first), rest.map(String).join('').replace(/\.{2,}/g, '.'));
          break;
        case 'priority':
        case 'version':
        case 'capability':
        case 'field':
          this.metadata[entry.command] ??= [];
          this.metadata[entry.command].push(entry.args);
          break;
        default:
          this.metadata[entry.command] ??= [];
          this.metadata[entry.command].push(entry.args);
      }
      this.trace.push('config', entry);
    }
  }
  register(name, value = true) {
    this.registry.set(name, value);
    this.trace.push('register', { name, value });
    return value;
  }
  get(name) { return this.registry.get(name); }
  list() { return [...this.registry.entries()].map(([name, value]) => ({ name, value })); }
  run(input = {}) {
    if (input.action === 'register') return this.register(input.name, input.value);
    if (input.action === 'get') return this.get(input.name);
    if (input.action === 'route') return this.routes.get(input.name);
    return { registry: this.list(), routes: Object.fromEntries(this.routes), metadata: deepClone(this.metadata) };
  }
  snapshot() {
    return { registry: Object.fromEntries(this.registry), routes: Object.fromEntries(this.routes), metadata: deepClone(this.metadata) };
  }
}

class RouteClassifierRuntime extends RegistryRuntime {
  constructor(program, host = null) {
    super('route-classifier', program, host);
  }
  classify(route) {
    const name = typeof route === 'string' ? route : route?.event ?? route?.name ?? '';
    let type = 'custom';
    if (/^start|init$/i.test(name)) type = 'start';
    else if (/^tick|update|frame$/i.test(name)) type = 'tick';
    else if (/ding|symbol|emit/i.test(name)) type = 'symbol';
    else if (/collapse|snapshot/i.test(name)) type = 'collapse';
    this.trace.push('classify', { route: name, type });
    return type;
  }
  run(input = {}) {
    return input.route ? this.classify(input.route) : super.run(input);
  }
}

class ReceiptShapeRuntime extends RegistryRuntime {
  constructor(program, host = null) {
    super('receipt-shape', program, host);
    this.receipts = [];
  }
  capture(receipt) {
    const normalized = {
      id: `receipt-${this.receipts.length + 1}`,
      status: receipt.status ?? 'PASS',
      body: receipt.body ?? 'unknown',
      trace: deepClone(receipt.trace ?? []),
      payload: deepClone(receipt.payload ?? receipt),
    };
    this.receipts.push(normalized);
    this.trace.push('receipt-capture', { id: normalized.id, status: normalized.status, body: normalized.body });
    return normalized;
  }
  run(input = {}) {
    return input.receipt ? this.capture(input.receipt) : deepClone(this.receipts);
  }
}

class PolyBridgeRuntime extends RegistryRuntime {
  constructor(program, host = null) {
    super('polybridge-stack', program, host);
    this.adapters = new Map();
  }
  registerAdapter(from, to, fn) {
    this.adapters.set(`${from}->${to}`, fn);
    this.trace.push('adapter-register', { from, to });
  }
  translate(from, to, value) {
    if (from === to) return deepClone(value);
    const adapter = this.adapters.get(`${from}->${to}`);
    invariant(adapter, `No bridge adapter ${from}->${to}`);
    const output = adapter(deepClone(value));
    this.trace.push('translate', { from, to });
    return output;
  }
  run(input = {}) {
    return input.from && input.to ? this.translate(input.from, input.to, input.value) : super.run(input);
  }
}

class PolyglotRouteSpineRuntime extends RegistryRuntime {
  constructor(program, host = null) {
    super('polyglot-route-spine', program, host);
  }
  dispatch(name, context = {}) {
    const target = this.routes.get(name);
    invariant(target, `Unknown polyglot route ${name}`);
    const value = this.host?.call(target, [], context);
    this.trace.push('dispatch', { name, target });
    return value;
  }
  run(input = {}) {
    return input.route ? this.dispatch(input.route, input.context ?? {}) : super.run(input);
  }
}

class CompilerRoomsRuntime extends RegistryRuntime {
  constructor(program, host = null) {
    super('runtime-compiler-rooms', program, host);
    this.pipeline = [];
  }
  addRoom(name, fn) {
    this.pipeline.push({ name, fn });
    this.trace.push('room-add', { name });
  }
  process(value, context = {}) {
    let current = value;
    for (const room of this.pipeline) {
      current = room.fn(current, context);
      this.trace.push('room-pass', { room: room.name });
    }
    return current;
  }
  run(input = {}) {
    return this.pipeline.length ? this.process(input.value, input.context ?? {}) : super.run(input);
  }
}

class OneBodyRuntime extends RegistryRuntime {
  constructor(program, host = null) {
    super('onebody-runtime', program, host);
  }
  execute(target, args = [], context = {}) {
    const value = this.host?.call(target, args, context);
    this.trace.push('execute', { target, args, value });
    return value;
  }
  run(input = {}) {
    return input.target ? this.execute(input.target, input.args ?? [], input.context ?? {}) : super.run(input);
  }
}

class RouteCoreRuntime extends RegistryRuntime {
  constructor(program, host = null) {
    super('routecore', program, host);
  }
  bind(name, target) {
    this.routes.set(name, target);
    this.trace.push('route-bind', { name, target });
  }
  travel(name, context = {}) {
    const target = this.routes.get(name);
    invariant(target, `Unknown RouteCore route ${name}`);
    const value = this.host?.call(target, [], context);
    this.trace.push('travel', { name, target });
    return value;
  }
  run(input = {}) {
    return input.route ? this.travel(input.route, input.context ?? {}) : super.run(input);
  }
}

class JMToolchainRuntime extends BodyRuntime {
  constructor(program, host = null) {
    super('jm-toolchain', host);
    this.program = program;
  }
  build(bodyId, source, input = {}) {
    invariant(this.host, 'JM Toolchain requires an EstateHost');
    const body = this.host.getBody(bodyId);
    const ast = body.parse(source);
    const ir = body.compile(ast);
    const runtime = body.createRuntime(ir, this.host);
    this.host.mountRuntime(bodyId, runtime);
    const value = runtime.run ? runtime.run(input) : runtime.init?.(input);
    const receipt = runtime.receipt?.({ parser: 'PASS', ir: 'PASS', runtime: 'PASS' });
    this.trace.push('build', { body: body.id, status: receipt?.status ?? 'PASS' });
    return { ast, ir, runtime, value, receipt };
  }
  run(input = {}) {
    if (!input.body || !input.source) {
      return { name: this.program.name, pipeline: (this.program.commands ?? []).map((entry) => entry.args[0] ?? entry.command) };
    }
    return this.build(input.body, input.source, input.input ?? {});
  }
}

function createCapabilities(overrides = {}) {
  return Object.entries({
    parse: true,
    compile: true,
    execute: true,
    route: true,
    symbolise: true,
    collapse: true,
    trace: true,
    deliver: true,
    glyph: true,
    formulaBorn: true,
    fusion: true,
    ...overrides,
  }).filter(([, enabled]) => enabled).map(([name]) => `can-${name}`);
}

const BODY_DEFINITIONS = [
  new CodingBody({
    id: 'cading', name: 'Cading', kind: 'language', parser: new CadingParser(),
    runtimeFactory: (program, host) => new CadingRuntime(program, host),
    capabilities: createCapabilities(), description: 'General route-language with functions, state, trace, collapse and cross-body calls.',
  }),
  new CodingBody({
    id: 'kading', name: 'Kading', kind: 'mapping-language', parser: new KadingParser(),
    runtimeFactory: (program, host) => new KadingRuntime(program, host),
    capabilities: createCapabilities(), description: 'Source-to-target flow mapper with conditional transforms.',
  }),
  new CodingBody({
    id: 'jmlogic', name: 'JMLogic', kind: 'logic-language', parser: new JMLogicParser(),
    runtimeFactory: (program, host) => new JMLogicRuntime(program, host),
    capabilities: createCapabilities(), description: 'Priority rule and action engine.',
  }),
  new CodingBody({
    id: 'flowtalk', name: 'FlowTalk', kind: 'conversation-language', parser: new FlowTalkParser(),
    runtimeFactory: (program, host) => new FlowTalkRuntime(program, host),
    capabilities: createCapabilities(), description: 'Step, speech, branch and route conversation runtime.',
  }),
  new CodingBody({
    id: 'route-code', name: 'Route-Code', kind: 'route-language', parser: new RouteCodeParser(),
    runtimeFactory: (program, host) => new RouteCodeRuntime(program, host),
    capabilities: createCapabilities(), description: 'Event route language with parameters and state change.',
  }),
  new CodingBody({
    id: 'cadenvm', name: 'CadenVM', kind: 'virtual-machine', parser: new AssemblyParser('cadenvm'),
    runtimeFactory: (program, host) => new StackVM('cadenvm', program, host),
    capabilities: createCapabilities({ glyph: true }), description: 'Deterministic stack VM with calls, routes, trace, collapse and delivery opcodes.',
  }),
  new CodingBody({
    id: 'routevm', name: 'RouteVM', kind: 'event-virtual-machine', parser: new RouteVMParser(),
    runtimeFactory: (program, host) => new RouteVMRuntime(program, host),
    capabilities: createCapabilities({ glyph: true }), description: 'Named-route virtual machine.',
  }),
  new CodingBody({
    id: 'onebody-delivery', name: 'OneBody Delivery', kind: 'delivery-engine', parser: new SimpleDeclarationParser('delivery'),
    runtimeFactory: (program, host) => new OneBodyDeliveryRuntime({ ...program, channels: program.commands.filter((item) => item.command === 'channel').map((item) => String(item.args[0])) }, host),
    capabilities: createCapabilities(), description: 'Multi-channel delivery packets and trace receipts.',
  }),
  new CodingBody({
    id: 'jmvm', name: 'JMVM', kind: 'virtual-machine', parser: new AssemblyParser('jmvm'),
    runtimeFactory: (program, host) => new StackVM('jmvm', program, host),
    capabilities: createCapabilities({ glyph: true }), description: 'JM IR execution VM.',
  }),
  new CodingBody({
    id: 'jm-toolchain', name: 'JM Toolchain', kind: 'toolchain', parser: new SimpleDeclarationParser('toolchain'),
    runtimeFactory: (program, host) => new JMToolchainRuntime(program, host),
    capabilities: createCapabilities(), description: 'Source → parser → AST/IR → runtime → receipt pipeline.',
  }),
  new CodingBody({
    id: 'multihub', name: 'MultiHub', kind: 'registry-router', parser: new SimpleDeclarationParser('hub'),
    runtimeFactory: (program, host) => new RegistryRuntime('multihub', program, host),
    capabilities: createCapabilities(), description: 'Body and route hub registry.',
  }),
  new CodingBody({
    id: 'body-house', name: 'Body House', kind: 'body-registry', parser: new SimpleDeclarationParser('bodyhouse'),
    runtimeFactory: (program, host) => new RegistryRuntime('body-house', program, host),
    capabilities: createCapabilities(), description: 'Body metadata and capability house.',
  }),
  new CodingBody({
    id: 'route-classifier', name: 'Route Classifier', kind: 'classifier', parser: new SimpleDeclarationParser('classifier'),
    runtimeFactory: (program, host) => new RouteClassifierRuntime(program, host),
    capabilities: createCapabilities(), description: 'Route/event/symbol/collapse classifier.',
  }),
  new CodingBody({
    id: 'receipt-shape', name: 'Receipt Shape', kind: 'receipt-engine', parser: new SimpleDeclarationParser('receipt'),
    runtimeFactory: (program, host) => new ReceiptShapeRuntime(program, host),
    capabilities: createCapabilities(), description: 'Normalized trace and proof receipt body.',
  }),
  new CodingBody({
    id: 'polybridge-stack', name: 'PolyBridge Stack', kind: 'bridge-engine', parser: new SimpleDeclarationParser('polybridge'),
    runtimeFactory: (program, host) => new PolyBridgeRuntime(program, host),
    capabilities: createCapabilities(), description: 'Cross-body IR and value adapter stack.',
  }),
  new CodingBody({
    id: 'polyglot-route-spine', name: 'Polyglot Route Spine', kind: 'polyglot-router', parser: new SimpleDeclarationParser('spine'),
    runtimeFactory: (program, host) => new PolyglotRouteSpineRuntime(program, host),
    capabilities: createCapabilities(), description: 'Cross-language route backbone.',
  }),
  new CodingBody({
    id: 'jm-codehouse', name: 'JM CodeHouse', kind: 'code-registry', parser: new SimpleDeclarationParser('codehouse'),
    runtimeFactory: (program, host) => new RegistryRuntime('jm-codehouse', program, host),
    capabilities: createCapabilities(), description: 'Code body, version and capability registry.',
  }),
  new CodingBody({
    id: 'runtime-compiler-rooms', name: 'Runtime Compiler Rooms', kind: 'compiler-pipeline', parser: new SimpleDeclarationParser('compilerrooms'),
    runtimeFactory: (program, host) => new CompilerRoomsRuntime(program, host),
    capabilities: createCapabilities(), description: 'Named parse, compile, optimize and execute rooms.',
  }),
  new CodingBody({
    id: 'quadze', name: 'Quadze', kind: 'game-language', version: '1.1-jm-real', parser: new QuadzeParser(),
    runtimeFactory: (program, host) => new QuadzeRuntime(program, host),
    capabilities: createCapabilities({ glyph: true, formulaBorn: true }), description: 'Game language with entities, state, routes, phases Q0–Q3/Z0, ding, hold, collapse and symbolise.',
  }),
  new CodingBody({
    id: 'formula-born-code', name: 'Formula-Born Code', kind: 'generative-language', parser: new FormulaBornParser(),
    runtimeFactory: (program, host) => new FormulaBornHost(program, host),
    capabilities: createCapabilities({ glyph: true, formulaBorn: true }), description: 'Gate, glyph, identity, route, symbol, collapse and trace generative engine.',
  }),
  new CodingBody({
    id: 'noncoding-code', name: 'Noncoding-Code', kind: 'phrase-language', parser: new NoncodingCodeParser(),
    runtimeFactory: (program, host) => new NoncodingCodeRuntime(program, host),
    capabilities: createCapabilities(), description: 'Human phrase to symbol/route/delivery interpreter.',
  }),
  new CodingBody({
    id: 'contactcode', name: 'ContactCode', kind: 'interaction-language', parser: new ContactCodeParser(),
    runtimeFactory: (program, host) => new ContactCodeRuntime(program, host),
    capabilities: createCapabilities(), description: 'Contact-field interaction rule engine.',
  }),
  new CodingBody({
    id: 'morseminus', name: 'MorseMinus', kind: 'signal-language', parser: new MorseMinusParser(),
    runtimeFactory: (program, host) => new MorseMinusRuntime(program, host),
    capabilities: createCapabilities(), description: 'Configurable pulse/hold signal encoder and decoder.',
  }),
  new CodingBody({
    id: 'mudra-code', name: 'Mudra Code', kind: 'gesture-language', parser: new MudraCodeParser(),
    runtimeFactory: (program, host) => new MudraCodeRuntime(program, host),
    capabilities: createCapabilities({ glyph: true }), description: 'Gesture to symbol/route/delivery runtime.',
  }),
  new CodingBody({
    id: 'jickma', name: 'JickMa', kind: 'mark-sequence-language', parser: new JickMaParser(),
    runtimeFactory: (program, host) => new JickMaRuntime(program, host),
    capabilities: createCapabilities({ glyph: true }), description: 'Mark and sequence interpretation runtime.',
  }),
  new CodingBody({
    id: 'onebody-runtime', name: 'OneBody Runtime', kind: 'orchestrator', parser: new SimpleDeclarationParser('onebody'),
    runtimeFactory: (program, host) => new OneBodyRuntime(program, host),
    capabilities: createCapabilities(), description: 'Single runtime surface for mounted bodies.',
  }),
  new CodingBody({
    id: 'routecore', name: 'RouteCore', kind: 'route-kernel', parser: new SimpleDeclarationParser('routecore'),
    runtimeFactory: (program, host) => new RouteCoreRuntime(program, host),
    capabilities: createCapabilities(), description: 'Named route binding and travel kernel.',
  }),
];

const BODY_ALIASES = new Map();
for (const body of BODY_DEFINITIONS) {
  BODY_ALIASES.set(normaliseName(body.id), body.id);
  BODY_ALIASES.set(normaliseName(body.name), body.id);
  BODY_ALIASES.set(normaliseName(body.name.replace(/[^A-Za-z0-9]/g, '')), body.id);
}

class EstateHost {
  constructor() {
    this.clock = new DeterministicClock();
    this.bodies = new Map(BODY_DEFINITIONS.map((body) => [body.id, body]));
    this.runtimes = new Map();
    this.delivery = new OneBodyDeliveryRuntime({ channels: ['text', 'symbol', 'event', 'gesture', 'receipt'] }, this);
    this.fusion = new FusionRegistry(this.clock);
    this.formulaBorn = new FormulaBornHost({ formulas: [] }, this);
    this.trace = new TraceBox('estate-host', this.clock);
  }
  resolveBodyId(name) {
    const normalized = normaliseName(name);
    return BODY_ALIASES.get(normalized) ?? normalized;
  }
  getBody(name) {
    const id = this.resolveBodyId(name);
    const body = this.bodies.get(id);
    invariant(body, `Unknown coding body ${name}`);
    return body;
  }
  mountRuntime(name, runtime) {
    const id = this.resolveBodyId(name);
    runtime.host = this;
    this.runtimes.set(id, runtime);
    if (id === 'formula-born-code') this.formulaBorn = runtime;
    if (id === 'onebody-delivery') this.delivery = runtime;
    this.trace.push('mount-runtime', { body: id });
    return runtime;
  }
  mountSource(name, source) {
    const body = this.getBody(name);
    const ir = body.compile(source);
    const runtime = body.createRuntime(ir, this);
    this.mountRuntime(body.id, runtime);
    return { body, ir, runtime };
  }
  call(target, args = [], context = {}) {
    const [bodyName, ...targetParts] = String(target).split('.');
    const bodyId = this.resolveBodyId(bodyName);
    const targetName = targetParts.join('.');
    const runtime = this.runtimes.get(bodyId);
    invariant(runtime, `Body runtime ${bodyName} is not mounted`);
    this.trace.push('call', { body: bodyId, target: targetName, args });

    switch (bodyId) {
      case 'cading': return runtime.invoke(targetName || 'main', args);
      case 'kading': return runtime.runFlow(targetName || runtime.program.flows[0]?.name, context);
      case 'jmlogic': return runtime.evaluate(context, { group: targetName || null });
      case 'flowtalk': return runtime.runFlow(targetName || runtime.program.flows[0]?.name, context);
      case 'route-code': {
        const [route, event = 'start'] = targetName.split(':');
        return runtime.dispatch(route || runtime.program.routes[0]?.name, event, args, context);
      }
      case 'quadze': {
        const [route, event = 'fusion'] = targetName.split(':');
        runtime.init(context);
        return runtime.dispatch(route || runtime.program.routes[0]?.name, event, args, context);
      }
      case 'formula-born-code': {
        const [formula, gate] = targetName.split(':');
        return runtime.generate(formula, gate, context);
      }
      case 'routevm': return runtime.runRoute(targetName || runtime.program.routes[0]?.name, { locals: context });
      case 'cadenvm':
      case 'jmvm': return runtime.run({ locals: context });
      case 'onebody-runtime': return runtime.execute(targetName, args, context);
      case 'routecore': return runtime.travel(targetName, context);
      case 'polyglot-route-spine': return runtime.dispatch(targetName, context);
      default:
        if (typeof runtime[targetName] === 'function') return runtime[targetName](...args);
        if (typeof runtime.run === 'function') return runtime.run({ target: targetName, args, context });
        throw new JMError(`Runtime ${bodyId} cannot call target ${targetName}`);
    }
  }
  toolchain() {
    return new JMToolchainRuntime({ name: 'EstateToolchain', commands: [] }, this);
  }
  manifest() {
    return {
      build: BUILD_ID,
      version: VERSION,
      bodyCount: this.bodies.size,
      bodies: [...this.bodies.values()].map((body) => body.manifest()),
      shared: {
        types: ['number', 'text', 'bool', 'vector2', 'list<T>', 'map<K,V>', 'option<T>'],
        routeEvents: ['start', 'tick', 'custom', 'ding', 'hold', 'resume'],
        trace: 'append-only deterministic TraceBox',
        fusionLaws: ['identity continuity', 'route continuity', 'symbol meaning', 'collapse integrity', 'trace integrity'],
      },
    };
  }
  receipt() {
    const mounted = [...this.runtimes.keys()];
    const continuity = this.fusion.validateContinuity();
    return this.trace.receipt(continuity.status, {
      bodyCount: this.bodies.size,
      mounted,
      deliveryCount: this.delivery.outputs.length,
      fusion: continuity,
    });
  }
}

// Kading has a deliberate target-first assignment rule: bare `set field = value`
// writes into the flow target, while qualified paths keep their explicit target.
KadingRuntime.prototype.runFlow = function runKadingFlow(name, sources = {}) {
  const flow = this.flows.get(name);
  invariant(flow, `Unknown Kading flow ${name}`);
  const target = {};
  const scopeValues = { ...sources, [flow.to]: target, target };
  if (flow.from.length === 1 && !scopeValues[flow.from[0]]) scopeValues[flow.from[0]] = sources;
  const scope = new Scope(scopeValues);
  this.trace.push('flow-start', { flow: name, from: flow.from, to: flow.to });
  const executeMapping = (statements) => {
    for (const statement of statements) {
      if (statement.kind === 'set') {
        const parts = astPath(statement.target);
        const value = evaluateExpression(statement.value, scope, this);
        if (parts.length === 1) target[parts[0]] = value;
        else assignAstPath(statement.target, value, scope, this);
        this.trace.push('map-set', { target: parts.join('.'), value });
      } else if (statement.kind === 'if') {
        executeMapping(evaluateExpression(statement.condition, scope, this) ? statement.then : statement.otherwise);
      } else {
        executeStatement(statement, scope, this, { route: name });
      }
    }
  };
  executeMapping(flow.mappings);
  this.trace.push('flow-end', { flow: name, target });
  return target;
};

const EXAMPLES = {
  cading: {
    title: 'Cading arithmetic and trace',
    source: `module Demo {
  let base: number = 10
  func add(a: number, b: number) -> number {
    let total: number = a + b + base
    ding "cading-add"
    return total
  }
  func main() -> number { return add(2, 3) }
}`,
    input: { entry: 'main', args: [] },
  },
  kading: {
    title: 'Kading source-to-target map',
    source: `flow UserToProfile {
  from User
  to Profile
  map {
    set name = User.fullName
    set age = User.age
    if User.age >= 18 { set adult = true } else { set adult = false }
    ding "profile-mapped"
  }
}`,
    input: { flow: 'UserToProfile', sources: { User: { fullName: 'Theo', age: 34 } } },
  },
  jmlogic: {
    title: 'JMLogic priority rules',
    source: `logic HealthLogic {
  rule Critical priority 20 { when Player.health <= 0 then "player-dead" }
  rule LowHealth priority 10 { when Player.health < 20 then "warn-low-health" }
}`,
    input: { context: { Player: { health: 12 } } },
  },
  flowtalk: {
    title: 'FlowTalk branching conversation',
    source: `flow HealthTalk {
  step Start {
    say "Health is {Player.health}"
    if Player.health < 20 goto Warn
    goto Safe
  }
  step Warn { say "Your health is low."; ding "spoken-warning" }
  step Safe { say "You are steady." }
}`,
    input: { flow: 'HealthTalk', context: { Player: { health: 12 } } },
  },
  'route-code': {
    title: 'Route-Code event state',
    source: `route PlayerRoute {
  on damage(amount: number) {
    set Player.health = Player.health - amount
    if Player.health <= 0 { ding "dead"; hold }
  }
}`,
    input: { route: 'PlayerRoute', event: 'damage', args: [30], context: { Player: { health: 25 } } },
  },
  quadze: {
    title: 'Quadze game body',
    source: `game Demo {
  entity Player { field health: number = 15 }
  state GameState { field phase: text = "Q0" }
  route MainLoop {
    on start { phase "Q1"; ding "quadze-start" }
    on tick {
      if Player.health < 20 {
        symbolise "low-health" with Player.health
        collapse "low-health-snapshot"
        ding "warn-low-health"
        hold
      }
    }
  }
}`,
    input: { ticks: 1 },
  },
  'formula-born-code': {
    title: 'Formula-Born generative law',
    source: `formula HealthFormula {
  gate health {
    glyph Danger {
      shape: "triangle"
      tone: "red"
      route: "LowHealthRoute"
      identity: "Player"
      symbol: "warn-low-health"
      weight: 10
      when Player.health < 20
    }
    glyph Safe {
      shape: "circle"
      tone: "green"
      route: "IdleRoute"
      identity: "Player"
      symbol: "health-safe"
      weight: 1
      when Player.health >= 20
    }
  }
}`,
    input: { formula: 'HealthFormula', gate: 'health', context: { actor: 'Player', Player: { health: 10 } } },
  },
  'noncoding-code': {
    title: 'Noncoding-Code phrase route',
    source: `noncode PlainRoute {
  phrase "health is low" => symbol "warn-low-health"
  phrase "open route" => route "LowHealthRoute"
}`,
    input: { text: 'My health is low' },
  },
  contactcode: {
    title: 'ContactCode interaction',
    source: `contact DoorContact {
  when Player touches Door { ding "door-contact"; emit "open-door" }
}`,
    input: { left: 'Player', right: 'Door', relation: 'touches' },
  },
  morseminus: {
    title: 'MorseMinus encode/decode',
    source: `morse SignalBody {
  word-separator = "/"
  letter-separator = " "
}`,
    input: { mode: 'encode', value: 'JM' },
  },
  'mudra-code': {
    title: 'Mudra Code gesture',
    source: `mudra Hands {
  gesture "open-palm" => symbol "receive"
  gesture "fist" => route "HoldRoute"
}`,
    input: { gesture: 'open-palm' },
  },
  jickma: {
    title: 'JickMa mark sequence',
    source: `jickma Marks {
  mark "X" => symbol "cross"
  sequence "X O" => route "switch-route"
}`,
    input: { input: 'X O' },
  },
  cadenvm: {
    title: 'CadenVM stack execution',
    source: `PUSH 7
PUSH 5
ADD
STORE result
LOAD result
DING "vm-complete"
HALT`,
    input: {},
  },
  routevm: {
    title: 'RouteVM named route',
    source: `routevm DemoVM {
  route Start {
    PUSH 2;
    PUSH 3;
    MUL;
    DING "routevm-done";
    HALT;
  }
}`,
    input: { route: 'Start' },
  },
  jmvm: {
    title: 'JMVM delivery',
    source: `PUSH "hello from JMVM"
DELIVER text
HALT`,
    input: {},
  },
  'onebody-delivery': {
    title: 'OneBody Delivery channels',
    source: `delivery MainDelivery { channel text; channel symbol; channel event; }`,
    input: { channel: 'text', value: 'One body delivered' },
  },
  multihub: {
    title: 'MultiHub registry',
    source: `hub MainHub { mount Cading; mount Quadze; route LowHealth jmlogic.HealthLogic; }`,
    input: {},
  },
  'body-house': {
    title: 'Body House registry',
    source: `bodyhouse EstateHouse { body Cading; body Quadze; capability trace; }`,
    input: {},
  },
  'route-classifier': {
    title: 'Route Classifier',
    source: `classifier MainClassifier { rule defaults; }`,
    input: { route: 'tick' },
  },
  'receipt-shape': {
    title: 'Receipt Shape',
    source: `receipt MainReceipt { field status; field body; field trace; }`,
    input: { receipt: { status: 'PASS', body: 'demo', trace: [] } },
  },
  'polybridge-stack': {
    title: 'PolyBridge registry',
    source: `polybridge MainBridge { bridge Cading JMIR; bridge Quadze JMIR; }`,
    input: {},
  },
  'polyglot-route-spine': {
    title: 'Polyglot Route Spine',
    source: `spine MainSpine { language Cading; language Quadze; route Start cading.main; }`,
    input: {},
  },
  'jm-codehouse': {
    title: 'JM CodeHouse',
    source: `codehouse MainCodeHouse { body Cading; body Quadze; version estate "0.1"; }`,
    input: {},
  },
  'runtime-compiler-rooms': {
    title: 'Runtime Compiler Rooms',
    source: `compilerrooms MainRooms { room parse; room compile; room execute; }`,
    input: {},
  },
  'jm-toolchain': {
    title: 'JM Toolchain declaration',
    source: `toolchain MainToolchain { room parse; room compile; room execute; room receipt; }`,
    input: {},
  },
  'onebody-runtime': {
    title: 'OneBody Runtime',
    source: `onebody EstateRuntime { mount Cading; mount Quadze; route Main cading.main; }`,
    input: {},
  },
  routecore: {
    title: 'RouteCore',
    source: `routecore MainRouteCore { route Start cading.main; route Game quadze.MainLoop; }`,
    input: {},
  },
};


// -----------------------------------------------------------------------------
// JM ELEVATION PASS 2 — validation, normalised IR, persistence, replay, pipeline
// -----------------------------------------------------------------------------

function stableStringify(value) {
  const seen = new WeakSet();
  const walk = (input) => {
    if (input === null || typeof input !== 'object') return input;
    if (seen.has(input)) return '[Circular]';
    seen.add(input);
    if (Array.isArray(input)) return input.map(walk);
    return Object.fromEntries(Object.keys(input).sort().map((key) => [key, walk(input[key])]));
  };
  return JSON.stringify(walk(value));
}

function jmDigest(value) {
  const text = stableStringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `jm-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function literalType(value) {
  if (value === null || value === undefined) return 'option';
  if (Array.isArray(value)) return value.length === 2 && value.every((item) => typeof item === 'number') ? 'vector2' : 'list';
  if (isPlainObject(value)) return 'map';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'text';
  if (typeof value === 'boolean') return 'bool';
  return 'unknown';
}

function expressionStaticType(expr) {
  if (!expr || typeof expr !== 'object') return 'unknown';
  if (expr.kind === 'literal') return literalType(expr.value);
  if (expr.kind === 'list') {
    const values = expr.items ?? expr.values ?? [];
    if (values.length === 2 && values.every((item) => expressionStaticType(item) === 'number')) return 'vector2';
    return 'list';
  }
  if (expr.kind === 'map') return 'map';
  if (expr.kind === 'unary' && expr.op === 'not') return 'bool';
  if (expr.kind === 'binary') {
    if (['==', '!=', '<', '<=', '>', '>=', 'and', 'or', '&&', '||'].includes(expr.op)) return 'bool';
    const left = expressionStaticType(expr.left);
    const right = expressionStaticType(expr.right);
    if (expr.op === '+' && (left === 'text' || right === 'text')) return 'text';
    if (['+', '-', '*', '/', '%'].includes(expr.op) && left === 'number' && right === 'number') return 'number';
  }
  return 'unknown';
}

class JMStaticAnalyzer {
  constructor(bodyId = 'unknown') {
    this.bodyId = bodyId;
    this.diagnostics = [];
    this.symbols = [];
  }
  add(code, message, path = '$', severity = 'error', data = {}) {
    this.diagnostics.push({ code, message, path, severity, ...deepClone(data) });
  }
  unique(items, label, path, nameOf = (item) => item?.name) {
    const seen = new Map();
    for (let index = 0; index < (items ?? []).length; index += 1) {
      const item = items[index];
      const name = nameOf(item);
      if (name == null) continue;
      const key = normaliseName(name);
      if (seen.has(key)) this.add('DUPLICATE_NAME', `Duplicate ${label} ${name}`, `${path}[${index}]`);
      else seen.set(key, index);
      this.symbols.push({ name: String(name), kind: label, path: `${path}[${index}]` });
    }
  }
  walk(value, path = '$') {
    if (Array.isArray(value)) {
      value.forEach((item, index) => this.walk(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (value.kind === 'binary' && value.op === '/' && value.right?.kind === 'literal' && value.right.value === 0) {
      this.add('DIVIDE_BY_ZERO', 'Division by literal zero', path);
    }
    if (value.kind === 'call' && Array.isArray(value.args) && value.args.length > 64) {
      this.add('CALL_ARITY_HIGH', 'Call has more than 64 arguments', path, 'warning');
    }
    for (const [key, child] of Object.entries(value)) this.walk(child, `${path}.${key}`);
  }
  analyse(ast) {
    if (!ast || typeof ast !== 'object') {
      this.add('AST_MISSING', 'Parser produced no AST');
      return this.result();
    }
    this.walk(ast);
    switch (this.bodyId) {
      case 'cading': {
        this.unique(ast.globals, 'global', '$.globals');
        this.unique(ast.functions, 'function', '$.functions');
        for (let i = 0; i < (ast.functions ?? []).length; i += 1) {
          const fn = ast.functions[i];
          this.unique(fn.params, 'parameter', `$.functions[${i}].params`);
          if (!fn.returnType?.name) this.add('RETURN_TYPE_MISSING', `Function ${fn.name} has no return type`, `$.functions[${i}]`);
        }
        break;
      }
      case 'kading': {
        this.unique(ast.flows, 'flow', '$.flows');
        for (let i = 0; i < (ast.flows ?? []).length; i += 1) {
          const flow = ast.flows[i];
          if (!(flow.from ?? []).length) this.add('FLOW_SOURCE_MISSING', `Flow ${flow.name} has no source`, `$.flows[${i}]`);
          if (!flow.to) this.add('FLOW_TARGET_MISSING', `Flow ${flow.name} has no target`, `$.flows[${i}]`);
        }
        break;
      }
      case 'jmlogic': {
        this.unique(ast.rules, 'rule', '$.rules');
        for (let i = 0; i < (ast.rules ?? []).length; i += 1) {
          if (!Number.isFinite(ast.rules[i].priority)) this.add('RULE_PRIORITY_INVALID', `Rule ${ast.rules[i].name} priority must be numeric`, `$.rules[${i}].priority`);
        }
        break;
      }
      case 'flowtalk': {
        this.unique(ast.flows, 'flow', '$.flows');
        for (let fi = 0; fi < (ast.flows ?? []).length; fi += 1) {
          const flow = ast.flows[fi];
          this.unique(flow.steps, 'step', `$.flows[${fi}].steps`);
          const stepNames = new Set((flow.steps ?? []).map((step) => normaliseName(step.name)));
          const inspectStatements = (statements, path) => {
            (statements ?? []).forEach((statement, index) => {
              if (['goto', 'if-goto'].includes(statement.kind) && !stepNames.has(normaliseName(statement.target))) {
                this.add('UNKNOWN_STEP', `Unknown FlowTalk step ${statement.target}`, `${path}[${index}]`);
              }
            });
          };
          (flow.steps ?? []).forEach((step, si) => inspectStatements(step.body, `$.flows[${fi}].steps[${si}].body`));
        }
        break;
      }
      case 'route-code':
      case 'quadze': {
        this.unique(ast.routes, 'route', '$.routes');
        if (this.bodyId === 'quadze') {
          this.unique(ast.entities, 'entity', '$.entities');
          this.unique(ast.states, 'state', '$.states');
          const declarations = [...(ast.entities ?? []), ...(ast.states ?? [])];
          declarations.forEach((decl, di) => {
            this.unique(decl.fields, 'field', `$.declarations[${di}].fields`);
            (decl.fields ?? []).forEach((field, fi) => {
              const declared = field.type?.name;
              const actual = expressionStaticType(field.initial);
              if (declared && actual !== 'unknown' && declared !== actual && !(declared === 'list' && actual === 'vector2')) {
                this.add('TYPE_MISMATCH', `${decl.name}.${field.name} declares ${declared} but initial value is ${actual}`, `$.declarations[${di}].fields[${fi}]`);
              }
            });
          });
        }
        (ast.routes ?? []).forEach((route, ri) => {
          const seenEvents = new Set();
          (route.handlers ?? []).forEach((handler, hi) => {
            const key = normaliseName(handler.event);
            if (seenEvents.has(key)) this.add('DUPLICATE_HANDLER', `Route ${route.name} repeats event ${handler.event}`, `$.routes[${ri}].handlers[${hi}]`, 'warning');
            seenEvents.add(key);
            this.unique(handler.params, 'parameter', `$.routes[${ri}].handlers[${hi}].params`);
          });
        });
        break;
      }
      case 'formula-born-code': {
        this.unique(ast.formulas, 'formula', '$.formulas');
        (ast.formulas ?? []).forEach((formula, fi) => {
          this.unique(formula.gates, 'gate', `$.formulas[${fi}].gates`);
          (formula.gates ?? []).forEach((gate, gi) => {
            this.unique(gate.glyphs, 'glyph', `$.formulas[${fi}].gates[${gi}].glyphs`);
            if (!(gate.glyphs ?? []).length) this.add('EMPTY_GATE', `Gate ${gate.name} has no glyphs`, `$.formulas[${fi}].gates[${gi}]`, 'warning');
          });
        });
        break;
      }
      case 'cadenvm':
      case 'jmvm': {
        this.checkAssembly(ast);
        break;
      }
      case 'routevm': {
        this.unique(ast.routes, 'route', '$.routes');
        (ast.routes ?? []).forEach((route, index) => this.checkAssembly(route.program, `$.routes[${index}].program`));
        break;
      }
      default: {
        if (Array.isArray(ast.commands) && ast.commands.length === 0) this.add('EMPTY_BODY', 'Body contains no commands', '$.commands', 'warning');
      }
    }
    return this.result();
  }
  checkAssembly(ast, basePath = '$') {
    const labels = ast?.labels ?? {};
    const labelNames = new Set(Object.keys(labels).map(normaliseName));
    for (let i = 0; i < (ast?.code ?? []).length; i += 1) {
      const instruction = ast.code[i];
      if (['JUMP', 'JUMP_IF_TRUE', 'JUMP_IF_FALSE', 'CALL'].includes(instruction.op)) {
        const target = instruction.args?.[0];
        if (typeof target === 'string' && !labelNames.has(normaliseName(target))) {
          this.add('UNKNOWN_LABEL', `Unknown assembly label ${target}`, `${basePath}.code[${i}]`, 'warning');
        }
      }
    }
  }
  result() {
    const errors = this.diagnostics.filter((item) => item.severity === 'error').length;
    const warnings = this.diagnostics.filter((item) => item.severity === 'warning').length;
    return {
      body: this.bodyId,
      status: errors === 0 ? 'PASS' : 'HOLD',
      errors,
      warnings,
      diagnostics: deepClone(this.diagnostics),
      symbols: deepClone(this.symbols),
      digest: jmDigest({ body: this.bodyId, diagnostics: this.diagnostics, symbols: this.symbols }),
    };
  }
}

class JMIRNormalizer {
  constructor(bodyId = 'unknown') {
    this.bodyId = bodyId;
    this.nodes = [];
    this.sourceMap = {};
    this.counter = 0;
  }
  lower(ast) {
    const root = this.visit(ast, '$');
    const entrypoints = this.findEntrypoints(ast);
    const graph = {
      kind: 'jm-normalised-ir',
      version: '2.0-jm',
      body: this.bodyId,
      root,
      entrypoints,
      nodes: this.nodes,
      sourceMap: this.sourceMap,
    };
    graph.digest = jmDigest(graph);
    return graph;
  }
  visit(value, path) {
    if (value === null || typeof value !== 'object') return { literal: deepClone(value) };
    if (Array.isArray(value)) return value.map((item, index) => this.visit(item, `${path}[${index}]`));
    const id = `n${++this.counter}`;
    const op = value.kind ?? value.op ?? 'record';
    const attrs = {};
    const edges = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === null || typeof child !== 'object') attrs[key] = child;
      else edges[key] = this.visit(child, `${path}.${key}`);
    }
    const node = { id, op, attrs, edges };
    this.nodes.push(node);
    this.sourceMap[id] = path;
    return { ref: id };
  }
  findEntrypoints(ast) {
    const entries = [];
    const add = (kind, name, target = name) => {
      if (name != null) entries.push({ kind, name: String(name), target: String(target) });
    };
    (ast.functions ?? []).forEach((item) => add('function', item.name));
    (ast.flows ?? []).forEach((item) => add('flow', item.name));
    (ast.routes ?? []).forEach((item) => {
      if (item.program) add('vm-route', item.name);
      else (item.handlers ?? []).forEach((handler) => add('route-event', `${item.name}:${handler.event}`, `${item.name}:${handler.event}`));
    });
    (ast.rules ?? []).forEach((item) => add('rule', item.name));
    (ast.formulas ?? []).forEach((formula) => (formula.gates ?? []).forEach((gate) => add('formula-gate', `${formula.name}:${gate.name}`)));
    if (Array.isArray(ast.code)) add('vm', 'main');
    if (Array.isArray(ast.commands)) add('body', ast.name ?? this.bodyId);
    return entries;
  }
}

class TraceReplay {
  constructor(seed = {}) {
    this.seed = deepClone(seed);
  }
  replay(events = []) {
    const state = {
      values: deepClone(this.seed.values ?? {}),
      phases: [],
      dings: [],
      symbols: [],
      holds: [],
      resumes: [],
      collapses: [],
      deliveries: [],
      glyphs: [],
      events: [],
    };
    for (const rawEvent of events) {
      const event = deepClone(rawEvent);
      state.events.push(event);
      const target = event.target ?? event.path;
      if (target && Object.hasOwn(event, 'value') && ['set', 'write', 'map-set', 'store'].some((name) => String(event.type).includes(name))) {
        setPath(state.values, target, deepClone(event.value));
      }
      if (event.type === 'phase') state.phases.push(event.value);
      if (event.type === 'ding') state.dings.push(event.symbol);
      if (event.type === 'symbolise') state.symbols.push({ name: event.name, value: event.value, bind: event.bind });
      if (event.type === 'hold') state.holds.push(event.route ?? event.body);
      if (event.type === 'resume') state.resumes.push(event.route ?? event.body);
      if (event.type === 'collapse') state.collapses.push({ snapshotId: event.snapshotId, label: event.label, snapshot: event.snapshot });
      if (String(event.type).includes('deliver')) state.deliveries.push(event.packet ?? event.value ?? event);
      if (String(event.type).includes('glyph')) state.glyphs.push(event.glyph ?? event.packet ?? event);
    }
    const result = {
      status: 'PASS',
      eventCount: state.events.length,
      final: state,
    };
    result.digest = jmDigest(result);
    return result;
  }
}

class MemoryStorageAdapter {
  constructor(seed = {}) {
    this.values = new Map(Object.entries(deepClone(seed)));
  }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  keys() { return [...this.values.keys()]; }
}

class BrowserStorageAdapter {
  constructor(storage = globalThis?.localStorage) {
    invariant(storage, 'Browser storage is unavailable');
    this.storage = storage;
  }
  getItem(key) { return this.storage.getItem(key); }
  setItem(key, value) { this.storage.setItem(key, value); }
  removeItem(key) { this.storage.removeItem(key); }
  keys() {
    const keys = [];
    for (let index = 0; index < this.storage.length; index += 1) keys.push(this.storage.key(index));
    return keys;
  }
}

function defaultStorageAdapter() {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) return new BrowserStorageAdapter(globalThis.localStorage);
  } catch (_) { /* content/file storage may be disabled */ }
  return new MemoryStorageAdapter();
}

class ProjectVault {
  constructor(adapter = defaultStorageAdapter(), namespace = 'jm-coding-estate-v03') {
    this.adapter = adapter;
    this.namespace = namespace;
    this.indexKey = `${namespace}:index`;
  }
  key(id) { return `${this.namespace}:project:${normaliseName(id)}`; }
  readIndex() {
    try { return JSON.parse(this.adapter.getItem(this.indexKey) ?? '[]'); }
    catch (_) { return []; }
  }
  writeIndex(index) { this.adapter.setItem(this.indexKey, JSON.stringify([...new Set(index)])); }
  save(project) {
    invariant(project && project.id, 'Project requires an id');
    const now = new Date().toISOString();
    const prior = this.load(project.id, false);
    const record = {
      schema: 'jm-project/2',
      id: normaliseName(project.id),
      name: project.name ?? project.id,
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
      build: BUILD_ID,
      version: VERSION,
      bodies: deepClone(project.bodies ?? {}),
      pipelines: deepClone(project.pipelines ?? []),
      metadata: deepClone(project.metadata ?? {}),
    };
    record.digest = jmDigest({ ...record, digest: undefined });
    this.adapter.setItem(this.key(record.id), JSON.stringify(record));
    const index = this.readIndex();
    if (!index.includes(record.id)) index.push(record.id);
    this.writeIndex(index);
    return deepClone(record);
  }
  load(id, required = true) {
    const raw = this.adapter.getItem(this.key(id));
    if (!raw) {
      if (required) throw new JMError(`Unknown project ${id}`);
      return null;
    }
    const project = JSON.parse(raw);
    const expected = jmDigest({ ...project, digest: undefined });
    invariant(project.digest === expected, `Project ${id} failed digest verification`);
    return project;
  }
  list() {
    return this.readIndex().map((id) => this.load(id, false)).filter(Boolean).map((project) => ({
      id: project.id,
      name: project.name,
      updatedAt: project.updatedAt,
      bodyCount: Object.keys(project.bodies ?? {}).length,
      pipelineCount: (project.pipelines ?? []).length,
      digest: project.digest,
    }));
  }
  remove(id) {
    this.adapter.removeItem(this.key(id));
    this.writeIndex(this.readIndex().filter((item) => item !== normaliseName(id)));
    return true;
  }
  export(id) { return JSON.stringify(this.load(id), null, 2); }
  import(text, { overwrite = false } = {}) {
    const project = typeof text === 'string' ? JSON.parse(text) : deepClone(text);
    invariant(project?.schema === 'jm-project/2', 'Unsupported project schema');
    if (!overwrite && this.load(project.id, false)) throw new JMError(`Project ${project.id} already exists`);
    const expected = jmDigest({ ...project, digest: undefined });
    invariant(project.digest === expected, 'Imported project digest does not match');
    const id = normaliseName(project.id);
    const record = { ...deepClone(project), id };
    this.adapter.setItem(this.key(id), JSON.stringify(record));
    const index = this.readIndex();
    if (!index.includes(id)) index.push(id);
    this.writeIndex(index);
    return deepClone(record);
  }
}

class EstatePipeline {
  constructor(host = new EstateHost(), { id = 'pipeline', stopOnHold = true } = {}) {
    this.host = host;
    this.id = id;
    this.stopOnHold = stopOnHold;
    this.stages = [];
    this.trace = new TraceBox(`pipeline:${id}`, host.clock);
  }
  add(stage) {
    invariant(stage?.body, 'Pipeline stage requires a body');
    invariant(stage?.source, 'Pipeline stage requires source');
    this.stages.push({ ...stage, id: stage.id ?? `stage-${this.stages.length + 1}` });
    return this;
  }
  run(initial = {}) {
    const mountedBefore = new Map(this.host.runtimes);
    const deliveryLength = this.host.delivery.outputs.length;
    const hops = [];
    let previous = deepClone(initial);
    let status = 'PASS';
    this.trace.push('pipeline-start', { id: this.id, stages: this.stages.length });
    try {
      for (const stage of this.stages) {
        const body = this.host.getBody(stage.body);
        const validation = body.validate(stage.source);
        invariant(validation.status === 'PASS', `${body.name} validation HOLD`);
        const ir = body.compile(stage.source);
        const runtime = body.createRuntime(ir, this.host);
        const input = typeof stage.input === 'function'
          ? stage.input({ initial: deepClone(initial), previous: deepClone(previous), hops: deepClone(hops) })
          : deepClone(stage.input ?? previous ?? {});
        const value = runtime.run(input ?? {});
        const receipt = runtime.receipt?.() ?? { status: runtime.held ? 'HOLD' : 'PASS', trace: runtime.trace?.events ?? [] };
        const hop = {
          id: stage.id,
          body: body.id,
          validation,
          irDigest: ir.normalized?.digest,
          value: deepClone(value),
          receipt: deepClone(receipt),
        };
        hops.push(hop);
        this.trace.push('pipeline-hop', { stage: stage.id, body: body.id, status: receipt.status, irDigest: hop.irDigest });
        if (receipt.status === 'HOLD' || runtime.held) {
          status = 'HOLD';
          if (this.stopOnHold) break;
        } else {
          this.host.mountRuntime(body.id, runtime);
        }
        previous = value;
      }
    } catch (error) {
      status = 'HOLD';
      this.host.runtimes = mountedBefore;
      this.host.delivery.outputs.length = deliveryLength;
      this.trace.push('pipeline-rollback', { message: error.message });
      return {
        id: this.id,
        status,
        error: error.message,
        hops,
        rolledBack: true,
        receipt: this.trace.receipt(status, { hops, rolledBack: true, error: error.message }),
      };
    }
    this.trace.push('pipeline-end', { id: this.id, status, hops: hops.length });
    return {
      id: this.id,
      status,
      value: deepClone(previous),
      hops,
      rolledBack: false,
      receipt: this.trace.receipt(status, { hops, rolledBack: false }),
    };
  }
}

const originalCodingBodyCompile = CodingBody.prototype.compile;
CodingBody.prototype.validate = function validate(sourceOrAst) {
  const ast = typeof sourceOrAst === 'string' ? this.parse(sourceOrAst) : sourceOrAst;
  return new JMStaticAnalyzer(this.id).analyse(ast);
};
CodingBody.prototype.normalise = function normalise(sourceOrAst) {
  const ast = typeof sourceOrAst === 'string' ? this.parse(sourceOrAst) : sourceOrAst;
  return new JMIRNormalizer(this.id).lower(ast);
};
CodingBody.prototype.compile = function compileElevated(sourceOrAst) {
  const ir = originalCodingBodyCompile.call(this, sourceOrAst);
  const validation = new JMStaticAnalyzer(this.id).analyse(ir.ast);
  const normalized = new JMIRNormalizer(this.id).lower(ir.ast);
  return {
    ...ir,
    version: '2.0-jm',
    validation,
    diagnostics: validation.diagnostics,
    normalized,
  };
};

for (const body of BODY_DEFINITIONS) {
  body.version = '2.0-jm';
  for (const capability of ['can-validate', 'can-normalise', 'can-persist', 'can-replay', 'can-pipeline']) body.capabilities.add(capability);
}

const originalManifest = CodingBody.prototype.manifest;
CodingBody.prototype.manifest = function elevatedManifest() {
  return {
    ...originalManifest.call(this),
    sourceState: 'implemented-v0.3',
    elevation: {
      level: 'JM-E2',
      equalised: true,
      guarantees: ['static-validation', 'normalised-ir', 'project-persistence', 'trace-replay', 'transactional-pipeline'],
    },
  };
};

EstateHost.prototype.createPipeline = function createPipeline(options = {}) {
  return new EstatePipeline(this, options);
};
EstateHost.prototype.createVault = function createVault(adapter = defaultStorageAdapter(), namespace) {
  return new ProjectVault(adapter, namespace);
};
EstateHost.prototype.replay = function replay(trace, seed = {}) {
  return new TraceReplay(seed).replay(trace);
};

const originalEstateManifest = EstateHost.prototype.manifest;
EstateHost.prototype.manifest = function elevatedEstateManifest() {
  const manifest = originalEstateManifest.call(this);
  return {
    ...manifest,
    elevation: {
      level: 'JM-E2',
      equalisedBodies: this.bodies.size,
      validation: 'static analyzer on every body',
      ir: 'normalised graph IR on every body',
      persistence: 'digest-verified project vault',
      replay: 'deterministic trace reconstruction',
      pipeline: 'ordered transactional cross-body execution',
    },
  };
};


// -----------------------------------------------------------------------------
// JM-E3 — semantic types, optimiser, contracts and deterministic debugger
// -----------------------------------------------------------------------------

function jmTypeOfValue(value) {
  if (value === null || value === undefined) return 'option';
  if (Array.isArray(value)) return value.length === 2 && value.every((item) => typeof item === 'number') ? 'vector2' : 'list';
  if (value instanceof Map || isPlainObject(value)) return 'map';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'text';
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'function') return 'function';
  return 'any';
}

function jmTypeName(type) {
  if (!type) return 'any';
  if (typeof type === 'string') return normaliseName(type);
  return normaliseName(type.name ?? 'any');
}

function jmTypeCompatible(expected, actual) {
  expected = jmTypeName(expected);
  actual = jmTypeName(actual);
  if (expected === 'any' || actual === 'any' || actual === 'unknown') return true;
  if (expected === actual) return true;
  if (expected === 'list' && actual === 'vector2') return true;
  if (expected === 'option' && actual === 'null') return true;
  return false;
}

function annotateJMPaths(value, path = '$') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => annotateJMPaths(item, `${path}[${index}]`));
    return value;
  }
  if (!value || typeof value !== 'object') return value;
  if (value.kind && !Object.hasOwn(value, '__jmPath')) value.__jmPath = path;
  for (const [key, child] of Object.entries(value)) {
    if (key !== '__jmPath') annotateJMPaths(child, `${path}.${key}`);
  }
  return value;
}

function jmPathOfExpression(expr) {
  const parts = astPath(expr);
  return parts ? parts.join('.') : null;
}

class JMSemanticAnalyzer {
  constructor(bodyId = 'unknown') {
    this.bodyId = bodyId;
    this.diagnostics = [];
    this.bindings = [];
    this.effects = new Set();
    this.env = new Map();
    this.functions = new Map();
  }
  add(code, message, path = '$', severity = 'error', data = {}) {
    this.diagnostics.push({ code, message, path, severity, ...deepClone(data) });
  }
  bind(name, type, path = '$', role = 'value') {
    const clean = jmTypeName(type);
    this.env.set(name, clean);
    this.bindings.push({ name, type: clean, path, role });
    return clean;
  }
  infer(expr, path = '$', env = this.env) {
    if (!expr || typeof expr !== 'object') return 'any';
    switch (expr.kind) {
      case 'literal': return jmTypeOfValue(expr.value);
      case 'var': return env.get(expr.name) ?? this.env.get(expr.name) ?? 'any';
      case 'list': {
        const types = (expr.items ?? []).map((item, index) => this.infer(item, `${path}.items[${index}]`, env));
        if (types.length === 2 && types.every((type) => type === 'number')) return 'vector2';
        return 'list';
      }
      case 'map':
        (expr.entries ?? []).forEach(([key, value], index) => this.infer(value, `${path}.entries[${index}].${key}`, env));
        return 'map';
      case 'access': {
        const direct = jmPathOfExpression(expr);
        if (direct && (env.has(direct) || this.env.has(direct))) return env.get(direct) ?? this.env.get(direct);
        this.infer(expr.object, `${path}.object`, env);
        return 'any';
      }
      case 'index':
        this.infer(expr.object, `${path}.object`, env); this.infer(expr.index, `${path}.index`, env); return 'any';
      case 'unary': {
        const inner = this.infer(expr.value, `${path}.value`, env);
        if (['not', '!'].includes(expr.op)) {
          if (!jmTypeCompatible('bool', inner)) this.add('SEMANTIC_UNARY_BOOL', `Operator ${expr.op} expects bool but received ${inner}`, path);
          return 'bool';
        }
        if (expr.op === '-') {
          if (!jmTypeCompatible('number', inner)) this.add('SEMANTIC_UNARY_NUMBER', `Unary - expects number but received ${inner}`, path);
          return 'number';
        }
        return 'any';
      }
      case 'binary': {
        const left = this.infer(expr.left, `${path}.left`, env);
        const right = this.infer(expr.right, `${path}.right`, env);
        if (['and','or','&&','||'].includes(expr.op)) {
          if (!jmTypeCompatible('bool', left) || !jmTypeCompatible('bool', right)) this.add('SEMANTIC_LOGIC_TYPES', `${expr.op} expects bool operands but received ${left} and ${right}`, path);
          return 'bool';
        }
        if (['==','!=','<','<=','>','>='].includes(expr.op)) return 'bool';
        if (expr.op === '+' && (left === 'text' || right === 'text')) return 'text';
        if (['+','-','*','/','%'].includes(expr.op)) {
          if (!jmTypeCompatible('number', left) || !jmTypeCompatible('number', right)) this.add('SEMANTIC_ARITHMETIC_TYPES', `${expr.op} expects number operands but received ${left} and ${right}`, path);
          return 'number';
        }
        return 'any';
      }
      case 'call': {
        const calleePath = jmPathOfExpression(expr.callee);
        const args = (expr.args ?? []).map((arg, index) => this.infer(arg, `${path}.args[${index}]`, env));
        const builtins = { len:'number', push:'number', pop:'any', get:'any', set:'any', keys:'list', values:'list', number:'number', text:'text', bool:'bool', min:'number', max:'number', abs:'number', round:'number', some:'option', none:'option' };
        if (calleePath && builtins[calleePath]) return builtins[calleePath];
        if (calleePath && this.functions.has(calleePath)) {
          const fn = this.functions.get(calleePath);
          (fn.params ?? []).forEach((param, index) => {
            if (args[index] && !jmTypeCompatible(param.type, args[index])) this.add('SEMANTIC_ARGUMENT_TYPE', `${calleePath} argument ${param.name} expects ${jmTypeName(param.type)} but received ${args[index]}`, `${path}.args[${index}]`);
          });
          return jmTypeName(fn.returnType);
        }
        return 'any';
      }
      default: return 'any';
    }
  }
  inspectStatements(statements = [], env = new Map(this.env), expectedReturn = 'any', path = '$.body') {
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      const sp = statement.__jmPath ?? `${path}[${index}]`;
      switch (statement.kind) {
        case 'let': {
          const actual = this.infer(statement.value, `${sp}.value`, env);
          const declared = jmTypeName(statement.type);
          if (declared !== 'any' && !jmTypeCompatible(declared, actual)) this.add('SEMANTIC_LET_TYPE', `${statement.name} declares ${declared} but receives ${actual}`, sp);
          env.set(statement.name, declared === 'any' ? actual : declared);
          break;
        }
        case 'set': {
          const actual = this.infer(statement.value, `${sp}.value`, env);
          const target = jmPathOfExpression(statement.target);
          const expected = target ? (env.get(target) ?? this.env.get(target) ?? 'any') : 'any';
          if (!jmTypeCompatible(expected, actual)) this.add('SEMANTIC_SET_TYPE', `${target ?? 'assignment'} expects ${expected} but receives ${actual}`, sp);
          if (target && expected === 'any') env.set(target, actual);
          this.effects.add('state-write');
          break;
        }
        case 'if': {
          const condition = this.infer(statement.condition, `${sp}.condition`, env);
          if (!jmTypeCompatible('bool', condition)) this.add('SEMANTIC_IF_CONDITION', `if condition should be bool but is ${condition}`, `${sp}.condition`);
          this.inspectStatements(statement.then ?? [], new Map(env), expectedReturn, `${sp}.then`);
          this.inspectStatements(statement.otherwise ?? [], new Map(env), expectedReturn, `${sp}.otherwise`);
          break;
        }
        case 'return': {
          const actual = this.infer(statement.value, `${sp}.value`, env);
          if (!jmTypeCompatible(expectedReturn, actual)) this.add('SEMANTIC_RETURN_TYPE', `Return expects ${expectedReturn} but receives ${actual}`, sp);
          this.effects.add('return');
          break;
        }
        case 'ding': this.effects.add('ding'); this.infer(statement.value, `${sp}.value`, env); break;
        case 'hold': this.effects.add('hold'); break;
        case 'resume': this.effects.add('resume'); break;
        case 'collapse': this.effects.add('collapse'); this.infer(statement.label, `${sp}.label`, env); break;
        case 'symbolise': this.effects.add('symbolise'); this.infer(statement.name, `${sp}.name`, env); this.infer(statement.value, `${sp}.value`, env); break;
        case 'deliver': case 'say': case 'emit': this.effects.add(statement.kind === 'say' ? 'delivery' : statement.kind); this.infer(statement.value, `${sp}.value`, env); break;
        case 'body-call': this.effects.add('cross-body-call'); (statement.args ?? []).forEach((arg, ai) => this.infer(arg, `${sp}.args[${ai}]`, env)); break;
        case 'fusion-call': this.effects.add('fusion'); break;
        case 'formula-generate': this.effects.add('formula-generate'); break;
        case 'phase': this.effects.add('phase'); this.infer(statement.value, `${sp}.value`, env); break;
        case 'trace': this.effects.add('trace'); this.infer(statement.value, `${sp}.value`, env); break;
        default:
          for (const [key, child] of Object.entries(statement)) if (child && typeof child === 'object') this.walk(child, `${sp}.${key}`, env);
      }
    }
  }
  walk(value, path = '$', env = this.env) {
    if (Array.isArray(value)) { value.forEach((item, index) => this.walk(item, `${path}[${index}]`, env)); return; }
    if (!value || typeof value !== 'object') return;
    if (value.kind && ['literal','var','list','map','access','index','unary','binary','call'].includes(value.kind)) { this.infer(value, path, env); return; }
    for (const [key, child] of Object.entries(value)) if (key !== '__jmPath') this.walk(child, `${path}.${key}`, env);
  }
  analyse(ast) {
    annotateJMPaths(ast);
    for (const global of ast.globals ?? []) this.bind(global.name, jmTypeName(global.type) === 'any' ? this.infer(global.value, global.__jmPath) : global.type, global.__jmPath, 'global');
    for (const fn of ast.functions ?? []) this.functions.set(fn.name, fn);
    for (const entity of [...(ast.entities ?? []), ...(ast.states ?? [])]) {
      for (const field of entity.fields ?? []) this.bind(`${entity.name}.${field.name}`, field.type, field.__jmPath, entity.kind ?? 'field');
    }
    for (const fn of ast.functions ?? []) {
      const local = new Map(this.env);
      for (const param of fn.params ?? []) local.set(param.name, jmTypeName(param.type));
      this.inspectStatements(fn.body ?? [], local, jmTypeName(fn.returnType), `${fn.__jmPath}.body`);
    }
    for (const flow of ast.flows ?? []) {
      const local = new Map(this.env);
      for (const source of flow.from ?? []) local.set(source, 'map');
      this.inspectStatements(flow.mappings ?? flow.body ?? [], local, 'any', `${flow.__jmPath}.body`);
    }
    for (const route of ast.routes ?? []) {
      for (const handler of route.handlers ?? []) {
        const local = new Map(this.env);
        for (const param of handler.params ?? []) local.set(param.name, jmTypeName(param.type));
        this.inspectStatements(handler.body ?? [], local, 'any', `${handler.__jmPath}.body`);
      }
    }
    for (const flow of ast.flows ?? []) for (const step of flow.steps ?? []) this.inspectStatements(step.body ?? [], new Map(this.env), 'any', `${step.__jmPath}.body`);
    for (const rule of ast.rules ?? []) {
      const condition = this.infer(rule.condition ?? rule.when, `${rule.__jmPath}.condition`, this.env);
      if (!jmTypeCompatible('bool', condition)) this.add('SEMANTIC_RULE_CONDITION', `Rule ${rule.name} condition should be bool but is ${condition}`, rule.__jmPath);
      this.walk(rule.action ?? rule.then, `${rule.__jmPath}.action`, this.env);
      this.effects.add('rule-action');
    }
    this.walk(ast, '$', this.env);
    const errors = this.diagnostics.filter((item) => item.severity === 'error').length;
    const warnings = this.diagnostics.filter((item) => item.severity === 'warning').length;
    const result = {
      body: this.bodyId,
      status: errors === 0 ? 'PASS' : 'HOLD',
      errors,
      warnings,
      bindings: deepClone(this.bindings),
      effects: [...this.effects].sort(),
      diagnostics: deepClone(this.diagnostics),
    };
    result.digest = jmDigest(result);
    return result;
  }
}

function jmLiteral(value, path = null) {
  const node = { kind: 'literal', value: deepClone(value) };
  if (path) node.__jmPath = path;
  return node;
}

class JMOptimizer {
  constructor(bodyId = 'unknown') {
    this.bodyId = bodyId;
    this.changes = [];
  }
  note(kind, path, before, after) {
    this.changes.push({ kind, path, before: deepClone(before), after: deepClone(after) });
  }
  expression(expr, path = '$') {
    if (!expr || typeof expr !== 'object') return expr;
    const sourcePath = expr.__jmPath ?? path;
    if (expr.kind === 'binary') {
      const left = this.expression(expr.left, `${path}.left`);
      const right = this.expression(expr.right, `${path}.right`);
      const candidate = { ...expr, left, right };
      if (left?.kind === 'literal' && right?.kind === 'literal') {
        try {
          const value = evaluateExpression(candidate, new Scope());
          const folded = jmLiteral(value, sourcePath);
          this.note('constant-fold', sourcePath, candidate, folded);
          return folded;
        } catch (_) { return candidate; }
      }
      if (expr.op === '+' && right?.kind === 'literal' && right.value === 0) { this.note('identity-remove', sourcePath, candidate, left); return left; }
      if (expr.op === '*' && right?.kind === 'literal' && right.value === 1) { this.note('identity-remove', sourcePath, candidate, left); return left; }
      return candidate;
    }
    if (expr.kind === 'unary') {
      const value = this.expression(expr.value, `${path}.value`);
      const candidate = { ...expr, value };
      if (value?.kind === 'literal') {
        try {
          const folded = jmLiteral(evaluateExpression(candidate, new Scope()), sourcePath);
          this.note('constant-fold', sourcePath, candidate, folded);
          return folded;
        } catch (_) { return candidate; }
      }
      return candidate;
    }
    if (expr.kind === 'list') return { ...expr, items: (expr.items ?? []).map((item, index) => this.expression(item, `${path}.items[${index}]`)) };
    if (expr.kind === 'map') return { ...expr, entries: (expr.entries ?? []).map(([key, value], index) => [key, this.expression(value, `${path}.entries[${index}]`)]) };
    if (expr.kind === 'access') return { ...expr, object: this.expression(expr.object, `${path}.object`) };
    if (expr.kind === 'index') return { ...expr, object: this.expression(expr.object, `${path}.object`), index: this.expression(expr.index, `${path}.index`) };
    if (expr.kind === 'call') return { ...expr, callee: this.expression(expr.callee, `${path}.callee`), args: (expr.args ?? []).map((arg, index) => this.expression(arg, `${path}.args[${index}]`)) };
    return deepClone(expr);
  }
  statements(statements = [], path = '$.body') {
    const out = [];
    let terminal = false;
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      const sp = statement.__jmPath ?? `${path}[${index}]`;
      if (terminal) { this.note('dead-statement-remove', sp, statement, null); continue; }
      let next = this.node(statement, sp);
      if (next.kind === 'if' && next.condition?.kind === 'literal') {
        const chosen = next.condition.value ? next.then : next.otherwise;
        this.note('constant-branch', sp, next, chosen);
        const chosenOptimised = this.statements(chosen ?? [], `${sp}.${next.condition.value ? 'then' : 'otherwise'}`);
        out.push(...chosenOptimised);
        if (chosenOptimised.some((item) => ['return','hold','goto'].includes(item.kind))) terminal = true;
        continue;
      }
      out.push(next);
      if (['return','hold','goto'].includes(next.kind)) terminal = true;
    }
    return out;
  }
  node(value, path = '$') {
    if (Array.isArray(value)) return value.map((item, index) => this.node(item, `${path}[${index}]`));
    if (!value || typeof value !== 'object') return value;
    if (['literal','var','list','map','access','index','unary','binary','call'].includes(value.kind)) return this.expression(value, path);
    const next = { ...value };
    for (const [key, child] of Object.entries(value)) {
      if (key === '__jmPath') continue;
      if (Array.isArray(child) && ['body','then','otherwise','mappings'].includes(key)) next[key] = this.statements(child, `${path}.${key}`);
      else if (child && typeof child === 'object') next[key] = this.node(child, `${path}.${key}`);
    }
    return next;
  }
  optimise(ast) {
    const annotated = annotateJMPaths(deepClone(ast));
    const optimizedAst = this.node(annotated, '$');
    annotateJMPaths(optimizedAst);
    const result = {
      body: this.bodyId,
      status: 'PASS',
      changed: this.changes.length,
      changes: deepClone(this.changes),
      ast: optimizedAst,
    };
    result.digest = jmDigest({ body: result.body, changed: result.changed, changes: result.changes, ast: result.ast });
    return result;
  }
}

class JMContractRegistry {
  constructor() { this.contracts = new Map(); }
  register(contract) {
    invariant(contract?.body, 'Contract requires body');
    const record = deepClone(contract);
    record.input = jmTypeName(record.input ?? 'any');
    record.output = jmTypeName(record.output ?? 'any');
    record.effects = [...new Set(record.effects ?? [])].sort();
    record.digest = jmDigest({ ...record, digest: undefined });
    this.contracts.set(normaliseName(record.body), record);
    return deepClone(record);
  }
  get(body) { return deepClone(this.contracts.get(normaliseName(body)) ?? null); }
  verify(body, value, direction = 'input') {
    const contract = this.contracts.get(normaliseName(body));
    invariant(contract, `No contract for ${body}`);
    const expected = contract[direction] ?? 'any';
    const actual = jmTypeOfValue(value);
    return { body: normaliseName(body), direction, expected, actual, status: jmTypeCompatible(expected, actual) ? 'PASS' : 'HOLD' };
  }
  manifest() { return [...this.contracts.values()].map(deepClone); }
}

function jmDebugClone(value) {
  const seen = new WeakSet();
  try {
    return JSON.parse(JSON.stringify(value, (_key, item) => {
      if (typeof item === 'function') return `[Function:${item.name || 'anonymous'}]`;
      if (typeof item === 'bigint') return String(item);
      if (item && typeof item === 'object') {
        if (seen.has(item)) return '[Circular]';
        seen.add(item);
        if (item instanceof Map) return Object.fromEntries(item);
        if (item instanceof Set) return [...item];
      }
      return item;
    }));
  } catch (_) { return String(value); }
}

class JMDebugSession {
  constructor({ breakpoints = [], watches = [] } = {}) {
    this.breakpoints = deepClone(breakpoints);
    this.watches = [...watches];
    this.frames = [];
    this.cursor = -1;
    this.runtime = null;
    this.ir = null;
    this.result = null;
  }
  attach(runtime, ir = null) {
    this.runtime = runtime;
    this.ir = ir;
    runtime.debugger = this;
    runtime.trace.debugger = this;
    return this;
  }
  matches(frame) {
    return this.breakpoints.some((bp) => {
      if (bp.body && normaliseName(bp.body) !== normaliseName(frame.body)) return false;
      if (bp.kind && bp.kind !== frame.kind && bp.kind !== frame.statementKind) return false;
      if (bp.path && !(frame.path ?? '').includes(bp.path)) return false;
      if (bp.event && bp.event !== frame.event?.type) return false;
      if (bp.symbol && bp.symbol !== frame.event?.symbol) return false;
      return true;
    });
  }
  evaluateWatches(scope = {}, event = null) {
    return Object.fromEntries(this.watches.map((path) => [path, getPath(scope, path, getPath(event ?? {}, path, null))]));
  }
  statement(info) {
    const frame = {
      index: this.frames.length,
      mode: 'source',
      body: info.body,
      path: info.path,
      statementKind: info.kind,
      phase: info.phase,
      scope: jmDebugClone(info.scope),
      control: jmDebugClone(info.control),
      watches: this.evaluateWatches(info.scope),
    };
    frame.breakpoint = this.matches(frame);
    this.frames.push(frame);
  }
  record(event) {
    const frame = {
      index: this.frames.length,
      mode: 'trace',
      body: event.body,
      event: jmDebugClone(event),
      path: event.path ?? null,
      watches: this.evaluateWatches({}, event),
    };
    frame.breakpoint = this.matches(frame);
    this.frames.push(frame);
  }
  run(runtime, input = {}, ir = null) {
    this.attach(runtime, ir);
    this.frames.push({ index: this.frames.length, mode: 'lifecycle', body: runtime.bodyId, event: { type: 'debug-start', input: jmDebugClone(input) }, breakpoint: false, watches: {} });
    const value = runtime.run(input);
    const receipt = runtime.receipt?.() ?? { status: runtime.held ? 'HOLD' : 'PASS', trace: runtime.trace.events };
    const replay = new TraceReplay().replay(receipt.trace ?? []);
    this.frames.push({ index: this.frames.length, mode: 'lifecycle', body: runtime.bodyId, event: { type: 'debug-end', status: receipt.status, value: jmDebugClone(value) }, breakpoint: false, watches: {} });
    this.result = { value: jmDebugClone(value), receipt: jmDebugClone(receipt), replay };
    this.cursor = this.frames.length ? 0 : -1;
    return this.snapshot();
  }
  current() { return this.cursor >= 0 ? deepClone(this.frames[this.cursor]) : null; }
  step(delta = 1) {
    if (!this.frames.length) return null;
    this.cursor = Math.max(0, Math.min(this.frames.length - 1, this.cursor + delta));
    return this.current();
  }
  nextBreakpoint() {
    if (!this.frames.length) return null;
    for (let index = this.cursor + 1; index < this.frames.length; index += 1) {
      if (this.frames[index].breakpoint) { this.cursor = index; return this.current(); }
    }
    return null;
  }
  previousBreakpoint() {
    for (let index = this.cursor - 1; index >= 0; index -= 1) {
      if (this.frames[index].breakpoint) { this.cursor = index; return this.current(); }
    }
    return null;
  }
  snapshot() {
    const snapshot = {
      status: this.result?.receipt?.status ?? 'PASS',
      frameCount: this.frames.length,
      breakpointCount: this.frames.filter((frame) => frame.breakpoint).length,
      cursor: this.cursor,
      current: this.current(),
      frames: deepClone(this.frames),
      result: deepClone(this.result),
    };
    snapshot.digest = jmDigest(snapshot);
    return snapshot;
  }
}

class JMContractPipeline extends EstatePipeline {
  constructor(host = new EstateHost(), options = {}) {
    super(host, options);
    this.contracts = options.contracts ?? host.contractRegistry ?? new JMContractRegistry();
  }
  add(stage) {
    super.add(stage);
    return this;
  }
  run(initial = {}) {
    const mountedBefore = new Map(this.host.runtimes);
    const deliveryLength = this.host.delivery.outputs.length;
    const hops = [];
    let previous = deepClone(initial);
    let status = 'PASS';
    this.trace.push('contract-pipeline-start', { id: this.id, stages: this.stages.length });
    try {
      for (const stage of this.stages) {
        const body = this.host.getBody(stage.body);
        const input = typeof stage.input === 'function'
          ? stage.input({ initial: deepClone(initial), previous: deepClone(previous), hops: deepClone(hops) })
          : deepClone(stage.input ?? previous ?? {});
        const contract = body.contract(stage.source, { input: stage.accepts ?? 'any', output: stage.produces ?? 'any' });
        this.contracts.register(contract);
        const inputCheck = this.contracts.verify(body.id, input, 'input');
        invariant(inputCheck.status === 'PASS', `${body.name} input contract HOLD: expected ${inputCheck.expected}, received ${inputCheck.actual}`);
        const validation = body.validate(stage.source);
        invariant(validation.status === 'PASS', `${body.name} validation HOLD`);
        const ir = body.compile(stage.source);
        const runtime = body.createRuntime(ir, this.host);
        const value = runtime.run(input ?? {});
        const outputCheck = this.contracts.verify(body.id, value, 'output');
        invariant(outputCheck.status === 'PASS', `${body.name} output contract HOLD: expected ${outputCheck.expected}, received ${outputCheck.actual}`);
        const receipt = runtime.receipt?.() ?? { status: runtime.held ? 'HOLD' : 'PASS', trace: runtime.trace?.events ?? [] };
        hops.push({ id: stage.id, body: body.id, contract, inputCheck, outputCheck, irDigest: ir.normalized.digest, value: deepClone(value), receipt: deepClone(receipt) });
        this.trace.push('contract-pipeline-hop', { body: body.id, status: receipt.status, contractDigest: contract.digest });
        if (receipt.status === 'HOLD' || runtime.held) { status = 'HOLD'; if (this.stopOnHold) break; }
        else this.host.mountRuntime(body.id, runtime);
        previous = value;
      }
    } catch (error) {
      status = 'HOLD';
      this.host.runtimes = mountedBefore;
      this.host.delivery.outputs.length = deliveryLength;
      this.trace.push('contract-pipeline-rollback', { message: error.message });
      return { id: this.id, status, error: error.message, hops, rolledBack: true, receipt: this.trace.receipt(status, { hops, rolledBack: true, error: error.message }) };
    }
    this.trace.push('contract-pipeline-end', { id: this.id, status, hops: hops.length });
    return { id: this.id, status, value: deepClone(previous), hops, rolledBack: false, receipt: this.trace.receipt(status, { hops, rolledBack: false }) };
  }
}

const jmE2Validate = CodingBody.prototype.validate;
const jmE2Compile = CodingBody.prototype.compile;
const jmE2CreateRuntime = CodingBody.prototype.createRuntime;
const jmE2Manifest = CodingBody.prototype.manifest;

CodingBody.prototype.semantic = function semantic(sourceOrAst) {
  const ast = typeof sourceOrAst === 'string' ? this.parse(sourceOrAst) : deepClone(sourceOrAst);
  return new JMSemanticAnalyzer(this.id).analyse(ast);
};
CodingBody.prototype.optimise = function optimise(sourceOrAst) {
  const ast = typeof sourceOrAst === 'string' ? this.parse(sourceOrAst) : deepClone(sourceOrAst);
  return new JMOptimizer(this.id).optimise(ast);
};
CodingBody.prototype.validate = function validateE3(sourceOrAst) {
  const structural = jmE2Validate.call(this, sourceOrAst);
  const semantic = this.semantic(sourceOrAst);
  const diagnostics = [...structural.diagnostics, ...semantic.diagnostics];
  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  const warnings = diagnostics.filter((item) => item.severity === 'warning').length;
  const result = {
    body: this.id,
    status: errors === 0 ? 'PASS' : 'HOLD',
    errors,
    warnings,
    diagnostics,
    symbols: structural.symbols,
    semantic,
  };
  result.digest = jmDigest(result);
  return result;
};
CodingBody.prototype.compile = function compileE3(sourceOrAst) {
  const base = jmE2Compile.call(this, sourceOrAst);
  const semantic = this.semantic(base.ast);
  const optimization = this.optimise(base.ast);
  const normalized = new JMIRNormalizer(this.id).lower(optimization.ast);
  return {
    ...base,
    version: '3.0-jm',
    validation: this.validate(base.ast),
    semantic,
    optimization: { ...optimization, ast: undefined },
    optimizedAst: optimization.ast,
    normalized,
  };
};
CodingBody.prototype.createRuntime = function createRuntimeE3(programOrIr, host = null) {
  if (programOrIr?.optimizedAst) return this.runtimeFactory(programOrIr.optimizedAst, host);
  return jmE2CreateRuntime.call(this, programOrIr, host);
};
CodingBody.prototype.contract = function contract(sourceOrAst, overrides = {}) {
  const semantic = this.semantic(sourceOrAst);
  const contract = {
    body: this.id,
    version: '3.0-jm',
    input: overrides.input ?? 'any',
    output: overrides.output ?? 'any',
    effects: semantic.effects,
    semanticDigest: semantic.digest,
  };
  contract.digest = jmDigest(contract);
  return contract;
};
CodingBody.prototype.debug = function debug(sourceOrAst, input = {}, options = {}, host = new EstateHost()) {
  const ir = this.compile(sourceOrAst);
  const runtime = this.createRuntime(ir, host);
  host.mountRuntime(this.id, runtime);
  const session = new JMDebugSession(options);
  return { session, proof: session.run(runtime, input, ir), ir };
};
CodingBody.prototype.manifest = function manifestE3() {
  return {
    ...jmE2Manifest.call(this),
    version: '3.0-jm',
    sourceState: 'implemented-v0.3',
    elevation: {
      level: 'JM-E3',
      equalised: true,
      guarantees: ['structural-validation','semantic-type-inference','normalised-ir','optimisation','source-trace-debugging','body-contracts','project-persistence','trace-replay','transactional-pipeline'],
    },
  };
};

for (const body of BODY_DEFINITIONS) {
  body.version = '3.0-jm';
  for (const capability of ['can-infer-types','can-optimise','can-debug','can-contract']) body.capabilities.add(capability);
}

EstateHost.prototype.contractRegistry = new JMContractRegistry();
EstateHost.prototype.createDebugger = function createDebugger(options = {}) { return new JMDebugSession(options); };
EstateHost.prototype.createContractPipeline = function createContractPipeline(options = {}) { return new JMContractPipeline(this, { ...options, contracts: options.contracts ?? this.contractRegistry }); };

const jmE2EstateManifest = EstateHost.prototype.manifest;
EstateHost.prototype.manifest = function estateManifestE3() {
  const manifest = jmE2EstateManifest.call(this);
  return {
    ...manifest,
    version: VERSION,
    build: BUILD_ID,
    elevation: {
      level: 'JM-E3',
      equalisedBodies: this.bodies.size,
      semantics: 'body-aware semantic type inference',
      optimiser: 'constant folding, branch pruning and dead statement removal',
      debugger: 'deterministic source/trace timeline with breakpoints, watches and reverse navigation',
      contracts: 'digest-bound body input/output/effect contracts',
      inherited: ['normalised-ir','project-persistence','trace-replay','transactional-pipeline'],
    },
  };
};

// -----------------------------------------------------------------------------
// JM-E4 — live continuations, checkpoint rewind, linked projects and proof ledger
// -----------------------------------------------------------------------------

class JMProofLedger {
  constructor(id = 'jm-proof-ledger') {
    this.id = id;
    this.entries = [];
  }
  append(type, payload = {}) {
    const previous = this.entries.at(-1)?.digest ?? 'JM-GENESIS';
    const core = {
      ledger: this.id,
      index: this.entries.length,
      type,
      previous,
      payload: deepClone(payload),
    };
    const entry = { ...core, digest: jmDigest(core) };
    this.entries.push(entry);
    return deepClone(entry);
  }
  verify() {
    const failures = [];
    let previous = 'JM-GENESIS';
    this.entries.forEach((entry, index) => {
      const core = {
        ledger: entry.ledger,
        index: entry.index,
        type: entry.type,
        previous: entry.previous,
        payload: entry.payload,
      };
      const expected = jmDigest(core);
      if (entry.index !== index) failures.push({ index, code: 'INDEX_MISMATCH' });
      if (entry.previous !== previous) failures.push({ index, code: 'PREVIOUS_MISMATCH' });
      if (entry.digest !== expected) failures.push({ index, code: 'DIGEST_MISMATCH' });
      previous = entry.digest;
    });
    const result = {
      id: this.id,
      status: failures.length ? 'HOLD' : 'PASS',
      entryCount: this.entries.length,
      head: this.entries.at(-1)?.digest ?? 'JM-GENESIS',
      failures,
    };
    result.digest = jmDigest(result);
    return result;
  }
  snapshot() {
    return {
      id: this.id,
      entries: deepClone(this.entries),
      verification: this.verify(),
    };
  }
}


function jmLiteralFromAst(expr) {
  if (!expr) return null;
  if (expr.kind === 'literal') return deepClone(expr.value);
  try { return evaluateExpression(expr, new Scope({}), null); } catch (_) { return null; }
}

function jmLiveBinary(op, left, right) {
  switch (op) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/': return left / right;
    case '%': return left % right;
    case '==': return left === right;
    case '!=': return left !== right;
    case '<': return left < right;
    case '<=': return left <= right;
    case '>': return left > right;
    case '>=': return left >= right;
    case 'and': case '&&': return Boolean(left) && Boolean(right);
    case 'or': case '||': return Boolean(left) || Boolean(right);
    default: throw new JMError(`Unknown live binary operator ${op}`);
  }
}

function jmLiveUnary(op, value) {
  if (op === 'not' || op === '!') return !value;
  if (op === '-') return -Number(value);
  throw new JMError(`Unknown live unary operator ${op}`);
}

class JMContinuationCompiler {
  constructor(bodyId = 'unknown') {
    this.bodyId = bodyId;
  }
  emit(code, op, data = {}, path = '$') {
    const instruction = { index: code.length, op, path, ...deepClone(data) };
    code.push(instruction);
    return instruction.index;
  }
  expression(expr, code, path = '$.expr') {
    if (!expr) { this.emit(code, 'PUSH', { value: null }, path); return; }
    switch (expr.kind) {
      case 'literal': this.emit(code, 'PUSH', { value: deepClone(expr.value) }, path); break;
      case 'var': this.emit(code, 'LOAD', { target: expr.name }, path); break;
      case 'access': {
        const direct = astPath(expr);
        if (direct) this.emit(code, 'LOAD', { target: direct.join('.') }, path);
        else { this.expression(expr.object, code, `${path}.object`); this.emit(code, 'GET_PROP', { property: expr.property }, path); }
        break;
      }
      case 'index':
        this.expression(expr.object, code, `${path}.object`);
        this.expression(expr.index, code, `${path}.index`);
        this.emit(code, 'GET_INDEX', {}, path);
        break;
      case 'list':
        (expr.items ?? []).forEach((item, index) => this.expression(item, code, `${path}.items[${index}]`));
        this.emit(code, 'BUILD_LIST', { count: (expr.items ?? []).length }, path);
        break;
      case 'map':
        (expr.entries ?? []).forEach(([key, value], index) => this.expression(value, code, `${path}.entries[${index}].${key}`));
        this.emit(code, 'BUILD_MAP', { keys: (expr.entries ?? []).map(([key]) => key) }, path);
        break;
      case 'unary':
        this.expression(expr.value, code, `${path}.value`);
        this.emit(code, 'UNARY', { operator: expr.op }, path);
        break;
      case 'binary':
        this.expression(expr.left, code, `${path}.left`);
        this.expression(expr.right, code, `${path}.right`);
        this.emit(code, 'BINARY', { operator: expr.op }, path);
        break;
      case 'call': {
        const target = jmPathOfExpression(expr.callee);
        invariant(target, 'Live continuation requires a named call target');
        (expr.args ?? []).forEach((arg, index) => this.expression(arg, code, `${path}.args[${index}]`));
        this.emit(code, 'CALL', { target, argc: (expr.args ?? []).length }, path);
        break;
      }
      default:
        this.emit(code, 'PUSH', { value: null, unsupportedExpression: expr.kind }, path);
    }
  }
  statements(statements = [], code, path = '$.body', options = {}) {
    for (let index = 0; index < statements.length; index += 1) {
      const statement = statements[index];
      const sp = statement.__jmPath ?? `${path}[${index}]`;
      switch (statement.kind) {
        case 'let':
          this.expression(statement.value, code, `${sp}.value`);
          this.emit(code, 'DECLARE', { target: statement.name, declaredType: jmTypeName(statement.type) }, sp);
          break;
        case 'set': {
          this.expression(statement.value, code, `${sp}.value`);
          let target = (astPath(statement.target) ?? ['value']).join('.');
          if (options.targetPrefix && !target.includes('.')) target = `${options.targetPrefix}.${target}`;
          this.emit(code, 'STORE', { target }, sp);
          break;
        }
        case 'if': {
          this.expression(statement.condition, code, `${sp}.condition`);
          const jf = this.emit(code, 'JUMP_IF_FALSE', { target: null }, sp);
          this.statements(statement.then ?? [], code, `${sp}.then`, options);
          if ((statement.otherwise ?? []).length) {
            const je = this.emit(code, 'JUMP', { target: null }, sp);
            code[jf].target = code.length;
            this.statements(statement.otherwise ?? [], code, `${sp}.otherwise`, options);
            code[je].target = code.length;
          } else code[jf].target = code.length;
          break;
        }
        case 'if-goto':
          this.expression(statement.condition, code, `${sp}.condition`);
          this.emit(code, 'JUMP_IF_TRUE_LABEL', { label: statement.target }, sp);
          break;
        case 'return':
          this.expression(statement.value, code, `${sp}.value`);
          this.emit(code, 'RETURN', {}, sp);
          break;
        case 'emit': case 'ding': case 'trace': case 'say': case 'phase':
          this.expression(statement.value, code, `${sp}.value`);
          this.emit(code, statement.kind.toUpperCase().replace('-', '_'), {}, sp);
          break;
        case 'collapse':
          this.expression(statement.label, code, `${sp}.label`);
          this.emit(code, 'COLLAPSE', {}, sp);
          break;
        case 'symbolise':
          this.expression(statement.name, code, `${sp}.name`);
          this.expression(statement.value, code, `${sp}.value`);
          this.emit(code, 'SYMBOLISE', {}, sp);
          break;
        case 'deliver':
          this.expression(statement.value, code, `${sp}.value`);
          this.emit(code, 'DELIVER', { channel: statement.channel }, sp);
          break;
        case 'hold': this.emit(code, 'HOLD', {}, sp); break;
        case 'resume': this.emit(code, 'RESUME', {}, sp); break;
        case 'goto': this.emit(code, 'JUMP_LABEL', { label: statement.target }, sp); break;
        case 'body-call':
          (statement.args ?? []).forEach((arg, ai) => this.expression(arg, code, `${sp}.args[${ai}]`));
          this.emit(code, 'BODY_CALL', { target: statement.target, argc: (statement.args ?? []).length }, sp);
          break;
        case 'fusion-call':
          this.expression(statement.route, code, `${sp}.route`);
          this.emit(code, 'FUSION_CALL', {}, sp);
          break;
        case 'formula-generate':
          this.emit(code, 'FORMULA_GENERATE', { formula: statement.formula, gate: statement.gate }, sp);
          break;
        case 'expr-call':
          (statement.args ?? []).forEach((arg, ai) => this.expression(arg, code, `${sp}.args[${ai}]`));
          this.emit(code, 'CALL', { target: (astPath(statement.target) ?? ['unknown']).join('.'), argc: (statement.args ?? []).length }, sp);
          this.emit(code, 'POP', {}, sp);
          break;
        default:
          this.emit(code, 'NOOP', { statementKind: statement.kind }, sp);
      }
    }
  }
  resolveLabels(fn) {
    const labels = fn.labels ?? {};
    for (const instruction of fn.code) {
      if (instruction.op === 'JUMP_LABEL' || instruction.op === 'JUMP_IF_TRUE_LABEL') {
        invariant(Object.hasOwn(labels, instruction.label), `Unknown live label ${instruction.label}`);
        instruction.target = labels[instruction.label];
      }
    }
    return fn;
  }
  compileAssembly(ast, name = 'main', path = '$.code') {
    const code = [];
    const labels = {};
    const rawToLive = new Map();
    (ast.code ?? []).forEach((instruction, index) => {
      rawToLive.set(index, code.length);
      this.emit(code, 'VM', { vmOp: instruction.op, args: deepClone(instruction.args ?? []), rawLine: instruction.line ?? index + 1 }, `${path}[${index}]`);
    });
    for (const [label, rawIndex] of Object.entries(ast.labels ?? {})) labels[label] = rawToLive.get(rawIndex) ?? rawIndex;
    return { name, params: [], code, labels, mode: 'vm' };
  }
  compile(body, ast, input = {}) {
    const program = {
      kind: 'jm-live-program',
      version: '4.0-jm',
      body: body.id,
      functions: {},
      entry: 'main',
      initial: { globals: {}, outputs: [], registry: {}, metadata: {} },
    };
    const addFunction = (name, params, code, labels = {}, mode = 'source') => {
      program.functions[name] = this.resolveLabels({ name, params: deepClone(params ?? []), code, labels, mode });
    };
    const literalValue = (expr, fallback = null) => {
      try { return evaluateExpression(expr, new Scope(program.initial.globals), null); }
      catch (_) { return fallback; }
    };
    switch (body.id) {
      case 'cading': {
        for (const global of ast.globals ?? []) program.initial.globals[global.name] = literalValue(global.value);
        for (const fn of ast.functions ?? []) {
          const code = [];
          this.statements(fn.body ?? [], code, fn.__jmPath ?? `$.functions.${fn.name}`);
          if (!code.length || code.at(-1).op !== 'RETURN') { this.emit(code, 'PUSH', { value: null }); this.emit(code, 'RETURN'); }
          addFunction(fn.name, fn.params ?? [], code);
        }
        program.entry = input.entry ?? (program.functions.main ? 'main' : Object.keys(program.functions)[0]);
        program.entryArgs = deepClone(input.args ?? []);
        break;
      }
      case 'kading': {
        const flow = (ast.flows ?? []).find((item) => item.name === input.flow) ?? ast.flows?.[0];
        invariant(flow, 'Kading live flow missing');
        program.initial.globals = { ...(deepClone(input.sources ?? {})), target: {} };
        const code = [];
        this.statements(flow.mappings ?? [], code, flow.__jmPath ?? `$.flows.${flow.name}`, { targetPrefix: 'target' });
        this.emit(code, 'LOAD', { target: 'target' }); this.emit(code, 'RETURN');
        addFunction(flow.name, [], code); program.entry = flow.name;
        break;
      }
      case 'jmlogic': {
        program.initial.globals = { ...(deepClone(input.context ?? {})), actions: [] };
        const code = [];
        const rules = [...(ast.rules ?? [])].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        rules.forEach((rule, index) => {
          this.expression(rule.condition, code, `${rule.__jmPath ?? `$.rules[${index}]`}.condition`);
          const jump = this.emit(code, 'JUMP_IF_FALSE', { target: null }, rule.__jmPath ?? `$.rules[${index}]`);
          this.emit(code, 'RULE_ACTION', { rule: rule.name, action: deepClone(rule.action) }, rule.__jmPath ?? `$.rules[${index}]`);
          code[jump].target = code.length;
        });
        this.emit(code, 'LOAD', { target: 'actions' }); this.emit(code, 'RETURN');
        addFunction('evaluate', [], code); program.entry = 'evaluate';
        break;
      }
      case 'flowtalk': {
        const flow = (ast.flows ?? []).find((item) => item.name === input.flow) ?? ast.flows?.[0];
        invariant(flow, 'FlowTalk live flow missing');
        program.initial.globals = deepClone(input.context ?? {});
        const code = [], labels = {};
        for (const step of flow.steps ?? []) {
          labels[step.name] = code.length;
          this.statements(step.body ?? [], code, `$.flows.${flow.name}.steps.${step.name}`);
        }
        this.emit(code, 'LOAD_OUTPUTS'); this.emit(code, 'RETURN');
        addFunction(flow.name, [], code, labels); program.entry = flow.name;
        break;
      }
      case 'route-code': {
        const route = (ast.routes ?? []).find((item) => item.name === input.route) ?? ast.routes?.[0];
        const handler = (route?.handlers ?? []).find((item) => item.event === input.event) ?? route?.handlers?.[0];
        invariant(route && handler, 'Route-Code live route missing');
        program.initial.globals = deepClone(input.context ?? {});
        const code = [];
        this.statements(handler.body ?? [], code, `$.routes.${route.name}.${handler.event}`);
        this.emit(code, 'LOAD_GLOBALS'); this.emit(code, 'RETURN');
        addFunction(`${route.name}:${handler.event}`, handler.params ?? [], code);
        program.entry = `${route.name}:${handler.event}`; program.entryArgs = deepClone(input.args ?? []);
        break;
      }
      case 'quadze': {
        for (const entity of ast.entities ?? []) {
          program.initial.globals[entity.name] = {};
          for (const field of entity.fields ?? []) program.initial.globals[entity.name][field.name] = literalValue(field.initial);
        }
        for (const state of ast.states ?? []) {
          program.initial.globals[state.name] = {};
          for (const field of state.fields ?? []) program.initial.globals[state.name][field.name] = literalValue(field.initial);
        }
        const code = [];
        for (const route of ast.routes ?? []) {
          const start = (route.handlers ?? []).find((handler) => handler.event === 'start');
          if (start) this.statements(start.body ?? [], code, `$.routes.${route.name}.start`);
        }
        const ticks = Math.max(0, Number(input.ticks ?? 1));
        for (let tick = 0; tick < ticks; tick += 1) {
          for (const route of ast.routes ?? []) {
            const handler = (route.handlers ?? []).find((item) => item.event === 'tick');
            if (handler) this.statements(handler.body ?? [], code, `$.routes.${route.name}.tick[${tick}]`);
          }
        }
        this.emit(code, 'LOAD_GLOBALS'); this.emit(code, 'RETURN');
        addFunction('game', [], code); program.entry = 'game';
        break;
      }
      case 'formula-born-code': {
        program.initial.globals = deepClone(input.context ?? {});
        const formula = (ast.formulas ?? []).find((item) => item.name === input.formula) ?? ast.formulas?.[0];
        const gate = (formula?.gates ?? []).find((item) => item.name === input.gate) ?? formula?.gates?.[0];
        invariant(formula && gate, 'Formula-Born live gate missing');
        const code = [];
        (gate.glyphs ?? []).forEach((glyph, index) => {
          this.expression(glyph.when ?? { kind: 'literal', value: true }, code, `$.glyphs[${index}].when`);
          const jump = this.emit(code, 'JUMP_IF_FALSE', { target: null }, `$.glyphs[${index}]`);
          this.emit(code, 'GLYPH', { glyph: deepClone(glyph), formula: formula.name, gate: gate.name }, `$.glyphs[${index}]`);
          code[jump].target = code.length;
        });
        this.emit(code, 'LOAD_OUTPUTS'); this.emit(code, 'RETURN');
        addFunction(`${formula.name}:${gate.name}`, [], code); program.entry = `${formula.name}:${gate.name}`;
        break;
      }
      case 'contactcode': {
        program.initial.globals = deepClone(input);
        const rule = (ast.rules ?? []).find((item) => item.left === input.left && item.right === input.right && item.relation === input.relation) ?? ast.rules?.[0];
        const code = [];
        if (rule) this.statements(rule.body ?? [], code, '$.rules.contact');
        this.emit(code, 'LOAD_OUTPUTS'); this.emit(code, 'RETURN');
        addFunction('contact', [], code); program.entry = 'contact';
        break;
      }
      case 'cadenvm': case 'jmvm': {
        const fn = this.compileAssembly(ast, 'main'); program.functions.main = fn; program.entry = 'main'; break;
      }
      case 'routevm': {
        const route = (ast.routes ?? []).find((item) => item.name === input.route) ?? ast.routes?.[0];
        invariant(route, 'RouteVM live route missing');
        const fn = this.compileAssembly(route.program, route.name, `$.routes.${route.name}.code`);
        program.functions[route.name] = fn; program.entry = route.name; break;
      }
      case 'noncoding-code': {
        const text = String(input.text ?? '').toLowerCase();
        const action = (ast.phrases ?? []).find((item) => text.includes(String(item.phrase).toLowerCase()));
        const code = [];
        this.emit(code, 'ACTION', { action: deepClone(action ?? { actionType: 'none', value: null }) }, '$.phrases');
        this.emit(code, 'LOAD_OUTPUTS'); this.emit(code, 'RETURN'); addFunction('interpret', [], code); program.entry = 'interpret'; break;
      }
      case 'morseminus': {
        const code = [];
        this.emit(code, 'MORSE', { mode: input.mode ?? 'encode', value: input.value ?? '', map: deepClone(ast.map ?? {}), letterSeparator: ast.letterSeparator, wordSeparator: ast.wordSeparator }, '$.map');
        this.emit(code, 'LOAD_OUTPUTS'); this.emit(code, 'RETURN'); addFunction('signal', [], code); program.entry = 'signal'; break;
      }
      case 'mudra-code': {
        const action = (ast.gestures ?? []).find((item) => item.gesture === input.gesture);
        const code = [];
        this.emit(code, 'ACTION', { action: deepClone(action ?? { actionType: 'none', value: null }) }, '$.gestures');
        this.emit(code, 'LOAD_OUTPUTS'); this.emit(code, 'RETURN'); addFunction('gesture', [], code); program.entry = 'gesture'; break;
      }
      case 'jickma': {
        const raw = String(input.input ?? '');
        const action = [...(ast.sequences ?? []), ...(ast.marks ?? [])].sort((a,b)=>String(b.pattern).length-String(a.pattern).length).find((item) => raw.includes(item.pattern));
        const code = [];
        this.emit(code, 'ACTION', { action: deepClone(action ?? { actionType: 'none', value: null }) }, '$.sequences');
        this.emit(code, 'LOAD_OUTPUTS'); this.emit(code, 'RETURN'); addFunction('marks', [], code); program.entry = 'marks'; break;
      }
      default: {
        const code = [];
        for (const [index, command] of (ast.commands ?? []).entries()) this.emit(code, 'COMMAND', { command: command.command, args: deepClone(command.args ?? []) }, `$.commands[${index}]`);
        if (!(ast.commands ?? []).length) this.emit(code, 'NOOP', { bodyKind: ast.kind }, '$');
        this.emit(code, 'LOAD_REGISTRY'); this.emit(code, 'RETURN');
        addFunction(ast.name ?? 'main', [], code); program.entry = ast.name ?? 'main';
      }
    }
    invariant(program.functions[program.entry], `Live entry ${program.entry} was not compiled for ${body.id}`);
    program.digest = jmDigest(program);
    return program;
  }
}

class JMLiveContinuation {
  constructor(body, ir, input = {}, options = {}, host = new EstateHost()) {
    this.body = body;
    this.bodyId = body.id;
    this.ir = ir;
    this.input = deepClone(input ?? {});
    this.options = options;
    this.host = host;
    this.program = new JMContinuationCompiler(body.id).compile(body, ir.optimizedAst ?? ir.ast, this.input);
    this.trace = new TraceBox(`live:${body.id}`, host.clock);
    this.ledger = new JMProofLedger(`live:${body.id}:${this.program.digest}`);
    this.globals = deepClone(this.program.initial.globals ?? {});
    this.outputs = deepClone(this.program.initial.outputs ?? []);
    this.registry = deepClone(this.program.initial.registry ?? {});
    this.stack = [];
    this.frames = [];
    this.status = 'READY';
    this.result = null;
    this.held = false;
    this.stepCount = 0;
    this.breakpoints = deepClone(options.breakpoints ?? [{ op: 'DING' }, { op: 'HOLD' }, { op: 'RETURN' }]);
    this.checkpoints = [];
    this.lastInstruction = null;
    this.lastBreakpoint = null;
    this.pushFrame(this.program.entry, this.program.entryArgs ?? []);
    this.checkpoint('start');
    this.ledger.append('live-start', { body: this.bodyId, programDigest: this.program.digest, input: this.input });
  }
  pushFrame(name, args = []) {
    const fn = this.program.functions[name];
    invariant(fn, `Unknown live function ${name}`);
    const locals = {};
    (fn.params ?? []).forEach((param, index) => { locals[param.name ?? param] = deepClone(args[index]); });
    this.frames.push({ name, ip: 0, locals, code: fn.code, labels: fn.labels ?? {}, mode: fn.mode ?? 'source' });
    this.trace.push('live-frame-push', { name, depth: this.frames.length });
    return this.frames.at(-1);
  }
  frame() { return this.frames.at(-1) ?? null; }
  callStack() { return this.frames.map((frame) => ({ name: frame.name, ip: frame.ip, depth: this.frames.indexOf(frame), mode: frame.mode })); }
  get(target, frame = this.frame()) {
    const parts = String(target).split('.');
    const root = parts[0];
    let value;
    if (frame && Object.hasOwn(frame.locals, root)) value = frame.locals[root];
    else if (Object.hasOwn(this.globals, root)) value = this.globals[root];
    else if (Object.hasOwn(BUILTINS, root)) value = BUILTINS[root];
    else value = undefined;
    return parts.length === 1 ? value : getPath(value, parts.slice(1));
  }
  set(target, value, declare = false, frame = this.frame()) {
    const parts = String(target).split('.');
    const root = parts[0];
    if (parts.length === 1) {
      if (declare || (frame && Object.hasOwn(frame.locals, root))) frame.locals[root] = deepClone(value);
      else if (Object.hasOwn(this.globals, root)) this.globals[root] = deepClone(value);
      else frame.locals[root] = deepClone(value);
      return value;
    }
    let container;
    if (frame && Object.hasOwn(frame.locals, root)) container = frame.locals[root];
    else {
      if (!Object.hasOwn(this.globals, root) || this.globals[root] == null) this.globals[root] = {};
      container = this.globals[root];
    }
    setPath(container, parts.slice(1), deepClone(value));
    return value;
  }
  popArgs(count) {
    const args = [];
    for (let index = 0; index < count; index += 1) args.unshift(this.stack.pop());
    return args;
  }
  matchesBreakpoint(instruction) {
    return this.breakpoints.some((bp) => {
      if (bp.op && normaliseName(bp.op) !== normaliseName(instruction.op)) return false;
      if (bp.path && !String(instruction.path ?? '').includes(bp.path)) return false;
      if (bp.body && normaliseName(bp.body) !== this.bodyId) return false;
      return Boolean(bp.op || bp.path || bp.body);
    });
  }
  executeVM(instruction, frame) {
    const op = String(instruction.vmOp ?? '').toUpperCase();
    const args = instruction.args ?? [];
    switch (op) {
      case 'PUSH': case 'LOAD_CONST': this.stack.push(deepClone(args[0])); break;
      case 'LOAD': case 'LOAD_VAR': this.stack.push(deepClone(this.get(args[0], frame))); break;
      case 'STORE': case 'STORE_VAR': this.set(args[0], this.stack.pop(), false, frame); break;
      case 'ADD': this.stack.push(jmLiveBinary('+', this.stack.splice(-2, 1)[0], this.stack.pop())); break;
      case 'SUB': { const [a,b]=this.stack.splice(-2,2); this.stack.push(a-b); break; }
      case 'MUL': { const [a,b]=this.stack.splice(-2,2); this.stack.push(a*b); break; }
      case 'DIV': { const [a,b]=this.stack.splice(-2,2); this.stack.push(a/b); break; }
      case 'MOD': { const [a,b]=this.stack.splice(-2,2); this.stack.push(a%b); break; }
      case 'CMP': { const [a,b]=this.stack.splice(-2,2); this.stack.push(jmLiveBinary(args[0] ?? '==',a,b)); break; }
      case 'DING': this.trace.ding(String(args[0] ?? this.stack.pop() ?? 'ding')); break;
      case 'EMIT': this.outputs.push({ channel: 'symbol', value: args[0] ?? this.stack.pop() }); break;
      case 'HOLD': this.held = true; this.trace.hold(this.bodyId); break;
      case 'RESUME': this.held = false; this.trace.push('resume', { body: this.bodyId }); break;
      case 'JUMP': frame.ip = Number(frame.labels[args[0]] ?? args[0] ?? frame.ip); break;
      case 'JUMP_IF_TRUE': if (this.stack.pop()) frame.ip = Number(frame.labels[args[0]] ?? args[0] ?? frame.ip); break;
      case 'JUMP_IF_FALSE': if (!this.stack.pop()) frame.ip = Number(frame.labels[args[0]] ?? args[0] ?? frame.ip); break;
      case 'RETURN': this.finishFrame(this.stack.pop()); break;
      case 'HALT': this.finishFrame(this.stack.at(-1) ?? deepClone(this.globals)); break;
      default: this.trace.push('live-vm-noop', { op, args });
    }
  }
  finishFrame(value) {
    const finished = this.frames.pop();
    this.trace.push('live-frame-pop', { name: finished?.name, value: deepClone(value), depth: this.frames.length });
    if (this.frames.length) this.stack.push(deepClone(value));
    else {
      this.result = deepClone(value);
      this.status = this.held ? 'HOLD' : 'COMPLETE';
    }
  }
  execute(instruction, frame) {
    switch (instruction.op) {
      case 'PUSH': this.stack.push(deepClone(instruction.value)); break;
      case 'LOAD': this.stack.push(deepClone(this.get(instruction.target, frame))); break;
      case 'STORE': this.set(instruction.target, this.stack.pop(), false, frame); this.trace.push('live-store', { target: instruction.target, value: this.get(instruction.target, frame) }); break;
      case 'DECLARE': this.set(instruction.target, this.stack.pop(), true, frame); this.trace.push('live-declare', { target: instruction.target, type: instruction.declaredType }); break;
      case 'GET_PROP': { const object = this.stack.pop(); this.stack.push(object instanceof Map ? object.get(instruction.property) : object?.[instruction.property]); break; }
      case 'GET_INDEX': { const index = this.stack.pop(), object = this.stack.pop(); this.stack.push(object instanceof Map ? object.get(index) : object?.[index]); break; }
      case 'BUILD_LIST': this.stack.push(this.popArgs(instruction.count)); break;
      case 'BUILD_MAP': { const values = this.popArgs(instruction.keys.length); this.stack.push(Object.fromEntries(instruction.keys.map((key,index)=>[key,values[index]]))); break; }
      case 'UNARY': this.stack.push(jmLiveUnary(instruction.operator, this.stack.pop())); break;
      case 'BINARY': { const [left,right] = this.stack.splice(-2,2); this.stack.push(jmLiveBinary(instruction.operator,left,right)); break; }
      case 'POP': this.stack.pop(); break;
      case 'CALL': {
        const args = this.popArgs(instruction.argc);
        if (this.program.functions[instruction.target]) this.pushFrame(instruction.target, args);
        else {
          const fn = BUILTINS[instruction.target];
          invariant(typeof fn === 'function', `Unknown live call ${instruction.target}`);
          this.stack.push(fn(...args));
        }
        break;
      }
      case 'JUMP': frame.ip = instruction.target; break;
      case 'JUMP_IF_FALSE': if (!this.stack.pop()) frame.ip = instruction.target; break;
      case 'JUMP_IF_TRUE_LABEL': if (this.stack.pop()) frame.ip = instruction.target; break;
      case 'JUMP_LABEL': frame.ip = instruction.target; break;
      case 'RETURN': this.finishFrame(this.stack.pop()); break;
      case 'DING': { const symbol = String(this.stack.pop()); this.trace.ding(symbol, { live: true }); this.outputs.push({ channel: 'ding', value: symbol }); break; }
      case 'EMIT': { const value = this.stack.pop(); this.outputs.push({ channel: 'symbol', value }); this.trace.push('emit', { value, live: true }); break; }
      case 'TRACE': this.trace.push('trace', { value: deepClone(this.stack.pop()), live: true }); break;
      case 'SAY': { const value = String(this.stack.pop()); this.outputs.push({ channel: 'text', value }); this.trace.push('say', { value, live: true }); break; }
      case 'PHASE': { const value = this.stack.pop(); if (this.globals.GameState) this.globals.GameState.phase = value; this.globals.phase = value; this.trace.push('phase', { value, live: true }); break; }
      case 'COLLAPSE': { const label = String(this.stack.pop()); const snapshot = { globals: deepClone(this.globals), outputs: deepClone(this.outputs), stack: deepClone(this.stack), callStack: this.callStack() }; this.trace.collapse(snapshot, label); break; }
      case 'SYMBOLISE': { const value = this.stack.pop(), name = String(this.stack.pop()); this.trace.symbolise(name, value, this.frame()?.name ?? null); this.outputs.push({ channel: 'symbolise', name, value }); break; }
      case 'DELIVER': { const value = this.stack.pop(); this.outputs.push({ channel: instruction.channel, value }); this.trace.push('deliver', { channel: instruction.channel, value, live: true }); break; }
      case 'HOLD': this.held = true; this.trace.hold(this.frame()?.name ?? this.bodyId); this.status = 'HOLD'; break;
      case 'RESUME': this.held = false; this.trace.push('resume', { route: this.frame()?.name ?? this.bodyId, live: true }); break;
      case 'BODY_CALL': { const args = this.popArgs(instruction.argc); this.outputs.push({ channel: 'body-call', target: instruction.target, args }); this.trace.push('body-call', { target: instruction.target, args, live: true }); break; }
      case 'FUSION_CALL': { const route = this.stack.pop(); this.outputs.push({ channel: 'fusion', route }); this.trace.push('fusion-call', { route, live: true }); break; }
      case 'FORMULA_GENERATE': this.outputs.push({ channel: 'formula', formula: instruction.formula, gate: instruction.gate }); this.trace.push('formula-generate', { formula: instruction.formula, gate: instruction.gate, live: true }); break;
      case 'RULE_ACTION': {
        const value = instruction.action?.value ?? instruction.action;
        const action = { rule: instruction.rule, action: deepClone(instruction.action), value };
        this.globals.actions.push(action); this.outputs.push({ channel: 'rule', value: action }); this.trace.push('rule-hit', action); break;
      }
      case 'GLYPH': {
        const glyph = {
          name: instruction.glyph.name,
          shape: jmLiteralFromAst(instruction.glyph.shape),
          tone: jmLiteralFromAst(instruction.glyph.tone),
          route: jmLiteralFromAst(instruction.glyph.route),
          identity: jmLiteralFromAst(instruction.glyph.identity),
          symbol: jmLiteralFromAst(instruction.glyph.symbol),
          weight: jmLiteralFromAst(instruction.glyph.weight),
          formula: instruction.formula,
          gate: instruction.gate,
        };
        this.outputs.push({ channel: 'glyph', value: glyph }); this.trace.push('glyph-out', { glyph, live: true }); break;
      }
      case 'ACTION': {
        const action = deepClone(instruction.action);
        this.outputs.push({ channel: action.actionType ?? 'none', value: action.value ?? null, source: action });
        this.trace.push('action', { action, live: true }); break;
      }
      case 'MORSE': {
        const map = instruction.map ?? {}, reverse = Object.fromEntries(Object.entries(map).map(([key,value])=>[value,key]));
        let value;
        if (instruction.mode === 'decode') value = String(instruction.value).split(instruction.wordSeparator ?? '/').map(word=>word.split(instruction.letterSeparator ?? ' ').map(token=>reverse[token] ?? '?').join('')).join(' ');
        else value = String(instruction.value).toUpperCase().split(' ').map(word=>[...word].map(char=>map[char] ?? '?').join(instruction.letterSeparator ?? ' ')).join(instruction.wordSeparator ?? '/');
        this.outputs.push({ channel: 'signal', value }); this.trace.push('signal', { mode: instruction.mode, value, live: true }); break;
      }
      case 'COMMAND': {
        if (!this.registry[instruction.command]) this.registry[instruction.command] = [];
        this.registry[instruction.command].push(deepClone(instruction.args));
        this.trace.push('command', { command: instruction.command, args: instruction.args, live: true }); break;
      }
      case 'LOAD_OUTPUTS': this.stack.push(deepClone(this.outputs)); break;
      case 'LOAD_GLOBALS': this.stack.push(deepClone(this.globals)); break;
      case 'LOAD_REGISTRY': this.stack.push(deepClone(this.registry)); break;
      case 'VM': this.executeVM(instruction, frame); break;
      case 'NOOP': this.trace.push('live-noop', { instruction: deepClone(instruction) }); break;
      default: throw new JMError(`Unknown live instruction ${instruction.op}`);
    }
  }
  step() {
    if (this.status === 'COMPLETE' || this.status === 'HOLD') return this.snapshot();
    this.status = 'RUNNING';
    let frame = this.frame();
    while (frame && frame.ip >= frame.code.length && this.status === 'RUNNING') {
      this.finishFrame(undefined);
      frame = this.frame();
    }
    if (!frame || this.status === 'COMPLETE' || this.status === 'HOLD') return this.snapshot();
    const instruction = frame.code[frame.ip];
    frame.ip += 1;
    this.execute(instruction, frame);
    this.stepCount += 1;
    this.lastInstruction = deepClone(instruction);
    const breakpoint = this.matchesBreakpoint(instruction);
    if (breakpoint) this.lastBreakpoint = { step: this.stepCount, instruction: deepClone(instruction) };
    this.trace.push('live-step', { step: this.stepCount, instruction: instruction.op, path: instruction.path, breakpoint, callDepth: this.frames.length });
    this.ledger.append('live-step', { step: this.stepCount, op: instruction.op, path: instruction.path, breakpoint, stateDigest: jmDigest({ globals: this.globals, stack: this.stack, frames: this.callStack(), outputs: this.outputs }) });
    this.checkpoint(`step-${this.stepCount}`);
    if (this.status === 'RUNNING') this.status = 'PAUSED';
    return this.snapshot();
  }
  resume({ maxSteps = 10000, stopOnBreakpoint = true } = {}) {
    if (this.status === 'COMPLETE' || this.status === 'HOLD') return this.snapshot();
    let count = 0;
    do {
      const before = this.stepCount;
      this.step();
      count += this.stepCount > before ? 1 : 0;
      if (this.status === 'COMPLETE' || this.status === 'HOLD') break;
      if (stopOnBreakpoint && this.lastBreakpoint?.step === this.stepCount) break;
    } while (count < maxSteps);
    if (count >= maxSteps && !['COMPLETE','HOLD'].includes(this.status)) this.status = 'PAUSED';
    this.ledger.append('live-resume', { executed: count, status: this.status, stepCount: this.stepCount });
    return this.snapshot();
  }
  runToEnd(maxSteps = 10000) {
    let guard = 0;
    while (!['COMPLETE','HOLD'].includes(this.status) && guard < maxSteps) {
      this.resume({ maxSteps: maxSteps - guard, stopOnBreakpoint: false });
      guard = this.stepCount;
    }
    invariant(guard < maxSteps || ['COMPLETE','HOLD'].includes(this.status), `Live continuation exceeded ${maxSteps} steps`);
    this.ledger.append('live-end', { status: this.status, steps: this.stepCount, result: this.result });
    return this.snapshot();
  }
  pause() {
    if (!['COMPLETE','HOLD'].includes(this.status)) this.status = 'PAUSED';
    this.ledger.append('live-pause', { stepCount: this.stepCount });
    return this.snapshot();
  }
  checkpoint(label = `checkpoint-${this.checkpoints.length}`) {
    const state = {
      label,
      stepCount: this.stepCount,
      status: this.status,
      globals: deepClone(this.globals),
      outputs: deepClone(this.outputs),
      registry: deepClone(this.registry),
      stack: deepClone(this.stack),
      frames: deepClone(this.frames),
      result: deepClone(this.result),
      held: this.held,
      traceEvents: deepClone(this.trace.events),
      traceSequence: this.trace.sequence,
      lastInstruction: deepClone(this.lastInstruction),
      lastBreakpoint: deepClone(this.lastBreakpoint),
    };
    state.id = jmDigest(state);
    this.checkpoints.push(state);
    return state.id;
  }
  restore(checkpointId) {
    const state = this.checkpoints.find((item) => item.id === checkpointId);
    invariant(state, `Unknown live checkpoint ${checkpointId}`);
    this.stepCount = state.stepCount;
    this.status = state.status;
    this.globals = deepClone(state.globals);
    this.outputs = deepClone(state.outputs);
    this.registry = deepClone(state.registry);
    this.stack = deepClone(state.stack);
    this.frames = deepClone(state.frames);
    this.result = deepClone(state.result);
    this.held = state.held;
    this.trace.events = deepClone(state.traceEvents);
    this.trace.sequence = state.traceSequence;
    this.lastInstruction = deepClone(state.lastInstruction);
    this.lastBreakpoint = deepClone(state.lastBreakpoint);
    this.checkpoints = this.checkpoints.slice(0, this.checkpoints.indexOf(state) + 1);
    this.ledger.append('live-restore', { checkpointId, stepCount: this.stepCount, status: this.status });
    return this.snapshot();
  }
  rewind(steps = 1) {
    const targetIndex = Math.max(0, this.checkpoints.length - 1 - Math.max(1, Number(steps)));
    return this.restore(this.checkpoints[targetIndex].id);
  }
  snapshot() {
    const proof = {
      body: this.bodyId,
      status: this.status,
      paused: this.status === 'PAUSED',
      complete: this.status === 'COMPLETE',
      held: this.held,
      stepCount: this.stepCount,
      current: deepClone(this.lastInstruction),
      breakpoint: deepClone(this.lastBreakpoint),
      callStack: this.callStack(),
      dataStack: deepClone(this.stack),
      globals: deepClone(this.globals),
      outputs: deepClone(this.outputs),
      registry: deepClone(this.registry),
      result: deepClone(this.result),
      checkpointCount: this.checkpoints.length,
      programDigest: this.program.digest,
      ledger: this.ledger.verify(),
      trace: deepClone(this.trace.events),
    };
    proof.digest = jmDigest(proof);
    return proof;
  }
  receipt() {
    const proof = this.snapshot();
    return {
      status: proof.status === 'HOLD' ? 'HOLD' : 'PASS',
      mode: 'live-continuation',
      body: this.bodyId,
      steps: proof.stepCount,
      result: proof.result,
      checkpointCount: proof.checkpointCount,
      ledger: this.ledger.snapshot(),
      trace: proof.trace,
      digest: proof.digest,
    };
  }
}

function jmBodyReferenceMap(host) {
  const map = new Map();
  for (const body of host.bodies.values()) {
    map.set(normaliseName(body.id), body.id);
    map.set(normaliseName(body.name), body.id);
  }
  return map;
}

function jmExtractDependencies(ast, host) {
  const aliases = jmBodyReferenceMap(host);
  const dependencies = new Set();
  const inspectText = (value) => {
    const key = normaliseName(String(value ?? '').replace(/\./g, '-'));
    for (const [alias, id] of aliases) if (key === alias || key.startsWith(`${alias}-`) || key.includes(alias)) dependencies.add(id);
  };
  const walk = (value) => {
    if (Array.isArray(value)) { value.forEach(walk); return; }
    if (!value || typeof value !== 'object') return;
    if (value.kind === 'body-call') inspectText(value.target);
    if (value.kind === 'formula-generate') dependencies.add('formula-born-code');
    if (value.command && Array.isArray(value.args)) value.args.forEach(inspectText);
    for (const child of Object.values(value)) walk(child);
  };
  walk(ast);
  return [...dependencies];
}

class JMProjectCompiler {
  constructor(host = new EstateHost(), options = {}) {
    this.host = host;
    this.id = options.id ?? 'jm-project';
    this.cache = new Map();
    this.lastProject = null;
    this.ledger = new JMProofLedger(`project:${this.id}`);
  }
  normaliseProject(project) {
    const sources = project.sources ?? project.bodies ?? {};
    const clean = {};
    for (const [id, value] of Object.entries(sources)) clean[normaliseName(id)] = typeof value === 'string' ? value : value.source;
    return { id: normaliseName(project.id ?? this.id), sources: clean, metadata: deepClone(project.metadata ?? {}) };
  }
  sort(graph) {
    const temporary = new Set(), permanent = new Set(), order = [], cycles = [];
    const visit = (id, trail = []) => {
      if (permanent.has(id)) return;
      if (temporary.has(id)) { cycles.push([...trail, id]); return; }
      temporary.add(id);
      for (const dep of graph[id] ?? []) if (Object.hasOwn(graph, dep)) visit(dep, [...trail, id]);
      temporary.delete(id); permanent.add(id); order.push(id);
    };
    Object.keys(graph).sort().forEach((id) => visit(id));
    return { order, cycles };
  }
  build(project) {
    const normalized = this.normaliseProject(project);
    const before = new Map(this.cache);
    const modules = {};
    const graph = {};
    const changed = [], reused = [];
    this.ledger.append('project-build-start', { project: normalized.id, bodyCount: Object.keys(normalized.sources).length });
    try {
      for (const [id, source] of Object.entries(normalized.sources)) {
        const body = this.host.getBody(id);
        const sourceDigest = jmDigest({ id, source });
        const cached = this.cache.get(id);
        let record;
        if (cached?.sourceDigest === sourceDigest) {
          record = deepClone(cached.record); reused.push(id);
        } else {
          const validation = body.validate(source);
          invariant(validation.status === 'PASS', `${body.name} project validation HOLD`);
          const ir = body.compile(source);
          const contract = body.contract(source, { input: 'any', output: 'any' });
          const dependencies = jmExtractDependencies(ir.optimizedAst ?? ir.ast, this.host).filter((dep) => dep !== id && Object.hasOwn(normalized.sources, dep));
          record = {
            id,
            name: body.name,
            sourceDigest,
            semanticDigest: ir.semantic.digest,
            irDigest: ir.normalized.digest,
            optimizerDigest: ir.optimization.digest,
            contractDigest: contract.digest,
            dependencies,
            version: body.version,
          };
          record.moduleDigest = jmDigest(record);
          this.cache.set(id, { sourceDigest, record: deepClone(record), ir });
          changed.push(id);
        }
        modules[id] = record;
        graph[id] = deepClone(record.dependencies ?? []);
        this.ledger.append('project-module', { project: normalized.id, id, moduleDigest: record.moduleDigest, reused: reused.includes(id), dependencies: graph[id] });
      }
      const linked = this.sort(graph);
      invariant(linked.cycles.length === 0, `Project dependency cycle: ${linked.cycles[0]?.join(' → ')}`);
      const dependents = {};
      for (const id of Object.keys(graph)) dependents[id] = [];
      for (const [id, deps] of Object.entries(graph)) for (const dep of deps) (dependents[dep] ??= []).push(id);
      const invalidated = new Set();
      const mark = (id) => { for (const dep of dependents[id] ?? []) if (!invalidated.has(dep)) { invalidated.add(dep); mark(dep); } };
      changed.forEach(mark);
      const bundle = {
        schema: 'jm-linked-project/4',
        id: normalized.id,
        build: BUILD_ID,
        version: VERSION,
        level: 'JM-E4',
        modules,
        graph,
        order: linked.order,
        changed,
        reused,
        invalidated: [...invalidated],
        metadata: normalized.metadata,
      };
      bundle.digest = jmDigest(bundle);
      this.ledger.append('project-link', { project: normalized.id, order: bundle.order, changed, reused, invalidated: bundle.invalidated, bundleDigest: bundle.digest });
      const verification = this.ledger.verify();
      invariant(verification.status === 'PASS', 'Project proof ledger HOLD');
      const result = { status: 'PASS', rolledBack: false, ...bundle, ledger: this.ledger.snapshot() };
      this.lastProject = { project: normalized, result: deepClone(result) };
      return result;
    } catch (error) {
      this.cache = before;
      this.ledger.append('project-rollback', { project: normalized.id, error: error.message });
      return { status: 'HOLD', rolledBack: true, error: error.message, project: normalized.id, ledger: this.ledger.snapshot() };
    }
  }
  hotPatch(changes = {}, project = this.lastProject?.project) {
    invariant(project, 'Build a project before hot patching');
    const next = this.normaliseProject(project);
    for (const [id, source] of Object.entries(changes)) next.sources[normaliseName(id)] = typeof source === 'string' ? source : source.source;
    this.ledger.append('hot-patch-start', { project: next.id, changed: Object.keys(changes).map(normaliseName) });
    const result = this.build(next);
    this.ledger.append(result.status === 'PASS' ? 'hot-patch-commit' : 'hot-patch-rollback', { project: next.id, status: result.status, digest: result.digest ?? null });
    if (result.status === 'PASS') this.lastProject = { project: next, result: deepClone(result) };
    return { ...result, hotPatch: true };
  }
  run(bodyId, input = {}) {
    invariant(this.lastProject?.result?.status === 'PASS', 'Build a project before running a module');
    const id = normaliseName(bodyId);
    const source = this.lastProject.project.sources[id];
    invariant(source, `Project has no body ${id}`);
    const body = this.host.getBody(id);
    const live = body.live(source, input, { breakpoints: [] }, this.host);
    const proof = live.runToEnd();
    this.ledger.append('project-run', { project: this.lastProject.project.id, body: id, status: proof.status, proofDigest: proof.digest });
    return { status: proof.status === 'HOLD' ? 'HOLD' : 'PASS', body: id, proof, ledger: this.ledger.snapshot() };
  }
}

const jmE3Manifest = CodingBody.prototype.manifest;
const jmE3Compile = CodingBody.prototype.compile;

CodingBody.prototype.compile = function compileE4(sourceOrAst) {
  const ir = jmE3Compile.call(this, sourceOrAst);
  return { ...ir, version: '4.0-jm', continuationReady: true };
};
CodingBody.prototype.live = function live(sourceOrAst, input = {}, options = {}, host = new EstateHost()) {
  const ir = this.compile(sourceOrAst);
  invariant(ir.validation.status === 'PASS', `${this.name} live continuation validation HOLD`);
  return new JMLiveContinuation(this, ir, input, options, host);
};
CodingBody.prototype.manifest = function manifestE4() {
  return {
    ...jmE3Manifest.call(this),
    version: '4.0-jm',
    sourceState: 'implemented-v0.4',
    elevation: {
      level: 'JM-E4',
      equalised: true,
      guarantees: [
        'structural-validation','semantic-type-inference','normalised-ir','optimisation',
        'source-trace-debugging','body-contracts','live-suspended-continuation',
        'checkpoint-rewind-restore','linked-project-build','incremental-hot-patch',
        'tamper-evident-proof-ledger','project-persistence','trace-replay','transactional-pipeline'
      ],
    },
  };
};

for (const body of BODY_DEFINITIONS) {
  body.version = '4.0-jm';
  for (const capability of ['can-suspend','can-resume','can-checkpoint','can-rewind','can-link','can-incremental-build','can-proof-chain']) body.capabilities.add(capability);
}

EstateHost.prototype.createLiveContinuation = function createLiveContinuation(bodyId, source, input = {}, options = {}) {
  return this.getBody(bodyId).live(source, input, options, this);
};
EstateHost.prototype.createProjectCompiler = function createProjectCompiler(options = {}) {
  return new JMProjectCompiler(this, options);
};
EstateHost.prototype.createProofLedger = function createProofLedger(id = 'estate-ledger') {
  return new JMProofLedger(id);
};

const jmE3EstateManifest = EstateHost.prototype.manifest;
EstateHost.prototype.manifest = function estateManifestE4() {
  const manifest = jmE3EstateManifest.call(this);
  return {
    ...manifest,
    version: VERSION,
    build: BUILD_ID,
    elevation: {
      level: 'JM-E4',
      equalisedBodies: this.bodies.size,
      continuation: 'live resumable JM bytecode continuation with a real call stack',
      checkpoints: 'per-step checkpoint, rewind and restore',
      linker: 'whole-estate dependency graph and linked project bundle',
      incremental: 'digest cache, changed-body rebuild and dependent invalidation',
      proofLedger: 'tamper-evident chained receipts for live and project execution',
      inherited: ['semantic-type-inference','optimisation','source-trace-debugging','body-contracts','normalised-ir','project-persistence','trace-replay','transactional-pipeline'],
    },
  };
};



// -----------------------------------------------------------------------------
// JM-E5 — declared modules/imports, namespaces, package constraints and symbols
// -----------------------------------------------------------------------------

function jmNormalisePackageName(value) {
  const name = String(value ?? '').trim().toLowerCase();
  invariant(/^@?[a-z0-9][a-z0-9._/-]*$/.test(name), `Invalid package name ${value}`);
  return name;
}

function jmNormaliseNamespace(value) {
  const namespace = String(value ?? '').trim().toLowerCase().replace(/-/g, '.');
  invariant(/^[a-z_$][a-z0-9_$]*(?:\.[a-z_$][a-z0-9_$]*)*$/.test(namespace), `Invalid namespace ${value}`);
  return namespace;
}

function jmParseVersion(value) {
  const raw = String(value ?? '').trim();
  const match = raw.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  invariant(match, `Invalid semantic version ${value}`);
  return { raw, major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] ?? null };
}

function jmCompareVersions(left, right) {
  const a = typeof left === 'string' ? jmParseVersion(left) : left;
  const b = typeof right === 'string' ? jmParseVersion(right) : right;
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] < b[key]) return -1;
    if (a[key] > b[key]) return 1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease == null) return 1;
  if (b.prerelease == null) return -1;
  return a.prerelease.localeCompare(b.prerelease);
}

function jmSatisfiesComparator(version, comparator) {
  const actual = typeof version === 'string' ? jmParseVersion(version) : version;
  const token = String(comparator ?? '*').trim();
  if (!token || token === '*' || /^x$/i.test(token)) return true;
  let match = token.match(/^(\d+)\.(x|\*)$/i);
  if (match) return actual.major === Number(match[1]);
  match = token.match(/^(\d+)\.(\d+)\.(x|\*)$/i);
  if (match) return actual.major === Number(match[1]) && actual.minor === Number(match[2]);
  if (token.startsWith('^')) {
    const floor = jmParseVersion(token.slice(1));
    const ceiling = floor.major > 0
      ? { ...floor, major: floor.major + 1, minor: 0, patch: 0, prerelease: null }
      : floor.minor > 0
        ? { ...floor, minor: floor.minor + 1, patch: 0, prerelease: null }
        : { ...floor, patch: floor.patch + 1, prerelease: null };
    return jmCompareVersions(actual, floor) >= 0 && jmCompareVersions(actual, ceiling) < 0;
  }
  if (token.startsWith('~')) {
    const floor = jmParseVersion(token.slice(1));
    const ceiling = { ...floor, minor: floor.minor + 1, patch: 0, prerelease: null };
    return jmCompareVersions(actual, floor) >= 0 && jmCompareVersions(actual, ceiling) < 0;
  }
  match = token.match(/^(>=|<=|>|<|=)?\s*(v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/);
  invariant(match, `Unsupported version comparator ${token}`);
  const op = match[1] ?? '=';
  const cmp = jmCompareVersions(actual, jmParseVersion(match[2]));
  return op === '>=' ? cmp >= 0 : op === '<=' ? cmp <= 0 : op === '>' ? cmp > 0 : op === '<' ? cmp < 0 : cmp === 0;
}

function jmSatisfiesVersion(version, range = '*') {
  const alternatives = String(range ?? '*').split('||').map((part) => part.trim()).filter(Boolean);
  return alternatives.some((alternative) => alternative.split(/\s+/).filter(Boolean).every((token) => jmSatisfiesComparator(version, token)));
}

function jmNormaliseExport(value) {
  if (typeof value === 'string') return { name: value, target: value, kind: value === 'default' ? 'body' : 'symbol', visibility: 'public' };
  const item = deepClone(value ?? {});
  const name = String(item.name ?? item.as ?? item.target ?? 'default');
  return {
    name,
    target: String(item.target ?? (name === 'default' ? 'default' : name)),
    kind: String(item.kind ?? (name === 'default' ? 'body' : 'symbol')),
    visibility: item.visibility === 'private' || item.private === true ? 'private' : 'public',
    value: item.value === undefined ? undefined : deepClone(item.value),
  };
}

function jmNormaliseImport(value) {
  const item = deepClone(value ?? {});
  const packageName = jmNormalisePackageName(item.package ?? item.from);
  const symbolsRaw = item.symbols ?? (item.symbol ? [item.symbol] : ['default']);
  const symbols = symbolsRaw.map((symbol) => {
    if (typeof symbol === 'string') return { name: symbol, as: symbol };
    return { name: String(symbol.name ?? symbol.export ?? 'default'), as: String(symbol.as ?? symbol.alias ?? symbol.name ?? 'default') };
  });
  return { package: packageName, range: String(item.range ?? item.version ?? '*'), symbols };
}

function jmParseModuleDirectives(source, fallbackId = 'module') {
  const result = { package: null, version: null, namespace: null, body: null, exports: [], imports: [] };
  for (const line of String(source ?? '').split(/\r?\n/)) {
    const match = line.match(/^\s*\/\/\s*@jm\s+(.+)$/i);
    if (!match) continue;
    const parts = match[1].trim().split(/\s+/);
    const command = parts.shift()?.toLowerCase();
    if (command === 'module') {
      result.package = parts.shift() ?? `@jm/${normaliseName(fallbackId)}`;
      if (parts[0] === 'version') parts.shift();
      result.version = parts.shift() ?? '7.0.0';
      if (parts[0] === 'namespace') { parts.shift(); result.namespace = parts.shift(); }
      if (parts[0] === 'body') { parts.shift(); result.body = parts.shift(); }
    } else if (command === 'export') {
      const target = parts.shift() ?? 'default';
      let name = target, kind = target === 'default' ? 'body' : 'symbol', visibility = 'public';
      while (parts.length) {
        const token = parts.shift().toLowerCase();
        if (token === 'as') name = parts.shift() ?? name;
        else if (token === 'kind') kind = parts.shift() ?? kind;
        else if (token === 'private') visibility = 'private';
      }
      result.exports.push({ name, target, kind, visibility });
    } else if (command === 'import') {
      const packageName = parts.shift();
      const range = parts.shift() ?? '*';
      const symbol = parts.shift() ?? 'default';
      let alias = symbol;
      if (parts[0]?.toLowerCase() === 'as') { parts.shift(); alias = parts.shift() ?? alias; }
      result.imports.push({ package: packageName, range, symbols: [{ name: symbol, as: alias }] });
    }
  }
  return result;
}

function jmDiscoverModuleExports(ir) {
  const ast = ir.optimizedAst ?? ir.ast ?? {};
  const found = [];
  const add = (name, kind) => { if (name && !found.some((item) => item.name === name)) found.push({ name, target: name, kind, visibility: 'public' }); };
  for (const fn of ast.functions ?? []) add(fn.name, 'function');
  for (const route of ast.routes ?? []) add(route.name, 'route');
  for (const flow of ast.flows ?? []) add(flow.name, 'flow');
  for (const step of ast.steps ?? []) add(step.name, 'step');
  return found;
}

function jmCreateModuleDescriptor(id, value = {}) {
  const raw = typeof value === 'string' ? { source: value } : deepClone(value);
  const moduleId = normaliseName(raw.id ?? id);
  const source = String(raw.source ?? '');
  const directives = jmParseModuleDirectives(source, moduleId);
  const body = normaliseName(raw.body ?? directives.body ?? moduleId);
  const packageName = jmNormalisePackageName(raw.package ?? raw.packageName ?? directives.package ?? `@jm/${moduleId}`);
  const version = String(raw.version ?? directives.version ?? '8.0.0');
  jmParseVersion(version);
  const namespace = jmNormaliseNamespace(raw.namespace ?? directives.namespace ?? `jm.${moduleId.replace(/-/g, '.')}`);
  const exports = [...(directives.exports ?? []), ...(raw.exports ?? [])].map(jmNormaliseExport);
  if (!exports.some((item) => item.name === 'default')) exports.unshift(jmNormaliseExport('default'));
  const imports = [...(directives.imports ?? []), ...(raw.imports ?? [])].map(jmNormaliseImport);
  return { id: moduleId, body, source, package: packageName, version, namespace, exports, imports, metadata: deepClone(raw.metadata ?? {}) };
}

class JMPackageRegistry {
  constructor() { this.packages = new Map(); }
  add(record) {
    const packageName = jmNormalisePackageName(record.package);
    const packageVersion = String(record.packageVersion ?? record.version);
    jmParseVersion(packageVersion);
    const list = this.packages.get(packageName) ?? [];
    invariant(!list.some((item) => item.version === packageVersion), `Duplicate package ${packageName}@${packageVersion}`);
    list.push({ ...deepClone(record), version: packageVersion });
    list.sort((a, b) => jmCompareVersions(b.version, a.version));
    this.packages.set(packageName, list);
    return record;
  }
  resolve(packageName, range = '*') {
    const name = jmNormalisePackageName(packageName);
    const candidate = (this.packages.get(name) ?? []).find((item) => jmSatisfiesVersion(item.version, range));
    invariant(candidate, `No package ${name} satisfies ${range}`);
    return deepClone(candidate);
  }
  snapshot() {
    const packages = {};
    for (const [name, records] of [...this.packages.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      packages[name] = records.map((record) => ({ id: record.id, body: record.body, version: record.version, namespace: record.namespace, digest: record.moduleDigest }));
    }
    const result = { schema: 'jm-package-registry/5', packages };
    result.digest = jmDigest(result);
    return result;
  }
}

class JMProjectCompilerV5 extends JMProjectCompiler {
  normaliseProject(project) {
    const sourceSet = project.modules ?? project.sources ?? project.bodies ?? {};
    const modules = {};
    for (const [id, value] of Object.entries(sourceSet)) modules[normaliseName(id)] = jmCreateModuleDescriptor(id, value);
    return { id: normaliseName(project.id ?? this.id), modules, metadata: deepClone(project.metadata ?? {}) };
  }
  build(project) {
    const normalized = this.normaliseProject(project);
    const before = new Map(this.cache);
    const modules = {}, graph = {}, changed = [], reused = [];
    const registry = new JMPackageRegistry();
    const namespaceOwners = new Map();
    this.ledger.append('package-build-start', { project: normalized.id, moduleCount: Object.keys(normalized.modules).length });
    try {
      for (const [id, descriptor] of Object.entries(normalized.modules)) {
        const body = this.host.getBody(descriptor.body);
        const descriptorDigest = jmDigest(descriptor);
        const cached = this.cache.get(id);
        let base;
        if (cached?.descriptorDigest === descriptorDigest) {
          base = deepClone(cached.record); reused.push(id);
        } else {
          const validation = body.validate(descriptor.source);
          invariant(validation.status === 'PASS', `${body.name} package validation HOLD`);
          const ir = body.compile(descriptor.source);
          const contract = body.contract(descriptor.source, { input: 'any', output: 'any' });
          const discovered = jmDiscoverModuleExports(ir);
          const exportsList = [...descriptor.exports];
          for (const item of discovered) if (!exportsList.some((current) => current.name === item.name)) exportsList.push(item);
          const exports = Object.fromEntries(exportsList.map((item) => [item.name, jmNormaliseExport(item)]));
          base = {
            id,
            body: descriptor.body,
            name: body.name,
            package: descriptor.package,
            packageVersion: descriptor.version,
            namespace: descriptor.namespace,
            descriptorDigest,
            sourceDigest: jmDigest({ id, source: descriptor.source }),
            semanticDigest: ir.semantic.digest,
            irDigest: ir.normalized.digest,
            optimizerDigest: ir.optimization.digest,
            contractDigest: contract.digest,
            exports,
            declaredImports: deepClone(descriptor.imports),
            inferredBodies: jmExtractDependencies(ir.optimizedAst ?? ir.ast, this.host).filter((dep) => dep !== descriptor.body),
            version: body.version,
          };
          base.moduleDigest = jmDigest(base);
          this.cache.set(id, { descriptorDigest, record: deepClone(base), ir });
          changed.push(id);
        }
        invariant(!namespaceOwners.has(base.namespace), `Namespace ${base.namespace} already owned by ${namespaceOwners.get(base.namespace)}`);
        namespaceOwners.set(base.namespace, id);
        modules[id] = base;
        registry.add(base);
        this.ledger.append('package-module', { project: normalized.id, id, package: base.package, version: base.packageVersion, namespace: base.namespace, reused: reused.includes(id), moduleDigest: base.moduleDigest });
      }

      const namespaceIndex = {};
      for (const module of Object.values(modules)) {
        for (const [name, exported] of Object.entries(module.exports)) {
          const key = `${module.namespace}::${name}`;
          invariant(!namespaceIndex[key], `Duplicate exported symbol ${key}`);
          namespaceIndex[key] = { module: module.id, package: module.package, version: module.packageVersion, namespace: module.namespace, exported: name, ...deepClone(exported) };
        }
      }

      for (const [id, module] of Object.entries(modules)) {
        const descriptor = normalized.modules[id];
        const imports = [...descriptor.imports];
        for (const dependencyBody of module.inferredBodies ?? []) {
          const target = Object.values(modules).find((candidate) => candidate.body === dependencyBody);
          if (target && !imports.some((item) => item.package === target.package)) imports.push({ package: target.package, range: `^${target.packageVersion}`, symbols: [{ name: 'default', as: dependencyBody }] });
        }
        const linkedSymbols = {};
        const resolvedImports = [];
        const deps = new Set();
        for (const declaration of imports) {
          const imported = jmNormaliseImport(declaration);
          const targetModule = registry.resolve(imported.package, imported.range);
          deps.add(targetModule.id);
          const symbols = [];
          for (const symbol of imported.symbols) {
            const exported = modules[targetModule.id].exports[symbol.name];
            invariant(exported, `Package ${targetModule.package}@${targetModule.packageVersion} does not export ${symbol.name}`);
            invariant(exported.visibility !== 'private', `Symbol ${targetModule.namespace}::${symbol.name} is private`);
            invariant(!linkedSymbols[symbol.as], `Duplicate import alias ${symbol.as} in ${id}`);
            const link = { module: targetModule.id, package: targetModule.package, version: targetModule.packageVersion, namespace: targetModule.namespace, exported: symbol.name, local: symbol.as, target: exported.target, kind: exported.kind };
            linkedSymbols[symbol.as] = link;
            symbols.push(link);
          }
          resolvedImports.push({ package: imported.package, range: imported.range, resolvedModule: targetModule.id, resolvedVersion: targetModule.packageVersion, symbols });
        }
        module.imports = resolvedImports;
        module.linkedSymbols = linkedSymbols;
        module.linkDigest = jmDigest({ id, imports: resolvedImports, linkedSymbols });
        graph[id] = [...deps].filter((dep) => dep !== id);
      }

      const linked = this.sort(graph);
      invariant(linked.cycles.length === 0, `Package dependency cycle: ${linked.cycles[0]?.join(' → ')}`);
      const dependents = Object.fromEntries(Object.keys(graph).map((id) => [id, []]));
      for (const [id, deps] of Object.entries(graph)) for (const dep of deps) (dependents[dep] ??= []).push(id);
      const invalidated = new Set();
      const mark = (id) => { for (const dependent of dependents[id] ?? []) if (!invalidated.has(dependent)) { invalidated.add(dependent); mark(dependent); } };
      changed.forEach(mark);
      const bundle = {
        schema: 'jm-linked-package/5', id: normalized.id, build: BUILD_ID, version: VERSION, level: 'JM-E5',
        modules, graph, order: linked.order, changed, reused, invalidated: [...invalidated],
        packageRegistry: registry.snapshot(), namespaceIndex, metadata: normalized.metadata,
      };
      bundle.digest = jmDigest(bundle);
      this.ledger.append('package-link', { project: normalized.id, order: bundle.order, changed, reused, invalidated: bundle.invalidated, packageRegistryDigest: bundle.packageRegistry.digest, bundleDigest: bundle.digest });
      invariant(this.ledger.verify().status === 'PASS', 'Package proof ledger HOLD');
      const result = { status: 'PASS', rolledBack: false, ...bundle, ledger: this.ledger.snapshot() };
      this.lastProject = { project: normalized, result: deepClone(result) };
      return result;
    } catch (error) {
      this.cache = before;
      this.ledger.append('package-rollback', { project: normalized.id, error: error.message });
      return { status: 'HOLD', rolledBack: true, error: error.message, project: normalized.id, ledger: this.ledger.snapshot() };
    }
  }
  hotPatch(changes = {}, project = this.lastProject?.project) {
    invariant(project, 'Build a package project before hot patching');
    const next = this.normaliseProject(project);
    for (const [idRaw, change] of Object.entries(changes)) {
      const id = normaliseName(idRaw);
      const current = next.modules[id] ?? jmCreateModuleDescriptor(id, change);
      next.modules[id] = jmCreateModuleDescriptor(id, typeof change === 'string' ? { ...current, source: change } : { ...current, ...change });
    }
    this.ledger.append('package-hot-patch-start', { project: next.id, changed: Object.keys(changes).map(normaliseName) });
    const result = this.build(next);
    this.ledger.append(result.status === 'PASS' ? 'package-hot-patch-commit' : 'package-hot-patch-rollback', { project: next.id, status: result.status, digest: result.digest ?? null });
    return { ...result, hotPatch: true };
  }
  resolveSymbol(reference, fromModuleId = null) {
    invariant(this.lastProject?.result?.status === 'PASS', 'Build a package project before resolving symbols');
    const ref = String(reference);
    if (ref.includes('::')) {
      const resolved = this.lastProject.result.namespaceIndex[ref];
      invariant(resolved, `Unknown namespaced symbol ${ref}`);
      return deepClone(resolved);
    }
    const id = normaliseName(fromModuleId);
    const module = this.lastProject.result.modules[id];
    invariant(module, `Unknown module ${fromModuleId}`);
    if (module.exports[ref]) return deepClone(this.lastProject.result.namespaceIndex[`${module.namespace}::${ref}`]);
    const imported = module.linkedSymbols[ref];
    invariant(imported, `Unknown symbol ${ref} in ${id}`);
    return deepClone(imported);
  }
  run(moduleId, input = {}) {
    invariant(this.lastProject?.result?.status === 'PASS', 'Build a package project before running a module');
    const id = normaliseName(moduleId);
    const descriptor = this.lastProject.project.modules[id];
    invariant(descriptor, `Project has no module ${id}`);
    const body = this.host.getBody(descriptor.body);
    const live = body.live(descriptor.source, input, { breakpoints: [] }, this.host);
    const proof = live.runToEnd();
    this.ledger.append('package-run', { project: this.lastProject.project.id, module: id, body: descriptor.body, status: proof.status, proofDigest: proof.digest });
    return { status: proof.status === 'HOLD' ? 'HOLD' : 'PASS', module: id, body: descriptor.body, proof, ledger: this.ledger.snapshot() };
  }
  runExport(moduleId, symbolName = 'default', input = {}) {
    const id = normaliseName(moduleId);
    const resolved = this.resolveSymbol(symbolName, id);
    invariant(resolved.module === id, `Symbol ${symbolName} is imported; run its owner ${resolved.module}`);
    if (resolved.kind === 'constant') return { status: 'PASS', module: id, symbol: symbolName, value: deepClone(this.lastProject.result.modules[id].exports[symbolName].value), resolved };
    const nextInput = deepClone(input ?? {});
    if (resolved.target && !['default', id].includes(resolved.target) && nextInput.entry == null) nextInput.entry = resolved.target;
    const execution = this.run(id, nextInput);
    this.ledger.append('package-export-run', { project: this.lastProject.project.id, module: id, symbol: symbolName, status: execution.status, resolved });
    return { ...execution, symbol: symbolName, resolved };
  }
}

const jmE4Compile = CodingBody.prototype.compile;
const jmE4Manifest = CodingBody.prototype.manifest;
CodingBody.prototype.compile = function compileE5(sourceOrAst) {
  const ir = jmE4Compile.call(this, sourceOrAst);
  return { ...ir, version: '5.0-jm', moduleReady: true, namespaceReady: true, packageConstraintReady: true };
};
CodingBody.prototype.moduleDescriptor = function moduleDescriptor(source, options = {}) {
  return jmCreateModuleDescriptor(options.id ?? this.id, { ...options, body: this.id, source });
};
CodingBody.prototype.manifest = function manifestE5() {
  return {
    ...jmE4Manifest.call(this), version: '5.0-jm', sourceState: 'implemented-v0.5',
    elevation: {
      level: 'JM-E5', equalised: true,
      guarantees: [
        'declared-modules','declared-imports','namespaced-exports','semantic-version-constraints',
        'linked-symbol-resolution','package-registry','package-rollback','live-suspended-continuation',
        'checkpoint-rewind-restore','incremental-hot-patch','tamper-evident-proof-ledger',
        'semantic-type-inference','optimisation','source-trace-debugging','body-contracts',
        'normalised-ir','project-persistence','trace-replay','transactional-pipeline'
      ],
    },
  };
};
for (const body of BODY_DEFINITIONS) {
  body.version = '5.0-jm';
  for (const capability of ['can-declare-module','can-import','can-export','can-namespace','can-resolve-version','can-link-symbol']) body.capabilities.add(capability);
}
EstateHost.prototype.createProjectCompiler = function createProjectCompilerE5(options = {}) { return new JMProjectCompilerV5(this, options); };
const jmE4EstateManifest = EstateHost.prototype.manifest;
EstateHost.prototype.manifest = function estateManifestE5() {
  const manifest = jmE4EstateManifest.call(this);
  return {
    ...manifest, version: VERSION, build: BUILD_ID,
    elevation: {
      level: 'JM-E5', equalisedBodies: this.bodies.size,
      modules: 'common declared module envelope across all 27 coding bodies',
      packages: 'semantic-versioned package registry with deterministic highest-compatible resolution',
      namespaces: 'unique namespaced public export index',
      imports: 'declared and inferred imports resolved to package versions and symbol aliases',
      linker: 'linked symbol tables with missing/private/ambiguous/version HOLD boundaries',
      inherited: ['live-suspended-continuation','checkpoint-rewind-restore','incremental-hot-patch','tamper-evident-proof-ledger','semantic-type-inference','optimisation','source-trace-debugging','body-contracts','normalised-ir','project-persistence','trace-replay','transactional-pipeline'],
    },
  };
};


// -----------------------------------------------------------------------------
// JM-E6 — publication, cryptographic provenance, install state and lockfiles
// -----------------------------------------------------------------------------

function jmUtf8Bytes(value) {
  const text = String(value ?? '');
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  const encoded = unescape(encodeURIComponent(text));
  return Uint8Array.from(encoded, (char) => char.charCodeAt(0));
}

function jmSha256Bytes(input) {
  const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input ?? []);
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
  ];
  const rotr = (value, shift) => (value >>> shift) | (value << (32 - shift));
  const bitLength = bytes.length * 8;
  const total = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(total);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  view.setUint32(total - 8, high, false);
  view.setUint32(total - 4, low, false);
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  const w = new Uint32Array(64);
  for (let offset = 0; offset < total; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + s1 + ch + K[i] + w[i]) >>> 0;
      const s0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) >>> 0;
      h=g; g=f; f=e; e=(d+t1)>>>0; d=c; c=b; b=a; a=(t1+t2)>>>0;
    }
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;
    h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+h)>>>0;
  }
  const output = new Uint8Array(32);
  const outView = new DataView(output.buffer);
  [h0,h1,h2,h3,h4,h5,h6,h7].forEach((value,index)=>outView.setUint32(index*4,value,false));
  return output;
}

function jmHex(bytes) { return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join(''); }
function jmSha256(value) { return jmHex(jmSha256Bytes(value instanceof Uint8Array ? value : jmUtf8Bytes(value))); }
function jmHmacSha256(key, message) {
  let keyBytes = jmUtf8Bytes(key);
  if (keyBytes.length > 64) keyBytes = jmSha256Bytes(keyBytes);
  const block = new Uint8Array(64); block.set(keyBytes);
  const inner = new Uint8Array(64), outer = new Uint8Array(64);
  for (let i = 0; i < 64; i += 1) { inner[i] = block[i] ^ 0x36; outer[i] = block[i] ^ 0x5c; }
  const msg = jmUtf8Bytes(message);
  const innerInput = new Uint8Array(inner.length + msg.length); innerInput.set(inner); innerInput.set(msg, inner.length);
  const innerHash = jmSha256Bytes(innerInput);
  const outerInput = new Uint8Array(outer.length + innerHash.length); outerInput.set(outer); outerInput.set(innerHash, outer.length);
  return jmHex(jmSha256Bytes(outerInput));
}

class JMProvenanceSigner {
  constructor(keys = { 'jm-zion-e6': 'JM-E6-ZION-PROVENANCE-KEY-v1' }, activeKeyId = 'jm-zion-e6') {
    this.keys = new Map(Object.entries(keys));
    this.activeKeyId = activeKeyId;
    invariant(this.keys.has(activeKeyId), `Unknown active provenance key ${activeKeyId}`);
  }
  sign(payload, keyId = this.activeKeyId) {
    const secret = this.keys.get(keyId);
    invariant(secret, `Unknown provenance key ${keyId}`);
    const payloadDigest = jmSha256(stableStringify(payload));
    return { algorithm: 'HMAC-SHA256', keyId, payloadDigest, signature: jmHmacSha256(secret, payloadDigest) };
  }
  verify(payload, provenance) {
    try {
      invariant(provenance?.algorithm === 'HMAC-SHA256', 'Unsupported provenance algorithm');
      const secret = this.keys.get(provenance.keyId);
      invariant(secret, `Unknown provenance key ${provenance?.keyId}`);
      const payloadDigest = jmSha256(stableStringify(payload));
      invariant(payloadDigest === provenance.payloadDigest, 'Provenance payload digest mismatch');
      invariant(jmHmacSha256(secret, payloadDigest) === provenance.signature, 'Provenance signature mismatch');
      return { status: 'PASS', keyId: provenance.keyId, payloadDigest, signature: provenance.signature };
    } catch (error) {
      return { status: 'HOLD', error: error.message, keyId: provenance?.keyId ?? null };
    }
  }
}

function jmArtifactCore(module, source = '') {
  const dependencies = {};
  for (const imported of module.imports ?? []) dependencies[imported.package] = imported.resolvedVersion;
  return {
    schema: 'jm-package-artifact/6',
    package: module.package,
    version: module.packageVersion,
    namespace: module.namespace,
    module: module.id,
    body: module.body,
    moduleDigest: module.moduleDigest,
    sourceDigest: module.sourceDigest,
    linkDigest: module.linkDigest,
    exports: deepClone(module.exports),
    dependencies,
    source: String(source ?? ''),
  };
}

class JMPublicationRegistry {
  constructor({ signer = new JMProvenanceSigner() } = {}) {
    this.signer = signer;
    this.packages = new Map();
    this.receipts = [];
  }
  publish(module, source = '') {
    const core = jmArtifactCore(module, source);
    const artifactDigest = jmSha256(stableStringify(core));
    const signedPayload = { ...core, artifactDigest };
    const provenance = this.signer.sign(signedPayload);
    const artifact = { ...signedPayload, provenance };
    const verification = this.verifyArtifact(artifact);
    invariant(verification.status === 'PASS', verification.error ?? 'Publication provenance HOLD');
    const list = this.packages.get(core.package) ?? [];
    const existing = list.find((item) => item.version === core.version);
    if (existing) invariant(existing.artifactDigest === artifactDigest, `Immutable publication conflict ${core.package}@${core.version}`);
    else { list.push(deepClone(artifact)); list.sort((a,b)=>jmCompareVersions(b.version,a.version)); this.packages.set(core.package,list); }
    const receipt = { status:'PASS', package:core.package, version:core.version, artifactDigest, provenance:deepClone(provenance) };
    this.receipts.push(receipt);
    return deepClone(artifact);
  }
  publishBundle(bundle, descriptors = {}) {
    invariant(bundle?.status === 'PASS', 'Link a PASS package bundle before publication');
    const artifacts = {};
    for (const id of bundle.order ?? Object.keys(bundle.modules ?? {})) {
      const module = bundle.modules[id];
      artifacts[id] = this.publish(module, descriptors[id]?.source ?? '');
    }
    const snapshot = this.snapshot();
    return { status:'PASS', schema:'jm-publication-release/6', build:BUILD_ID, level:'JM-E6', artifacts, registry:snapshot, digest:jmSha256(stableStringify({artifacts,registry:snapshot})) };
  }
  resolve(packageName, range='*') {
    const name = jmNormalisePackageName(packageName);
    const artifact = (this.packages.get(name) ?? []).find((item)=>jmSatisfiesVersion(item.version, range));
    invariant(artifact, `No published package ${name} satisfies ${range}`);
    return deepClone(artifact);
  }
  get(packageName, version) {
    const name = jmNormalisePackageName(packageName);
    const artifact = (this.packages.get(name) ?? []).find((item)=>item.version===String(version));
    invariant(artifact, `Published package ${name}@${version} not found`);
    return deepClone(artifact);
  }
  verifyArtifact(artifact) {
    try {
      const { provenance, artifactDigest, ...core } = deepClone(artifact ?? {});
      invariant(core.schema === 'jm-package-artifact/6', 'Invalid package artifact schema');
      invariant(jmSha256(stableStringify(core)) === artifactDigest, `Artifact digest mismatch for ${core.package}@${core.version}`);
      const proof = this.signer.verify({ ...core, artifactDigest }, provenance);
      invariant(proof.status === 'PASS', proof.error ?? 'Provenance HOLD');
      return { status:'PASS', package:core.package, version:core.version, artifactDigest, provenance:proof };
    } catch (error) { return { status:'HOLD', error:error.message }; }
  }
  snapshot() {
    const packages = {};
    for (const [name, artifacts] of [...this.packages.entries()].sort(([a],[b])=>a.localeCompare(b))) {
      packages[name] = artifacts.map((artifact)=>({version:artifact.version,module:artifact.module,body:artifact.body,namespace:artifact.namespace,artifactDigest:artifact.artifactDigest,provenance:deepClone(artifact.provenance)}));
    }
    const core = { schema:'jm-publication-registry/6', packages };
    return { ...core, digest:jmSha256(stableStringify(core)) };
  }
}

function jmNormaliseRequirements(requirements = []) {
  const list = Array.isArray(requirements) ? requirements : Object.entries(requirements).map(([packageName,range])=>({package:packageName,range}));
  return list.map((item)=>typeof item==='string'?{package:jmNormalisePackageName(item),range:'*'}:{package:jmNormalisePackageName(item.package),range:String(item.range??'*')});
}

class JMPackageInstaller {
  constructor(registry) { this.registry = registry; this.installed = null; }
  install(requirements = []) {
    const before = deepClone(this.installed);
    try {
      const roots = jmNormaliseRequirements(requirements);
      invariant(roots.length > 0, 'At least one package requirement is required');
      const selected = {}, graph = {};
      const choose = (packageName, range, route=[]) => {
        if (selected[packageName]) {
          invariant(jmSatisfiesVersion(selected[packageName].version, range), `Version conflict for ${packageName}: ${selected[packageName].version} does not satisfy ${range}`);
          return selected[packageName];
        }
        invariant(!route.includes(packageName), `Dependency cycle ${[...route,packageName].join(' → ')}`);
        const artifact = this.registry.resolve(packageName, range);
        const verification = this.registry.verifyArtifact(artifact);
        invariant(verification.status === 'PASS', verification.error ?? `Provenance HOLD ${packageName}`);
        selected[packageName] = artifact;
        graph[packageName] = [];
        for (const [dependency, exactVersion] of Object.entries(artifact.dependencies ?? {}).sort(([a],[b])=>a.localeCompare(b))) {
          const child = choose(dependency, exactVersion, [...route,packageName]);
          graph[packageName].push(child.package);
        }
        return artifact;
      };
      roots.forEach((root)=>choose(root.package,root.range,[]));
      const order=[], temporary=new Set(), permanent=new Set();
      const visit=(name)=>{if(permanent.has(name))return;invariant(!temporary.has(name),`Dependency cycle at ${name}`);temporary.add(name);for(const dep of graph[name]??[])visit(dep);temporary.delete(name);permanent.add(name);order.push(name);};
      Object.keys(selected).sort().forEach(visit);
      const packages = {};
      for (const name of Object.keys(selected).sort()) {
        const artifact = selected[name];
        packages[name] = { version:artifact.version, artifactDigest:artifact.artifactDigest, namespace:artifact.namespace, body:artifact.body, module:artifact.module, dependencies:deepClone(artifact.dependencies), provenance:deepClone(artifact.provenance) };
      }
      const lockCore = { schema:'jm-lockfile/6', lockVersion:1, build:BUILD_ID, level:'JM-E6', roots, packages, graph, order };
      const lockfile = { ...lockCore, lockDigest:jmSha256(stableStringify(lockCore)) };
      const graphDigest = jmSha256(stableStringify({packages,graph,order}));
      const stateCore = { schema:'jm-install-state/6', lockDigest:lockfile.lockDigest, graphDigest, installed:order.map((name)=>({package:name,version:packages[name].version,artifactDigest:packages[name].artifactDigest})) };
      const state = { ...stateCore, installDigest:jmSha256(stableStringify(stateCore)), status:'PASS' };
      this.installed = deepClone(state);
      return { status:'PASS', rolledBack:false, lockfile, state, graphDigest };
    } catch (error) {
      this.installed = before;
      return { status:'HOLD', rolledBack:true, error:error.message, previousState:before };
    }
  }
  verifyLock(lockfile) {
    try {
      const { lockDigest, ...core } = deepClone(lockfile ?? {});
      invariant(core.schema === 'jm-lockfile/6', 'Invalid JM lockfile schema');
      invariant(jmSha256(stableStringify(core)) === lockDigest, 'Lockfile digest mismatch');
      for (const [packageName, entry] of Object.entries(core.packages ?? {})) {
        const artifact = this.registry.get(packageName, entry.version);
        invariant(artifact.artifactDigest === entry.artifactDigest, `Locked artifact digest mismatch ${packageName}@${entry.version}`);
        const verification = this.registry.verifyArtifact(artifact);
        invariant(verification.status === 'PASS', verification.error ?? `Provenance HOLD ${packageName}`);
        invariant(stableStringify(artifact.dependencies ?? {}) === stableStringify(entry.dependencies ?? {}), `Locked dependency mismatch ${packageName}`);
      }
      return { status:'PASS', lockDigest, packageCount:Object.keys(core.packages??{}).length, graphDigest:jmSha256(stableStringify({packages:core.packages,graph:core.graph,order:core.order})) };
    } catch (error) { return { status:'HOLD', error:error.message }; }
  }
  installFromLock(lockfile) {
    const verification = this.verifyLock(lockfile);
    if (verification.status !== 'PASS') return { status:'HOLD', rolledBack:true, error:verification.error };
    const core = { schema:'jm-install-state/6', lockDigest:lockfile.lockDigest, graphDigest:verification.graphDigest, installed:lockfile.order.map((name)=>({package:name,version:lockfile.packages[name].version,artifactDigest:lockfile.packages[name].artifactDigest})) };
    const state = { ...core, installDigest:jmSha256(stableStringify(core)), status:'PASS' };
    this.installed = deepClone(state);
    return { status:'PASS', rolledBack:false, lockfile:deepClone(lockfile), state, graphDigest:verification.graphDigest };
  }
}

class JMProjectCompilerV6 extends JMProjectCompilerV5 {
  constructor(host, options={}) {
    super(host, options);
    this.signer = options.signer ?? new JMProvenanceSigner(options.keys, options.activeKeyId);
    this.publicationRegistry = options.publicationRegistry ?? new JMPublicationRegistry({signer:this.signer});
    this.installer = options.installer ?? new JMPackageInstaller(this.publicationRegistry);
    this.lastPublication = null;
    this.lastInstall = null;
  }
  build(project) {
    const base = super.build(project);
    if (base.status !== 'PASS') return base;
    const result = { ...base, schema:'jm-linked-package/6', level:'JM-E6', version:VERSION };
    result.digest = jmDigest({schema:result.schema,id:result.id,version:result.version,level:result.level,modules:result.modules,graph:result.graph,order:result.order,packageRegistry:result.packageRegistry,namespaceIndex:result.namespaceIndex});
    this.lastProject = { project:this.lastProject.project, result:deepClone(result) };
    return result;
  }
  publish() {
    invariant(this.lastProject?.result?.status === 'PASS', 'Build a package project before publication');
    const release = this.publicationRegistry.publishBundle(this.lastProject.result, this.lastProject.project.modules);
    this.lastPublication = deepClone(release);
    this.ledger.append('publication-release',{project:this.lastProject.project.id,packageCount:Object.keys(release.registry.packages).length,registryDigest:release.registry.digest,releaseDigest:release.digest});
    return {...release,ledger:this.ledger.snapshot()};
  }
  install(requirements=null) {
    if (!this.lastPublication) this.publish();
    const roots = requirements ?? Object.entries(this.lastPublication.registry.packages).map(([packageName,versions])=>({package:packageName,range:versions[0].version}));
    const result = this.installer.install(roots);
    this.ledger.append(result.status==='PASS'?'install-commit':'install-rollback',{project:this.lastProject?.project?.id,status:result.status,lockDigest:result.lockfile?.lockDigest??null,error:result.error??null});
    this.lastInstall = deepClone(result);
    return {...result,ledger:this.ledger.snapshot()};
  }
  verifyLock(lockfile=this.lastInstall?.lockfile) {
    const result = this.installer.verifyLock(lockfile);
    this.ledger.append(result.status==='PASS'?'lock-verified':'lock-hold',{status:result.status,lockDigest:result.lockDigest??null,error:result.error??null});
    return {...result,ledger:this.ledger.snapshot()};
  }
  reproduce(lockfile=this.lastInstall?.lockfile) {
    const first = this.installer.installFromLock(lockfile);
    if (first.status !== 'PASS') return first;
    const secondInstaller = new JMPackageInstaller(this.publicationRegistry);
    const second = secondInstaller.installFromLock(lockfile);
    invariant(second.status === 'PASS', second.error ?? 'Second install HOLD');
    const status = first.graphDigest === second.graphDigest && first.state.installDigest === second.state.installDigest ? 'PASS' : 'HOLD';
    const result = { status, lockDigest:lockfile.lockDigest, graphDigest:first.graphDigest, firstInstallDigest:first.state.installDigest, secondInstallDigest:second.state.installDigest, reproducible:status==='PASS' };
    this.ledger.append(status==='PASS'?'reproduction-ding':'reproduction-hold',result);
    return {...result,ledger:this.ledger.snapshot()};
  }
  release(project) {
    const linked = this.build(project);
    if (linked.status !== 'PASS') return {status:'HOLD',stage:'link',linked};
    const publication = this.publish();
    const install = this.install();
    const verification = install.status==='PASS'?this.verifyLock(install.lockfile):{status:'HOLD',error:install.error};
    const reproduction = verification.status==='PASS'?this.reproduce(install.lockfile):{status:'HOLD',error:verification.error};
    const status = [linked,publication,install,verification,reproduction].every((item)=>item.status==='PASS')?'PASS':'HOLD';
    return {status,level:'JM-E6',linked,publication,install,verification,reproduction};
  }
}

const jmE5Compile = CodingBody.prototype.compile;
const jmE5ManifestBody = CodingBody.prototype.manifest;
CodingBody.prototype.compile = function compileE6(sourceOrAst) {
  const ir = jmE5Compile.call(this, sourceOrAst);
  return {...ir,version:'6.0-jm',publicationReady:true,installReady:true,lockfileReady:true,provenanceReady:true};
};
CodingBody.prototype.manifest = function manifestE6() {
  const previous = jmE5ManifestBody.call(this);
  return {...previous,version:'6.0-jm',sourceState:'implemented-v0.6',elevation:{level:'JM-E6',equalised:true,guarantees:[
    'package-publication','immutable-artifacts','hmac-sha256-provenance','package-install-state','exact-version-lockfile','reproducible-dependency-graph','transactional-install-rollback',
    ...previous.elevation.guarantees
  ]}};
};
for (const body of BODY_DEFINITIONS) {
  body.version='6.0-jm';
  for (const capability of ['can-publish','can-sign-provenance','can-install','can-lock','can-verify-lock','can-reproduce-install']) body.capabilities.add(capability);
}
EstateHost.prototype.createProjectCompiler = function createProjectCompilerE6(options={}) { return new JMProjectCompilerV6(this,options); };
const jmE5EstateManifest = EstateHost.prototype.manifest;
EstateHost.prototype.manifest = function estateManifestE6() {
  const manifest = jmE5EstateManifest.call(this);
  return {...manifest,version:VERSION,build:BUILD_ID,elevation:{
    level:'JM-E6',equalisedBodies:this.bodies.size,
    publication:'immutable package artifacts published from linked body modules',
    provenance:'dependency-free HMAC-SHA256 artifact provenance with deterministic verification',
    installation:'transactional package installation with exact selected versions',
    lockfile:'digest-bound JM lockfile pinning artifacts, provenance and dependency graph',
    reproducibility:'two clean lockfile installs must produce identical graph and install digests',
    inherited:['declared-modules','declared-imports','namespaced-exports','semantic-version-constraints','linked-symbol-resolution','package-registry','package-rollback','live-suspended-continuation','checkpoint-rewind-restore','incremental-hot-patch','tamper-evident-proof-ledger','semantic-type-inference','optimisation','source-trace-debugging','body-contracts','normalised-ir','project-persistence','trace-replay','transactional-pipeline']
  }};
};

// -----------------------------------------------------------------------------
// JM-E7 — public-key authorship, trust policy, rotation and revocation
// -----------------------------------------------------------------------------

function jmBase64Url(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of data) binary += String.fromCharCode(byte);
  const encoded = typeof btoa === 'function' ? btoa(binary) : Buffer.from(data).toString('base64');
  return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function jmFromBase64Url(value) {
  const text = String(value ?? '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = text + '='.repeat((4 - (text.length % 4 || 4)) % 4);
  const binary = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function jmCanonicalPublicJwk(jwk) {
  return { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y };
}

function jmPublicKeyFingerprint(publicKeyJwk) {
  return `sha256:${jmSha256(stableStringify(jmCanonicalPublicJwk(publicKeyJwk)))}`;
}

function jmCryptoSubtle() {
  const subtle = globalThis?.crypto?.subtle;
  invariant(subtle, 'Web Crypto SubtleCrypto is unavailable on this device');
  return subtle;
}

class JMWebCryptoAuthor {
  constructor({ owner = 'JM Author', keyId, publicKey, privateKey, publicKeyJwk, privateKeyJwk = null, createdAt = null } = {}) {
    this.owner = owner;
    this.publicKey = publicKey;
    this.privateKey = privateKey;
    this.publicKeyJwk = deepClone(publicKeyJwk);
    this.privateKeyJwk = privateKeyJwk ? deepClone(privateKeyJwk) : null;
    this.fingerprint = jmPublicKeyFingerprint(this.publicKeyJwk);
    this.keyId = keyId || `jm-author-${this.fingerprint.slice(-16)}`;
    this.createdAt = createdAt || new Date().toISOString();
  }
  static async generate({ owner = 'JM Author', keyId = null } = {}) {
    const subtle = jmCryptoSubtle();
    const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const publicKeyJwk = await subtle.exportKey('jwk', pair.publicKey);
    const privateKeyJwk = await subtle.exportKey('jwk', pair.privateKey);
    return new JMWebCryptoAuthor({ owner, keyId, publicKey: pair.publicKey, privateKey: pair.privateKey, publicKeyJwk, privateKeyJwk });
  }
  static async fromRecord(record) {
    invariant(record?.publicKeyJwk && record?.privateKeyJwk, 'Authorship record is incomplete');
    const subtle = jmCryptoSubtle();
    const publicKey = await subtle.importKey('jwk', record.publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
    const privateKey = await subtle.importKey('jwk', record.privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const author = new JMWebCryptoAuthor({ ...record, publicKey, privateKey });
    invariant(author.fingerprint === record.fingerprint, 'Stored authorship fingerprint mismatch');
    return author;
  }
  async exportRecord({ includePrivate = true } = {}) {
    return {
      schema: 'jm-authorship-identity/7',
      owner: this.owner,
      keyId: this.keyId,
      fingerprint: this.fingerprint,
      publicKeyJwk: deepClone(this.publicKeyJwk),
      privateKeyJwk: includePrivate ? deepClone(this.privateKeyJwk) : undefined,
      createdAt: this.createdAt,
    };
  }
  async sign(payload, purpose = 'package-authorship') {
    invariant(this.privateKey, 'Private authorship key is unavailable');
    const payloadDigest = jmSha256(stableStringify(payload));
    const signature = await jmCryptoSubtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, this.privateKey, jmUtf8Bytes(payloadDigest));
    return {
      algorithm: 'ECDSA-P256-SHA256',
      purpose,
      owner: this.owner,
      keyId: this.keyId,
      fingerprint: this.fingerprint,
      publicKeyJwk: deepClone(this.publicKeyJwk),
      payloadDigest,
      signature: jmBase64Url(signature),
      signedAt: new Date().toISOString(),
    };
  }
  async createRotationCertificate(nextAuthor) {
    invariant(nextAuthor instanceof JMWebCryptoAuthor, 'Rotation requires a JM author identity');
    const core = {
      schema: 'jm-key-rotation/7',
      fromFingerprint: this.fingerprint,
      fromKeyId: this.keyId,
      toFingerprint: nextAuthor.fingerprint,
      toKeyId: nextAuthor.keyId,
      owner: this.owner,
      toPublicKeyJwk: deepClone(nextAuthor.publicKeyJwk),
      issuedAt: new Date().toISOString(),
    };
    const provenance = await this.sign(core, 'key-rotation');
    return { ...core, provenance, certificateDigest: jmSha256(stableStringify({ ...core, provenance })) };
  }
}

class JMTrustStore {
  constructor(records = []) {
    this.records = new Map();
    this.events = [];
    for (const record of records) this.records.set(record.fingerprint, deepClone(record));
  }
  async trust(publicKeyJwk, { keyId = null, owner = 'JM Author', scopes = ['package:*'], status = 'active', reason = 'explicit-trust' } = {}) {
    const fingerprint = jmPublicKeyFingerprint(publicKeyJwk);
    const existing = this.records.get(fingerprint);
    const record = {
      schema: 'jm-trusted-key/7',
      fingerprint,
      keyId: keyId || existing?.keyId || `jm-author-${fingerprint.slice(-16)}`,
      owner: owner || existing?.owner || 'JM Author',
      publicKeyJwk: deepClone(publicKeyJwk),
      scopes: [...new Set(scopes)],
      status: existing?.status === 'revoked' ? 'revoked' : status,
      trustedAt: existing?.trustedAt || new Date().toISOString(),
      reason,
      rotation: existing?.rotation ?? null,
    };
    this.records.set(fingerprint, record);
    this.events.push({ type: 'trust', fingerprint, status: record.status, at: new Date().toISOString() });
    return deepClone(record);
  }
  get(fingerprint) { return this.records.has(fingerprint) ? deepClone(this.records.get(fingerprint)) : null; }
  revoke(fingerprint, reason = 'revoked') {
    const record = this.records.get(fingerprint);
    invariant(record, `Unknown trusted fingerprint ${fingerprint}`);
    record.status = 'revoked';
    record.revokedAt = new Date().toISOString();
    record.reason = reason;
    this.events.push({ type: 'revoke', fingerprint, reason, at: record.revokedAt });
    return deepClone(record);
  }
  async verify(payload, provenance, { purpose = null } = {}) {
    try {
      invariant(provenance?.algorithm === 'ECDSA-P256-SHA256', 'Unsupported public provenance algorithm');
      if (purpose) invariant(provenance.purpose === purpose, `Expected provenance purpose ${purpose}`);
      const record = this.records.get(provenance.fingerprint);
      invariant(record, `Untrusted authorship key ${provenance?.fingerprint}`);
      invariant(record.status !== 'revoked', `Revoked authorship key ${provenance.fingerprint}`);
      invariant(jmPublicKeyFingerprint(provenance.publicKeyJwk) === provenance.fingerprint, 'Embedded public-key fingerprint mismatch');
      invariant(jmPublicKeyFingerprint(record.publicKeyJwk) === provenance.fingerprint, 'Trusted public-key fingerprint mismatch');
      const payloadDigest = jmSha256(stableStringify(payload));
      invariant(payloadDigest === provenance.payloadDigest, 'Public provenance payload digest mismatch');
      const key = await jmCryptoSubtle().importKey('jwk', record.publicKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
      const valid = await jmCryptoSubtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, key, jmFromBase64Url(provenance.signature), jmUtf8Bytes(payloadDigest));
      invariant(valid, 'Public provenance signature mismatch');
      return { status: 'PASS', fingerprint: provenance.fingerprint, keyId: record.keyId, owner: record.owner, keyStatus: record.status, payloadDigest };
    } catch (error) {
      return { status: 'HOLD', error: error.message, fingerprint: provenance?.fingerprint ?? null };
    }
  }
  async acceptRotation(certificate) {
    try {
      const { provenance, certificateDigest, ...core } = deepClone(certificate ?? {});
      invariant(core.schema === 'jm-key-rotation/7', 'Invalid key rotation schema');
      invariant(jmSha256(stableStringify({ ...core, provenance })) === certificateDigest, 'Rotation certificate digest mismatch');
      invariant(core.fromFingerprint === provenance.fingerprint, 'Rotation signer mismatch');
      invariant(jmPublicKeyFingerprint(core.toPublicKeyJwk) === core.toFingerprint, 'Rotation target fingerprint mismatch');
      const proof = await this.verify(core, provenance, { purpose: 'key-rotation' });
      invariant(proof.status === 'PASS', proof.error || 'Rotation proof HOLD');
      await this.trust(core.toPublicKeyJwk, { keyId: core.toKeyId, owner: core.owner, scopes: ['package:*', 'rotation:*'], status: 'active', reason: 'signed-rotation' });
      const old = this.records.get(core.fromFingerprint);
      old.status = 'superseded';
      old.rotation = { toFingerprint: core.toFingerprint, certificateDigest };
      this.events.push({ type: 'rotation', from: core.fromFingerprint, to: core.toFingerprint, certificateDigest, at: new Date().toISOString() });
      return { status: 'PASS', fromFingerprint: core.fromFingerprint, toFingerprint: core.toFingerprint, certificateDigest };
    } catch (error) {
      return { status: 'HOLD', error: error.message };
    }
  }
  snapshot() {
    const keys = Object.fromEntries([...this.records.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fingerprint, record]) => [fingerprint, deepClone(record)]));
    const core = { schema: 'jm-trust-store/7', keys, events: deepClone(this.events) };
    return { ...core, digest: jmSha256(stableStringify(core)) };
  }
}

class JMIdentityVault {
  constructor(adapter = defaultStorageAdapter(), namespace = 'jm-authorship-e7') {
    this.adapter = adapter;
    this.namespace = namespace;
  }
  key(id = 'active') { return `${this.namespace}:${normaliseName(id)}`; }
  async save(author, id = 'active') {
    const record = await author.exportRecord({ includePrivate: true });
    const core = { ...record, storedAt: new Date().toISOString(), build: BUILD_ID, version: VERSION };
    const wrapped = { ...core, digest: jmSha256(stableStringify(core)) };
    this.adapter.setItem(this.key(id), JSON.stringify(wrapped));
    return deepClone(wrapped);
  }
  async load(id = 'active', required = false) {
    const raw = this.adapter.getItem(this.key(id));
    if (!raw) {
      if (required) throw new JMError(`Unknown authorship identity ${id}`);
      return null;
    }
    const record = JSON.parse(raw);
    const { digest, ...core } = record;
    invariant(jmSha256(stableStringify(core)) === digest, 'Authorship vault digest mismatch');
    return JMWebCryptoAuthor.fromRecord(record);
  }
}

function jmPublicArtifactCore(module, source = '') {
  const base = jmArtifactCore(module, source);
  return { ...base, schema: 'jm-package-artifact/7', build: BUILD_ID, level: 'JM-E7', authorshipPolicy: 'trusted-public-key' };
}

class JMPublicKeyPublicationRegistry {
  constructor({ trustStore = new JMTrustStore() } = {}) {
    this.trustStore = trustStore;
    this.packages = new Map();
    this.receipts = [];
  }
  async publish(module, source = '', author) {
    invariant(author instanceof JMWebCryptoAuthor, 'Public publication requires a JM public-key author');
    await this.trustStore.trust(author.publicKeyJwk, { keyId: author.keyId, owner: author.owner, scopes: ['package:*', 'rotation:*'] });
    const core = jmPublicArtifactCore(module, source);
    const artifactDigest = jmSha256(stableStringify(core));
    const signedPayload = { ...core, artifactDigest };
    const provenance = await author.sign(signedPayload, 'package-authorship');
    const artifact = { ...signedPayload, provenance };
    const verification = await this.verifyArtifact(artifact);
    invariant(verification.status === 'PASS', verification.error || 'Public authorship HOLD');
    const list = this.packages.get(core.package) ?? [];
    const existing = list.find((item) => item.version === core.version);
    if (existing) invariant(existing.artifactDigest === artifactDigest && existing.provenance.fingerprint === provenance.fingerprint, `Immutable public publication conflict ${core.package}@${core.version}`);
    else {
      list.push(deepClone(artifact));
      list.sort((a, b) => jmCompareVersions(b.version, a.version));
      this.packages.set(core.package, list);
    }
    const receipt = { status: 'PASS', package: core.package, version: core.version, artifactDigest, fingerprint: provenance.fingerprint, keyId: provenance.keyId };
    this.receipts.push(receipt);
    return deepClone(artifact);
  }
  async publishBundle(bundle, descriptors = {}, author) {
    invariant(bundle?.status === 'PASS', 'Link a PASS package bundle before public publication');
    const artifacts = {};
    for (const id of bundle.order ?? Object.keys(bundle.modules ?? {})) artifacts[id] = await this.publish(bundle.modules[id], descriptors[id]?.source ?? '', author);
    const registry = this.snapshot();
    const core = { schema: 'jm-publication-release/7', build: BUILD_ID, level: 'JM-E7', author: { owner: author.owner, keyId: author.keyId, fingerprint: author.fingerprint }, artifacts, registry };
    return { ...core, status: 'PASS', digest: jmSha256(stableStringify(core)) };
  }
  get(packageName, version) {
    const name = jmNormalisePackageName(packageName);
    const artifact = (this.packages.get(name) ?? []).find((item) => item.version === String(version));
    invariant(artifact, `Public package ${name}@${version} not found`);
    return deepClone(artifact);
  }
  async verifyArtifact(artifact) {
    try {
      const { provenance, artifactDigest, ...core } = deepClone(artifact ?? {});
      invariant(core.schema === 'jm-package-artifact/7', 'Invalid public package artifact schema');
      invariant(jmSha256(stableStringify(core)) === artifactDigest, `Public artifact digest mismatch for ${core.package}@${core.version}`);
      const proof = await this.trustStore.verify({ ...core, artifactDigest }, provenance, { purpose: 'package-authorship' });
      invariant(proof.status === 'PASS', proof.error || 'Public authorship HOLD');
      return { status: 'PASS', package: core.package, version: core.version, artifactDigest, authorship: proof };
    } catch (error) {
      return { status: 'HOLD', error: error.message };
    }
  }
  async verifyRelease(release) {
    const outcomes = [];
    for (const [id, artifact] of Object.entries(release?.artifacts ?? {})) outcomes.push({ id, ...(await this.verifyArtifact(artifact)) });
    const passed = outcomes.filter((item) => item.status === 'PASS').length;
    return { status: passed === outcomes.length && outcomes.length > 0 ? 'PASS' : 'HOLD', passed, total: outcomes.length, outcomes, trust: this.trustStore.snapshot() };
  }
  snapshot() {
    const packages = {};
    for (const [name, artifacts] of [...this.packages.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      packages[name] = artifacts.map((artifact) => ({ version: artifact.version, module: artifact.module, body: artifact.body, namespace: artifact.namespace, artifactDigest: artifact.artifactDigest, fingerprint: artifact.provenance.fingerprint, keyId: artifact.provenance.keyId }));
    }
    const core = { schema: 'jm-publication-registry/7', packages, trustDigest: this.trustStore.snapshot().digest };
    return { ...core, digest: jmSha256(stableStringify(core)) };
  }
}

class JMProjectCompilerV7 extends JMProjectCompilerV6 {
  constructor(host, options = {}) {
    super(host, options);
    this.trustStore = options.trustStore ?? new JMTrustStore();
    this.identityVault = options.identityVault ?? new JMIdentityVault(options.identityStorage, options.identityNamespace ?? 'jm-authorship-e7');
    this.publicAuthor = options.author ?? null;
    this.publicRegistry = options.publicRegistry ?? new JMPublicKeyPublicationRegistry({ trustStore: this.trustStore });
    this.lastPublicRelease = null;
    this.lastAuthorshipVerification = null;
  }
  build(project) {
    const base = super.build(project);
    if (base.status !== 'PASS') return base;
    const result = { ...base, schema: 'jm-linked-package/7', level: 'JM-E7', version: VERSION, publicAuthorshipReady: true };
    result.digest = jmDigest({ schema: result.schema, id: result.id, version: result.version, level: result.level, modules: result.modules, graph: result.graph, order: result.order, packageRegistry: result.packageRegistry, namespaceIndex: result.namespaceIndex });
    this.lastProject = { project: this.lastProject.project, result: deepClone(result) };
    return result;
  }
  async ensureAuthor({ owner = 'JM TheOlogist', keyId = null, persist = true } = {}) {
    if (!this.publicAuthor) {
      this.publicAuthor = await this.identityVault.load('active', false);
      if (!this.publicAuthor) this.publicAuthor = await JMWebCryptoAuthor.generate({ owner, keyId });
    }
    await this.trustStore.trust(this.publicAuthor.publicKeyJwk, { keyId: this.publicAuthor.keyId, owner: this.publicAuthor.owner, scopes: ['package:*', 'rotation:*'] });
    if (persist) await this.identityVault.save(this.publicAuthor, 'active');
    return this.publicAuthor;
  }
  async publishPublic(options = {}) {
    invariant(this.lastProject?.result?.status === 'PASS', 'Build a package project before public publication');
    const author = await this.ensureAuthor(options);
    const release = await this.publicRegistry.publishBundle(this.lastProject.result, this.lastProject.project.modules, author);
    this.lastPublicRelease = deepClone(release);
    this.ledger.append('public-authorship-release', { project: this.lastProject.project.id, packageCount: Object.keys(release.registry.packages).length, fingerprint: author.fingerprint, releaseDigest: release.digest });
    return { ...release, ledger: this.ledger.snapshot() };
  }
  async verifyAuthorship(release = this.lastPublicRelease) {
    invariant(release, 'Publish a public-key release before authorship verification');
    const result = await this.publicRegistry.verifyRelease(release);
    this.lastAuthorshipVerification = deepClone(result);
    this.ledger.append(result.status === 'PASS' ? 'public-authorship-ding' : 'public-authorship-hold', { status: result.status, passed: result.passed, total: result.total, fingerprint: release.author?.fingerprint ?? null });
    return { ...result, ledger: this.ledger.snapshot() };
  }
  async rotateAuthor({ owner = null } = {}) {
    const current = await this.ensureAuthor({ owner: owner || 'JM TheOlogist' });
    const next = await JMWebCryptoAuthor.generate({ owner: owner || current.owner });
    const certificate = await current.createRotationCertificate(next);
    const acceptance = await this.trustStore.acceptRotation(certificate);
    invariant(acceptance.status === 'PASS', acceptance.error || 'Authorship rotation HOLD');
    this.publicAuthor = next;
    await this.identityVault.save(next, 'active');
    this.ledger.append('public-key-rotation', { from: current.fingerprint, to: next.fingerprint, certificateDigest: certificate.certificateDigest });
    return { status: 'PASS', previous: { keyId: current.keyId, fingerprint: current.fingerprint }, current: { keyId: next.keyId, fingerprint: next.fingerprint }, certificate, acceptance, trust: this.trustStore.snapshot(), ledger: this.ledger.snapshot() };
  }
  revokeAuthor(fingerprint = this.publicAuthor?.fingerprint, reason = 'manual-revocation') {
    const record = this.trustStore.revoke(fingerprint, reason);
    this.ledger.append('public-key-revocation', { fingerprint, reason });
    return { status: 'PASS', record, trust: this.trustStore.snapshot(), ledger: this.ledger.snapshot() };
  }
  async publicRelease(project, options = {}) {
    const linked = this.build(project);
    if (linked.status !== 'PASS') return { status: 'HOLD', stage: 'link', linked };
    const publication = await this.publishPublic(options);
    const verification = await this.verifyAuthorship(publication);
    return { status: verification.status, level: 'JM-E7', linked, publication, verification };
  }
}

const jmE6Compile = CodingBody.prototype.compile;
const jmE6ManifestBody = CodingBody.prototype.manifest;
CodingBody.prototype.compile = function compileE7(sourceOrAst) {
  const ir = jmE6Compile.call(this, sourceOrAst);
  return { ...ir, version: '7.0-jm', publicAuthorshipReady: true, trustPolicyReady: true, keyRotationReady: true, revocationReady: true };
};
CodingBody.prototype.manifest = function manifestE7() {
  const previous = jmE6ManifestBody.call(this);
  return { ...previous, version: '7.0-jm', sourceState: 'implemented-v0.7', elevation: { level: 'JM-E7', equalised: true, guarantees: [
    'ecdsa-p256-public-authorship', 'public-key-fingerprint', 'trusted-author-policy', 'signed-key-rotation', 'key-revocation', 'device-local-identity-vault',
    ...previous.elevation.guarantees,
  ] } };
};
for (const body of BODY_DEFINITIONS) {
  body.version = '7.0-jm';
  for (const capability of ['can-public-sign', 'can-verify-authorship', 'can-trust-author', 'can-rotate-key', 'can-revoke-key']) body.capabilities.add(capability);
}
EstateHost.prototype.createProjectCompiler = function createProjectCompilerE7(options = {}) { return new JMProjectCompilerV7(this, options); };
const jmE6EstateManifest = EstateHost.prototype.manifest;
EstateHost.prototype.manifest = function estateManifestE7() {
  const manifest = jmE6EstateManifest.call(this);
  return { ...manifest, version: VERSION, build: BUILD_ID, elevation: {
    level: 'JM-E7', equalisedBodies: this.bodies.size,
    authorship: 'ECDSA P-256 public-key signatures over SHA-256 package artifact digests',
    trust: 'explicit fingerprint trust store with active, superseded and revoked key states',
    rotation: 'old-key-signed rotation certificates transfer trust to a new public key',
    identity: 'extractable device-local key identity stored by a digest-protected JM identity vault',
    inherited: ['immutable-publication', 'hmac-sha256-provenance', 'transactional-install', 'exact-lockfiles', 'reproducible-installs', 'declared-modules', 'namespaced-exports', 'semantic-version-resolution', 'live-continuation', 'checkpoint-rewind', 'incremental-hot-patch', 'tamper-evident-ledger', 'semantic-analysis', 'optimisation', 'debugging', 'contracts', 'normalised-ir', 'persistence', 'trace-replay'],
  } };
};


// -----------------------------------------------------------------------------
// JM-E8 — quota-resilient identity storage, portable backup and migration
// -----------------------------------------------------------------------------

class JMAsyncMemoryStore {
  constructor() { this.values = new Map(); }
  async getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  async setItem(key, value) { this.values.set(key, String(value)); }
  async removeItem(key) { this.values.delete(key); }
  async keys() { return [...this.values.keys()]; }
}

class JMIndexedDBStore {
  constructor({ indexedDBRef = globalThis?.indexedDB, dbName = 'jm-coding-estate-e8', storeName = 'keyvalue' } = {}) {
    this.indexedDBRef = indexedDBRef;
    this.dbName = dbName;
    this.storeName = storeName;
    this._db = null;
  }
  get available() { return Boolean(this.indexedDBRef?.open); }
  async open() {
    invariant(this.available, 'IndexedDB is unavailable on this device');
    if (this._db) return this._db;
    this._db = await new Promise((resolve, reject) => {
      const request = this.indexedDBRef.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) db.createObjectStore(this.storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new JMError('IndexedDB open failed'));
      request.onblocked = () => reject(new JMError('IndexedDB open blocked'));
    });
    return this._db;
  }
  async transact(mode, action) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, mode);
      const store = transaction.objectStore(this.storeName);
      let request;
      try { request = action(store); } catch (error) { reject(error); return; }
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error || transaction.error || new JMError('IndexedDB request failed'));
      transaction.onabort = () => reject(transaction.error || new JMError('IndexedDB transaction aborted'));
    });
  }
  async getItem(key) { return this.transact('readonly', (store) => store.get(String(key))); }
  async setItem(key, value) { await this.transact('readwrite', (store) => store.put(String(value), String(key))); }
  async removeItem(key) { await this.transact('readwrite', (store) => store.delete(String(key))); }
  async keys() { return this.transact('readonly', (store) => store.getAllKeys()); }
}

class JMQuotaAwareIdentityVault {
  constructor({
    primary = null,
    fallback = null,
    memory = null,
    namespace = 'jm-authorship-e8',
    legacyNamespaces = ['jm-authorship-e7'],
    indexedDBRef = globalThis?.indexedDB,
  } = {}) {
    this.namespace = namespace;
    this.primary = primary ?? new JMIndexedDBStore({ indexedDBRef });
    this.fallback = fallback ?? defaultStorageAdapter();
    this.memory = memory ?? new JMAsyncMemoryStore();
    this.legacyNamespaces = [...new Set(legacyNamespaces)];
    this.lastStorageReceipt = null;
  }
  key(id = 'active', namespace = this.namespace) { return `${namespace}:${normaliseName(id)}`; }
  makeWrapped(record) {
    const core = { ...record, storedAt: new Date().toISOString(), build: BUILD_ID, version: VERSION, level: 'JM-E8' };
    return { ...core, digest: jmSha256(stableStringify(core)) };
  }
  validateWrapped(record) {
    invariant(record?.schema === 'jm-authorship-identity/7', 'Authorship record schema mismatch');
    const { digest, ...core } = record;
    invariant(digest && jmSha256(stableStringify(core)) === digest, 'Authorship vault digest mismatch');
    return record;
  }
  async tryWrite(backend, backendName, key, payload, durable) {
    if (!backend) return { status: 'HOLD', backend: backendName, durable, error: `${backendName} unavailable` };
    try {
      await backend.setItem(key, payload);
      const roundTrip = await backend.getItem(key);
      invariant(roundTrip === payload, `${backendName} write verification mismatch`);
      return { status: 'PASS', backend: backendName, durable, bytes: new TextEncoder().encode(payload).length };
    } catch (error) {
      return { status: 'HOLD', backend: backendName, durable, error: error.message };
    }
  }
  async save(author, id = 'active') {
    const record = await author.exportRecord({ includePrivate: true });
    const wrapped = this.makeWrapped(record);
    const payload = JSON.stringify(wrapped);
    const attempts = [];
    const primary = await this.tryWrite(this.primary, 'indexeddb', this.key(id), payload, true);
    attempts.push(primary);
    if (primary.status === 'PASS') {
      this.lastStorageReceipt = { ...primary, status: 'PASS', attempts };
      return { ...deepClone(wrapped), storage: deepClone(this.lastStorageReceipt) };
    }
    const fallback = await this.tryWrite(this.fallback, 'localStorage', this.key(id), payload, true);
    attempts.push(fallback);
    if (fallback.status === 'PASS') {
      this.lastStorageReceipt = { ...fallback, status: 'PASS', attempts };
      return { ...deepClone(wrapped), storage: deepClone(this.lastStorageReceipt) };
    }
    const memory = await this.tryWrite(this.memory, 'memory', this.key(id), payload, false);
    attempts.push(memory);
    this.lastStorageReceipt = { ...memory, status: 'HOLD', durable: false, backupRequired: true, attempts };
    return { ...deepClone(wrapped), storage: deepClone(this.lastStorageReceipt) };
  }
  async readRaw(id = 'active') {
    const key = this.key(id);
    for (const [backendName, backend, durable] of [['indexeddb', this.primary, true], ['localStorage', this.fallback, true], ['memory', this.memory, false]]) {
      if (!backend) continue;
      try {
        const raw = await backend.getItem(key);
        if (raw) return { raw, backend: backendName, durable };
      } catch (_) { /* continue through the route */ }
    }
    return null;
  }
  async load(id = 'active', required = false) {
    let found = await this.readRaw(id);
    if (!found) {
      const migrated = await this.migrateLegacy(id, false);
      if (migrated.status === 'PASS') found = await this.readRaw(id);
    }
    if (!found) {
      if (required) throw new JMError(`Unknown authorship identity ${id}`);
      return null;
    }
    const record = this.validateWrapped(JSON.parse(found.raw));
    const author = await JMWebCryptoAuthor.fromRecord(record);
    this.lastStorageReceipt = { status: found.durable ? 'PASS' : 'HOLD', backend: found.backend, durable: found.durable, loaded: true };
    return author;
  }
  async exportBackup(id = 'active') {
    const found = await this.readRaw(id);
    invariant(found, `Unknown authorship identity ${id}`);
    const identity = this.validateWrapped(JSON.parse(found.raw));
    const core = {
      schema: 'jm-portable-identity-backup/8',
      build: BUILD_ID,
      version: VERSION,
      level: 'JM-E8',
      exportedAt: new Date().toISOString(),
      identity,
    };
    return { ...core, digest: jmSha256(stableStringify(core)) };
  }
  async importBackup(payload, id = 'active') {
    const backup = typeof payload === 'string' ? JSON.parse(payload) : deepClone(payload);
    invariant(backup?.schema === 'jm-portable-identity-backup/8', 'Invalid JM identity backup schema');
    const { digest, ...core } = backup;
    invariant(jmSha256(stableStringify(core)) === digest, 'JM identity backup digest mismatch');
    const identity = this.validateWrapped(core.identity);
    const author = await JMWebCryptoAuthor.fromRecord(identity);
    const saved = await this.save(author, id);
    return { status: saved.storage.status, author, fingerprint: author.fingerprint, storage: saved.storage, backupDigest: digest };
  }
  async migrateLegacy(id = 'active', required = false) {
    for (const namespace of this.legacyNamespaces) {
      try {
        const raw = await this.fallback.getItem(this.key(id, namespace));
        if (!raw) continue;
        const record = this.validateWrapped(JSON.parse(raw));
        const author = await JMWebCryptoAuthor.fromRecord(record);
        const saved = await this.save(author, id);
        return { status: saved.storage.status, migrated: true, from: namespace, fingerprint: author.fingerprint, storage: saved.storage };
      } catch (_) { /* inspect the next legacy namespace */ }
    }
    if (required) throw new JMError(`No legacy authorship identity ${id} found`);
    return { status: 'HOLD', migrated: false, error: 'No legacy identity found' };
  }
  async health() {
    let estimate = null;
    try {
      if (globalThis?.navigator?.storage?.estimate) estimate = await globalThis.navigator.storage.estimate();
    } catch (_) { estimate = null; }
    const primaryAvailable = Boolean(this.primary?.available ?? this.primary);
    let fallbackWritable = false;
    const probeKey = this.key(`probe-${Date.now()}`);
    try {
      await this.fallback.setItem(probeKey, '1');
      await this.fallback.removeItem(probeKey);
      fallbackWritable = true;
    } catch (_) { fallbackWritable = false; }
    return {
      status: primaryAvailable || fallbackWritable ? 'PASS' : 'HOLD',
      primary: primaryAvailable ? 'indexeddb-available' : 'indexeddb-unavailable',
      localStorageWritable: fallbackWritable,
      estimate: estimate ? { usage: estimate.usage ?? null, quota: estimate.quota ?? null, remaining: estimate.quota != null && estimate.usage != null ? estimate.quota - estimate.usage : null } : null,
      lastStorageReceipt: deepClone(this.lastStorageReceipt),
      policy: 'indexeddb-first → compact-localStorage → volatile-memory + mandatory backup',
    };
  }
}

class JMProjectCompilerV8 extends JMProjectCompilerV7 {
  constructor(host, options = {}) {
    super(host, options);
    this.identityVault = options.identityVault ?? new JMQuotaAwareIdentityVault({
      primary: options.identityPrimary ?? null,
      fallback: options.identityStorage ?? defaultStorageAdapter(),
      memory: options.identityMemory ?? null,
      namespace: options.identityNamespace ?? 'jm-authorship-e8',
      legacyNamespaces: options.legacyIdentityNamespaces ?? ['jm-authorship-e7'],
      indexedDBRef: options.indexedDBRef ?? globalThis?.indexedDB,
    });
    this.lastIdentityStorage = null;
  }
  build(project) {
    const base = super.build(project);
    if (base.status !== 'PASS') return base;
    const result = { ...base, level: 'JM-E8', version: VERSION, resilientIdentityStorageReady: true, portableIdentityBackupReady: true };
    result.digest = jmDigest({ schema: result.schema, id: result.id, version: result.version, level: result.level, modules: result.modules, graph: result.graph, order: result.order, packageRegistry: result.packageRegistry, namespaceIndex: result.namespaceIndex });
    this.lastProject = { project: this.lastProject.project, result: deepClone(result) };
    return result;
  }
  async ensureAuthor({ owner = 'JM TheOlogist', keyId = null, persist = true } = {}) {
    if (!this.publicAuthor) {
      this.publicAuthor = await this.identityVault.load('active', false);
      if (!this.publicAuthor) this.publicAuthor = await JMWebCryptoAuthor.generate({ owner, keyId });
    }
    await this.trustStore.trust(this.publicAuthor.publicKeyJwk, { keyId: this.publicAuthor.keyId, owner: this.publicAuthor.owner, scopes: ['package:*', 'rotation:*'] });
    if (persist) {
      const saved = await this.identityVault.save(this.publicAuthor, 'active');
      this.lastIdentityStorage = saved.storage;
    }
    return this.publicAuthor;
  }
  async identityHealth() { return this.identityVault.health(); }
  async exportIdentityBackup() {
    await this.ensureAuthor({ persist: true });
    return this.identityVault.exportBackup('active');
  }
  async importIdentityBackup(payload) {
    const result = await this.identityVault.importBackup(payload, 'active');
    this.publicAuthor = result.author;
    this.lastIdentityStorage = result.storage;
    await this.trustStore.trust(this.publicAuthor.publicKeyJwk, { keyId: this.publicAuthor.keyId, owner: this.publicAuthor.owner, scopes: ['package:*', 'rotation:*'], reason: 'portable-backup-import' });
    this.ledger.append('identity-backup-import', { fingerprint: result.fingerprint, storage: result.storage });
    return { ...result, author: { owner: result.author.owner, keyId: result.author.keyId, fingerprint: result.author.fingerprint }, ledger: this.ledger.snapshot() };
  }
  async publicRelease(project, options = {}) {
    const linked = this.build(project);
    if (linked.status !== 'PASS') return { status: 'HOLD', stage: 'link', linked };
    const publication = await this.publishPublic(options);
    const verification = await this.verifyAuthorship(publication);
    return { status: verification.status, level: 'JM-E8', linked, publication, verification, identityStorage: deepClone(this.lastIdentityStorage) };
  }
}

const jmE7Compile = CodingBody.prototype.compile;
const jmE7ManifestBody = CodingBody.prototype.manifest;
CodingBody.prototype.compile = function compileE8(sourceOrAst) {
  const ir = jmE7Compile.call(this, sourceOrAst);
  return { ...ir, version: '8.0-jm', resilientStorageReady: true, portableIdentityReady: true, storagePreflightReady: true };
};
CodingBody.prototype.manifest = function manifestE8() {
  const previous = jmE7ManifestBody.call(this);
  return { ...previous, version: '8.0-jm', sourceState: 'implemented-v0.8', elevation: { level: 'JM-E8', equalised: true, guarantees: [
    'indexeddb-first-identity-storage', 'localstorage-quota-fallback', 'portable-identity-backup', 'identity-backup-import', 'legacy-e7-identity-migration', 'storage-health-preflight',
    ...previous.elevation.guarantees,
  ] } };
};
for (const body of BODY_DEFINITIONS) {
  body.version = '8.0-jm';
  for (const capability of ['can-storage-preflight', 'can-durable-identity', 'can-export-identity', 'can-import-identity', 'can-migrate-identity']) body.capabilities.add(capability);
}
EstateHost.prototype.createProjectCompiler = function createProjectCompilerE8(options = {}) { return new JMProjectCompilerV8(this, options); };
const jmE7EstateManifest = EstateHost.prototype.manifest;
EstateHost.prototype.manifest = function estateManifestE8() {
  const manifest = jmE7EstateManifest.call(this);
  return { ...manifest, version: VERSION, build: BUILD_ID, elevation: {
    level: 'JM-E8', equalisedBodies: this.bodies.size,
    storage: 'quota-resilient identity persistence uses IndexedDB first, compact localStorage second, and volatile memory only with an explicit backup-required HOLD',
    portability: 'digest-protected identity backup export and import preserve the public/private author identity across devices',
    migration: 'non-destructive read-and-copy migration from JM-E7 identity storage',
    health: 'storage preflight reports durable backend availability and browser quota estimates when exposed',
    inherited: ['ecdsa-public-authorship', 'trusted-author-policy', 'signed-key-rotation', 'key-revocation', 'immutable-publication', 'hmac-sha256-provenance', 'transactional-install', 'exact-lockfiles', 'reproducible-installs', 'declared-modules', 'namespaced-exports', 'semantic-version-resolution', 'live-continuation', 'checkpoint-rewind', 'incremental-hot-patch', 'tamper-evident-ledger', 'semantic-analysis', 'optimisation', 'debugging', 'contracts', 'normalised-ir', 'persistence', 'trace-replay'],
  } };
};


// -----------------------------------------------------------------------------
// JM-E9 — passphrase-encrypted private identity, lock/unlock and encrypted backup
// -----------------------------------------------------------------------------

function jmRandomBytes(length = 16) {
  const cryptoRef = globalThis?.crypto;
  invariant(cryptoRef?.getRandomValues, 'Cryptographic random source is unavailable on this device');
  const bytes = new Uint8Array(length);
  cryptoRef.getRandomValues(bytes);
  return bytes;
}

function jmPassphrasePolicy(passphrase) {
  const value = String(passphrase ?? '');
  const classes = [/[a-z]/.test(value), /[A-Z]/.test(value), /[0-9]/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
  const status = value.length >= 12 && (classes >= 2 || value.length >= 20) ? 'PASS' : 'HOLD';
  return { status, length: value.length, classes, minimumLength: 12, policy: '12+ characters and 2 classes, or 20+ characters' };
}

async function jmDerivePassphraseKey(passphrase, salt, iterations = 210000) {
  const policy = jmPassphrasePolicy(passphrase);
  invariant(policy.status === 'PASS', `Passphrase policy HOLD: ${policy.policy}`);
  invariant(Number.isInteger(iterations) && iterations >= 100000, 'PBKDF2 iteration count is too low');
  const subtle = jmCryptoSubtle();
  const material = await subtle.importKey('raw', jmUtf8Bytes(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function jmEncryptJson(value, passphrase, { iterations = 210000, purpose = 'jm-e9-private-identity' } = {}) {
  const salt = jmRandomBytes(16), iv = jmRandomBytes(12);
  const aad = stableStringify({ schema: 'jm-encrypted-envelope/9', build: BUILD_ID, version: VERSION, level: 'JM-E9', purpose });
  const plaintext = stableStringify(value);
  const key = await jmDerivePassphraseKey(passphrase, salt, iterations);
  const ciphertext = await jmCryptoSubtle().encrypt({ name: 'AES-GCM', iv, additionalData: jmUtf8Bytes(aad), tagLength: 128 }, key, jmUtf8Bytes(plaintext));
  const core = {
    schema: 'jm-encrypted-envelope/9', build: BUILD_ID, version: VERSION, level: 'JM-E9', purpose,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: jmBase64Url(salt) },
    cipher: { name: 'AES-GCM', keyLength: 256, tagLength: 128, iv: jmBase64Url(iv) },
    aad, plaintextDigest: jmSha256(plaintext), ciphertext: jmBase64Url(ciphertext), createdAt: new Date().toISOString(),
  };
  return { ...core, digest: jmSha256(stableStringify(core)) };
}

async function jmDecryptJson(payload, passphrase, { expectedPurpose = null } = {}) {
  const envelope = typeof payload === 'string' ? JSON.parse(payload) : deepClone(payload);
  invariant(envelope?.schema === 'jm-encrypted-envelope/9', 'Invalid JM encrypted envelope schema');
  const { digest, ...core } = envelope;
  invariant(jmSha256(stableStringify(core)) === digest, 'Encrypted envelope digest mismatch');
  if (expectedPurpose) invariant(core.purpose === expectedPurpose, `Expected encrypted purpose ${expectedPurpose}`);
  invariant(core.kdf?.name === 'PBKDF2' && core.kdf?.hash === 'SHA-256', 'Unsupported encrypted identity KDF');
  invariant(core.cipher?.name === 'AES-GCM' && core.cipher?.keyLength === 256, 'Unsupported encrypted identity cipher');
  try {
    const key = await jmDerivePassphraseKey(passphrase, jmFromBase64Url(core.kdf.salt), Number(core.kdf.iterations));
    const plaintextBytes = await jmCryptoSubtle().decrypt({ name: 'AES-GCM', iv: jmFromBase64Url(core.cipher.iv), additionalData: jmUtf8Bytes(core.aad), tagLength: Number(core.cipher.tagLength || 128) }, key, jmFromBase64Url(core.ciphertext));
    const plaintext = new TextDecoder().decode(plaintextBytes);
    invariant(jmSha256(plaintext) === core.plaintextDigest, 'Encrypted identity plaintext digest mismatch');
    return JSON.parse(plaintext);
  } catch (error) {
    throw new JMError(`Encrypted identity unlock HOLD: ${error.message}`);
  }
}

JMQuotaAwareIdentityVault.prototype.remove = async function removeIdentity(id = 'active') {
  const key = this.key(id), outcomes = [];
  for (const [backendName, backend] of [['indexeddb', this.primary], ['localStorage', this.fallback], ['memory', this.memory]]) {
    if (!backend) continue;
    try { await backend.removeItem(key); outcomes.push({ backend: backendName, status: 'PASS' }); }
    catch (error) { outcomes.push({ backend: backendName, status: 'HOLD', error: error.message }); }
  }
  return { status: outcomes.some((x) => x.status === 'PASS') ? 'PASS' : 'HOLD', outcomes };
};

class JMEncryptedIdentityVault {
  constructor({ base = null, namespace = 'jm-authorship-e9' } = {}) {
    this.base = base ?? new JMQuotaAwareIdentityVault({ namespace: 'jm-authorship-e8' });
    this.namespace = namespace;
    this.lastReceipt = null;
  }
  key(id = 'active') { return `${this.namespace}:${normaliseName(id)}:protected`; }
  async writeEnvelope(envelope, id = 'active') {
    const payload = JSON.stringify(envelope), attempts = [], key = this.key(id);
    for (const [backendName, backend, durable] of [['indexeddb', this.base.primary, true], ['localStorage', this.base.fallback, true], ['memory', this.base.memory, false]]) {
      const result = await this.base.tryWrite(backend, backendName, key, payload, durable);
      attempts.push(result);
      if (result.status === 'PASS') {
        this.lastReceipt = { ...result, status: durable ? 'PASS' : 'HOLD', durable, backupRequired: !durable, attempts, encryptedAtRest: true };
        return deepClone(this.lastReceipt);
      }
    }
    throw new JMError('Unable to persist encrypted identity on this device');
  }
  async readEnvelope(id = 'active', required = false) {
    const key = this.key(id);
    for (const [backendName, backend, durable] of [['indexeddb', this.base.primary, true], ['localStorage', this.base.fallback, true], ['memory', this.base.memory, false]]) {
      if (!backend) continue;
      try {
        const raw = await backend.getItem(key);
        if (raw) return { envelope: JSON.parse(raw), backend: backendName, durable };
      } catch (_) { /* continue */ }
    }
    if (required) throw new JMError(`No protected JM identity ${id} found`);
    return null;
  }
  async hasProtected(id = 'active') { return Boolean(await this.readEnvelope(id, false)); }
  async makePortableBackup(author) {
    const record = await author.exportRecord({ includePrivate: true });
    const identity = this.base.makeWrapped(record);
    const core = { schema: 'jm-portable-identity-backup/8', build: BUILD_ID, version: VERSION, level: 'JM-E9', exportedAt: new Date().toISOString(), identity };
    return { ...core, digest: jmSha256(stableStringify(core)) };
  }
  validatePortableBackup(backup) {
    invariant(backup?.schema === 'jm-portable-identity-backup/8', 'Invalid decrypted identity backup schema');
    const { digest, ...core } = backup;
    invariant(jmSha256(stableStringify(core)) === digest, 'Decrypted identity backup digest mismatch');
    this.base.validateWrapped(core.identity);
    return core.identity;
  }
  async protectAuthor(author, passphrase, id = 'active') {
    const backup = await this.makePortableBackup(author);
    const envelope = await jmEncryptJson(backup, passphrase, { purpose: 'jm-e9-private-identity' });
    const storage = await this.writeEnvelope(envelope, id);
    const removal = await this.base.remove(id);
    this.lastReceipt = { ...storage, plaintextRemoved: removal.status === 'PASS', fingerprint: author.fingerprint, envelopeDigest: envelope.digest };
    return { status: storage.status, fingerprint: author.fingerprint, envelope, storage: deepClone(this.lastReceipt) };
  }
  async unlock(passphrase, id = 'active') {
    const found = await this.readEnvelope(id, true);
    const backup = await jmDecryptJson(found.envelope, passphrase, { expectedPurpose: 'jm-e9-private-identity' });
    const identity = this.validatePortableBackup(backup);
    const author = await JMWebCryptoAuthor.fromRecord(identity);
    this.lastReceipt = { status: found.durable ? 'PASS' : 'HOLD', backend: found.backend, durable: found.durable, encryptedAtRest: true, unlockedInMemory: true, fingerprint: author.fingerprint };
    return { status: this.lastReceipt.status, author, fingerprint: author.fingerprint, storage: deepClone(this.lastReceipt), envelopeDigest: found.envelope.digest };
  }
  async lock(id = 'active') {
    const found = await this.readEnvelope(id, true);
    this.lastReceipt = { status: 'PASS', backend: found.backend, durable: found.durable, encryptedAtRest: true, locked: true, envelopeDigest: found.envelope.digest };
    return deepClone(this.lastReceipt);
  }
  async exportEncrypted(author, passphrase) {
    const backup = await this.makePortableBackup(author);
    return jmEncryptJson(backup, passphrase, { purpose: 'jm-e9-portable-identity-backup' });
  }
  async importEncrypted(payload, passphrase, id = 'active') {
    const envelope = typeof payload === 'string' ? JSON.parse(payload) : deepClone(payload);
    const backup = await jmDecryptJson(envelope, passphrase, { expectedPurpose: 'jm-e9-portable-identity-backup' });
    const identity = this.validatePortableBackup(backup);
    const author = await JMWebCryptoAuthor.fromRecord(identity);
    const atRest = await jmEncryptJson(backup, passphrase, { purpose: 'jm-e9-private-identity' });
    const storage = await this.writeEnvelope(atRest, id);
    await this.base.remove(id);
    return { status: storage.status, author, fingerprint: author.fingerprint, storage, sourceEnvelopeDigest: envelope.digest, atRestEnvelopeDigest: atRest.digest };
  }
  async health(id = 'active') {
    const base = await this.base.health(), protectedRecord = await this.readEnvelope(id, false);
    return { ...base, level: 'JM-E9', protectedIdentity: Boolean(protectedRecord), protectedBackend: protectedRecord?.backend ?? null, encryptedAtRest: Boolean(protectedRecord), privateKeyState: protectedRecord ? 'locked-or-memory-unlocked' : 'legacy-or-unprotected', encryption: 'PBKDF2-SHA256 → AES-256-GCM', lastSecureReceipt: deepClone(this.lastReceipt) };
  }
}

class JMProjectCompilerV9 extends JMProjectCompilerV8 {
  constructor(host, options = {}) {
    super(host, options);
    this.secureIdentityVault = options.secureIdentityVault ?? new JMEncryptedIdentityVault({ base: this.identityVault, namespace: options.secureIdentityNamespace ?? 'jm-authorship-e9' });
    this.identityLocked = false;
  }
  build(project) {
    const base = super.build(project);
    if (base.status !== 'PASS') return base;
    const result = { ...base, level: 'JM-E9', version: VERSION, encryptedIdentityReady: true, identityLockReady: true, encryptedBackupReady: true };
    result.digest = jmDigest({ schema: result.schema, id: result.id, version: result.version, level: result.level, modules: result.modules, graph: result.graph, order: result.order, packageRegistry: result.packageRegistry, namespaceIndex: result.namespaceIndex });
    this.lastProject = { project: this.lastProject.project, result: deepClone(result) };
    return result;
  }
  async ensureAuthor({ owner = 'JM TheOlogist', keyId = null, persist = true } = {}) {
    if (this.publicAuthor) {
      await this.trustStore.trust(this.publicAuthor.publicKeyJwk, { keyId: this.publicAuthor.keyId, owner: this.publicAuthor.owner, scopes: ['package:*', 'rotation:*'] });
      return this.publicAuthor;
    }
    if (await this.secureIdentityVault.hasProtected('active')) {
      this.identityLocked = true;
      throw new JMError('Protected identity is locked; unlock it before signing');
    }
    this.publicAuthor = await this.identityVault.load('active', false);
    if (!this.publicAuthor) this.publicAuthor = await JMWebCryptoAuthor.generate({ owner, keyId });
    await this.trustStore.trust(this.publicAuthor.publicKeyJwk, { keyId: this.publicAuthor.keyId, owner: this.publicAuthor.owner, scopes: ['package:*', 'rotation:*'] });
    if (persist) {
      const saved = await this.identityVault.save(this.publicAuthor, 'active');
      this.lastIdentityStorage = saved.storage;
    }
    return this.publicAuthor;
  }
  async protectIdentity(passphrase, { owner = 'JM TheOlogist', keyId = null } = {}) {
    const author = await this.ensureAuthor({ owner, keyId, persist: false });
    const protectedResult = await this.secureIdentityVault.protectAuthor(author, passphrase, 'active');
    this.publicAuthor = author;
    this.identityLocked = false;
    this.lastIdentityStorage = protectedResult.storage;
    this.ledger.append('identity-protected', { fingerprint: author.fingerprint, envelopeDigest: protectedResult.envelope.digest, backend: protectedResult.storage.backend, plaintextRemoved: protectedResult.storage.plaintextRemoved });
    return { ...protectedResult, author: { owner: author.owner, keyId: author.keyId, fingerprint: author.fingerprint }, ledger: this.ledger.snapshot() };
  }
  async lockIdentity() {
    const storage = await this.secureIdentityVault.lock('active');
    const fingerprint = this.publicAuthor?.fingerprint ?? storage.fingerprint ?? null;
    this.publicAuthor = null;
    this.identityLocked = true;
    this.ledger.append('identity-lock', { fingerprint, envelopeDigest: storage.envelopeDigest });
    return { status: 'PASS', locked: true, fingerprint, storage, ledger: this.ledger.snapshot() };
  }
  async unlockIdentity(passphrase) {
    const result = await this.secureIdentityVault.unlock(passphrase, 'active');
    this.publicAuthor = result.author;
    this.identityLocked = false;
    this.lastIdentityStorage = result.storage;
    await this.trustStore.trust(this.publicAuthor.publicKeyJwk, { keyId: this.publicAuthor.keyId, owner: this.publicAuthor.owner, scopes: ['package:*', 'rotation:*'], reason: 'encrypted-identity-unlock' });
    this.ledger.append('identity-unlock', { fingerprint: result.fingerprint, backend: result.storage.backend, envelopeDigest: result.envelopeDigest });
    return { ...result, author: { owner: result.author.owner, keyId: result.author.keyId, fingerprint: result.author.fingerprint }, ledger: this.ledger.snapshot() };
  }
  async exportEncryptedIdentity(passphrase) {
    const author = await this.ensureAuthor({ persist: false });
    const envelope = await this.secureIdentityVault.exportEncrypted(author, passphrase);
    this.ledger.append('encrypted-identity-export', { fingerprint: author.fingerprint, envelopeDigest: envelope.digest });
    return envelope;
  }
  async importEncryptedIdentity(payload, passphrase) {
    const result = await this.secureIdentityVault.importEncrypted(payload, passphrase, 'active');
    this.publicAuthor = result.author;
    this.identityLocked = false;
    this.lastIdentityStorage = result.storage;
    await this.trustStore.trust(this.publicAuthor.publicKeyJwk, { keyId: this.publicAuthor.keyId, owner: this.publicAuthor.owner, scopes: ['package:*', 'rotation:*'], reason: 'encrypted-backup-import' });
    this.ledger.append('encrypted-identity-import', { fingerprint: result.fingerprint, sourceEnvelopeDigest: result.sourceEnvelopeDigest, backend: result.storage.backend });
    return { ...result, author: { owner: result.author.owner, keyId: result.author.keyId, fingerprint: result.author.fingerprint }, ledger: this.ledger.snapshot() };
  }
  async rotateAuthor({ owner = null, passphrase = null } = {}) {
    invariant(passphrase, 'Passphrase required to protect the rotated identity');
    const current = await this.ensureAuthor({ owner: owner || 'JM TheOlogist' });
    const next = await JMWebCryptoAuthor.generate({ owner: owner || current.owner });
    const certificate = await current.createRotationCertificate(next);
    const acceptance = await this.trustStore.acceptRotation(certificate);
    invariant(acceptance.status === 'PASS', acceptance.error || 'Authorship rotation HOLD');
    const protectedResult = await this.secureIdentityVault.protectAuthor(next, passphrase, 'active');
    this.publicAuthor = next;
    this.identityLocked = false;
    this.lastIdentityStorage = protectedResult.storage;
    this.ledger.append('public-key-rotation', { from: current.fingerprint, to: next.fingerprint, certificateDigest: certificate.certificateDigest, encryptedAtRest: true });
    return { status: 'PASS', previous: { keyId: current.keyId, fingerprint: current.fingerprint }, current: { keyId: next.keyId, fingerprint: next.fingerprint }, certificate, acceptance, storage: protectedResult.storage, trust: this.trustStore.snapshot(), ledger: this.ledger.snapshot() };
  }
  async identityHealth() { return this.secureIdentityVault.health('active'); }
  async publishPublic(options = {}) {
    invariant(await this.secureIdentityVault.hasProtected('active'), 'Protect the private identity before public publication');
    return super.publishPublic(options);
  }
  async publicRelease(project, options = {}) {
    const linked = this.build(project);
    if (linked.status !== 'PASS') return { status: 'HOLD', stage: 'link', linked };
    const publication = await this.publishPublic(options);
    const verification = await this.verifyAuthorship(publication);
    return { status: verification.status, level: 'JM-E9', linked, publication, verification, identityStorage: deepClone(this.lastIdentityStorage), identityLocked: this.identityLocked };
  }
}

const jmE8Compile = CodingBody.prototype.compile;
const jmE8ManifestBody = CodingBody.prototype.manifest;
CodingBody.prototype.compile = function compileE9(sourceOrAst) {
  const ir = jmE8Compile.call(this, sourceOrAst);
  return { ...ir, version: '9.0-jm', encryptedIdentityReady: true, identityLockReady: true, encryptedBackupReady: true, privateKeyWipeReady: true };
};
CodingBody.prototype.manifest = function manifestE9() {
  const previous = jmE8ManifestBody.call(this);
  return { ...previous, version: '9.0-jm', sourceState: 'implemented-v0.9', elevation: { level: 'JM-E9', equalised: true, guarantees: [
    'pbkdf2-sha256-passphrase-kdf', 'aes-256-gcm-private-key-encryption', 'encrypted-identity-at-rest', 'explicit-private-key-lock', 'in-memory-identity-unlock', 'encrypted-portable-backup', 'wrong-passphrase-hold', 'ciphertext-tamper-hold', 'plaintext-vault-removal',
    ...previous.elevation.guarantees,
  ] } };
};
for (const body of BODY_DEFINITIONS) {
  body.version = '9.0-jm';
  for (const capability of ['can-encrypt-identity', 'can-lock-private-key', 'can-unlock-private-key', 'can-export-encrypted-identity', 'can-import-encrypted-identity', 'can-detect-ciphertext-tamper']) body.capabilities.add(capability);
}
EstateHost.prototype.createProjectCompiler = function createProjectCompilerE9(options = {}) { return new JMProjectCompilerV9(this, options); };
const jmE8EstateManifest = EstateHost.prototype.manifest;
EstateHost.prototype.manifest = function estateManifestE9() {
  const manifest = jmE8EstateManifest.call(this);
  return { ...manifest, version: VERSION, build: BUILD_ID, elevation: {
    level: 'JM-E9', equalisedBodies: this.bodies.size,
    encryption: 'PBKDF2-HMAC-SHA256 passphrase derivation with 210,000 iterations and AES-256-GCM authenticated encryption',
    privateKey: 'encrypted at rest; explicit lock removes the active private author from runtime memory; unlock restores it only in memory',
    backup: 'portable encrypted identity envelope with wrong-passphrase and ciphertext-tamper HOLDs',
    migration: 'JM-E8 plaintext identity can be protected non-destructively, then removed from plaintext storage after encrypted write verification',
    inherited: ['indexeddb-first-identity-storage', 'quota-fallback', 'public-key-authorship', 'trusted-author-policy', 'signed-key-rotation', 'key-revocation', 'immutable-publication', 'locked-reproducible-install', 'module-linking', 'live-continuation', 'checkpoint-rewind', 'hot-patch', 'proof-ledger', 'semantic-analysis', 'optimisation', 'debugging', 'contracts', 'normalised-ir', 'persistence', 'trace-replay'],
  } };
};


// -----------------------------------------------------------------------------
// JM-E10 — 27-body Merkle release capsule and multi-witness quorum seal
// -----------------------------------------------------------------------------

function jmMerkleRoot(values = []) {
  let layer = [...values].map((value) => jmSha256(typeof value === 'string' ? value : stableStringify(value))).sort();
  if (!layer.length) return jmSha256('');
  while (layer.length > 1) {
    const next = [];
    for (let index = 0; index < layer.length; index += 2) {
      const left = layer[index];
      const right = layer[index + 1] ?? left;
      next.push(jmSha256(`${left}:${right}`));
    }
    layer = next;
  }
  return layer[0];
}

function jmReleaseArtifactLeaves(publication) {
  const leaves = [];
  for (const [id, artifact] of Object.entries(publication?.artifacts ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
    leaves.push({
      id,
      package: artifact.package,
      version: artifact.version,
      body: artifact.body,
      namespace: artifact.namespace,
      artifactDigest: artifact.artifactDigest,
      authorFingerprint: artifact.provenance?.fingerprint ?? null,
    });
  }
  return leaves;
}

function jmReleasePayload(capsuleCore) {
  return {
    schema: 'jm-release-seal-payload/10',
    build: capsuleCore.build,
    version: capsuleCore.version,
    level: capsuleCore.level,
    capsuleDigest: capsuleCore.capsuleDigest,
    merkleRoot: capsuleCore.merkleRoot,
    sequence: capsuleCore.sequence,
    nonce: capsuleCore.nonce,
    parentDigest: capsuleCore.parent?.anchorDigest ?? null,
    authorFingerprint: capsuleCore.author?.fingerprint ?? null,
    witnessSetDigest: capsuleCore.witnessPolicy?.digest ?? null,
  };
}

class JMWitnessQuorum {
  constructor({ authors = [], threshold = 2, id = 'jm-witness-quorum' } = {}) {
    invariant(Array.isArray(authors), 'Witness authors must be an array');
    invariant(Number.isInteger(threshold) && threshold >= 1, 'Witness threshold must be a positive integer');
    invariant(authors.length === 0 || threshold <= authors.length, 'Witness threshold exceeds witness count');
    this.id = id;
    this.authors = [...authors];
    this.threshold = threshold;
  }
  static async generate({ count = 3, threshold = 2, ownerPrefix = 'JM Witness' } = {}) {
    invariant(Number.isInteger(count) && count >= 1, 'Witness count must be positive');
    invariant(Number.isInteger(threshold) && threshold >= 1 && threshold <= count, 'Invalid witness quorum threshold');
    const authors = [];
    for (let index = 0; index < count; index += 1) authors.push(await JMWebCryptoAuthor.generate({ owner: `${ownerPrefix} ${index + 1}` }));
    return new JMWitnessQuorum({ authors, threshold, id: `jm-witness-${threshold}-of-${count}` });
  }
  descriptor() {
    const witnesses = this.authors.map((author) => ({
      owner: author.owner,
      keyId: author.keyId,
      fingerprint: author.fingerprint,
      publicKeyJwk: deepClone(author.publicKeyJwk),
    })).sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
    const core = { schema: 'jm-witness-policy/10', id: this.id, threshold: this.threshold, count: witnesses.length, distinctRequired: true, witnesses };
    return { ...core, digest: jmSha256(stableStringify(core)) };
  }
  async attest(payload) {
    invariant(this.authors.length >= this.threshold, 'Witness quorum is not populated');
    const attestations = [];
    for (const author of this.authors) attestations.push(await author.sign(payload, 'release-witness'));
    return attestations;
  }
  static async verify(payload, attestations, policy) {
    try {
      invariant(policy?.schema === 'jm-witness-policy/10', 'Invalid witness policy schema');
      const { digest, ...policyCore } = deepClone(policy);
      invariant(jmSha256(stableStringify(policyCore)) === digest, 'Witness policy digest mismatch');
      invariant(Number.isInteger(policy.threshold) && policy.threshold >= 1, 'Invalid witness threshold');
      invariant(policy.threshold <= policy.witnesses.length, 'Witness threshold exceeds witness set');
      const trusted = new Map(policy.witnesses.map((witness) => [witness.fingerprint, witness]));
      const distinct = new Set();
      const outcomes = [];
      for (const provenance of attestations ?? []) {
        const witness = trusted.get(provenance?.fingerprint);
        if (!witness || distinct.has(provenance.fingerprint)) {
          outcomes.push({ status: 'HOLD', fingerprint: provenance?.fingerprint ?? null, error: witness ? 'Duplicate witness fingerprint' : 'Witness is outside the sealed policy' });
          continue;
        }
        distinct.add(provenance.fingerprint);
        const store = new JMTrustStore();
        await store.trust(witness.publicKeyJwk, { keyId: witness.keyId, owner: witness.owner, scopes: ['witness:*'], reason: 'sealed-witness-policy' });
        outcomes.push(await store.verify(payload, provenance, { purpose: 'release-witness' }));
      }
      const passed = outcomes.filter((outcome) => outcome.status === 'PASS').length;
      invariant(passed >= policy.threshold, `Witness quorum HOLD: ${passed}/${policy.threshold}`);
      return { status: 'PASS', passed, threshold: policy.threshold, total: policy.witnesses.length, distinct: distinct.size, outcomes, policyDigest: policy.digest };
    } catch (error) {
      return { status: 'HOLD', error: error.message, passed: 0, threshold: policy?.threshold ?? null, total: policy?.witnesses?.length ?? 0 };
    }
  }
}

class JMProjectCompilerV10 extends JMProjectCompilerV9 {
  constructor(host, options = {}) {
    super(host, options);
    this.witnessQuorum = options.witnessQuorum ?? null;
    this.lastReleaseCapsule = null;
    this.lastReleaseVerification = null;
    this.releaseSequence = Number(options.releaseSequence ?? 0);
    this.acceptedReleaseSequences = new Map();
    this.parentAnchor = deepClone(options.parentAnchor ?? null);
  }
  build(project) {
    const base = super.build(project);
    if (base.status !== 'PASS') return base;
    const result = { ...base, level: 'JM-E10', version: VERSION, merkleReleaseReady: true, witnessQuorumReady: true, releaseCapsuleReady: true };
    result.digest = jmDigest({ schema: result.schema, id: result.id, version: result.version, level: result.level, modules: result.modules, graph: result.graph, order: result.order, packageRegistry: result.packageRegistry, namespaceIndex: result.namespaceIndex });
    this.lastProject = { project: this.lastProject.project, result: deepClone(result) };
    return result;
  }
  async publicRelease(project, options = {}) {
    const linked = this.build(project);
    if (linked.status !== 'PASS') return { status: 'HOLD', stage: 'link', linked, level: 'JM-E10' };
    const publication = await this.publishPublic(options);
    const verification = await this.verifyAuthorship(publication);
    return { status: verification.status, level: 'JM-E10', linked, publication, verification, identityStorage: deepClone(this.lastIdentityStorage), identityLocked: this.identityLocked };
  }
  async createWitnessSet({ count = 3, threshold = 2, ownerPrefix = 'JM Witness' } = {}) {
    this.witnessQuorum = await JMWitnessQuorum.generate({ count, threshold, ownerPrefix });
    const policy = this.witnessQuorum.descriptor();
    this.ledger.append('witness-set-created', { policyDigest: policy.digest, threshold: policy.threshold, count: policy.count });
    return { status: 'PASS', policy, ledger: this.ledger.snapshot() };
  }
  async sealRelease({ parentAnchor = this.parentAnchor, owner = 'JM TheOlogist' } = {}) {
    invariant(this.lastProject?.result?.status === 'PASS', 'Build a PASS 27-body project before sealing');
    invariant(this.witnessQuorum, 'Create a witness set before sealing');
    invariant(await this.secureIdentityVault.hasProtected('active'), 'Protect the private identity before sealing');
    invariant(this.publicAuthor && !this.identityLocked, 'Unlock the protected author identity before sealing');
    const publication = await this.publishPublic({ owner });
    const authorVerification = await this.verifyAuthorship(publication);
    invariant(authorVerification.status === 'PASS', 'Public authorship verification HOLD before release seal');
    const cleanPublication = deepClone(publication);
    delete cleanPublication.ledger;
    const artifactLeaves = jmReleaseArtifactLeaves(cleanPublication);
    invariant(artifactLeaves.length === 27, `Release capsule requires 27 artifacts, received ${artifactLeaves.length}`);
    const witnessPolicy = this.witnessQuorum.descriptor();
    const sequence = ++this.releaseSequence;
    const nonce = jmBase64Url(jmRandomBytes(18));
    const core = {
      schema: 'jm-release-capsule/10',
      build: BUILD_ID,
      version: VERSION,
      level: 'JM-E10',
      sequence,
      nonce,
      issuedAt: new Date().toISOString(),
      parent: deepClone(parentAnchor),
      bodyCount: artifactLeaves.length,
      projectDigest: this.lastProject.result.digest,
      publication: cleanPublication,
      artifactLeaves,
      merkleRoot: jmMerkleRoot(artifactLeaves),
      author: { owner: this.publicAuthor.owner, keyId: this.publicAuthor.keyId, fingerprint: this.publicAuthor.fingerprint, publicKeyJwk: deepClone(this.publicAuthor.publicKeyJwk) },
      witnessPolicy,
      timeBoundary: 'local-device-observed-time-not-external-trusted-time',
    };
    const capsuleDigest = jmSha256(stableStringify(core));
    const withDigest = { ...core, capsuleDigest };
    const payload = jmReleasePayload(withDigest);
    const authorSeal = await this.publicAuthor.sign(payload, 'estate-release-seal');
    const witnessAttestations = await this.witnessQuorum.attest(payload);
    const capsule = { ...withDigest, authorSeal, witnessAttestations };
    capsule.sealDigest = jmSha256(stableStringify(capsule));
    const verification = await this.verifyReleaseCapsule(capsule, { record: false });
    invariant(verification.status === 'PASS', verification.error || 'Release capsule verification HOLD');
    this.lastReleaseCapsule = deepClone(capsule);
    this.lastReleaseVerification = deepClone(verification);
    this.ledger.append('release-capsule-sealed', { capsuleDigest, sealDigest: capsule.sealDigest, merkleRoot: capsule.merkleRoot, sequence, witnessPassed: verification.witnesses.passed, witnessThreshold: verification.witnesses.threshold });
    return { status: 'PASS', level: 'JM-E10', capsule: deepClone(capsule), verification, ledger: this.ledger.snapshot() };
  }
  async verifyReleaseCapsule(capsule = this.lastReleaseCapsule, { record = false, expectedAuthorFingerprint = this.publicAuthor?.fingerprint ?? null, expectedParentDigest = this.parentAnchor?.anchorDigest ?? null } = {}) {
    try {
      invariant(capsule?.schema === 'jm-release-capsule/10', 'Invalid release capsule schema');
      const { authorSeal, witnessAttestations, sealDigest, capsuleDigest, ...core } = deepClone(capsule);
      invariant(jmSha256(stableStringify(core)) === capsuleDigest, 'Release capsule digest mismatch');
      invariant(jmSha256(stableStringify({ ...core, capsuleDigest, authorSeal, witnessAttestations })) === sealDigest, 'Release seal digest mismatch');
      invariant(capsule.build === BUILD_ID && capsule.version === VERSION && capsule.level === 'JM-E10', 'Release capsule build identity mismatch');
      invariant(capsule.bodyCount === 27 && capsule.artifactLeaves.length === 27, 'Release capsule body count mismatch');
      invariant(jmMerkleRoot(capsule.artifactLeaves) === capsule.merkleRoot, 'Release Merkle root mismatch');
      invariant(jmReleaseArtifactLeaves(capsule.publication).length === 27, 'Release publication artifact count mismatch');
      invariant(stableStringify(jmReleaseArtifactLeaves(capsule.publication)) === stableStringify(capsule.artifactLeaves), 'Release artifact leaves mismatch');
      if (expectedAuthorFingerprint) invariant(capsule.author.fingerprint === expectedAuthorFingerprint, 'Pinned author fingerprint mismatch');
      if (expectedParentDigest) invariant(capsule.parent?.anchorDigest === expectedParentDigest, 'Pinned parent anchor mismatch');
      const trust = new JMTrustStore();
      await trust.trust(capsule.author.publicKeyJwk, { keyId: capsule.author.keyId, owner: capsule.author.owner, scopes: ['release:*'], reason: 'pinned-release-author' });
      const payload = jmReleasePayload(capsule);
      const author = await trust.verify(payload, authorSeal, { purpose: 'estate-release-seal' });
      invariant(author.status === 'PASS', author.error || 'Release author seal HOLD');
      const witnesses = await JMWitnessQuorum.verify(payload, witnessAttestations, capsule.witnessPolicy);
      invariant(witnesses.status === 'PASS', witnesses.error || 'Release witness quorum HOLD');
      await this.trustStore.trust(capsule.author.publicKeyJwk, { keyId: capsule.author.keyId, owner: capsule.author.owner, scopes: ['package:*', 'release:*'], reason: expectedAuthorFingerprint ? 'pinned-release-import' : 'active-release-author' });
      const publication = await this.publicRegistry.verifyRelease(capsule.publication);
      invariant(publication.status === 'PASS' && publication.passed === 27, 'Release publication verification HOLD');
      if (record) {
        const prior = this.acceptedReleaseSequences.get(capsule.author.fingerprint) ?? 0;
        invariant(capsule.sequence > prior, `Release replay HOLD: sequence ${capsule.sequence} <= ${prior}`);
        this.acceptedReleaseSequences.set(capsule.author.fingerprint, capsule.sequence);
      }
      const result = { status: 'PASS', level: 'JM-E10', capsuleDigest, sealDigest, merkleRoot: capsule.merkleRoot, sequence: capsule.sequence, author, witnesses, publication, parentDigest: capsule.parent?.anchorDigest ?? null, replayRecorded: record };
      this.lastReleaseVerification = deepClone(result);
      if (record) this.ledger.append('release-capsule-accepted', { capsuleDigest, sequence: capsule.sequence, authorFingerprint: capsule.author.fingerprint, merkleRoot: capsule.merkleRoot });
      return result;
    } catch (error) {
      const result = { status: 'HOLD', level: 'JM-E10', error: error.message, capsuleDigest: capsule?.capsuleDigest ?? null, sequence: capsule?.sequence ?? null };
      this.lastReleaseVerification = deepClone(result);
      if (record) this.ledger.append('release-capsule-hold', result);
      return result;
    }
  }
  exportReleaseCapsule(capsule = this.lastReleaseCapsule) {
    invariant(capsule, 'Seal a release capsule before export');
    return { schema: 'jm-release-capsule-export/10', build: BUILD_ID, version: VERSION, level: 'JM-E10', exportedAt: new Date().toISOString(), capsule: deepClone(capsule), digest: jmSha256(stableStringify(capsule)) };
  }
  async importReleaseCapsule(payload, options = {}) {
    invariant(payload?.schema === 'jm-release-capsule-export/10', 'Invalid release capsule export schema');
    invariant(jmSha256(stableStringify(payload.capsule)) === payload.digest, 'Imported release capsule export digest mismatch');
    const result = await this.verifyReleaseCapsule(payload.capsule, { ...options, record: true });
    if (result.status === 'PASS') this.lastReleaseCapsule = deepClone(payload.capsule);
    return { ...result, imported: result.status === 'PASS', ledger: this.ledger.snapshot() };
  }
}

const jmE9Compile = CodingBody.prototype.compile;
const jmE9ManifestBody = CodingBody.prototype.manifest;
CodingBody.prototype.compile = function compileE10(sourceOrAst) {
  const ir = jmE9Compile.call(this, sourceOrAst);
  return { ...ir, version: '10.0-jm', merkleReleaseReady: true, witnessQuorumReady: true, releaseCapsuleReady: true, replayGuardReady: true };
};
CodingBody.prototype.manifest = function manifestE10() {
  const previous = jmE9ManifestBody.call(this);
  return { ...previous, version: '10.0-jm', sourceState: 'implemented-v1.0', elevation: { level: 'JM-E10', equalised: true, guarantees: [
    '27-body-merkle-release-root', 'multi-witness-threshold-quorum', 'author-sealed-release-capsule', 'distinct-witness-enforcement', 'release-sequence-replay-guard', 'parent-anchor-pinning', 'portable-release-capsule',
    ...previous.elevation.guarantees,
  ] } };
};
for (const body of BODY_DEFINITIONS) {
  body.version = '10.0-jm';
  for (const capability of ['can-merkle-release', 'can-create-witness-quorum', 'can-seal-release-capsule', 'can-verify-release-quorum', 'can-reject-release-replay', 'can-export-release-capsule', 'can-import-release-capsule']) body.capabilities.add(capability);
}
EstateHost.prototype.createProjectCompiler = function createProjectCompilerE10(options = {}) { return new JMProjectCompilerV10(this, options); };
const jmE9EstateManifest = EstateHost.prototype.manifest;
EstateHost.prototype.manifest = function estateManifestE10() {
  const manifest = jmE9EstateManifest.call(this);
  return { ...manifest, version: VERSION, build: BUILD_ID, elevation: {
    level: 'JM-E10', equalisedBodies: this.bodies.size,
    release: '27-body Merkle-rooted release capsule signed by the active encrypted author identity',
    witness: 'configurable distinct ECDSA P-256 threshold quorum; default 2-of-3',
    replay: 'author-fingerprint sequence acceptance guard with nonce-bound signatures',
    timeBoundary: 'records local observed time but does not claim an external trusted timestamp',
    inherited: ['encrypted-private-identity', 'explicit-key-lock', 'encrypted-backup', 'indexeddb-first-storage', 'public-key-authorship', 'trusted-author-policy', 'signed-key-rotation', 'key-revocation', 'immutable-publication', 'locked-reproducible-install', 'module-linking', 'live-continuation', 'checkpoint-rewind', 'hot-patch', 'proof-ledger', 'semantic-analysis', 'optimisation', 'debugging', 'contracts', 'normalised-ir', 'persistence', 'trace-replay'],
  } };
};

function runExample(bodyId, host = new EstateHost()) {
  const example = EXAMPLES[bodyId];
  invariant(example, `No example for ${bodyId}`);
  const body = host.getBody(bodyId);
  const ir = body.compile(example.source);
  const runtime = body.createRuntime(ir, host);
  host.mountRuntime(body.id, runtime);
  const input = deepClone(example.input);
  const value = runtime.run(input);
  return {
    body: body.manifest(),
    source: example.source,
    input: deepClone(input),
    ir,
    value: deepClone(value),
    receipt: runtime.receipt?.(),
  };
}

function createEstate() {
  return new EstateHost();
}

const API = {
  VERSION,
  BUILD_ID,
  JMError,
  tokenize,
  TokenStream,
  parseExpression,
  evaluateExpression,
  TraceBox,
  DeterministicClock,
  CodingBody,
  BodyMembrane,
  EstateHost,
  FusionRegistry,
  GenerativeLaws,
  FormulaBornHost,
  StackVM,
  JMStaticAnalyzer,
  JMIRNormalizer,
  TraceReplay,
  MemoryStorageAdapter,
  BrowserStorageAdapter,
  ProjectVault,
  EstatePipeline,
  JMSemanticAnalyzer,
  JMOptimizer,
  JMContractRegistry,
  JMDebugSession,
  JMContractPipeline,
  JMProofLedger,
  JMContinuationCompiler,
  JMLiveContinuation,
  JMProjectCompiler,
  JMProjectCompilerV5,
  JMProjectCompilerV6,
  JMProjectCompilerV7,
  JMProjectCompilerV8,
  JMProjectCompilerV9,
  JMProjectCompilerV10,
  JMWitnessQuorum,
  jmMerkleRoot,
  jmReleaseArtifactLeaves,
  JMEncryptedIdentityVault,
  jmRandomBytes,
  jmPassphrasePolicy,
  jmDerivePassphraseKey,
  jmEncryptJson,
  jmDecryptJson,
  JMWebCryptoAuthor,
  JMTrustStore,
  JMIdentityVault,
  JMQuotaAwareIdentityVault,
  JMIndexedDBStore,
  JMAsyncMemoryStore,
  JMPublicKeyPublicationRegistry,
  JMPackageRegistry,
  JMPublicationRegistry,
  JMPackageInstaller,
  JMProvenanceSigner,
  jmParseVersion,
  jmCompareVersions,
  jmSatisfiesVersion,
  jmSha256,
  jmHmacSha256,
  jmPublicKeyFingerprint,
  jmBase64Url,
  jmFromBase64Url,
  jmParseModuleDirectives,
  jmCreateModuleDescriptor,
  jmExtractDependencies,
  jmTypeOfValue,
  jmTypeCompatible,
  annotateJMPaths,
  stableStringify,
  jmDigest,
  BODY_DEFINITIONS,
  EXAMPLES,
  createEstate,
  runExample,
};

if (typeof globalThis !== 'undefined') globalThis.JMCodingEstate = API;

export {
  VERSION,
  BUILD_ID,
  JMError,
  tokenize,
  TokenStream,
  parseExpression,
  evaluateExpression,
  TraceBox,
  DeterministicClock,
  CodingBody,
  BodyMembrane,
  EstateHost,
  FusionRegistry,
  GenerativeLaws,
  FormulaBornHost,
  StackVM,
  JMStaticAnalyzer,
  JMIRNormalizer,
  TraceReplay,
  MemoryStorageAdapter,
  BrowserStorageAdapter,
  ProjectVault,
  EstatePipeline,
  JMSemanticAnalyzer,
  JMOptimizer,
  JMContractRegistry,
  JMDebugSession,
  JMContractPipeline,
  JMProofLedger,
  JMContinuationCompiler,
  JMLiveContinuation,
  JMProjectCompiler,
  JMProjectCompilerV5,
  JMProjectCompilerV6,
  JMProjectCompilerV7,
  JMProjectCompilerV8,
  JMProjectCompilerV9,
  JMProjectCompilerV10,
  JMWitnessQuorum,
  jmMerkleRoot,
  jmReleaseArtifactLeaves,
  JMEncryptedIdentityVault,
  jmRandomBytes,
  jmPassphrasePolicy,
  jmDerivePassphraseKey,
  jmEncryptJson,
  jmDecryptJson,
  JMWebCryptoAuthor,
  JMTrustStore,
  JMIdentityVault,
  JMQuotaAwareIdentityVault,
  JMIndexedDBStore,
  JMAsyncMemoryStore,
  JMPublicKeyPublicationRegistry,
  JMPackageRegistry,
  JMPublicationRegistry,
  JMPackageInstaller,
  JMProvenanceSigner,
  jmParseVersion,
  jmCompareVersions,
  jmSatisfiesVersion,
  jmSha256,
  jmHmacSha256,
  jmPublicKeyFingerprint,
  jmBase64Url,
  jmFromBase64Url,
  jmParseModuleDirectives,
  jmCreateModuleDescriptor,
  jmExtractDependencies,
  jmTypeOfValue,
  jmTypeCompatible,
  annotateJMPaths,
  stableStringify,
  jmDigest,
  BODY_DEFINITIONS,
  EXAMPLES,
  createEstate,
  runExample,
};