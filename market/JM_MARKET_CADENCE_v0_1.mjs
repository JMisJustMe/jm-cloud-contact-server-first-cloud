const DAY=86400000;
export function cadenceProfile(rows){
 const ts=[...(rows||[])].map(x=>+x.timestamp).filter(Number.isFinite).sort((a,b)=>a-b);
 const ds=[];for(let i=1;i<ts.length;i++){const d=ts[i]-ts[i-1];if(d>0)ds.push(d)}
 if(!ds.length)return{count:ts.length,intervalCount:0,medianMs:null,medianDays:null,band:'UNRESOLVED'};
 const b=[...ds].sort((a,b)=>a-b),m=Math.floor(b.length/2),medianMs=b.length%2?b[m]:(b[m-1]+b[m])/2,days=medianMs/DAY;
 let band='IRREGULAR';if(days<=1.5)band='DAILY';else if(days<=9)band='WEEKLY';else if(days<=45)band='MONTHLY';else if(days<=120)band='QUARTERLY';else if(days<=240)band='SEMIANNUAL';else band='ANNUAL_OR_SLOWER';
 return{count:ts.length,intervalCount:ds.length,medianMs,medianDays:days,band,minDays:Math.min(...ds)/DAY,maxDays:Math.max(...ds)/DAY};
}
