// CP-C13: destructive database backups/restores may target ONLY three disposable CI DBs.
export const SOURCE='postgres://jm_qa:qa123@127.0.0.1:5432/jm_cloud_c13_source';
export const TARGET='postgres://jm_qa:qa123@127.0.0.1:5433/jm_cloud_c13_target';
export const RECOVERY='postgres://jm_qa:qa123@127.0.0.1:5434/jm_cloud_c13_recovery';
const isContainerID=x=>/^[0-9a-f]{12,64}$/.test(x||'');
export function guardThreeDisposable({source,target,recovery,sourceContainer,targetContainer,recoveryContainer,ci}={}){
  if(ci!=='true')throw Error('CI_ISOLATION_REQUIRED');
  if(source!==SOURCE||target!==TARGET||recovery!==RECOVERY)throw Error('EXACT_DISPOSABLE_PG_TARGETS_REQUIRED');
  const ids=[sourceContainer,targetContainer,recoveryContainer];
  if(!ids.every(isContainerID)||new Set(ids).size!==3)throw Error('THREE_DISTINCT_DISPOSABLE_POSTGRES_CONTAINERS_REQUIRED');
  return Object.freeze({status:'TEST_ONLY',ports:[5432,5433,5434],neverProduction:true});
}
