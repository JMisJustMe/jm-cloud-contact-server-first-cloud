# JM ECOSTATE — CP-C13 | Three-carrier recovery & fork detection

**Source authority:** additive child of CP-C12 verified head `d3c407244b1f2afd44f1c7f624aa30b50816f4ce`, [GitHub Actions run #40059038229](https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/actions/runs/40059038229). Existing Cloud Contact server, durable Postgres module and Revolving Door have **zero source modifications**.

## Goal

Use three *distinct*, disposable PostgreSQL 16 service containers (source, target and recovery). Prove two real `pg_dump -Fc`/`pg_restore` transfers of the JM Cloud Contact durable schema alongside the actual hosted-server source (running on localhost), the signed Revolving Door relay/runner and a fixed, ephemeral test-only P-256 signing identity.

A new signed RD challenge executes on source, a second on target after restoration and a third on recovery after the second restoration. The old source is deliberately given a conflicting **queued** command after the first migration (a *test-only split-brain fault*). This command does NOT execute on a device. The independently verified cloud signed event chains must cause **HOLD** on attempted rollback to the divergent old source.

The recovery recipient inherits the target's signed chain and can execute a new bound probe. Original and target are not overwritten. Wrong signer and wrong HMAC authority are refused on the recovery recipient. No private keys, member tokens or raw backups are uploaded as artifacts.

**Limitations:** This does NOT implement an actual production writer fence, reconcile divergent commands, prove zero-downtime traffic transfer, authorize production database charges or provide real Fold/laptop contact. A passing CI run means only isolated production-configuration code behaviour; production stays HOLD.

## Local vs GitHub proof

Run local negative tests without PostgreSQL: `node --test qa/c13/*.test.mjs`. The real integration test *must* run in GitHub Actions with its exact three localhost database/container credentials. The test fails closed elsewhere; never weaken its exact service allowlist.

Only mark the database integration PASS after independently reading a successful GitHub Actions job **and** its JSON test witness. Preserve failures and corrections. No deploy, merge or production resource mutation follows from CI.
