# JM ECOSTATE — CP-C16 | Hosted Promotion Authority and Rollback

**24 October 2026 · Development/preflight candidate · PRODUCTION HOLD**

## Inherited, independently proven authority

CP-C15 is the current development head: `84bb7a2dbac2352e8e680d7ce1993dfee299b621`, from `jm/c15-uncertain-commit-fence-recovery-20261024`; CI run [40085185327](https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/actions/runs/40085185327) passed 189/189 checks, including real PostgreSQL backend termination, unacknowledged state-save detection, and controlled RD signed-receipt recovery. This is **not** the live Render head.

The live service `srv-dag55iek1f9s73e7fmng` is `jm-cloud-contact-server-v05`, on free Render tier, `hosted-v0.5-descendant`, auto-deploy disabled, last listed deployment `0921217d95285bcb21cda7a995d02f7ec0725810` (16 Oct). Render database inventory exposes only `jm-market-survivor-state`, ID `dpg-daro60h7lnhs73e6frg0-a`; it **must not be used** for Cloud Contact. A public GET check for `/health`, `/ready`, and `/receipt-key` returned 503 in the current session; Render may be sleeping, so this does not prove permanent outage. Refresh immediately before change.

## Release process, no automatic action

**PREPARE — authorisation and custody.** Require exact independently confirmed GitHub source/CI pin; current live Render version and disabled auto-deploy; two distinct owner-approved dedicated Postgres resources (Contact state and shared writer fence); verified separate backup and restoration; independently protected, durable P-256 signer and separate member-token HMAC authority; resolved prior signing identity eras; estimated monthly billing within an explicitly authorised cap; a tested stop-writes mechanism; and an owner-signed release ticket bound to exact service, target commit, both database IDs, signer, monthly cap and rollback digest. The owner signature's public-key pin must come from an **external trusted channel**, not the ticket itself. The ticket expires and must not be reused for later phases.

**CANARY — bounded live proof.** Following separate approval, explicitly stage the exact reviewed artifact with no auto-deploy. Require an authorised probe-only space/member and private tokens through provider secret custody; never in GitHub CI logs or a ZIP. Require a real signed RD probe from an authorised endpoint, locally signed mission receipt, independently validated hosted P-256 signed snapshot, full event chain and stable signer pin across a controlled restart. Do not claim a physical Fold/laptop consequence from a hosted health check.

**PROMOTE — device owner acceptance and rollback readiness.** Require actual Fold and laptop execution, interrupted-network recovery, endpoint receipt and owner acceptance. Require new phase-specific, independently pinned owner signature. Before disabling the old branch, run a fork-aware lineage comparison and quiesce writer ingress using an independent infrastructure gate. Do not simply route old writers back in service after the shared fence epoch advances. If lineage is divergent, status remains HOLD pending explicit accept/reconcile or restore decision.

**FAILURE — never invent exactly-once.** An unacknowledged HTTP response may accompany a committed DB operation. If state and fence checkpoints differ, stop writer admission, preserve both independent PostgreSQL snapshots and signed receipt chains, quarantine unknown work, and investigate before choosing `ACCEPT_AND_RECONCILE`, `RESTORE_WITH_QUARANTINE` or `HOLD`. Never simply bump the checkpoint or roll back blindly. The CP-C15 failure-recovery proof used disposable data only.

## CP-C16 code gate boundaries

The `promotion-gate.mjs` is an offline **read-only evaluator**. It has **no** networking, Render writes, deployment actions, DB mutations, credential extraction or signing operations. It validates a supplied provider observation and independently pinned owner-signature ticket to return only `HOLD` or `READY_FOR_OWNER_REVIEW`; it **never** issues `APPROVED_TO_DEPLOY`. An externally refreshed provider attestation and human approval are still needed, because a JSON observation can be forged. The synthetic positive tests contain disposable test keys and *do not* grant actual authority. `observed-real-inventory.json` is a time-bounded record, not a live source of truth.

## Promotion HOLD at checkpoint

1. No dedicated Cloud Contact state PostgreSQL in Render.
2. No separately authorised shared-fence PostgreSQL in Render.
3. No persistent owner-managed signing/HMAC custody, owner trust pin or historical key-era reconciliation recorded.
4. No approved monthly cost ceiling, resource provisioning or real release approval ticket.
5. Live deployment still has old non-fenced source; no approved staging/rollback exercise on Render.
6. No authorised real hosted signed probe, nor Samsung↔laptop physical acceptance.

**Recover before rebuild. Integration ≠ replacement. No Ding beyond the actual verified boundary.**
