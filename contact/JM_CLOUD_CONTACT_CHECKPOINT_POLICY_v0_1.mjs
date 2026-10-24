// JM CP-C15: deterministic, fail-closed comparison of TWO independently committed
// PostgreSQL stores. MATCHED is evidence of current equality, NOT cross-DB atomicity.
const HEX=/^[0-9a-f]{64}$/;
export const hold=reason=>Object.freeze({status:'HOLD',reason,productionApproved:false});
export function assessCheckpoint({fence,owner,epoch,revision,checksum}={}){
  if(!fence||fence.owner!==owner||Number(fence.epoch)!==epoch)return hold('WRITER_AUTHORITY_CHANGED');
  if(!Number.isSafeInteger(revision)||revision<0)return hold('DURABLE_REVISION_INVALID');
  if(revision===0){
    if(checksum!==null&&checksum!==undefined)return hold('EMPTY_STATE_HAS_CHECKSUM');
    if(fence.snapshot_revision!==null||fence.snapshot_sha256!==null)return hold('FENCE_HAS_UNMATCHED_COMMIT');
    return Object.freeze({status:'MATCHED_EMPTY',revision:0,productionApproved:false});
  }
  if(!HEX.test(checksum||''))return hold('DURABLE_CHECKSUM_INVALID');
  if(fence.snapshot_revision===null||fence.snapshot_sha256===null)return hold('FENCE_MISSING_COMMIT');
  const fenced=Number(fence.snapshot_revision);
  if(!Number.isSafeInteger(fenced)||fenced<1)return hold('FENCE_REVISION_INVALID');
  if(revision>fenced)return hold('STATE_AHEAD_OF_FENCE_UNCERTAIN_COMMIT');
  if(revision<fenced)return hold('FENCE_AHEAD_OF_STATE_UNCERTAIN_COMMIT');
  if(fence.snapshot_sha256!==checksum)return hold('FENCE_STATE_CHECKSUM_DIVERGENCE');
  return Object.freeze({status:'MATCHED',revision,checksum,productionApproved:false});
}
