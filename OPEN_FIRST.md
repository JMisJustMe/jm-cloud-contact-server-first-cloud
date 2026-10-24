# JM ECOSTATE — CP-C17 OWNER-HOSTED LOCAL CONTACT (candidate)

**Recover before rebuild. Integration ≠ replacement. No Ding, no claim.**

This package contains the exact CP-C15-tested Cloud Contact server, the real CP-RD1.2 Revolving Door/CP-C9 bridge, and **additive** first-time local hosting orchestration. It does not install anything until the owner runs it. None of the private credentials are in this ZIP.

## Windows laptop — first-time setup

1. Install and open [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) on supported Windows with WSL2, if not already installed. Check `docker compose version` in PowerShell. At least 8 GB RAM is generally required by current Docker Desktop Windows guidance.
2. Extract the ZIP locally, e.g. `Documents\JM OWNER CLOUD`. **Do not** put the extracted working directory and its future `.env` into public Git or cloud-sync folders. Keep the original ZIP as source custody.
3. In PowerShell open the extracted folder and run:

   ```powershell
   .\START_HERE_WINDOWS.ps1 setup
   ```

   If script execution is blocked by your organisation's policy, **do not disable system-wide security**. You can inspect the signed script text and run the documented Docker commands manually.
4. The setup uses Docker to generate a unique **local** `.env` containing a P-256 private signer, pin, admin and runner tokens and two Postgres passwords. It explicitly initialises two **new** Docker volumes, starts the actual JM server, enrolls **one probe-only member**, starts the real Revolving Door runner and attempts an independently signed one-probe receipt. Setup refuses to overwrite an existing `.env`.
5. After a full real owner-device pass, `./START_HERE_WINDOWS.ps1 start`, `status`, `probe`, `stop`, `backup` are the maintenance actions. **Never use `docker compose down -v` or `docker volume prune`**, which can destroy custody data.

## What this proves and does not

- PostgreSQL services are private Docker network services with **no public published ports**.
- JM Cloud Contact binds externally to the **laptop's loopback only**: `127.0.0.1:8791`. The Fold cannot connect to this until a *separate owner-approved private network route* is configured.
- The locally paired CP-C5 bridge uses `localMock:true` **only to allow localhost URL matching**; its signature checks and actual RD operations still run. This is a local host test, not a claim about a remote Render server.
- `reconcile` is a separately privileged one-shot admin tool. HTTP 200 alone is not success; only P-256 signed host readback plus the locally signed mission receipt qualifies.
- CP-C15's split-database uncertainty holds remain possible: the shared fence is not a distributed transaction. Stop both writers and investigate mismatched checkpoints; never manufacture exactly-once or auto-fix them.
- Initial `setup` is a single-use bootstrap. Partial bootstraps are HOLD; it does not reset volumes or signing keys.
- All device-contact, Docker Desktop execution and physical laptop performance remain **UNTESTED ON OWNER HARDWARE** until owner confirms an actual run.

## Private Fold contact — later step, not public exposure

Once the local probe passes, optionally install **Tailscale on your laptop and Samsung Fold** and put both on the same private tailnet. The official `tailscale serve` command can route an HTTPS name to the laptop's loopback server, e.g. `tailscale serve --bg 8791` on supported versions. Check tailnet ACLs and actual HTTPS hostname first. **Do not use Tailscale Funnel or router port forwarding**. First test the `GET /health` route on the Fold; then use a separate capability-limited, phone-specific credential and real contact receipt. A public health response is not authenticated Phone↔Laptop proof.

## Operator commands

```powershell
.\START_HERE_WINDOWS.ps1 status
.\START_HERE_WINDOWS.ps1 probe
.\START_HERE_WINDOWS.ps1 backup
.\START_HERE_WINDOWS.ps1 stop
```

## Cost and legal boundaries

No Render subscription is needed for the **local-only route**. PostgreSQL is free software, but the owner supplies PC, electricity, bandwidth, backups, network safety and availability. Docker Desktop's no-cost use is subject to its licence eligibility; review terms if using this for an organisation or commercial deployment. The Windows host still needs sufficient RAM, CPU, disk and virtualization support.

## Protected source inheritance

- Cloud Contact server and writer-fencing/uncertain-commit code are the exact tested CP-C15 Git blobs, unchanged.
- Revolving Door relay/runner and CP-C5 bridge are inherited from the verified CP-C9 snapshot.
- CP-C16 promotion gate and CP-C1–C16 original archives stay in their existing FLAZ records: this kit is a forward **owner-hosting recipient**, not a replacement archive.
- No live Render or Market database mutation is requested or performed by this ZIP.
