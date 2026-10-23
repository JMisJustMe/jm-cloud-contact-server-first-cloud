# CP-C6 — Three hosted Cloud Contact v0.5 signing eras: continued HOLD

Recorded 24 October 2026 from **read-only public GET observations** and connected Render deployment and startup metadata. Source of truth for code remains the existing hosted v0.5 and unmerged durability PR #69; this is an independent evidence checkpoint, **not a deployment authorisation**.

Three distinct public `/receipt-key.keyId` values were observed on the same existing Render Cloud Contact v0.5.1 service as the process reported new start timestamps:

| Process `startedAt` UTC | Public key ID |
|---|---|
| 2026-10-23T22:31:06.990Z | `a619ac1a08f845bd82b77eec` |
| 2026-10-23T23:05:28.500Z | `42c9967ad9f2d551fd6a78b9` |
| 2026-10-23T23:41:45.734Z | `707a4df590f0fa791c06f6a5` |

The latest reported deployment remains `0921217d95285bcb21cda7a995d02f7ec0725810` completed 16 October 2026. Render app log `2026-10-23T23:41:46.0309019Z` corroborates a new production server process at the third epoch. The service again reported `ready:true`, `receiptSigning:true`, one profile and `spaces:0`. Immediately preceding requests returned HTTP 503; a later read succeeded. **No signed hosted space receipt or authenticated mission was obtained.**

**Exact observation:** public signer identity changes repeatedly across process starts without a newer reported deployment. **Hypothesis only:** ephemeral key-file loss/regeneration. Do not claim root cause or infer a legitimate owner-approved rotation. Market subsystem boot-time Postgres witness recovery is a different durability scope, not Cloud Contact signer/space state persistence.

## Reuse the already implemented durability gate

This development lineage already contains `contact/JM_CLOUD_CONTACT_CUTOVER_PREFLIGHT_v0_1.mjs`, `contact/JM_CLOUD_CONTACT_PG_DURABLE_v0_1.mjs` and `qa/JM_CLOUD_CONTACT_PG_DURABLE_QA_v0_1.mjs`. The cutover preflight requires an owner-controlled signing key matching an independent expected ID, stable member-token HMAC authority, a specifically approved existing database, reviewed pre-existing state, and holds on unexpected signer changes. Do not build another DB authority.

The new CP-C6 local companion validates full JWK fingerprints, stores observed epochs in an HMAC-chained SQLite ledger and blocks silent trust-pin replacement and insecure promotion. **26/26 local tests PASS**; the three public keys also independently recompute and yield **CUTOVER HOLD**. Full source and logs are saved in a separate CP-C6 checkpoint in the owner's existing OneDrive `Documents/ChatGPT/Return to ASAP` continuation folder once uploaded.

## No automatic promotion

Do not merge, deploy or create production contact credentials for this branch until:
1. Real-source QA and existing signed-signal/Postgres regression tests are run in isolated CI with disposable Postgres.
2. Explicit owner approval identifies durable Contact custody, signed key identity and restart/redeploy recovery, without assuming market DB reuse.
3. Historical public key epochs are preserved with independently reviewed zero-space rekey/rotation if needed, never auto-pinned.
4. A real hosted nonce probe returns a cryptographically bound receipt, followed by recovery testing.

**Current external authenticated Ding = HOLD; no live mutations or owner secrets used.**
