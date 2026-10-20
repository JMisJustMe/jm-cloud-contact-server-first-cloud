/** CP17 actual inheritance / NO carrier replacement.
 * CP14 persistCapsule handles GitHub write/readback + Gmail draft/readback.
 * CP15 AccountRouter handles Outlook OAuth identity + draft/readback.
 * JM DominoPassby handles durable handoff order and ambiguous-state HOLD.
 */
import { createHash } from 'node:crypto';
const fail=x=>{throw Error(x)};
const digest=s=>createHash('sha256').update(String(s)).digest('hex');
export function makeInheritedPassbys({persistCapsule,accountRouter,carrierEnv,now=()=>Date.now()}={}){
 if(typeof persistCapsule!=='function'||!accountRouter||typeof accountRouter.createDraft!=='function')fail('INHERITED_AUTHORITY_REQUIRED');
 const parse=contact=>{let p;try{p=JSON.parse(contact.payload)}catch{fail('PAYLOAD_JSON_REQUIRED')}if(!p||p.schema!=='JMCC.InheritedPassbyPayload/1.0')fail('PAYLOAD_SCHEMA');return p};
 return {
  cp14: {
   async execute({stage,contact}){
    if(stage.action!=='github.commit')fail('WRONG_STAGE');
    const p=parse(contact);if(p.cp14?.contact?.correlation_id!==contact.id)fail('CORRELATION_MISMATCH');
    return persistCapsule(p.cp14,carrierEnv,{now:now()});
   },
   async verify({contact,ack}){const p=parse(contact);return ack?.correlation_id===contact.id&&ack?.contact_sha256===p.cp14?.contact_sha256&&ack?.email_sent===false&&!!ack?.git_blob&&!!ack?.gmail_draft_id}
  },
  cp15: {
   async execute({stage,contact}){
    if(stage.action!=='outlook.draft')fail('WRONG_STAGE');
    const p=parse(contact),x=p.cp15;
    if(!x||x.capsule?.nonce!==contact.id)fail('NONCE_MISMATCH');
    return accountRouter.createDraft({accountId:x.accountId,lane:x.lane,to:x.to,capsule:x.capsule,ownerApproved:true});
   },
   async verify({contact,ack}){const p=parse(contact);return ack?.status==='UNSENT_DRAFT_READBACK_VERIFIED'&&ack?.email_sent===false&&ack?.nonce===contact.id&&ack?.account_id===p.cp15?.accountId}
  },
  receipt: {
   async execute({contact,priorReceipts}){if(priorReceipts.length!==2||priorReceipts[0].stage!=='GITHUB_GMAIL_PASS'||priorReceipts[1].stage!=='OUTLOOK_PASS')fail('UPSTREAM_RECEIPTS_REQUIRED');return {contactId:contact.id,steps:2,receiptPointers:priorReceipts.map(x=>x.proofSha256),hash:digest(priorReceipts.map(x=>x.proofSha256).join('|')),sent:false}},
   async verify({contact,ack}){return ack?.contactId===contact.id&&ack.steps===2&&ack.sent===false&&/^[a-f0-9]{64}$/.test(ack.hash)}
  }
 }
}
export const inheritedRoute={id:'CP17_INHERITED_PASSBYS',stages:[
 {id:'GITHUB_GMAIL_PASS',action:'github.commit',port:'cp14'},
 {id:'OUTLOOK_PASS',action:'outlook.draft',port:'cp15'},
 {id:'RETURN_RECEIPT',action:'receipt.local',port:'receipt'}
]};
