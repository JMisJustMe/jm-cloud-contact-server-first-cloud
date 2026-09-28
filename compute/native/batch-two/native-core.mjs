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
  need(keys.length > 0, 'EMPTY_PATH', 'Native path cannot be empty.');
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
  const path = text.match(/^\$([A-Za-z_][\w.]*)$/);
  return path ? { kind: 'path', value: path[1] } : { kind: 'literal', value: valueOf(text) };
}

function findLogical(text, operator) {
  let depth = 0;
  let quote = '';
  const marker = ` ${operator} `;
  for (let index = 0; index <= text.length - marker.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (char === '\\') index += 1;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth -= 1;
    else if (depth === 0 && text.slice(index, index + marker.length) === marker) return index;
  }
  return -1;
}

export function parseExpr(source) {
  let text = String(source).trim();
  need(text, 'EMPTY_EXPRESSION', 'Native expression cannot be empty.');
  if (text.startsWith('(') && text.endsWith(')')) text = text.slice(1, -1).trim();
  for (const operator of ['or', 'and']) {
    const index = findLogical(text, operator);
    if (index > -1) return { type: operator, left: parseExpr(text.slice(0, index)), right: parseExpr(text.slice(index + operator.length + 2)) };
  }
  if (text.startsWith('not ')) return { type: 'not', value: parseExpr(text.slice(4)) };
  const comparison = text.match(/^(.+?)\s*(==|!=|>=|<=|>|<|in)\s*(.+)$/s);
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
    case 'call': return typeof functions[expression.name] === 'function' ? Boolean(functions[expression.name](...expression.args)) : false;
    case 'compare': {
      const left = getPath(facts, expression.path);
      const right = expression.right.kind === 'path' ? getPath(facts, expression.right.value) : expression.right.value;
      if (expression.op === 'in') return Array.isArray(right) && right.includes(left);
      return ({ '==': left === right, '!=': left !== right, '>': left > right, '<': left < right, '>=': left >= right, '<=': left <= right })[expression.op];
    }
    default: throw new NativeError('UNKNOWN_EXPRESSION', `Unknown expression ${expression.type}.`);
  }
}

export function parseAction(line) {
  const text = String(line).trim().replace(/;$/, '');
  if (['halt', 'rollback', 'commit', 'yield'].includes(text)) return { type: text };
  const assignment = text.match(/^(?:set\s+)?([A-Za-z_][\w.]*)\s*=\s*(.+)$/s);
  if (assignment) return { type: 'assign', path: assignment[1], value: valueOf(assignment[2]) };
  const emit = text.match(/^emit\s+([A-Za-z_][\w.-]*)(?:\((.*)\))?$/s);
  if (emit) return { type: 'emit', name: emit[1], args: argsOf(emit[2] ?? '') };
  const call = text.match(/^(?:call\s+)?([A-Za-z_][\w.]*)\((.*)\)$/s);
  if (call) return { type: 'call', name: call[1], ...argsOf(call[2]) };
  throw new NativeError('INVALID_ACTION', `Cannot parse native action: ${line}`);
}

export function applyAction(action, state, services = {}, trace = null) {
  trace?.emit('action.begin', action);
  let result;
  if (action.type === 'assign') result = setPath(state, action.path, action.value);
  else if (action.type === 'emit') result = (state.events ??= []).push({ name: action.name, ...action.args });
  else if (action.type === 'rollback') result = state.transaction = 'rollback';
  else if (action.type === 'commit') result = state.transaction = 'commit';
  else if (action.type === 'yield') result = state.yielded = true;
  else if (action.type === 'halt') result = state.halted = true;
  else if (action.type === 'call') {
    need(typeof services[action.name] === 'function', 'UNKNOWN_SERVICE', `Unknown service ${action.name}.`);
    result = services[action.name](...action.positional, action.named, state);
  } else throw new NativeError('UNKNOWN_ACTION', `Unknown action ${action.type}.`);
  trace?.emit('action.end', { action, result });
  return result;
}

export class Trace {
  constructor(body) { this.body = body; this.events = []; }
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

export function lines(body) {
  return String(body).split(/\r?\n/).map(line => line.trim()).filter(Boolean).filter(line => !line.startsWith('#') && !line.startsWith('//'));
}
