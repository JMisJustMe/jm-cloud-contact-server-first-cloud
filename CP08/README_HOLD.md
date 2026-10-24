# JM ECOSTATE — Cloud Contact CP08 security descendant

**HOLD / REVIEW ONLY** — NOT DEPLOYED — DO NOT MERGE INTO FROZEN `main`.

## Source inheritance

- Original `JM_CLOUD_CONTACT_SERVER_v0_4_2.mjs` is unchanged; original Git blob: `a99adcd0ce350b8bf88e9314eec4a9170060195f`.
- Original `render.yaml` is unchanged; blob: `df93600c8d94a0fcbd8ff9dc9b58f673bc263352`.
- `JM_CLOUD_CONTACT_SERVER_v0_4_3_HARDENING_CANDIDATE.mjs` must match output of CP07's exact-source guarded generator, not merely a visually similar patch.
- `render.candidate.yaml` is a **configuration proposal**: production origin is explicit HTTPS. It does **not** point Docker/Node to the candidate file, and is **NOT a deployable upgrade manifest** on its own.
- Historical v0.5 Profile Mounts source remains an independently protected descendant; compatibility needs direct source recovery and retesting.

## Test

On an isolated Node 22 runner:

```sh
node --check JM_CLOUD_CONTACT_SERVER_v0_4_2.mjs
node --check CP08/JM_CLOUD_CONTACT_SERVER_v0_4_3_HARDENING_CANDIDATE.mjs
node --test CP08/security_regression.test.mjs
```

This runs a real loopback HTTP server using mock credentials and a temporary data directory. Exercises startup rejection, console/meta/health, hostile Host/Origin, bearer authentication, space creation, event deduplication, command ack/result, receipt, credential revoke, persisted restart. No external endpoint, Render deployment, or real credentials contacted.

## Explicit HOLD gates

1. Independently confirm v0.5 code and decide the correct successor base. **Never downgrade a newer authority to v0.4.3.**
2. Confirm Render's actual host-proxy/custom-domain topology. Hardcoded candidate origin is a proposal derived from historical receipt.
3. Prepare deployment wiring (Dockerfile/start command), rollback and canary separately, only with explicit owner approval.
4. Physical owner-device access and actual cross-provider Gemini/ChatGPT autonomous contact are outside these security tests.

**No Ding, no claim. Recover before rebuild. Contact before crown.**
