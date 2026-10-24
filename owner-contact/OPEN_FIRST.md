# JM CP-C17 × Existing Phone↔Laptop Contact — Inheritance Overlay v0.1

**24 October 2026 · additive contact adapter · NOT a replacement for any frozen body.**

## What is recovered and inherited

1. **JM PHONE↔LAPTOP CONTACT RUNNER v0.2** has already earned physical owner-device `CONNECT → PAIR → EXCHANGE → RECOVER → REVOKE → BLOCK`, including signed ACK, recovery and post-revocation BLOCK. The founding archive stays frozen. Do **not** repeat that ceremony.
2. **JM COMPUTATION REOPENED — Cross-Device History Return Receipt v0.1**, 6 September 2026: a 96,617-byte, 16/16 runtime report crossed LAPTOP→direct WebRTC→PHONE, received signed ACK, returned byte-exact, verified SHA-256 `f44d731428765b3c0edda42338ee4d9d76ca08041c48c97770d924054b76bc10`. That is an actual scoped data round-trip, not every possible device/app.
3. **JM32-1DA Cross-Device Runtime Adapter v0.2** is recorded as a current seven-route proof carrier, not a universal Android OS.
4. **JM PHONE↔LAPTOP DEVELOPER PLAYGROUND v1.1** preserves `JM_ADB_LOCALHOST_BRIDGE_v0_1.zip`, SHA-256 `15a03914175da7f9c29358cd00f76c43775a7fe6f212bb0c167c21850d5ec747`: PHONE localhost:8791→`adb reverse`→LAPTOP localhost:8791. The original helper also handles old JMC5 launch links and must not be run automatically against CP-C17 because CP-C17's phone enrolment is different.
5. **JM CP-C17 OWNER HOSTED LOCAL CLOUD**: actual JM Cloud Contact + Revolving Door, two private PostgreSQL stores, isolated Docker CI signed 2/2 probes before/after restart, 50/50 safety/regression checks. FLAZ source ZIP SHA-256 `e1c9e0c85ba5bb57065d2b06bac10f07b8cd1c149ab57693a14efc8b3eaa2760`, GitHub `JMisJustMe/jm-cloud-contact-server-first-cloud` CP-C17 commit `f5953cc798d4a65c0e59cc476b43f6738ec25d54`.

**This overlay changes none of the above original sources.**

## Exact surviving gap

Does the owner's **Samsung Fold** reach the specifically configured CP-C17 owner's own Cloud Contact service using the existing laptop/ADB localhost route? This route requires USB debug authorisation and CP-C17 already running. Prior Oppo/WebRTC device proofs do not automatically crown Fold or this new recipient.

No Tailscale, new server, new pairing ceremony, Render service, router port-forward or copied JMC5 credentials are needed for the FIRST local USB observation. This is not public HTTPS and not an Internet-hosted deployment.

## When CP-C17 is ALREADY running on the Windows laptop

Open PowerShell **inside the already extracted CP-C17 folder**, containing `compose.yaml`, `.env` (private) and this `.mjs` file. Do not run `setup` again unless initial CP-C17 setup has never happened.

```powershell
node .\JM_CP17_INHERITED_ADB_CONTACT.mjs inspect
node .\JM_CP17_INHERITED_ADB_CONTACT.mjs connect
node .\JM_CP17_INHERITED_ADB_CONTACT.mjs open
```

- `inspect`: only reads CP-C17 public `/health`, `/ready`, `/meta`, `/receipt-key`, independently recomputes the P-256 public JWK fingerprint and compares it against the locally stored expected key ID in `.env`, and reads **one** authorised, physical ADB device and its existing reverse map. Does not change ADB or send commands to the phone.
- `connect`: after that preflight, reuses existing correct `adb reverse` or creates `tcp:8791 → tcp:8791` ONLY when absent. Refuses a conflicting mapping. Does not install tools, rotate keys, pair a new contact identity or publish the server beyond laptop loopback.
- `open`: only when that mapping already exists, asks Android to display `http://127.0.0.1:8791/health`. It records **VIEW_INTENT_DISPATCHED**, not proof that the page rendered or that CP-C17 ran on the phone.

### Requirements and privacy

- CP-C17 already initialised and running locally; its localhost `/ready` must report `ready`, `contactDurable` and `receiptSigning`, with key ID identical to `.env`'s **public expected signer ID**. The adapter reads but never displays/stores any of `.env`'s private credentials.
- Node.js 22+ available on Windows (previous JM laptop proof recorded Node; this particular laptop state still needs confirmation).
- Android Platform Tools `adb` already installed and an explicitly authorised USB-connected physical phone. This adapter never installs ADB or touches a phone without a CLI action from the owner.
- `adb reverse` exposes only the selected laptop localhost port **to that USB-linked phone**. It does not expose PostgreSQL, the administrator token or the RD relay to a LAN/public network.
- The CLI emits only a nonsecret JSON receipt (no serial or admin credential). Capturing phone screenshots is not automatic because it could expose private device content.
- An Android browser showing `/health` needs the owner's visible confirmation/receipt; a successful `adb shell am start` by itself is insufficient to earn that Ding.

## The one remaining signed consequence

CP-C17's existing authenticated RD runner uses the laptop-local probe member. A phone HTTP health check is **not** an actual phone-originated signed RD mission. After the owner confirms the new Fold→CP-C17 local HTTP route, recover any already established phone capability client; only then use a **phone-specific limited member credential** and prove one real device-originated signed result. Do not send the server's admin token or the existing runner's token to the Fold.

## Tests and claim boundary

`node --test JM_CP17_INHERITED_ADB_CONTACT.test.mjs`: 22/22 isolated offline tests of adapter policy, mode actions, simulated ADB, pin drift and wrong-server HOLDs. **No actual Samsung Fold, laptop USB link, phone-rendered HTTP content, or phone-originated signed RD mission was tested in those mocks.**

**No Ding, no claim · Recover before rebuild · Integration ≠ replacement · OWNER USES, THE BODY PROVES.**
