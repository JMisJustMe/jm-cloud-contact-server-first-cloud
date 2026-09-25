# JM CLOUD CONTACT SERVER v0.5.1-hosted — Hosted Descendant

**SERVER FIRST. ROUTES MANY.**

This branch is the public-hosting descendant above two preserved bodies:

- `main` keeps the v0.4.2 carrier that earned the **First Public Cloud Server Ding**.
- Frozen v0.5.0 Profile Mounts remains the software-scope parent with its original 27/27 integration QA and claim boundary.
- `hosted-v0.5-descendant` carries the deployment-specific v0.5.1-hosted descendant used to earn the next public proof without rewriting either parent.

## Deploy this descendant

[![Deploy hosted v0.5 descendant to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2FJMisJustMe%2Fjm-cloud-contact-server-first-cloud%2Ftree%2Fhosted-v0.5-descendant)

That branch-specific route reads this descendant's root `render.yaml` and proposes a **separate** Render service named:

`jm-cloud-contact-server-v05`

Do not repoint or replace the already-crowned v0.4.2 `jm-cloud-contact-server` service.

## Current route

`v0.4.2 PUBLIC DING EARNED -> frozen v0.5.0 Profile Mounts -> v0.5.1-hosted -> PUBLIC v0.5 DING -> Phone↔Laptop physical consequence`

## Hosted descendant surfaces

- `/health`
- `/ready`
- `/meta`
- `/receipt-key`
- `/profiles`
- `/profiles/phone-laptop/control`
- `/profiles/phone-laptop/runner`
- current API `/v5`, compatibility `/v4` + `/v3`

The mounted Phone↔Laptop control creates JMC5 endpoint envelopes. The runner receives only endpoint-scoped member authority and rotating rejoin authority; the operator ADMIN credential never enters the endpoint runner.

## Assistant-side qualification

- Static/deploy QA: **10/10 PASS**
- Server/profile/API integration QA: **34/34 PASS**
- The Render service is explicitly pinned to `hosted-v0.5-descendant`.
- The Docker image runs the same QA family during its build before the runtime image is allowed to continue.
- Server and runner Git blob identities were checked against the locally proved source before handoff.

These passes do **not** synthesize a public hosted v0.5 Ding or a physical Phone↔Laptop Ding.

## Claim boundary

Cloud carries rendezvous, signalling, allow-listed command state and receipts. The Phone↔Laptop WebRTC DataChannel remains endpoint-to-endpoint. Public server/profile proof and physical endpoint consequence remain separately claim-gated.

**NO DING, NO CLAIM.**

See `README_HOSTED_V0_5_1.md` for the deployment qualification checklist.


## JM Market Ecosystem Lab mounted descendant

- Hosted UI: `/market`
- Profile meta: `/market/v1/meta`
- Readiness: `/market/v1/ready`
- Public quote relay: `/market/v1/quotes?symbol=BTC/GBP`
- Supported seed pairs: BTC/GBP, ETH/GBP, BTC/USD, ETH/USD
- Same sovereign-cloud law: **SERVER FIRST. ROUTES MANY.**
- Market law: **LAB DING ≠ MONEY DING.** Historical or live-paper evidence does not silently become a capital instruction.
- The route reuses the existing cloud carrier instead of creating a parallel server. Quote contact is same-origin through the cloud profile; user/account-specific fees remain explicit inputs.


## JM Market Ecosystem Lab v1.2 — autonomous cloud pulse

The hosted market body now gathers bounded public bid/ask snapshots on the server itself instead of requiring the browser to initiate every observation.

- UI descendant: `/market` → v1.2
- Pulse status: `/market/v1/pulse`
- Bounded history: `/market/v1/snapshots`
- Default cloud cadence: 60 seconds
- Default pulse pairs: BTC/GBP and ETH/GBP
- Max retained snapshots: 20,000
- Raw venue difference is stored; account-specific fees remain a local/user parameter.
- Runtime data contact is separately reported from build QA.
- Historical Lab can ingest the cloud pulse observations without a file handoff.

Keeper: **THE CLOUD OBSERVES; THE LAB TESTS; CAPITAL REMAINS A SEPARATE GATE.**


## JM Market Ecosystem Lab v1.3 — top-book size gate

The live route now contacts public level-1 order books instead of price-only tickers.

- Kraken: public depth, top bid/ask + quoted base size.
- Coinbase Exchange: public level-1 book, top bid/ask + quoted base size.
- Every cross-venue route records raw bps plus the maximum quote-currency notional that fits entirely at both required top levels.
- A positive raw/net percentage does not advance if the chosen paper notional exceeds that top-level capacity.
- Cloud pulse history now carries `bestTopCapacity` alongside `bestRawBps`.
- Deeper-book slippage is still a later gate; top-level capacity is not allowed to impersonate full-book execution.

Keeper: **PRICE WITHOUT SIZE IS NOT YET AN EXECUTABLE ROUTE.**


## JM Market Ecosystem Lab v1.4 — full-depth VWAP sweep

The lab can now walk returned public order books for a chosen paper notional instead of stopping at the first price level.

- `/market/v1/sweep?symbol=ETH/GBP&notional=1000`
- Kraken depth: up to 100 public levels.
- Coinbase Exchange depth: public level-2 book.
- Buy-side simulation spends the requested quote notional across asks.
- Sell-side simulation disposes the acquired base quantity across bids.
- Returned route carries fill state, base quantity, buy VWAP, sell VWAP, levels used, gross bps and cross-source receive skew.
- Browser then applies the user-entered fee + extra-friction assumptions and records a FULL_DEPTH_SWEEP trace.
- Notional is clamped to 1–100,000 quote units per request.

Keeper: **TOP PRICE → TOP SIZE → FULL DEPTH → FRICTION → ONLY THEN SURVIVING PAPER EDGE.**


## JM Market Ecosystem Lab v1.5 — historical source library

The lab can now import selected historical series directly through the same JM cloud body.

### FRED whitelist
- DGS10 — US 10-Year Treasury Yield
- DFF — Effective Federal Funds Rate
- DTWEXBGS — Broad US Dollar Index
- DCOILWTICO — WTI Crude Oil
- VIXCLS — CBOE VIX
- SP500 — S&P 500
- DEXUSUK — USD per GBP spot rate

### Bank of England IADB whitelist
- IUDBEDR — Official Bank Rate
- IUDSOIA — Daily SONIA
- XUDLUSS — US Dollar into Sterling spot rate
- XUDLERS — Euro into Sterling spot rate

Routes:
- `/market/v1/history/catalog`
- `/market/v1/history?source=fred&series=DGS10&from=2021-01-01&to=2026-09-25`

The server is deliberately a whitelist, not an arbitrary URL proxy. Retrieved rows normalize to `timestamp · qualified series · value` and feed the existing 60/20/20 lag laboratory. A production startup calibration contacts one FRED and one Bank of England series to keep source-runtime proof separate from build QA.

Keeper: **THE PAST ENTERS THROUGH NAMED SOURCES; IT DOES NOT ENTER THROUGH AN UNBOUNDED PROXY.**


## JM Market Ecosystem Lab v1.6 — mismatched-clock quantifier

The lag hunt is now a first-class server-side research route instead of only a browser-side description.

- Pure engine: `market/JM_MARKET_CLOCK_ENGINE_v0_1.mjs`.
- Hosted route: `/market/v1/clock-test`.
- Source and target must both come from the existing historical whitelist.
- The route aligns timestamped observations, converts them to returns, chooses the lag on the first 60% only, freezes direction + lag, then evaluates the next 20% and untouched final 20%.
- Results report lag bars, median source cadence, observed lag hours, FAST / MID / SLOW clock band, validation/test sample counts, hit rates and friction-aware mean outcomes.
- Synthetic QA contains a known three-bar delayed response and a same-bar control, so lag recovery is tested independently of external market data.
- A non-zero lag that survives later partitions is only a `MISMATCHED-CLOCK CANDIDATE`; historical association does not establish causation, live persistence or capital authority.

Keeper: **DO NOT JUST FIND WHAT MOVED. MEASURE WHEN THE CONNECTED FIELD RECEIVED IT.**


## JM Market Ecosystem Lab v1.7 — series semantics before clock sweep

The mismatched-clock engine now distinguishes the kind of quantity being observed before it compares timing.

- Rates and yields use **basis-point changes** (`delta_bps`), not percentage returns on the quoted rate level.
- Prices, indexes and FX use **percentage returns** (`pct_return`).
- Each whitelisted historical series carries an explicit transform and default source-signal threshold.
- Lag selection remains training-only; validation and untouched test remain later partitions.
- Historical directional association is reported separately from friction-aware paper evidence.
- Paper friction is only applied when the target is a price/index/FX return series; rate-to-rate relationships cannot accidentally masquerade as executable trades.
- Synthetic QA includes a rate-pressure → delayed-price response with a known two-bar lag, a rate same-bar control, and a price same-bar control.

This corrects the v1.6 calibration ambiguity where a yield level was treated as if it were an ordinary asset price.

Keeper: **MEASURE THE THING IN ITS OWN UNIT BEFORE MEASURING HOW FAST IT TRAVELS.**


## JM Market Ecosystem Lab v1.7.1 — clock input diagnostics

Before the clock engine is fanned across the wider mesh, the transform-aware route now exposes distribution diagnostics for the exact aligned inputs it actually used.

Returned diagnostics:
- source value distribution
- target value distribution
- source transformed-change distribution
- target transformed-change distribution
- min / max / mean / median
- mean absolute / median absolute / p95 absolute / p99 absolute

The startup DGS10 → SP500 calibration logs these diagnostics beside the clock result. This exists to catch scale, parser or transform errors before a suspicious effect size can be multiplied across many routes.

Keeper: **A CLOCK RESULT DOES NOT OUTRANK A BROKEN MEASURING STICK.**


## JM Market Ecosystem Lab v1.7.2 — missing-observation correction

Runtime diagnostics exposed the real cause of the oversized DGS10 → SP500 effect: missing historical observations were arriving as blank fields and JavaScript's numeric coercion turned blank text into zero.

That created false:
- zero-valued Treasury yields,
- zero-valued S&P 500 observations,
- ±400+ bp rate jumps,
- -100% index returns,
- inflated downstream association and paper statistics.

v1.7.2 introduces a strict historical numeric parser shared by FRED and Bank of England adapters. Blank, dot, NA/N/A, NULL and NaN markers are rejected as missing instead of being coerced to zero. Comma-formatted valid numbers remain accepted.

The existing input diagnostics remain live so this correction is checked at runtime, not merely assumed.

Keeper: **MISSING ≠ ZERO.**


## JM Market Ecosystem Lab v1.8 — batch clock matrix

The clock instrument can now screen an entire whitelisted source library in one bounded pass instead of requiring one manually selected pair at a time.

Route:
- `/market/v1/clock-matrix?source=fred&from=2021-01-01&to=2026-09-25&maxLag=20&frictionBps=20`

For every ordered pair in the chosen source library, the server:
- reuses one fetched copy of each historical series,
- applies each series' own transform and default threshold,
- runs training-only lag selection,
- freezes lag and direction,
- evaluates validation + untouched test,
- separates same-bar survival from non-zero mismatched-clock candidates,
- keeps failed/insufficient pairs visible rather than silently deleting them.

The matrix is a research screen, not a trading recommendation or capital instruction.

Keeper: **SWEEP THE FIELD; DO NOT FORCE THE FIELD TO PASS.**


## JM Market Ecosystem Lab v1.9 — survivor stress lab

The first non-zero clock candidate is no longer allowed to stand on one selected configuration.

A new bounded route, `/market/v1/clock-stress`, stress-tests a selected relationship across:
- multiple history windows,
- multiple maximum-lag caps,
- source-threshold perturbations,
- reverse direction,
- rolling regime windows,
- deterministic circular-shift placebo alignments.

The stress body preserves the original discovery context (for example, 42 ordered pairs screened in the first FRED matrix) so post-selection evidence cannot quietly forget that the candidate was chosen from a larger search.

Default stress grid:
- windows: 3 / 5 / 8 years,
- lag caps: 5 / 10 / 20 bars,
- source-threshold multipliers: 0.5× / 1× / 1.5×,
- rolling windows: 2 years stepped by 1 year,
- placebo shifts: 20 / 40 / 60 / 80 / 100 / 140 / 180 / 220 bars.

The output reports forward and reverse survival counts, lag histograms, baseline-lag repeat counts, rolling-regime survival, and placebo survival. Repetition is evidence about stability only; it is not causation, execution proof, or capital authority.

Keeper: **A SURVIVOR MUST SURVIVE BEING MOVED.**


## JM Market Ecosystem Lab v1.10 — Null Field / false-discovery pressure

The clock lab now carries the discovery search itself into the null test instead of treating a selected survivor as if it had been tested alone.

New route:
- `/market/v1/clock-null-field`

Two nested null layers are used:

1. **Whole-screen family null**
   - fetch each whitelisted series once,
   - deterministically circular-shift each series by different non-zero offsets,
   - rerun the same ordered-pair clock screen,
   - repeat across multiple null rounds,
   - measure how often the broken-alignment screen produces at least as many mismatched-clock survivors as the real screen.

2. **Selected-pair null**
   - for every real non-zero survivor, rotate the target through many deterministic shifts,
   - rerun the exact pair machinery,
   - count any mismatched survivor,
   - separately count exact-baseline-lag and ±2-bar survivors.

Default live calibration:
- 42 ordered FRED pairs,
- 24 whole-screen null rounds,
- 64 pair-level placebo shifts per observed non-zero survivor,
- minimum 20-bar circular displacement.

The reported rates are empirical diagnostics from this deterministic shift family. They are not assumptions of independent observations, not universal p-values, and not causal or capital evidence.

Keeper: **THE SEARCH ITSELF MUST ENTER THE NULL.**


## JM Market Ecosystem Lab v1.11 — Lag Rarity

The selected lag identity now has its own null diagnostic.

New route:
- `/market/v1/clock-lag-rarity`

For a selected pair, the lab:
- freezes the real baseline lag from the ordinary 60/20/20 clock test,
- generates many unique non-zero circular shifts of the target history,
- reruns the exact pair machinery,
- counts generic mismatched survivors,
- counts mismatched survivors landing on the exact baseline lag,
- counts ±2-bar recurrences,
- reports null lag histograms for all selected lags and later-partition mismatched survivors,
- reports add-one finite-sample null frequencies.

The primary event is deliberately strict: a shifted null must both survive the later partitions as a mismatched-clock candidate and land on the original baseline lag.

Default live calibration:
- VIXCLS → DGS10,
- five-year history,
- max lag 20 bars,
- 256 unique target-calendar shifts,
- minimum 20-bar displacement.

This is an empirical lag-identity diagnostic under a deterministic shift family. It is not a universal p-value, causal proof, execution proof, or capital authority.

Keeper: **THE LAG MUST BE RARER THAN THE SURVIVOR.**


## JM Market Ecosystem Lab v1.12 — Frozen-Lag Confirmation

The lag-rarity result is now separated from independent historical confirmation.

New route:
- `/market/v1/clock-frozen-confirm`

This route performs **no lag search**. Lag, direction and source threshold are fixed before the confirmation windows are fetched.

Default live confirmation rule:
- source: VIXCLS
- target: DGS10
- lag: 8 bars
- direction: same
- source threshold: existing VIXCLS default
- three non-overlapping five-year windows ending before the discovery window:
  - 2006-09-25 → 2011-09-24
  - 2011-09-25 → 2016-09-24
  - 2016-09-25 → 2021-09-24

Each confirmation window is evaluated as:
- whole period
- first half
- second half

A window earns split survival only when all three directional association means are positive and sample floors are met. No parameter can be reselected inside the confirmation window.

This is retrospective independent historical confirmation because the frozen rule is applied after discovery to older non-overlapping data. It is not prospective live proof, causation, execution proof, or capital authority.

Keeper: **FREEZE BEFORE CONTACT.**


## JM Market Ecosystem Lab v1.12.1 — Frozen Confirmation Contact Recovery

The first frozen-lag runtime contact exposed a transport failure in the oldest confirmation window. The rule itself was already frozen correctly; the data request timed out before that window could be judged.

v1.12.1 separates **transport completion** from **confirmation survival**.

For frozen confirmation only:
- try the requested historical window directly,
- if direct source contact fails, split that same requested window into two non-overlapping date ranges,
- fetch both bounded ranges,
- merge/de-duplicate by timestamp,
- evaluate the original full confirmation window with the already frozen lag/direction,
- record whether contact was direct or recovered.

No lag, direction, threshold, window boundary or survival gate is changed by recovery.

The runtime receipt now reports:
- `pass` = all requested confirmation windows made data contact,
- `confirmationSurvival` = all contacted windows pass the predeclared split-survival gate.

This prevents a transport timeout from impersonating a failed relationship, and prevents successful transport from impersonating confirmation.

Keeper: **RECOVER CONTACT; DO NOT MOVE THE RULE.**


## JM Market Ecosystem Lab v1.13 — Prospective Clock Rule 001

The VIXCLS → DGS10 8-bar relationship now has a precommitted forward evidence lane.

Frozen before future contact:
- frozen on: 2026-09-25
- prospective evidence begins: 2026-09-26
- source: VIXCLS
- source transform: percentage return
- source threshold: |2%|
- target: DGS10
- target transform: basis-point change
- lag: 8 aligned bars
- direction: same
- minimum resolved source signals before promotion eligibility: 20
- gate: whole mean > 0, first chronological half mean > 0, second chronological half mean > 0

Files:
- `market/JM_MARKET_PROSPECTIVE_RULE_001.json`
- `market/JM_MARKET_PROSPECTIVE_CLOCK_v0_1.mjs`

Routes:
- `/market/v1/prospective/rule`
- `/market/v1/prospective`

The prospective evaluator may fetch a short pre-anchor buffer only to calculate the first post-anchor transformed change. It never counts a signal dated before 2026-09-26 as prospective evidence.

Because the rule and start boundary live in source, a service restart can reconstruct post-anchor evidence without changing the rule or pretending older observations were prospective.

This is forward historical-series evidence, not causation, live execution, profit proof, or capital authority.

Keeper: **FREEZE TODAY; LET TOMORROW ANSWER.**


## JM Market Ecosystem Lab v1.14 — 32-Edge Measurement Coverage

The original 32 conceptual relationships now have an explicit measurement-readiness layer instead of being treated as equally measurable.

New registry:
- `market/JM_MARKET_MESH_COVERAGE_v0_1.json`

New route:
- `/market/v1/mesh-coverage`

Coverage classes:
- ACTIVE — both sides have cadence-compatible runtime historical carriers now
- ACTIVE_LIVE_ONLY — live carriers exist but comparable historical depth is not yet sufficient
- CANDIDATE — both sides have identified public series/proxies, but cadence/release/proxy controls still block activation
- PARTIAL — one side or only a broad proxy is identified
- GAP — no sufficiently specific route has been accepted

The source frontier now records candidate public series separately from the active clock whitelist. Monthly and quarterly candidates are deliberately **not** dropped into the daily matrix. They must first pass:
- provider parser/contact proof,
- declared observation frequency,
- release timestamp or vintage provenance,
- no-lookahead alignment,
- cadence-compatible comparison or an explicit cross-cadence bridge,
- visible proxy labelling,
- inherited null / false-discovery controls.

Initial candidate frontier includes:
- FRED PCOPPUSDM — monthly global copper price
- FRED IPG3344S — monthly semiconductor/electronic-component industrial production
- FRED IPG2211S / IPG22111S — monthly electric-power industrial production
- FRED CPIAUCSL / CUSR0000SAF11 — monthly consumer-price indices
- FRED WPS117 — monthly electrical-machinery PPI
- FRED WPU3012 — monthly truck-freight PPI
- FRED A679RX1Q020SBEA — quarterly real information-processing equipment/software investment
- ONS D7C8 / D7DT / D7CH — monthly UK food/electricity/household-energy CPI indices

The hosted-page QA now parses the inline JavaScript as source code before build completion, closing a gap that could otherwise allow a browser-only syntax regression through static string checks.

Keeper: **MEASURE THE FIELD WITHOUT PRETENDING THE PROXY IS THE THING.**


## JM Market Ecosystem Lab v1.15 — Candidate Source Contact

The mesh frontier can now make bounded source contact with registered FRED candidates without activating them in the clock engine.

New route:
- `/market/v1/mesh-candidate-contact`

Current candidate-contact behavior:
- only registered candidate sources are accepted,
- FRED contact is supported first,
- raw historical observations are parsed,
- cadence is measured independently,
- declared frequency is compared with measured cadence,
- contact success remains separate from clock activation,
- release-aware provenance remains a hard HOLD.

Runtime startup probes currently include:
- PCOPPUSDM — copper
- IPG3344S — semiconductor/electronic-component output
- IPG2211S — electric-power output
- A679RX1Q020SBEA — information-processing equipment/software investment

A successful contact still returns:
- `activationEligible: false`
- `clockActivation: HOLD_RELEASE_AWARE_PROVENANCE`

This protects against silently feeding revised monthly/quarterly observations into a daily lag engine as if their observation dates were the dates the information became knowable.

Keeper: **CONTACT THE SOURCE; DO NOT PROMOTE THE CLOCK.**


## JM Quick Flip Lab v1.0 — visible build using actual JM Coding Estate

The original quick-flip front door is now a dedicated visible build at:

- `/market/flip`

It does not replace the Market Ecosystem Lab. It gives the long research line a simple usable surface again.

Runtime route:
1. fetch public Kraken + Coinbase executable books,
2. walk full depth for the chosen paper notional,
3. subtract user-entered friction assumptions,
4. pass the resulting candidate through the exact mounted `JM_CODING_ESTATE_REAL_BUILD_v1_0` donor,
5. return JMLogic / Route-Code / ContactCode / TraceBox receipts.

Mounted coding bodies:
- JMLogic — paper-candidate vs friction/capacity HOLD gate
- Route-Code — candidate state route
- ContactCode — venue-to-venue contact proof
- TraceBox — per-body execution receipts

The donor is mounted byte-for-body from the user's Library source as:
- `market/vendor/JM_CODING_ESTATE_REAL_BUILD_v1_0.mjs`

New routes:
- `/market/flip`
- `/market/v1/quick-flip`
- `/market/v1/quick-flip/manifest`

No order placement is implemented. The visible verdict is explicitly PAPER_CANDIDATE / HOLD_CAPACITY / HOLD_FRICTION and remains behind the standing boundary **LAB DING != MONEY DING**.

Keeper: **USE THE ESTATE TO BUILD THE BUILD.**


## JM Market Ecosystem Lab v1.16 — Plain Surface / Deep Guts

The main Market Lab now follows the same language split as Quick Flip:

- **surface language** speaks plainly,
- **deep research rooms** keep the exact technical terms where they are useful,
- the underlying runtime, evidence gates, null machinery and JM coding bodies are unchanged.

Visible changes include:
- Overview → Home
- Live Mesh → Live Prices
- 32-Mesh → 32 Routes
- Historical Lab → Past Data
- Paper Edge → Try It
- Trace → Receipts
- Protocol → Rules
- Seed topology → 32 market routes ready
- Live carrier → Running live through CLOUD
- Historical rows → Past data loaded
- Real capital → Real money used
- technical live-price cards translated toward buy/sell, amount, costs and “best way round”

The technical route remains visible underneath where useful:
`SOURCE → SIGNAL → CONTACT FIELD → ROUTE PRESSURE → STATE CHANGE → DING → TRACE → RECOVERY → OUTPUT`

Keeper: **PLAIN ON TOP; PRECISE UNDERNEATH.**


## JM Quick Flip v1.1 — Check Them All

The visible Quick Flip front door can now scan every supported pair in one go.

New route:
- `/market/v1/quick-flip/all`

Visible control:
- `CHECK THEM ALL`

For each supported pair the route reuses the same existing mechanics:
1. public Kraken + Coinbase quote contact,
2. full-depth notional sweep,
3. entered fee/friction subtraction,
4. JM Coding Estate decision through JMLogic,
5. Route-Code route state,
6. ContactCode venue contact,
7. TraceBox/body receipts.

The returned set is sorted by net paper result after the entered costs and keeps failed contacts visible.

Verdicts remain deliberately simple:
- WORTH A LOOK
- NOT ENOUGH THERE
- COSTS EAT IT

No order is placed. Ranking is a current public-book paper scan only.

Keeper: **DON'T MAKE ME PICK FIRST — CHECK THE LOT.**


## JM Quick Flip v1.2 — Does It Stay?

A one-snapshot paper gap is now forced to repeat before it earns a stronger visible label.

New route:
- `/market/v1/quick-flip/stay`

New visible control:
- `DOES IT STAY?`

Default behavior:
- selected pair only,
- 3 separate live checks,
- 1.5 seconds between checks,
- every check still runs through full-depth amount contact, entered costs, JMLogic, Route-Code, ContactCode and TraceBox.

Plain outcomes:
- **STAYED THERE** — every completed check remained a paper candidate,
- **FLICKERED** — the condition appeared in only some checks,
- **NEVER THERE** — none of the completed checks survived costs/size,
- **NO CONTACT** — no completed check.

The result also reports average / low / high net paper gap across the repeated checks.

This is persistence evidence only. It is not a recommendation, fill guarantee, or money Ding.

Keeper: **ONE FLASH ISN'T A ROUTE.**


## JM Quick Flip v1.3 — Find One That Stays

The simple front door can now do the whole route in one action:

- scan every supported Kraken/Coinbase pair,
- rank the current paper results after the entered costs,
- choose the strongest result that still has something left,
- recheck that selected pair three more times,
- report whether it STAYED THERE, FLICKERED, or FELL AWAY.

New route:
- `/market/v1/quick-flip/best-that-stays`

New visible control:
- `FIND ONE THAT STAYS`

If the first all-pairs screen has no paper candidate, the route stops cleanly with:
- `NOTHING WORTH CHASING`

Every underlying pair check still runs through the actual JM Coding Estate:
JMLogic → Route-Code → ContactCode → TraceBox.

No order placement. No money Ding.

Keeper: **FIND IT → THEN MAKE IT STAY.**


## JM Quick Flip v1.4 — Remember What Stayed

Quick Flip now keeps a small local watchlist on the device using the page.

When a repeated check runs through:
- DOES IT STAY?
- FIND ONE THAT STAYS

the route/result is remembered locally with:
- pair,
- direction,
- last status,
- last net paper gap,
- first/last seen time,
- remembered-check count,
- stayed / flickered / fell-away counts.

New visible control:
- `CHECK WATCHLIST`

That control recontacts fresh live books for every remembered route using the same current amount and cost settings, then updates the local history.

This memory is deliberately device-local. It does not pretend the free hosted service has durable cross-deploy storage.

The stay classifier also advances to v0.2 so it can classify both full Quick Flip scan wrappers and direct JM Coding Estate decision receipts in QA.

Keeper: **REMEMBER WHAT SURVIVED; MAKE IT MEET REALITY AGAIN.**


## JM Quick Flip v1.5 — What Keeps Coming Back?

The local watchlist now separates **instant persistence** from **return persistence**.

A route can no longer become “came back later” merely because the button was pressed repeatedly within seconds.

Device-local return memory now records up to 16 recent watch events per route and applies a time separation gate:

- repeat checks inside 15 minutes remain part of the same near-term contact,
- 2 time-separated STAYED THERE contacts → **CAME BACK LATER**,
- 3+ time-separated STAYED THERE contacts spanning at least 30 minutes → **KEEPS COMING BACK**,
- mixed survival → **FLICKERY**,
- no surviving return → **FELL AWAY / WAITING** as appropriate.

New visible control:
- `WHAT KEEPS COMING BACK?`

The watchlist is ranked by return evidence first, then the latest remaining paper gap. Existing v1.4 browser memory is read forward into v1.5 so earlier local survivors are not discarded.

This is still device-local paper evidence. Time-spaced recurrence is stronger than three snapshots in a few seconds, but it is not execution proof or a money Ding.

Keeper: **COMING BACK LATER ≠ STAYING THERE FOR THREE SECONDS.**


## JM Quick Flip v1.6 — Watch For Me

Quick Flip can now recheck remembered routes automatically while the page stays open.

New visible control:
- `WATCH FOR ME`
- toggles to `STOP WATCHING`

Behavior:
- minimum watch interval: 15 minutes,
- remembered routes are re-run through the existing `/market/v1/quick-flip/stay` route,
- every underlying check still passes through JMLogic → Route-Code → ContactCode → TraceBox,
- the next due time is stored locally,
- if the page is reopened after that due time, one catch-up check runs,
- concurrent watch runs are blocked.

Important boundary:
- this is **not** background server monitoring,
- it runs only while the page is open,
- closing/suspending the browser stops active checking,
- reopening can recover the locally stored due time and perform one fresh catch-up contact.

This means return-memory can now grow without manually pressing CHECK WATCHLIST every time, while still refusing to pretend browser-local memory is a cloud daemon.

Keeper: **WATCH WHILE OPEN; CATCH UP WHEN BACK.**
