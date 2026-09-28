export const QUICK_FLIP_INTEROP_CURRENT=Object.freeze({
 schema:'JM.QuickFlipInterop/1.0',
 body:'JM Quick Flip v1.21',
 carrier:'CURRENT',
 purpose:'Stable bidirectional contract so Quick Flip proof work is reused instead of rebuilt.',
 routeSpine:['SOURCE','SIGNAL','CONTACT FIELD','ROUTE PRESSURE','STATE CHANGE','DING','TRACE','RECOVERY','OUTPUT'],
 upstream:[
  {body:'JM Market Ecosystem Lab',route:'/market',relation:'research/context/backing market body'},
  {body:'JM Cloud Contact Server v0.5.1-hosted',route:'/ready',relation:'host/runtime/contact carrier'},
  {body:'JM Coding Estate manifest',route:'/market/v1/quick-flip/manifest',relation:'mounted logic/route/contact/trace bodies'}
 ],
 downstream:[
  {contract:'current state',route:'/market/v1/pulse'},
  {contract:'survival state',route:'/market/v1/quick-flip/cloud-survivors'},
  {contract:'state changes',route:'/market/v1/quick-flip/transitions'},
  {contract:'proof queue',route:'/market/v1/quick-flip/proof-queue'},
  {contract:'proof execution',route:'/market/v1/quick-flip/proof-queue/run'},
  {contract:'proof ledger',route:'/market/v1/quick-flip/proof-ledger'},
  {contract:'completion state',route:'/market/v1/quick-flip/completion'}
 ],
 fieldCoverage:[
  {no:8,name:'Commodity futures',clock:'minutes → days',status:'PRESERVED_NOT_MOUNTED',reason:'Futures require contract-specific expiry/month, multiplier, session/margin and futures-data handling; the current live body is a cross-venue spot-crypto implementation.'}
 ],
 laws:['NO DING, NO CLAIM','RECOVER BEFORE REBUILD','CURRENT BODY HERE; LINEAGE IN GIT'],
 claimBoundary:'Interop shares route/state/proof contracts. It does not imply identical market mechanics across asset classes or grant trading/execution authority.'
});
