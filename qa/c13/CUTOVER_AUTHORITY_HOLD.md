# CP-C13 production authority — HOLD

- The actual Render Cloud Contact v0.5 service remains on the older deployed branch `hosted-v0.5-descendant` (16 October commit `0921217d95285bcb21cda7a995d02f7ec0725810` at latest connected inventory); this branch is not deployed.
- Only one PostgreSQL instance was visible in the current Render account: **JM Market** (`jm-market-survivor-state`). Never reuse it for Cloud Contact without separate verified owner authority; it is not assumed to carry the Contact schema.
- No dedicated production Cloud Contact PostgreSQL provisioned, paid for, funded or backed up. No production signing private key custody independently approved. Historical observed public signing-key epochs were drifting.
- The CP-C13 deliberately induced branch fork demonstrates that both source and target can accept writes without a real production writer fence. The policy rejects unsafe rollback rather than rewinding a stale source, but a full live owner-authorised writer-quiescence mechanism is still **not implemented**.
- A third disposable database recipient can inherit the signed target chain, but this is not proof of owner-approved continuity for the deployed Render carrier, live backup retention or zero-data-loss failover.
- No real external signed Cloud Contact probe, production secret use, IAM/service update, PR merge, browser/device execution or cost authorisation.

**Remaining externally earned steps:** owner approves bounded spending and dedicated storage; trusted stable signer in protected private store; prepare read-only backup; ensure source writer fencing and pending command draining, exact rollback/forward strategy; perform rehearsed isolated recipient canary and one independently verified live probe; explicitly accept before traffic cutover.

**No Ding, no claim. Integration ≠ replacement. Recover before rebuild.**
