# JM CLOUD CONTACT SERVER v0.4.2 — First Public Launch Body

**SERVER FIRST. ROUTES MANY.**

This repository is the already-published first public-launch carrier for JM CLOUD CONTACT SERVER. It serves the phone-safe hosted Ding console at `/` and `/console` and keeps physical/app/game/device consequences separately claim-gated.

## Deploy now

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2FJMisJustMe%2Fjm-cloud-contact-server-first-cloud)

The root `render.yaml` uses the Docker deployment route, generates the admin/server secrets inside Render, checks `/ready`, and keeps auto-deploy disabled for the first controlled Ding.

After Render reports the service **Live**:

1. Open the generated `https://<service>.onrender.com/console` URL.
2. In Render, reveal/copy the generated `JM_CLOUD_ADMIN_TOKEN` environment value.
3. Paste it into the hosted console and run **First Public Cloud Ding**.
4. Preserve the returned signed receipt.

## Claim boundary

Repository publication is not the hosted Ding. A live public HTTPS server plus the external browser receipt earns the hosted server/browser Ding only. Phone↔Laptop v0.5 physical consequence remains a separate descendant and does not get silently crowned here.

## Current lineage

- This repo currently carries the stable **v0.4.2 first-public-launch package**.
- **JM CLOUD CONTACT SERVER v0.5.0 Profile Mounts** remains the current frozen software descendant and adds `/v5`, rotating cold rejoin authority, profile mounts, member-scoped ICE and public ECDSA receipt verification.
- Do not overwrite the frozen v0.5 body with a partial copy merely to change the version label. Its exact deployment upgrade should inherit above this first hosted Ding.
