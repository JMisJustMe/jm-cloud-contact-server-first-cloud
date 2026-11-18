# JM SOVEREIGN AGENT GATEWAY v0.2 — Durable Cading Deployment Branch

**YOUR DOOR. MANY AGENTS. YOUR AUTHORITY.**

This branch promotes the existing JM Cloud Contact public-service rail into the durable JM Sovereign Agent Gateway descendant without deleting the historical v0.4.2 carrier files.

## Source authority

The source body is:

`gateway-cading-v0.2/JM_SOVEREIGN_AGENT_GATEWAY_v0_2.cading`

JavaScript, Node, Docker, Render, HTTP and ACP are downstream carriers/adapters. They do not replace Cading as source authority.

See `gateway-cading-v0.2/README.md` for the compiler, parity, persistence and claim-boundary receipts.

## Canonical service continuity

The Render Blueprint deliberately preserves the established service identity:

`jm-cloud-contact-server`

A descendant does not receive a new public root merely because its body evolved.

## Durable deployment rail

The root `render.yaml` now describes:

- one Docker web-service instance;
- paid `0.5c-512mb` compute;
- one 1 GB persistent disk at `/data`;
- generated client, human-authority and ACP bearer tokens;
- `/ready` health checking;
- ACP enabled at `/acp`;
- `autoDeploy: false` for the first controlled hosted durability Ding.

The deployed state file is intended to live at:

`/data/JM_SOVEREIGN_AGENT_GATEWAY_STORE_v0_2.json`

## Current proof state

**PASS:** Cading compile/runtime, source-owned state roundtrip, JS-carrier parity, split authority, chained receipts, atomic persistence and two-process local restart recovery.

**OPEN:** actual Render persistent-disk restart Ding, public HTTPS descendant contact, ACP live-wire Ding and first external coding-agent execution.

Repository configuration is not itself a hosted durability claim.

**No Ding, no claim.**
