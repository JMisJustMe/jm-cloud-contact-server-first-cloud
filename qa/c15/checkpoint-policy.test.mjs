import test from 'node:test';
import assert from 'node:assert/strict';
import {assessCheckpoint} from '../../contact/JM_CLOUD_CONTACT_CHECKPOINT_POLICY_v0_1.mjs';
const hash='a'.repeat(64),other='b'.repeat(64);
const fence={owner:'winner',epoch:3,snapshot_revision:'9',snapshot_sha256:hash};
const check=x=>assessCheckpoint({fence,owner:'winner',epoch:3,revision:9,checksum:hash,...x});
const cases=[
 ['matched state and fence',{},'MATCHED'],
 ['owner rotated',{owner:'stale'},'WRITER_AUTHORITY_CHANGED'],
 ['epoch rotated',{epoch:2},'WRITER_AUTHORITY_CHANGED'],
 ['state ahead after lost fence update',{revision:10},'STATE_AHEAD_OF_FENCE_UNCERTAIN_COMMIT'],
 ['state behind after restore',{revision:8},'FENCE_AHEAD_OF_STATE_UNCERTAIN_COMMIT'],
 ['same revision different bytes',{checksum:other},'FENCE_STATE_CHECKSUM_DIVERGENCE'],
 ['missing checksum',{checksum:null},'DURABLE_CHECKSUM_INVALID'],
 ['invalid state revision',{revision:1.3},'DURABLE_REVISION_INVALID'],
 ['fence missing row',{fence:null},'WRITER_AUTHORITY_CHANGED'],
 ['fence missing watermark',{fence:{...fence,snapshot_revision:null}},'FENCE_MISSING_COMMIT'],
 ['fence malformed watermark',{fence:{...fence,snapshot_revision:'oops'}},'FENCE_REVISION_INVALID'],
 ['fence has future revision',{fence:{...fence,snapshot_revision:'10'}},'FENCE_AHEAD_OF_STATE_UNCERTAIN_COMMIT'],
 ['new empty initializes clean',{fence:{owner:'winner',epoch:3,snapshot_revision:null,snapshot_sha256:null},revision:0,checksum:null},'MATCHED_EMPTY'],
 ['empty with old fence',{revision:0,checksum:null},'FENCE_HAS_UNMATCHED_COMMIT'],
 ['empty with checksum',{fence:{owner:'winner',epoch:3,snapshot_revision:null,snapshot_sha256:null},revision:0,checksum:hash},'EMPTY_STATE_HAS_CHECKSUM'],
 ['empty null fence hash nonnull',{fence:{owner:'winner',epoch:3,snapshot_revision:null,snapshot_sha256:hash},revision:0,checksum:null},'FENCE_HAS_UNMATCHED_COMMIT'],
 ['nonempty fence no checksum',{fence:{...fence,snapshot_sha256:null}},'FENCE_MISSING_COMMIT'],
 ['no production authority',{},{status:'MATCHED',productionApproved:false}]
];
for(const [name,over,want] of cases)test(name,()=>{
  const r=check(over);
  if(typeof want==='string')assert.equal(want==='MATCHED'?'MATCHED':want,r.status==='HOLD'?r.reason:r.status);
  else {assert.equal(r.status,want.status);assert.equal(r.productionApproved,want.productionApproved);}
  assert.equal(r.productionApproved,false);
});
