# JM COMPUTE CELL v0.1 — BUILD RECEIPT

**Date:** 28 September 2026  
**State:** BUILD + FULL HOSTED SUITE PASS · MERGE/PUBLIC HOST DING NOT YET CLAIMED  
**Branch:** `jm-compute-cell-v0.1`  
**Parent:** `hosted-v0.5-descendant`  
**Candidate proof head:** `2ee29c19123abc813a1645ecca8242686e116f47`

## Route

`SOURCE -> CELL POLICY -> JM NATIVE ENGINE -> ARTIFACT -> CLOUD TRACE -> RECEIPT`

## Mounted JM bodies

- JM CLOUD CONTACT SERVER v0.5.1-hosted — preserved parent donor.
- JM Compute Cell v0.1 — new compute governance/profile body.
- JM Native Core — exact source mount from JM-cading-lab.
- RouteCore Native — exact source mount from JM-cading-lab.

## Exact native provenance

- `compute/native/native-core.mjs`
  - donor blob: `b33045c45ca61bdc6010645776fbf7b319dfab33`
- `compute/native/runtime-composition-native.mjs`
  - donor blob: `f379af4ffd13beb55ab64434e565bd6bf1bc8dc5`

The donor source was mounted rather than reconstructed.

## Current execution authority

Allowed engine:
- `routecore-native`

Explicitly forbidden at v0.1:
- arbitrary shell execution;
- arbitrary filesystem execution;
- unregistered foreign runtime execution.

This prevents the carrier runtime from being silently relabelled as the JM compute engine.

## Job proof path

Each current job:
1. enters a declared Compute Cell;
2. opens a fresh JM Cloud `/v5` space;
3. receives an ephemeral bounded executor credential;
4. records a queued trace event;
5. executes through the mounted RouteCore Native body;
6. receives the RouteCore Native receipt;
7. writes a SHA-256 content-addressed artifact;
8. records completion or failure into JM Cloud;
9. closes the cloud space;
10. retrieves the signed underlying JM Cloud receipt;
11. emits a JM Compute receipt linking source hash, artifact hash, native receipt digest and cloud receipt hash.

Raw ephemeral executor/rejoin credentials are not persisted by Compute Cell state.

## QA

GitHub Actions workflow:
- `JM Compute Cell v0.1`
- run: `36372369911`
- job: `108771179265`
- head: `2ee29c19123abc813a1645ecca8242686e116f47`
- result: **SUCCESS**

The full suite includes the standalone Compute Cell QA and the real parent-server integration QA plus the inherited hosted cloud/game/service-mesh/market batteries.

A malformed integration fixture was caught during development: escaped newline text was passed as literal characters and RouteCore rejected it as an incomplete native body. The fixture was corrected; no RouteCore validation was weakened.

## Lineage hygiene

Final comparison against `hosted-v0.5-descendant` at the proof head:
- parent branch is the merge base;
- branch is ahead only;
- frozen v0.5.1 server source, hosted QA, contract and README were restored unchanged;
- v0.5.2 receives its own server, QA, contract and README carriers.

## Claim boundary

**Earned now:** repository-level/local CI proof that the v0.5.2 descendant can govern and execute a RouteCore Native cloud job, preserve an artifact, close the job cloud space and link its compute/native/cloud receipts while remaining compatible with the current hosted suite.

**Not yet claimed:**
- merged/current hosted production authority;
- public v0.5.2 hosted Ding;
- CadenVM or JMVM compute execution;
- general container/VM compute;
- kernel execution;
- JMGradle / Android production build execution;
- hardware/cloud-provider independence.

**Keeper:** NO DING, NO CLAIM.
