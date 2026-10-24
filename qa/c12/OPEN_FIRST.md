# JM ECOSTATE — CP-C12 Dedicated Cloud Custody Transfer | READ FIRST

**24 October 2026 · Next candidate after CP-C11 · TEST-ONLY, NO PRODUCTION PROMOTION**

The inherited CP-C11 checkpoint is sealed unchanged: `/JM Estate`/OneDrive CP-C11 archive, SHA-256 `06a6ad0f16b12cc841e5ec442b4074a8faeee31c425a25620a652762102a68af`.

## Exact advance

This candidate combines the **actual JM Cloud Contact v0.5 hosted descendant**, **actual Revolving Door v0.1.2 Relay and Runner**, **real SQLite receipts**, and **two physically separate disposable PostgreSQL 16 service containers** in a single GitHub CI acceptance route:

1. Start real host against source disposable PostgreSQL in production *configuration* with ephemeral test-only owner-managed P-256 signer and HMAC authority.
2. Queue and process a real bounded 128-bit nonce probe through the actual RD relay/runner; verify local signed receipt, P-256 signed hosted-style receipt, and full event hash chain.
3. Stop host and take native PostgreSQL `pg_dump --format=custom --schema=jm_cloud_contact_v1`, recording a SHA-256 only. **No raw dump is uploaded**.
4. Import with PostgreSQL `pg_restore` to a **different** disposable container with an independently addressed database. Run a fresh server process with a fresh filesystem and the same test signer/HMAC.
5. Independently verify exact restored cryptographic signed space receipt and committed real RD probe; execute a *second* actual RD probe after restore, show the target custody changes but source custody doesn't.
6. Reject changed private signer and HMAC authority. Verify original and restored independent states remain intact and recoverable.

`qa/c12/backup-guard.mjs` requires exact `127.0.0.1` disposable database targets AND distinct GitHub Actions Docker service IDs; no Render database URLs, reused Market state or local accidental execution.

## Authority gates

**Passing this CI rehearsal DOES NOT provide**: a dedicated purchased Render database, owner-approved cost cap, protected production signing-key escrow, actual production backup policy, signer epoch reconciliation, historical data migration, compatible rollback, authenticated live probe, or physical Fold ↔ laptop execution.

The live hosted v0.5 server stays at deployed `0921217d95285bcb21cda7a995d02f7ec0725810` and the separate source PRs #69 and #70 remain unmerged unless independently confirmed otherwise. CI branch changes are additive **test files only**; no server implementation replacement.

Dedicated Cloud Contact storage has not been provisioned. The Market Postgres is NOT a substitute. A real paid/storage/live deployment requires exact owner approval of the named resource, running costs, credential custody, and rollback after independent review.

**KEEP PROD HOLD until all gates have actually earned proof; No Ding, no claim.**
