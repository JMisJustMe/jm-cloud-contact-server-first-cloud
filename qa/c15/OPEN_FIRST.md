# JM ECOSTATE CP-C15 — Uncertain State Commit & Fence Recovery

**24 October 2026 | ADDITIVE CI CANDIDATE | production HOLD**

## What this closes

CP-C14's shared writer lock prevents successful writes by a revoked writer, but a writer can still commit to its **state** PostgreSQL database before an error on the independent **fence** PostgreSQL database. Neither lock nor revision CAS guarantees atomicity across separate databases. CP-C15 adds a read-only checkpoint consistency assessment **on server startup**, and an in-lock preflight before every fenced write. Any difference is `JM_FENCE_UNCERTAIN_COMMIT:*`: no acknowledgement, no silent repair, and no deployment promotion.

### Exact additive changes

- `contact/JM_CLOUD_CONTACT_CHECKPOINT_POLICY_v0_1.mjs`: pure `MATCHED`, `MATCHED_EMPTY` or `HOLD` decision with explicit signed authority and checksum/revision bounds; never grants production authority.
- `contact/JM_CLOUD_CONTACT_WRITER_FENCE_v0_1.mjs`: add `assertCheckpoint` and optional (CP-C15) `checkpoint` preflight *while holding the actual shared PostgreSQL row lock*; retains CP-C14 promotion/locking protocol and unconfigured path.
- `JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs`: compare saved Cloud Contact checkpoint with fence at production-configured startup; check previous persisted state before new fenced writes; do not change the original unfenced route.
- `qa/c15/*.test.mjs`: 32 local pure negative and inheritance checks (18 new, 14 inherited).
- `qa/JM_CP_C15_SPLIT_COMMIT_REAL_RD_QA_v0_1.mjs`: isolated actual server plus actual RD relay/runner and native PostgreSQL fault + recovery. The injected PostgreSQL trigger rejects fence UPDATE *after* the state store has committed. The response MUST not be successful; restart MUST HOLD; operator-specified recovery restores the native pre-fault backup, retains the earlier valid signed history, does NOT certify the unacknowledged action, then earns a new signed RD probe.
- `.github/workflows/jm-c15-failure-atomicity-ci.yml`: runs three independent disposable PostgreSQL jobs (new CP-C15, CP-C14 inherited and CP-C13 inherited) without reusing the Market DB or live service.

## Scope boundaries

This is not an atomic transaction across both databases and does not itself resolve arbitrary network partitions. It detects divergence, refuses continued operation, and proves a tested human-authorised recovery *candidate* on disposable data. The simulated failure is a PostgreSQL trigger raising an error during the authority update, **not claimed to be an actual dropped TCP connection**. Unacknowledged local state is quarantined and may be lost on known-good restoration; any real deployment requires a documented operator decision to preserve, reconcile or compensate such data.

Missing gates: live writer-fence provisioning, durable Cloud Contact data, protected owner signer, explicit cost/rollback authority, real hosted probe and phone-laptop acceptance. No production writes, PR merges or deployments permitted by this test.

**Recover before rebuild · Integration ≠ Replacement · No Ding, no claim.**
