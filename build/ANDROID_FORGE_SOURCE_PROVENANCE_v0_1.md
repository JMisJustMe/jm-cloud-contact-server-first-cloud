# JM Android Build Cloud — Source Provenance v0.1

## Authoritative donor

Library source carrier: `JM_ANDROID_FORGE_DUAL_SURFACE_v1_4_1.html`

Recovered source-carrier SHA-256:

`6a3054a6c9f9bbcfaf51f4ecd95307964b56d916a7448857ec571da09dc6efa9`

### JMForgeCore

Exact donor body mounted as:

`build/native/android/JM_FORGE_CORE_DONOR_v1_4_1.js`

- donor bytes: 10,843
- donor SHA-256: `f474c8b6c37291ef0d31acf2725a1edbe1498c5c1da3d77a1c3281ec2b4fed96`
- donor role: Android Cading parser/compiler → `jm.onebody.android/v1`

This donor is mounted without semantic rewrite.

### JMPhoneForge

Recovered donor SHA-256 before custody transformation:

`5189544f2a3a1b200a889c769cbef37f21978edef80af170cd72ef4a909bfd78`

The raw donor was **not** retained in this public repository because the original browser carrier embeds a debug private signing key.

Cloud-safe descendant:

`build/native/android/JM_PHONE_FORGE_CLOUD_SAFE_v1_4_1.js`

Only signing-custody constants are externalized and a fail-closed missing-signing-material gate is added. The carrier mutation, DEX repair, ZIP alignment and APK Signature Scheme v2 algorithm remain inherited.

## Custody rule

Signing material is injected at runtime. No recovered private signing key is committed to this repository.

QA may generate a disposable test identity during the test run. A QA identity is not a release identity.

## Claim boundary

This route proves a JM Android application APK carrier:

`Cading → JMForgeCore OneBody → fixed carrier mutation → DEX repair → ZIP alignment → APK v2 signing → artifact/receipt`

It does **not** claim:

- recovered v1.4 local-JMGradle host server bytes;
- AOSP system-image construction;
- production/release signing;
- physical-device install/launch;
- replacement of Android/AOSP itself.
