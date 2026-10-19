// Coalesce scroll bursts and send no unchanged receipts between presence heartbeats.
export function createReceiptScheduler(send,{now=Date.now,delay=250,setTimer=setTimeout,clearTimer=clearTimeout}={}) {
 let delivered=0,read=0,sentDelivered=0,sentRead=0,lastSent=-Infinity,timer=null,inFlight=false,closed=false;
 async function flush(){timer=null;if(closed||inFlight)return;
  const d=delivered,r=Math.min(read,d),at=now();
  if(d<=sentDelivered&&r<=sentRead&&at-lastSent<30000)return;
  inFlight=true;
  try{await send({delivered:d,seen:r});sentDelivered=Math.max(sentDelivered,d);sentRead=Math.max(sentRead,r);lastSent=at;}catch{/* Keep pending state for the next attempt. */}finally{inFlight=false;}
  if(!closed&&(delivered>d||read>r))request(delivered,read);
 }
 function request(d,r){if(closed)return;delivered=Math.max(delivered,d);read=Math.max(read,r);if(timer===null)timer=setTimer(flush,delay);}
 return {request,flush,close(){closed=true;if(timer!==null)clearTimer(timer);timer=null;}};
}
export function debounce(fn,wait=180){let timer;const run=(...args)=>{clearTimeout(timer);timer=setTimeout(()=>fn(...args),wait)};run.cancel=()=>clearTimeout(timer);return run}
