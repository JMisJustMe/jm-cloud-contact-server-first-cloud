import { DatabaseSync } from 'node:sqlite';
import { createHash, createHmac } from 'node:crypto';
import { missionText, receiptCore } from './protocol.mjs';
const hash = t => createHash('sha256').update(t).digest('hex');
const sign = (key,text) => createHmac('sha256',key).update(text).digest('hex');
export class LocalStore {
  constructor(file, receiptKey) {
    this.db = new DatabaseSync(file,{timeout:5000});
    this.key=receiptKey;
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS artifacts(name TEXT PRIMARY KEY, revision INTEGER NOT NULL, content TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history(name TEXT NOT NULL, revision INTEGER NOT NULL, content TEXT NOT NULL, mission_id TEXT NOT NULL,PRIMARY KEY(name,revision));
      CREATE TABLE IF NOT EXISTS applied(seq INTEGER PRIMARY KEY AUTOINCREMENT, mission_id TEXT NOT NULL UNIQUE,job_hash TEXT NOT NULL, receipt TEXT NOT NULL, chain_hash TEXT NOT NULL);`);
  }
  read(name) {return this.db.prepare('SELECT revision,content FROM artifacts WHERE name=?').get(name)??null;}
  apply(m,jobHash) {
    if(hash(missionText(m))!==jobHash) throw new Error('MISSION_HASH_MISMATCH');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const known=this.db.prepare('SELECT job_hash,receipt FROM applied WHERE mission_id=?').get(m.id);
      if(known){
        if(known.job_hash!==jobHash) throw new Error('CONFLICTING_MISSION_ID');
        this.db.exec('COMMIT'); return JSON.parse(known.receipt);
      }
      let status='PASS',code='APPLIED',revision=0,contentHash=hash(''),artifact=m.artifact??null;
      if (m.op==='probe') {code='PROBE_OK';contentHash=hash(m.challenge??'');}
      else {
        const previous=this.read(m.artifact);
        revision=previous?.revision??0; contentHash=hash(previous?.content??'');
        if(revision!==m.expected_revision) {status='HOLD';code='REVISION_CONFLICT';}
        else {
          let content;
          if(m.op==='restore') {
            const original=this.db.prepare('SELECT content FROM history WHERE name=? AND revision=?').get(m.artifact,m.source_revision);
            if(!original) {status='HOLD';code='REVISION_NOT_FOUND';}
            else content=original.content;
          } else content=m.content;
          if(status==='PASS') {
            revision += 1; contentHash=hash(content);
            this.db.prepare(`INSERT INTO artifacts(name,revision,content) VALUES(?,?,?)
              ON CONFLICT(name) DO UPDATE SET revision=excluded.revision,content=excluded.content`).run(m.artifact,revision,content);
            this.db.prepare('INSERT INTO history(name,revision,content,mission_id) VALUES(?,?,?,?)').run(m.artifact,revision,content,m.id);
            code=m.op==='restore'?'RESTORED_AS_NEW_REVISION':'WRITTEN';
          }
        }
      }
      const prior=this.db.prepare('SELECT chain_hash FROM applied ORDER BY seq DESC LIMIT 1').get();
      const prev_chain=prior?.chain_hash??'GENESIS';
      const raw={id:m.id,job_hash:jobHash,status,code,artifact,revision,content_hash:contentHash,prev_chain};
      const chain_hash=hash(prev_chain+'\n'+JSON.stringify(raw));
      const receipt={...raw,chain_hash};
      receipt.sig=sign(this.key,JSON.stringify(receiptCore(receipt)));
      this.db.prepare('INSERT INTO applied(mission_id,job_hash,receipt,chain_hash) VALUES(?,?,?,?)').run(m.id,jobHash,JSON.stringify(receipt),chain_hash);
      this.db.exec('COMMIT'); return receipt;
    } catch(e) {this.db.exec('ROLLBACK');throw e;}
  }
  audit(){
    const entries=this.db.prepare('SELECT mission_id,job_hash,receipt,chain_hash FROM applied ORDER BY seq').all();
    let last='GENESIS'; const errors=entries.length?[]:['EMPTY_JOURNAL_NO_CONTACT_PROOF'];
    for(const entry of entries){
      try{
        const r=JSON.parse(entry.receipt);
        const basic={id:r.id,job_hash:r.job_hash,status:r.status,code:r.code,artifact:r.artifact,revision:r.revision,content_hash:r.content_hash,prev_chain:r.prev_chain};
        const expectedChain=hash(last+'\n'+JSON.stringify(basic));
        if(r.id!==entry.mission_id || r.job_hash!==entry.job_hash || r.prev_chain!==last || r.chain_hash!==expectedChain || entry.chain_hash!==expectedChain) errors.push(entry.mission_id+':CHAIN');
        if(r.sig!==sign(this.key,JSON.stringify(receiptCore(r)))) errors.push(entry.mission_id+':SIGNATURE');
        last=entry.chain_hash;
      }catch{errors.push(entry.mission_id+':INVALID_JSON');}
    }
    return {status:errors.length?'HOLD':'PASS',entries:entries.length,head:last,errors};
  }
  close(){this.db.close();}
}
