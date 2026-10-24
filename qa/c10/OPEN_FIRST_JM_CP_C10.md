# JM CP-C10 — Actual Cloud Contact × real RD runner × disposable PostgreSQL

Nonproduction child of independently passing CP-C8 commit cb4d787e63b951a248f230fc4a47f0c4e35894a3. No server source modification or hosted cutover.

This test requires ONLY disposable localhost postgres://...@localhost:5432/jm_cloud_qa; starts the actual Cloud Contact v0.5 server configured in production mode and actual CP-C5 RD v0.1.2 Relay/Runner (localhost SQLite). Real signed nonce missions, local signed receipts, host ACK/RESULT and separately verified owner-pinned P-256 receipt/event chain are required.

A cold restart deletes Cloud Contact local JSON cache, then checks independent PostgreSQL recovery and stable owner-managed ephemeral test private signing key. Deliberately lost host result response must HOLD until independent signed host readback. A different signing key must fail to boot under the production pin; restoring the original signer must recover.

Run on isolated GitHub Actions CI with postgres:16-alpine. Do not run against an account Postgres URL. GitHub action logs and run results are proof; committing this test is only a candidate, never an automatic PASS.

This tests neither real Render production nor a physical Fold/laptop. No owner approval of a dedicated persistent production Contact datastore/signing key, no merge or deployment. No Ding beyond proved boundaries.
