#!/usr/bin/env python3
"""JM v0.3.5: evidence-triggered, ALLOWLISTED source repair in a disposable checkout.

This is deterministic bounded automation, NOT LLM inference, NOT authority to push.
An actual observed failure is necessary before the worker may repair.
"""
import hashlib
import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path("native-src").resolve()
TARGET = ROOT / "agent-runtime/host-adapters/jm_host_adapter_conformance.py"
BASE_COMMIT = "18cb13123020e0df7c05f6402f774a24ff8f4a8e"
REPOSITORY = "JMisJustMe/JM-cading-lab"
EXPECTED_LINE = '        destination.write_text(json.dumps(receipt,sort_keys=True,indent=2)+"\\n",encoding="utf-8")'
OUT = pathlib.Path(".handoff")
FAULT_RUNNER = r'''
import os, pathlib, runpy, sys
script, destination, fault = sys.argv[1:]
dest = pathlib.Path(destination)
if fault == "partial-write":
    real = pathlib.Path.write_text
    def inject(self, content, *a, **kw):
        if self.resolve() == dest.resolve():
            with self.open("w",encoding="utf-8") as f:
                f.write("PARTIAL_FAILURE")
            raise OSError("JM_INJECTED_MID_WRITE")
        return real(self, content, *a, **kw)
    pathlib.Path.write_text = inject
elif fault == "replace-before-commit":
    real_replace = os.replace
    def inject(src,dst,*a,**kw):
        if pathlib.Path(dst).resolve() == dest.resolve():
            raise OSError("JM_INJECTED_COMMIT_FAILURE")
        return real_replace(src,dst,*a,**kw)
    os.replace = inject
else:
    raise RuntimeError("invalid fault mode")
sys.argv=[script,"--adapter","node-reference-runtime","--receipt-json",str(dest)]
runpy.run_path(script,run_name="__main__")
'''
def sha(raw):
    return hashlib.sha256(raw.encode("utf-8") if isinstance(raw,str) else raw).hexdigest()
def run(args, *, allow_fail=False, cwd=ROOT):
    p=subprocess.run(args,cwd=cwd,text=True,capture_output=True,timeout=90)
    if not allow_fail and p.returncode:
        raise RuntimeError("JM_ATOMIC_WORKER_COMMAND_HOLD: "+repr(args)+" / "+(p.stdout+p.stderr)[-900:])
    return p
def insist(cond,tag):
    if not cond:
        raise RuntimeError("JM_ATOMIC_REPAIR_HOLD:"+tag)

insist(run(["git","rev-parse","HEAD"]).stdout.strip()==BASE_COMMIT,"PINNED_SOURCE_HEAD")
insist(run(["git","status","--porcelain"]).stdout.strip()=="","START_WITH_CLEAN_SOURCE")
source=TARGET.read_text(encoding="utf-8")
insist(source.count(EXPECTED_LINE)==1 and "import tempfile" not in source and "os.replace(temp_path,destination)" not in source,"EXACT_ALLOWLIST_ANCHOR")
original_sha=sha(source)
# First show an observable corrupting failure, not merely a hypothetical lint warning.
OUT.mkdir(parents=True,exist_ok=True)
destination=(OUT/"atomic-fault-probe.json").resolve()
destination.write_text("PROTECTED_EXISTING_RECEIPT\n",encoding="utf-8")
before=run([sys.executable,"-c",FAULT_RUNNER,str(TARGET),str(destination),"partial-write"],allow_fail=True)
insist(before.returncode!=0 and "JM_INJECTED_MID_WRITE" in before.stderr,"BASE_FAULT_NOT_TRIGGERED")
insist(destination.read_text(encoding="utf-8")=="PARTIAL_FAILURE","BASE_INTEGRITY_FAILURE_NOT_OBSERVED")

# One and only one permitted remediation; source is never pushed by this worker.
imports = "import hashlib\nimport json"
insist(source.count(imports)==1,"IMPORT_ALLOWLIST")
source=source.replace(imports,"import hashlib\nimport os\nimport tempfile\nimport json",1)
replacement='''        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(mode="w",encoding="utf-8",dir=destination.parent,
                                             prefix=".jm-host-receipt-",suffix=".tmp",
                                             delete=False) as handle:
                temp_path = pathlib.Path(handle.name)
                handle.write(json.dumps(receipt,sort_keys=True,indent=2)+"\\\\n")
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temp_path,destination)
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)'''
# Ensure generated source contains Python newline escape, not literal backslash-n text.
replacement=replacement.replace('+"\\\\n")','+"\\n")')
insist(source.count(EXPECTED_LINE)==1,"REPLACEMENT_NOT_EXACT")
source=source.replace(EXPECTED_LINE,replacement,1)
TARGET.write_text(source,encoding="utf-8")

insist(run(["python3","-m","py_compile",str(TARGET)]).returncode==0,"SYNTAX")
baseline=run(["python3","agent-runtime/host-adapters/jm_host_adapter_conformance.py","--all","--run-local"]).stdout
insist("JM HOST ADAPTER CONFORMANCE: PASS" in baseline,"REAL_HOST_CONFORMANCE")
regression=run(["python3","agent-runtime/host-adapters/test_machine_receipt.py"]).stdout
proof=json.loads(regression.splitlines()[-1])
insist(proof["status"]=="PASS" and proof["deterministic_receipt"] and
       proof["fail_closed_unknown_adapter"] and proof["legacy_stdout_unchanged"],"REGRESSION")

# Repeat the exact same fault class, but now fail immediately before atomic commit.
# The old known-good result MUST survive without partial bytes or leftover temp.
destination.write_text("PROTECTED_EXISTING_RECEIPT\n",encoding="utf-8")
after=run([sys.executable,"-c",FAULT_RUNNER,str(TARGET),str(destination),"replace-before-commit"],allow_fail=True)
insist(after.returncode!=0 and "JM_INJECTED_COMMIT_FAILURE" in after.stderr,"COMMIT_FAULT_NOT_TRIGGERED")
insist(destination.read_text(encoding="utf-8")=="PROTECTED_EXISTING_RECEIPT\n","EXISTING_RESULT_DESTROYED")
insist(not list(destination.parent.glob(".jm-host-receipt-*.tmp")),"ORPHAN_TEMP")
healthy=run(["python3","agent-runtime/host-adapters/jm_host_adapter_conformance.py","--adapter","node-reference-runtime","--receipt-json",str(destination)])
receipt=json.loads(destination.read_text(encoding="utf-8"))
insist(receipt["status"]=="PASS" and receipt["adapters_checked"]==1 and
       receipt["actual_checks"]["local_node_python_core_parity"]==False,"RECOVERY_RESULT")
insist("JM HOST ADAPTER CONFORMANCE: PASS" in healthy.stdout,"RECOVERY_STDOUT")

changed=run(["git","diff","--name-only"]).stdout.strip().splitlines()
insist(changed==["agent-runtime/host-adapters/jm_host_adapter_conformance.py"],"UNBOUNDED_FILE_DIFF")
diff=run(["git","diff","--no-ext-diff","--","agent-runtime/host-adapters/jm_host_adapter_conformance.py"]).stdout
insist("os.replace(temp_path,destination)" in diff and "NamedTemporaryFile" in diff,"DIFF_NOT_ATOMIC")
insist(run(["git","diff","--check"]).returncode==0,"WHITESPACE")
proposal={
    "schema":"JM.BoundedAutonomousRepairWork/0.3.5",
    "status":"PASS",
    "sourceRepository":REPOSITORY,
    "sourceCommit":BASE_COMMIT,
    "decision":"ATOMIC_RECEIPT_REPLACEMENT",
    "decisionClass":"DETERMINISTIC_ALLOWLIST_DIAGNOSTIC_NOT_LLM_INFERENCE",
    "observedFailure":"ORIGINAL_DIRECT_WRITE_CORRUPTED_PRIOR_RECEIPT_ON_INJECTED_MID_WRITE",
    "proposedChangePaths":changed,
    "changedFilesCount":len(changed),
    "sourceBeforeSha256":original_sha,
    "sourceAfterSha256":sha(source),
    "sourceDiffSha256":sha(diff),
    "checks":{
        "baselineFaultObserved":True,
        "workerSelectedAllowlistedRepair":True,
        "candidateSourceActuallyModified":True,
        "JMHostAdapterConformancePassed":True,
        "JMExistingMachineReceiptRegressionPassed":True,
        "failureBeforeAtomicCommitPreservedOldReceipt":True,
        "noOrphanTempFiles":True,
        "healthyAtomicCommitProducedValidReceipt":True,
        "onlyAllowlistedFileChanged":True
    },
    "publishedSource":False,
    "ownerApprovalRequired":True,
    "claimBoundary":"SOURCE_EDIT_AND_TEST_ON_EPHEMERAL_CHECKOUT_ONLY; NOT_MODEL_GENERATED; NO_COMMIT_TO_JM_CADING_LAB; NO_RENDER_HOSTED_RESULT",
}
(OUT/"auto-repair-report.json").write_text(json.dumps(proposal,sort_keys=True,indent=2)+"\n",encoding="utf-8")
(OUT/"auto-repair.patch").write_text(diff,encoding="utf-8")
print(json.dumps({"stage":"JM_BOUNDED_SOURCE_REPAIR","status":"PASS","decision":proposal["decision"],
                  "checks":proposal["checks"],"sourceDiffSha256":proposal["sourceDiffSha256"],
                  "reportSha256":sha(json.dumps(proposal,sort_keys=True,separators=(',',':')))},sort_keys=True))
