# JM CP-C17 inherited device contact adapter

Place these files beside `compose.yaml` in your existing extracted CP-C17 owner-cloud directory, not in the private `.env` file and not inside an earlier frozen legacy folder.

Run `node JM_CP17_INHERITED_ADB_CONTACT.mjs inspect` before `connect` and `open`. Read OPEN_FIRST.md for scope. This only prepares a bounded, owner-invoked ADB localhost route; it is **not** a substitute for existing old Phone↔Laptop PASS evidence and does not claim a signed phone mission.

Source pins and ancestry are in INHERITANCE_MATRIX.json; original frozen donor archives are not duplicated. Tests: `node --test JM_CP17_INHERITED_ADB_CONTACT.test.mjs`.
