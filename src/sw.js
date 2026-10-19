// Only versioned PUBLIC application files enter the cache. Never cache auth or messages.
const CACHE='universe-__BUILD_VERSION__';
const SHELL=__SHELL_ASSETS__;
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('universe-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
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
