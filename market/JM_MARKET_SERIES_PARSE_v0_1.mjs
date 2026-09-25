export function parseNumericObservation(value){
 const s=String(value??'').trim().replace(/,/g,'');
 if(!s)return NaN;
 const u=s.toUpperCase();
 if(u==='.'||u==='..'||u==='NA'||u==='N/A'||u==='NULL'||u==='NAN')return NaN;
 const n=Number(s);
 return Number.isFinite(n)?n:NaN;
}
