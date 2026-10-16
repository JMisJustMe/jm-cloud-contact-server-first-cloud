import {parentPort} from 'node:worker_threads';
import {quantifyClock} from './JM_MARKET_CLOCK_ENGINE_v0_3.mjs';
import {stressClockPair} from './JM_MARKET_CLOCK_STRESS_v0_1.mjs';
import {nullField} from './JM_MARKET_NULL_FIELD_v0_1.mjs';
import {lagRarity} from './JM_MARKET_LAG_RARITY_v0_1.mjs';
import {confirmFrozenLag} from './JM_MARKET_FROZEN_LAG_CONFIRM_v0_1.mjs';
const operations={quantifyClock,stressClockPair,nullField,lagRarity,confirmFrozenLag};
parentPort.on('message',({operation,args})=>{
 try {
  if(!Object.hasOwn(operations,operation))throw Error('unknown market analysis');
  parentPort.postMessage({ok:true,result:operations[operation](...args)});
 } catch(e) {parentPort.postMessage({ok:false,error:String(e.message||e)});}
});
