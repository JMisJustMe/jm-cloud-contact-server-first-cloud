# JM CLOUD CONTACT SERVER v0.5.4 — Build Cloud Descendant

**SERVER FIRST. ROUTES MANY.**  
**RECOVER BEFORE REBUILD.**  
**NO DING, NO CLAIM.**

## Lineage

`v0.5.0 Profile Mounts -> v0.5.1-hosted -> v0.5.2 Compute Cell -> v0.5.3 VM Compute -> v0.5.4 Build Cloud`

This descendant adds **JM Build Cell v0.1** without modifying the proven Compute Cell engine family.

## First build engine

`compilecading-native`

Exact mounted JM bodies:

`Parser -> Compiler -> OneBody IR -> JS Emitter -> compileCading API`

The source carriers are copied from sovereign Batch Five with donor blob SHAs recorded in `build/NATIVE_COMPILER_SOURCE_PROVENANCE_v0_1.md`.

The callback supplied to `compileCading API` is a bounded adapter around those same mounted JM bodies. It is not Node/npm/another compiler silently acting as the source compiler.

## Build route

`SOURCE -> PARSER -> COMPILER -> ONEBODY IR -> JS EMITTER -> compileCading API -> ARTIFACT -> CLOUD TRACE -> RECEIPT`

A successful build creates:
- Parser receipt;
- Compiler receipt;
- identity-preserving OneBody IR;
- JS Emitter receipt;
- compileCading API receipt;
- SHA-256 content-addressed build artifact;
- JM Build receipt;
- closed/signed JM Cloud job receipt.

## Current policy

Allowed:
- exact `compilecading-native` engine;
- `javascript` target.

Denied:
- arbitrary shell;
- arbitrary process execution;
- unregistered build engines;
- undeclared targets.

## JMGradle boundary

The Estate contains proven JMGradle / JM Android Forge lineage and prior real Android package receipts. But this repository does not yet contain the exact standalone JMGradle scheduler carrier required to register `jmgradle-android` as a Build Cell engine.

Therefore:

`jmgradle-android = HOLD / RECOVER EXACT CARRIER BEFORE MOUNT`

No reconstructed scheduler is substituted.

## Cloud shape now

JM Cloud now has separate organs for:
- identity/capability/contact/receipts — JM Cloud Contact Server;
- runtime compute — RouteCore Native / CadenVM / JMVM;
- source compilation/build artifacts — JM Build Cell / Batch Five compiler route.

Public production hosting of this descendant remains separately gated.
