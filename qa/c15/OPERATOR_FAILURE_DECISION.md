# CP-C15 operational HOLD/RECOVERY decision

In a real deployment, if `/ready` fails with `JM_FENCE_UNCERTAIN_COMMIT`, place *all writer-facing ingress* in HOLD. Neither updating the fence watermark to match the state database nor reverting the state automatically is permitted; both could erase a response-lost mutation or certify an unverified command.

1. Preserve immutable copies of both PostgreSQL state and fence records, including revision, checksum, writer epoch, signed event journal and request identifiers; preserve separately old owner signing key identities.
2. Disable new writer admission with an independently enforced infrastructure gate. A `ready: true` health probe is insufficient.
3. Investigate whether the state revision represented a completed but unacknowledged request. Use the original signed local runner receipt, request ID and signer-pinned host journal; an HTTPS 200 or DB row by itself is not endpoint proof.
4. Choose an explicit owner-authorised custody decision: `ACCEPT+RECONCILE` with new independently verified fence checkpoint; `RESTORE` to a known-good snapshot, with potential unacknowledged work quarantined for review; or `HOLD` for escalation. This CP-C15 test demonstrates **RESTORE in disposable CI only**. It does not implement production reconciliation or assume no loss.
5. Rehearse the same recovery with independent signing identity, HMAC authority and dedicated backups before deployment. Repeat a signed real runner probe and validate durable state/fence equality after restart.

No production database exists in the current inventory. Existing `jm-market-survivor-state` is not a Cloud Contact store. No billing or secret change is authorised here.
