# CP09 — JM Cloud Contact v5 Hardening Descendant
Status: **REVIEW HOLD — NOT MERGED — NOT DEPLOYED**.

## Identity and ancestry
- Frozen original: `JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs` in `hosted-v0.5-descendant`, Git blob `b124208d7df87b10c349c7cac42f8faaf58a9d9a`.
- New isolated candidate: `JM_CLOUD_CONTACT_SERVER_v0_5_2_SECURITY_CANDIDATE.mjs`.
- Historical CP08 was based on **v0.4.2** and remains a separately preserved validated ancestor, not promoted over v0.5.1.
- Frozen v0.5.0 Profile Mounts exact `JM_CLOUD_CONTACT_SERVER_v0_5_PROFILE_MOUNTS.mjs` is a distinct source authority; canonical original still needs direct byte recovery and comparison.

## Change scope
- Production explicit canonical HTTPS CORS origins; reject wildcard and dynamic Host-derived `self` trust.
- Reject malformed/opaque origins and omit disallowed Access-Control-Allow-Origin.
- Use fixed-length SHA-256 digests for token equality, never append direct string equality; input hashing remains length dependent, so microtiming perfection not claimed.
- V5 route, ECDSA signing, revocable/rejoin authorities, game, service mesh, market, zezu and all original v4/v3 route identities retained.

## Evidence
- GitHub Actions separately executes frozen v0.5.1 baseline `npm test`, original-derived v5 candidate integration QA, production adversarial tests, and later isolated Docker packaging/smoke tests.
- No external AI account, shared database, physical device or production endpoints are modified by any test.
- `CP09/Dockerfile` and `CP09/render.stage.proposal.yaml` are **proposal-only**, with separate stage identity/secret/data and `autoDeploy:false`.
- The root `render.yaml`, original `deploy/Dockerfile`, original source file and existing Render service remain untouched.

## Release holds
1. Confirm actual Render workspace/service and current ingress configuration with owner-selected workspace; do not select it silently.
2. Recover exact original frozen v0.5.0 software source and compare profile contracts.
3. Verify staged Docker startup and isolated persistence with the owner-approved Render topology and separate storage.
4. Authorised promotion needs rollback, observational canary, secrets isolation and explicit scoped Ding.

**SERVER FIRST. ROUTES MANY. NO DING, NO CLAIM.**
