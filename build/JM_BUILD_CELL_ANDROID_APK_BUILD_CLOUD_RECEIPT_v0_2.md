# JM BUILD CELL v0.2 / JM CLOUD v0.5.5 — ANDROID APK BUILD CLOUD RECEIPT

**Date:** 30 September 2026  
**State:** ANDROID APK BUILD ENGINE + FULL JM CLOUD SUITE PASS · CLEAN LINEAGE · OS/SYSTEM-IMAGE GATE OPEN  
**Branch:** `jm-build-cell-v0.2-android-apk-clean`  
**Parent:** `jm-build-cell-v0.1`  
**Clean proof head:** `3e4f415da3ada464fe57c6841aa90466e1bb77bb`

## Recovered Android source authority

Authority carrier: `JM_ANDROID_FORGE_DUAL_SURFACE_v1_4_1.html`

Carrier SHA-256:

`6a3054a6c9f9bbcfaf51f4ecd95307964b56d916a7448857ec571da09dc6efa9`

### JMForgeCore

Mounted donor:

`build/native/android/JM_FORGE_CORE_DONOR_v1_4_1.js`

Donor SHA-256:

`f474c8b6c37291ef0d31acf2725a1edbe1498c5c1da3d77a1c3281ec2b4fed96`

Role:

`Cading -> jm.onebody.android/v1`

### JMPhoneForge

Recovered donor SHA-256 before signing-custody transformation:

`5189544f2a3a1b200a889c769cbef37f21978edef80af170cd72ef4a909bfd78`

Cloud-safe carrier:

`build/native/android/JM_PHONE_FORGE_CLOUD_SAFE_v1_4_1.js`

Inherited functions include fixed APK carrier mutation, Android package identity replacement, DEX repair, ZIP alignment, APK Signature Scheme v2 construction and in-forge signature verification.

## Security / custody correction

The recovered browser donor carried a historical debug private key. A development branch briefly mounted the raw donor and then deleted it; that development history is **not** the promotion lineage.

The final v0.5.5 branch was replayed cleanly from `jm-build-cell-v0.1` using only the cloud-safe descendant. The raw recovered private key is absent from this branch ancestry.

Signing is runtime-injected. QA uses a newly generated ephemeral identity. Production release identity remains HOLD.

## Earned Android route

`CADING -> JMFORGECORE -> ONEBODY ANDROID -> JMPHONEFORGE -> DEX REPAIR -> ZIP ALIGNMENT -> APK V2 SIGNING -> APK SHA-256 -> BINARY ARTIFACT -> CLOUD TRACE -> RECEIPT`

Observed proof includes:

- all fourteen Android governing bodies accepted by the source gate;
- `jm.onebody.android/v1` emitted;
- APK package carrier emitted;
- APK v2 signing completed;
- in-forge signature verification PASS;
- ZIP alignment PASS;
- APK SHA-256 used as the content-addressed artifact ID;
- authenticated APK download returned the same bytes/hash;
- emitted APK reopened;
- authored Cading source recovered from the APK;
- authored HTML body recovered from the APK;
- emitted OneBody recovered from the APK;
- arbitrary shell build engine rejected;
- signing material absent from persisted Build Cell state;
- JM Cloud build space closed with linked receipt.

## Proof

### Isolated Android Build Cell gate

Development proof:
- run `36678164369`
- job `109767595828`
- result **SUCCESS**

The final clean full-suite run executes the same isolated Android QA again before parent integration.

### Clean full JM Cloud gate

- head `3e4f415da3ada464fe57c6841aa90466e1bb77bb`
- run `36678547470`
- job `109768759986`
- result **SUCCESS**

The full suite preserves the JavaScript Build Cell route, RouteCore Native, CadenVM, JMVM, hosted cloud/static compatibility, Phone↔Laptop profile, game profile, service mesh, service-mesh pipeline and Market Lab.

## Exact remaining holds

### `jmgradle-local-host`

HOLD. The v1.4.1 workshop proves the browser calls a local host at `/api/build`, but the exact historical host-server carrier has not been recovered into this repository. No replacement is labelled as that historical body.

### `aosp-system-image`

HOLD. Application APK emission does not establish Android OS/system-image production.

### Release signing

HOLD. QA/debug signing is not production ownership/custody proof.

### Physical Android contact

HOLD. Repository CI does not prove owner-device install, launch or lived interaction.

## Claim boundary

**Earned:** bounded JM-native/JM-governed cloud production of a statically verified Android application APK using recovered JM Android Forge compiler/emitter bodies.

**Open:** local-JMGradle host recovery, AOSP/system-image build route, release-signing custody, physical device proof, public v0.5.5 hosted Ding, and hardware/datacentre independence.

**NO DING, NO CLAIM.**
