# JM CLOUD CONTACT SERVER v0.5.3 — VM Compute Descendant

**SERVER FIRST. ROUTES MANY.**  
**NO DING, NO CLAIM.**

## Lineage

`frozen v0.5.0 Profile Mounts -> v0.5.1-hosted -> v0.5.2-compute-cell -> v0.5.3-vm-compute`

The earlier carriers remain preserved. This descendant mounts **JM Compute Cell v0.2** into a new server carrier: `JM_CLOUD_CONTACT_SERVER_v0_5_3_VM_COMPUTE.mjs`.

## Compute engines

Registered JM engines:

- `routecore-native` — RouteCore Native
- `cadenvm-native` — CadenVM
- `jmvm-native` — JMVM

The CadenVM/JMVM source family is mounted exactly from the existing sovereign Batch Two source. Provenance is recorded in `compute/NATIVE_VM_SOURCE_PROVENANCE_v0_2.md`.

## Execution route

`SOURCE -> CELL POLICY -> REGISTERED JM ENGINE -> ARTIFACT -> CLOUD TRACE -> RECEIPT`

All three engines use the same cloud-job discipline:

1. authorized cell/job request;
2. fresh JM Cloud `/v5` job space;
3. bounded ephemeral executor identity;
4. queued trace;
5. selected JM engine executes;
6. native receipt returned;
7. successful result written as SHA-256 content-addressed artifact;
8. completion/failure traced;
9. cloud job space closed;
10. signed cloud receipt retrieved;
11. Compute Cell receipt links source/artifact/native/cloud evidence.

## Service boundary

At v0.2, CadenVM and JMVM are invoked with **no external callback service table**.

That means pure native VM state/bytecode execution is permitted, while a source program that tries to call an undeclared host service fails closed. Compute Cell records the failure and still closes/receipts the cloud job.

This is intentional: **JM VM execution != arbitrary Node/process authority.**

## Compatibility

The Compute Cell HTTP surface remains under `/compute/v1` because the API contract is additive; Compute Cell body version is `0.2`. Existing RouteCore jobs remain supported.

## Claim boundary

This descendant may earn:
- governed RouteCore Native cloud compute;
- governed CadenVM cloud compute;
- governed JMVM cloud compute;
- linked native/artifact/compute/cloud receipts.

It does **not** by itself claim:
- arbitrary shell/process execution;
- containers or general-purpose virtual machines;
- kernel execution;
- JMGradle / Android production build execution;
- public production hosting of v0.5.3;
- physical datacentre/infrastructure independence.
