# JM MARKET ECOSYSTEM LAB — v1.13 Prospective Checkpoint

Saved: 2026-09-25

## Standing state

- Live hosted branch: `hosted-v0.5-descendant`
- Live prospective commit before this checkpoint: `24dc684868e1da2dc392ccef22dd71e86870b653`
- Capital deployed: £0
- Boundary: **LAB DING != MONEY DING**

## Discovery lineage preserved

The active historical screen contains 7 FRED series and 42 ordered pairs.

The only current non-zero mismatched-clock discovery survivor remains:

- source: VIXCLS
- target: DGS10
- lag: 8 aligned bars
- observed clock: 192 hours / MID under the current daily-alignment body
- direction: same
- discovery window: 2021-09-25 → 2026-09-25
- paper-survival candidate: false

## Stress and null state

Post-selection stress showed the 8-bar candidate is regime-sensitive rather than universal.

- forward perturbation grid: 4/27 non-zero survivals
- all four forward survivors landed at 8 bars
- rolling 2-year regimes: 0/7 non-zero mismatch survivals
- small circular-shift placebo set: 3/8 non-zero mismatch survivals

Whole-search Null Field:

- real screen: 1 mismatched-clock survivor among 42 ordered pairs
- broken-calendar family null: 8/8 null screens produced at least as many mismatched survivors as the real screen
- mean null mismatched survivors: 10.5
- median: 10
- p95: 14
- max: 14

Lag-identity rarity:

- 256/256 target-shift placebos completed
- generic non-zero mismatch: 79/256 = 30.859375%
- exact 8-bar mismatch: 4/256 = 1.5625%
- add-one exact-lag null frequency: 5/257 ≈ 1.9455%
- within ±2 bars of 8: 21/256 = 8.203125%
- exact-lag / generic-mismatch ratio ≈ 0.05063

Interpretation: generic non-zero lag survival is common under the current shift-null machinery; exact 8-bar recurrence is much rarer and remains a bounded research anomaly.

## Frozen independent historical confirmation

Rule frozen before each older window:

- VIXCLS → DGS10
- lag 8
- direction same
- VIX threshold |2%|
- no lag selection inside confirmation windows

Windows:

1. 2006-09-25 → 2011-09-24: split-survived
2. 2011-09-25 → 2016-09-24: did not split-survive
3. 2016-09-25 → 2021-09-24: split-survived

Result:

- contact complete: 3/3
- split survival: 2/3
- all-window survival: false

Keeper: **RECOVER CONTACT; DO NOT MOVE THE RULE.**

## Prospective Rule 001

Frozen on 2026-09-25 before post-anchor observations.

- evidence start: 2026-09-26
- source: FRED VIXCLS
- source transform: pct_return
- threshold: |2%|
- target: FRED DGS10
- target transform: delta_bps
- lag: 8 aligned bars
- direction: same
- minimum resolved signals: 20
- promotion gate: whole association mean > 0 AND first chronological half > 0 AND second chronological half > 0
- selection after freeze: prohibited

Current runtime state at save:

- latest aligned source/target date: 2026-09-22
- post-anchor bars: 0
- signals: 0
- resolved signals: 0
- pending signals: 0
- status: WAITING_FOR_POST_ANCHOR_DATA
- promotion candidate: false

Keeper: **FREEZE TODAY; LET TOMORROW ANSWER.**

## Forward route

Do not squeeze Prospective Rule 001 using pre-anchor data or move its rule.

Next active research lane: expand measurable coverage across the 32-edge market ECOSTATE while preserving cadence, provenance, release-time and false-discovery boundaries.
