// Only versioned PUBLIC application files enter the cache. Never cache auth or messages.
const CACHE='universe-__BUILD_VERSION__';
const SHELL=__SHELL_ASSETS__;
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('universe-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
// The account id gates notifications on shared devices. No auth token or message
// history is cached here. IndexedDB survives a terminated service worker.
function accountStore(mode,fn){return new Promise((resolve,reject)=>{
 const request=indexedDB.open('universe-notifications',1);
 request.onupgradeneeded=()=>request.result.createObjectStore('settings');
 request.onerror=()=>reject(request.error);
 request.onsuccess=()=>{const db=request.result,tx=db.transaction('settings',mode),store=tx.objectStore('settings');const result=fn(store);tx.oncomplete=()=>{resolve(result?.result);db.close()};tx.onerror=()=>{reject(tx.error);db.close()}};
})}
let callQueue=Promise.resolve();
function callEvent(task){const next=callQueue.then(task);callQueue=next.catch(()=>{});return next}
async function endedCall(callId,userId){
 if(!callId)return;
 const history=await accountStore('readonly',s=>s.get('closedCalls'))||[];
 await accountStore('readwrite',s=>s.put([...history.filter(c=>c.id!==callId||c.userId!==userId),{id:callId,userId}].slice(-20),'closedCalls'));
}
self.addEventListener('message',e=>{
 if(e.data?.type==='ACCOUNT')e.waitUntil(accountStore('readwrite',s=>s.put(e.data.userId||null,'account')).then(async()=>{
  if(!e.data.userId)for(const n of await self.registration.getNotifications())n.close();
 }));
 if(e.data?.type==='CLOSE_CALL')e.waitUntil(callEvent(async()=>{
  const userId=await accountStore('readonly',s=>s.get('account'));
  if(userId!==e.data.userId)return;
  await endedCall(e.data.callId,userId);
  for(const n of await self.registration.getNotifications())if(n.data?.callId&&(!e.data.callId||n.data.callId===e.data.callId))n.close();
 }));
});
self.addEventListener('push',e=>e.waitUntil((async()=>{
 let payload;try{payload=e.data?.json()}catch{return}
 if(!payload?.userId||(!payload?.messageId&&!payload?.callId))return;
 const userId=await accountStore('readonly',s=>s.get('account'));
 if(userId!==payload.userId)return;
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 if(payload.callId)return callEvent(async()=>{
  for(const w of windows)w.postMessage({type:'CALL_UPDATE',callId:payload.callId});
  if(payload.kind!=='invite'||!Number.isFinite(Date.parse(payload.expiresAt))||Date.parse(payload.expiresAt)<=Date.now()){
   await endedCall(payload.callId,userId);
   for(const n of await self.registration.getNotifications({tag:'universe-call-'+payload.callId}))n.close();return;
  }
  const history=await accountStore('readonly',s=>s.get('closedCalls'))||[];
  if(history.some(c=>c.id===payload.callId&&c.userId===userId))return;
  if(windows.some(w=>w.visibilityState==='visible'&&w.focused))return;
  await self.registration.showNotification('Incoming voice call',{
   body:'Open Our Little Universe to answer.',icon:'/icon-192.png',badge:'/icon-192.png',
   tag:'universe-call-'+payload.callId,silent:false,requireInteraction:true,
   timestamp:Date.now(),data:{url:'/',userId:payload.userId,callId:payload.callId,expiresAt:payload.expiresAt},
  });
 });
 if(windows.some(w=>w.visibilityState==='visible'&&w.focused))return;
 await self.registration.showNotification('Our Little Universe',{
  body:'You have a new message.',icon:'/icon-192.png',badge:'/icon-192.png',
  tag:'universe-'+payload.messageId,data:{url:'/',userId:payload.userId},
 });
})()));
self.addEventListener('notificationclick',e=>{
 e.notification.close();e.waitUntil((async()=>{
  const userId=await accountStore('readonly',s=>s.get('account'));
  if(userId!==e.notification.data?.userId)return;
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(w=>new URL(w.url).origin===self.location.origin);
  if(existing){await existing.focus();existing.postMessage({type:e.notification.data?.callId?'OPEN_CALL':'OPEN_CHAT',callId:e.notification.data?.callId});return}
  await self.clients.openWindow('/');
 })());
});
self.addEventListener('fetch',e=>{
 const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin)return;
 if(u.pathname.startsWith('/assets/')){
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(response=>{if(response.ok)caches.open(CACHE).then(c=>c.put(e.request,response.clone()));return response})));return;
 }
 if(u.pathname==='/'&&e.request.mode==='navigate'){
  e.respondWith(fetch(e.request).catch(()=>caches.match('/')));return;
 }
 if(u.pathname==='/icon.svg')e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request)));
});
