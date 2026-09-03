/* General browser/client SDK for JM CLOUD CONTACT SERVER v0.4 */
(()=>{'use strict';
function create({baseUrl,spaceId,memberToken,onCommand,onSignal,onError}={}){
 const base=String(baseUrl||'').replace(/\/+$/,''),sid=String(spaceId||''),tok=String(memberToken||'');if(!base||!sid||!tok)throw new Error('baseUrl, spaceId, memberToken required');let cc=0,sc=0,stop=false,ct,st;
 const H={'Authorization':'Bearer '+tok,'Content-Type':'application/json'};const api=async(p,o={})=>{const r=await fetch(base+p,{...o,headers:{...H,...(o.headers||{})}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||`HTTP ${r.status}`);return j};const root=`/v4/spaces/${encodeURIComponent(sid)}`;const rid=()=>`jmreq_${Date.now()}_${Math.random().toString(36).slice(2)}`;
 async function event(type,payload=null,meta=null,requestId=rid()){return api(root+'/events',{method:'POST',headers:{'X-JM-Request-ID':requestId},body:JSON.stringify({event:{type,payload,meta}})})}
 async function commands(){const j=await api(root+`/commands?after=${cc}`);for(const c of j.commands||[]){cc=Math.max(cc,Number(c.id)||0);try{await api(root+`/commands/${c.id}/ack`,{method:'POST',body:JSON.stringify({status:'accepted'})});const out=onCommand?await onCommand(c):{ok:true,kind:'NO_HANDLER'};await api(root+`/commands/${c.id}/result`,{method:'POST',body:JSON.stringify({ok:out?.ok!==false,kind:out?.kind||'CLIENT_RESULT',detail:out?.detail??out??null})})}catch(e){onError?.(e,'command')}}}
 async function signal(to,kind,payload,requestId=rid()){return api(root+'/signals',{method:'POST',headers:{'X-JM-Request-ID':requestId},body:JSON.stringify({to,kind,payload})})}
 async function signals(){const j=await api(root+`/signals?after=${sc}`);for(const s of j.signals||[]){sc=Math.max(sc,Number(s.id)||0);try{await onSignal?.(s)}catch(e){onError?.(e,'signal')}}}
 function start({commandMs=1000,signalMs=1000}={}){stop=false;const a=async()=>{if(stop)return;try{await commands()}catch(e){onError?.(e,'commands')}finally{if(!stop)ct=setTimeout(a,commandMs)}};const b=async()=>{if(stop)return;try{await signals()}catch(e){onError?.(e,'signals')}finally{if(!stop)st=setTimeout(b,signalMs)}};a();b()}
 function close(){stop=true;clearTimeout(ct);clearTimeout(st)}return{event,commands,signal,signals,start,close,get cursors(){return{command:cc,signal:sc}}}
}
window.JMCloudContact={version:'0.4.0',create};})();
