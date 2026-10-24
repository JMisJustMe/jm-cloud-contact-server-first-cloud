try{
 const r=await fetch('http://127.0.0.1:8791/ready',{signal:AbortSignal.timeout(3000)});const j=await r.json();
 if(r.ok&&j.ok===true&&j.ready===true&&j.contactDurable===true&&j.contactRevision>=1&&j.receiptSigning===true)process.exit(0);
 console.error('JM_OWNER_CLOUD_NOT_READY');process.exit(1);
}catch{process.exit(1)}
