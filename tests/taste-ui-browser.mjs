import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createFixture,users} from './transport-fixture.mjs';
// Real UI with isolated synthetic accounts. Never reads or writes private production data.
const root=path.resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'};
const deployment=JSON.parse(await readFile('vercel.json','utf8'));
const csp=deployment.headers.flatMap(rule=>rule.headers).find(header=>header.key==='Content-Security-Policy');
const server=http.createServer(async(req,res)=>{try{let route=new URL(req.url,'http://localhost').pathname;if(route==='/')route='/index.html';const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');if(route==='/index.html')res.setHeader(csp.key,csp.value);res.end(await readFile(file))}catch{res.writeHead(404).end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:320,height:740},serviceWorkers:'block'});
const fixture=createFixture(30),results=[],errors=[];
await fixture.install(context);
await context.addInitScript(()=>{
 localStorage.setItem('universe-motion',localStorage.getItem('universe-motion')||'lite');
 window.sessionScenes=[];
 window.cspViolations=[];
 document.addEventListener('securitypolicyviolation',event=>window.cspViolations.push(event.violatedDirective));
 new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes){
   if(node instanceof Element && node.matches('.session-transition'))window.sessionScenes.push(node.getAttribute('aria-label'));
  }
 }).observe(document,{childList:true,subtree:true});
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name)}
async function signIn(email){
 await page.locator('#email').fill(email);
 await page.locator('#password').fill('test-password-only');
 await page.getByRole('button',{name:'Enter our universe',exact:true}).click();
}
const scene=page.locator('.session-transition');
const goodbye='GoodBye! Come Back again..';
try{
 await page.goto(origin);await signIn(users[0].email);await page.locator('#message-input').waitFor();
 await check('first sign-in skips the session scene and gentle mode loads under the production CSP',async()=>{
  assert.deepEqual(await page.evaluate(()=>window.sessionScenes),[]);
  assert.deepEqual(await page.evaluate(()=>window.cspViolations),[]);
  assert.equal(await page.locator('html').getAttribute('data-motion'),'lite');
 });
 await check('narrow-phone emoji stays available through options and inserts into an unsent draft',async()=>{
  const count=fixture.messages.length;await page.locator('#message-input').fill('A thought ');await page.getByRole('button',{name:'Conversation options',exact:true}).click();await page.getByRole('button',{name:'Choose an emoji',exact:true}).click();await page.getByRole('button',{name:'❤️',exact:true}).click();assert.equal(await page.locator('#message-input').inputValue(),'A thought ❤️');assert.equal(fixture.messages.length,count);
 });
 await check('phone navigation traps keyboard focus and Escape restores the opener and draft',async()=>{
  const open=page.getByRole('button',{name:'Open navigation',exact:true});await open.click();const sheet=page.getByRole('dialog',{name:'Our spaces',exact:true});await sheet.waitFor();assert.equal(await page.locator('.main').evaluate(el=>el.inert),true);assert.equal(await open.getAttribute('aria-expanded'),'true');await page.waitForFunction(()=>document.activeElement.getAttribute('aria-label')==='Close navigation');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Close navigation');await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Sign out');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Close navigation');await page.keyboard.press('Escape');assert.equal(await page.locator('.main').evaluate(el=>el.inert),false);assert.equal(await open.getAttribute('aria-expanded'),'false');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Open navigation');assert.equal(await page.locator('#message-input').inputValue(),'A thought ❤️');
 });
 await check('a note opened from the phone sheet remains visible and returns focus to the conversation',async()=>{
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('button',{name:'Open a little note',exact:true}).click();await page.getByRole('dialog',{name:'A little “thinking of you.”',exact:true}).waitFor();assert.equal(await page.locator('.sidebar.open').count(),0);await page.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Open navigation');assert.equal(await page.locator('.main').evaluate(el=>el.inert),false);
 });
 await check('resizing an open phone sheet releases the desktop conversation',async()=>{
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.setViewportSize({width:1440,height:900});await page.waitForFunction(()=>!document.querySelector('.main').inert);assert.equal(await page.locator('.sidebar.open').count(),0);await page.locator('#message-input').fill('The conversation still works.');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByText('The conversation still works.',{exact:true}).waitFor();
 });
 await check('restored multiline drafts reflow on phones, keyboard-height layouts and laptops',async()=>{
  const draft='A little thought, with enough room to say it.\nAnother line, just for you.\nAnd one more little hello.';
  await page.setViewportSize({width:390,height:844});await page.locator('#message-input').fill(draft);await page.reload();await page.locator('#message-input').waitFor();assert.equal(await page.locator('#message-input').inputValue(),draft);
  for(const viewport of [{width:390,height:844},{width:320,height:740},{width:390,height:420},{width:844,height:390},{width:1440,height:900}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(120);const metrics=await page.locator('#message-input').evaluate(el=>({height:el.clientHeight,scroll:el.scrollHeight,overflow:getComputedStyle(el).overflowY}));assert(metrics.height>44,'A restored multiline draft must expand');assert(metrics.scroll<=metrics.height+1||['auto','scroll'].includes(metrics.overflow),'Long drafts must remain scrollable');const box=await page.locator('#composer').boundingBox();assert(box.y>=0&&box.y+box.height<=viewport.height,'Composer stays within the usable viewport');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.locator('#message-input').fill('');
 });
 await check('theme choices announce selection and preserve existing messages and saved items',async()=>{
  const ids=fixture.messages.map(m=>m.id),saved=[...fixture.favorites.get(users[0].id)||[]];await page.locator('.sidebar [data-action=page-settings]').click();await page.getByRole('button',{name:'Soft Love',exact:true}).click();await page.locator('[data-action=theme-light][aria-pressed=true]').waitFor();assert.equal(await page.getByRole('button',{name:'Soft Love',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('light')),true);await page.getByRole('button',{name:'Midnight Romance',exact:true}).click();await page.locator('[data-action=theme-dark][aria-pressed=true]').waitFor();assert.equal(await page.getByRole('button',{name:'Midnight Romance',exact:true}).getAttribute('aria-pressed'),'true');await page.locator('.sidebar [data-action=page-chat]').click();await page.locator('#message-input').waitFor();assert.deepEqual(fixture.messages.map(m=>m.id),ids);assert.deepEqual([...fixture.favorites.get(users[0].id)||[]],saved);assert.equal(await page.locator('.sidebar [data-action=page-chat]').getAttribute('aria-current'),'page');
 });
 await check('gentle motion switch flips, persists and survives reload',async()=>{
  await page.locator('.sidebar [data-action=page-settings]').click();
  const sw=page.getByRole('switch',{name:'Gentle motion for this device'});await sw.waitFor();
  const before=await page.evaluate(()=>document.documentElement.dataset.motion==='lite');
  await sw.click();await page.waitForFunction(prev=>(document.documentElement.dataset.motion==='lite')!==prev,before);
  assert.equal(await page.evaluate(()=>localStorage.getItem('universe-motion')),before?'full':'lite');
  assert.equal(await sw.getAttribute('aria-checked'),String(!before));
  await sw.click();await page.waitForFunction(prev=>(document.documentElement.dataset.motion==='lite')===prev,before);
  assert.equal(await page.evaluate(()=>localStorage.getItem('universe-motion')),before?'lite':'full');
  await page.reload();await page.locator('#message-input').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.dataset.motion==='lite'),before);
 });
 await check('changing appearance preserves both latest-message and earlier-reading positions with an unsent draft',async()=>{
  await page.locator('#message-input').fill('A draft stays with my reading position.');
  for(const bottom of [true,false]){
   await page.locator('#messages').evaluate((el,bottom)=>el.scrollTop=bottom?el.scrollHeight:Math.round(el.scrollHeight/3),bottom);
   const before=await page.locator('#messages').evaluate(el=>el.scrollTop),old=await page.locator('#messages').elementHandle();await page.getByRole('button',{name:'Change appearance',exact:true}).click();await page.waitForFunction(el=>!el.isConnected,old);
   const after=await page.locator('#messages').evaluate(el=>({top:el.scrollTop,gap:el.scrollHeight-el.clientHeight-el.scrollTop}));if(bottom)assert(after.gap<3,'The latest message stays visible after a theme change');else assert(Math.abs(after.top-before)<3,'Earlier reading position stays put');assert.equal(await page.locator('#message-input').inputValue(),'A draft stays with my reading position.');
  }
 });
 await check('desktop logout fades in the exact farewell and a signed-out refresh does not replay it',async()=>{
  await page.evaluate(()=>{
   document.documentElement.removeAttribute('data-motion');
   localStorage.setItem('universe-motion','full');
  });
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('dialog',{name:goodbye,exact:true}).waitFor();
  const style=await scene.evaluate(el=>({
   background:getComputedStyle(el).backgroundColor,
   gradient:getComputedStyle(el).backgroundImage,
   wordDelays:[...el.querySelectorAll('span')].map(word=>parseFloat(getComputedStyle(word).animationDelay))
  }));
  assert.equal(style.background,'rgb(0, 0, 0)');
  assert.match(style.gradient,/radial-gradient/);
  assert.equal(style.wordDelays.length,4);
  assert(style.wordDelays.every((delay,index)=>index===0||delay>style.wordDelays[index-1]));
  assert.equal(await scene.locator('.session-eyebrow').textContent(),'Until next time');
  assert.equal(await scene.locator('.session-sub').textContent(),'Your person will be right here when you return.');
  assert.equal(await scene.locator('.session-heart').count(),1);
  assert.equal(await scene.locator('.session-star').count(),5);
  assert.equal(await scene.locator('span.session-cursive').textContent(),'again..');
  await scene.waitFor({state:'detached'});
  await page.reload();await page.locator('#login-form').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.sessionScenes),[]);
 });
 await check('a failed login and another member’s first login leave Zaahid’s welcome pending',async()=>{
  await signIn('unknown@test.invalid');
  await page.waitForFunction(()=>document.querySelector('#login-error').textContent.includes('didn’t open the door'));
  await page.setViewportSize({width:320,height:740});
  await page.emulateMedia({reducedMotion:'reduce'});
  await signIn(users[1].email);
  await page.locator('#message-input').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.sessionScenes),[]);
 });
 await check('mobile logout and return show Layaana’s exact name with reduced motion',async()=>{
  await page.getByRole('button',{name:'Open navigation',exact:true}).click();
  await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('dialog',{name:goodbye,exact:true}).waitFor();
  assert.equal(await scene.evaluate(el=>el.getAnimations({subtree:true}).length),0);
  await scene.waitFor({state:'detached'});
  fixture.members[1].name='An edited display name';
  await signIn(users[1].email);
  await page.getByRole('dialog',{name:'Welcome Back, Layaana',exact:true}).waitFor();
  assert.equal(await scene.locator('.session-eyebrow').textContent(),'A little hello');
  assert.equal(await scene.locator('span.session-cursive').textContent(),'Layaana');
  await scene.waitFor({state:'detached'});
  await page.reload();await page.locator('#message-input').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.sessionScenes),[]);
 });
 await check('another tab’s sign-out stays silent and Zaahid’s return appears once',async()=>{
  const other=await context.newPage();
  try{
   await other.setViewportSize({width:1440,height:900});
   await other.goto(origin);await other.locator('#message-input').waitFor();
   await other.getByRole('button',{name:'Sign out',exact:true}).click();
   await page.locator('#login-form').waitFor();
   assert.deepEqual(await page.evaluate(()=>window.sessionScenes),[]);
   await other.locator('.session-transition').waitFor({state:'detached'});
  }finally{await other.close()}
  await signIn(users[0].email);
  await page.getByRole('dialog',{name:'Welcome Back, Zaahid',exact:true}).waitFor();
  await scene.waitFor({state:'detached'});
  await page.reload();await page.locator('#message-input').waitFor();
  assert.deepEqual(await page.evaluate(()=>window.sessionScenes),[]);
 });
 assert.deepEqual(errors,[]);await writeFile('work/taste-ui-report.json',JSON.stringify({passed:true,results,errors},null,2));
}finally{await browser.close();server.close()}
