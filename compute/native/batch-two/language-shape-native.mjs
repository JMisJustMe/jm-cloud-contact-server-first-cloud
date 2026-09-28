import { digest, stable } from './native-core.mjs';
import { Kading, JMP } from './kading-jmp-native.mjs';
import { Codifying, Kocodifying } from './codifying-kocodifying-native.mjs';
import { FormeULA } from './formeula-native.mjs';

export { Kading, JMP, Codifying, Kocodifying, FormeULA };

export function shapeChain(sources, input, services = {}) {
  const codified = Codifying.execute(sources.codifying, 'DoorRecord', input).runtime;
  const co = Kocodifying.execute(sources.kocodifying, 'DoorSync', codified.record, { doorState: 'closed', allowed: false }).runtime;
  const formula = FormeULA.execute(sources.formeula, 'DoorForce', { input: input.force ?? 3 }).runtime;
  const state = { user: { hasKey: input.hasKey }, door: { state: co.right.doorState, authorized: co.right.allowed, force: formula.value } };
  const cadence = Kading.execute(sources.kading, 'OpenDoor', state, services).runtime;
  const jump = JMP.execute(sources.jmp, 'DoorJump', cadence.state, services).runtime;
  return { codified, co, formula, cadence, jump, digest: digest(stable({ codified: codified.record, co: co.right, formula: formula.value, cadence: cadence.state, jump: jump.target })) };
}
