# JM ECOSTATE CP-C14 — Shared writer fencing candidate

**24 October 2026 · source first, proof-scoped, no Render production cutover**

This additive child of CP-C13 adds optional PostgreSQL-backed shared writer authority to the actual Cloud Contact v0.5 server. Original source and RD bodies are preserved. When configured, the contact state writer must acquire the shared authority's row lock before its durable state save, then record the new state revision and SHA-256 watermark before releasing that lock. A successor can take writer authority only if the owner/epoch and latest recorded checkpoint match.

Two state PostgreSQL 16 services (`source`, `target`) plus a third PostgreSQL 16 service (`fence`) are disposable GitHub Actions services. Actual JM Cloud Contact and RD relay/runner/SQLite execute in isolation. The candidate explicitly tests a concurrent write blocked on the state row while holding the fence lock; stale promotion must wait and then reject the newer committed checkpoint. It tests native pg_dump/pg_restore, fresh candidate recovery, promotion to a new epoch, rejection of the formerly live writer, and successful signed real-RD probe after transfer.

**Boundary:** This is a shared application-level *cooperative* fencing protocol with one authoritative Postgres lock. It is **not** a distributed transaction across the state and fence databases. An abrupt connection failure between the state commit and fence watermark update can leave uncertainty, requiring stopped writers and independent signed-lineage reconciliation. It cannot restrain an old production build that does not implement the fence. There is no approved production datastore, operator credentials or deployment in CP-C14.

The CI parent is CP-C13 `ccb5026e7e53685f2b23691d39eb68786cf7d5ab`; production Render remains on older commit `0921217d95285bcb21cda7a995d02f7ec0725810`. This branch adds an opt-in source patch and isolated tests only.

No production permission follows from CI PASS. Production promotion requires explicit owner authority, dedicated Contact state and fence Postgres custody, stable signer and HMAC secrets, cost/backup approval, deployment of compatible fenced writers before any ownership transfer, verified rollback, and a bounded hosted probe. **No Ding, no claim.**
