# JM SOVEREIGN AGENT GATEWAY v0.1 — Cading-First Restart

**Keeper:** YOUR DOOR. MANY AGENTS. YOUR AUTHORITY.

This branch is the clean restart of JM SOVEREIGN AGENT GATEWAY from a JM coding body rather than from a Node-first scaffold.

## Source authority

`JM_SOVEREIGN_AGENT_GATEWAY_v0_1.cading` is the source body.

It was parsed, compiled to `cading-ir`, normalised to JM IR, executed and receipted by `JM_CODING_ESTATE_REAL_BUILD_v1_0.mjs` from the JM Coding Estate.

Current compiler proof:

- validation: **PASS** — 0 errors / 0 warnings;
- Cading IR: **10.0-jm**;
- normalised IR digest: **jm-77305f6e**;
- entrypoints: `createTask`, `approveTask`, `dispatchTask`, `taskStatus`, `main`.

The runtime proof establishes:

- task creation;
- human-final authority mode;
- dispatch HOLD before approval;
- approval Ding;
- authorised-dispatch Ding;
- task state retained after the route.

## JM API carrier

`JM_SOVEREIGN_AGENT_GATEWAY_API_CARRIER_v0_1.mjs` is a JavaScript/Node carrier, explicitly **not source authority**. It hash-verifies the JM Coding Estate runtime and the Cading source, compiles the Cading body, mounts its runtime, then maps HTTP onto Cading functions.

Local HTTP smoke proof is **PASS**:

`POST /api/v1/tasks` → Cading `createTask`

`POST /api/v1/tasks/:id/dispatch` before approval → HTTP 409 + Cading authority HOLD

`POST /api/v1/tasks/:id/approve` → Cading `approveTask`

`POST /api/v1/tasks/:id/dispatch` after approval → Cading `dispatchTask` → `READY_FOR_AGENT_ROUTE`

## ACP v1 adapter

`JM_SOVEREIGN_AGENT_GATEWAY_ACP_STDIO_ADAPTER_v0_1.mjs` targets the stable ACP v1 package entry point using stdio/NDJSON.

Its authority route is:

`ACP prompt → Cading createTask → ACP requestPermission → Cading approveTask → Cading dispatchTask`

A rejected/cancelled ACP permission leaves the task held; JavaScript never promotes itself into approval authority.

ACP adapter syntax is **PASS**. ACP wire/runtime contact is presently **HOLD** because the official ACP SDK is not installed in the current execution container, so no ACP wire Ding is claimed yet.

## Boundary

JavaScript/Node, HTTP, ACP and provider-specific integrations are carriers/adapters downstream of the Cading source body. They are not source authority.

No claim is made yet that Devin, Codex, Claude or another external agent has executed a task. ACP wire contact and external-worker execution remain open gates.

## Lineage

The earlier `jm-sovereign-agent-gateway-v0.1` branch is a superseded Node-first experiment and is not the ancestor of this Cading-first line.

Current route:

`Cading source → JM Cading compile/normalise/runtime Ding → JM HTTP API Ding → ACP v1 adapter WIRED/HOLD → external agent Ding`
