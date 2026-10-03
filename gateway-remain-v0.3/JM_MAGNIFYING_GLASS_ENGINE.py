#!/usr/bin/env python3
"""JM Magnifying Glass 1.0 — Python 3.9+, standard library only.

RE-ENTRY: Search Library for JM_MAGNIFYING_GLASS_CONTROL.json, read current
identity/version and this engine. Search for newer Reclaim continuation heads;
read and validate ancestry, never rank canon solely by filename/date. Resolve
branches by evidence; ambiguity blocks mutation. Read referenced authority and
exclusions. Resume unfinished intents by live contact, never by replay.

This engine DOES NOT delete Library files. It enforces a portable control
protocol. External controls are exercised by compatible authorized adapters.
The instantiated pilot allows inspect only. Interpretation is not evidence.

REMOTE COMMIT: Read current control by stable ID; materialize current bytes.
Use engine transition to prepare candidate. Replace SAME control ID with
expected_current_version from current contact. Read saved identity/version and
candidate digest before action. Conflict => discard candidate, reread, rebase.
Do not remove version guard. Missing/not-found => keep existing head, block.
Claims/intents must be durably saved BEFORE any external side effect.
Landing must be durably saved and read back BEFORE reporting completion.
Prepared local candidate != durable canonical advance.

Concurrency: local file uses flock + revision/digest CAS + atomic fsync rename.
Remote files use platform expected-version CAS; claims are advisory until
confirmed. Target versions and recovery versions must be recontacted before
each side effect. No platform atomic target precondition => exactly-once
destructive execution cannot be guaranteed. Such adapters must remain disabled
or use a single authorized writer. Leases expiring NEVER authorizes replay:
contact target, recover intent, reconcile outcome, then transfer ownership.

Recovery: CLAIMED/pre-mutation -> contact then release/reclaim; FAILED/intent ->
contact target and recovery. Verified desired landing with independent outcome
evidence -> recover completion once; unchanged target -> failed/no credit;
ambiguous absence or missing carrier -> BLOCKED, zero credit. Restore only
through named recovery route and existing authority. No private thoughts needed.

CLI: python3 ENGINE.py status CONTROL.json
     python3 ENGINE.py transition CONTROL.json EXPECTED_REV EVENT.json
     python3 ENGINE.py selftest
For remote work use a disposable local candidate, then guarded Library replace.
Do not call transition on a stale local copy and treat it as remotely canonical.
"""
import copy, hashlib, json, os, sys, tempfile, time
from pathlib import Path
import fcntl
if not __debug__:
    raise RuntimeError("Run without -O: protocol checks must remain enabled")

STATUSES = ["AVAILABLE","CLAIMED","COMPLETED","SKIPPED_AS_STALE","BLOCKED","HOLD","FAILED_NEEDS_RECOVERY"]
def digest(x):
    return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(",",":")).encode()).hexdigest()
def seal(s):
    s["digest"] = digest({k:v for k,v in s.items() if k != "digest"})
    return s
def validate(s):
    assert s["protocol"] == "JM.MagnifyingGlass/1.0"
    assert isinstance(s["revision"],int) and s["revision"] >= 0
    assert s["digest"] == digest({k:v for k,v in s.items() if k != "digest"}), "corrupt state"
    assert len(s["credited_keys"]) == len(set(s["credited_keys"])), "duplicate credit"
    for c in s["cages"].values():
        assert c["status"] in STATUSES
        assert set(c["authority"]).issubset(s["authority"]["allowed"])
    for env in s.get("evidence",{}).values():envelope_validate(env)
    if s.get("transport"):transport_validate(s["transport"])
    return s

def recover_pilot(control, archive, contact):
    """Cold worker: consumes only durable control, fresh bytes and live adapter contact."""
    import zipfile, io
    s=validate(json.loads(Path(control).read_text()))
    r=json.loads(Path(contact).read_text())
    head=next(x for x in r["results"] if x.get("library_file_id")==s["source_head"]["id"])
    assert not head.get("warnings"), "head contact failed"
    assert head["version_id"] == s["source_head"]["version"], "source changed"
    t="\n".join(head["content"])
    assert hashlib.sha256(t.encode()).hexdigest()==s["source_head"]["content_sha256"], "source changed"
    b=Path(archive).read_bytes();p=s["pilot"]["recovery_restore"]
    assert len(b)==p["bytes"] and hashlib.sha256(b).hexdigest()==p["sha256"]
    z=zipfile.ZipFile(io.BytesIO(b));assert z.testzip() is None
    for member in p["members"]:
        data=z.read(member["member"])
        assert len(data)==member["bytes"] and hashlib.sha256(data).hexdigest()==member["sha256"]
        assert zipfile.ZipFile(io.BytesIO(data)).testzip() is None
    # Historical source completed ledger + unavailable live IDs prevents new credit.
    retired=["libfile_1eb200d32e588191b9085483b92faf13","libfile_e2689138def081919347e4c529b28db1","libfile_24688438c2c881919cde468c8bee7244"]
    for target in retired:
        assert target in s["completed"]["trash_ids"]
        row=next(x for x in r["results"] if (x.get("library_file_id") or x.get("ref_id"))==target)
        assert row.get("warnings"), "target returned active; investigate, do not replay"
    cid="playform-recovery-001";c=s["cages"][cid]
    ev={"refs":[s["source_head"]["id"],p["carrier_id"],"sha256:"+p["sha256"]],
      "entry_verified":True,"head_verified":True,"recovery_present":True,"recontact":True,
      "outcome":"verified_inspection","operation_key":c["intent"]["operation_key"],"bytes":0,
      "proof":"fresh carrier SHA + three restored member hashes/sizes/CRC; historical completed IDs unavailable at live contact"}
    e={"kind":"recover","cage":cid,"worker":"Worker-B-cold-process","entry_digest":s["digest"],"evidence":ev}
    n=apply(s,e)
    n["pilot"]["cold_recovery"]={"result":"PASS","method":"fresh interpreter; durable control + downloaded engine + current carrier + current adapter contacts only","prior_worker_memory":False,"retired_targets_skipped":3,"new_mutation_credit":0}
    n["next_action"]="Issue inspect-only Visualang modified-carrier / patch-dependency cage; locate current identities, compare fresh bytes and recovery relationships before proposing any gate."
    seal(n)
    candidate=Path(control).with_name("JM_MAGNIFYING_GLASS_CONTROL_RECOVERED.json")
    candidate.write_text(json.dumps(n,indent=2)+"\n")
    print(json.dumps({"candidate":str(candidate),"revision":n["revision"],"digest":n["digest"],"remote_commit_required":True}))

# Exact machine-readable schemas, carried in the same executable body.
SCHEMA = {
 "control":{"protocol":"constant JM.MagnifyingGlass/1.0","owner":"string",
 "body":"string","revision":"integer","digest":"sha256 of canonical JSON excluding digest",
 "parent_digest":"sha256|null","source_head":"{id,version,content_sha256,modified_at}",
 "lineage":"array of source references","completed":"{trash_ids:array,thinned_ids:array,source_refs:array}",
 "authority":"{allowed:array,prohibited:array,destructive_enabled:boolean}",
 "exclusions":"{protected_ids:array,holds:array,source_refs:array}",
 "unknowns":"array","accounting":"object","current_target":"string",
 "cages":"map cage_id -> cage","credited_keys":"unique array","last_landing":"object|null",
 "next_action":"string","material_deltas":"array","pilot":"object",
 "reentry":"object","durability":"object","adapter":"object","evidence":"object"},
 "cage":{"id":"string","worker":"string|null","entry_digest":"sha256",
 "target":"{id,version}|territory string","authority":"array",
 "exclusions":"array","expected_outputs":"array","mutation_boundary":"string",
 "verification":"array","exit":"string","recovery":"string",
 "accounting_rule":"string","status":"status enum","intent":"object|null","landing":"object|null"},
 "event":{"kind":"issue|claim|intent|land|recover|block|release",
 "cage":"string","worker":"string where acting","entry_digest":"current digest",
 "target":"object for issue","authority":"array for issue",
 "evidence":"{refs:array,entry_verified:boolean,head_verified:boolean,recovery_present:boolean,recontact:boolean,outcome:string,operation_key:string,bytes:integer}",
 "reason":"string for block","observed_version":"explicit external version where applicable"}
}
def json_schema():
    """Exact top-level and cage JSON Schema; evidence semantics are enforced by apply."""
    props={}
    for k,v in SCHEMA["control"].items():
        typ=("integer" if k=="revision" else "array" if k in
          ("lineage","unknowns","credited_keys","material_deltas") else "object" if k in
          ("source_head","completed","authority","exclusions","accounting","cages","pilot","reentry","durability","adapter","evidence")
          else "string")
        props[k]={"type":typ,"description":v}
    props["protocol"]={"const":"JM.MagnifyingGlass/1.0"}
    props["parent_digest"]={"type":["string","null"]}
    props["last_landing"]={"type":["object","null"]}
    props["revision"]["minimum"]=0
    props["credited_keys"]={"type":"array","uniqueItems":True,"items":{"type":"string"}}
    props["digest"]={"type":"string","pattern":"^[a-f0-9]{64}$"}
    cage_props={}
    for k,v in SCHEMA["cage"].items():
        typ="array" if k in ("authority","exclusions","expected_outputs","verification") else "string"
        cage_props[k]={"type":typ,"description":v}
    cage_props["worker"]={"type":["string","null"]}
    cage_props["target"]={"type":["object","string"]}
    cage_props["status"]={"enum":STATUSES}
    for k in ("intent","landing"):cage_props[k]={"type":["object","null"]}
    cage_props["blocker"]={"type":"string"}
    props["cages"]={"type":"object","additionalProperties":{"$ref":"#/$defs/cage"}}
    props["evidence"]={"type":"object","additionalProperties":{"$ref":"#/$defs/envelope"}}
    ep={k:{"type":v} for k,v in {
      "protocol":"string","id":"string","cage":"string","sequence":"integer","prepared_revision":"integer",
      "authority_hash":"string","authority":"object","target":"object","survivor":"object","action":"string",
      "observed":"object","measurement":"object","historical":"object","interpretation":"object",
      "mutation":"object","accounting":"object","phase":"string","digest":"string"}.items()}
    ep["protocol"]={"const":"JM.EvidenceEnvelope/1.0"}
    ep["precondition"]={"type":["object","null"]};ep["post"]={"type":["object","null"]}
    ep["action"]={"enum":["audit","retire"]}
    optional={"transport":{"type":"object","required":["protocol","domains","inventory","envelopes"],
      "properties":{"protocol":{"const":"JM.TransportTrust/1.0"},"domains":{"type":"object"},
      "inventory":{"type":"object"},"envelopes":{"type":"object"},"tests":{"type":"object"}},"additionalProperties":True}}
    return {"$schema":"https://json-schema.org/draft/2020-12/schema",
      "$id":"urn:jm:magnifying-glass:control:1.0","type":"object",
      "required":list(props),"properties":{**props,**optional},"additionalProperties":False,
      "$defs":{"envelope":{"type":"object","required":list(ep),"properties":ep,"additionalProperties":False},
      "cage":{"type":"object","required":list(SCHEMA["cage"]),
      "properties":cage_props,"additionalProperties":False}}}
def apply(s,e):
    validate(s)
    if e["cage"] in s.get("adapter",{}).get("strict_cages",[]) and e["kind"] in ("intent","land","recover"):
        assert e.get("_adapter_token") is _ADAPTER_TOKEN, "raw worker evidence forbidden; use evidence adapter"
    assert e["entry_digest"] == s["digest"], "stale checkpoint"
    n=copy.deepcopy(s); kind=e["kind"]; cid=e["cage"]
    if kind == "issue":
        assert cid not in n["cages"], "existing cage"
        assert not any(target_identity(c["target"])==target_identity(e["target"]) and c["status"] in
          ("AVAILABLE","CLAIMED","FAILED_NEEDS_RECOVERY","COMPLETED")
          for c in n["cages"].values()), "target already queued/in flight/completed"
        a=e["authority"]; assert a and set(a).issubset(n["authority"]["allowed"]), "authority enlargement"
        if n.get("adapter",{}).get("version"):
            n["adapter"].setdefault("strict_cages",[]).append(cid)
        n["cages"][cid]={"id":cid,"worker":None,"entry_digest":s["digest"],
          "target":e["target"],"authority":a,"exclusions":n["exclusions"]["protected_ids"],
          "expected_outputs":["verified landing or material blocker"],
          "mutation_boundary":"inspect only; no external content mutation",
          "verification":["current head","identity/version","recovery presence","live recontact","durable landing"],
          "exit":"one bounded target; confirmed landing or blocker",
          "recovery":"recontact target and named carriers; reconcile intent; never blind replay",
          "accounting_rule":"one operation key once; stale skip zero; quota unclaimed",
          "status":"AVAILABLE","intent":None,"landing":None}
    else:
        c=n["cages"][cid]
        if kind == "claim":
            assert c["status"] == "AVAILABLE", "already claimed/completed"
            c.update(worker=e["worker"],status="CLAIMED",entry_digest=s["digest"])
        elif kind == "block":
            assert e.get("reason")
            assert c["status"] != "COMPLETED"
            c["status"]="BLOCKED";c["blocker"]=e["reason"]
        elif kind == "release":
            assert c["worker"] == e["worker"] and c["intent"] is None
            c.update(worker=None,status="AVAILABLE")
        else:
            ev=e["evidence"]
            assert ev.get("refs") and all(isinstance(x,str) and x for x in ev["refs"]), "unsupported interpretation"
            assert all(ev.get(k) is True for k in ("entry_verified","head_verified","recovery_present","recontact")), "unverified entry/recovery"
            if kind == "intent":
                assert c["status"] == "CLAIMED" and c["worker"] == e["worker"]
                assert c["intent"] is None
                assert ev["operation_key"] not in n["credited_keys"], "duplicate operation"
                c["intent"]=ev; c["status"]="FAILED_NEEDS_RECOVERY"
            elif kind in ("land","recover"):
                assert c["status"] in ("CLAIMED","FAILED_NEEDS_RECOVERY")
                if kind == "land": assert c["worker"] == e["worker"]
                key=ev["operation_key"]; assert key not in n["credited_keys"], "double credit"
                if c["intent"]: assert key == c["intent"]["operation_key"], "intent mismatch"
                outcome=ev["outcome"]
                assert outcome in ("verified_inspection","verified_mutation","already_completed","unchanged","ambiguous")
                if outcome == "verified_mutation":
                    assert n["authority"]["destructive_enabled"], "destructive adapter disabled"
                    assert c["intent"] and "mutate" in c["authority"]
                    assert ev.get("mutation_receipt") and ev.get("landing_identity")
                if outcome in ("verified_inspection","verified_mutation"):
                    assert isinstance(ev["bytes"],int) and ev["bytes"] >= 0
                    if outcome=="verified_inspection": assert ev["bytes"] == 0
                    c.update(status="COMPLETED",landing=ev,worker=None)
                    n["credited_keys"].append(key)
                    n["last_landing"]={"cage":cid,"evidence":ev}
                elif outcome == "already_completed":
                    assert ev["bytes"] == 0
                    c.update(status="SKIPPED_AS_STALE",landing=ev,worker=None)
                else:
                    assert ev["bytes"] == 0
                    c["status"]="BLOCKED" if outcome=="ambiguous" else "FAILED_NEEDS_RECOVERY"
                    c["landing"]=ev
            else: raise AssertionError("unknown transition")
    n["revision"]+=1;n["parent_digest"]=s["digest"]
    # Material summaries only; no prompts, searches or private reasoning.
    n["material_deltas"].append({"revision":n["revision"],"kind":kind,"cage":cid})
    n["material_deltas"]=n["material_deltas"][-32:]
    return validate(seal(n))
def update(path,rev,e):
    path=Path(path)
    with open(str(path)+".lock","a") as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        s=json.loads(path.read_text());assert s["revision"]==rev, "revision conflict"
        n=apply(s,e)
        fd,tmp=tempfile.mkstemp(dir=path.parent,prefix=".jm-")
        try:
            with os.fdopen(fd,"w") as f:
                json.dump(n,f,indent=2);f.write("\n");f.flush();os.fsync(f.fileno())
            os.replace(tmp,path)
            d=os.open(path.parent,os.O_RDONLY);os.fsync(d);os.close(d)
        finally:
            if os.path.exists(tmp):os.unlink(tmp)
        return n
def fixture():
    return seal({"protocol":"JM.MagnifyingGlass/1.0","owner":"JM","body":"test",
     "revision":0,"parent_digest":None,"authority":{"allowed":["inspect"],"destructive_enabled":False},
     "exclusions":{"protected_ids":[]},"cages":{},"credited_keys":[],"material_deltas":[],"last_landing":None})
def event(s,kind,**kw):
    return {"kind":kind,"cage":"test","entry_digest":s["digest"],**kw}
def proof(outcome="verified_inspection"):
    return {"refs":["fixture:independent-contact"],"entry_verified":True,"head_verified":True,
     "recovery_present":True,"recontact":True,"outcome":outcome,"operation_key":"once","bytes":0}
def selftest():
    def setup():
        s=fixture();s=apply(s,event(s,"issue",target="test",authority=["inspect"]))
        return apply(s,event(s,"claim",worker="A"))
    def denied(fn):
        try:fn()
        except (AssertionError,KeyError):return
        raise AssertionError("invalid transition accepted")
    results={}
    s=setup();s=json.loads(json.dumps(s));s=apply(s,event(s,"release",worker="A"))
    s=apply(s,event(s,"claim",worker="B"));results["A"]="PASS: serialized claim survives worker disappearance"
    s=setup();s=apply(s,event(s,"intent",worker="A",evidence=proof()))
    s=json.loads(json.dumps(s));s=apply(s,event(s,"recover",worker="B",evidence=proof()))
    results["B"]="PASS: independent landing evidence reconciles intent once; mutation adapter simulation only"
    denied(lambda:apply(s,event(s,"recover",worker="B",evidence=proof())))
    s=setup();s=apply(s,event(s,"intent",worker="A",evidence=proof()))
    s=apply(s,event(s,"recover",worker="B",evidence=proof("unchanged")))
    assert not s["credited_keys"];results["C"]="PASS: failed side effect never earns completion"
    s=setup();denied(lambda:apply(s,event(s,"claim",worker="B")));results["D"]="PASS: second claim denied"
    denied(lambda:apply(s,{"kind":"issue","cage":"different-worker-cage",
      "entry_digest":s["digest"],"target":"test","authority":["inspect"]}))
    results["D"]="PASS: same cage and same target under different cage both denied"
    denied(lambda:apply(s,{"kind":"claim","cage":"test","entry_digest":"stale","worker":"B"}))
    results["E"]="PASS: stale digest denied"
    p=proof();p["recovery_present"]=False
    denied(lambda:apply(s,event(s,"land",worker="A",evidence=p)));results["F"]="PASS: missing recovery blocks landing"
    with tempfile.TemporaryDirectory() as d:
        path=Path(d)/"state.json";path.write_text(json.dumps(s))
        # Worker B is a separate interpreter with no A memory.
        import subprocess
        out=subprocess.check_output([sys.executable,__file__,"status",str(path)],text=True)
        assert '"CLAIMED"' in out
        update(path,s["revision"],event(s,"release",worker="A"))
        denied(lambda:update(path,s["revision"],event(s,"release",worker="A")))
    results["G"]="PASS: fresh interpreter reconstructs state; disk CAS rejects stale writer"
    p=proof();p["head_verified"]=False
    denied(lambda:apply(s,event(s,"land",worker="A",evidence=p)));results["H"]="PASS: unvalidated newer head blocks"
    p=proof();p["refs"]=[]
    denied(lambda:apply(s,event(s,"land",worker="A",evidence=p)));results["I"]="PASS: unsupported interpretation denied"
    assert s["cages"]["test"]["status"]=="CLAIMED" and not s["credited_keys"]
    results["J"]="PASS: external success without commit remains unresolved, zero durable credit"
    s=apply(s,event(s,"land",worker="A",evidence=proof("already_completed")))
    assert not s["credited_keys"];results["stale_skip"]="PASS: no failure and no credit"
    denied(lambda:apply(fixture(),event(fixture(),"issue",target="x",authority=["mutate"])))
    results["authority"]="PASS: cage cannot enlarge scope"
    print(json.dumps(results,indent=2))
    return results
# Evidence adapter 1.0. The trusted boundary is the host/tool transport and byte
# measurement code, not a worker's boolean assertion. Captures are not signed
# by Library. Cold recontact is mandatory; digest integrity is not authenticity.
# Library has no atomic target+survivor conditional mutation exposed here:
# this adapter refuses Library destructive dispatch, even after a passing gate.
_ADAPTER_TOKEN=object()
BRIDGE_JS = r"""const ids=load("jm_contact_ids"); const started=Date.now();
const replies=[]; for(let i=0;i<ids.length;i+=5) {
 const r=await tools.mcp__codex_apps__library_read({read:ids.slice(i,i+5).map(ref_id=>({ref_id,include_text:true,include_images:false,max_lines:5000}))});
 for(const row of r.structuredContent.results) {
  if(!row.has_more) continue;
  const version=row.version_id; const parts=[(row.content||[]).join("\n")];
  let current=row, pages=1;
  while(current.has_more) {
   const req=current.next_read || {ref_id:row.library_file_id||row.ref_id,start_line:current.next_start_line,max_lines:5000};
   if(!req.ref_id || (!req.start_line && !req.start_page)) throw Error("Missing pagination route");
   req.version_id=version;
   const more=await tools.mcp__codex_apps__library_read({read:[req]});
   current=more.structuredContent.results[0];
   if(current.version_id!==version || current.warnings?.length) throw Error("Version changed during paged contact");
   if(current.start_line && current.start_line!==((pages===1?row.end_line:row._page_end)+1)) throw Error("Non-contiguous contact");
   parts.push((current.content||[]).join("\n"));row._page_end=current.end_line;pages++;
  }
  row.content=[parts.join("\n")];row.has_more=false;row.end_line=current.end_line;
  row._contact_pages=pages;row.next_read=null;row.next_start_line=null;
 }
 replies.push(r.structuredContent);
}
text({origin:"host_tool_capture",method:"files/read",requested_ids:ids,
started_ms:started,finished_ms:Date.now(),replies});
"""
def normalize_capture(raw):
    assert raw["origin"]=="host_tool_capture" and raw["method"]=="files/read"
    assert raw["started_ms"]<=raw["finished_ms"]
    objects={}
    for reply in raw["replies"]:
        assert reply["api_tool_source"]=="files/read"
        for row in reply["results"]:
            ident=row.get("library_file_id") or row.get("ref_id")
            assert ident in raw["requested_ids"]
            live=not row.get("warnings") and isinstance(row.get("size_bytes"),int)
            obj={"id":ident,"ref":"library:"+ident,"state":"ACTIVE" if live else "UNAVAILABLE",
              "version":row.get("version_id"),"size":row.get("size_bytes"),
              "file_id":row.get("file_id"),"modified_at":row.get("modified_at"),
      "name":row.get("name"),"source":"live_platform_tool_contact",
      "provenance":trust_provenance("platform_metadata","files/read")}
            if row.get("mime_type")=="application/json" and row.get("content"):
                assert not row.get("has_more"), "partial control contact"
                try:
                    body=json.loads("\n".join(row["content"]))
                    if body.get("protocol")=="JM.MagnifyingGlass/1.0":
                        validate(body);obj["control_revision"]=body["revision"];obj["control_digest"]=body["digest"]
                except (ValueError,AttributeError):pass
            if str(row.get("mime_type","")).startswith("text/") and row.get("content"):
                assert not row.get("has_more"), "partial source contact"
                obj["content_sha256"]=hashlib.sha256("\n".join(row["content"]).encode()).hexdigest()
            if row.get("warnings"):obj["contact_warning"]=row["warnings"]
            objects[ident]=obj
    assert set(objects)==set(raw["requested_ids"]), "incomplete contact"
    return {"origin":"host_tool_capture","method":raw["method"],"started_ms":raw["started_ms"],
      "finished_ms":raw["finished_ms"],"response_sha256":digest(raw),"objects":objects,
      "authenticity":"trusted host transport; no platform signature",
      "provenance":trust_provenance("platform_content_retrieval","files/read")}

def visualang_measure(target,closure):
    """No archive scripts executed. Facts derive from actual bytes and ZIP members."""
    import zipfile,io,subprocess
    tb=Path(target).read_bytes();cb=Path(closure).read_bytes()
    t=zipfile.ZipFile(io.BytesIO(tb));z=zipfile.ZipFile(io.BytesIO(cb))
    assert t.testzip() is None and z.testzip() is None
    mn=next(n for n in z.namelist() if n.endswith("LEAN_RECOVERY_MANIFEST.json"))
    manifest=json.loads(z.read(mn));bn=next(n for n in z.namelist() if n.endswith("/"+manifest["base"]))
    bb=z.read(bn);base=zipfile.ZipFile(io.BytesIO(bb));assert base.testzip() is None
    def members(a):return {n:hashlib.sha256(a.read(n)).hexdigest() for n in a.namelist() if not n.endswith("/")}
    a=members(base);b=members(t)
    removed=sorted(a.keys()-b.keys());added=sorted(b.keys()-a.keys())
    changed=sorted(k for k in a.keys()&b.keys() if a[k]!=b[k])
    patches=[]
    with tempfile.TemporaryDirectory() as d:
        root=Path(d);bp=root/"base.zip";bp.write_bytes(bb)
        for pn in z.namelist():
            if not pn.endswith(".zstpatch"):continue
            name=pn.rsplit("/",1)[-1][:-9];expected=manifest["rehydrated"][name]
            pp=root/"patch";pp.write_bytes(z.read(pn));out=root/"restored"
            rc=subprocess.run(["zstd","-d","--patch-from="+str(bp),str(pp),"-o",str(out),"-f"],capture_output=True)
            good=out.read_bytes() if out.exists() else b""
            assert rc.returncode==0 and len(good)==expected["bytes"] and hashlib.sha256(good).hexdigest()==expected["sha256"]
            assert zipfile.ZipFile(io.BytesIO(good)).testzip() is None
            out.unlink()
            rc2=subprocess.run(["zstd","-d","--patch-from="+str(Path(target)),str(pp),"-o",str(out),"-f"],capture_output=True)
            other=out.read_bytes() if out.exists() else b""
            patches.append({"member":pn,"patch_sha256":hashlib.sha256(z.read(pn)).hexdigest(),
              "restored_bytes":len(good),"restored_sha256":hashlib.sha256(good).hexdigest(),
              "declared_sha256":expected["sha256"],"restore_crc":"PASS",
              "embedded_base":"PASS","modified_base_matches":rc2.returncode==0 and hashlib.sha256(other).hexdigest()==expected["sha256"]})
            out.unlink(missing_ok=True)
    route_name=next(n for n in added if n.endswith("JM_THIRD_QUASH_GIF_ROUTE.json"))
    route=json.loads(t.read(route_name));gif=next(n for n in removed if n.endswith(".gif"))
    assert route["sha256"]==a[gif] and route["bytes"]==len(base.read(gif))
    return {"origin":"deterministic_byte_measurement","target":{"size":len(tb),"sha256":hashlib.sha256(tb).hexdigest()},
      "survivor":{"size":len(cb),"sha256":hashlib.sha256(cb).hexdigest()},
      "relationship":{"kind":"UNEQUAL_LEAN_DESCENDANT","exact_duplicate":False,
        "embedded_base":{"member":bn,"size":len(bb),"sha256":hashlib.sha256(bb).hexdigest()},
        "shared_unchanged":sum(a[k]==b[k] for k in a.keys()&b.keys()),"shared_changed":changed,
        "removed":[{"member":gif,"size":len(base.read(gif)),"sha256":a[gif]}],
        "added":[{"member":route_name,"size":len(t.read(route_name)),"sha256":b[route_name],"route":route}],
        "patches":patches,"closure_required":True,
        "mutation_proof":"NOT EXACT REDUNDANCY; closure embedded base is required by verified patches"}}

def gif_reference_measure(target, closure, observation, root_listing):
    """Bounded reference audit. Missing contact is never proof of deletion.
    root_listing is raw live files/list output; byte integrity does not attest
    platform authenticity. Both materialization and read still trust one host.
    """
    import zipfile, io
    m=visualang_measure(target,closure)
    rel=m["relationship"];route=rel["added"][0]["route"]
    ref=route["target"]["file_id"]
    destination=copy.deepcopy(observation["objects"][ref])
    assert root_listing["surface"]=="library"
    assert not root_listing.get("warnings") and not root_listing.get("next_cursor"), "incomplete root listing"
    matches=[r for r in root_listing["items"] if r.get("path")==route["target"]["library_path"]]
    z=zipfile.ZipFile(closure);base=zipfile.ZipFile(io.BytesIO(z.read(rel["embedded_base"]["member"])))
    gif=base.read(route["logical_path"])
    assert len(gif)==route["bytes"] and hashlib.sha256(gif).hexdigest()==route["sha256"]
    assert gif[:6] in (b"GIF87a",b"GIF89a")
    rel["reference_audit"]={"recorded":route["target"],"live_reference":destination,
      "root_matches":[{k:r.get(k) for k in ("library_file_id","file_id","path","version_id","size_bytes")} for r in matches],
      "root_scope":"nonrecursive /; GIF filter; complete returned listing only",
      "recovery":{"member":route["logical_path"],"size":len(gif),"sha256":hashlib.sha256(gif).hexdigest(),"format":"GIF"},
      "determination":"DESTINATION_UNVERIFIED" if destination["state"]!="ACTIVE" else "DESTINATION_REQUIRES_BYTE_COMPARISON",
      "absence_claim":"not returned in scoped listing" if not matches else None,
      "deleted_claim":False,"authenticity":"same host transport; no independent platform attestation"}
    return m

def authority_hash(s,cid):
    return digest({"authority":s["authority"],"cage_authority":s["cages"][cid]["authority"],
      "protected":s["exclusions"]["protected_ids"],"completed":s.get("completed",{})})
def target_identity(target):
    if isinstance(target,dict):return target.get("id") or target.get("family") or digest(target)
    return target
def observation_snapshot(obs,ident,measured):
    x=copy.deepcopy(obs["objects"][ident])
    assert x["state"]=="ACTIVE" and x["size"]==measured["size"], "contact/bytes mismatch"
    x["sha256"]=measured["sha256"];return x
def evidence_prepare(s,cid,worker,obs,measured,target_id,survivor_id,action="audit"):
    validate(s);c=s["cages"][cid]
    assert c["status"]=="CLAIMED" and c["worker"]==worker
    assert cid in s["adapter"]["strict_cages"]
    assert obs["objects"][s["durability"]["control_id"]]["control_digest"]==s["adapter"]["contact_entry_digest"]
    assert action in ("audit","retire")
    target=observation_snapshot(obs,target_id,measured["target"])
    survivor=observation_snapshot(obs,survivor_id,measured["survivor"])
    assert not any(v["target"]["id"]==target_id and v["cage"]!=cid and
      (v["phase"] in ("PREPARED","VERIFIED_MUTATION") or
       (action=="retire" and v["phase"]=="VERIFIED_INSPECTION"))
      for v in s.get("evidence",{}).values()), "target has existing evidence intent"
    key=digest({"cage":cid,"target":target_id,"target_sha":target["sha256"],"action":action})
    assert key not in s["credited_keys"]
    env={"protocol":"JM.EvidenceEnvelope/1.0","id":key,"cage":cid,"sequence":s["revision"]+1,
      "prepared_revision":s["revision"]+1,"authority_hash":authority_hash(s,cid),
      "authority":{"origin":"durable_JM_machinery","control_id":s["durability"]["control_id"],
        "scope":c["authority"],"destructive_enabled":s["authority"]["destructive_enabled"]},
      "target":target,"survivor":survivor,"action":action,"observed":obs,"measurement":measured,
      "historical":{"source_head":s.get("source_head"),"proof_role":"context, never live mutation proof"},
      "interpretation":{"proof_role":"routing only; cannot authorize","claim":None},
      "precondition":None,"mutation":{"attempted":False,"response":None},"post":None,
      "accounting":{"bytes":0,"quota_credit":None},"phase":"PREPARED"}
    env["digest"]=digest(env)
    n=copy.deepcopy(s);n.setdefault("evidence",{})[key]=env
    n["cages"][cid]["target"]={"id":target_id,"version":target["version"]}
    seal(n)
    ev={"refs":["envelope:"+key],"entry_verified":True,"head_verified":True,"recovery_present":True,
      "recontact":True,"outcome":"verified_inspection","operation_key":key,"bytes":0}
    return apply(n,{"kind":"intent","cage":cid,"worker":worker,"entry_digest":n["digest"],
      "_adapter_token":_ADAPTER_TOKEN,"evidence":ev})
def envelope_validate(env):
    assert env["digest"]==digest({k:v for k,v in env.items() if k!="digest"}), "envelope corrupted"
    assert env["protocol"]=="JM.EvidenceEnvelope/1.0"
    assert env["measurement"]["origin"]=="deterministic_byte_measurement"
    assert env["observed"]["origin"]=="host_tool_capture"
    return env
def envelope_seal(e):
    e["digest"]=digest({k:v for k,v in e.items() if k!="digest"});return e
def precondition(s,key,fresh,measured,now_ms=None):
    env=envelope_validate(s["evidence"][key]);cid=env["cage"]
    reasons=[];now_ms=int(time.time()*1000) if now_ms is None else now_ms
    if s["revision"]!=env["prepared_revision"]:reasons.append("CONTROL_REVISION_ADVANCED")
    if authority_hash(s,cid)!=env["authority_hash"]:reasons.append("AUTHORITY_OR_EXCLUSIONS_CHANGED")
    co=fresh["objects"].get(s["durability"]["control_id"],{})
    if co.get("control_revision")!=s["revision"] or co.get("control_digest")!=s["digest"]:reasons.append("LIVE_CONTROL_DISAGREES")
    if not 0<=now_ms-fresh["finished_ms"]<=60000:reasons.append("CONTACT_EXPIRED")
    head=env["historical"].get("source_head")
    if head:
        actual=fresh["objects"].get(head["id"],{})
        if actual.get("state")!="ACTIVE" or actual.get("version")!=head["version"] or actual.get("content_sha256")!=head["content_sha256"]:
            reasons.append("RECLAIM_HEAD_CHANGED_OR_UNVERIFIED")
    for role in ("target","survivor"):
        expected=env[role];actual=fresh["objects"].get(expected["id"],{})
        if actual.get("state")!="ACTIVE":reasons.append(role.upper()+"_UNAVAILABLE");continue
        for field in ("id","version","size","file_id","modified_at"):
            if actual.get(field)!=expected.get(field):reasons.append(role.upper()+"_"+field.upper()+"_CHANGED")
        if measured[role]!=env["measurement"][role]:reasons.append(role.upper()+"_BYTES_CHANGED")
    if measured["relationship"]!=env["measurement"]["relationship"]:reasons.append("RELATION_CHANGED")
    if env["action"]=="retire":
        if not s["authority"]["destructive_enabled"] or "mutate" not in s["cages"][cid]["authority"]:reasons.append("NO_MUTATION_AUTHORITY")
        if not measured["relationship"].get("exact_duplicate"):reasons.append("EXACT_RELATION_UNPROVED")
        if env["target"]["id"] in s["exclusions"]["protected_ids"]:reasons.append("PROTECTED_TARGET")
        if env["target"]["id"] in s.get("completed",{}).get("trash_ids",[]):reasons.append("ALREADY_COMPLETED")
    return {"result":"BLOCK" if reasons else "PASS","reasons":sorted(set(reasons)),
      "at_ms":now_ms,"control_revision":s["revision"],"contact_sha256":digest(fresh),
      "measurement_sha256":digest(measured),"accounting_bytes":0}
def evidence_land(s,key,fresh,measured,worker="cold-worker"):
    """Inspection landing derived from fresh contact + remeasured bytes, never worker booleans."""
    gate=precondition(s,key,fresh,measured);env=copy.deepcopy(s["evidence"][key]);cid=env["cage"]
    env["precondition"]=gate;env["post"]={"contact":fresh,"measurement_sha256":digest(measured)}
    env["phase"]="VERIFIED_INSPECTION" if gate["result"]=="PASS" and env["action"]=="audit" else "BLOCKED"
    n=copy.deepcopy(s);n["evidence"][key]=envelope_seal(env);seal(n)
    if env["phase"]=="BLOCKED":
        return apply(n,{"kind":"block","cage":cid,"entry_digest":n["digest"],"reason":",".join(gate["reasons"]) or "USE_CONDITIONAL_TRANSACTION"})
    ev={"refs":["envelope:"+key],"entry_verified":True,"head_verified":True,"recovery_present":True,
      "recontact":True,"outcome":"verified_inspection","operation_key":key,"bytes":0}
    return apply(n,{"kind":"recover","cage":cid,"worker":worker,"entry_digest":n["digest"],
      "_adapter_token":_ADAPTER_TOKEN,"evidence":ev})

def conditional_transaction(s,key,gateway):
    """Calls fresh contacts INSIDE dispatch, then backend atomic target+recovery CAS.
    Requires intent already persisted and read back. Gateway supplies independent
    control/target/survivor contact, byte measurement and durable operation journal.
    Library gateway lacks atomic capability and is therefore refused.
    """
    env=envelope_validate(s["evidence"][key])
    fresh,measure=gateway.contact(s,env);gate=precondition(s,key,fresh,measure)
    if gate["result"]!="PASS":return {"decision":"BLOCK","gate":gate,"attempted":False,"bytes":0}
    if env["action"]!="retire":return {"decision":"INSPECT_ONLY","gate":gate,"attempted":False,"bytes":0}
    if not gateway.atomic_target_and_survivor:
        return {"decision":"BLOCK","gate":gate,"reason":"NO_ATOMIC_TARGET_AND_SURVIVOR_PRECONDITION","attempted":False,"bytes":0}
    receipt=gateway.mutate_if_matches(key,env["target"],env["survivor"],
      {"digest":s["digest"],"revision":s["revision"]})
    post=gateway.landing(env)
    return reconcile_transaction(env,receipt,post)
def reconcile_transaction(env,receipt,post):
    """No intended result can stand in for observed landing. Missing receipt
    or ambiguous absence is BLOCKED; foreign retirement is a zero-credit skip."""
    if not receipt:return {"decision":"BLOCK","reason":"NO_DURABLE_OPERATION_RECEIPT","bytes":0}
    if receipt.get("operation_key")!=env["id"]:return {"decision":"SKIP","reason":"FOREIGN_OPERATION","bytes":0}
    if receipt.get("expected_target")!=env["target"] or receipt.get("expected_survivor")!=env["survivor"]:
        return {"decision":"BLOCK","reason":"RECEIPT_PRECONDITION_MISMATCH","bytes":0}
    if receipt.get("conditional_check") is not True:
        return {"decision":"BLOCK","reason":"PRECONDITION_NOT_CONFIRMED","bytes":0}
    if post["survivor"]!=env["survivor"]:return {"decision":"BLOCK","reason":"RECOVERY_CHANGED","bytes":0}
    if receipt["status"]=="succeeded" and post["target"]["state"]=="RETIRED" and post["target"]["id"]==env["target"]["id"]:
        return {"decision":"VERIFIED_MUTATION","operation_key":env["id"],"receipt":receipt,"post":post,"bytes":env["target"]["size"]}
    return {"decision":"BLOCK","reason":"RESULT_AND_LANDING_DISAGREE","bytes":0}

def commit_transaction(s,key,gateway):
    env=envelope_validate(s["evidence"][key]);fresh,_=gateway.contact(s,env)
    co=fresh["objects"].get(s["durability"]["control_id"],{})
    assert co.get("control_digest")==s["digest"] and co.get("control_revision")==s["revision"], "control advanced"
    assert s["revision"]==env["prepared_revision"] and authority_hash(s,env["cage"])==env["authority_hash"], "rebase required"
    assert gateway.atomic_target_and_survivor, "conditional mutation unavailable"
    receipt=gateway.operation_receipt(key);post=gateway.landing(env)
    result=reconcile_transaction(env,receipt,post)
    if result["decision"]!="VERIFIED_MUTATION":return result
    assert key not in s["credited_keys"], "double credit"
    n=copy.deepcopy(s);en=n["evidence"][key]
    en["mutation"]={"attempted":True,"response":receipt};en["post"]=post
    en["precondition"]={"result":"PASS","method":"backend_atomic_target_and_survivor_compare",
      "at_ms":receipt["at_ms"],"control_revision":s["revision"],"accounting_bytes":0}
    en["phase"]="VERIFIED_MUTATION";en["accounting"]["bytes"]=result["bytes"];envelope_seal(en);seal(n)
    ev={"refs":["envelope:"+key],"entry_verified":True,"head_verified":True,"recovery_present":True,
      "recontact":True,"outcome":"verified_mutation","operation_key":key,"bytes":result["bytes"],
      "mutation_receipt":receipt,"landing_identity":post["target"]}
    n=apply(n,{"kind":"recover","cage":env["cage"],"worker":"replacement-worker","entry_digest":n["digest"],
      "_adapter_token":_ADAPTER_TOKEN,"evidence":ev})
    n.setdefault("accounting",{})["adapter_verified_mutation_bytes"]=n.get("accounting",{}).get("adapter_verified_mutation_bytes",0)+result["bytes"]
    n.setdefault("completed",{}).setdefault("trash_ids",[]).append(env["target"]["id"])
    seal(n);return n

class SandboxConditionalStore:
    """LOCAL TEST platform only: independent persistent state, atomic preconditions
    and operation journal. Never connects to or deletes Library."""
    atomic_target_and_survivor=True
    def __init__(self,root):
        self.root=Path(root);self.store=self.root/"platform.json";self.control=self.root/"control.json"
        self.mode="normal";self.after_contact=None
    def data(self):return json.loads(self.store.read_text())
    def snapshot(self,ident):
        x=self.data()["objects"][ident]
        return {"id":ident,"ref":"fixture:"+ident,"state":x["state"],"version":str(x["version"]),
          "size":len(x["body"].encode()),"file_id":ident,"modified_at":str(x["version"]),
          "name":ident,"source":"LOCAL_TEST_PLATFORM","sha256":hashlib.sha256(x["body"].encode()).hexdigest()}
    def contact(self,s,env):
        live=validate(json.loads(self.control.read_text()));objects={}
        for role in ("target","survivor"):
            x=self.snapshot(env[role]["id"]);objects[x["id"]]={k:v for k,v in x.items() if k!="sha256"}
        objects["control"]={"control_revision":live["revision"],"control_digest":live["digest"]}
        m={"origin":"deterministic_byte_measurement",
          "target":{k:self.snapshot(env["target"]["id"])[k] for k in ("size","sha256")},
          "survivor":{k:self.snapshot(env["survivor"]["id"])[k] for k in ("size","sha256")},
          "relationship":{"kind":"EXACT_DUPLICATE","exact_duplicate":True}}
        obs={"origin":"host_tool_capture","method":"LOCAL_TEST_PLATFORM","finished_ms":int(time.time()*1000),"objects":objects}
        if self.after_contact:
            fn=self.after_contact;self.after_contact=None;fn()
        return obs,m
    def change(self,ident):
        d=self.data();d["objects"][ident]["version"]+=1;d["objects"][ident]["body"]+="changed";self.store.write_text(json.dumps(d))
    def mutate_if_matches(self,key,target,survivor,expected_control):
        with open(self.root/"platform.lock","a") as lock:
            fcntl.flock(lock,fcntl.LOCK_EX);d=self.data()
            if key in d["operations"]:return d["operations"][key]
            current=validate(json.loads(self.control.read_text()))
            matches=(self.snapshot(target["id"])==target and self.snapshot(survivor["id"])==survivor
              and expected_control=={"digest":current["digest"],"revision":current["revision"]})
            good=matches and self.mode!="fail"
            r={"operation_key":key,"status":"succeeded" if good else "failed",
              "expected_target":target,"expected_survivor":survivor,"expected_control":expected_control,"conditional_check":matches,
              "at_ms":int(time.time()*1000),"source":"LOCAL_TEST_PLATFORM_JOURNAL"}
            if good and self.mode!="success_without_landing":d["objects"][target["id"]]["state"]="RETIRED"
            d["operations"][key]=r;self.store.write_text(json.dumps(d));return r
    def operation_receipt(self,key):return self.data()["operations"].get(key)
    def landing(self,env):
        return {"target":self.snapshot(env["target"]["id"]),"survivor":self.snapshot(env["survivor"]["id"])}

class LibraryEvidenceGateway:
    """Host supplies tool-contact and materialization callbacks. Both are called
    during preflight; workers do not provide decision booleans. The durable
    bridge program above is the default tool-contact implementation.
    No destructive Library operation is implemented or emulated."""
    atomic_target_and_survivor=False
    def __init__(self,live_capture,live_bytes):
        self.live_capture=live_capture;self.live_bytes=live_bytes
    def contact(self,s,env):
        ids=[s["durability"]["control_id"],env["target"]["id"],env["survivor"]["id"]]
        if s.get("source_head"):ids.append(s["source_head"]["id"])
        capture=normalize_capture(self.live_capture(ids))
        target,closure=self.live_bytes(env["target"]["id"],env["survivor"]["id"])
        return capture,visualang_measure(target,closure)
    def mutate_if_matches(self,*args):
        raise RuntimeError("Library conditional mutation unavailable; dispatch prohibited")
    def operation_receipt(self,*args):return None
    def landing(self,*args):
        raise RuntimeError("Library unavailability is not an authoritative retirement receipt")

def adapter_selftest():
    import subprocess
    results={}
    def denied(fn):
        try:fn()
        except (AssertionError,KeyError):return
        raise AssertionError("unsafe evidence accepted")
    def setup(root):
        g=SandboxConditionalStore(root);g.store.write_text(json.dumps({"objects":{
          "target":{"body":"same bytes","state":"ACTIVE","version":1},
          "survivor":{"body":"same bytes","state":"ACTIVE","version":1}},"operations":{}}))
        s=fixture();s["authority"]={"allowed":["inspect","mutate"],"destructive_enabled":True}
        s["completed"]={"trash_ids":[]};s["durability"]={"control_id":"control"}
        s["adapter"]={"version":"1.0","strict_cages":[]};s["evidence"]={};seal(s)
        s=apply(s,event(s,"issue",target={"id":"target"},authority=["mutate"]))
        s=apply(s,event(s,"claim",worker="A"));g.control.write_text(json.dumps(s))
        obs,m=g.contact(s,{"target":{"id":"target"},"survivor":{"id":"survivor"}})
        s["adapter"]["contact_entry_digest"]=s["digest"];seal(s)
        s=evidence_prepare(s,"test","A",obs,m,"target","survivor","retire");g.control.write_text(json.dumps(s))
        return s,next(iter(s["evidence"])),g
    with tempfile.TemporaryDirectory() as d:
        s,key,g=setup(d)
        assert reconcile_transaction(s["evidence"][key],None,g.landing(s["evidence"][key]))["decision"]=="BLOCK"
        assert conditional_transaction(s,key,g)["decision"]=="VERIFIED_MUTATION"
        results["1_prepare_crash"]="PASS: no assumed completion; fresh conditional execution possible"
    with tempfile.TemporaryDirectory() as d:
        s,key,g=setup(d)
        assert subprocess.run([sys.executable,"-I",__file__,"fixture-dispatch-crash",d]).returncode==99
        n=json.loads(subprocess.check_output([sys.executable,"-I",__file__,"fixture-reconcile",d],text=True))
        assert n["cages"]["test"]["status"]=="COMPLETED" and n["credited_keys"]==[key]
        g.control.write_text(json.dumps(n));denied(lambda:commit_transaction(n,key,g))
        results["2_mutation_crash"]="PASS: abrupt exit after mutation; cold process reconciles journal + landing once"
    for case,mode in (("3_success_post_disagrees","success_without_landing"),("4_failed_stale_commit","fail")):
        with tempfile.TemporaryDirectory() as d:
            s,key,g=setup(d);g.mode=mode
            assert conditional_transaction(s,key,g)["decision"]=="BLOCK"
            assert commit_transaction(s,key,g)["decision"]=="BLOCK"
            denied(lambda:apply(s,event(s,"recover",worker="A",evidence=proof("verified_mutation"))))
            results[case]="PASS: response alone earns no credit; raw worker commit denied"
    with tempfile.TemporaryDirectory() as d:
        s,key,g=setup(d)
        denied(lambda:apply(s,{"kind":"issue","cage":"other","entry_digest":s["digest"],"target":{"id":"target","version":"new"},"authority":["mutate"]}))
        results["5_two_workers"]="PASS: stable identity blocks second prepare through another cage"
    for role,case in (("target","6_target_changes"),("survivor","7_recovery_changes")):
        with tempfile.TemporaryDirectory() as d:
            s,key,g=setup(d);g.change(role)
            assert conditional_transaction(s,key,g)["decision"]=="BLOCK" and not g.data()["operations"]
            results[case]="PASS: fresh version/bytes block before dispatch"
        with tempfile.TemporaryDirectory() as d:
            s,key,g=setup(d);g.after_contact=lambda:g.change(role)
            assert conditional_transaction(s,key,g)["decision"]=="BLOCK"
            assert g.operation_receipt(key)["conditional_check"] is False
            results[case+"_race"]="PASS: atomic backend rejects change AFTER contact"
    with tempfile.TemporaryDirectory() as d:
        s,key,g=setup(d);n=copy.deepcopy(s);n["revision"]+=1;seal(n);g.control.write_text(json.dumps(n))
        assert conditional_transaction(s,key,g)["decision"]=="BLOCK"
        denied(lambda:commit_transaction(n,key,g));results["8_control_advances"]="PASS: live control and prepared revision reject stale continuation"
    with tempfile.TemporaryDirectory() as d:
        s,key,g=setup(d)
        def advance():
            n=copy.deepcopy(s);n["revision"]+=1;seal(n);g.control.write_text(json.dumps(n))
        g.after_contact=advance
        assert conditional_transaction(s,key,g)["decision"]=="BLOCK"
        assert g.operation_receipt(key)["conditional_check"] is False
        results["8_control_advances_race"]="PASS: dispatch guard rejects control change AFTER captured contact"
    with tempfile.TemporaryDirectory() as d:
        s,key,g=setup(d);g.atomic_target_and_survivor=False
        assert conditional_transaction(s,key,g)["reason"]=="NO_ATOMIC_TARGET_AND_SURVIVOR_PRECONDITION" and not g.data()["operations"]
        results["unsupported_platform"]="PASS: absent conditional capability blocks dispatch"
        damaged=copy.deepcopy(s["evidence"][key]);damaged["target"]["size"]+=1
        denied(lambda:envelope_validate(damaged));results["tampering"]="PASS: altered envelope rejected"
    print(json.dumps(results,indent=2));return results

def evidence_cli(args):
    mode=args[0]
    if mode=="bridge":print(BRIDGE_JS);return
    control=Path(args[1]);s=validate(json.loads(control.read_text()))
    capture=normalize_capture(json.loads(Path(args[2]).read_text()))
    target,closure=args[3:5];measured=visualang_measure(target,closure)
    cid="visualang-dependency-001"
    if mode=="prepare":
        original=s["digest"];s.setdefault("adapter",{}).update(strict_cages=[cid],version="1.0",contact_entry_digest=original)
        seal(s)
        if s["cages"][cid]["status"]=="AVAILABLE":
            s=apply(s,{"kind":"claim","cage":cid,"worker":"Worker-A-evidence","entry_digest":s["digest"]})
        s=evidence_prepare(s,cid,"Worker-A-evidence",capture,measured,
          "libfile_3daaeaf1fbe0819180615a4d3af15a11","libfile_8a13319f5c6c81918d66a5f10d78c8b1")
    elif mode=="recover":
        key=s["cages"][cid]["intent"]["operation_key"];s=evidence_land(s,key,capture,measured)
        if s["cages"][cid]["status"]=="COMPLETED":
            s["adapter"]["visualang_assessment"]={"origin":"byte-derived evidence + live contact",
              "closure_role":"REQUIRED_RECOVERY","current_carrier_role":"HOLD_DISTINCT_MODIFIED_CARRIER",
              "exact_redundancy":False,"external_gif_route":"UNVERIFIED",
              "shared_unchanged":measured["relationship"]["shared_unchanged"],
              "new_retirement_credit":0}
            s["next_action"]="Visualang inspection closed. Resolve the external GIF pointer by direct current identity contact; preserve closure embedded base and patches. Destructive Library adapter stays disabled without atomic target+survivor controls."
            seal(s)
    else:raise ValueError(mode)
    out=control.with_name("JM_MAGNIFYING_GLASS_CONTROL_CANDIDATE.json")
    out.write_text(json.dumps(s,indent=2)+"\n")
    print(json.dumps({"candidate":str(out),"revision":s["revision"],"cage":s["cages"][cid]["status"],"digest":s["digest"]}))

# Transport attestation 1.0: source category differs from failure/trust domain.
TRUST_DOMAINS={
 'worker_interpretation':{'domain':'worker','roots':['worker'],'proof':'routing_only'},
 'jm_durable_control':{'domain':'jm_control','roots':['openai_host','jm_governance'],'proof':'durable_anchor_not_external_authentication'},
 'platform_metadata':{'domain':'openai_host','roots':['openai_host'],'proof':'unsigned_platform_report'},
 'platform_content_retrieval':{'domain':'openai_host','roots':['openai_host'],'proof':'unsigned_platform_report'},
 'platform_mutation_response':{'domain':'openai_host','roots':['openai_host'],'proof':'unsigned_receipt_not_current_landing'},
 'local_content_proof':{'domain':'local_runtime','roots':['openai_host','local_runtime'],'proof':'reproducible_integrity_not_origin'},
 'independent_recovery_carrier':{'domain':'recovery_carrier','roots':['openai_host','local_runtime'],'proof':'separate_object_not_independent_transport'},
 'external_attestation':{'domain':'external_unconfigured','roots':[],'proof':'unavailable_no_pinned_external_verifier'}
}
def trust_provenance(category,route):
    assert category in TRUST_DOMAINS
    return {'category':category,'route':route,**copy.deepcopy(TRUST_DOMAINS[category])}

def transport_validate(t):
    assert t['protocol']=='JM.TransportTrust/1.0'
    assert t['domains']==TRUST_DOMAINS, 'unapproved trust-domain registry'
    for env in t.get('envelopes',{}).values():
        assert env['protocol']=='JM.TransportEnvelope/1.0'
        assert env['digest']==digest({k:v for k,v in env.items() if k!='digest'}), 'transport envelope corrupted'
        for f in env['facts']:
            assert f['provenance']==trust_provenance(f['category'],f['route']), 'invented independence/domain'
        assert env['assessment']==transport_assess(env['facts'],env['binding']), 'unsupported trust assessment'
    return t

def transport_assess(facts,binding):
    """No caller boolean can authenticate a response. No external verifier is
    configured in v1.0. Future independent sources need a governed verifier,
    not a new route name or a locally generated signature/key pair.
    """
    reasons=[];seen={};usable=[]
    for f in facts:
        assert f['provenance']==trust_provenance(f['category'],f['route'])
        if f['category'] in ('worker_interpretation','external_attestation'):continue
        if f.get('object_id')!=binding['target_id']:continue
        if f.get('version') and f['version']!=binding['target_version']:reasons.append('VERSION_DISAGREEMENT')
        if f.get('retrieval')=='FAILED':reasons.append('CONTENT_CONTACT_FAILED')
        if f.get('current_state') and f['current_state']!=binding.get('expected_state','ACTIVE'):reasons.append('LANDING_STATE_DISAGREEMENT')
        for field in ('sha256','size'):
            if f.get(field) is None:continue
            scope=f.get('scope','metadata')
            pair=(field,scope);value=f[field]
            if pair in seen and seen[pair]!=value:reasons.append(field.upper()+'_DISAGREEMENT:'+scope)
            seen[pair]=value
            if field=='sha256' and scope=='raw_bytes' and value!=binding['expected_sha256']:reasons.append('EXPECTED_DIGEST_DISAGREEMENT')
            if field=='sha256' and scope=='extracted_text_utf8' and binding.get('expected_extracted_sha256') and value!=binding['expected_extracted_sha256']:reasons.append('CANONICAL_TEXT_DIGEST_DISAGREEMENT')
        if f.get('sha256') and f.get('retrieval')!='FAILED':usable.append(f)
    # Metadata/report-only agreement earns no content proof. A locally computed
    # raw digest matching the durable anchor is the minimum content requirement.
    reproduced=any(f['category']=='local_content_proof' and f.get('scope')=='raw_bytes' and
      f.get('sha256')==binding['expected_sha256'] for f in usable)
    domains=[f['provenance']['domain'] for f in usable]
    correlated=len(usable)>1 and any(set(a['provenance']['roots'])&set(b['provenance']['roots'])
      for i,a in enumerate(usable) for b in usable[i+1:])
    status='CONTRADICTED' if reasons else 'CONSISTENT' if reproduced else 'UNVERIFIED'
    return {'status':status,'corroboration':'CORRELATED' if correlated else 'UNVERIFIED',
      'independent_status':'UNVERIFIED','independently_corroborated':False,
      'content_reproduced':reproduced,'authenticated_origin':False,
      'decision':'BLOCK_RECONTACT' if reasons or not reproduced else 'INSPECTION_ONLY',
      'reasons':sorted(set(reasons)),'trust_domains':sorted(set(domains)),
      'boundary':'NO_CONFIGURED_EXTERNAL_ATTESTATION; HASH_IS_NOT_SIGNATURE'}

def transport_fact(category,route,**values):
    return {'category':category,'route':route,'provenance':trust_provenance(category,route),**values}

def transport_capture(s,entry_read,raw_path):
    """Pilot: canonical Reclaim head, current live pinned read,
    materialized bytes and JM's earlier extracted-text digest. read is extracted text:
    never mislabel its missing final newline as raw-file content or signature.
    """
    rows=entry_read['results'];target=next(r for r in rows if r.get('library_file_id')==s['source_head']['id'])
    co=next(r for r in rows if r.get('library_file_id')==s['durability']['control_id'])
    live_control=json.loads('\n'.join(co['content']));validate(live_control)
    assert live_control['digest']==s['digest'], 'entry control changed'
    assert not target.get('has_more') and not target.get('warnings')
    raw=Path(raw_path).read_bytes();text='\n'.join(target['content']).encode()
    # Adapter knows this text extractor omits ONE terminal LF. Transformation
    # is explicit and yields only extracted-text equivalence, not raw equality.
    normalized=raw[:-1] if raw.endswith(b'\n') else raw
    binding={'target_id':target['library_file_id'],'target_version':str(s['source_head']['version']),
      'expected_sha256':hashlib.sha256(raw).hexdigest(),'raw_digest_origin':'local capture pin; not historical/platform digest',
      'expected_extracted_sha256':s['source_head']['content_sha256'],'control_id':s['durability']['control_id'],
      'control_revision':s['revision'],'control_digest':s['digest'],
      'recovery_identity':{'kind':'durable_control_digest_anchor','id':s['durability']['control_id']},
      'expected_state':'ACTIVE'}
    ident={'object_id':binding['target_id'],'version':target.get('version_id'),'file_id':target.get('file_id')}
    facts=[transport_fact('platform_metadata','files/read',**ident,size=target['size_bytes'],scope='raw_bytes',current_state='ACTIVE',
      server_fields={k:target[k] for k in ('version_id','file_id','library_file_id','created_at','modified_at') if k in target}),
      transport_fact('platform_content_retrieval','files/read',**ident,retrieval='SUCCEEDED',scope='extracted_text_utf8',
        sha256=hashlib.sha256(text).hexdigest(),size=len(text),digest_computed_by='local adapter over host-supplied text'),
      transport_fact('local_content_proof','materialize+local_sha256',**ident,retrieval='SUCCEEDED',scope='raw_bytes',
        sha256=hashlib.sha256(raw).hexdigest(),size=len(raw),input_domain='openai_host'),
      transport_fact('local_content_proof','extractor_equivalence',**ident,scope='extracted_text_utf8',
        sha256=hashlib.sha256(normalized).hexdigest(),size=len(normalized),transform='remove one terminal LF if present'),
      transport_fact('jm_durable_control','control.source_head.content_sha256',**ident,scope='extracted_text_utf8',sha256=binding['expected_extracted_sha256']),
      transport_fact('external_attestation','capability_inventory',object_id=binding['target_id'],availability='UNAVAILABLE',
        limitation='No exposed signed response or independently governed target route')]
    key=digest({'binding':binding,'capture_sha256':digest(entry_read)})
    env={'protocol':'JM.TransportEnvelope/1.0','id':key,'binding':binding,'facts':facts,
      'capture':{'started_ms':entry_read['started_ms'],'finished_ms':entry_read['finished_ms'],
        'raw_response_sha256':digest(entry_read),'timestamp_origin':'host clock, not independent server attestation'},
      'assessment':transport_assess(facts,binding),'receipts':[],'phase':'PREPARED','post':None,
      'accounting':{'bytes':0,'quota_credit':None}}
    return envelope_seal(env)

def transport_reconcile(s,key,fresh,raw_path):
    validate(s);env=s['transport']['envelopes'][key];binding=env['binding'];reasons=[]
    if s['revision']!=env.get('prepared_revision'):reasons.append('CONTROL_REVISION_ADVANCED')
    if authority_hash(s,env['cage'])!=env.get('authority_hash'):reasons.append('AUTHORITY_OR_EXCLUSIONS_CHANGED')
    co=next((r for r in fresh.get('results',[]) if (r.get('library_file_id') or r.get('ref_id'))==binding['control_id']),{})
    try:
        actual=json.loads('\n'.join(co.get('content',[])));validate(actual)
        if co.get('warnings') or co.get('has_more') or actual['digest']!=s['digest'] or actual['revision']!=s['revision']:reasons.append('LIVE_CONTROL_CHANGED')
    except (ValueError,KeyError,AssertionError):reasons.append('LIVE_CONTROL_UNVERIFIED')
    row=next((r for r in fresh.get('results',[]) if (r.get('library_file_id') or r.get('ref_id'))==binding['target_id']),{})
    if not row or row.get('warnings') or row.get('has_more') or not row.get('content'):reasons.append('CONTENT_CONTACT_FAILED')
    if row.get('version_id')!=binding['target_version']:reasons.append('VERSION_DISAGREEMENT')
    try:data=Path(raw_path).read_bytes()
    except OSError:data=b'';reasons.append('LOCAL_BYTES_UNAVAILABLE')
    normalized=data[:-1] if data.endswith(b'\n') else data
    if hashlib.sha256(data).hexdigest()!=binding['expected_sha256']:reasons.append('EXPECTED_DIGEST_DISAGREEMENT')
    if '\n'.join(row.get('content',[])).encode()!=normalized:reasons.append('SAME_HOST_ROUTES_DISAGREE')
    if not 0<=int(time.time()*1000)-fresh['finished_ms']<=60000:reasons.append('CONTACT_EXPIRED')
    old=env['assessment']
    if old['decision']!='INSPECTION_ONLY':reasons.append('PREPARED_EVIDENCE_UNVERIFIED')
    return {'decision':'BLOCK_RECONTACT' if reasons else 'INSPECTION_ONLY','reasons':sorted(set(reasons)),
      'fresh_response_sha256':digest(fresh),'observed_target_version':row.get('version_id'),
      'observed_raw_sha256':hashlib.sha256(data).hexdigest(),'authenticity':'same host trusted; no signature'}

def transport_prepare(s,cid,worker,env):
    validate(s);c=s['cages'][cid]
    assert c['status']=='CLAIMED' and c['worker']==worker and c['authority']==['inspect']
    assert env['binding']['control_digest']==s['digest'] and env['binding']['control_revision']==s['revision']
    assert env['binding']['target_id']==s['source_head']['id']
    assert env['assessment']['decision']=='INSPECTION_ONLY'
    n=copy.deepcopy(s);env=copy.deepcopy(env);key=env['id']
    assert key not in n['transport']['envelopes'] and key not in n['credited_keys']
    env.update(cage=cid,prepared_revision=s['revision']+1,authority_hash=authority_hash(s,cid))
    n['transport']['envelopes'][key]=envelope_seal(env);seal(n)
    ev={'refs':['transport-envelope:'+key],'entry_verified':True,'head_verified':True,'recovery_present':True,
      'recontact':True,'outcome':'verified_inspection','operation_key':key,'bytes':0}
    return apply(n,{'kind':'intent','cage':cid,'worker':worker,'entry_digest':n['digest'],
      '_adapter_token':_ADAPTER_TOKEN,'evidence':ev})

def transport_land(s,key,fresh,raw_path):
    gate=transport_reconcile(s,key,fresh,raw_path);n=copy.deepcopy(s);env=n['transport']['envelopes'][key];cid=env['cage']
    env['post']=gate;env['phase']='VERIFIED_INSPECTION' if gate['decision']=='INSPECTION_ONLY' else 'BLOCKED'
    envelope_seal(env);seal(n)
    if gate['decision']!='INSPECTION_ONLY':
        return apply(n,{'kind':'block','cage':cid,'entry_digest':n['digest'],'reason':','.join(gate['reasons'])})
    ev={'refs':['transport-envelope:'+key],'entry_verified':True,'head_verified':True,'recovery_present':True,
      'recontact':True,'outcome':'verified_inspection','operation_key':key,'bytes':0}
    return apply(n,{'kind':'recover','cage':cid,'entry_digest':n['digest'],'_adapter_token':_ADAPTER_TOKEN,'evidence':ev})

def transport_receipt(response,control_revision):
    """Whitelisted server result fields only; session/path is not a signature.
    A receipt records an earlier response, never supersedes a later landing.
    """
    return {'provenance':trust_provenance('platform_mutation_response','Library write response'),
      'observed_response':{k:response[k] for k in ('operation','status','library_file_id','file_id','current_version_number',
        'upload_session_id','mutation_id','created_at','modified_at') if k in response},
      'control_revision_at_capture':control_revision,'response_sha256':digest(response),
      'signed':False,'proof_role':'historical response only; fresh landing required'}

def transport_selftest():
    b={'target_id':'fixture','target_version':'1','expected_sha256':'a'*64,'expected_state':'ACTIVE'}
    def f(cat='local_content_proof',**kw):
        d={'object_id':'fixture','version':'1','sha256':'a'*64,'size':10,'scope':'raw_bytes'};d.update(kw)
        return transport_fact(cat,'TEST_FIXTURE_ONLY',**d)
    baseline=[f(),f('platform_content_retrieval')];results={}
    cases={'A_metadata_exists_content_fails':baseline+[f('platform_content_retrieval',retrieval='FAILED')],
      'B_retrieval_wrong_version':[f(version='2')],
      'C_same_host_disagreement':baseline+[f('platform_content_retrieval',sha256='b'*64)],
      'D_local_digest_disagrees':[f(sha256='b'*64)],
      'E_recovery_disagrees':baseline+[f('independent_recovery_carrier',sha256='b'*64)],
      'F_success_actual_landing_disagrees':baseline+[f('platform_mutation_response',reported_result='success'),f(current_state='UNAVAILABLE')],
      'G_historical_receipt_later_contradicted':baseline+[f('platform_mutation_response',reported_result='success'),f(current_state='RETIRED')]}
    for name,facts in cases.items():
        a=transport_assess(facts,b);assert a['status']=='CONTRADICTED' and a['decision']=='BLOCK_RECONTACT';results[name]='PASS: BLOCK_RECONTACT; zero credit'
    a=transport_assess(baseline+[f('external_attestation',signed=True,independent=True)],b)
    assert a['status']=='CONSISTENT' and a['corroboration']=='CORRELATED' and not a['independently_corroborated']
    results['H_no_external_attestation']='PASS: UNVERIFIED independence, correlated consistency only'
    bad=f();bad['provenance']['domain']='renamed-independent'
    try:transport_assess([bad],b)
    except AssertionError:results['invented_domain']='PASS: REJECTED'
    else:raise AssertionError('renamed host trusted')
    a=transport_assess([f('worker_interpretation')],b);assert a['status']=='UNVERIFIED' and a['decision']=='BLOCK_RECONTACT'
    results['unsupported_interpretation']='PASS: REJECTED as proof'
    print(json.dumps(results,indent=2));return results

if __name__=="__main__":
    if sys.argv[1]=="transport-selftest": transport_selftest()
    elif sys.argv[1]=="transport-recover":
        s=validate(json.loads(Path(sys.argv[2]).read_text()));print(json.dumps(transport_reconcile(s,sys.argv[3],json.loads(Path(sys.argv[4]).read_text()),sys.argv[5]),indent=2))
    elif sys.argv[1]=="selftest": selftest()
    elif sys.argv[1]=="adapter-selftest":adapter_selftest()
    elif sys.argv[1]=="fixture-dispatch-crash":
        g=SandboxConditionalStore(sys.argv[2]);s=json.loads(g.control.read_text());key=next(iter(s["evidence"]))
        assert conditional_transaction(s,key,g)["decision"]=="VERIFIED_MUTATION";os._exit(99)
    elif sys.argv[1]=="fixture-reconcile":
        g=SandboxConditionalStore(sys.argv[2]);s=json.loads(g.control.read_text());key=next(iter(s["evidence"]))
        print(json.dumps(commit_transaction(s,key,g)))
    elif sys.argv[1]=="evidence":evidence_cli(sys.argv[2:])
    elif sys.argv[1]=="recover-pilot":recover_pilot(*sys.argv[2:5])
    elif sys.argv[1]=="schema":print(json.dumps(json_schema(),indent=2))
    elif sys.argv[1]=="status":
        s=validate(json.loads(Path(sys.argv[2]).read_text()))
        print(json.dumps({"body":s["body"],"revision":s["revision"],"source_head":s.get("source_head"),
         "cages":s["cages"],"last_landing":s["last_landing"],"next_action":s.get("next_action"),
         "destructive_enabled":s["authority"]["destructive_enabled"]},indent=2))
    elif sys.argv[1]=="transition":
        print(update(sys.argv[2],int(sys.argv[3]),json.loads(Path(sys.argv[4]).read_text()))["digest"])
    else:raise SystemExit("Use status, schema, transition or selftest")