export class NativeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NativeError';
    this.code = code;
    this.details = details;
  }
}

export function need(condition, code, message, details = {}) {
  if (!condition) throw new NativeError(code, message, details);
}

export function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digest(value) {
  const text = typeof value === 'string' ? value : stable(value);
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= BigInt(text.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

export function valueOf(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1);
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try { return JSON.parse(text.replace(/'/g, '"')); } catch {}
  }
  return text;
}

export function splitTop(text, delimiter = ',') {
  const parts = [];
  let depth = 0;
  let quote = '';
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth -= 1;
    else if (char === delimiter && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}

export function argsOf(raw = '') {
  const named = {};
  const positional = [];
  for (const part of splitTop(raw)) {
    const equals = part.indexOf('=');
    if (equals > 0) named[part.slice(0, equals).trim()] = valueOf(part.slice(equals + 1));
    else positional.push(valueOf(part));
  }
  return { named, positional };
}

export function getPath(object, path) {
  return String(path).split('.').filter(Boolean).reduce((value, key) => value == null ? undefined : value[key], object);
}

export function setPath(object, path, value) {
  const keys = String(path).split('.').filter(Boolean);
  need(keys.length > 0, 'EMPTY_PATH', 'A native state path cannot be empty.');
  let cursor = object;
  for (const key of keys.slice(0, -1)) {
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys.at(-1)] = value;
  return object;
}

export function blocks(source, keyword) {
  const output = [];
  const pattern = new RegExp(`\\b${keyword}\\s+([A-Za-z_][\\w.-]*)\\s*\\{`, 'g');
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
    need(depth === 0, 'UNCLOSED_BLOCK', `Unclosed ${keyword} block ${match[1]}.`);
    output.push({ name: match[1], body: source.slice(open + 1, index - 1), start: match.index, end: index });
    pattern.lastIndex = index;
  }
  return output;
}

function comparisonRight(raw) {
  const text = String(raw).trim();
  const isPath = /^[A-Za-z_][\w.]*$/.test(text) && !['true', 'false', 'null'].includes(text);
  return isPath ? { kind: 'path', value: text } : { kind: 'literal', value: valueOf(text) };
}

export function parseExpr(source) {
  const text = String(source).trim().replace(/^\((.*)\)$/s, '$1').trim();
  need(text, 'EMPTY_EXPRESSION', 'Native expression cannot be empty.');
  for (const operator of ['or', 'and']) {
    const marker = ` ${operator} `;
    const index = text.indexOf(marker);
    if (index > -1) return { type: operator, left: parseExpr(text.slice(0, index)), right: parseExpr(text.slice(index + marker.length)) };
  }
  if (text.startsWith('not ')) return { type: 'not', value: parseExpr(text.slice(4)) };
  const comparison = text.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/s);
  if (comparison) return { type: 'compare', path: comparison[1].trim(), op: comparison[2], right: comparisonRight(comparison[3]) };
  const call = text.match(/^([A-Za-z_][\w.]*)\((.*)\)$/s);
  if (call) return { type: 'call', name: call[1], args: argsOf(call[2]).positional };
  return { type: 'truthy', path: text };
}

export function evaluate(expression, facts = {}, functions = {}) {
  switch (expression.type) {
    case 'or': return Boolean(evaluate(expression.left, facts, functions) || evaluate(expression.right, facts, functions));
    case 'and': return Boolean(evaluate(expression.left, facts, functions) && evaluate(expression.right, facts, functions));
    case 'not': return !evaluate(expression.value, facts, functions);
    case 'truthy': return Boolean(getPath(facts, expression.path));
    case 'call': return functions[expression.name] ? Boolean(functions[expression.name](...expression.args)) : getPath(facts, expression.name) === expression.args[0];
    case 'compare': {
      const left = getPath(facts, expression.path);
      const right = expression.right?.kind === 'path' ? getPath(facts, expression.right.value) : expression.right?.value;
      return ({ '==': left === right, '!=': left !== right, '>': left > right, '<': left < right, '>=': left >= right, '<=': left <= right })[expression.op];
    }
    default: throw new NativeError('UNKNOWN_EXPRESSION', `Unknown native expression ${expression.type}.`);
  }
}

export class Trace {
  constructor(body) {
    this.body = body;
    this.events = [];
  }
  emit(type, payload = {}) {
    const event = { index: this.events.length, body: this.body, type, payload };
    event.digest = digest(event);
    this.events.push(event);
    return event;
  }
  receipt(claim, result) {
    return { schema: 'jm.native.receipt/1.0', body: this.body, claim, eventCount: this.events.length, traceDigest: digest(this.events), resultDigest: digest(result) };
  }
}

export function parseAction(line) {
  const text = line.trim().replace(/;$/, '');
  if (['permit', 'deny', 'end', 'fail'].includes(text)) return { type: text };
  for (const kind of ['show', 'say']) {
    const match = text.match(new RegExp(`^${kind}\\s+(.+)$`, 's'));
    if (match) return { type: kind, value: valueOf(match[1]) };
  }
  for (const kind of ['emit', 'route', 'recover', 'goto']) {
    const match = text.match(new RegExp(`^${kind}\\s+([A-Za-z_][\\w.-]*)$`));
    if (match) return { type: kind, value: match[1] };
  }
  const assignment = text.match(/^([A-Za-z_][\w.]*)\s*=\s*(.+)$/s);
  if (assignment) return { type: 'assign', path: assignment[1], value: valueOf(assignment[2]) };
  const call = text.match(/^(?:call\s+)?([A-Za-z_][\w.]*)\((.*)\)$/s);
  if (call) return { type: 'call', name: call[1], ...argsOf(call[2]) };
  throw new NativeError('INVALID_ACTION', `Cannot parse native action: ${line}`);
}

export function applyAction(action, state, services = {}, trace = null) {
  trace?.emit('action.begin', action);
  let result;
  if (action.type === 'assign') result = setPath(state, action.path, action.value);
  else if (action.type === 'permit' || action.type === 'deny') result = state.permission = action.type;
  else if (action.type === 'show') result = (state.messages ??= []).push(action.value);
  else if (action.type === 'say') result = (state.responses ??= []).push(action.value);
  else if (action.type === 'emit') result = (state.events ??= []).push(action.value);
  else if (action.type === 'route') result = state.nextRoute = action.value;
  else if (action.type === 'recover') result = state.recovery = action.value;
  else if (action.type === 'goto') result = state.nextStep = action.value;
  else if (action.type === 'end') result = state.ended = true;
  else if (action.type === 'fail') throw new NativeError('EXPLICIT_FAILURE', 'Native action requested failure.');
  else if (action.type === 'call') {
    need(typeof services[action.name] === 'function', 'UNKNOWN_SERVICE', `Unknown native service ${action.name}.`);
    result = services[action.name](...action.positional, action.named, state);
  } else throw new NativeError('UNKNOWN_ACTION', `Unknown native action ${action.type}.`);
  trace?.emit('action.end', { action, result });
  return result;
}
