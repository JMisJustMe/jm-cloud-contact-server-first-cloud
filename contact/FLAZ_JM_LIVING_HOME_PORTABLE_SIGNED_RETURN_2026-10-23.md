# JM Living Home — portable signed return FLAZ
Date: 2026-10-23 UK
Owner: JM / JMISJUSTME / JM32
Parent: existing hosted-v0.5-descendant → draft PR #67 (signed member signal receipts)
Descendant: draft PR #68, branch jm/living-home-portable-signed-bundle-20261023
Tested code SHA: 1683568346dfa92f9ee6fd62f0e8f73b6766bef4
GitHub CI: JM Living Home — Existing Cloud Contact v05 signed signal proof, run 39977590925 PASS.
Scope: actual local original v0.5.1 HTTP server and ephemeral test member credentials; 27/27 signed signal and portable bundle checks + full old hosted v05 regression PASS. NOT live Render-authenticated or physical-device proof.

SOURCE INHERITANCE
- Existing server source: JM_CLOUD_CONTACT_SERVER_v0_5_1_HOSTED_DESCENDANT.mjs.
- Existing signed route: GET /v4|v5/spaces/:spaceId/signals/:signalId/receipt, member-only, server's original /receipt-key signing identity, in PR #67.
- Reuse the existing CP07 read-only verifier contact/JM_LIVING_HOME_RETURN_VERIFY_v0_1.mjs; new bounded --bundle-output option writes an owner-private JM.LivingHome.NativeSignedReturnBundle/1 file.
- Bundle includes exactly one selected CP07 return ledger row, matching public ECDSA signed signal receipt, original signed reply payload, verified nonsecret evidence, and serverPublicJwk. It contains NO member token. Owner should review returned content before moving it into native Fold; it may contain their project text, so DO NOT upload real bundle to public GitHub.
- The recipient must separately pin the server's public key ID; a key supplied by an incoming file is not automatically trusted. Current production /receipt-key observed key ID 9953910a7979c8cd2f394721 before this PR; reconfirm out of band before owner contact.
- --bundle-output writes create-only private file (0600), refusing an existing destination. Without --bundle-output, original credential-free summary behaviour is unchanged.
- Existing service is NOT deployed from this child branch; Render hosted v05 remains unchanged and zero spaces were last observed. No secret, provider credential, production merge, or phone install performed.

CONTACT ROUTE
Authenticated sender → existing server persisted signal → authenticated recipient reply → signed signal receipt → read-only verifier compares actual stored return to CP07 row → portable signed bundle → native Fold owner-pinned ECDSA verification → owner approval → new revisioned SessionDeck checkpoint. Only first portions through portable bundle have real local-server QA; native work is separately tracked in draft JMisJustMe/JM-cading-lab PR #412.
No Ding no claim: transport receipt verifies SERVER CONTACT, not that a remote model or person did work.

REMAINING
- Recheck production signing-key continuity, enrol existing server via owner-held administrator authority; avoid credentials in chat.
- Signed route would require separately reviewed/approved production deployment; never silently enable insecure CORS.
- Run true external hosted two-member roundtrip, verify signed returned bundle from hosted server, then native owner device.
- Pair native Fold PR #412 with this signed bundle, preserve previous CP07 unverified mode and Return Point history.
- Build/use existing Dropbox, Drive, mail and GitHub scoped connectors; don't duplicate estate inventories.

RECOVERY
Existing sources PR #67 https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/pull/67
Portable bundle PR #68 https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/pull/68
Code workflow https://github.com/JMisJustMe/jm-cloud-contact-server-first-cloud/actions/runs/39977590925
Original native Fold PR #406 https://github.com/JMisJustMe/JM-cading-lab/pull/406
Native signed child PR #412 https://github.com/JMisJustMe/JM-cading-lab/pull/412

FLAZ = FROZEN · LOCKED · ANCHORED. This document is added AFTER the code test SHA and does not claim residence in Library, Dropbox, or production deployment.
