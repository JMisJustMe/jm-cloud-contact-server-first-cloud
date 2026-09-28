# JM Compute Cell v0.2 — VM Native Source Provenance

Mounted from the existing JM Coding Estate, sovereign Batch Two. These files are copied source carriers, not reconstructed equivalents.

| Mounted file | Donor path | Donor blob |
|---|---|---|
| `native-core.mjs` | `coding-estate/sovereign-batch-two/direct/native-core.mjs` | `c9dc5d8c027b20f280c28c8ef9ef925d0bf91112` |
| `kading-jmp-native.mjs` | `coding-estate/sovereign-batch-two/direct/kading-jmp-native.mjs` | `ca9da0ef949fc34d9ebcd0b1f1d2553321a6ee10` |
| `codifying-kocodifying-native.mjs` | `coding-estate/sovereign-batch-two/direct/codifying-kocodifying-native.mjs` | `bc82c44ce56ec48c6fa09e42a57529b1b91c47dc` |
| `formeula-native.mjs` | `coding-estate/sovereign-batch-two/direct/formeula-native.mjs` | `3357a5196885c11be974ed35c2bbfb4ad643e16e` |
| `language-shape-native.mjs` | `coding-estate/sovereign-batch-two/direct/language-shape-native.mjs` | `fb9a2d52ac1cb4608a2d16096e2609c64c4428bb` |
| `root-caden-native.mjs` | `coding-estate/sovereign-batch-two/direct/root-caden-native.mjs` | `4aa32b0219db177a81df6db973ef0918b02d523b` |
| `prime-jmvm-native.mjs` | `coding-estate/sovereign-batch-two/direct/prime-jmvm-native.mjs` | `0d33ea3ca9300034ce719a5087b12ad1c54990d5` |

## Compute Cell v0.2 mounts

- `CadenVM` from `root-caden-native.mjs`
- `JMVM` from `prime-jmvm-native.mjs`

CadenVM retains its exact Kading dependency chain rather than replacing the donor import structure with a cloud-specific rewrite.

## Authority boundary

Compute Cell passes no external service callbacks into either VM at v0.2. Pure state/bytecode execution is allowed. A source body requiring an undeclared host service must fail closed and receive a failed-job trace/receipt rather than silently obtaining host authority.
