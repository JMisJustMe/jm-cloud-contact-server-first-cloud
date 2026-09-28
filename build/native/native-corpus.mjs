export const PARSER_SOURCE=`
grammar DoorParser {
  token WORD /[A-Za-z]+/
  skip SPACE /\\s+/
  rule Command = [WORD,WORD] meaning=door.command
}
`;
export const COMPILER_SOURCE=`
compiler DoorCompiler {
  parser = DoorParser
  ir = DoorIR
  targets = [javascript,rust,wasm]
}
`;
export const JS_EMITTER_SOURCE=`
emitter DoorJS {
  entry = DoorIR
  export = landing
  runtime = browser
}
`;
export const API_SOURCE=`
api CompileDoor {
  input = cading
  source_param = source
  target_param = target
  output = receipt
}
`;
export const LAB_SOURCE=`
lab DoorLab {
  interpret = interpretCading
  tests = [fullstop,relation]
  transform = normalise
  return = receipt
}
`;
export const ERROR_MAP_SOURCE=`
errormap DoorError {
  error = DOOR_STUCK
  cause = hinge
  relation = blocks
  recovery = resetHinge
  severity = recoverable
}
`;
export const VTS_SOURCE=`
validate DoorSystem {
  claim = door.opens
  evidence = [sensor,trace,ding]
  consequence = pass
  hold = hold
}
`;
export const DGYAK_SOURCE=`
know DoorKnowing {
  claim = door.open
  evidence = [sensor,trace]
  know = know
  hold = hold
}
`;
export const ONEBODY_SOURCE=`
onebody Door {
  identity = Door
  state = open
  route = door.open
  trace = T1
  receipt = R1
}
`;
export const BUILDODE_SOURCE=`
buildode DoorAndroid {
  body = Door
  purpose = game
  mode = android
  adapt = touch-first
  package = Door.apk
}
`;
export const ZION_SOURCE=`
zion DoorZion {
  source = Door.cad
  open_first = OPEN_FIRST.md
  manifest = manifest.json
  receipt = receipt.json
  sha = auto
}
`;
export const CURRENT_BEST_SOURCE=`
currentbest DoorCurrent {
  scope = door-runtime
  candidates = [door-v1,door-v2]
  proof = door-proof
  strategy = highest
}
`;
export const CROWN_SOURCE=`
crown DoorCrown {
  candidate = door-v2
  scope = door-runtime
  gates = [source,trace,ding]
  pass_status = working-crown
  hold_status = hold
}
`;
export const LEDGER_SOURCE=`
source DoorSource {
  path = coding/door.cad
  authority = JM
  receipt = R1
  body = Door
  conflict = hold
}
`;
export const BUILDER_SOURCE=`
builder DoorBuilder {
  body = Door
  purpose = game
  build = assembleDoor
  tests = [opens,identity]
  export = DoorPack
}
`;
export const REAPP_SOURCE=`
reapproach DoorReturn {
  source = Door
  protect = identity
  reentry = DoorLab
  gate = source_contact
  return = Door
}
`;
export const ROUTEFORM_SOURCE=`
routeform DoorOptions {
  seed = 1
  branches = [2,4,8]
  routes = [inspect,open,recover]
}
`;
export const TOOLKNIT_SOURCE=`
toolknit DoorProof {
  thread = [source,parse,trace,ding]
  carry = true
  output = DoorThread
}
`;
export const GOISIBLE_SOURCE=`
goisible DoorView {
  route = door.open
  visible = true
  understandable = true
  movable = true
  fit = gold
}
`;
export const TBS_SOURCE=`
tbs DoorTheory {
  source = door-theory
  contact = sensor
  translation = plain-language
  body = DoorBody
  pattern_turn = PatTurn
  proof = trace
  recovery = REAPROACH
  cold_ding = DoorMemory
}
`;
export const CADING_SOURCE=`open door = door.open.✓`;
