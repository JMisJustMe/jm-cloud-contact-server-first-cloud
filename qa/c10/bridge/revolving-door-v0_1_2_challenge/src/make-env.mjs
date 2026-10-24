import { randomBytes } from 'node:crypto';
import { writeFileSync,existsSync } from 'node:fs';
const file=process.argv[2]||'.env';
if(existsSync(file))throw new Error('REFUSING_TO_OVERWRITE_EXISTING_ENV');
const names=['JM_PRODUCER_TOKEN','JM_RUNNER_TOKEN','JM_WAKE_TOKEN','JM_MISSION_KEY','JM_RECEIPT_KEY'];
const lines=[
  '# Generated locally. NEVER commit or upload this file.',
  ...names.map(k=>`${k}=${randomBytes(32).toString('hex')}`),
  'JM_ALLOWED_RUNNER_ID=jm-laptop',
  'JM_RUNNER_ID=jm-laptop',
  'JM_RELAY_URL=http://127.0.0.1:8787',
  'JM_WAKE_URL=http://127.0.0.1:8788/v1/wake',
  'JM_RELAY_DB=./jm_relay.sqlite',
  'JM_LOCAL_DB=./jm_local.sqlite',
  'JM_RELAY_PORT=8787',
  'JM_WAKE_PORT=8788',
  'JM_POLL_MS=5000'
];
writeFileSync(file,lines.join('\n')+'\n',{flag:'wx',mode:0o600});
console.log(`Created ${file} with separately randomised keys; keep private. No keys printed.`);
