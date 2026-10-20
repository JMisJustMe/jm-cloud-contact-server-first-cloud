import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {DominoPassby} from './jmcc-domino-passby.mjs';
import {makeInheritedPassbys,inheritedRoute} from './jmcc-inherited-passbys.mjs';
const id='CP18_INHERITED_JOIN',t=Date.now();
const payload={schema:'JMCC.InheritedPassbyPayload/1.0',cp14:{contact:{correlation_id:id},contact_sha256:'a'.repeat(64)},cp15:{accountId:'creator-outlook',lane:'creator',to:'owner@outlook.com',capsule:{nonce:id}}};
const c={schema:'JMCC.DominoContact/1.0',classification:'NON_SENSITIVE',id,route:inheritedRoute.id,mission:'JMCC_CP18',issuedAt:new Date(t-5000).toISOString(),expiresAt:new Date(t+1800000).toISOString(),payload:JSON.stringify(payload),ownerApproved:true};
test('CP18 inherit CP14+CP15; ordered hash receipts and no repeat remote IO',async()=>{
 const calls=[];
 const ports=makeInheritedPassbys({persistCapsule:async()=>{calls.push('CP14');return {correlation_id:id,contact_sha256:'a'.repeat(64),email_sent:false,git_blob:'g',gmail_draft_id:'d'}},accountRouter:{createDraft:async()=>{calls.push('CP15');return {status:'UNSENT_DRAFT_READBACK_VERIFIED',nonce:id,account_id:'creator-outlook',email_sent:false}}}});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp18-join-')),r=new DominoPassby({journalDir:dir,routes:[inheritedRoute],ports,enabled:true});
 try{const x=await r.run(c);assert.equal(x.stages,3);assert.deepEqual(calls,['CP14','CP15']);assert.equal((await r.run(c)).replayed,true);assert.equal(calls.length,2);assert.deepEqual(r.read(id).filter(x=>x.type==='COMMITTED').map(x=>x.stage),['GITHUB_GMAIL_PASS','OUTLOOK_PASS','RETURN_RECEIPT'])}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('CP18 inherited invalid CP14 source goes to HOLD without a duplicate',async()=>{
 const ports=makeInheritedPassbys({persistCapsule:async()=>({}),accountRouter:{createDraft:async()=>({})}});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'cp18-hold-')),r=new DominoPassby({journalDir:dir,routes:[inheritedRoute],ports,enabled:true});
 try{await assert.rejects(r.run({...c,payload:JSON.stringify({...payload,cp14:{contact:{correlation_id:'WRONG_ID'},contact_sha256:'a'.repeat(64)}})}),/AMBIGUOUS_REMOTE_STATE_HOLD/);assert.equal(r.read(id).at(-1).type,'HOLD')}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
