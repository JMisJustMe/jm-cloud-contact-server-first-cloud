# JM ECOSTATE — CP-C11 | Fresh-Volume Signing Custody & Production-Cutover Gate

**24 October 2026 · READ FIRST · No live cutover, no owned PostgreSQL provisioning, no external credentials**

## Source

Parent: CP-C10 tested commit `17d5f1815e61a1feaedbf255f05ac0ba4f0efcac` from `JMisJustMe/jm-cloud-contact-server-first-cloud`. This branch adds only an isolated acceptance test, a machine-readable **advisory** cutover gate, current read-only live evidence, and GitHub CI workflow. It does not edit the host implementation, the existing real Revolving Door, database persistence mechanism, or production settings.

## Actual new gates

1. **Fresh filesystem rehearsal** — Start exact existing v0.5 server with disposable localhost PostgreSQL and test-only owner-supplied EC P-256 private key **only from an environment variable**. Create a scoped probe command and signed server journal. Stop service; boot from a brand-new cache directory and signer-file path, reusing solely same ephemeral owner signer and PostgreSQL. Independently verify same signature, receipt hash, historical command and durable member authority, then write a new member event. Wrong private signer, wrong HMAC authority, missing signer, and missing PostgreSQL must refuse production-mode boot. All private test material is ephemeral and never uploaded.
2. **CP-C10 full regression in parallel isolated job** — Separate disposable PostgreSQL service, 31 RD tests and 25 real host/runner integrated checks. This is the same source, not a simulation replacing the runner.
3. **Current hosted preflight evidence (read-only)** — Render v0.5 service remains on 16 October source commit `0921217d...`, auto deploy off. Only one existing Render PostgreSQL resource was observed, named `jm-market-survivor-state`, not a dedicated Cloud Contact resource. Public v0.5 returned temporary HTTP 503 and then health/ready success; public signer key ID now `40faae12ef1f19d5e5aabcf1` after prior distinct ids `a619ac1a08f845bd82b77eec` and `42c9967ad9f2d551fd6a78b9`. **Causal explanation not proven; no silent pin replacement**.
4. **Fail-closed cutover assessor** — Source `qa/c11/cutover-gate.mjs` records evidence refs and checks readiness, release commit, separately approved database, backup/restore, signer key identity, observed signer epochs, CI, private credentials, rollback and cost/probe approval. It emits `HOLD` or, for hypothetical satisfied metadata, `REVIEW_CANDIDATE_NOT_AUTHORISED`. It does not create any deployment authority or inspect/store private tokens. A passing *hypothetical* fixture is never automatically a live GO decision.

## Acceptance

In GitHub CI, each job is independent and uses a disposable PostgreSQL 16 service on `localhost:5432/jm_cloud_qa`. No account Postgres endpoint may be supplied; the new test rejects other URLs. The local sandbox cannot independently execute the Postgres run because PostgreSQL is unavailable; rely on CI logs and artefact readback, not file presence, before marking PASS.

After CI, verify exact commit SHA, both job statuses, actual output `checksPassed`, 31/31 RD regressions and 25/25 inherited CP-C10 integration. Keep controlled mutation of live Render, owner signing secrets, dedicated PG provisioning and actual hosted probe **HOLD**.

**Recover before rebuild · integration ≠ replacement · No Ding, no claim.**
