// Private Presence is connection state, never an authorization or identity decision.
// Foreground membership drives Online; observed departures drive last seen.
export function createPresence(db,{userId,member,onChange}){
 let subscribed=false,closed=false,desired=false,tracked=false,busy=false,known=false,revision=0,retries=0,retryTimer,active=new Set();
 const departures=new Map();
 const room=db.channel('universe-presence:two',{config:{private:true,presence:{key:userId}}});
 const available=()=>!closed&&!document.hidden&&navigator.onLine&&!!member()?.share_presence;
 function leaveStamp(){Promise.resolve(db.rpc('universe_presence_leave')).catch(()=>{})}
 async function drain(){
  if(busy||!subscribed||closed)return;busy=true;const generation=revision;
  try{while(!closed&&subscribed&&tracked!==desired){
   const next=desired,result=await (next?room.track({active:true}):room.untrack());
   if(generation!==revision)break;
   if(result!=='ok')throw Error('Presence update interrupted');
   tracked=next;retries=0;
  }}catch{if(generation===revision){tracked=null;if(!closed&&subscribed&&!document.hidden&&navigator.onLine&&retries<2){clearTimeout(retryTimer);retryTimer=setTimeout(drain,1000*++retries)}}}
  finally{busy=false;if(generation!==revision&&!closed&&subscribed)queueMicrotask(drain)}
 }
 function reconcile(){const next=available();if(desired!==next){clearTimeout(retryTimer);retries=0;if(desired&&!next)leaveStamp()}desired=next;drain()}

 function sync(){const next=new Set(Object.entries(room.presenceState()).filter(([,list])=>list.some(p=>p.active===true)).map(([id])=>id));for(const id of active)if(!next.has(id))departures.set(id,Date.now());for(const id of next)departures.delete(id);active=next;known=true;onChange()}
 room.on('presence',{event:'sync'},sync).subscribe(status=>{if(closed)return;revision++;tracked=false;retries=0;clearTimeout(retryTimer);subscribed=status==='SUBSCRIBED';if(!subscribed){known=false;active=new Set();onChange()}else{reconcile();onChange()}});
 const visibility=()=>reconcile(),online=()=>reconcile();
 const pagehide=()=>{if(desired)leaveStamp();desired=false;if(subscribed)room.untrack().catch(()=>{})};
 document.addEventListener('visibilitychange',visibility);window.addEventListener('online',online);window.addEventListener('offline',online);window.addEventListener('pagehide',pagehide);
 return {reconcile,online(id){return !closed&&subscribed&&known&&active.has(id)},departedAt(id){return !closed&&subscribed&&known?departures.get(id):undefined},close(){if(closed)return;if(desired)leaveStamp();closed=true;revision++;clearTimeout(retryTimer);desired=false;document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',online);window.removeEventListener('offline',online);window.removeEventListener('pagehide',pagehide);db.removeChannel(room);onChange()}};
}
