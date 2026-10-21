import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifySourceReturn,REQUEST_SCHEMA,RETURN_SCHEMA} from './JM_M002_SOURCE_RETURN_GATE_v0_1.mjs';
const source=Buffer.from('JM public synthetic test source body; not a real provider response.','utf8');
const digest=createHash('sha256').update(source).digest('hex');
const request={
  schema:REQUEST_SCHEMA,challengeId:'jm-m002-synthetic-0001',nonce:'f47ac8893a00e5c9112b9bbf',
  source:{fileName:'synthetic.txt',bytes:source.length,sha256:digest}
};
const returned={schema:RETURN_SCHEMA,claimedProvider:'gemini',challengeId:request.challengeId,
  nonce:request.nonce,sourceSha256:digest,analysis:'Synthetic sample summary (not from Gemini).'};
const verify=(r=request,x=returned,b=source)=>verifySourceReturn({request:r,returned:x,sourceBytes:b});
test('source bytes and nonce produce a narrowly scoped PASS',()=>{
 const x=verify();assert.equal(x.status,'SOURCE_RETURN_BYTES_BOUND');assert.equal(x.localSourceBytesVerified,true);
 assert.equal(x.providerIdentityVerified,false);assert.equal(x.providerExecutionVerified,false);assert.equal(x.externalProviderContactVerified,false);
});
test('source changed by one byte cannot pass',()=>{
 assert.deepEqual(verify(request,returned,Buffer.from('changed')).errors,['SOURCE_BYTE_COUNT_MISMATCH','SOURCE_SHA256_MISMATCH','RETURN_SOURCE_HASH_MISMATCH']);
});
test('return claiming different source does not pass',()=>{
 assert.ok(verify(request,{...returned,sourceSha256:'0'.repeat(64)}).errors.includes('RETURN_SOURCE_HASH_MISMATCH'));
});
test('reused return from another challenge is refused',()=>{
 assert.ok(verify({...request,nonce:'other-nonce-12345678'}).errors.includes('NONCE_MISMATCH'));
 assert.ok(verify({...request,challengeId:'another-request-12345'}).errors.includes('CHALLENGE_ID_MISMATCH'));
});
test('malformed claims rejected, no provider identity trust',()=>{
 assert.equal(verify(request,{...returned,claimedProvider:'unrecognised'}).status,'HOLD');
 assert.equal(verify(request,{...returned,analysis:' ' .repeat(2401)}).status,'HOLD');
 assert.equal(verify(request,returned,null).status,'HOLD');
});
test('unknown source and replayed names cannot establish provenance',()=>{
 assert.equal(verify({...request,source:{...request.source,sha256:'a'.repeat(64)}}).status,'HOLD');
 const x=verify(request,{...returned,claimedProvider:'openai'});
 assert.equal(x.status,'SOURCE_RETURN_BYTES_BOUND');assert.equal(x.providerIdentityVerified,false);
});
