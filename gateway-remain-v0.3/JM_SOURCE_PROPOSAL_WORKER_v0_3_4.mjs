// JM v0.3.4: inspect and actually test a proposed source improvement on an
// isolated GitHub runner. No write access to owner main, no merge, no AI inference.
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=path.resolve('native-src');
const repo='JMisJustMe/JM-cading-lab';
const baseCommit='e26d1ce5605016ea94a670596ab12c52b0499d33';
const proposalCommit='18cb13123020e0df7c05f6402f774a24ff8f4a8e';
const candidateBranch='jm-host-adapter-machine-receipt-v0.1-20261014';
const sha=x=>createHash('sha256').update(x).digest('hex');
function check(ok,code){if(!ok)throw new Error('JM_SOURCE_PROPOSAL_HOLD:'+code);}
function command(bin,args){
 const p=spawnSync(bin,args,{cwd:root,encoding:'utf8',timeout:90000,maxBuffer:5*1024*1024});
 if(p.status!==0)throw new Error('JM_SOURCE_PROPOSAL_EXEC_HOLD:'+bin+':'+(p.stderr||p.stdout||p.error?.message).slice(-900));
 return p.stdout.trim();
}
const head=command('git',['rev-parse','HEAD']);
check(head===proposalCommit,'UNEXPECTED_PROPOSAL_COMMIT');
const ancestor=command('git',['rev-parse',baseCommit]);
check(ancestor===baseCommit,'UNEXPECTED_BASE_COMMIT');
const changed=command('git',['diff','--name-only',baseCommit,head]).split('\n').filter(Boolean).sort();
const expected=[
 '.github/workflows/jm-host-machine-receipt-candidate.yml',
 'agent-runtime/host-adapters/jm_host_adapter_conformance.py',
 'agent-runtime/host-adapters/test_machine_receipt.py'
].sort();
check(JSON.stringify(changed)===JSON.stringify(expected),'UNBOUNDED_CHANGED_FILES:'+JSON.stringify(changed));
const sourceDiff=command('git',['diff','--no-ext-diff',baseCommit,head,'--',...expected]);
check(sourceDiff.includes('receipt-json') && sourceDiff.includes('MachineReceipt/0.1'),'NO_FUNCTIONAL_DELTA');
const legacy=command('python3',['agent-runtime/host-adapters/jm_host_adapter_conformance.py','--all','--run-local']);
check(legacy.includes('JM HOST ADAPTER CONFORMANCE: PASS'),'ORIGINAL_CONFORMANCE');
const output=command('python3',['agent-runtime/host-adapters/test_machine_receipt.py']);
const proof=JSON.parse(output.split('\n').at(-1));
check(proof.schema==='JM.HostAdapterMachineReceiptRegression/0.1'&&
  proof.status==='PASS'&&
  proof.legacy_stdout_unchanged===true&&
  proof.real_reference_parity===true&&
  proof.deterministic_receipt===true&&
  proof.fail_closed_unknown_adapter===true&&
  proof.subset_not_overclaimed===true&&
  proof.source_modified===false,'REGRESSION');
check(command('git',['status','--porcelain'])==='','CANDIDATE_CHECKOUT_CHANGED');
const result={
 schema:'JM.SourceProposalWork/0.3.4',
 status:'PASS',
 sourceRepository:repo,
 baseCommit,sourceCommit:head,candidateBranch,
 changedPaths:changed,changedFilesCount:changed.length,
 sourceDiffSha256:sha(sourceDiff),
 workerTests:{
   machineReceiptRegression:true,
   legacyOutputPreserved:true,
   failClosedNegativeControl:true,
   sourceCheckoutClean:true,
   localNodePythonParity:true,
   scopedReceiptDeterministic:true
 },
 machineReceiptSha256:proof.receipt_sha256,
 conformanceOutputSha256:sha(legacy),
 proposedImprovement:'Add fail-closed JSON receipt to existing JM host adapter conformance without changing default stdout.',
 sourceWriteAuthority:false,
 claimBoundary:'PINNED_OWNER_SOURCE_CHANGE_VERIFIED_ON_DISPOSABLE_CLOUD_CHECKOUT; DRAFT_PR_ONLY; NO_CANONICAL_WRITE_OR_REAL_AGENT_INFERENCE'
};
await fs.mkdir('.handoff',{recursive:true});
await fs.writeFile('.handoff/proposed-source-report.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({stage:'SOURCE_CANDIDATE_WORKER',status:'PASS',
 candidateCommit:head,changedFiles:changed,checks:result.workerTests,
 sourceDiffSha256:result.sourceDiffSha256,receiptSha256:proof.receipt_sha256}));
