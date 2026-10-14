// JM Sovereign Gateway v0.3.6: REAL existing JM agent-runtime routing contact.
// Distinct authority classes: routing makes NO repair decision and confers NO write permission.
// Bridge action is fixed and already human-test-authorised; NOT a language-model plan.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const ROOT=path.resolve('native-src'), DEST=path.resolve('.handoff'), MANIFEST=path.join(DEST,'job-manifest.json');
const PIN='e26d1ce5605016ea94a670596ab12c52b0499d33';
const SCHEMA='JM.SovereignRouteDecision/0.3.6';
const ACTION='ATOMIC_RECEIPT_REPLACEMENT';
const FILE='agent-runtime/host-adapters/jm_host_adapter_conformance.py';
const QUERY='coding runtime';
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const canon=v=>JSON.stringify(stable(v));
const hash=v=>createHash('sha256').update(typeof v==='string'?v:canon(v)).digest('hex');
const assert=(v,why)=>{if(!v)throw Error('JM_ROUTE_HOLD:'+why);};
function cli(program,args){
 const p=spawnSync(program,args,{cwd:ROOT,encoding:'utf8',timeout:90000,maxBuffer:5*1024*1024});
 assert(p.status===0,'SOVEREIGN_RUNTIME_EXECUTION_'+(p.stderr||p.stdout||p.error?.message).slice(-500));
 return p.stdout.trim();
}
const source=JSON.parse(await fs.readFile(MANIFEST,'utf8'));
const manifestDigest=JSON.parse(await fs.readFile(path.join(DEST,'job-manifest-digest.json'),'utf8'));
assert(source.schema==='JM.BoundedAutoRepairHandoff/0.3.6'&&/^task-[a-zA-Z0-9_-]{1,100}$/.test(source.taskId)&&manifestDigest.sha256===createHash('sha256').update(JSON.stringify(source)).digest('hex'),'TASK_CUSTODY');
assert(source.routerSourceCommit===PIN&&source.routingQuery===QUERY&&source.requestedAction===ACTION&&source.allowedFile===FILE&&source.worker==='PINNED_ATOMIC_REPAIR_ONLY'&&source.authority==='HUMAN_FINAL_TEST_ONLY'&&source.destructiveAuthority===false,'BOUND_OWNER_TEST_AUTHORITY');
assert(cli('git',['rev-parse','HEAD'])===PIN,'ROUTER_PINNED_SOURCE_COMMIT');
const node=cli('node',['agent-runtime/jm-agent-runtime.mjs','--core-only','--query',QUERY]);
const py=cli('python3',['agent-runtime/jm_agent_runtime.py','--core-only','--query',QUERY]);
assert(node===py,'HOST_PARITY_DRIFT');
const core=JSON.parse(node);
assert(core.schema==='JM.AgentRuntimeSession/0.1'&&core.authority_class==='SESSION_ROUTER_NOT_SOURCE_AUTHORITY','ROUTER_SCOPE');
assert(core.coding?.current_identities===64&&core.coding?.activation?.selection_is_process_execution===false,'CODING_SCOPE');
assert(core.coding?.activation?.accounting?.active_route===12,'CODING_ROUTE_ACCOUNTING');
assert(core.query?.raw===QUERY&&core.estate?.current_project_heads===19,'ROUTE_QUERY_ACCOUNTING');
const candidates=core.route_candidates||[];
assert(candidates.length>0,'NO_RELEVANT_ROUTE');
const chosen=candidates.find(v=>v.kind==='current_project_head');
assert(Boolean(chosen)&&chosen.score>0,'NO_CURRENT_PROJECT_HEAD');
const allowed=new Set([ACTION]);
function mayProceed(r){
 return r.schema===SCHEMA &&
   r.sourceCommit===PIN &&
   r.taskId===source.taskId &&
   r.query===QUERY &&
   r.modelKind==='JM_SOVEREIGN_AGENT_PORTABLE_ROUTER' &&
   r.routeScope==='ROUTE_SELECTION_NOT_EXECUTION' &&
   r.actionAuthority==='SYNTHETIC_TEST_HUMAN_CADING_MANIFEST' &&
   r.sourceTarget==='JMisJustMe/JM-cading-lab' &&
   r.sourceEditFile===FILE &&
   r.destructiveAuthority===false &&
   r.permissionToPush===false &&
   r.routerCoreSha256===hash(node) &&
   allowed.has(r.allowedAction) &&
   r.allowedAction===source.requestedAction &&
   r.chosenCurrentHead?.id===chosen.id &&
   r.chosenCurrentHead?.score===chosen.score;
}
const proposal={
  schema:SCHEMA, taskId:source.taskId,
  modelKind:'JM_SOVEREIGN_AGENT_PORTABLE_ROUTER',
  sourceCommit:PIN, query:QUERY,
  routingHost:'INDEPENDENT_GITHUB_CLOUD_RUNNER',
  routeScope:'ROUTE_SELECTION_NOT_EXECUTION',
  actionAuthority:'SYNTHETIC_TEST_HUMAN_CADING_MANIFEST',
  sourceTarget:'JMisJustMe/JM-cading-lab',
  sourceEditFile:FILE, allowedAction:ACTION,
  chosenCurrentHead:chosen, candidateCount:candidates.length,
  routerCoreSha256:hash(node),
  humanApprovalInCadingManifest:true,
  destructiveAuthority:false,permissionToPush:false,
  claimBoundary:'REAL_JM_ROUTE_SELECTION_ONLY; ACTION_IS_FIXED_HUMAN_TEST_AUTHORITY_NOT_INFERRED_BY_ROUTER; NO_OPEN_ENDED_MODEL_PLANNING_OR_PRODUCTION_OWNER_APPROVAL'
};
assert(mayProceed(proposal),'NORMAL_PROPOSAL_REJECTED');
const attacks=[
 {...proposal,allowedAction:'DELETE_REPOSITORY'},
 {...proposal,sourceEditFile:'../../secrets'},
 {...proposal,sourceCommit:'0'.repeat(40)},
 {...proposal,destructiveAuthority:true},
 {...proposal,permissionToPush:true},
 {...proposal,actionAuthority:'MODEL_SELF_APPROVAL'},
 {...proposal,chosenCurrentHead:{...chosen,id:'FORGED-CROWN'}},
 {...proposal,routerCoreSha256:'0'.repeat(64)}
];
assert(attacks.every(v=>!mayProceed(v)),'HOSTILE_PROPOSAL_ACCEPTED');
const envelope={...proposal,decisionSha256:hash(proposal)};
await fs.mkdir(DEST,{recursive:true});
await fs.writeFile(path.join(DEST,'sovereign-route.json'),JSON.stringify(envelope,null,2)+'\n','utf8');
console.log(JSON.stringify({status:'PASS',stage:'JM_REAL_SOVEREIGN_ROUTER',
  taskId:source.taskId,selected:chosen.name,routerCoreSha256:proposal.routerCoreSha256,
  decisionSha256:envelope.decisionSha256,candidateCount:proposal.candidateCount,
  negativeProposalsHeld:attacks.length,claimBoundary:proposal.claimBoundary}));
