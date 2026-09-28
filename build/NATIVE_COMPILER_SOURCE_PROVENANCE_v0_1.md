# JM Build Cell v0.1 — Exact Compiler Source Provenance

Mounted from `JMisJustMe/JM-cading-lab` sovereign Batch Five. These are copied source carriers, not rewritten equivalents.

| Mounted carrier | Donor path | Donor blob |
|---|---|---|
| `build/native/native-core.mjs` | `coding-estate/sovereign-batch-five/direct/native-core.mjs` | `b33045c45ca61bdc6010645776fbf7b319dfab33` |
| `build/native/compiler-lab-native.mjs` | `coding-estate/sovereign-batch-five/direct/compiler-lab-native.mjs` | `d4a75db6d861dde5b46c44632993c3770783c4b7` |
| `build/native/native-corpus.mjs` | `coding-estate/sovereign-batch-five/direct/native-corpus.mjs` | `49a4072d479fb9aed9cffc510cc1bc7f6d25d1a3` |

## v0.1 route

`Parser -> Compiler -> OneBody IR -> JS Emitter -> compileCading API`

The Build Cell callback supplied to `CompileCadingAPI` is not a foreign compiler service. It is a bounded adapter that invokes the exact mounted `Parser`, `Compiler` and `JSEmitter` bodies from the same donor module.

## Deliberate HOLD

`jmgradle-android` is named but not registered as a runnable Build Cell engine at v0.1. The Estate proves JMGradle/JM Android Forge build lineage, but the exact standalone scheduler carrier has not yet been recovered into this repository. RECOVER BEFORE REBUILD applies.
