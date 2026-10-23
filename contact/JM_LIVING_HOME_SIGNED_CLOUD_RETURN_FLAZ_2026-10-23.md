# JM Living Home × Cloud Contact Server v0.5.1 — Signed Return
## FLAZ · OPEN FIRST · 23 October 2026 UK

**Owner:** JM / JMISJUSTME  
**Intent:** Continue Mission 002 through EXISTING Living Home CP07–CP09 and EXISTING JM Cloud Contact Server v0.5.1, not a new app, gateway, catalogue or deployment.  
**State:** ACTUAL LOCAL HOSTED-SERVER CODE EXECUTION PASS · INDEPENDENT CRYPTOGRAPHIC RECEIPT PASS · CP07 RETURN LEDGER CONTACT PASS · LIVE RENDER SPACE HOLD · PHYSICAL FOLD HOLD.

### Source authority and exact checkpoint
- Existing service repo `JMisJustMe/jm-cloud-contact-server-first-cloud`, original hosted source branch `hosted-v0.5-descendant` at base SHA `0921217d95285bcb21cda7a995d02f7ec0725810`.
- Additive isolated descendant `jm/living-home-signed-signal-contact-20261023`, **draft PR #67**, last fully passing code SHA `329164ecd5f6df191e01e37f5cd4670a4bad8ff1`. This FLAZ is documentation AFTER that tested code SHA; verify branch and CI again on return.
- GitHub Actions run **39975634794 SUCCESS**, targeted `qa/JM_LIVING_HOME_SIGNED_SIGNAL_QA_v0_1.mjs` **26/26 checks PASS** on **the actual, local v0.5.1 server process and HTTP sockets with generated ephemeral admin/member tokens**. Existing full `npm test` suite PASS (old static, existing server, game, mesh, market, Zezu, health). This is *not* a remote Render-authenticated test.
- New member-authenticated read route `GET /v4/spaces/:spaceId/signals/:signalId/receipt` (and compatible /v5), only for the persisted signal's actual sender or recipient. Server ECDSA-P256-SHA256-P1363 signing uses pre-existing `/receipt-key` identity. The receipt binds signal ID, request ID, from/to, kind, timestamp and exact canonical SHA-256 payload. No payload contents, raw token or new authority to issue commands in receipt. Previous API routes remain available.
- New *read-only* `contact/JM_LIVING_HOME_RETURN_VERIFY_v0_1.mjs` consumes an ORIGINAL `JM.LivingHome.CP07.CloudReturn/1.0` ledger + temporary bearer credential. It uses authorised GETs to independently fetch recipient's actual returned signal and signed receipt, verifies the exact original mission ID/challenge/project result, payload hash, ECDSA signature and (if owner-supplied) pinned public key ID. It outputs **credential-free**, bounded `JM.LivingHome.SignedReturnEvidence/1` with status `SERVER_RETURN_SIGNATURE_VERIFIED`. It does not claim recipient actually performed work or identify which AI wrote the text.
- Tests include anonymous/nonparticipant denial, admin-only space setup, capability-gated forward and return, sender/receiver independent receipt read, request ID deduplication, tampered payload, forged CP07 text, incorrect pinned key, cold-process restart with persisted key/receipt, member revoke and historical receipt after close.
- Current production public GET probe before the PR: `https://jm-cloud-contact-server-v05.onrender.com/receipt-key` returned HTTP 200 with ECDSA key ID `9953910a7979c8cd2f394721`, independently recomputed from the public JWK; `/health` returned version `0.5.1-hosted`, **0 spaces**. This is a *snapshot*, not a permanent key pin or evidence the new route is deployed.
- Protected browser boundary: `Origin: null` does not gain CORS permission; only explicitly approved browser origins can make credential-bearing web requests. Do not broaden to wildcard or null just to make a downloaded HTML connect.
- Existing native Fold Ultra descendant `JMisJustMe/JM-cading-lab` draft **PR #406** and tested source SHA `d7bb4b016f5b764f3c3357068ba80ec8d9a09812` remain separate and unchanged. Earlier native FLAZ: `agent-runtime/host-adapters/android/fold-ultra-autosetup/FLAZ/JM_FOLD_ULTRA_LIVING_HOME_NATIVE_CONTACT_FLAZ_2026-10-23.md` on its own branch; no merge of branches or pretending the native APK already validates cryptographic receipts.

### State of contact and remaining gates
1. **PASS:** Existing v05 process, two generated test members, real local HTTP forward/return, readbacks, ECDSA verification, ledger matching, restart/revocation/denial checks; CI test exact commit.
2. **HOLD:** Installing candidate route on existing Render service; Render's actual deployed v05 has NOT been changed. Remain on draft branch for owner approval; no production deployment or hosting charges.
3. **HOLD:** One live authenticated two-member space on production Render. Existing admin secret is intentionally unavailable to this assistant; no guessing/rotation. Existing CP09 owner enrolment tool is dry-run by default and already exists; reuse, don't recreate.
4. **HOLD:** Live sender → hosted server → physically independent recipient → return, signed receipt verified and captured into CP07 ledger; requires properly enrolled members and intended trusted browser origin or owner-run client.
5. **HOLD:** Live signed return → Android owner acceptance and native session; generic emulator already proves synthetic CP07 return produces revision 4 and protects previous Return Point, not live phone/cross-device proof. Owner defers physical testing for now.
6. **HOLD:** Dropbox/Drive actual file retrieval into scoped native project, genuine Gemini↔OpenAI inference with valid separately authorised provider credentials; neither follows automatically from signed signal receipts.

### Governance
**SOURCE → SIGNAL → CONTACT FIELD → ROUTE PRESSURE → STATE CHANGE → DING → TRACE → RECOVERY → OUTPUT.** 
**No Ding, no claim · Recover before rebuild · Integration ≠ replacement · Contact before crown.**
Retain owner approval for production deployment and credential use. Do not ship new standalone Living Home HTML, silently change CORS, copy private Dropbox content to public GitHub, merge unreviewed source or declare external work completed by a signed transport receipt alone.

**FLAZ = FROZEN · LOCKED · ANCHORED · in EXISTING cloud source House.** No separate Library/Zionfolder custody is claimed.
