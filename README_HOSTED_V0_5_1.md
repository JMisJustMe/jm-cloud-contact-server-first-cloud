# JM CLOUD CONTACT SERVER v0.5.1-hosted — Hosted Descendant

**SERVER FIRST. ROUTES MANY.**

This branch is a deliberate hosted deployment descendant of the frozen v0.5.0 Profile Mounts body. It does not rewrite the v0.4.2 First Public Cloud Ding carrier and does not rewrite the frozen v0.5.0 software closure.

## Deployment route

`v0.4.2 PUBLIC DING EARNED -> frozen v0.5.0 Profile Mounts -> v0.5.1 hosted carrier -> public v0.5 proof -> Phone↔Laptop endpoint consequence`

The Render Blueprint creates a separate service named `jm-cloud-contact-server-v05`.

## Public qualification

After deployment, verify:

- `/health` identifies `0.5.1-hosted`
- `/ready` reports `ready=true`, one mounted profile and `receiptSigning=true`
- `/meta` advertises `/v5`, `/v4`, `/v3`, `/profiles`, `/receipt-key`
- `/profiles` exposes the Phone↔Laptop profile
- `/profiles/phone-laptop/control` serves the operator surface
- `/profiles/phone-laptop/runner` serves the endpoint runner
- `/receipt-key` exposes a P-256 public JWK/key ID

## Claim boundary

The public v0.5 server proof and the Phone↔Laptop endpoint proof remain separate. The control page closes only after reciprocal BLOCK evidence plus completed AUTORUN, then independently verifies canonical receipt hash and ECDSA signature.

The free Render carrier may recycle its writable filesystem when the service instance is recreated. Therefore the first hosted v0.5 proof qualifies a running public instance; long-term durable state/signing identity is a later persistence descendant unless a persistent disk or external durable store is mounted.


## JM Game Live Service v0.3 mounted descendant

The hosted v0.5.1 server now mounts a game-service descendant at `/game/v1`.

The root remains sovereign:

`PLAYER -> MATCHMAKING -> CLOUD SPACE -> MEMBER -> SIGNAL -> RESULT -> SIGNED RECEIPT`

Matchmaking creates a real v5 cloud space. Each participant receives a bounded cloud member credential for that match, so WebRTC offer/answer/candidate traffic uses the existing generic SIGNAL organ rather than a second signalling server. Match completion appends a result event, closes the cloud space, and preserves the signed cloud receipt.

Clan membership, player inventory and DEV_ONLY entitlement state are game-profile state. Real-money verification is intentionally not enabled by this descendant.

QA: `qa/JM_GAME_LIVE_PROFILE_QA_v0_3.mjs` exercises player registration, matchmaking, cloud-space mounting, member credentials, cloud signalling, clans, inventory, host authority, cloud close and signed receipt return.


## JM Service Mesh v0.1

Mounted at `/mesh` and `/mesh/v1`. It preserves sovereign standalone app bodies while adding optional shared cloud organs for Authuser identity, versioned workspaces, RouteVault-style save/restore, Receipt Generator verification and Active Keeper Dashboard observation.

Route: `AUTHUSER -> WORKSPACE -> SAVE -> VERIFY -> OBSERVE -> RECEIPT`.

Workspace creation mounts a real `/v5` cloud space; saves become cloud events; the profile returns both its mesh receipt and the underlying signed cloud receipt. `qa/JM_SERVICE_MESH_QA_v0_1.mjs` proves SAVE -> VERIFY -> OBSERVE plus restore/readback.


## JM Service Mesh v0.2 — App-to-App Packet Pipeline

The Service Mesh now adds a second route without replacing v0.1 workspace continuity:

`SOURCE -> COLLECT -> GEM -> CLAIM -> PUBLIC OUTPUT -> SIGNED RECEIPT`

Mounted organs:
- JM Collector Protocol App — preserves source trail and declared selection decisions.
- JM Gem Extraction App v0.1 — exact recovered `jm.packet/1.0` gem semantics.
- JM FlowTalk Claim Checker v0.1 — exact recovered claim-class/evidence/scope gate semantics.
- JM Public Output Tool — bounded release descendant using its recovered private/source -> public-safe intent.
- Receipt Generator / Active Keeper remain verification and observation organs.

No stage silently invents the user's selection. Gem requires an explicit selected gem. Public Output requires explicit public text. Held claims require explicit acknowledgement before a labelled unresolved public packet may be produced.

Each pipeline gets a real `/v5` cloud space. Every stage appends a cloud event. Completion closes the space and returns the cloud's signed receipt. The entire packet trace remains `jm.packet/1.0`.

QA: `qa/JM_SERVICE_MESH_PIPELINE_QA_v0_2.mjs`.
