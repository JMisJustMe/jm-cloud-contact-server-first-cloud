# JM Living Home × Cloud Contact v0.5.1 — durable hosted contact
## FLAZ · OPEN FIRST · 23 October 2026 UK

**Owner:** JM / JMISJUSTME / JM32. **Authority:** existing Cloud Contact v0.5 hosted source → additive signed signals PR #67 → portable bundle PR #68 → **Postgres durability draft PR #69**. No new server, no new database, no native replacement.

### The essential recovery finding
- Render service `jm-cloud-contact-server-v05` (`srv-dag55iek1f9s73e7fmng`) is currently configured as free Docker service on branch `hosted-v0.5-descendant`, auto deployment OFF. Last verified live deployment commit `0921217d95285bcb21cda7a995d02f7ec0725810` (16 Oct 2026).
- Existing source persists contact spaces in a JSON file and ECDSA private key in a local PEM. No Render persistent disk appeared in inspected service settings; on that configuration a redeploy could lose spaces or change signature identity. An apparently valid signed-contact test would NOT establish persistence across Render redeploy. **Do not enrol real two-member spaces until this is solved.**
- Existing Render PostgreSQL instance `jm-market-survivor-state` was **discovered, not changed**. Reusing any of its capacity for Cloud Contact requires deliberate owner agreement and isolation; do not copy market tables or expose DB URLs. The new module uses a dedicated schema `jm_cloud_contact_v1`; it can also use another already authorised PostgreSQL connection.

### Exact tested candidate
- Draft PR #69 `https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/pull/69` on branch `jm/living-home-pg-durable-20261023`.
- **Last code-tested SHA:** `1aacbcc7a50c3289ef9ebf2df10582ed58724ca2`.
- GitHub Actions **run 39989541080** SUCCESS. Test gates: 27/27 existing-member signed-return / CP07 portable-bundle checks PASS, full original v0.5 server regression PASS, **12/12** new actual HTTP server + disposable PostgreSQL durability checks PASS, and **actual deploy/Dockerfile container build PASS**.
- Durable module: `contact/JM_CLOUD_CONTACT_PG_DURABLE_v0_1.mjs`. Single-row CAS snapshot in separate `jm_cloud_contact_v1` schema: revision check, SHA-256 content check, signer key ID and HMAC-secret authority check. Contact mutations must commit to PostgreSQL before HTTP 2xx. Lost database write → 503 HOLD / not READY; no positive acknowledgement. Original local JSON remains non-authoritative cache only in durable mode.
- Server uses stable PEM injected by an owner-controlled environment variable. It refuses a changed signing key or member-token HMAC secret during recovery. It can restart without local files, recover both member credentials and signal state, and continue issuing verifiable signed returns.
- **Production fails closed** without PostgreSQL and without separately pinned expected public signing-key ID. Dockerfile now copies the existing `contact/` modules and is tested as an image, not just source files.
- Existing old v0.5 source behavior when running in development without a Postgres URL remains preserved. This branch is NOT live; no production migration or token use was performed.

### Production owner-controlled configuration (not used or disclosed)
1. `JM_CLOUD_CONTACT_POSTGRES_URL` — exact owner-approved Postgres connection, ideally scoped role limited to schema `jm_cloud_contact_v1` (nothing in `public` or market tables).
2. `JM_CLOUD_RECEIPT_SIGNING_KEY_B64` — base64-encoded stable PEM private EC P-256 key securely installed in Render environment, NEVER public GitHub, chat, HTML, or an exported receipt. The original deployed key might be ephemeral; preserving the old public-key ID is not guaranteed until original PEM is safely recovered. Otherwise explicit owner-approved re-key/re-pin.
3. `JM_CLOUD_EXPECTED_SIGNING_KEY_ID` — 24 lower-hex ID independently computed from that public JWK; mismatch prevents boot.
4. `JM_CLOUD_SERVER_SECRET` and `JM_CLOUD_ADMIN_TOKEN` — existing server credentials must remain stable; arbitrary regeneration could sever member authority. Do not reveal them here.
5. `JM_CLOUD_ORIGINS` — explicitly trusted HTTPS origins; never wildcard or `null` for bearer credential browser access.
6. `JM_CLOUD_DURABLE_INIT_ALLOW_EMPTY=1` — **first boot only**, only when an independently checked existing hosted space count is zero and an authorised virgin database namespace is verified. Remove for subsequent deploys; an empty store after that means HOLD, not automatic rebuild.
7. Review retention size/capacity: initial snapshot currently limited to 12 MiB; this is a bounded early solution, NOT unlimited durable storage.

### What remains / no Ding
- Owner-approved PostgreSQL namespace and stable key provisioning in Render are OPEN. No mutation to existing database, no Render deploy, no production restart, no secret rotation, no cloud spend.
- Production signed-signal sources in PRs #67/#68/#69 remain drafts and unmerged. Promotion requires reviewed migration/rollback and actual Render cross-deploy persistence check. The automated tool cannot select an unmerged arbitrary SHA for the existing service by `trigger_deploy`; it would deploy the current configured branch only.
- Real hosted two-member enrollment is still HOLD. CP09 already provides a dry-run default enrolment utility; reuse it once credentials are owner-held.
- Real independent sender→hosted receiver→signed returned bundle→native Fold revision and physical Fold owner acceptance remain HOLD. Native signed-return child PR #412 passed 7/7 original Android CI workflows and generic emulator ECDSA key-pin/revision 5 checks; physical user test deferred.
- Connected Dropbox/Drive, Gmail/Outlook and genuine provider-to-provider AI work remain separately scoped; a transport receipt never proves task execution.
- Current live v05 `/health` earlier reported version `0.5.1-hosted`, 0 spaces, and `/v4/spaces` rejected unauthorised calls 401. Recheck just before release; historical observation is not evergreen.

### Return points
- Durable source PR: https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/pull/69
- Fully passing durable/docker CI: https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/actions/runs/39989541080
- Signed receipt base PR: https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/pull/67
- Portable native bundle PR: https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/pull/68
- Signed native Fold PR: https://github.com/JMisJustMe/JM-cading-lab/pull/412
- Existing Fold return base PR: https://github.com/JMisJustMe/JM-cading-lab/pull/406

**SOURCE → SIGNAL → CONTACT FIELD → ROUTE PRESSURE → STATE CHANGE → DING → TRACE → RECOVERY → OUTPUT.**  
**No Ding, no claim. Recover before rebuild. Contact before crown. Integration ≠ replacement.**  
**FLAZ = FROZEN · LOCKED · ANCHORED — in the EXISTING Cloud Contact source House.**  
This FLAZ is a documentation-only follow-up commit after code SHA `1aacbcc7...`, not an assertion of deployed production operation or Library/Dropbox residency.
