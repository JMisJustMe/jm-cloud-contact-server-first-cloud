import {createEstate,BUILD_ID,VERSION} from './vendor/JM_CODING_ESTATE_REAL_BUILD_v1_0.mjs';

const LOGIC_SOURCE=`logic QuickFlipLogic {
  rule SizedPositive priority 30 { when Candidate.netBps > 0 and Candidate.fits == true then "QUICK_FLIP_PAPER_CANDIDATE" }
  rule CapacityHold priority 20 { when Candidate.fits == false then "HOLD_CAPACITY" }
  rule FrictionHold priority 10 { when Candidate.netBps <= 0 then "HOLD_FRICTION" }
}`;

const ROUTE_SOURCE=`route QuickFlipRoute {
  on scan(netBps: number, fits: bool) {
    trace netBps
    if netBps > 0 and fits == true { ding "positive-sized-route" }
    if fits == false { hold }
  }
}`;

const CONTACT_SOURCE=`contact VenueContact {
  when Kraken crosses Coinbase { ding "venue-cross-contact"; emit "cross-venue-contact" }
}`;

export function createQuickFlipEstate(){
  const host=createEstate();
  host.mountSource('JMLogic',LOGIC_SOURCE);
  host.mountSource('Route-Code',ROUTE_SOURCE);
  host.mountSource('ContactCode',CONTACT_SOURCE);
  return host;
}

export function quickFlipEstateManifest(){
  const host=createQuickFlipEstate(),manifest=host.manifest();
  return{build:BUILD_ID,version:VERSION,bodyCount:manifest.bodyCount,mounted:[...host.runtimes.keys()],bodies:manifest.bodies.filter(x=>['jmlogic','route-code','contactcode'].includes(x.id)).map(x=>({id:x.id,name:x.name,kind:x.kind,capabilities:x.capabilities}))};
}

export function evaluateQuickFlip(candidate={}){
  const host=createQuickFlipEstate(),C={
    netBps:Number(candidate.netBps)||0,
    rawBps:Number(candidate.rawBps)||0,
    fits:Boolean(candidate.fits),
    capacity:Number(candidate.capacity)||0,
    notional:Number(candidate.notional)||0,
    route:String(candidate.route||''),
    symbol:String(candidate.symbol||'')
  };
  const contactRuntime=host.runtimes.get('contactcode');
  const routeRuntime=host.runtimes.get('route-code');
  const logicRuntime=host.runtimes.get('jmlogic');
  const contact=contactRuntime.contact('Kraken','Coinbase',{Candidate:C},'crosses');
  const routeState=routeRuntime.dispatch('QuickFlipRoute','scan',[C.netBps,C.fits],{Candidate:C});
  const logicActions=logicRuntime.evaluate({Candidate:C});
  const verdict=logicActions.includes('QUICK_FLIP_PAPER_CANDIDATE')?'PAPER_CANDIDATE':logicActions.includes('HOLD_CAPACITY')?'HOLD_CAPACITY':'HOLD_FRICTION';
  return{
    ok:true,schema:'JM.QuickFlipEstateDecision/0.1',verdict,candidate:C,logicActions,contact,routeState,
    codingEstate:{build:BUILD_ID,version:VERSION,bodyCount:host.manifest().bodyCount,mounted:[...host.runtimes.keys()]},
    bodyReceipts:{jmlogic:logicRuntime.receipt(),routeCode:routeRuntime.receipt(),contactCode:contactRuntime.receipt()},
    hostReceipt:host.receipt(),
    capitalBoundary:'PAPER CANDIDATE ONLY · NO MONEY DING'
  };
}
