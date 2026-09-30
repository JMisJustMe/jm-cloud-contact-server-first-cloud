# JM AOSP Bridge v0.7

**Project:** JM Android-derived OS  
**State:** real Android 17 source contact + JM product-layer contact proven; heavy compile/boot still gated by carrier.

## Route

```text
AOSP android-latest-release
  -> live manifest pin (currently android17-release)
  -> OS_CODING
  -> OneBody IR
  -> TheoC
  -> Repo sync (partial clone + blob limit)
  -> stage device/jm/cuttlefish
  -> lunch jm_cf_x86_64_phone-aosp_current-userdebug
  -> Soong/Ninja m
  -> built JM product marker
  -> Cuttlefish
  -> sys.boot_completed + fingerprint + live JM product marker
  -> bounded JM build/boot Dings
```

## Sovereignty boundary

**MESH != MERGE.**

JM owns/governs:
- OS_CODING / OneBody IR / TheoC control route;
- product definition under `device/jm/cuttlefish`;
- product identity/provenance marker;
- host preflight;
- build/boot evidence gates;
- JM receipts and claim boundary.

Declared carriers/upstream:
- AOSP source/platform;
- Repo / Soong / Ninja / AOSP prebuilts;
- Linux build host;
- Cuttlefish/KVM boot host;
- ADB contact tool.

The JM product inherits the verified Android 17 base:

```text
device/google/cuttlefish/vsoc_x86_64_only/phone/aosp_cf.mk
```

The upstream base is not overwritten. Real source contact proved it stayed byte-identical while the JM layer was staged separately at:

```text
device/jm/cuttlefish/
```

## Product

```text
PRODUCT_NAME = jm_cf_x86_64_phone
lunch target = jm_cf_x86_64_phone-aosp_current-userdebug
marker = /product/etc/jm-os-release.txt
```

A generic AOSP image cannot earn a JM build Ding. The build output must return the JM marker.

A merely booted Android cannot earn a JM boot Ding. The running `/product` partition must return the same marker.

## Current earned contacts

- `AOSP_SOURCE_MANIFEST_CONTACT`
- `AOSP_TARGETED_SOURCE_CONTACT`
- `AOSP_BUILD_BOOT_SOURCE_ANATOMY_CONTACT`
- `JM_AOSP_PRODUCT_LAYER_REAL_SOURCE_CONTACT`

Not yet earned:
- full Repo sync;
- `JM_AOSP_PRODUCT_BUILD`;
- system/super image Ding;
- `JM_AOSP_PRODUCT_BOOT`;
- CTS / physical-device / production-release proof.

## Heavy host gate

Current AOSP baseline encoded by the bridge:
- 64-bit x86 Linux;
- >= 400 GB free disk;
- >= 64 GB RAM;
- glibc >= 2.17;
- Repo >= 2.4;
- Node for the current JM control body.

The measured standard GitHub hosted runner returned:
- 85.95 GB free disk;
- 15.61 GB RAM;
- glibc 2.39;
- no Repo installed.

So it is deliberately held before full sync/build.

## Preflight

```bash
node os/aosp-bridge/run-jm-aosp-contact.mjs
```

## Heavy build host bootstrap

On a qualifying Debian/Ubuntu-class build carrier:

```bash
bash os/aosp-bridge/bootstrap-heavy-build-host.sh preflight
```

Then:

```bash
bash os/aosp-bridge/bootstrap-heavy-build-host.sh --execute-build
```

Compile and boot are intentionally separable. A compile carrier does not need to prove Cuttlefish/KVM boot capability.

For a carrier that already holds the synced tree + build output:

```bash
node os/aosp-bridge/run-jm-aosp-contact.mjs --execute-boot
```

The full combined route remains:

```bash
node os/aosp-bridge/run-jm-aosp-contact.mjs --execute
```

## Proof

```bash
node os/aosp-bridge/selftest.mjs
```

Current v0.7 bridge/product battery: **22/22 PASS** at logic/staging scope.

**NO DING, NO CLAIM:** source contact, staging, compilation, image inclusion and boot remain separate earned states.
