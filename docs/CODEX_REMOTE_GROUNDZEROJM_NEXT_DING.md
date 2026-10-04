# JM ECOSTATE — GroundZeroJM Codex Remote Next Ding

**Date:** 4 October 2026  
**Operation gate:** `JMOP-070f1186f1b59e4c9a084842`  
**Recipient:** `GroundZeroJM`  
**State:** OPEN / PREPARED / NOT BORROWED

## Recover before rebuild

Do **not** continue Gloveback, Goose Fair, or any other gameplay branch in this run.

This recipient-specific proof uses the already-deployed public JM Service Mesh and does not require OneDrive, local game source, deployment, administrator credentials, or server configuration changes.

Target service:

`https://jm-cloud-contact-server-v05.onrender.com`

Existing body:

`JM Service Mesh v0.2` inside `JM CLOUD CONTACT SERVER v0.5.1-hosted`.

## Exact route

`GroundZeroJM Codex Remote → /ready → Authuser registration → bounded pipeline → GEM → CLAIM → PUBLIC OUTPUT → cloud-space close → mesh receipt verify → canonical cloud-receipt hash verify → ECDSA P-256 verify → pipeline readback → return result to initiating chat`

Run:

```powershell
$env:JM_CODEX_HOST_LABEL="GroundZeroJM"
node .\scripts\jm-codex-remote-next-ding.mjs
```

or:

```bash
JM_CODEX_HOST_LABEL="GroundZeroJM" node scripts/jm-codex-remote-next-ding.mjs
```

## Crown gate

The local process may only return `DING_CANDIDATE_RETURN_REQUIRED`.

Final DING is earned only when its generated receipt is visibly returned through the actual GroundZeroJM Codex Remote session to the initiating user surface.

**NO DING, NO CLAIM · CONTACT BEFORE CROWN · RECIPIENT A DING ≠ RECIPIENT B DING · MESH ≠ MERGE**
