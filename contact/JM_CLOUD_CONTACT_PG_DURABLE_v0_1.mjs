// JM Cloud Contact v0.5.1 — OPTIONAL durable snapshot backing.
// Existing app API remains unchanged. Caller MUST await save before acknowledging
// a mutating HTTP request. Isolated schema in an EXISTING owner-approved Postgres.
import crypto from 'node:crypto';
import pg from 'pg';
const {Pool}=pg;
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');

export class JMDurableContactStore {
  constructor({connectionString,pool=null,allowEmpty=false}={}){
    if(!connectionString&&!pool)throw Error('Dedicated JM Cloud Contact Postgres connection required');
    this.pool=pool||new Pool({connectionString,max:2,connectionTimeoutMillis:7500,idleTimeoutMillis:10000});
    this.ownsPool=!pool;
    this.allowEmpty=allowEmpty;
    this.version=null;
    this.signerKeyId=null;
    this.authKeyCheck=null;
  }
  async open({signerKeyId,authKeyCheck}={}){
    if(!/^[a-f0-9]{64}$/.test(authKeyCheck||''))throw Error('Stable member-token HMAC key fingerprint required');
    this.authKeyCheck=authKeyCheck;
    if(!/^[a-f0-9]{24}$/.test(signerKeyId||''))throw Error('Stable server signing key ID required');
    this.signerKeyId=signerKeyId;
    await this.pool.query('CREATE SCHEMA IF NOT EXISTS jm_cloud_contact_v1');
    await this.pool.query(`CREATE TABLE IF NOT EXISTS jm_cloud_contact_v1.state (
      singleton INTEGER PRIMARY KEY CHECK(singleton=1),
      revision BIGINT NOT NULL CHECK(revision>=1),
      document TEXT NOT NULL,
      document_sha256 CHAR(64) NOT NULL,
      signer_key_id CHAR(24) NOT NULL,
      auth_key_check CHAR(64) NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    const result=await this.pool.query(
      'SELECT revision,document,document_sha256,signer_key_id,auth_key_check FROM jm_cloud_contact_v1.state WHERE singleton=1'
    );
    if(!result.rows.length){
      if(!this.allowEmpty)throw Error('JM Cloud Contact durable store has no state: explicit first-time initialization required');
      this.version=0;
      return null;
    }
    const row=result.rows[0];
    if(row.auth_key_check.trim()!==authKeyCheck)
      throw Error('JM Cloud Contact persisted member-token HMAC authority mismatch; refusing to rotate');
    if(row.signer_key_id.trim()!==signerKeyId)
      throw Error('JM Cloud Contact persisted signing identity mismatch; refusing to rotate');
    if(sha(row.document)!==row.document_sha256.trim())
      throw Error('JM Cloud Contact persisted state checksum mismatch');
    const doc=JSON.parse(row.document);
    if(doc?.schema!=='jm.cloud-contact.server/0.5'||doc.version!==5||typeof doc.spaces!=='object'||!doc.spaces)
      throw Error('JM Cloud Contact persisted state schema invalid');
    this.version=Number(row.revision);
    if(!Number.isSafeInteger(this.version)||this.version<1)throw Error('JM Cloud Contact durable revision invalid');
    return doc;
  }
  async save(doc){
    if(this.version===null)throw Error('JM Cloud Contact Postgres store not opened');
    const body=JSON.stringify(doc);
    const digest=sha(body);
    if(Buffer.byteLength(body)>12*1024*1024)throw Error('JM Cloud Contact snapshot size cap (12 MiB) exceeded');
    let result;
    if(this.version===0){
      result=await this.pool.query(
        `INSERT INTO jm_cloud_contact_v1.state
           (singleton,revision,document,document_sha256,signer_key_id,auth_key_check)
         VALUES (1,1,$1,$2,$3,$4)
         ON CONFLICT(singleton) DO NOTHING RETURNING revision`,
         [body,digest,this.signerKeyId,this.authKeyCheck]
      );
    }else{
      result=await this.pool.query(
        `UPDATE jm_cloud_contact_v1.state SET revision=revision+1,
          document=$1,document_sha256=$2,updated_at=NOW()
          WHERE singleton=1 AND revision=$3 AND signer_key_id=$4 AND auth_key_check=$5
          RETURNING revision`,
        [body,digest,this.version,this.signerKeyId,this.authKeyCheck]
      );
    }
    if(result.rowCount!==1)throw Error('JM Cloud Contact durable CAS/revision conflict; refusing acknowledgement');
    this.version=Number(result.rows[0].revision);
    return {revision:this.version,checksum:digest};
  }
  async close(){if(this.ownsPool)await this.pool.end()}
}
