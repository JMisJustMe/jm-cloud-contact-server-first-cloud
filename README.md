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
