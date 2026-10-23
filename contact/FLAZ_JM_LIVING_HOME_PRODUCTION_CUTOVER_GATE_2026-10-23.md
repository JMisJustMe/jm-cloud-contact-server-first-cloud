# JM ECOSTATE — Living Home real hosted contact cutover gate
## FLAZ / OPEN FIRST / 23 October 2026 UK

**Owner authority:** JM / JMISJUSTME. Existing Cloud Contact v0.5 hosted source, not a new server. Draft PR #67 signed member signal, #68 portable signed bundle, #69 durable PostgreSQL and controlled cutover preflight. Existing native Fold signed-return PR #412 is unchanged and physical testing deferred.

### Evidence — current code and CI
- Candidate branch: `jm/living-home-pg-durable-20261023`.
- **Exact last fully tested code SHA:** `bd556af6cfac9187aaa92900096d7653fcaf0e9c`.
- GitHub Actions `39991973519`: **SUCCESS**. Existing signed contact **27/27 PASS**, actual server with disposable PostgreSQL **15/15 PASS**, original server regression PASS and actual deploy/Dockerfile Docker image build PASS. New cases validate owner-held private key against expected public ID, enforce read-only approved-database gate, and HOLD a previously observed hosted signing key change. NO user production database writes.
- New read-only module: `contact/JM_CLOUD_CONTACT_CUTOVER_PREFLIGHT_v0_1.mjs`. Public /meta,/ready,/receipt-key,/health; rejects unexpected version and unverifiable key; Postgres transaction BEGIN READ ONLY, checks approved database name, schema namespace, existing singleton metadata only, signing authority, HMAC secret continuity and approximate DB headroom. No production deploy, token issuance, member enrolment, schema creation, or file migration from this module. Credentials supplied through owner-controlled environment, never emitted.
- Previous durable CI (12/12) already confirmed committed state survives full server restart without local files; key or HMAC changes refuse boot; lost PostgreSQL writes yield HTTP 503 and unready, not a false acknowledgement. Expanded CI (15/15) adds read-only cutover drift tests.

### Actual live infrastructure audit
- Render existing v05 service `srv-dag55iek1f9s73e7fmng`, configured branch `hosted-v0.5-descendant`, auto-deploy OFF, free Docker plan, Frankfurt. Production last deployed `0921217d95285bcb21cda7a995d02f7ec0725810` on 16 Oct 2026; **not** any of draft PRs #67–#69.
- Existing Render PostgreSQL `dpg-daro60h7lnhs73e6frg0-a` is `jm-market-survivor-state`, Frankfurt, 1 GiB, operational; belongs to another established JM system. It has an empty external IP allowlist so this session's Render read-only database connector cannot inspect it. **Do not open network access or mutate shared data by guess.** Reusing it requires explicit owner-approved database role/schema isolation and private in-network execution.
- Live Render v05 /ready HTTP 200; unauthorised /v4/spaces HTTP 401. Readiness proves process health, not durable identity or legitimate member contact.
- Independently verified public signer IDs in sequence: `9953910a7979c8cd2f394721` (earlier), `61a6cd4a3e2f044656c3afeb` (later 23 Oct), then **`104d9e0e7dea7fbff3a6b3b5`** (final same-day probe). At least two signing identity changes observed; cannot assert cause, but current local-file PEM is not demonstrated stable. **HARD HOLD: No device should auto-pin a key from an imported bundle; no production enrolment before recovering/fixing signer and persistence.**
- Production signed API changes have NOT been deployed. A Render `trigger_deploy` of the currently configured base branch would simply redeploy old code; do not claim it releases PR #69.

### Activation remaining (ordered)
1. **Owner key custody and authority:** determine whether original live signing PEM can be recovered through an approved internal channel; if not, choose deliberate one-time rekey with separately approved public JWK pin and explicit invalidation history. Existing `JM_CLOUD_SERVER_SECRET` and admin authority must remain stable or enrolment cannot be trusted.
2. **Storage isolation:** approve use of existing Postgres or select already-authorised alternative; provision tightly scoped schema role and validate without disturbing Market survivor state. Preflight must run from an owner-controlled in-network environment with private env vars. Never paste keys/connection strings into chat or public repo.
3. **Deployment and rollback:** pin expected signing ID and stable PEM in Render env; review PR lineage, preserve last-deployed SHA and backup, decide branch promotion, deploy only after cutover preflight PASS and explicit owner approval. Any 503, key drift, CAS conflict or schema mismatch = HOLD/rollback.
4. **Live contact proof:** authorised CP09 two-member space; exact server persisted sender→recipient→reply; signed return, independent ECDSA verification, restart/redeploy recovery and recovery ledger. Do not treat contact as actual AI task completion.
5. **Owner Samsung physical test** remains deferred; generic emulator accepted synthetic signed return into revision 5, tamper/replay and cold restart PASS. Verified hosted proof into native Fold remains HOLD.
6. **Other connected JM bodies** Dropbox, Google Drive, Gmail, Outlook, GitHub, AI Gateway #66: separate scoped integrations; do not repackage as a new app.

### Contact/governance
**SOURCE → SIGNAL → CONTACT FIELD → ROUTE PRESSURE → STATE CHANGE → DING → TRACE → RECOVERY → OUTPUT.** No Ding, no claim. Contact before crown. Recover before rebuild. Integration ≠ replacement. 
FLAZ is sourced to existing Cloud Contact GitHub House and readback required. This is a documentation-only descendant of tested code, not a new production build or live migration.


---

## FORWARD CONTACT ADDENDUM · 23 October 2026 · reviewed-state / one-time signer transition

**Current exact tested code SHA:** `c25eac66226a7e9d6223442bd701329d1ccc6595` (supersedes older tested SHA in the historical section above, without erasing that evidence). GitHub Actions `40001660728` **SUCCESS**: **23/23** actual v0.5 HTTP + isolated disposable PostgreSQL durable/cutover checks PASS; existing **27/27** cryptographic member/CP07 return checks PASS; full preexisting v0.5 server suite PASS; hosted `deploy/Dockerfile` image build PASS. Source is still **draft PR #69**, not deployed.

**New bounded code:** Existing read-only `contact/JM_CLOUD_CONTACT_CUTOVER_PREFLIGHT_v0_1.mjs` now demands a second independent `/receipt-key` observation after database inspection. If the host's public signer changes during that inspection, it returns HOLD. An existing nonempty contact database can be approved for *future recovery* only with an owner-held exact `revision` + 64-hex snapshot `sha256` + actual `liveSpaces` witness; a missing/stale witness or conflicting key/HMAC never permits silent adoption.

**Safe first-time volatile-to-stable signing transition:** Because Render v05's earlier local PEM has been observed to drift despite no new deployed source SHA, demanding literal equality to the old ephemeral key can deadlock an owner-approved durable first boot. A **plan-only** special case is now available: only when the original hosted space count is independently **zero**, original live public signer is exactly owner-confirmed twice, the prior observed key ID and explicit old-key ID match, the approved *new* EC P-256 PEM maps to its independently approved new key ID, and the durable contact namespace is virgin/no stored row. An explicit `JM_CLOUD_BOOTSTRAP_REKEY_APPROVAL=JM_OWNER_APPROVED_ZERO_SPACE_REKEY_V1` with `JM_CLOUD_BOOTSTRAP_REKEY_OLD_KEY_ID` is required. It emits `plannedKeyTransition.executed:false`, **never generates/rotates/writes a signing key or grants deployment authority**. Real deployed contact spaces or stored contacts immediately forbid this bootstrap route. Negative tests confirmed wrong old key, missing owner approval, populated DB and mid-preflight drift fail closed.

**Do NOT blindly copy live ephemeral signing IDs into Fold Ultra**. On final owner-authorised deployment, establish permanent private PEM custody privately in Render, independent stable owner pin, approved schema/role, rollback, consistent member/admin HMAC authority and two-member hosted receipt/restart proof. `JM_CLOUD_REVIEWED_STATE_REVISION`, `JM_CLOUD_REVIEWED_STATE_SHA256`, `JM_CLOUD_REVIEWED_LIVE_SPACES` are only for already reviewed existing-state recovery, **not** a virgin DB. Private key, Postgres URL and credentials stay outside GitHub, downloaded HTML and chat. No live Render service or user DB changes made by this addendum.

**Scoped claim:** Tested preflight and safe two-phase signer *planning* complete in disposable CI; actual owner custody, Render secret install, production deployment, authorised member enrolment, live signed return and physical Fold acceptance still **HOLD**. The original FLAZ text is preserved for chronology.

**DING boundary: local CI source and container PASS, production identity and mission HOLD.**
