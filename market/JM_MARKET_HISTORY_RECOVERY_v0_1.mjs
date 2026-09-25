export function splitDateRange(from,to){
 const a=Date.parse(String(from)+'T00:00:00Z'),b=Date.parse(String(to)+'T00:00:00Z');
 if(!Number.isFinite(a)||!Number.isFinite(b)||a>b)throw Error('invalid date range');
 if(a===b)return[{from:String(from),to:String(to)}];
 const day=86400000,mid=Math.floor(((a+b)/2)/day)*day,next=mid+day;
 const iso=x=>new Date(x).toISOString().slice(0,10);
 return next>b?[{from:iso(a),to:iso(b)}]:[{from:iso(a),to:iso(mid)},{from:iso(next),to:iso(b)}];
}

export function mergeHistoricalRows(...parts){
 const byTs=new Map();
 for(const rows of parts)for(const x of rows||[])if(Number.isFinite(+x.timestamp)&&Number.isFinite(+x.value))byTs.set(+x.timestamp,{...x,timestamp:+x.timestamp,value:+x.value});
 return [...byTs.values()].sort((a,b)=>a.timestamp-b.timestamp);
}
