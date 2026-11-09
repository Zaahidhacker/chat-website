import {chromium} from 'playwright';
import assert from 'node:assert/strict';import http from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';import {performance} from 'node:perf_hooks';import {existsSync} from 'node:fs';import {gzipSync} from 'node:zlib';
import {createFixture,users} from './transport-fixture.mjs';
const root=path.resolve('dist');const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p==='/')p='/index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return}try{const b=await readFile(file);const zipped=(req.headers['accept-encoding']||'').includes('gzip')&&/\.(js|css|html)$/.test(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'text/plain',...(zipped?{'Content-Encoding':'gzip'}:{})});res.end(zipped?gzipSync(b):b)}catch{res.writeHead(404);res.end('Not found')}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});

try {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const fixture=createFixture();await fixture.install(context);const page=await context.newPage();
 await page.goto(origin);await page.locator('#email').fill(users[0].email);await page.locator('#password').fill('test-password-only');await page.getByRole('button',{name:'Enter our universe',exact:true}).click();await page.locator('#message-input').waitFor();
 await page.waitForFunction(()=>[...document.styleSheets].some(s=>s.href?.includes('interactions-')));
 const target=page.getByRole('button',{name:'Conversation options'});await target.click();await page.getByRole('dialog').waitFor();
 assert(await page.locator('#modal-root .modal').evaluate(el=>el.getAnimations().some(a=>a.effect.getTiming().duration===220)));
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('#message-input').fill('A draft stays safe');
 const before=await page.locator('#messages').evaluate(el=>({top:el.scrollTop,count:el.children.length}));
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.send').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 assert.equal(await page.locator('#message-input').inputValue(),'A draft stays safe');
 assert.deepEqual(await page.locator('#messages').evaluate(el=>({top:el.scrollTop,count:el.children.length})),before);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('#message-input').click();const box=await target.boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(180);
 assert.equal(await target.evaluate(el=>getComputedStyle(el).scale),'1');assert.notEqual(await target.locator('.icon').evaluate(el=>getComputedStyle(el).transform),'none');await page.mouse.up();await page.getByRole('dialog').waitFor();
 await page.keyboard.press('Escape');await page.waitForTimeout(200);
 assert.equal(await target.evaluate(el=>el.matches(':focus-visible')),true);
 assert.equal(await target.evaluate(el=>getComputedStyle(el).scale),'1');
 await page.screenshot({path:'work/animate-mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log('PASS: dialog timing, reduced motion, draft/history/scroll preservation, pointer press, keyboard focus and mobile overflow');
 await context.close();
} finally {await browser.close();server.close()}
