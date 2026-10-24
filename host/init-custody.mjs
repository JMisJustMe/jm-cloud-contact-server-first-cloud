// EXPLICIT first-time owner action. Writes once to two NEW local Docker Postgres instances.
// This is not a production migration, and deliberately never modifies an existing authority.
import crypto from 'node:crypto';
import {JMDurableContactStore} from '../contact/JM_CLOUD_CONTACT_PG_DURABLE_v0_1.mjs';
import {JMContactWriterFence} from '../contact/JM_CLOUD_CONTACT_WRITER_FENCE_v0_1.mjs';
import {requireConfig,requireLocalCustody} from './policy.mjs';
const e=process.env;
if(e.JM_OWNER_BOOTSTRAP_ACK!=='I_AM_INITIALIZING_NEW_LOCAL_STORES')throw Error('OWNER_INITIALISATION_APPROVAL_REQUIRED');
const v=requireConfig(e);
requireLocalCustody({stateUrl:e.JM_CLOUD_CONTACT_POSTGRES_URL,fenceUrl:e.JM_CLOUD_WRITER_FENCE_POSTGRES_URL});
let store=null,fence=null;
try{
 store=new JMDurableContactStore({connectionString:e.JM_CLOUD_CONTACT_POSTGRES_URL,allowEmpty:true});
 fence=new JMContactWriterFence({connectionString:e.JM_CLOUD_WRITER_FENCE_POSTGRES_URL,scope:e.JM_CLOUD_WRITER_FENCE_SCOPE||'jm-owner-cloud-contact',owner:v.owner,epoch:1});
 const auth=crypto.createHmac('sha256',e.JM_CLOUD_SERVER_SECRET).update('JM-CLOUD-CONTACT-SECRET-ID-v1').digest('hex');
 const old=await store.open({signerKeyId:v.keyId,authKeyCheck:auth});await fence.prepare();
 const current=await fence.current();
 if(old!==null||current!==null)throw Error('OWNER_CUSTODY_ALREADY_PRESENT_OR_PARTIAL: HOLD; do not reset data');
 const doc={schema:'jm.cloud-contact.server/0.5',version:5,nextCommandId:1,nextSignalId:1,spaces:{}};
 const result=await store.save(doc);
 // This independent commit is not distributed-atomic. If it fails, operator MUST HOLD.
 await fence.pool.query(`INSERT INTO jm_cloud_contact_fence_v1.authority
 (scope,owner,epoch,snapshot_revision,snapshot_sha256) VALUES($1,$2,$3,$4,$5)`,
 [fence.scope,v.owner,1,result.revision,result.checksum]);
 await fence.assertCheckpoint({revision:result.revision,checksum:result.checksum});
 console.log(JSON.stringify({status:'INITIALISED_LOCAL_ONLY',scope:fence.scope,epoch:1,revision:result.revision,keyId:v.keyId,cloudStarted:false,secretPrinted:false},null,2));
}catch(e){console.error('HOLD:',e.message,'If either database contains data, preserve both and inspect; never reset volumes automatically.');process.exitCode=1;}
finally{await Promise.allSettled([store?.close(),fence?.close()]);}
