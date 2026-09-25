import fs from 'node:fs';
import path from 'node:path';

const PAGE=path.resolve('./market/JM_MARKET_ECOSYSTEM_LAB_v1_2_HOSTED.html');
const PAIRS={
  'BTC/GBP':{kraken:'XBTGBP',coinbase:'BTC-GBP'},
  'ETH/GBP':{kraken:'ETHGBP',coinbase:'ETH-GBP'},
  'BTC/USD':{kraken:'XBTUSD',coinbase:'BTC-USD'},
  'ETH/USD':{kraken:'ETHUSD',coinbase:'ETH-USD'}
};
const now=()=>new Date().toISOString();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const timed=async(fn)=>{const started=Date.now();try{return{ok:true,value:await fn(),startedAt:new Date(started).toISOString(),finishedAt:now(),durationMs:Date.now()-started}}catch(e){return{ok:false,error:String(e.message||e),startedAt:new Date(started).toISOString(),finishedAt:now(),durationMs:Date.now()-started}}};
const getJson=async url=>{const r=await fetch(url,{headers:{accept:'application/json','user-agent':'JM-Market-Ecosystem-Lab/1.2'},signal:AbortSignal.timeout(6000)}),text=await r.text();let j;try{j=JSON.parse(text)}catch{throw Error('non-JSON response')};if(!r.ok)throw Error('HTTP '+r.status+' '+JSON.stringify(j).slice(0,240));return j};
const quoteKraken=async pair=>{const j=await getJson('https://api.kraken.com/0/public/Ticker?pair='+encodeURIComponent(pair));if(j.error?.length)throw Error(j.error.join('; '));const x=Object.values(j.result||{})[0];if(!x?.a?.[0]||!x?.b?.[0])throw Error('ticker missing bid/ask');return{bid:+x.b[0],ask:+x.a[0],last:+(x.c?.[0]||NaN),source:'Kraken public ticker'}};
const quoteCoinbase=async product=>{const j=await getJson('https://api.exchange.coinbase.com/products/'+encodeURIComponent(product)+'/ticker');if(!j.bid||!j.ask)throw Error('ticker missing bid/ask');return{bid:+j.bid,ask:+j.ask,last:+(j.price||NaN),sourceAt:j.time||null,source:'Coinbase Exchange public ticker'}};
const headers=(type='application/json; charset=utf-8')=>({'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()',...(type.startsWith('text/html')?{'content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'self'; form-action 'none'"}:{})});
const send=(res,status,obj,type='application/json; charset=utf-8')=>{const raw=type.startsWith('application/json')?JSON.stringify(obj):String(obj);res.writeHead(status,{...headers(type),'content-length':Buffer.byteLength(raw)});res.end(raw)};

export function createMarketLabProfile({dataFile}={}){
 const file=dataFile||path.resolve('./JM_MARKET_LAB_STATE_v0_2.json'), enabled=(process.env.JM_MARKET_PULSE_ENABLED??(process.env.NODE_ENV==='production'?'1':'0'))==='1',
 intervalMs=clamp(+process.env.JM_MARKET_PULSE_INTERVAL_MS||60000,15000,3600000),
 pulsePairs=(process.env.JM_MARKET_PULSE_PAIRS||'BTC/GBP;ETH/GBP').split(';').map(x=>x.trim().toUpperCase()).filter(x=>PAIRS[x]).slice(0,4);
 let state={schema:'JM.MarketEcosystemLab.State/0.2',startedAt:now(),snapshots:[],pulse:{enabled,intervalMs,pairs:pulsePairs,lastRunAt:null,lastRunDurationMs:null,lastAnySuccessAt:null,lastError:null,runCount:0,venues:{kraken:{lastSuccessAt:null,lastError:null},coinbase:{lastSuccessAt:null,lastError:null}}}};
 try{const j=JSON.parse(fs.readFileSync(file,'utf8'));state={...state,...j,startedAt:now(),pulse:{...state.pulse,...(j.pulse||{}),enabled,intervalMs,pairs:pulsePairs,venues:{...state.pulse.venues,...(j.pulse?.venues||{})}}};state.snapshots=Array.isArray(j.snapshots)?j.snapshots.slice(-20000):[]}catch{}
 let timer=null,running=false;
 const persist=()=>{try{fs.mkdirSync(path.dirname(file),{recursive:true});const t=file+'.tmp';fs.writeFileSync(t,JSON.stringify(state));fs.renameSync(t,file)}catch(e){state.pulse.lastError='persist: '+String(e.message||e)}};
 const venue=x=>x.ok?{ok:true,...x.value,startedAt:x.startedAt,finishedAt:x.finishedAt,durationMs:x.durationMs}:{ok:false,error:x.error,startedAt:x.startedAt,finishedAt:x.finishedAt,durationMs:x.durationMs};
 async function fetchQuotes(symbol,source='request'){
   const map=PAIRS[symbol];if(!map)throw Error('unsupported symbol');
   const fetchedAt=now(),[ka,co]=await Promise.all([timed(()=>quoteKraken(map.kraken)),timed(()=>quoteCoinbase(map.coinbase))]),venues={kraken:venue(ka),coinbase:venue(co)};
   const both=venues.kraken.ok&&venues.coinbase.ok;
   const routes=both?[
     {route:'Kraken -> Coinbase',rawBps:(venues.coinbase.bid/venues.kraken.ask-1)*10000},
     {route:'Coinbase -> Kraken',rawBps:(venues.kraken.bid/venues.coinbase.ask-1)*10000}
   ].sort((a,b)=>b.rawBps-a.rawBps):[];
   const ends=[venues.kraken.finishedAt,venues.coinbase.finishedAt].filter(Boolean).map(Date.parse).filter(Number.isFinite);
   return{ok:ka.ok||co.ok,schema:'JM.MarketExecutableQuote/0.2',symbol,source,fetchedAt,venues,bestRawRoute:routes[0]||null,bestRawBps:routes[0]?.rawBps??null,receiveSkewMs:ends.length===2?Math.abs(ends[0]-ends[1]):null,claimBoundary:'Raw public bid/ask contact only. Account fees, depth, transfer state, tax and durable edge remain separate gates.'};
 }
 function touchVenue(name,v,at){if(v.ok){state.pulse.venues[name].lastSuccessAt=at;state.pulse.venues[name].lastError=null;state.pulse.lastAnySuccessAt=at}else state.pulse.venues[name].lastError=v.error}
 async function pulseOnce(source='timer'){
   if(running)return;running=true;const t=Date.now(),out=[];
   try{
     for(const symbol of pulsePairs){try{const q=await fetchQuotes(symbol,'cloud-pulse:'+source);state.snapshots.push(q);state.snapshots=state.snapshots.slice(-20000);touchVenue('kraken',q.venues.kraken,q.fetchedAt);touchVenue('coinbase',q.venues.coinbase,q.fetchedAt);out.push(q)}catch(e){state.pulse.lastError=symbol+': '+String(e.message||e)}}
     state.pulse.lastRunAt=now();state.pulse.lastRunDurationMs=Date.now()-t;state.pulse.runCount++;persist();
     console.log(JSON.stringify({body:'JM MARKET ECOSYSTEM LAB cloud pulse',pass:out.some(x=>x.ok),source,pairs:out.map(x=>({symbol:x.symbol,kraken:x.venues.kraken.ok,coinbase:x.venues.coinbase.ok,bestRawBps:x.bestRawBps,receiveSkewMs:x.receiveSkewMs})),snapshotCount:state.snapshots.length,durationMs:state.pulse.lastRunDurationMs}));
   }finally{running=false}
 }
 function start(){if(!enabled||timer)return;if(!pulsePairs.length){state.pulse.lastError='no supported pulse pairs';return}setTimeout(()=>pulseOnce('startup'),1200).unref();timer=setInterval(()=>pulseOnce('timer'),intervalMs);timer.unref()}
 function stop(){if(timer){clearInterval(timer);timer=null}persist()}
 function status(){return{ok:true,schema:state.schema,enabled,intervalMs,pairs:pulsePairs,startedAt:state.startedAt,lastRunAt:state.pulse.lastRunAt,lastRunDurationMs:state.pulse.lastRunDurationMs,runCount:state.pulse.runCount,snapshotCount:state.snapshots.length,lastAnySuccessAt:state.pulse.lastAnySuccessAt,lastError:state.pulse.lastError,venues:state.pulse.venues,externalQuoteContact:state.pulse.lastAnySuccessAt?'earned-runtime-data-contact':'awaiting-runtime-data-contact',claimBoundary:'Quote contact is data-contact proof, not executable-size or profitable-edge proof.'}}
 async function handle(req,res,u){
   const p=u.pathname;if(!(p==='/market'||p.startsWith('/market/')))return false;
   try{
     if(req.method==='GET'&&(p==='/market'||p==='/market/'||p==='/market/v1')){send(res,200,fs.readFileSync(PAGE,'utf8'),'text/html; charset=utf-8');return true}
     if(req.method==='GET'&&p==='/market/v1/meta'){send(res,200,{ok:true,schema:'JM.MarketEcosystemLab.HostedProfile/0.2',body:'JM MARKET ECOSYSTEM LAB v1.2',keeper:'MARKETPLACE OF MARKETS · MISMATCHED CLOCKS',route:'SOURCE -> SIGNAL -> CONTACT FIELD -> ROUTE PRESSURE -> STATE CHANGE -> DING -> TRACE -> RECOVERY -> OUTPUT',cloudRoot:'JM CLOUD CONTACT SERVER v0.5.1-hosted',quoteRoute:'/market/v1/quotes?symbol=BTC/GBP',pulseRoute:'/market/v1/pulse',snapshotRoute:'/market/v1/snapshots',supportedPairs:Object.keys(PAIRS),capitalBoundary:'LAB DING != MONEY DING',storage:'bounded cloud quote snapshots + browser trace/local imported history'});return true}
     if(req.method==='GET'&&p==='/market/v1/ready'){const st=status();send(res,200,{ok:true,ready:fs.existsSync(PAGE),page:fs.existsSync(PAGE),supportedPairs:Object.keys(PAIRS).length,pulseEnabled:enabled,snapshotCount:state.snapshots.length,externalQuoteContact:st.externalQuoteContact});return true}
     if(req.method==='GET'&&p==='/market/v1/pulse'){send(res,200,status());return true}
     if(req.method==='GET'&&p==='/market/v1/snapshots'){const symbol=String(u.searchParams.get('symbol')||'').toUpperCase(),limit=clamp(+u.searchParams.get('limit')||500,1,5000);if(symbol&&!PAIRS[symbol]){send(res,400,{ok:false,error:'unsupported symbol',supportedPairs:Object.keys(PAIRS)});return true}const xs=(symbol?state.snapshots.filter(x=>x.symbol===symbol):state.snapshots).slice(-limit);send(res,200,{ok:true,count:xs.length,total:state.snapshots.length,snapshots:xs});return true}
     if(req.method==='GET'&&p==='/market/v1/quotes'){const symbol=String(u.searchParams.get('symbol')||'BTC/GBP').toUpperCase();if(!PAIRS[symbol]){send(res,400,{ok:false,error:'unsupported symbol',supportedPairs:Object.keys(PAIRS)});return true}const q=await fetchQuotes(symbol,'direct-request');send(res,q.ok?200:502,q);return true}
     send(res,404,{ok:false,error:'market route not found'});return true;
   }catch(e){send(res,400,{ok:false,error:String(e.message||e)});return true}
 }
 return{handle,start,stop,status,pulseOnce};
}
