# CP-C12 — Dedicated custody & controlled production promotion (HOLD)

## Source and recipient authority
- Actual currently deployed Render host: `jm-cloud-contact-server-v05`, ID `srv-dag55iek1f9s73e7fmng`, branch `hosted-v0.5-descendant`, deployed commit `0921217d95285bcb21cda7a995d02f7ec0725810` as of CP-C12 initial inventory.
- CP-C11 passing tested source: `654fb330be8b1606b5142a75a1fffce88797c7a5` on `jm/c11-fresh-volume-cutover-gate-20261024`.
- CP-C12 only adds standalone CI tests and bounded safety gate. Nothing deployed, merged, paid for or cut over.

## Custody criteria NOT satisfied by disposable CI
1. Separate **owner-approved** Cloud Contact PostgreSQL instance (or independently authorised database with explicitly segregated purpose) with known price, limits, region, retention, backup/restore and failure mode. No Market database borrowing.
2. Owner-managed stable private P-256 signer held in an approved secret store, pinned independently and exercised across new host instance/release. Record all three historical ephemeral public signer IDs as untrusted separate epochs until reconciled; never promote latest ID by default.
3. Independent live backup / restore including encryption, protected retention, audit evidence, and restored state verification without silently accepting stale or tampered content.
4. Source-to-target state migration or deliberate empty-state init with certified source-of-truth. A signed production claim needs a real externally returned signed result, not an HTTP 200.
5. Rollback doctrine: quiesce new writes, preserve/reconcile pending ACK and RESULT, prove compatibility of persisted format before reverting. Never simply downgrade server code after Postgres-only mutations.
6. A bounded one-time `command:probe` approval, secure admin/member token boundaries, authorised recipient, exact nonce and receipt verification, then owner acceptance.

## Hard STOP
Any unknown cost, unapproved resource, drifting signer, missing exact deployed source, unsigned receipt, restoration mismatch, missing real rollback proof, unexpected command or unresolved remote response => HOLD with unchanged production state.

Once criteria are independently proven, run the existing CP-C11 12-gate assessor, then an explicitly authorised single live probe. Physical Samsung ↔ laptop proof is independent.
