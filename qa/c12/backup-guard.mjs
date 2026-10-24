// CP-C12 independent local-only environment authority gate. Never accepts a remote DB.
export const SOURCE='postgres://jm_qa:qa123@127.0.0.1:5432/jm_cloud_c12_source';
export const TARGET='postgres://jm_qa:qa123@127.0.0.1:5433/jm_cloud_c12_restore';
export function guardDisposable({source,target,sourceContainer,targetContainer,ci}={}){
  if(ci!=='true')throw Error('CI_ISOLATION_REQUIRED');
  if(source!==SOURCE || target!==TARGET)throw Error('EXACT_DISPOSABLE_PG_TARGETS_REQUIRED');
  if(!/^[0-9a-f]{12,64}$/.test(sourceContainer||'')||!/^[0-9a-f]{12,64}$/.test(targetContainer||'')||sourceContainer===targetContainer)throw Error('TWO_DISTINCT_DISPOSABLE_POSTGRES_CONTAINERS_REQUIRED');
  return {status:'TEST_ONLY',sourceHost:'127.0.0.1:5432',targetHost:'127.0.0.1:5433',neverProduction:true};
}
