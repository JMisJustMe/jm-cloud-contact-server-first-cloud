# CP-C5 — Live Cloud Contact signing identity continuity HOLD

Observed 24 October 2026, using read-only hosted HTTP GET and connected Render service/deployment/log metadata. This document is **not** a new authority for production state.

## Direct observations

- Same Render v0.5 service `srv-dag55iek1f9s73e7fmng`, latest reported deployment commit `0921217d95285bcb21cda7a995d02f7ec0725810`, deployed 16 October 2026; no later deployment observed.
- Prior `/health.startedAt`: `2026-10-23T22:31:06.990Z`. Prior public `/receipt-key.keyId`: `a619ac1a08f845bd82b77eec`.
- New `/health.startedAt`: `2026-10-23T23:05:28.500Z`; connected Render startup log at `2026-10-23T23:05:28.705959552Z` confirms server listen in production.
- New public `/receipt-key.keyId`: `42c9967ad9f2d551fd6a78b9`, re-observed unchanged in a subsequent public GET. It is **not** the prior signer.
- Public `/ready` still reports `ready:true`, profileCount 1 and receiptSigning true. Unauthenticated `GET /v5/spaces` returns HTTP 401; public `/health` observed `spaces:0`.
- The JM MARKET ECOSYSTEM LAB reported its **separate** PostgreSQL persistence contact durable and recovered prior boot witness at 23:05:31 UTC. Market persistence does **not** establish Cloud Contact signing or spaces durability.

## Interpretation and owner gate

Public signing identity **changed across observed process starts, without an observed new deployment**. That is consistent with ephemeral local signing material being lost/re-generated, but we cannot prove the precise underlying key-management cause from these observations alone; no explicit owner-approved rotation was established here.

A formerly trusted public key pin must not silently be replaced with this new key. The signed historical receipts tied to the old key have a separate authority era. Production durable Cloud Contact custody and owner-managed stable signing private key/expected key ID must be independently provisioned and tested across process restarts and deployments before authenticated CP-C5 promotion.

The draft bound-witness branch is a **development candidate** based on unmerged PostgreSQL PR #69, not the source of the currently deployed service. No production writes, credential reads, deployments, merges, database reuse or public-key promotion were performed. The GitHub draft PR creation action was blocked; this branch is unmerged.

**NO DING past the actual observed boundary.**
