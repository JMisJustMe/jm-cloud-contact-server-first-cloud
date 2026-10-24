// CP-C13: verified, complete, signed-readback lineages ONLY; never auto-promotes production.
// Caller MUST have independently verified the P-256 public signature and full event chain.
// A stable digest prefix proves ancestry, not live write fencing or owner approval.
const HEX=/^[0-9a-f]{64}$/;
const HOLD=(reason)=>Object.freeze({status:'HOLD',reason,productionApproved:false});
export function assessLineage({source,target,sourceVerified,targetVerified,pinnedKeyId}={}){
  if(!sourceVerified||!targetVerified) return HOLD('UNVERIFIED_SIGNED_READBACK');
  if(!pinnedKeyId||source?.publicKeyId!==pinnedKeyId||target?.publicKeyId!==pinnedKeyId)return HOLD('SIGNER_PIN_MISMATCH');
  if(!Array.isArray(source?.events)||!Array.isArray(target?.events)||!source.events.length||!target.events.length)return HOLD('MISSING_FULL_EVENT_JOURNAL');
  if(!HEX.test(source.chainHead||'')||!HEX.test(target.chainHead||''))return HOLD('INVALID_CHAIN_HEAD');
  if(source.events.at(-1)?.hash!==source.chainHead||target.events.at(-1)?.hash!==target.chainHead)return HOLD('CHAIN_HEAD_INCONSISTENT');
  if(source.spaceId!==target.spaceId)return HOLD('SPACE_MISMATCH');
  const count=Math.min(source.events.length,target.events.length);
  let common=0;while(common<count && source.events[common].hash===target.events[common].hash)common++;
  if(common<count)return HOLD('DIVERGENT_SIGNED_HISTORY');
  if(source.events.length>target.events.length)return HOLD('STALE_ROLLBACK_RECIPIENT');
  if(source.events.length===target.events.length)return Object.freeze({status:'IDENTICAL',events:common,productionApproved:false});
  return Object.freeze({status:'FORWARD_EXTENSION',eventsFrom:source.events.length,eventsTo:target.events.length,productionApproved:false});
}
