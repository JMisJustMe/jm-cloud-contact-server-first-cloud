import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { URL } from 'node:url';

const NAME='JM CLOUD CONTACT SERVER';
const VERSION='0.4.2';
const SCHEMA='jm.cloud-contact.server/0.4';
const PORT=Number(process.env.PORT||8791);
const HOST=process.env.HOST||'0.0.0.0';
const MODE=String(process.env.JM_CLOUD_MODE||'development').toLowerCase();
const ADMIN_TOKEN=process.env.JM_CLOUD_ADMIN_TOKEN||'';
const SERVER_SECRET=process.env.JM_CLOUD_SERVER_SECRET||'';
const DATA_FILE=process.env.JM_CLOUD_DATA||path.resolve('./JM_CLOUD_CONTACT_DATA_v0_4.json');
const PUBLIC_DIR=process.env.JM_CLOUD_PUBLIC||path.resolve('./public');
const ORIGINS=(process.env.JM_CLOUD_ORIGINS||'*').split(',').map(x=>x.trim()).filter(Boolean);
const MAX_BODY=Math.max(16*1024,Math.min(1024*1024,Number(process.env.JM_CLOUD_MAX_BODY||256*1024)));
const MAX_EVENTS=Number(process.env.JM_CLOUD_MAX_EVENTS||10000);
const MAX_COMMANDS=Number(process.env.JM_CLOUD_MAX_COMMANDS||5000);
const MAX_SIGNALS=Number(process.env.JM_CLOUD_MAX_SIGNALS||5000);
const DEFAULT_TTL_MS=5*60*1000;
const ZERO='0'.repeat(64);
const RATE_WINDOW_MS=Math.max(1000,Number(process.env.JM_CLOUD_RATE_WINDOW_MS||60000));
const RATE_MAX=Math.max(10,Number(process.env.JM_CLOUD_RATE_MAX||240));
const startedAt=new Date().toISOString();

if(!ADMIN_TOKEN||!SERVER_SECRET){console.error(`${NAME} ${VERSION}: JM_CLOUD_ADMIN_TOKEN and JM_CLOUD_SERVER_SECRET required`);process.exit(2)}
if(MODE==='production'){
  if(ADMIN_TOKEN.length<32||SERVER_SECRET.length<32){console.error(`${NAME} ${VERSION}: production requires admin token and server secret >=32 characters`);process.exit(2)}
  if(ORIGINS.includes('*')){console.error(`${NAME} ${VERSION}: production refuses wildcard JM_CLOUD_ORIGINS`);process.exit(2)}
}

let db={schema:SCHEMA,version:4,nextCommandId:1,nextSignalId:1,spaces:{}};
try{const x=JSON.parse(fs.readFileSync(DATA_FILE,'utf8'));db={...db,...x,schema:SCHEMA,version:4,spaces:x.spaces||{}}}catch{}
const now=()=>new Date().toISOString();
const sha=s=>crypto.createHash('sha256').update(String(s)).digest('hex');
const hmac=s=>crypto.createHmac('sha256',SERVER_SECRET).update(String(s)).digest('hex');
const b64=b=>Buffer.from(b).toString('base64url');
const token=(p='jmcl_')=>p+b64(crypto.randomBytes(32));
const safe=s=>/^[A-Za-z0-9._:-]{1,128}$/.test(String(s||''));
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const timing=(a,b)=>{const A=Buffer.from(String(a)),B=Buffer.from(String(b));return A.length===B.length&&crypto.timingSafeEqual(A,B)};
const tokenHash=t=>hmac(`member-token\n${t}`);
const legacyTokenHash=t=>sha(`${SERVER_SECRET}\n${t}`);
function persist(){
  fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true,mode:0o700});
  const t=DATA_FILE+'.tmp';
  const raw=JSON.stringify(db,null,2);
  fs.writeFileSync(t,raw,{mode:0o600});
  try{fs.chmodSync(t,0o600)}catch{}
  fs.renameSync(t,DATA_FILE);
  try{fs.chmodSync(DATA_FILE,0o600)}catch{}
}
function bearer(req){const h=String(req.headers.authorization||'');return h.startsWith('Bearer ')?h.slice(7):''}
function isAdmin(req){return timing(bearer(req),ADMIN_TOKEN)}
function memberByToken(space,t){if(!t)return null;const current=tokenHash(t),legacy=legacyTokenHash(t);for(const [id,m] of Object.entries(space.members||{})){if(m.revokedAt)continue;const scheme=m.tokenScheme||'legacy-v0.2';const candidate=scheme==='hmac-sha256-v1'?current:legacy;if(timing(m.tokenHash,candidate))return{id,...m}}return null}
function authMember(req,space){return memberByToken(space,bearer(req))}
function originAllowed(req,o){
  if(ORIGINS.includes('*'))return '*';
  if(!o)return '';
  if(ORIGINS.includes(o))return o;
  if(ORIGINS.includes('self')){
    try{const x=new URL(o);const host=String(req.headers.host||'');if(x.host===host&&(MODE!=='production'||x.protocol==='https:'))return o}catch{}
  }
  return '';
}
function cors(req){const o=String(req.headers.origin||'');const allow=originAllowed(req,o);return {'Access-Control-Allow-Origin':allow,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type, X-JM-Request-ID','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Cross-Origin-Resource-Policy':'same-site'}}
function csp(type){return type.startsWith('text/html')?"default-src 'none'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'":"default-src 'none'; frame-ancestors 'none'"}
function send(req,res,code,body,type='application/json; charset=utf-8'){const raw=typeof body==='string'?body:JSON.stringify(body);res.writeHead(code,{...cors(req),'Content-Security-Policy':csp(type),'Content-Type':type,'Content-Length':Buffer.byteLength(raw)});res.end(raw)}
function sendPublic(req,res,file,type){try{const raw=fs.readFileSync(path.join(PUBLIC_DIR,file),'utf8');return send(req,res,200,raw,type)}catch{return send(req,res,404,{ok:false,error:'public asset not found'})}}
async function body(req){return await new Promise((resolve,reject)=>{let n=0,c=[];req.on('data',x=>{n+=x.length;if(n>MAX_BODY){reject(new Error('body too large'));req.destroy();return}c.push(x)});req.on('end',()=>{try{resolve(c.length?JSON.parse(Buffer.concat(c).toString('utf8')):{})}catch{reject(new Error('invalid json'))}});req.on('error',reject)})}
function parts(p){return p.split('/').filter(Boolean).map(decodeURIComponent)}
function getSpace(id){return db.spaces[id]||null}
function hasCap(m,cap){return (m.capabilities||[]).includes(cap)||(m.capabilities||[]).includes('*')}
function canReceiveCommand(m,action){return hasCap(m,`command:${action}`)||hasCap(m,'command:*')}
function canSignal(m,kind){return hasCap(m,`signal:${kind}`)||hasCap(m,'signal:*')}
function append(space,memberId,event,source='member'){
  const at=now(),prev=space.chainHead||ZERO,seq=(space.events.at(-1)?.seq||0)+1;
  const core={seq,at,memberId,source,event};
  const hash=sha(`${prev}\n${canonical(core)}`);
  const rec={...core,prevHash:prev,hash,serverSig:hmac(`event\n${hash}`)};
  space.events.push(rec);space.events=space.events.slice(-MAX_EVENTS);space.chainHead=hash;space.updatedAt=at;
  if(space.members[memberId])space.members[memberId].lastSeenAt=at;
  emitSpace(space,'event',rec);
  return rec;
}
function audit(space,type,payload){return append(space,'@server',{type,payload},'server')}
function publicMember(m){return{type:m.type,label:m.label,capabilities:m.capabilities,enrolledAt:m.enrolledAt,lastSeenAt:m.lastSeenAt||null,revokedAt:m.revokedAt||null,credentialVersion:m.credentialVersion||1,credentialScheme:m.tokenScheme||'legacy-v0.2'}}
function publicSpace(id,s,deep=false){const x={spaceId:id,label:s.label,kind:s.kind,status:s.status||'active',createdAt:s.createdAt,updatedAt:s.updatedAt,memberCount:Object.keys(s.members||{}).length,eventCount:s.events.length,commandCount:s.commands.length,signalCount:s.signals.length,chainHead:s.chainHead||ZERO,members:Object.fromEntries(Object.entries(s.members||{}).map(([k,m])=>[k,publicMember(m)]))};if(deep){expireCommands(s);x.events=s.events;x.commands=s.commands;x.signals=s.signals.map(({payload,...rest})=>rest);x.metadata=s.metadata||{}}return x}
function receipt(id,s){expireCommands(s);const snap={schema:'jm.cloud-contact.space-receipt/0.4',spaceId:id,label:s.label,kind:s.kind,status:s.status||'active',createdAt:s.createdAt,updatedAt:s.updatedAt,members:Object.fromEntries(Object.entries(s.members||{}).map(([k,m])=>[k,publicMember(m)])),eventCount:s.events.length,commandCount:s.commands.length,signalCount:s.signals.length,chainHead:s.chainHead||ZERO};const receiptHash=sha(canonical(snap));return {...snap,receiptHash,serverSig:hmac(`receipt\n${receiptHash}`),claimBoundary:'Server receipt proves server-side contact only; external consequence requires route-specific endpoint/application evidence.'}}
function expireCommands(s){let changed=false;const t=Date.now();for(const c of s.commands){if(['queued','accepted'].includes(c.status)&&Date.parse(c.expiresAt)<=t){c.status='expired';c.expiredAt=now();changed=true;emitSpace(s,'command',c)}}if(changed){s.updatedAt=now();persist()}return changed}
function requestId(req,j){return String(j.requestId||req.headers['x-jm-request-id']||'').slice(0,160)}
function findDedupe(s,kind,rid){if(!rid)return null;if(kind==='command')return s.commands.find(x=>x.requestId===rid)||null;if(kind==='signal')return s.signals.find(x=>x.requestId===rid)||null;if(kind==='event')return s.events.find(x=>x.event?.requestId===rid)||null;return null}

const rate=new Map();
function rateKey(req){const auth=bearer(req);return `${req.socket.remoteAddress||'unknown'}:${auth?sha(auth).slice(0,12):'anon'}`}
function allowed(req){const k=rateKey(req),t=Date.now();let r=rate.get(k);if(!r||t-r.start>=RATE_WINDOW_MS)r={start:t,count:0};r.count++;rate.set(k,r);if(rate.size>5000){for(const [key,v] of rate)if(t-v.start>RATE_WINDOW_MS*2)rate.delete(key)}return r.count<=RATE_MAX}

const watchers=new WeakMap();
function watch(space,res){let set=watchers.get(space);if(!set){set=new Set();watchers.set(space,set)}set.add(res);res.on('close',()=>set.delete(res))}
function emitSpace(space,type,data){const set=watchers.get(space);if(!set)return;const raw=`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;for(const r of [...set]){try{r.write(raw)}catch{set.delete(r)}}}
const heartbeat=setInterval(()=>{for(const s of Object.values(db.spaces)){const set=watchers.get(s);if(set)for(const r of [...set]){try{r.write(`event: ping\ndata: ${JSON.stringify({at:now()})}\n\n`)}catch{set.delete(r)}}}},20000);heartbeat.unref();

const PAGE=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>JM Cloud Contact Server</title><h1>JM CLOUD CONTACT SERVER v0.4.2</h1><p>Public launch descendant.</p><p><a href="/console">Open First Public Cloud Ding Console</a></p>`;
function requireActive(req,res,s){if((s.status||'active')!=='active'){send(req,res,409,{ok:false,error:'space is closed'});return false}return true}
function issueMember(space,id,d){const raw=token();space.members[id]={type:String(d.type||'client').slice(0,64),label:String(d.label||id).slice(0,120),capabilities:[...new Set((Array.isArray(d.capabilities)?d.capabilities:[]).map(String).slice(0,128))],tokenHash:tokenHash(raw),tokenScheme:'hmac-sha256-v1',enrolledAt:now(),lastSeenAt:null,revokedAt:null,credentialVersion:1};return raw}

const server=http.createServer(async(req,res)=>{try{
  if(req.method==='OPTIONS'){res.writeHead(204,cors(req));return res.end()}
  if(!allowed(req))return send(req,res,429,{ok:false,error:'rate limit exceeded'});
  const u=new URL(req.url,`http://${req.headers.host||'localhost'}`),p=parts(u.pathname);
  if(req.method==='GET'&&u.pathname==='/')return fs.existsSync(path.join(PUBLIC_DIR,'index.html'))?sendPublic(req,res,'index.html','text/html; charset=utf-8'):send(req,res,200,PAGE,'text/html; charset=utf-8');
  if(req.method==='GET'&&['/console','/console.html'].includes(u.pathname))return sendPublic(req,res,'console.html','text/html; charset=utf-8');
  if(req.method==='GET'&&u.pathname==='/meta')return send(req,res,200,{ok:true,name:NAME,version:VERSION,schema:SCHEMA,apiRoots:['/v4','/v3'],console:'/console',claimBoundary:'Hosted console proves public server/browser contact only; route-specific external consequences require their own endpoint evidence.'});
  if(req.method==='GET'&&u.pathname==='/health')return send(req,res,200,{ok:true,name:NAME,version:VERSION,schema:SCHEMA,mode:MODE,spaces:Object.keys(db.spaces).length,startedAt});
  if(req.method==='GET'&&u.pathname==='/ready')return send(req,res,200,{ok:true,ready:true,dataFile:!!DATA_FILE,mode:MODE});
  if(req.method==='POST'&&['/v4/spaces','/v3/spaces'].includes(u.pathname)){
    if(!isAdmin(req))return send(req,res,401,{ok:false,error:'admin unauthorized'});const j=await body(req);const id=String(j.spaceId||`space_${Date.now()}_${b64(crypto.randomBytes(4))}`);if(!safe(id)||db.spaces[id])return send(req,res,400,{ok:false,error:'invalid or existing spaceId'});
    const defs=Array.isArray(j.members)?j.members:[];if(defs.length<1||defs.length>64)return send(req,res,400,{ok:false,error:'members must contain 1..64 entries'});
    const s={label:String(j.label||id).slice(0,120),kind:String(j.kind||'general').slice(0,64),status:'active',metadata:j.metadata&&typeof j.metadata==='object'?j.metadata:{},createdAt:now(),updatedAt:now(),members:{},events:[],commands:[],signals:[],chainHead:ZERO};const credentials={};
    for(const d of defs){const mid=String(d.id||'');if(!safe(mid)||s.members[mid])return send(req,res,400,{ok:false,error:`invalid/duplicate member id ${mid}`});credentials[mid]=issueMember(s,mid,d)}
    db.spaces[id]=s;audit(s,'space.created',{spaceId:id,kind:s.kind,memberIds:Object.keys(s.members)});persist();return send(req,res,201,{ok:true,space:publicSpace(id,s),credentials,warning:'Member credentials are returned once; store them separately.'});
  }
  if(req.method==='GET'&&['/v4/spaces','/v3/spaces'].includes(u.pathname)){if(!isAdmin(req))return send(req,res,401,{ok:false,error:'admin unauthorized'});return send(req,res,200,{ok:true,spaces:Object.entries(db.spaces).map(([id,s])=>publicSpace(id,s))})}
  if(['v4','v3'].includes(p[0])&&p[1]==='spaces'&&safe(p[2])){const id=p[2],s=getSpace(id);if(!s)return send(req,res,404,{ok:false,error:'space not found'});
    if(req.method==='GET'&&p.length===3){if(!isAdmin(req))return send(req,res,401,{ok:false,error:'admin unauthorized'});return send(req,res,200,{ok:true,space:publicSpace(id,s,true)})}
    if(req.method==='GET'&&p[3]==='receipt'){if(!isAdmin(req))return send(req,res,401,{ok:false,error:'admin unauthorized'});return send(req,res,200,{ok:true,receipt:receipt(id,s)})}
    if(req.method==='GET'&&p[3]==='stream'){
      if(!isAdmin(req))return send(req,res,401,{ok:false,error:'admin unauthorized'});res.writeHead(200,{...cors(req),'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`event: snapshot\ndata: ${JSON.stringify(publicSpace(id,s,true))}\n\n`);watch(s,res);return;
    }
    if(req.method==='POST'&&p[3]==='close'&&p.length===4){if(!isAdmin(req))return send(req,res,401,{ok:false,error:'admin unauthorized'});if((s.status||'active')==='closed')return send(req,res,200,{ok:true,space:publicSpace(id,s)});s.status='closed';audit(s,'space.closed',{spaceId:id});persist();return send(req,res,200,{ok:true,space:publicSpace(id,s)})}
    if(req.method==='POST'&&p[3]==='members'&&p.length===4){if(!isAdmin(req))return send(req,res,401,{ok:false,error:'admin unauthorized'});if(!requireActive(req,res,s))return;const j=await body(req);const mid=String(j.id||'');if(!safe(mid)||s.members[mid])return send(req,res,400,{ok:false,error:'valid new member id required'});const raw=issueMember(s,mid,j);audit(s,'member.added',{memberId:mid,type:s.members[mid].type,capabilities:s.members[mid].capabilities});persist();return send(req,res,201,{ok:true,member:publicMember(s.members[mid]),credential:raw,warning:'Credential returned once.'})}
    if(req.method==='POST'&&p[3]==='members'&&safe(p[4])&&['rotate','revoke'].includes(p[5])){if(!isAdmin(req))return send(req,res,401,{ok:false,error:'admin unauthorized'});const mid=p[4],m=s.members[mid];if(!m)return send(req,res,404,{ok:false,error:'member not found'});if(p[5]==='revoke'){m.revokedAt=now();audit(s,'member.revoked',{memberId:mid});persist();return send(req,res,200,{ok:true,member:publicMember(m)})}const raw=token();m.tokenHash=tokenHash(raw);m.tokenScheme='hmac-sha256-v1';m.revokedAt=null;m.credentialVersion=(m.credentialVersion||1)+1;m.lastSeenAt=null;audit(s,'member.credential.rotated',{memberId:mid,credentialVersion:m.credentialVersion});persist();return send(req,res,200,{ok:true,member:publicMember(m),credential:raw,warning:'Replacement credential returned once; previous credential is invalid.'})}
    if(req.method==='POST'&&p[3]==='events'){
      if(!requireActive(req,res,s))return;const m=authMember(req,s);if(!m)return send(req,res,401,{ok:false,error:'member unauthorized'});if(!hasCap(m,'event:write')&&!hasCap(m,'event:*'))return send(req,res,403,{ok:false,error:'event capability denied'});const j=await body(req);if(!j.event||typeof j.event!=='object')return send(req,res,400,{ok:false,error:'event object required'});const rid=requestId(req,j);const old=findDedupe(s,'event',rid);if(old)return send(req,res,200,{ok:true,deduplicated:true,record:old});const evt={...j.event,...(rid?{requestId:rid}:{})};const rec=append(s,m.id,evt);persist();return send(req,res,201,{ok:true,record:rec});
    }
    if(req.method==='POST'&&p[3]==='commands'&&p.length===4){
      if(!isAdmin(req))return send(req,res,401,{ok:false,error:'admin unauthorized'});if(!requireActive(req,res,s))return;const j=await body(req);const action=String(j.action||''),target=String(j.target||'');if(!safe(action)||!safe(target)||!s.members[target]||s.members[target].revokedAt)return send(req,res,400,{ok:false,error:'valid active target and action required'});if(!canReceiveCommand({id:target,...s.members[target]},action))return send(req,res,403,{ok:false,error:'target capability denies command'});const rid=requestId(req,j),old=findDedupe(s,'command',rid);if(old)return send(req,res,200,{ok:true,deduplicated:true,command:old});const ttl=Math.max(5000,Math.min(3600000,Number(j.ttlMs||DEFAULT_TTL_MS)));const c={id:db.nextCommandId++,requestId:rid||null,action,target,payload:j.payload??null,createdAt:now(),expiresAt:new Date(Date.now()+ttl).toISOString(),status:'queued',ack:null,result:null};s.commands.push(c);s.commands=s.commands.slice(-MAX_COMMANDS);s.updatedAt=now();audit(s,'command.queued',{commandId:c.id,requestId:c.requestId,action,target,expiresAt:c.expiresAt});persist();emitSpace(s,'command',c);return send(req,res,201,{ok:true,command:c});
    }
    if(req.method==='GET'&&p[3]==='commands'&&p.length===4){const m=authMember(req,s);if(!m)return send(req,res,401,{ok:false,error:'member unauthorized'});expireCommands(s);const after=Number(u.searchParams.get('after')||0);const cmds=s.commands.filter(c=>c.id>after&&c.target===m.id&&['queued','accepted'].includes(c.status)&&Date.parse(c.expiresAt)>Date.now()).map(({result,...c})=>c);return send(req,res,200,{ok:true,commands:cmds})}
    if(req.method==='POST'&&p[3]==='commands'&&Number(p[4])&&['ack','result'].includes(p[5])){if(!requireActive(req,res,s))return;const m=authMember(req,s);if(!m)return send(req,res,401,{ok:false,error:'member unauthorized'});expireCommands(s);const c=s.commands.find(x=>x.id===Number(p[4]));if(!c||c.target!==m.id)return send(req,res,404,{ok:false,error:'command not found for member'});if(c.status==='expired')return send(req,res,409,{ok:false,error:'command expired'});const j=await body(req);if(p[5]==='ack'){c.ack={at:now(),status:String(j.status||'accepted').slice(0,32),note:String(j.note||'').slice(0,500)};c.status=c.ack.status==='accepted'?'accepted':'rejected';audit(s,'command.ack',{commandId:c.id,target:m.id,status:c.status})}else{c.result={at:now(),ok:j.ok!==false,kind:String(j.kind||'RESULT').slice(0,64),detail:j.detail??null};c.status=c.result.ok?'completed':'failed';audit(s,'command.result',{commandId:c.id,target:m.id,status:c.status,kind:c.result.kind})}s.updatedAt=now();persist();emitSpace(s,'command',c);return send(req,res,200,{ok:true,command:c})}
    if(req.method==='POST'&&p[3]==='signals'){
      if(!requireActive(req,res,s))return;const m=authMember(req,s);if(!m)return send(req,res,401,{ok:false,error:'member unauthorized'});const j=await body(req);const to=String(j.to||''),kind=String(j.kind||'');if(!s.members[to]||s.members[to].revokedAt)return send(req,res,400,{ok:false,error:'destination member not active'});if(!canSignal(m,kind)||!canSignal({id:to,...s.members[to]},kind))return send(req,res,403,{ok:false,error:'signal capability denied'});const rid=requestId(req,j),old=findDedupe(s,'signal',rid);if(old)return send(req,res,200,{ok:true,deduplicated:true,signal:{...old,payload:undefined}});const rec={id:db.nextSignalId++,requestId:rid||null,from:m.id,to,kind,payload:j.payload??null,at:now()};s.signals.push(rec);s.signals=s.signals.slice(-MAX_SIGNALS);s.updatedAt=now();audit(s,'signal.sent',{signalId:rec.id,requestId:rec.requestId,from:rec.from,to:rec.to,kind:rec.kind});persist();emitSpace(s,'signal',{...rec,payload:undefined});return send(req,res,201,{ok:true,signal:{...rec,payload:undefined}})
    }
    if(req.method==='GET'&&p[3]==='signals'){const m=authMember(req,s);if(!m)return send(req,res,401,{ok:false,error:'member unauthorized'});const after=Number(u.searchParams.get('after')||0);return send(req,res,200,{ok:true,signals:s.signals.filter(x=>x.id>after&&x.to===m.id)})}
  }
  return send(req,res,404,{ok:false,error:'not found'});
}catch(e){if(!res.headersSent)send(req,res,400,{ok:false,error:String(e.message||e)});else res.end()}});

let stopping=false;
function shutdown(sig){if(stopping)return;stopping=true;console.log(`${NAME} ${VERSION} shutting down (${sig})`);try{persist()}catch(e){console.error('persist during shutdown failed',e)}server.close(()=>process.exit(0));setTimeout(()=>process.exit(1),5000).unref()}
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));
server.listen(PORT,HOST,()=>console.log(`${NAME} ${VERSION} listening on http://${HOST}:${PORT} mode=${MODE}`));
