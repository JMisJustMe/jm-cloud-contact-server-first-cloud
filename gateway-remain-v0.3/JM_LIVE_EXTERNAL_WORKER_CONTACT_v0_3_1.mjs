// JM independent cloud-worker proof: an external GitHub runner contacts
// existing live JM public endpoints. READ ONLY. Never sends credentials.
// This proof does NOT say that v0.3.1 POST /remain/job-returns is deployed.
import {createHash} from 'node:crypto';

const endpoints=[
  {name:'jm-remain-v03',url:'https://jm-remain-v03-runtime-proof.onrender.com/remain/health'},
  {name:'jm-cloud-v05',url:'https://jm-cloud-contact-server-v05.onrender.com/ready'},
  {name:'jm-build-mesh',url:'https://jm-ecostate-build-mesh-mcp.onrender.com/'},
];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const expectedEngine='975fec007d2d34b8dacbfff0b1ecd5fbb327f2f78ece89002b09ab97999744ad';
async function probe({name,url}){
  const t=Date.now();let error=null;
  for(let attempt=1;attempt<=2;attempt++){
    try{
      const r=await fetch(url,{signal:AbortSignal.timeout(85000),headers:{'accept':'application/json','user-agent':'JM-Ecostate-External-Worker-Contact/0.3.1'}});
      const body=await r.json();
      let valid=false;
      let detail={};
      if(name==='jm-remain-v03'){
        valid=r.status===200 && body.status==='READY' && body.version==='0.3.0' &&
          body.control?.protocol==='JM.MagnifyingGlass/1.0' && Number.isInteger(body.control?.revision) &&
          body.control.revision>=19 && typeof body.control?.digest==='string' &&
          body.control.digest.length===64 && body.engineSha256===expectedEngine &&
          body.destructiveAuthority===false;
        detail={controlRevision:body.control?.revision,controlDigest:body.control?.digest,engineSha256:body.engineSha256,destructiveAuthority:body.destructiveAuthority};
      }else if(name==='jm-cloud-v05'){
        valid=r.status===200 && body.ready===true && body.version==='0.5.1-hosted';
        detail={version:body.version,ready:body.ready};
      }else{
        valid=r.status===200 && body.version==='0.8.5' && body.server==='JM ECOSTATE Build Mesh Native MCP';
        detail={version:body.version,currentProjectRecords:body.current_project_records,capabilityProfiles:body.capability_profiles};
      }
      return {name,url,attempt,status:r.status,ok:valid,elapsedMs:Date.now()-t,responseSha256:digest(body),detail};
    }catch(e){error=String(e?.message||e);}
  }
  return {name,url,ok:false,elapsedMs:Date.now()-t,error};
}
const targets=await Promise.all(endpoints.map(probe));
const pass=targets.every(t=>t.ok);
const output={
  schema:'JM.ExternalCloudWorkerContact/0.3.1',
  status:pass?'PASS':'HOLD',
  worker:'GITHUB_ACTIONS_EPHEMERAL_RUNNER',
  source:'EXTERNAL_PUBLIC_HTTPS',
  hostScope:'EXISTING_DEPLOYED_V03_AND_V05_AND_BUILD_MESH',
  checks:targets,
  witnessDigest:digest(targets),
  boundary:'READ_ONLY_EXTERNAL_HTTPS_CONTACT; V031_RETURN_ROUTE_NOT_DEPLOYED; NO_HOST_PERSISTENCE_OR_UNATTENDED_AGENT_TASK_CLAIM'
};
console.log(JSON.stringify(output,null,2));
if(!pass)process.exitCode=1;
