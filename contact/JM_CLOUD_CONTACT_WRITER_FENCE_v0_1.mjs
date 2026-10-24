// JM CP-C14 — ADDITIVE experimental writer fence for a shared PostgreSQL authority.
// No automatic bootstrap, migration, deployment, or production approval.
// A write holds a shared row lock until the contact state save finishes.
// This coordinates responsive writers, but is NOT a distributed transaction across
// two independent Postgres servers: uncertain network loss requires recovery HOLD.
import pg from 'pg';
const {Pool}=pg;
const HEX=/^[0-9a-f]{64}$/;
const IDENT=/^[A-Za-z0-9._:-]{1,128}$/;
import {validateWriter,assessPromotion} from './JM_CONTACT_FENCE_POLICY_v0_1.mjs';
const TB='jm_cloud_contact_fence_v1.authority';
export class JMContactWriterFence {
  constructor({connectionString,pool=null,scope='jm-cloud-contact-v05',owner,epoch}={}){
    validateWriter({scope,owner,epoch});
    if(!pool&&!connectionString)throw Error('JM_FENCE_SHARED_POSTGRES_REQUIRED');
    this.scope=scope;this.owner=owner;this.epoch=epoch;
    this.owned=!pool;
    this.pool=pool||new Pool({connectionString,max:2,connectionTimeoutMillis:7000,idleTimeoutMillis:15000});
  }
  async prepare(){
    await this.pool.query('CREATE SCHEMA IF NOT EXISTS jm_cloud_contact_fence_v1');
    await this.pool.query(`CREATE TABLE IF NOT EXISTS ${TB}(
      scope TEXT PRIMARY KEY, owner TEXT NOT NULL, epoch BIGINT NOT NULL CHECK(epoch>=1),
      snapshot_revision BIGINT NULL, snapshot_sha256 CHAR(64) NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  }
  // The owner/operator explicitly invokes bootstrap in disposable CI only.
  // Server startup never calls this method automatically.
  async bootstrapForTest(){
    if(process.env.JM_C14_DISPOSABLE_FENCE_BOOTSTRAP!=='YES_TEST_ONLY')throw Error('JM_FENCE_BOOTSTRAP_NOT_AUTHORISED');
    await this.prepare();
    const r=await this.pool.query(`INSERT INTO ${TB}(scope,owner,epoch) VALUES($1,$2,$3)
      ON CONFLICT(scope) DO NOTHING RETURNING scope`,[this.scope,this.owner,this.epoch]);
    if(r.rowCount!==1)throw Error('JM_FENCE_ALREADY_INITIALIZED');
  }
  async current(){
    const r=await this.pool.query(`SELECT scope,owner,epoch,snapshot_revision,snapshot_sha256 FROM ${TB} WHERE scope=$1`,[this.scope]);
    return r.rows[0]||null;
  }
  async verifyOwner(){
    const a=await this.current();
    if(!a||a.owner!==this.owner||Number(a.epoch)!==this.epoch)throw Error('JM_FENCE_WRITER_REVOKED');
    return a;
  }
  async withWriteLease(save){
    if(typeof save!=='function')throw Error('JM_FENCE_OPERATION_REQUIRED');
    const client=await this.pool.connect();let transaction=false;
    try{
      await client.query('BEGIN');transaction=true;
      const r=await client.query(`SELECT owner,epoch,snapshot_revision,snapshot_sha256 FROM ${TB} WHERE scope=$1 FOR UPDATE`,[this.scope]);
      const row=r.rows[0];
      if(!row||row.owner!==this.owner||Number(row.epoch)!==this.epoch)throw Error('JM_FENCE_WRITER_REVOKED');
      // The lock must stay held throughout the actual durable state write.
      const result=await save();
      if(!result||!Number.isSafeInteger(result.revision)||result.revision<1||!HEX.test(result.checksum||''))throw Error('JM_FENCE_INVALID_DURABLE_RECEIPT');
      if(row.snapshot_revision!==null&&result.revision<=Number(row.snapshot_revision))throw Error('JM_FENCE_NON_MONOTONIC_COMMIT');
      const updated=await client.query(`UPDATE ${TB} SET snapshot_revision=$1,snapshot_sha256=$2,changed_at=NOW()
        WHERE scope=$3 AND owner=$4 AND epoch=$5`,[result.revision,result.checksum,this.scope,this.owner,this.epoch]);
      if(updated.rowCount!==1)throw Error('JM_FENCE_AUTHORITY_CHANGED_UNDER_LOCK');
      await client.query('COMMIT');transaction=false;
      return {...result,fenceEpoch:this.epoch,fenceOwner:this.owner};
    }catch(e){if(transaction)try{await client.query('ROLLBACK')}catch{}throw e;}
    finally{client.release()}
  }
  async promote({expectedOwner,expectedEpoch,expectedRevision,expectedChecksum,nextOwner}={}){
    const client=await this.pool.connect();let transaction=false;
    try{
      await client.query('BEGIN');transaction=true;
      const r=await client.query(`SELECT owner,epoch,snapshot_revision,snapshot_sha256 FROM ${TB} WHERE scope=$1 FOR UPDATE`,[this.scope]);
      const result=assessPromotion({current:r.rows[0],expectedOwner,expectedEpoch,expectedRevision,expectedChecksum,nextOwner});
      if(result.status!=='ELIGIBLE'){await client.query('ROLLBACK');transaction=false;return result;}
      await client.query(`UPDATE ${TB} SET owner=$1,epoch=$2,changed_at=NOW() WHERE scope=$3`,[nextOwner,result.nextEpoch,this.scope]);
      await client.query('COMMIT');transaction=false;
      return Object.freeze({status:'PROMOTED_IN_DISPOSABLE_AUTHORITY',owner:nextOwner,epoch:result.nextEpoch,productionApproved:false});
    }catch(e){if(transaction)try{await client.query('ROLLBACK')}catch{}throw e;}finally{client.release()}
  }
  async close(){if(this.owned)await this.pool.end()}
}
