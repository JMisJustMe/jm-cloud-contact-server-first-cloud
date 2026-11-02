// JM BRAIDGE × TBS — pure relationship transition guard (candidate, not a new authority).
// Does not mutate canonical source, ownership, or the Cloud Contact Server database.
export const KINDS = Object.freeze(['transfer','extension','branch','return','breakaway']);
const valid = s => typeof s === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(s);
export function assessTransition(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return {allowed:false,state:'INVALID',reason:'Object required'};
  const {sourceId,fromBody,toBody,kind,authority,traceId,sourceProof} = input;
  if (![sourceId,fromBody,toBody,traceId].every(valid) || !KINDS.includes(kind))
    return {allowed:false,state:'INVALID',reason:'Identifiers, trace and known transition required'};
  if (fromBody === toBody && kind !== 'return')
    return {allowed:false,state:'INVALID',reason:'Distinct participation bodies required'};
  if (!sourceProof || sourceProof.sourceId !== sourceId || sourceProof.verified !== true)
    return {allowed:false,state:'SOURCE_HOLD',reason:'Source identity proof not verified'};
  if (!authority || authority.granted !== true || authority.sourceId !== sourceId ||
      authority.fromBody !== fromBody || authority.toBody !== toBody ||
      authority.kind !== kind || !valid(authority.receiptId))
    return {allowed:false,state:'AUTHORITY_HOLD',reason:'Exact transition authority not verified'};
  return {allowed:true,state:'PLAN_ONLY',sourceId,fromBody,toBody,kind,traceId,
    authorityReceipt:authority.receiptId,
    boundary:'Assessment is not execution, ownership transfer, deployment, or proof inheritance'};
}
