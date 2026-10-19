import {chromium} from 'playwright';
import assert from 'node:assert/strict';import http from 'node:http';import path from 'node:path';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {existsSync} from 'node:fs';
import {createFixture,users} from './transport-fixture.mjs';
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{let file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}try{const b=await readFile(file);res.writeHead(200,{'content-type':types[path.extname(file)]||'text/plain'});res.end(b)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
const results=[],errors=[];let contexts=[];
async function until(fn){for(let n=0;n<200;n++){if(await fn())return;await new Promise(r=>setTimeout(r,25))}throw Error('Timed out waiting for fixture')}
async function check(name,run){await run();results.push({name,status:'passed'});console.log('PASS '+name)}
async function context(options={}){const c=await browser.newContext({serviceWorkers:'block',...options});contexts.push(c);return c}
async function login(page){await page.goto(origin);await page.locator('#email').fill(users[0].email);await page.locator('#password').fill('test-password-only');await page.getByRole('button',{name:'Enter our universe',exact:true}).click();await page.locator('#message-input').waitFor()}
const c=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const fixture=createFixture(60);await fixture.install(c);const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
try{
 await mkdir('work',{recursive:true});await login(page);
 await check('mobile menu casts no screen-sized shadow when closed',async()=>{
  const closed=await page.locator('#sidebar').evaluate(el=>({shadow:getComputedStyle(el).boxShadow,visibility:getComputedStyle(el).visibility,pointer:getComputedStyle(el).pointerEvents}));assert.equal(closed.shadow,'none');assert.equal(closed.visibility,'hidden');assert.equal(closed.pointer,'none');
  await page.getByRole('button',{name:'Open navigation'}).click();assert.notEqual(await page.locator('#sidebar').evaluate(el=>getComputedStyle(el).boxShadow),'none');
  await page.getByRole('button',{name:'Close navigation'}).click();assert.equal(await page.locator('#sidebar').evaluate(el=>getComputedStyle(el).boxShadow),'none');
  await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('button',{name:'Our conversation',exact:true}).click();
 });
 await check('swipe right replies; vertical scrolling and cancellation do not',async()=>{
  const article=page.locator('[data-message]').last();
  async function gesture(dx,dy,cancel=false){await article.evaluate((el,{dx,dy,cancel})=>{const x=30,y=200;el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:17,pointerType:'touch',isPrimary:true,clientX:x,clientY:y})); // Synthetic pointer does not have native capture.
   el.setPointerCapture=()=>{};el.hasPointerCapture=()=>true;
   el.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:17,pointerType:'touch',isPrimary:true,clientX:x+dx,clientY:y+dy}));el.dispatchEvent(new PointerEvent(cancel?'pointercancel':'pointerup',{bubbles:true,pointerId:17,pointerType:'touch',isPrimary:true,clientX:x+dx,clientY:y+dy}));},{dx,dy,cancel})}
  await gesture(4,100);assert.equal(await page.locator('.reply-bar').count(),0);await gesture(90,2,true);assert.equal(await page.locator('.reply-bar').count(),0);
  await gesture(90,2);await page.locator('.reply-bar').waitFor();const id=await article.getAttribute('data-message');await page.locator('#message-input').fill('A reply from a swipe');await page.getByRole('button',{name:'Send message',exact:true}).click();await until(()=>fixture.messages.some(m=>m.body==='A reply from a swipe'));const sent=fixture.messages.find(m=>m.body==='A reply from a swipe');assert.equal(sent.reply_to,id);await page.locator(`[data-message="${sent.id}"] .quote`).waitFor();assert((await page.locator(`[data-message="${sent.id}"] .quote`).textContent()).includes('Earlier little moment 60'));
 });
 await check('actual touch drag triggers reply without a synthetic pointer event',async()=>{
  await page.evaluate(()=>{window.gestureTrace=[];for(const name of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])document.addEventListener(name,e=>window.gestureTrace.push({type:e.type,x:e.clientX,y:e.clientY,target:e.target.className,primary:e.isPrimary}),true)});const target=page.locator('[data-message]').last();await target.scrollIntoViewIfNeeded();const b=await target.locator('.bubble').boundingBox();const session=await c.newCDPSession(page);const x=Math.max(24,b.x+10),y=b.y+b.height/2;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let n=1;n<=6;n++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+n*12,y}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.locator('.reply-bar').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
 });
 await check('reply preview loads an original message outside the current history page',async()=>{
  const original=fixture.messages[0];fixture.add(users[1].id,'Reply to our first moment',undefined,original.id);await page.reload();await page.getByText('Reply to our first moment',{exact:false}).waitFor();const latest=fixture.messages.at(-1);await page.locator(`[data-message="${latest.id}"] .quote`).getByText(original.body,{exact:false}).waitFor();assert.equal(await page.locator(`[data-message="${original.id}"]`).count(),0);fixture.hidden.get(users[0].id).add(original.id);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.locator(`[data-message="${latest.id}"] .quote`).getByText('Earlier message',{exact:false}).waitFor();
 });
 await check('session survives closing the browser context and opening a new one',async()=>{
  const saved=await c.storageState();await c.close();const next=await context({storageState:saved,viewport:{width:390,height:844}});await fixture.install(next);const p=await next.newPage();const before=fixture.requests.filter(r=>r.path==='/auth/v1/token').length;await p.goto(origin);await p.locator('#message-input').waitFor();assert.equal(fixture.requests.filter(r=>r.path==='/auth/v1/token').length,before);await next.close();
  const expired=structuredClone(saved);const item=expired.origins[0].localStorage.find(x=>x.name.endsWith('-auth-token'));const session=JSON.parse(item.value);session.expires_at=Math.floor(Date.now()/1000)-60;item.value=JSON.stringify(session);
  const refresh=await context({storageState:expired});await fixture.install(refresh);const q=await refresh.newPage();await q.goto(origin);await q.locator('#message-input').waitFor();assert(fixture.requests.filter(r=>r.path==='/auth/v1/token').length>before);await refresh.close();
 });
 await check('failed restore keeps the session and reconnects without a password',async()=>{
  // Get a fresh persisted session, then make the initial conversation read unreachable.
  const t=await context();await fixture.install(t);const p=await t.newPage();await login(p);const saved=await t.storageState();await t.close();
  const fail=await context({storageState:saved});await fixture.install(fail);let blocked=true;await fail.route('**/rest/v1/rpc/universe_sync_state',async route=>blocked?route.abort('failed'):route.fallback());const q=await fail.newPage();await q.goto(origin);await q.getByRole('heading',{name:'A moment to reconnect.'}).waitFor();assert(await q.evaluate(()=>!!localStorage.getItem('sb-jczsnrzqocstbpsgwkdy-auth-token')));blocked=false;await q.getByRole('button',{name:'Try again',exact:false}).click();await q.locator('#message-input').waitFor();await fail.close();
 });
 await check('phone/tablet/desktop layouts, keyboard height and themes do not overflow',async()=>{
  const t=await context();const p=await t.newPage();await p.goto(origin);await p.getByRole('button',{name:'Take a peek',exact:false}).click();
  for(const [width,height]of [[320,640],[360,780],[390,844],[768,1024],[1440,900]]){await p.setViewportSize({width,height});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:`work/design-${width}-dark.png`});
   const switcher=p.getByRole('button',{name:'Change appearance',exact:true});if(await switcher.isVisible())await switcher.click();else{await p.getByRole('button',{name:'Conversation options'}).click();await p.getByRole('button',{name:'Appearance & privacy'}).click();await p.getByRole('button',{name:'Soft Love',exact:false}).click();await p.getByRole('button',{name:'Open navigation'}).click();await p.getByRole('button',{name:'Our conversation',exact:true}).click()}
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await p.screenshot({path:`work/design-${width}-light.png`});if(await switcher.isVisible())await switcher.click();else{await p.getByRole('button',{name:'Conversation options'}).click();await p.getByRole('button',{name:'Appearance & privacy'}).click();await p.getByRole('button',{name:'Midnight Romance',exact:false}).click();await p.getByRole('button',{name:'Open navigation'}).click();await p.getByRole('button',{name:'Our conversation',exact:true}).click()}
  }
  await p.setViewportSize({width:390,height:420});await p.locator('#message-input').focus();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const box=await p.locator('#composer').boundingBox();assert(box.y>=0&&box.y+box.height<=420);await p.screenshot({path:'work/design-keyboard.png'});await t.close();
 });
 await check('reduced motion disables decorative and gesture transitions',async()=>{const t=await context({reducedMotion:'reduce'});const p=await t.newPage();await p.goto(origin);await p.getByRole('button',{name:'Take a peek',exact:false}).click();assert.equal(await p.locator('.message-main').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');await t.close()});
 await check('real service worker gates private push by account and uses generic text',async()=>{
  const t=await context({serviceWorkers:'allow',permissions:['notifications']});const p=await t.newPage();await p.goto(origin);await p.evaluate(()=>navigator.serviceWorker.ready);const worker=t.serviceWorkers()[0];assert(worker);
  const out=await worker.evaluate(async()=>{
   const notifications=[];self.registration.showNotification=async(title,options)=>notifications.push({title,...options});self.clients.matchAll=async()=>[];
   async function dispatch(type,props){const pending=[],event=new Event(type);for(const[k,v]of Object.entries({...props,waitUntil:p=>pending.push(p)}))Object.defineProperty(event,k,{value:v});self.dispatchEvent(event);await Promise.all(pending)}
   await dispatch('message',{data:{type:'ACCOUNT',userId:'recipient'}});
   await dispatch('push',{data:{json:()=>({userId:'sender',messageId:'wrong-account'})}});
   await dispatch('push',{data:{json:()=>({userId:'recipient',messageId:'hello'})}});
   await dispatch('message',{data:{type:'ACCOUNT',userId:null}});
   await dispatch('push',{data:{json:()=>({userId:'recipient',messageId:'after-logout'})}});
   return notifications;
  });assert.equal(out.length,1);assert.equal(out[0].body,'You have a new message.');assert.equal(out[0].tag,'universe-hello');await t.close();
 });
 assert.deepEqual(errors,[]);await writeFile('work/upgrade-report.json',JSON.stringify({kind:'browser and real service-worker handlers; push provider and physical devices not simulated as live delivery',results,errors},null,2));
}catch(error){if(!page.isClosed()){console.log('Gesture trace',await page.evaluate(()=>window.gestureTrace));console.log('Quotes',await page.locator('.quote').allTextContents());console.log('Recent requests',fixture.requests.slice(-12));await page.screenshot({path:'work/upgrade-failure.png'})}throw error}finally{for(const x of contexts)await x.close().catch(()=>{});await browser.close();server.close()}
