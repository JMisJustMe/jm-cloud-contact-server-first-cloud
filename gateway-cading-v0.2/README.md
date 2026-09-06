# JM SOVEREIGN AGENT GATEWAY v0.2 — Durable Cading Service

**Keeper:** YOUR DOOR. MANY AGENTS. YOUR AUTHORITY.

v0.2 is the forward durable descendant of the v0.1 Cading-first gateway proof. It does not rewrite v0.1.

## Source authority

`JM_SOVEREIGN_AGENT_GATEWAY_v0_2.cading` is the source body.

The source was compiled and executed by `JM_CODING_ESTATE_REAL_BUILD_v1_0.mjs` with:

- validation: **PASS**
- IR kind: `cading-ir`
- IR version: `10.0-jm`
- normalised digest: `jm-b38b1862`
- source SHA-256: `2a1a6e82f615599c9c79f8c5d21a0978cfbf977f566957de1f8324e276ac7479`

v0.2 adds source-owned `exportState` / `importState` routes so persistence can carry Cading state without becoming its authority.

## Lean deployment carrier

`JM_SOVEREIGN_AGENT_GATEWAY_CADING_JS_CARRIER_v0_2.mjs` is a bounded JS deployment carrier, not a general Cading compiler and not source authority.

Its parity receipt is **PASS** against the full JM Cading runtime across:

- initial state
- task identity
- pre-authority HOLD
- post-HOLD state
- approval
- dispatch
- final state
- state import
- imported state

JavaScript carries the Cading body; it does not replace it.

## Durable API body

`JM_SOVEREIGN_AGENT_GATEWAY_API_CARRIER_v0_2.mjs` provides:

- `GET /health`
- `GET /ready`
- `GET /api/v1/meta`
- `GET /api/v1/agents`
- `GET /api/v1/tasks`
- `POST /api/v1/tasks`
- `GET /api/v1/tasks/:id`
- `POST /api/v1/tasks/:id/approve`
- `POST /api/v1/tasks/:id/dispatch`
- `GET /api/v1/receipts`
- `GET /api/v1/receipts/runtime`
- ACP v1 HTTP/WebSocket path at `/acp` when enabled

### Authority separation

- `JM_GATEWAY_CLIENT_TOKEN` can create/read tasks.
- `JM_GATEWAY_AUTHORITY_TOKEN` is required for approval and dispatch.
- `JM_GATEWAY_ACP_TOKEN` protects the ACP public route.

Client capability does not become human authority.

## Persistence

The carrier stores Cading-exported state plus a SHA-256 chained receipt journal in `JM_GATEWAY_DATA`.

Writes are atomic. Existing stores are verified before import. A corrupt hash chain, wrong source hash, wrong contract version, or wrong authority mode fails closed.

The local restart proof is **PASS**:

`create → authority HOLD → approve → restart → recover → dispatch → restart → recover final state`

The test also proves the client token cannot use the human approval route.

## Render deployment rail

The branch's root `render.yaml` and `deploy/Dockerfile` promote the existing `jm-cloud-contact-server` service identity rather than inventing a new public root.

The deployment plan is a paid `0.5c-512mb` web service with one 1 GB persistent disk mounted at `/data`. This is intentional: Render free web services do not support persistent disks.

`autoDeploy` remains false for the first controlled hosted durability Ding.

## ACP boundary

The service is written to mount stable ACP v1 semantics through `@agentclientprotocol/sdk` 1.4.0 and its current HTTP/WebSocket server adapters.

ACP routing is:

`ACP prompt → Cading task → ACP permission request → human decision → Cading approve → Cading dispatch`

ACP wire contact is not crowned by source code alone. It requires a live deployed connection receipt.

## Claim boundary

### Proven now

- Cading source authority
- JM Cading compile/runtime proof
- Cading state export/import
- bounded JS carrier parity
- split authority tokens
- atomic file persistence
- chained receipt verification
- two-process local restart recovery
- HTTP API state recovery
- ACP HTTP/WebSocket adapter source wiring

### Still open

- Render persistent-disk restart Ding
- canonical public HTTPS contact on the v0.2 descendant
- ACP live wire Ding
- first external coding-agent execution Ding
- custom-domain migration/alias if a JM-owned domain is chosen later

**No Ding, no claim.**
