# JM MISSION 002 — Cross-AI Relay v0.1 (CANDIDATE)

**Purpose:** Fill the missing execution edge between Cading-authorised gateway tasks and real model API calls, reusing the existing Sovereign Agent Gateway and Magnifying Glass authority. This is a child carrier, not a new Estate source authority.

## Inherited source + boundaries
- Base: `jm-sovereign-agent-gateway-v0.3.8-sigstore-provenance-20261014`; no changes to Cading source or compiled Cading carrier.
- The gateway's existing HUMAN_FINAL approval and `READY_FOR_AGENT_ROUTE` dispatch are prerequisites, not results of this adapter.
- Only two explicit task agent routes: `jm-cross-ai:gemini>openai` and `jm-cross-ai:openai>gemini`. Copilot remains HOLD: no validated official execution adapter.
- External model outputs are evidence only. They do not execute tools, change GitHub/Render, claim authority, or expand worker permissions.

## Candidate service integration
- `POST /remain/cross-ai/run` with body `{"taskId":"task-N","expectedRevision":19,"expectedDigest":"CURRENT_DIGEST"}`. Requires the existing HUMAN_AUTHORITY bearer token.
- `GET /remain/cross-ai/status?taskId=task-N` requires HUMAN_AUTHORITY bearer token.
- Health metadata includes `crossAi.enabled`, `crossAi.verified`, `crossAi.count`, `crossAi.startupRecovered`.
- On a successful pair of model calls, returns bounded output, output SHA-256 and a chained completion receipt, with a separate hash-bound record for each provider stage. Truncated or blocked provider outputs fail closed.
- Crash/failed run leaves a durable HOLD requiring reconciliation, *never automatic replay* of potentially billable requests.
- Provider API endpoints fixed to the documented Google Gemini generateContent and OpenAI Responses APIs. No arbitrary proxy URLs.
- Prompt length max 4,000 characters; each provider response trimmed to 2,400 characters; each call max 350 output tokens, 15-second timeout by default. Avoid sending confidential records to external providers without explicit owner approval.
- The store resides in the already designated private JM durable data root (mode 0600); output text is retained there to support idempotent recovery. Keys are not stored in the relay receipts.

## Env: all opt-in, none committed
```
JM_CROSS_AI_ENABLED=true
JM_GEMINI_API_KEY=<server-side secret>
JM_OPENAI_API_KEY=<server-side secret>
JM_GEMINI_MODEL=<operator-selected supported model>
JM_OPENAI_MODEL=<operator-selected supported model>
```
An existing ChatGPT or Google AI subscription **does not itself establish API billing entitlement**. Never insert API keys into GitHub, URLs, browser-side code, or this note.

## Proof scope
- Source candidate and 8 offline mock-provider unit tests built 21 October 2026.
- Scripts: `npm run m002:cross-ai-test` and `npm run m002:http-roundtrip`, both added to inherited `npm run preflight`.
- Integration exercises the actual HTTP Cading approval/dispatch endpoints and cross-AI routes in both directions, with simulated provider endpoints; confirms unauthorised requests rejected, stale control held, intermediate stage receipts, idempotent replay, and restart recovery.
- **Independent GitHub CI PASS**: run [39641314468](https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/actions/runs/39641314468), both `npm run preflight` and exact Docker build; no deployment. The earlier [39640822788](https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/actions/runs/39640822788) also passed before the additional hardening.
- Offline tests cover approval/dispatch, bounded chained OpenAI/Gemini calls, refusal of stale control, idempotence/restart recovery, failed-call HOLD, and journal tamper detection.
- GitHub branch CI and exact Docker build are PROVEN; actual hosted deployment/start, provider credentials and real model responses are separate OPEN evidence gates.
- REAL Gemini↔OpenAI call: **NOT PERFORMED**.
- Render deployment, operator credential provisioning, cross-provider billing and third-party disclosure approval: **NOT PERFORMED**.
- Copilot model API contact and physical Fold↔laptop consequence: **OPEN**.
- Direct ChatGPT UI conversations do not thereby become automated API participants.

**No Ding, no claim. Recover → Inherit → Extend → Test → Compare → Promote only on evidence.**

## Promotion gate (as of 21 Oct 2026)
- Current artifact: [draft PR #66](https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/pull/66). Candidate branch only; ancestor untouched.
- Next external proof requires explicit owner approval to send a tiny, non-sensitive synthetic test prompt to two providers, valid separate API credentials, and accepted billing limits. The provider calls may incur usage costs and are NOT covered by ChatGPT Plus or Google AI Pro subscriptions.
- Do not enable `JM_CROSS_AI_ENABLED` or deploy over the established server to reach this gate. Verify an isolated runtime / reversible rollback and read back both receipt hashes after a genuine call.


## One-shot live provider proof — owner actions

Manual workflow: https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/actions/workflows/jm-m002-live-provider-proof.yml

- Added independently to the repository default branch (main); no scheduled, push or PR trigger.
- Checkout is fixed at tested candidate commit 899c6dd082e8f0494699827572c691cbbb960a0f. It does not follow mutable branch changes.
- GitHub actor is required to be JMisJustMe; manual owner approval phrase is I_APPROVE_ONE_TWO_PROVIDER_API_EXCHANGE.
- Secrets are never committed and are made available only to the live execution step, following a fresh preflight.

Owner configuration, required to actually earn the external-contact Ding:
1. In the OpenAI Platform account, enable separately billed API usage and create a narrowly scoped key. ChatGPT Plus does not include API usage.
2. In Google AI Studio, create a Gemini API authorization key; review project rate limits and free-tier eligibility.
3. In GitHub repository Settings > Secrets and variables > Actions > New repository secret, set these two names: JM_M002_OPENAI_API_KEY and JM_M002_GEMINI_API_KEY. Do not paste values in chat, issues, or commits.
4. In the GitHub Actions tab, select JM M002 One-shot live provider proof, use Run workflow, and type I_APPROVE_ONE_TWO_PROVIDER_API_EXCHANGE.
5. Read GitHub execution summary and verify external-return hashes, restart recovery and zero repeated provider calls.

The proof is capped in code at TWO outbound provider HTTP requests across one synthetic Gemini to OpenAI task. Both model outputs are bounded at 350 tokens by API parameters, and each request uses a 15-second timeout. No tool access, external actions, private Estate context or production deploy is authorised by this workflow. Secrets are not printed to logs; generated text remains local to the temporary GitHub runner and is deleted after the smoke.

PROOF SCOPE: CI run 39649618678 passed inherited preflight and Docker build on the pinned code. Real external provider inference is still HOLD until owner credentials and the manual trigger are completed. Existing public JM servers remain unchanged.

## Credential diagnosis — 21 October 2026

Two previous owner-triggered live runs (39658501961 and 39658811235, plus rerun attempt 2) stopped before inference at HOLD_TWO_PROVIDER_KEYS_REQUIRED. GitHub CI diagnostic run 39663348783 checked secret NAME presence only: JM_M002_OPENAI_API_KEY=true, JM_M002_GEMINI_API_KEY=false; four conventional Gemini aliases (GEMINI_API_KEY, GOOGLE_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GENAI_API_KEY) all false. No key bytes were inspected or printed. An independent read-only GET /v1/models authentication probe against the existing OpenAI secret returned HTTP 401 (run 39663684638). Thus the existing OpenAI secret is present but currently invalid for OpenAI; the Gemini secret is absent. Do not infer which value is stored. No inference or AI model usage was attempted by this diagnostic.

Protected workflow update on main: commit 41b76bbaf714ddc996980b248908f66d405280d4 introduces fail-closed READ-ONLY provider-auth checks before any two-provider inference, with no secret-value logging. Owner action remains necessary to put the correct Gemini key into JM_M002_GEMINI_API_KEY and to correct the OpenAI secret using a valid OpenAI Platform key; the connected GitHub app does not expose encrypted Actions secret-write permissions. Avoid replaying paid workflows until credentials authenticate independently. Current scope: AUTHENTICATION HOLD, no live cross-provider Ding.

## Offline cross-AI return verification — 21 October 2026

Recovered owner-controlled Gemini handoff evidence in the existing public AI Federation source guide at `JMisJustMe/JM-cading-lab/ai-federation/jm-ai-lab-v2.0/CROSS_AI_CONTACT_CREATION_v1.md`. Read the actual Dropbox High Tide original and coding keeper; an independent ChatGPT-side October 21 raw-byte readback of the public 2,888-byte GitHub Actions archive and Dropbox copy matched SHA-256 `c346b8d3252f75bbd84cf7d9b5e802a13230ff678d5262c526dbfafa669dbffa`. The private Zionfolder coding keeper 9,212,914 bytes matches previous hash `12e5b3a8ec059ce21bcc9f454d811ef5136584ce0f82f1c8ca921a1f25a2a00f`, ZIP CRC passes and 14/14 internal SHA-256 members match. Private coding source NOT copied here or published.

New additive tools inside this SAME preexisting gateway:
- `JM_M002_SOURCE_RETURN_GATE_v0_1.mjs` — credential-free local verifier taking a challenge JSON, a returned JSON report and exact source bytes. Validates independent source SHA-256, byte length, challenge ID and challenge nonce, with size/prompt bounds. It has no API requests or writes, and never claims a named AI produced the return.
- `JM_M002_SOURCE_RETURN_GATE_TEST_v0_1.mjs` — six offline tests including corrupted bytes, forged hash, stale nonce/ID, malformed input and provider-name spoofing. Wired into existing `npm run preflight`; GitHub Actions run `39675120547` returned successful preflight and Docker build; 6/6 return-gate assertions PASS and existing relay 9/9 PASS. Scope is **offline simulated reports**, not actual Gemini communication.

Sample local invocation: `node gateway-remain-v0.3/JM_M002_SOURCE_RETURN_GATE_v0_1.mjs challenge.json returned.json original-bytes.bin`. It returns `SOURCE_RETURN_BYTES_BOUND` only for exact source bytes and a bound return envelope, with `providerIdentityVerified=false`, `providerExecutionVerified=false` and `externalProviderContactVerified=false`. This is source content matching, not cryptographic source-of-response authentication.

**Unresolved live gate:** The authenticated GitHub Actions check found `JM_M002_GEMINI_API_KEY` absent, and the existing `JM_M002_OPENAI_API_KEY` failed a read-only model-list auth check with HTTP 401. TinyFish saved browser profiles contain no authenticated Google session. There is no connected Gemini execution/write interface in this ChatGPT session. Neither Dropbox source readback nor an offline Gemini-labelled fixture warrants a provider-run Ding. A real Gemini origin/return still requires an independently observed Gemini session or valid owner-stored keys; do NOT silently use scraped credentials, broaden private Dropbox permissions, or publish private source.

Preservation: no deployed service changed, no protected original modified, no new persistent duplication of private coding packages, and the candidate remains draft PR #66. No ChatGPT quota reduction is claimed.
