# JM SOVEREIGN AGENT GATEWAY v0.3 — Magnifying Glass Convergence

**YOUR DOOR. MANY AGENTS. YOUR AUTHORITY.**

This branch is the forward convergence descendant of the durable v0.2 Cading gateway and the current JM Magnifying Glass control body.

It does **not** create a third authority architecture.

## Two source authorities, one service face

- **Cading / JM Coding Estate** remains source authority for task creation, human-final approval, dispatch and gateway state.
- **JM.MagnifyingGlass/1.0** remains source authority for cages, evidence, recovery, concurrency, trust-domain provenance and worker replacement.
- `gateway-remain-v0.3/JM_SOVEREIGN_AGENT_GATEWAY_REMAIN_v0_3.mjs` is a deployment/service carrier that exposes both behind one durable door. It is not source authority.

The existing v0.2 gateway API and ACP face are proxied rather than rebuilt.

## Durable control face

The v0.3 face adds:

- persistent Magnifying Glass control state;
- current revision/digest re-entry;
- SHA-256 chained control receipts;
- guarded revision + digest compare-and-swap commits;
- stale-write rejection;
- restart recovery;
- authority-broadening rejection;
- hash binding to the existing Magnifying Glass engine;
- `/remain/health`;
- `/remain/control`;
- `/remain/reentry`;
- `/remain/receipts`.

A replacement worker can recover the current control, validate it, claim only an available cage and continue without inheriting the previous worker's private reasoning.

## Seeded live state

The branch carries the current Magnifying Glass control at revision **19** and the engine bound by SHA-256:

`975fec007d2d34b8dacbfff0b1ecd5fbb327f2f78ece89002b09ab97999744ad`

Destructive authority remains **disabled**.

## Local proof

The v0.3 self-test proves:

`seed → successor commit → stale conflict rejection → process restart → recovered control → authority-broadening rejection`

The Docker build runs this test before producing the service image.

## Hosted rail

The established Render service identity remains:

`jm-cloud-contact-server`

The existing 1 GB persistent disk remains mounted at `/data`. The v0.3 face stores its control journal under that persistent root and preserves the v0.2 gateway store beside it.

`autoDeploy` remains **false**.

## Claim boundary

**Proven in the candidate branch:**

- existing v0.2 Cading gateway lineage preserved;
- current Magnifying Glass control/engine carried into the gateway lineage;
- v0.3 control-store self-test PASS locally;
- restart-recoverable control state;
- chained control receipts;
- guarded stale-write rejection;
- no silent destructive-authority enlargement;
- runnable Docker/service configuration prepared.

**Still open — do not silently crown:**

- actual v0.3 container build on the deployment host;
- live hosted persistent-disk restart Ding;
- public HTTPS contact on the v0.3 descendant;
- live ACP wire Ding through the v0.3 service face;
- first real external replacement-worker round trip through the hosted face;
- owner-governed out-of-band attestation / independent transport trust.

**No Ding, no claim.**
## Executable proof rail

PR updates are checked by the base-branch `JM Remain v0.3 proof` workflow: exact Node preflight plus Docker build. A green run is required before runtime crown.

