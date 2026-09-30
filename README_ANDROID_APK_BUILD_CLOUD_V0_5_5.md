# JM CLOUD CONTACT SERVER v0.5.5 — Android APK Build Cloud

**SERVER FIRST. ROUTES MANY.**  
**RECOVER BEFORE REBUILD.**  
**NO DING, NO CLAIM.**

## Lineage

`v0.5.0 Profile Mounts -> v0.5.1-hosted -> v0.5.2 Compute Cell -> v0.5.3 VM Compute -> v0.5.4 Build Cloud -> v0.5.5 Android APK Build Cloud`

This descendant advances **JM Build Cell v0.2** while preserving the proved JavaScript compiler route and the three-engine Compute Cell.

## Two registered JM build engines

### 1. `compilecading-native`

Inherited from v0.5.4:

`Parser -> Compiler -> OneBody IR -> JS Emitter -> compileCading API`

Target: `javascript`.

### 2. `android-apk-native`

Recovered from the current JM Android Forge source lineage:

`Cading -> JMForgeCore -> jm.onebody.android/v1 -> JMPhoneForge -> DEX repair -> ZIP alignment -> APK v2 signing -> APK artifact`

Target: `android-apk`.

The Android source authority is the recovered **JM Android Forge v1.4.1 Dual-Surface Workshop** source carrier.

- `JMForgeCore` is mounted as the exact Android Cading/OneBody compiler body.
- `JMPhoneForge` preserves the recovered APK mutation, DEX repair, ZIP alignment and APK Signature Scheme v2 route.
- signing identity is supplied at runtime rather than embedded in the public cloud source.

Exact provenance and the custody transformation are recorded in `build/ANDROID_FORGE_SOURCE_PROVENANCE_v0_1.md`.

## Android artifact route

A successful Android build produces:

1. source-gated `jm.onebody.android/v1`;
2. emitted package identity and source provenance;
3. DEX package-identity repair;
4. four-byte ZIP alignment verification;
5. APK Signature Scheme v2 signature and in-forge signature verification;
6. APK SHA-256;
7. content-addressed binary `.apk` artifact;
8. authenticated APK download route;
9. Build Cell receipt;
10. closed JM Cloud job receipt.

The QA then reopens the emitted APK and recovers the authored Cading source, HTML body and OneBody payload from the package.

## Signing custody

The recovered browser donor contained an old debug private key. That raw donor was **not** retained in the clean v0.5.5 branch lineage.

The cloud descendant externalizes signing identity. QA creates an ephemeral identity during the test run; production/release signing remains a separately owned secret/custody gate.

A debug/QA signing identity is not a release identity.

## What changed about JMGradle

Earlier Build Cloud held all Android/JMGradle work because the standalone scheduler carrier had not been mounted.

Recovery showed a more precise shape:

- the historical **local JMGradle host server** behind `/api/build` remains unrecovered;
- the same v1.4.1 workshop contains a self-hosted JM browser APK engine, `JMPhoneForge`, plus `JMForgeCore`;
- those recovered bodies are sufficient to earn the current bounded **static application APK cloud-build** route without inventing the missing local-host implementation.

Therefore:

- `android-apk-native` = **EARNED at repository/CI static APK scope**;
- `jmgradle-local-host` = **HOLD / recover exact host carrier**;
- `aosp-system-image` = **HOLD / next OS-production frontier**.

## Proof

Clean branch head:

`3e4f415da3ada464fe57c6841aa90466e1bb77bb`

GitHub Actions:
- run `36678547470`
- job `109768759986`
- result **SUCCESS**

The full suite includes Android APK Build Cell, the JavaScript build route, RouteCore Native, CadenVM, JMVM, hosted server/static compatibility, Phone↔Laptop profile, game, service mesh, service-mesh pipeline and Market Lab.

## Claim boundary

**Earned:** JM-governed static Android application APK build service using recovered JM Android Forge bodies, with binary artifact hashing/download and linked build/cloud proof.

**Still open:** historical local-JMGradle host recovery, AOSP/system-image production, production/release signing, physical-device install/launch, public v0.5.5 hosting, and owned physical datacentre/hardware independence.
