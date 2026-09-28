# JM COMPUTE CELL v0.2 / JM CLOUD v0.5.3 — VM COMPUTE BUILD RECEIPT

**Date:** 28 September 2026  
**State:** THREE-ENGINE BUILD + FULL JM CLOUD SUITE PASS · PUBLIC HOST DING NOT CLAIMED  
**Branch:** `jm-compute-cell-v0.2-vms`  
**Parent:** `jm-compute-cell-v0.1`

## Lineage

`v0.5.0 Profile Mounts -> v0.5.1-hosted -> v0.5.2 Compute Cell -> v0.5.3 VM Compute`

## Earned compute engines

- `routecore-native` — RouteCore Native
- `cadenvm-native` — CadenVM
- `jmvm-native` — JMVM

## Governing route

`SOURCE -> CELL POLICY -> REGISTERED JM ENGINE -> ARTIFACT -> CLOUD TRACE -> RECEIPT`

All three engines are governed through fresh JM Cloud `/v5` job spaces and linked native/artifact/compute/cloud evidence.

## Source authority

CadenVM/JMVM and their required native dependency chain are mounted exactly from the existing JM Coding Estate sovereign Batch Two sources. Donor blob hashes are preserved in `compute/NATIVE_VM_SOURCE_PROVENANCE_v0_2.md`.

## Authority boundary

Compute Cell v0.2 supplies no external callback service table to CadenVM or JMVM.

Observed policy:
- pure registered JM VM execution: allowed;
- arbitrary shell: denied;
- arbitrary filesystem execution: denied;
- unregistered engine: denied;
- undeclared host-service callback: fails closed.

The failed-service path still closes its JM Cloud job space and emits a failed-job receipt.

## Proof

### Isolated three-engine gate
- workflow: `JM Compute Cell v0.2 VMs`
- head: `2d76a6e53bbf70a76acb1d0dcb8e32be603af791`
- run: `36372691853`
- result: **SUCCESS**

### Full JM Cloud integration gate
- server: `JM_CLOUD_CONTACT_SERVER_v0_5_3_VM_COMPUTE.mjs`
- head: `de6ba1b961b6fa44f78456b394761876231b515c`
- run: `36372783583`
- job: `108772371124`
- result: **SUCCESS**

Subsequent contract head `f228debcb46204066b3f9ca66583996ecb900882` also passed the full branch workflow.

## Observed execution

- RouteCore Native: state transition executed and artifact returned.
- CadenVM: Kading source compiled to Caden bytecode, executed, native CadenVM receipt returned, state consequence preserved in artifact.
- JMVM: JMVM source lowered/executed, required Ding returned, native JMVM receipt preserved in artifact.
- Host-service escape probe: rejected as unknown JMVM service; no callback authority silently granted.

## Claim boundary

**Earned now:** repository/CI proof of governed three-engine JM cloud compute using existing JM runtime bodies.

**Not claimed:**
- public hosted v0.5.3 Ding;
- arbitrary container/general VM infrastructure;
- kernel compute;
- compile/build farm;
- JMGradle Android production build jobs;
- physical hardware/datacentre independence.

**NO DING, NO CLAIM.**
