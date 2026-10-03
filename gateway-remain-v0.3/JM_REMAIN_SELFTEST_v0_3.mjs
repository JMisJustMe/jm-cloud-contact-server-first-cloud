import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRemainControl, validateMagnifyingControl } from './JM_SOVEREIGN_AGENT_GATEWAY_REMAIN_v0_3.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'jm-remain-'));
const dataPath = path.join(dir, 'store.json');
const seedControlPath = path.join(here, 'JM_MAGNIFYING_GLASS_CONTROL.json');
const enginePath = path.join(here, 'JM_MAGNIFYING_GLASS_ENGINE.py');

function stable(v){ if(Array.isArray(v))return v.map(stable); if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v).sort())o[k]=stable(v[k]);return o;}return v; }
function digestControl(c){const b={...c};delete b.digest;return createHash('sha256').update(JSON.stringify(stable(b))).digest('hex');}

const first = await createRemainControl({ dataPath, seedControlPath, enginePath });
if (!first.verify().ok) throw new Error('first verify failed');
const current = first.control();
const candidate = structuredClone(current);
candidate.revision = current.revision + 1;
candidate.parent_digest = current.digest;
candidate.next_action = 'selftest successor';
candidate.digest = digestControl(candidate);
if (!validateMagnifyingControl(candidate,{current,requireSuccessor:true}).ok) throw new Error('candidate invalid');
const landed = await first.replaceControl({expectedRevision:current.revision,expectedDigest:current.digest,candidate,actor:'selftest-worker'});
if (landed.control.revision !== current.revision + 1) throw new Error('advance failed');
let staleRejected=false;
try { await first.replaceControl({expectedRevision:current.revision,expectedDigest:current.digest,candidate,actor:'stale-worker'}); } catch(e){ staleRejected = e.code === 'JM_REMAIN_CONTROL_CONFLICT'; }
if (!staleRejected) throw new Error('stale write was not rejected');
const second = await createRemainControl({ dataPath, seedControlPath, enginePath });
if (!second.startupRecovered || second.control().revision !== candidate.revision || !second.verify().ok) throw new Error('restart recovery failed');
const broadened = structuredClone(second.control());
broadened.revision += 1;
broadened.parent_digest = second.control().digest;
broadened.authority.allowed = [...broadened.authority.allowed, 'delete'];
broadened.digest = digestControl(broadened);
const broadCheck = validateMagnifyingControl(broadened,{current:second.control(),requireSuccessor:true});
if (broadCheck.ok || !broadCheck.errors.includes('authority_allowed_changed')) throw new Error('authority broadening was not rejected');
console.log(JSON.stringify({
  status:'PASS',
  seedRevision:current.revision,
  landedRevision:candidate.revision,
  staleWriteRejected:true,
  restartRecovered:true,
  authorityBroadeningRejected:true,
  receiptCount:second.store().journal.length,
  headHash:second.store().headHash,
}));
