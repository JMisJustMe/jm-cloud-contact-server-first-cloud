/*
 * JM EveryBody Compiler Core v0.2
 *
 * This is the shared, lossless portable layer beneath sovereign body front ends.
 * It does not pretend that one portable grammar is the native grammar of every
 * JM body. Native parsers lower into this IR; unrecovered native parsers remain
 * visibly marked rather than invented.
 */

export const PORTABLE_SCHEMA = 'jm.everybody.portable-ir/0.2';
export const RECEIPT_SCHEMA = 'jm.everybody.execution-receipt/0.2';

export const PORTABLE_OPS = Object.freeze([
  'SET', 'ADD', 'SUB', 'MUL', 'DIV', 'COPY', 'CONCAT',
  'ROUTE', 'TRACE', 'ASSERT', 'DING'
]);

const NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const BODY_ID = /^[a-z0-9][a-z0-9.-]*$/;

function splitHead(text) {
  const match = String(text).trim().match(/^(\S+)(?:\s+([\s\S]*))?$/);
  return match ? [match[1], match[2] ?? ''] : ['', ''];
}

function parseValue(text, line) {
  const trimmed = String(text).trim();
  if (!trimmed) throw new SyntaxError(`Line ${line}: value required.`);
  try {
    return JSON.parse(trimmed);
  } catch {
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(trimmed)) return Number(trimmed);
    return trimmed;
  }
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableObject(value[key])]));
  }
  return value;
}

export function stableStringify(value) {
  return JSON.stringify(stableObject(value));
}

export function fnv1a(value) {
  let hash = 0x811c9dc5;
  const text = typeof value === 'string' ? value : stableStringify(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function lexPortable(source) {
  const tokens = [];
  const diagnostics = [];
  const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const raw = lines[index];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    const [head, rest] = splitHead(trimmed);
    tokens.push({ line: lineNumber, column: raw.indexOf(head) + 1, head: head.toUpperCase(), rest, raw });
  }

  if (tokens.length === 0) diagnostics.push({ level: 'error', code: 'EMPTY_SOURCE', message: 'Portable source is empty.' });
  return { tokens, diagnostics };
}

function parseNamedValue(rest, line) {
  const [name, valueText] = splitHead(rest);
  if (!NAME.test(name)) throw new SyntaxError(`Line ${line}: invalid state name ${JSON.stringify(name)}.`);
  return { name, value: parseValue(valueText, line) };
}

export function parsePortable(source) {
  const lexed = lexPortable(source);
  const diagnostics = [...lexed.diagnostics];
  const ast = {
    schema: 'jm.everybody.portable-ast/0.2',
    body: null,
    version: '0.1',
    statements: [],
    source: String(source ?? '')
  };

  let ended = false;
  for (const token of lexed.tokens) {
    if (ended) {
      diagnostics.push({ level: 'error', code: 'AFTER_END', line: token.line, message: 'No statements are allowed after END.' });
      continue;
    }
    try {
      switch (token.head) {
        case 'BODY': {
          const id = token.rest.trim();
          if (ast.body) throw new SyntaxError(`Line ${token.line}: BODY already declared.`);
          if (!BODY_ID.test(id)) throw new SyntaxError(`Line ${token.line}: invalid body id ${JSON.stringify(id)}.`);
          ast.body = id;
          break;
        }
        case 'VERSION':
          ast.version = token.rest.trim() || '0.1';
          break;
        case 'SET':
        case 'ADD':
        case 'SUB':
        case 'MUL':
        case 'DIV':
        case 'CONCAT':
        case 'ASSERT': {
          const named = parseNamedValue(token.rest, token.line);
          ast.statements.push({ op: token.head, ...named, line: token.line });
          break;
        }
        case 'COPY': {
          const [target, sourceName] = token.rest.trim().split(/\s+/);
          if (!NAME.test(target) || !NAME.test(sourceName)) throw new SyntaxError(`Line ${token.line}: COPY requires target and source names.`);
          ast.statements.push({ op: 'COPY', name: target, sourceName, line: token.line });
          break;
        }
        case 'ROUTE': {
          const route = token.rest.trim();
          if (!route) throw new SyntaxError(`Line ${token.line}: ROUTE requires a route name.`);
          ast.statements.push({ op: 'ROUTE', route, line: token.line });
          break;
        }
        case 'TRACE':
          ast.statements.push({ op: 'TRACE', value: parseValue(token.rest, token.line), line: token.line });
          break;
        case 'DING':
          ast.statements.push({ op: 'DING', value: parseValue(token.rest || '"DING"', token.line), line: token.line });
          break;
        case 'END':
          ended = true;
          break;
        default:
          diagnostics.push({ level: 'error', code: 'UNKNOWN_OPERATOR', line: token.line, message: `Unknown operator ${token.head}.` });
      }
    } catch (error) {
      diagnostics.push({ level: 'error', code: 'PARSE_ERROR', line: token.line, message: error.message });
    }
  }

  if (!ast.body) diagnostics.push({ level: 'error', code: 'BODY_REQUIRED', message: 'BODY declaration is required.' });
  if (!ended) diagnostics.push({ level: 'warning', code: 'END_MISSING', message: 'END marker is recommended for a closed portable body.' });
  return { ok: !diagnostics.some(item => item.level === 'error'), ast, diagnostics, tokens: lexed.tokens };
}

export function validatePortableAst(ast, registry) {
  const diagnostics = [];
  const body = registry?.bodies?.find(candidate => candidate.id === ast.body) ?? null;
  if (!body) diagnostics.push({ level: 'error', code: 'UNKNOWN_BODY', message: `Body ${JSON.stringify(ast.body)} is not registered.` });

  const known = new Set();
  let dingCount = 0;
  for (const statement of ast.statements) {
    if (!PORTABLE_OPS.includes(statement.op)) diagnostics.push({ level: 'error', code: 'BAD_OP', line: statement.line, message: statement.op });
    if (statement.op === 'SET') known.add(statement.name);
    if (['ADD', 'SUB', 'MUL', 'DIV'].includes(statement.op)) {
      if (!known.has(statement.name)) diagnostics.push({ level: 'error', code: 'STATE_BEFORE_SET', line: statement.line, message: `${statement.name} must be SET before ${statement.op}.` });
      if (typeof statement.value !== 'number' || !Number.isFinite(statement.value)) diagnostics.push({ level: 'error', code: 'NUMBER_REQUIRED', line: statement.line, message: `${statement.op} requires a finite number.` });
      if (statement.op === 'DIV' && statement.value === 0) diagnostics.push({ level: 'error', code: 'DIVIDE_BY_ZERO', line: statement.line, message: 'DIV by zero is blocked.' });
    }
    if (statement.op === 'COPY' && !known.has(statement.sourceName)) diagnostics.push({ level: 'error', code: 'COPY_SOURCE_MISSING', line: statement.line, message: statement.sourceName });
    if (statement.op === 'COPY') known.add(statement.name);
    if (statement.op === 'CONCAT' && !known.has(statement.name)) diagnostics.push({ level: 'error', code: 'STATE_BEFORE_CONCAT', line: statement.line, message: statement.name });
    if (statement.op === 'ASSERT' && !known.has(statement.name)) diagnostics.push({ level: 'error', code: 'ASSERT_STATE_MISSING', line: statement.line, message: statement.name });
    if (statement.op === 'DING') dingCount += 1;
  }
  if (dingCount === 0) diagnostics.push({ level: 'error', code: 'NO_DING', message: 'A portable proof program requires an explicit DING.' });
  if (dingCount > 1) diagnostics.push({ level: 'warning', code: 'MULTIPLE_DINGS', message: 'Multiple DING statements are preserved but one final Ding is preferred.' });

  return { ok: !diagnostics.some(item => item.level === 'error'), body, diagnostics };
}

export function lowerPortable(ast, registry) {
  const validated = validatePortableAst(ast, registry);
  if (!validated.ok) return { ok: false, ir: null, diagnostics: validated.diagnostics, body: validated.body };
  const body = validated.body;
  const nativeParserRecovered = !body.needs.some(item => /grammar recovery|identity audit|native parser/i.test(item));
  const ir = {
    schema: PORTABLE_SCHEMA,
    body: {
      id: body.id,
      name: body.name,
      kind: body.kind,
      status: body.status,
      law: body.law,
      nativeParserRecovered
    },
    sourceVersion: ast.version,
    operations: ast.statements.map((statement, index) => ({ index, ...statement })),
    contracts: {
      identityPreserved: true,
      sourceAuthority: body.id,
      targetAuthority: false,
      lossy: false,
      traceRequired: true,
      dingRequired: true
    }
  };
  ir.hash = fnv1a(ir);
  return { ok: true, ir, diagnostics: validated.diagnostics, body };
}

function sameValue(left, right) {
  return stableStringify(left) === stableStringify(right);
}

export function executePortable(ir) {
  if (!ir || ir.schema !== PORTABLE_SCHEMA) throw new TypeError(`Expected ${PORTABLE_SCHEMA}.`);
  const state = Object.create(null);
  const routes = [];
  const traces = [];
  const assertions = [];
  const diagnostics = [];
  let ding = false;
  let dingValue = null;

  for (const operation of ir.operations) {
    switch (operation.op) {
      case 'SET': state[operation.name] = structuredClone(operation.value); break;
      case 'ADD': state[operation.name] += operation.value; break;
      case 'SUB': state[operation.name] -= operation.value; break;
      case 'MUL': state[operation.name] *= operation.value; break;
      case 'DIV': state[operation.name] /= operation.value; break;
      case 'COPY': state[operation.name] = structuredClone(state[operation.sourceName]); break;
      case 'CONCAT': state[operation.name] = String(state[operation.name]) + String(operation.value); break;
      case 'ROUTE': routes.push({ route: operation.route, index: operation.index }); break;
      case 'TRACE': traces.push({ value: structuredClone(operation.value), index: operation.index }); break;
      case 'ASSERT': {
        const passed = sameValue(state[operation.name], operation.value);
        assertions.push({ name: operation.name, expected: operation.value, actual: structuredClone(state[operation.name]), passed });
        if (!passed) diagnostics.push({ level: 'error', code: 'ASSERT_FAILED', name: operation.name });
        break;
      }
      case 'DING': ding = true; dingValue = structuredClone(operation.value); break;
      default: diagnostics.push({ level: 'error', code: 'RUNTIME_UNKNOWN_OP', op: operation.op });
    }
  }

  const ok = ding && diagnostics.every(item => item.level !== 'error');
  return {
    schema: RECEIPT_SCHEMA,
    ok,
    ding,
    coldDing: ok ? 'PORTABLE_BODY_EXECUTED' : 'NO_DING_RUNTIME_FAILURE',
    body: ir.body,
    irHash: ir.hash,
    state,
    routes,
    traces,
    assertions,
    diagnostics,
    dingValue,
    claimBoundary: 'Portable backend/runtime parity only; native grammar parity is reported separately.'
  };
}

export function compilePortable(source, registry) {
  const parsed = parsePortable(source);
  if (!parsed.ok) return { ok: false, parsed, lowered: null, receipt: null };
  const lowered = lowerPortable(parsed.ast, registry);
  if (!lowered.ok) return { ok: false, parsed, lowered, receipt: null };
  const receipt = executePortable(lowered.ir);
  return { ok: receipt.ok, parsed, lowered, receipt };
}

export function fixtureSource(body) {
  return [
    `BODY ${body.id}`,
    'VERSION 0.2',
    'SET counter 1',
    'ADD counter 2',
    `ROUTE ${body.id}.execute`,
    `TRACE ${JSON.stringify({ body: body.id, law: body.law, target: 'portable' })}`,
    'ASSERT counter 3',
    `DING ${JSON.stringify({ body: body.id, state: 'EXECUTED_NOT_CROWNED' })}`,
    'END'
  ].join('\n');
}

function jsLiteral(value) {
  return JSON.stringify(value, null, 2).replace(/<\//g, '<\\/');
}

function cppString(value) {
  return JSON.stringify(String(value));
}

function rustString(value) {
  return JSON.stringify(String(value));
}

function symbol(id) {
  return id.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
}

export function emitJavaScriptModule(ir, relativeCore = '../../compiler-core.mjs') {
  return `import { executePortable } from ${JSON.stringify(relativeCore)};\n\nexport const ir = ${jsLiteral(ir)};\nexport function run(){ return executePortable(ir); }\n`;
}

export function emitTypeScriptModule(ir, relativeCore = '../../compiler-core.mjs') {
  return `import { executePortable } from ${JSON.stringify(relativeCore)};\n\nexport const ir = ${jsLiteral(ir)} as const;\nexport function run(){ return executePortable(ir); }\n`;
}

export function emitCppHeader(ir) {
  const fn = `receipt_${symbol(ir.body.id)}`;
  const lines = [
    '#pragma once',
    '#include <cmath>',
    '#include <string>',
    '#include <unordered_map>',
    '',
    `inline bool ${fn}(){`,
    '  std::unordered_map<std::string, double> numbers;',
    '  std::unordered_map<std::string, std::string> strings;',
    '  bool ding = false;',
    '  bool ok = true;'
  ];
  for (const op of ir.operations) {
    if (op.op === 'SET' && typeof op.value === 'number') lines.push(`  numbers[${cppString(op.name)}] = ${Number(op.value)};`);
    else if (op.op === 'SET') lines.push(`  strings[${cppString(op.name)}] = ${cppString(stableStringify(op.value))};`);
    else if (op.op === 'ADD') lines.push(`  numbers[${cppString(op.name)}] += ${Number(op.value)};`);
    else if (op.op === 'SUB') lines.push(`  numbers[${cppString(op.name)}] -= ${Number(op.value)};`);
    else if (op.op === 'MUL') lines.push(`  numbers[${cppString(op.name)}] *= ${Number(op.value)};`);
    else if (op.op === 'DIV') lines.push(`  numbers[${cppString(op.name)}] /= ${Number(op.value)};`);
    else if (op.op === 'COPY') lines.push(`  if(numbers.count(${cppString(op.sourceName)})) numbers[${cppString(op.name)}] = numbers[${cppString(op.sourceName)}]; else strings[${cppString(op.name)}] = strings[${cppString(op.sourceName)}];`);
    else if (op.op === 'CONCAT') lines.push(`  strings[${cppString(op.name)}] += ${cppString(String(op.value))};`);
    else if (op.op === 'ASSERT' && typeof op.value === 'number') lines.push(`  ok = ok && std::fabs(numbers[${cppString(op.name)}] - ${Number(op.value)}) < 1e-9;`);
    else if (op.op === 'ASSERT') lines.push(`  ok = ok && strings[${cppString(op.name)}] == ${cppString(stableStringify(op.value))};`);
    else if (op.op === 'DING') lines.push('  ding = true;');
  }
  lines.push('  return ok && ding;', '}', '');
  return lines.join('\n');
}

export function emitRustModule(ir) {
  const fn = `receipt_${symbol(ir.body.id)}`.toLowerCase();
  const lines = [
    'use std::collections::HashMap;',
    '',
    `pub fn ${fn}() -> bool {`,
    '    let mut numbers: HashMap<&str, f64> = HashMap::new();',
    '    let mut strings: HashMap<&str, String> = HashMap::new();',
    '    let mut ding = false;',
    '    let mut ok = true;'
  ];
  for (const op of ir.operations) {
    if (op.op === 'SET' && typeof op.value === 'number') lines.push(`    numbers.insert(${rustString(op.name)}, ${Number(op.value)}f64);`);
    else if (op.op === 'SET') lines.push(`    strings.insert(${rustString(op.name)}, ${rustString(stableStringify(op.value))}.to_string());`);
    else if (['ADD', 'SUB', 'MUL', 'DIV'].includes(op.op)) {
      const operator = { ADD: '+=', SUB: '-=', MUL: '*=', DIV: '/=' }[op.op];
      lines.push(`    *numbers.get_mut(${rustString(op.name)}).expect("state") ${operator} ${Number(op.value)}f64;`);
    } else if (op.op === 'COPY') {
      lines.push(`    if let Some(value) = numbers.get(${rustString(op.sourceName)}).copied() { numbers.insert(${rustString(op.name)}, value); } else if let Some(value) = strings.get(${rustString(op.sourceName)}).cloned() { strings.insert(${rustString(op.name)}, value); }`);
    } else if (op.op === 'CONCAT') lines.push(`    strings.entry(${rustString(op.name)}).or_default().push_str(${rustString(String(op.value))});`);
    else if (op.op === 'ASSERT' && typeof op.value === 'number') lines.push(`    ok = ok && (numbers.get(${rustString(op.name)}).copied().unwrap_or(f64::NAN) - ${Number(op.value)}f64).abs() < 1e-9;`);
    else if (op.op === 'ASSERT') lines.push(`    ok = ok && strings.get(${rustString(op.name)}).map(String::as_str) == Some(${rustString(stableStringify(op.value))});`);
    else if (op.op === 'DING') lines.push('    ding = true;');
  }
  lines.push('    ok && ding', '}', '');
  return { functionName: fn, source: lines.join('\n') };
}

export function bodySymbol(id) {
  return symbol(id);
}
