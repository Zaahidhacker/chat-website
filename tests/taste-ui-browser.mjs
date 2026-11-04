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
const server=http.createServer(async(req,res)=>{try{let route=new URL(req.url,'http://localhost').pathname;if(route==='/')route='/index.html';const file=path.resolve(root,'.'+route);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404).end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:320,height:740},serviceWorkers:'block'});
const fixture=createFixture(30),results=[],errors=[];
await fixture.install(context);
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name)}
try{
 await page.goto(origin);await page.locator('#email').fill(users[0].email);await page.locator('#password').fill('test-password-only');await page.getByRole('button',{name:'Enter our universe',exact:true}).click();await page.locator('#message-input').waitFor();
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
 assert.deepEqual(errors,[]);await writeFile('work/taste-ui-report.json',JSON.stringify({passed:true,results,errors},null,2));
}finally{await browser.close();server.close()}
