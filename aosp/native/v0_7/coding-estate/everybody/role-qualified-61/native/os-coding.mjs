/*
 * OS_CODING — Authorised Forward Native Bridge v1.0
 *
 * Recovered identity/law:
 *   operating-system behaviour is authored through JM routes and state.
 * Recovered capabilities:
 *   OS, routing, state, services.
 * Recovered open needs:
 *   service grammar, permissions IR, kernel adapters.
 *
 * Historical OS_CODING grammar/source was not recovered in this pass. This module
 * is therefore a declared forward descendant. It deliberately compiles into the
 * already recovered RouteScript -> RouteVM -> RouteOS organs rather than inventing
 * a second host runtime.
 */

import { RouteOS, RouteScript, RouteVM } from '../../../sovereign-ten/direct/route-proof-native.mjs';

export const OS_CODING_BRIDGE = Object.freeze({
  schema: 'jm.os-coding.forward-native/1.0',
  status: 'AUTHORISED_FORWARD_NATIVE_BRIDGE',
  historicalRecoveryClaim: false,
  law: 'Operating-system behaviour is authored through JM routes and state.',
  runtimeDonor: 'RouteScript -> RouteVM -> RouteOS'
});

export class OSCodingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'OSCodingError';
    this.code = code;
    this.details = details;
  }
}

function need(condition, code, message, details = {}) {
  if (!condition) throw new OSCodingError(code, message, details);
}

export function parseOSCoding(source) {
  need(typeof source === 'string' && source.trim(), 'OSC_EMPTY_SOURCE', 'OS_CODING source is empty.');
  const match = source.match(/\boscoding\s+([A-Za-z_][\w.-]*)\s*\{([\s\S]*)\}\s*$/);
  need(match, 'OSC_BODY_REQUIRED', 'OS_CODING requires oscoding NAME { ... }.');

  const bodyName = match[1];
  const permissions = [];
  const services = [];
  const unknown = [];

  for (const raw of match[2].replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/\s*(?:#|\/\/).*$/, '').trim();
    if (!line) continue;

    let m = line.match(/^permission\s+([A-Za-z_][\w.-]*)\s+(allow|deny)$/);
    if (m) {
      permissions.push({ type: 'OSPermission', name: m[1], decision: m[2] });
      continue;
    }

    m = line.match(/^service\s+([A-Za-z_][\w.-]*)(?:\s+requires\s+([A-Za-z_][\w.-]*))?\s+route\s+([A-Za-z_][\w.-]*)$/);
    if (m) {
      services.push({ type: 'OSService', name: m[1], requires: m[2] ?? null, route: m[3] });
      continue;
    }

    unknown.push(line);
  }

  need(unknown.length === 0, 'OSC_UNKNOWN_DECLARATION', 'OS_CODING contains unknown declarations.', { unknown });
  need(services.length > 0, 'OSC_SERVICE_REQUIRED', 'OS_CODING requires at least one service.');

  const permissionNames = new Set();
  for (const permission of permissions) {
    need(!permissionNames.has(permission.name), 'OSC_DUPLICATE_PERMISSION', `Duplicate permission ${permission.name}.`);
    permissionNames.add(permission.name);
  }
  const serviceNames = new Set();
  for (const service of services) {
    need(!serviceNames.has(service.name), 'OSC_DUPLICATE_SERVICE', `Duplicate service ${service.name}.`);
    serviceNames.add(service.name);
    if (service.requires) need(permissionNames.has(service.requires), 'OSC_UNKNOWN_PERMISSION', `Service ${service.name} requires unknown permission ${service.requires}.`);
  }

  return {
    type: 'OSCodingProgram',
    body: bodyName,
    permissions,
    services,
    bridge: OS_CODING_BRIDGE
  };
}

export function lowerOSCoding(program) {
  need(program?.type === 'OSCodingProgram', 'OSC_BAD_PROGRAM', 'OS_CODING lowering requires OSCodingProgram.');
  return {
    type: 'OSCodingIR',
    schema: 'jm.os-coding.ir/1.0',
    body: program.body,
    permissionNodes: program.permissions.map((permission, index) => ({ id: `permission:${index}:${permission.name}`, ...permission })),
    serviceNodes: program.services.map((service, index) => ({ id: `service:${index}:${service.name}`, ...service })),
    edges: program.services.filter(service => service.requires).map(service => ({
      from: `permission:${program.permissions.findIndex(permission => permission.name === service.requires)}:${service.requires}`,
      to: `service:${program.services.findIndex(candidate => candidate.name === service.name)}:${service.name}`,
      kind: 'permission-gate'
    })),
    runtimeDonor: OS_CODING_BRIDGE.runtimeDonor,
    sourceTruth: 'AUTHORISED_FORWARD_NATIVE_BRIDGE_NOT_HISTORICAL_ORIGINAL'
  };
}

function routeSource(service) {
  return `route ${service.name} {\nstart:\nroute ${service.route}\nend\n}`;
}

export class OSCodingRuntime {
  constructor(ir) {
    need(ir?.type === 'OSCodingIR', 'OSC_BAD_IR', 'OS_CODING runtime requires OSCodingIR.');
    this.ir = ir;
    this.permissions = new Map(ir.permissionNodes.map(permission => [permission.name, permission.decision]));
    this.routeOS = new RouteOS();
    this.services = new Map();
    this.trace = [];

    for (const service of ir.serviceNodes) {
      const source = routeSource(service);
      const ast = RouteScript.parse(source);
      const graph = RouteScript.lower(ast).graphs[0];
      const bytecode = RouteVM.compile(graph);
      this.routeOS.registerRoute(service.name, bytecode, graph);
      this.services.set(service.name, { service, source, ast, graph, bytecode });
      this.trace.push({ type: 'service.registered', service: service.name, route: service.route, requires: service.requires });
    }
  }

  call(serviceName, payload = {}) {
    const entry = this.services.get(serviceName);
    need(entry, 'OSC_UNKNOWN_SERVICE', `Unknown OS_CODING service ${serviceName}.`);
    const required = entry.service.requires;
    if (required && this.permissions.get(required) !== 'allow') {
      const result = {
        type: 'OSCodingServiceResult',
        service: serviceName,
        status: 'permission-denied',
        required,
        state: structuredClone(payload),
        nextRoute: null
      };
      this.trace.push({ type: 'service.denied', service: serviceName, required });
      return result;
    }

    const routed = this.routeOS.callService(serviceName, payload);
    const result = {
      type: 'OSCodingServiceResult',
      service: serviceName,
      status: 'executed',
      required,
      state: routed.state,
      nextRoute: routed.state.nextRoute ?? null,
      routeExecution: routed.execution
    };
    this.trace.push({ type: 'service.executed', service: serviceName, nextRoute: result.nextRoute });
    return result;
  }
}

export function executeOSCoding(source, serviceName, payload = {}) {
  const ast = parseOSCoding(source);
  const ir = lowerOSCoding(ast);
  const runtime = new OSCodingRuntime(ir);
  const result = runtime.call(serviceName ?? ast.services[0].name, payload);
  return { ast, ir, runtime: result, runtimeTrace: runtime.trace, bridge: OS_CODING_BRIDGE };
}
