import fs from 'node:fs';
import path from 'node:path';

const PAGE=path.resolve('./market/JM_MARKET_ECOSYSTEM_LAB_v1_1_HOSTED.html');
const PAIRS={
  'BTC/GBP':{kraken:'XBTGBP',coinbase:'BTC-GBP'},
  'ETH/GBP':{kraken:'ETHGBP',coinbase:'ETH-GBP'},
  'BTC/USD':{kraken:'XBTUSD',coinbase:'BTC-USD'},
  'ETH/USD':{kraken:'ETHUSD',coinbase:'ETH-USD'}
};
const now=()=>new Date().toISOString();
const timed=async(fn)=>{
  const t=Date.now();
  try{return{ok:true,value:await fn(),durationMs:Date.now()-t}}
  catch(e){return{ok:false,error:String(e.message||e),durationMs:Date.now()-t}}
};
const getJson=async url=>{
  const r=await fetch(url,{headers:{accept:'application/json','user-agent':'JM-Market-Ecosystem-Lab/1.1'},signal:AbortSignal.timeout(6000)});
  const text=await r.text(); let j;
  try{j=JSON.parse(text)}catch{throw Error('non-JSON response')};
  if(!r.ok)throw Error('HTTP '+r.status+' '+JSON.stringify(j).slice(0,300));
  return j;
};
const quoteKraken=async pair=>{
  const j=await getJson('https://api.kraken.com/0/public/Ticker?pair='+encodeURIComponent(pair));
  if(j.error?.length)throw Error(j.error.join('; '));
  const row=Object.values(j.result||{})[0];
  if(!row?.a?.[0]||!row?.b?.[0])throw Error('ticker missing bid/ask');
  return{bid:+row.b[0],ask:+row.a[0],last:+(row.c?.[0]||NaN),source:'Kraken public ticker'};
};
const quoteCoinbase=async product=>{
  const j=await getJson('https://api.exchange.coinbase.com/products/'+encodeURIComponent(product)+'/ticker');
  if(!j.bid||!j.ask)throw Error('ticker missing bid/ask');
  return{bid:+j.bid,ask:+j.ask,last:+(j.price||NaN),sourceAt:j.time||null,source:'Coinbase Exchange public ticker'};
};
const headers=(type='application/json; charset=utf-8')=>({
  'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()',
  ...(type.startsWith('text/html')?{'content-security-policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'self'; form-action 'none'"}:{})
});
const send=(res,status,obj,type='application/json; charset=utf-8')=>{
  const raw=type.startsWith('application/json')?JSON.stringify(obj):String(obj);
  res.writeHead(status,{...headers(type),'content-length':Buffer.byteLength(raw)});res.end(raw);
};
export function createMarketLabProfile(){
  async function handle(req,res,u){
    const p=u.pathname;
    if(!(p==='/market'||p.startsWith('/market/')))return false;
    try{
      if(req.method==='GET'&&(p==='/market'||p==='/market/'||p==='/market/v1')){
        const page=fs.readFileSync(PAGE,'utf8');send(res,200,page,'text/html; charset=utf-8');return true;
      }
      if(req.method==='GET'&&p==='/market/v1/meta'){
        send(res,200,{ok:true,schema:'JM.MarketEcosystemLab.HostedProfile/0.1',body:'JM MARKET ECOSYSTEM LAB v1.1',keeper:'MARKETPLACE OF MARKETS · MISMATCHED CLOCKS',route:'SOURCE -> SIGNAL -> CONTACT FIELD -> ROUTE PRESSURE -> STATE CHANGE -> DING -> TRACE -> RECOVERY -> OUTPUT',cloudRoot:'JM CLOUD CONTACT SERVER v0.5.1-hosted',quoteRoute:'/market/v1/quotes?symbol=BTC/GBP',supportedPairs:Object.keys(PAIRS),capitalBoundary:'LAB DING != MONEY DING',storage:'browser trace/local import; server quote relay only'});return true;
      }
      if(req.method==='GET'&&p==='/market/v1/ready'){
        send(res,200,{ok:true,ready:fs.existsSync(PAGE),page:fs.existsSync(PAGE),supportedPairs:Object.keys(PAIRS).length,externalQuoteContact:'runtime-gated'});return true;
      }
      if(req.method==='GET'&&p==='/market/v1/quotes'){
        const symbol=String(u.searchParams.get('symbol')||'BTC/GBP').toUpperCase(),map=PAIRS[symbol];
        if(!map){send(res,400,{ok:false,error:'unsupported symbol',supportedPairs:Object.keys(PAIRS)});return true}
        const fetchedAt=now();
        const [ka,co]=await Promise.all([timed(()=>quoteKraken(map.kraken)),timed(()=>quoteCoinbase(map.coinbase))]);
        const venue=x=>x.ok?{ok:true,...x.value,durationMs:x.durationMs}:{ok:false,error:x.error,durationMs:x.durationMs};
        const venues={kraken:venue(ka),coinbase:venue(co)},ok=ka.ok||co.ok;
        send(res,ok?200:502,{ok,symbol,fetchedAt,venues,claimBoundary:'Public quotes prove data contact only. Executable size, account-specific fees, transfer state, tax and durable edge remain separate gates.'});return true;
      }
      send(res,404,{ok:false,error:'market route not found'});return true;
    }catch(e){send(res,400,{ok:false,error:String(e.message||e)});return true}
  }
  return{handle};
}
