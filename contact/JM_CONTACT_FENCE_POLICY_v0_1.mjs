// CP-C14 pure, fail-closed authority gate; no network effects.
const HEX=/^[0-9a-f]{64}$/;
const IDENT=/^[A-Za-z0-9._:-]{1,128}$/;
export const HOLD=(code)=>Object.freeze({status:'HOLD',reason:code,productionApproved:false});
export function validateWriter({scope,owner,epoch}){
  if(!IDENT.test(scope||''))throw Error('JM_FENCE_SCOPE_INVALID');
  if(!IDENT.test(owner||''))throw Error('JM_FENCE_OWNER_INVALID');
  if(!Number.isSafeInteger(epoch)||epoch<1)throw Error('JM_FENCE_EPOCH_INVALID');
  return true;
}
export function assessPromotion({current,expectedOwner,expectedEpoch,expectedRevision,expectedChecksum,nextOwner}={}){
  if(!current||!Number.isSafeInteger(Number(current.epoch)))return HOLD('FENCE_MISSING');
  if(!IDENT.test(nextOwner||'')||nextOwner===expectedOwner)return HOLD('INVALID_NEXT_OWNER');
  if(current.owner!==expectedOwner||Number(current.epoch)!==expectedEpoch)return HOLD('STALE_WRITER_EPOCH');
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<1||Number(current.snapshot_revision)!==expectedRevision)return HOLD('CHECKPOINT_REVISION_MISMATCH');
  if(!HEX.test(expectedChecksum||'')||current.snapshot_sha256!==expectedChecksum)return HOLD('CHECKPOINT_HASH_MISMATCH');
  return Object.freeze({status:'ELIGIBLE',nextEpoch:expectedEpoch+1,productionApproved:false});
}
