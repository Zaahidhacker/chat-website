import {chromium} from 'playwright';
import assert from 'node:assert/strict';import http from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';import {performance} from 'node:perf_hooks';import {existsSync} from 'node:fs';import {gzipSync} from 'node:zlib';
import {createFixture,users} from './transport-fixture.mjs';
const root=path.resolve('dist');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p==='/')p='/index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}try{const b=await readFile(file);const zipped=(req.headers['accept-encoding']||'').includes('gzip')&&/\.(js|css|html)$/.test(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain',...(zipped?{'Content-Encoding':'gzip'}:{})});res.end(zipped?gzipSync(b):b)}catch{res.writeHead(404);res.end('Not found')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
const errors=[],results=[],latencies=[];const fixture=createFixture();
const desktop=await browser.newContext({viewport:{width:1366,height:900},serviceWorkers:'block'});const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
await fixture.install(desktop);await fixture.install(phone);
const zaahid=await desktop.newPage(),layaana=await phone.newPage();zaahid.setDefaultTimeout(10000);layaana.setDefaultTimeout(10000);
for(const p of [zaahid,layaana])p.on('pageerror',e=>errors.push(e.message));
async function until(fn,timeout=10000){const started=Date.now();while(!await fn()){if(Date.now()-started>timeout)throw Error('Timed out waiting for assertion');await new Promise(r=>setTimeout(r,40))}}
async function check(name,fn){const at=performance.now();await fn();results.push({name,status:'passed',ms:Math.round(performance.now()-at)});console.log('PASS '+name)}
async function login(page,user){await page.goto(origin);await page.locator('#email').fill(user.email);await page.locator('#password').fill('test-password-only');await page.getByRole('button',{name:'Enter our universe',exact:true}).click();await page.locator('#message-input').waitFor();}
async function send(page,text){await page.locator('#message-input').fill(text);await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByText(text,{exact:true}).waitFor()}
try{
 await mkdir('work',{recursive:true});
 await check('public login does not download the messaging SDK',async()=>{
  const assets=[];zaahid.on('request',r=>{if(r.url().includes('/assets/'))assets.push(r.url())});await zaahid.goto(origin);await zaahid.getByRole('heading',{name:'Back to our little world.'}).waitFor();assert.equal(assets.filter(u=>u.endsWith('.js')).length,2);assert.equal(fixture.requests.length,0);
 });
 const cdp=await phone.newCDPSession(layaana);await cdp.send('Emulation.setCPUThrottlingRate',{rate:6});
 await check('two isolated sessions restore the correct partner and initial history',async()=>{await Promise.all([login(zaahid,users[0]),login(layaana,users[1])]);assert.equal(await zaahid.locator('#partner-name').textContent(),'Layaana');assert.equal(await layaana.locator('#partner-name').textContent(),'Zaahid');await until(()=>fixture.members.every(m=>m.last_read>=350))});
 await check('a new message bounces on the live timeline, stays painted, and keeps its bubble through acknowledgement',async()=>{
  const message='Zaahid → Layaana: hello ♡';
  for(const page of [zaahid,layaana])await page.evaluate(()=>{
   localStorage.setItem('universe-motion','full');
   document.documentElement.removeAttribute('data-motion');
   const animate=Element.prototype.animate;
   window.messageEntrances=[];
   window.restoreMessageAnimation=()=>{Element.prototype.animate=animate};
   Element.prototype.animate=function(frames,options){
    const animation=animate.call(this,frames,options);
    if(this.matches('.message-main'))window.messageEntrances.push({
     text:this.querySelector('.bubble').textContent,
     connected:this.isConnected,
     liveTimeline:animation.timeline===document.timeline,
     transforms:animation.effect.getKeyframes().map(frame=>frame.transform)
    });
    return animation;
   };
  });
  let release;
  const hold=new Promise(resolve=>{release=resolve});
  const sendRoute='**/rest/v1/rpc/universe_send';
  await zaahid.route(sendRoute,async route=>{await hold;await route.fallback()});
  const response=zaahid.waitForResponse(sendRoute).catch(()=>{});
  try{
   const at=performance.now();
   await send(zaahid,message);
   const pending=zaahid.locator('.message.pending').filter({hasText:message});
   const bubble=await pending.locator('.bubble').elementHandle();
   assert(await bubble.evaluate(el=>Number(getComputedStyle(el.parentElement).opacity)>0),'Optimistic text must be painted during its bounce');
   release();
   const received=layaana.getByText(message,{exact:true});
   await received.waitFor();
   latencies.push({direction:'desktop-to-phone',fixtureRoundTripMs:Math.round(performance.now()-at)});
   await pending.waitFor({state:'detached'});
   assert(await bubble.evaluate(el=>el.isConnected),'Delivery must retain the animated bubble');
   assert.equal(await received.count(),1);
   for(const page of [zaahid,layaana]){
    const entries=await page.evaluate(text=>window.messageEntrances.filter(entry=>entry.text===text),message);
    assert.equal(entries.length,1);
    assert.equal(entries[0].connected,true);
    assert.equal(entries[0].liveTimeline,true);
    assert(entries[0].transforms.some(transform=>transform.includes('translateY(-3px)')),'The entrance must overshoot before settling');
    await page.waitForFunction(text=>[...document.querySelectorAll('.bubble')].some(el=>el.textContent===text&&getComputedStyle(el.parentElement).opacity==='1'&&!el.parentElement.getAnimations().length),message);
   }
  }finally{
   release();await response;await zaahid.unroute(sendRoute);
   for(const page of [zaahid,layaana])await page.evaluate(()=>window.restoreMessageAnimation());
  }
 });
 const first=fixture.messages.find(m=>m.body==='Zaahid → Layaana: hello ♡');
 await check('Layaana sends → Zaahid receives and read receipts update',async()=>{const at=performance.now();await send(layaana,'Layaana → Zaahid: right here ✨');await zaahid.getByText('Layaana → Zaahid: right here ✨',{exact:true}).waitFor();latencies.push({direction:'phone-to-desktop',fixtureRoundTripMs:Math.round(performance.now()-at)});await until(()=>fixture.members.every(m=>m.last_read>=352));await zaahid.locator(`[data-receipt="${first.id}"][data-status="Read"]`).waitFor()});
 await check('saving and editing remain synchronized',async()=>{let article=zaahid.locator(`[data-message="${first.id}"]`);await article.getByRole('button',{name:'Message actions'}).click();await zaahid.getByRole('dialog').getByRole('button',{name:/Save to keepsakes/}).click();await article.getByRole('button',{name:'Message actions'}).click();await zaahid.getByRole('button',{name:'Edit my message',exact:true}).click();await zaahid.locator('#message-input').fill('A little hello, edited with love');await zaahid.getByRole('button',{name:'Send message',exact:true}).click();await layaana.getByText('A little hello, edited with love',{exact:true}).waitFor()});
 await check('reaction arrives without refetching message history',async()=>{const before=fixture.requests.filter(r=>r.path.endsWith('/universe_messages')).length;await layaana.locator(`[data-message="${first.id}"]`).getByRole('button',{name:'Message actions'}).click();await layaana.getByRole('button',{name:'React ❤️',exact:true}).click();await zaahid.locator(`[data-message="${first.id}"] .reaction`).waitFor();assert.equal(fixture.requests.filter(r=>r.path.endsWith('/universe_messages')).length,before)});
 await check('lost acknowledgement and manual retry create no duplicate',async()=>{fixture.pause(users[0].id);fixture.loseNextAcknowledgement();await send(zaahid,'A retry-safe little hello');await zaahid.getByRole('button',{name:'Failed · retry',exact:true}).waitFor();await layaana.getByText('A retry-safe little hello',{exact:true}).waitFor();fixture.pause(users[0].id,false);await zaahid.getByRole('button',{name:'Failed · retry',exact:true}).click();await until(()=>fixture.messages.filter(m=>m.body==='A retry-safe little hello').length===1);assert.equal(await layaana.getByText('A retry-safe little hello',{exact:true}).count(),1)});
 await check('reconnect catches more than fifty missed messages and offline edits',async()=>{fixture.pause(users[0].id);for(let i=1;i<=120;i++)fixture.add(users[1].id,'Offline burst '+i);fixture.editOffline(first.id,'Edited while away');fixture.pause(users[0].id,false);await zaahid.evaluate(()=>window.dispatchEvent(new Event('online')));await zaahid.getByText('Offline burst 120',{exact:true}).waitFor();await zaahid.getByText('Offline burst 1',{exact:true}).waitFor();await zaahid.getByText('Edited while away',{exact:true}).waitFor();assert(fixture.requests.filter(r=>r.path.endsWith('/universe_messages')&&r.method==='GET').length>=3)});
 await check('presence and typing preserve existing message elements',async()=>{await until(()=>fixture.members.every(m=>m.last_read>=473));await zaahid.evaluate(()=>window.testBubble=document.querySelector('.bubble'));await layaana.locator('#message-input').fill('A little thought');await zaahid.locator('#typing').filter({hasText:'Layaana is typing'}).waitFor();assert(await zaahid.evaluate(()=>window.testBubble.isConnected));await layaana.locator('#message-input').fill('')});
 await check('scroll bursts do not flood receipt requests',async()=>{const before=fixture.requests.filter(r=>r.path.endsWith('/universe_receipt')).length;await zaahid.evaluate(()=>{const m=document.querySelector('#messages');for(let i=0;i<100;i++)m.dispatchEvent(new Event('scroll'))});await new Promise(r=>setTimeout(r,500));assert(fixture.requests.filter(r=>r.path.endsWith('/universe_receipt')).length-before<=1)});
 await check('history window stays capped at two hundred bubbles',async()=>{for(let i=0;i<5;i++){await zaahid.getByRole('button',{name:'Earlier little moments ↑'}).click();await new Promise(r=>setTimeout(r,100))}assert.equal(await zaahid.locator('[data-message]').count(),200)});
 await check('receiving while reading old messages does not mark the new message read',async()=>{const before=fixture.members[0].last_read;fixture.add(users[1].id,'While you were reading earlier');await zaahid.getByRole('button',{name:'Latest little moments ↓'}).waitFor();await until(()=>fixture.members[0].last_delivered>=474);assert.equal(fixture.members[0].last_read,before);await zaahid.getByRole('button',{name:'Latest little moments ↓'}).click();await zaahid.getByText('While you were reading earlier',{exact:true}).waitFor();await until(()=>fixture.members[0].last_read>=474)});
 await check('personal clear leaves partner history and saved keepsakes intact',async()=>{await zaahid.getByRole('button',{name:'Conversation options'}).click();await zaahid.getByRole('button',{name:'Clear my chat…'}).click();await zaahid.getByRole('button',{name:'Clear my chat',exact:true}).click();await zaahid.getByRole('heading',{name:'A fresh little page.'}).waitFor();assert.equal(await layaana.getByText('While you were reading earlier',{exact:true}).count(),1);await zaahid.getByRole('button',{name:'Keepsakes',exact:true}).click();await zaahid.getByText('Edited while away',{exact:true}).waitFor();await zaahid.getByRole('button',{name:'Our conversation',exact:true}).click();await send(layaana,'A fresh page, and still us.');await zaahid.getByText('A fresh page, and still us.',{exact:true}).waitFor()});
 await check('failed mobile send survives reload and retries exactly once',async()=>{await phone.setOffline(true);await send(layaana,'The saved mobile outbox');await layaana.getByRole('button',{name:'Failed · retry',exact:true}).waitFor();await phone.setOffline(false);await layaana.reload();await layaana.getByRole('button',{name:'Failed · retry',exact:true}).waitFor();await layaana.getByRole('button',{name:'Failed · retry',exact:true}).click();await zaahid.getByText('The saved mobile outbox',{exact:true}).waitFor();assert.equal(fixture.messages.filter(m=>m.body==='The saved mobile outbox').length,1)});
 await check('six-times CPU-throttled phone stays within a one-hundred-message window',async()=>{for(let i=1;i<=150;i++)fixture.add(users[0].id,'Performance burst '+i);await layaana.getByText('Performance burst 150',{exact:true}).waitFor();assert.equal(await layaana.locator('[data-message]').count(),100)});
 await check('six-times CPU-throttled phone sends and paints promptly',async()=>{const duration=await layaana.evaluate(async()=>{const input=document.querySelector('#message-input');input.value='A responsive little hello';input.dispatchEvent(new Event('input',{bubbles:true}));const at=performance.now();document.querySelector('#composer').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>{const tick=()=>{if([...document.querySelectorAll('.bubble')].some(el=>el.textContent==='A responsive little hello'))requestAnimationFrame(resolve);else requestAnimationFrame(tick)};requestAnimationFrame(tick)});return performance.now()-at});assert(duration<500,`Send-to-paint ${duration.toFixed(1)}ms exceeded 500ms under 6× CPU throttling`);results.push({name:'throttled phone optimistic send-to-paint',ms:Math.round(duration)});assert.equal(await layaana.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await layaana.screenshot({path:'work/phone-verified.png'});await zaahid.screenshot({path:'work/desktop-verified.png'})});
 await check('slow-network cold login paints without loading the messaging SDK',async()=>{
  const context=await browser.newContext({viewport:{width:360,height:800},isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage();
  const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:6});await session.send('Network.enable');await session.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:90000});
  const at=performance.now();await page.goto(origin);await page.getByRole('heading',{name:'Back to our little world.'}).waitFor();const duration=performance.now()-at;
  const entries=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>({name:e.name,size:e.encodedBodySize,start:Math.round(e.startTime),duration:Math.round(e.duration)})));console.log('Cold login measurement',JSON.stringify({ms:Math.round(duration),resources:entries.map(e=>({...e,name:e.name.split('/').pop()}))}));assert(!entries.some(e=>/module-/.test(e.name)));assert(duration<4000,`Cold login ${Math.round(duration)}ms exceeded 4s budget`);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  results.push({name:'6× CPU, 150ms network latency, 1.6Mbps cold login ready',ms:Math.round(duration),encodedResourceBytes:entries.reduce((n,e)=>n+e.size,0)});await context.close();
 });
 await check('signout removes conversation and private outbox from the page',async()=>{await zaahid.getByRole('button',{name:'Sign out',exact:true}).click();await zaahid.getByRole('heading',{name:'Back to our little world.'}).waitFor();assert.equal(await zaahid.locator('[data-message]').count(),0);assert.equal(await zaahid.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('universe-')).length),0)});
 assert.deepEqual(errors,[]);
 const report={kind:'two-browser integration with deterministic test transport; not live Supabase websocket validation',passed:true,seedMessages:350,cpuThrottle:6,results,latencies,pageErrors:errors,requests:fixture.requests.length};
 await writeFile('work/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(e){console.error(e);await zaahid.screenshot({path:'work/failure-desktop.png'});await layaana.screenshot({path:'work/failure-phone.png'});console.error('Page errors:',errors);console.error('Fixture state',JSON.stringify({members:fixture.members,lastSeq:fixture.messages.at(-1)?.seq,recentRequests:fixture.requests.slice(-8)}));process.exitCode=1}
finally{await browser.close();server.close()}
