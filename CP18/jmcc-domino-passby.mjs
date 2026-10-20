/** JM Convergent Circles CP17: inherited contact-routing passby executor.
 * Carrier-independent and production-disabled unless explicitly enabled.
 * No credential storage or automatic sending. PREPARED before external IO;
 * uncertain delivery is HOLD, NEVER blindly retried.
 */
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const digest=x=>createHash('sha256').update(x).digest('hex');
export function canonical(x){return JSON.stringify(x,(_k,v)=> v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v)}
export class DominoHold extends Error {constructor(code){super(code);this.code=code}}
const fail=x=>{throw new DominoHold(x)};
const idp=/^[a-zA-Z0-9_-]{8,100}$/;
const allowed=new Set(['gmail.read','outlook.read','github.commit','github.read','gmail.draft','outlook.draft','jm.read','jm.submit','receipt.local']);
const senderActions=new Set(['gmail.send','outlook.send']);
function safeName(x){if(typeof x!=='string'||!idp.test(x))fail('BAD_ID')}
export function validateContact(c,{now=Date.now()}={}){
 if(!c||c.schema!=='JMCC.DominoContact/1.0'||c.classification!=='NON_SENSITIVE')fail('CONTACT_SCHEMA');
 safeName(c.id);safeName(c.mission);
 if(!idp.test(c.route||''))fail('ROUTE_ID');
 if(typeof c.payload!=='string'||!c.payload.trim()||Buffer.byteLength(c.payload)>4096)fail('PAYLOAD_BOUNDS');
 const from=Date.parse(c.issuedAt),to=Date.parse(c.expiresAt);
 if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>72*3600e3||from>now+60000||now>to)fail('CONTACT_EXPIRED');
 if(c.ownerApproved!==true)fail('OWNER_APPROVAL_REQUIRED');
 if(c.autonomousSpend===true||c.storeCredentials===true)fail('UNAUTHORIZED_CAPABILITY');
 return c;
}
export class DominoPassby {
 constructor({journalDir,routes,ports,allowedSend=false,enabled=false,clock=()=>Date.now()}={}){
  if(!path.isAbsolute(journalDir||'')||!Array.isArray(routes)||!ports||typeof ports!=='object')fail('CONFIG_REQUIRED');
  this.journalDir=journalDir;this.routes=new Map();this.ports=ports;this.allowedSend=allowedSend;this.enabled=enabled;this.clock=clock;
  for(const r of routes){safeName(r.id);if(this.routes.has(r.id)||!Array.isArray(r.stages)||!r.stages.length||r.stages.length>12)fail('ROUTE_INVALID');
   const stageIds=new Set();for(const s of r.stages){safeName(s.id);if(stageIds.has(s.id)||(!allowed.has(s.action)&&!senderActions.has(s.action)))fail('STAGE_INVALID');stageIds.add(s.id);if(!s.port||typeof s.port!=='string')fail('PORT_REQUIRED')}
   this.routes.set(r.id,structuredClone(r));
  }
 }
 journalPath(id){safeName(id);return path.join(this.journalDir,id+'.jsonl')}
 read(id){const f=this.journalPath(id);if(!fs.existsSync(f))return [];let rows=[];let previous='GENESIS';
  for(const line of fs.readFileSync(f,'utf8').split('\n').filter(Boolean)){
   let r;try{r=JSON.parse(line)}catch{fail('JOURNAL_TORN_OR_BAD_JSON')}
   if(r.previous!==previous||r.digest!==digest(canonical({seq:r.seq,previous:r.previous,type:r.type,stage:r.stage??null,data:r.data??null})))fail('JOURNAL_TAMPERED');
   if(r.seq!==rows.length+1)fail('JOURNAL_SEQ_TAMPERED');rows.push(r);previous=r.digest;
  }return rows;
 }
 append(id,type,stage,data){const rows=this.read(id);const previous=rows.at(-1)?.digest||'GENESIS';const seq=rows.length+1;
  const row={seq,previous,type,stage:stage??null,data:data??null};row.digest=digest(canonical(row));
  fs.mkdirSync(this.journalDir,{recursive:true,mode:0o700});
  const fd=fs.openSync(this.journalPath(id),'a',0o600);try{fs.writeSync(fd,JSON.stringify(row)+'\n');fs.fsyncSync(fd)}finally{fs.closeSync(fd)}return row;
 }
 async run(contact){
  validateContact(contact,{now:this.clock()});if(!this.enabled)fail('DOMINO_ROUTER_DISABLED');
  const route=this.routes.get(contact.route);if(!route)fail('UNKNOWN_ROUTE');
  const f=this.journalPath(contact.id),lock=f+'.lock';fs.mkdirSync(this.journalDir,{recursive:true,mode:0o700});
  let lockFd;try{lockFd=fs.openSync(lock,'wx',0o600)}catch{fail('ROUTE_ALREADY_RUNNING_OR_STALE_LOCK_HOLD')}
  try{
   const cHash=digest(canonical(contact));let records=this.read(contact.id);
   if(records.length){if(records[0].type!=='ACCEPTED'||records[0].data.contactHash!==cHash)fail('ID_COLLISION_OR_TAMPER');}
   else{this.append(contact.id,'ACCEPTED',null,{contactHash:cHash,route:contact.route,source:contact.source||'OWNER'});records=this.read(contact.id)}
   const last=records.at(-1);if(last.type==='COMPLETE')return {status:'COMPLETE',id:contact.id,route:contact.route,receiptHash:last.digest,stages:route.stages.length,replayed:true};
   if(last.type==='PREPARED'||last.type==='HOLD')fail('AMBIGUOUS_REMOTE_STATE_HOLD');
   for(const stage of route.stages){
    records=this.read(contact.id);
    const already=records.some(x=>x.type==='COMMITTED'&&x.stage===stage.id);if(already)continue;
    if(senderActions.has(stage.action)&&this.allowedSend!==true)fail('SENDING_NOT_APPROVED');
    const port=this.ports[stage.port];if(!port||typeof port.execute!=='function'||typeof port.verify!=='function')fail('PORT_UNAVAILABLE');
    const nonce=randomUUID();const prepare=this.append(contact.id,'PREPARED',stage.id,{action:stage.action,nonce});
    try{
     const ack=await port.execute({stage,contact,nonce,previous:prepare.digest,priorReceipts:records.filter(x=>x.type==='COMMITTED').map(x=>({stage:x.stage,proofSha256:x.data.proofSha256}))});
     const verified=await port.verify({stage,contact,nonce,ack});
     if(verified!==true)fail('REMOTE_READBACK_NOT_VERIFIED');
     this.append(contact.id,'COMMITTED',stage.id,{action:stage.action,proofSha256:digest(canonical(ack)),nonce});
    }catch(e){this.append(contact.id,'HOLD',stage.id,{reason:e?.code||'REMOTE_ACTION_OR_READBACK_AMBIGUOUS'});throw new DominoHold('AMBIGUOUS_REMOTE_STATE_HOLD')}
   }
   const done=this.append(contact.id,'COMPLETE',null,{stages:route.stages.length});
   return {status:'COMPLETE',id:contact.id,route:contact.route,receiptHash:done.digest,stages:route.stages.length,replayed:false};
  }finally{if(lockFd!==undefined){fs.closeSync(lockFd);fs.unlinkSync(lock)}}
 }
}
