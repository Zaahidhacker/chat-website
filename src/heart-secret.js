import {createSecretGate} from './heart-secret-policy.js';
let storage;try{storage=sessionStorage}catch{}
const gate=createSecretGate({storage});let generation=0,dispose;
export function closeSecret(){generation++;dispose?.();dispose=null}
export function secretMessage(message,user){
 const event=gate.accept(message,user);if(!event)return;
 closeSecret();const ticket=generation;
 if(document.hidden)return;
 import('./heart-secret-scene.js').then(async scene=>{
  if(ticket!==generation)return;
  const cleanup=await scene.showSecret({...event,current:()=>ticket===generation&&!document.hidden,onFinish:()=>{if(ticket===generation)dispose=null}});
  if(ticket===generation)dispose=cleanup;else cleanup?.();
 }).catch(()=>{});
}
