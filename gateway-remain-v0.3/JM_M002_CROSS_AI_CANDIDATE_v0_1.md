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
