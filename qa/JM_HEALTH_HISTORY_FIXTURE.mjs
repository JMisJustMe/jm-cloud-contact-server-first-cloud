// Deterministic synthetic upstream for local responsiveness QA only.
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=new URL(String(input));
 if(url.hostname!=='fred.stlouisfed.org')return realFetch(input,options);
 const name=url.searchParams.get('id');
 const j=['DGS10','DFF','DTWEXBGS','DCOILWTICO','VIXCLS','SP500','DEXUSUK'].indexOf(name);
 const rows=Array.from({length:1250},(_,i)=>new Date(Date.UTC(2020,0,1)+i*86400000).toISOString().slice(0,10)+','+(100+Math.sin(i*.13+j)*8+i*.01));
 return new Response('observation_date,'+name+'\n'+rows.join('\n'),{status:200});
};
