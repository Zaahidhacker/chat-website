// Only the public application shell is cached. No conversations or API responses.
const CACHE='universe-shell-v1';
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/style.css','/app.js','/icon.svg']))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!['/','/style.css','/app.js','/icon.svg'].includes(u.pathname))return;e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));});
