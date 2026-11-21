import {chromium} from 'playwright';import {existsSync} from 'node:fs';import assert from 'node:assert/strict';import http from 'node:http';import path from 'node:path';import {readFile,writeFile,mkdir} from 'node:fs/promises';import {createFixture,users} from './transport-fixture.mjs';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const baseline=url.pathname.startsWith('/baseline/'),root=path.resolve(baseline?'work/native-motion/baseline':'dist');let route=baseline?url.pathname.slice(9):url.pathname;if(route==='/')route='/index.html';const file=path.resolve(root,'.'+route);if(!file.startsWith(root+'/'))throw Error();let body=await readFile(file);if(baseline&&file.endsWith('.html'))body=body.toString().replaceAll('"/assets/','"/baseline/assets/');res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.end(body)}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});const f=createFixture(220),contexts=[],errors=[],results=[],metrics={};
async function client(i,width=412,extra={}){const c=await browser.newContext({viewport:{width,height:892},isMobile:true,hasTouch:true,serviceWorkers:'block',...extra});contexts.push(c);await f.install(c);await c.addInitScript(()=>{if(window.CloseWatcher){const Native=window.CloseWatcher;window.__closeRequests=[];window.CloseWatcher=class extends Native{constructor(){super();window.__closeRequests.push(this)}}}});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin);await p.locator('#email').fill(users[i].email);await p.locator('#password').fill('test-password-only');await p.getByRole('button',{name:'Enter our universe',exact:true}).click();await p.locator('#message-input').waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(250);return p}
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name)}
async function viewport(p,height,offset=0,scale=1){await p.evaluate(({height,offset,scale})=>{const vv=visualViewport;for(const [key,value]of Object.entries({height,offsetTop:offset,scale}))Object.defineProperty(vv,key,{configurable:true,value});vv.dispatchEvent(new Event('resize'));vv.dispatchEvent(new Event('scroll'))},{height,offset,scale});await p.waitForTimeout(75)}
async function bottom(p){await p.locator('#messages').evaluate(el=>el.scrollTop=el.scrollHeight);await p.waitForTimeout(80)}
try{
 await mkdir('work/native-motion',{recursive:true});
 assert.match(await readFile('dist/index.html','utf8'),/interactive-widget=resizes-visual/);
 const a=await client(0),b=await client(1,393);for(const p of [a,b])assert(await p.locator('#messages').evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight<3),'Initial conversation must open at the latest message');
 await check('focus follows changing geometry even without resize events',async()=>{await a.locator('#message-input').blur();await a.locator('#message-input').focus();await a.evaluate(()=>Object.defineProperty(visualViewport,'height',{configurable:true,value:520}));await a.waitForTimeout(90);assert.equal(await a.locator('.app-layout').evaluate(el=>el.clientHeight),520);await viewport(a,892);await a.waitForTimeout(650);assert.equal(await a.evaluate(()=>document.documentElement.hasAttribute('data-viewport-moving')),false);await a.evaluate(()=>Object.defineProperty(visualViewport,'height',{configurable:true,value:880}));await a.waitForTimeout(90);assert.equal(await a.locator('.app-layout').evaluate(el=>el.clientHeight),892,'Focus sampling must stop while idle');await viewport(a,892)});
 await check('progressive visual viewport resize tracks the composer once and keeps latest messages pinned',async()=>{await bottom(a);await a.locator('#message-input').focus();for(const height of [850,810,740,650,560,470,410,460,540,680,810,892]){await viewport(a,height);const state=await a.evaluate(()=>{const l=document.querySelector('#messages'),c=document.querySelector('#composer').getBoundingClientRect();return{bottom:c.bottom,gap:l.scrollHeight-l.scrollTop-l.clientHeight,height:document.querySelector('.app-layout').clientHeight}});assert(Math.abs(state.height-height)<2);assert(state.bottom<=height+1);assert(state.gap<3,'Latest stays pinned '+JSON.stringify({height,...state}))}assert.equal(await a.locator('#message-input').evaluate(el=>document.activeElement===el),true)});
 await check('toolbar offsets preserve an older reading anchor and pinch zoom remains browser-owned',async()=>{await a.locator('#messages').evaluate(el=>el.scrollTop=el.scrollHeight*.35);await a.waitForTimeout(100);const anchor=await a.evaluate(()=>{const l=document.querySelector('#messages'),r=l.getBoundingClientRect(),n=[...l.querySelectorAll('[data-message]')].find(n=>n.getBoundingClientRect().bottom>r.top+10);return{id:n.dataset.message,y:n.getBoundingClientRect().top}});for(const [h,y]of [[700,0],[520,14],[780,0],[892,0]]){await viewport(a,h,y);assert(Math.abs(await a.locator(`[data-message="${anchor.id}"]`).evaluate(el=>el.getBoundingClientRect().top)-anchor.y)<3)}const before=await a.evaluate(()=>document.documentElement.style.getPropertyValue('--app-height'));await viewport(a,450,20,1.8);assert.equal(await a.evaluate(()=>document.documentElement.style.getPropertyValue('--app-height')),before);await viewport(a,892)});
 await check('multiline growth and rapid typing preserve selection, delivery and bottom anchoring',async()=>{await bottom(a);await a.locator('#message-input').fill('One line\nSecond line\nThird line\nFourth line');await a.locator('#message-input').evaluate(el=>el.setSelectionRange(12,12));await a.waitForTimeout(250);assert.equal(await a.locator('#message-input').evaluate(el=>el.selectionStart),12);assert((await a.locator('#message-input').boundingBox()).height>70);await viewport(a,410);assert((await a.locator('#composer').boundingBox()).y>=0);for(let i=0;i<5;i++){await a.locator('#message-input').fill('Fluid message '+i);await a.getByRole('button',{name:'Send message',exact:true}).click();await b.getByText('Fluid message '+i,{exact:true}).waitFor()}await a.locator('#message-input').fill('A draft while a message arrives');f.add(users[1].id,'An incoming thought while you type');await a.getByText('An incoming thought while you type',{exact:true}).waitFor();assert.equal(await a.locator('#message-input').inputValue(),'A draft while a message arrives');await viewport(a,892)});
 await check('own message morphs from the send button into a liquid-glass bubble',async()=>{
  await bottom(a);
  // Full motion for the glass asserts: headless reports few cores, so the app
  // runs lite by default; the bounce test forces full motion the same way.
  await a.evaluate(()=>{localStorage.setItem('universe-motion','full');document.documentElement.removeAttribute('data-motion')});
  await a.locator('#message-input').fill('A little bubble for you');
  await a.getByRole('button',{name:'Send message',exact:true}).click();
  // Mid-flight, in one snapshot: one morphing message, one animation, the
  // FLIP travel in its first keyframe, the -3px overshoot, liquid glass on.
  // One atomic snapshot: wait inside the page for the morphing element AND its
  // running animation, then read everything in the same task. A separate
  // waitForFunction + evaluate can land in the 170ms glass-fade after the
  // 300ms animation ends, when the class is still there but no animation runs.
  const snap=await a.evaluate(async()=>{
   const deadline=performance.now()+900;let el=null,anims=[];
   while(performance.now()<deadline){el=document.querySelector('.message-main.morphing');if(el){anims=el.getAnimations();if(anims.length)break}await new Promise(r=>requestAnimationFrame(r))}
   if(!el||!anims.length)return{found:!!el,anims:anims.length,first:'',overshoot:false,glass:'none',box:null,btn:null};
   const btn=document.querySelector('.composer .send').getBoundingClientRect(),kf=anims[0].effect.getKeyframes();
   return{found:true,box:el.querySelector('.bubble').getBoundingClientRect().toJSON(),btn:btn.toJSON(),anims:anims.length,
    first:kf[0]?.transform||'',overshoot:kf.some(k=>k.transform&&k.transform.includes('translateY(-3px)')),
    glass:getComputedStyle(el,'::after').backdropFilter};
  });
  assert.equal(snap.found,true,'Morphing message appears after send');
  assert.equal(snap.anims,1,'The morph is a single entrance animation');
  assert.equal(snap.overshoot,true,'The morph keeps the -3px overshoot');
  assert.notEqual(snap.glass,'none','Liquid glass blurs while morphing');
  const travel=/translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)\s+scale\(\s*([\d.]+),\s*([\d.]+)\s*\)/.exec(snap.first);
  assert(travel,'First morph keyframe carries the FLIP travel from the button');
  assert(Math.abs(+travel[2])>40,'Morph travels a real distance upward');
  assert(+travel[3]<.5,'Morph starts small');
  const mid={x:snap.box.x+snap.box.width/2,y:snap.box.y+snap.box.height/2},btnC={x:snap.btn.x+snap.btn.width/2,y:snap.btn.y+snap.btn.height/2};
  assert(Math.abs(mid.x-btnC.x)<140,'Morph starts near the send button');
  assert(mid.y<=btnC.y+5,'Morph starts at the send button and travels upward');
  assert.equal(await a.locator('.send-droplet').count(),0,'No fixed droplet exists any more');
  await a.getByText('A little bubble for you',{exact:true}).waitFor();
  await a.waitForFunction(()=>!document.querySelector('.message-main.morphing,.message-main.morph-settling'),{timeout:2000});
  const settled=await a.evaluate(()=>{const el=[...document.querySelectorAll('.bubble')].find(e=>e.textContent==='A little bubble for you');const m=el.parentElement;return{opacity:getComputedStyle(m).opacity,anims:m.getAnimations().length,box:el.getBoundingClientRect().toJSON()}});
  assert.equal(settled.opacity,'1','Message settles fully painted');
  assert.equal(settled.anims,0,'No animation lingers after the morph');
  assert(mid.y>=settled.box.y+settled.box.height/2-5,'Morph never rises above its resting place');
  // Gentle motion: simplified morph, no backdrop blur, still travels and settles.
  await a.evaluate(()=>{document.documentElement.dataset.motion='lite'});
  await a.locator('#message-input').fill('A gentle bubble');
  await a.getByRole('button',{name:'Send message',exact:true}).click();
  await a.waitForFunction(()=>!!document.querySelector('.message-main.morphing'),{timeout:500});
  assert.equal(await a.locator('.message-main.morphing').evaluate(el=>getComputedStyle(el,'::after').backdropFilter),'none');
  await a.waitForFunction(()=>!document.querySelector('.message-main.morphing,.message-main.morph-settling'),{timeout:2000});
  await a.getByText('A gentle bubble',{exact:true}).waitFor();
  await a.evaluate(()=>{delete document.documentElement.dataset.motion});
  // Reduced motion: no morph at all, the message still sends.
  await a.emulateMedia({reducedMotion:'reduce'});
  await a.locator('#message-input').fill('No bubble, just words');
  await a.getByRole('button',{name:'Send message',exact:true}).click();
  await a.waitForTimeout(250);
  assert.equal(await a.locator('.message-main.morphing').count(),0);
  assert.equal(await a.locator('.message-main.morph-settling').count(),0);
  await a.getByText('No bubble, just words',{exact:true}).waitFor();
  await a.emulateMedia({reducedMotion:'no-preference'});
 });
 await check('keyboard-open send lands exactly where the closed-keyboard send lands',async()=>{
  await bottom(a);
  await a.evaluate(()=>{localStorage.setItem('universe-motion','full');document.documentElement.removeAttribute('data-motion')});
  // Closed keyboard: send and record the settled bubble rect.
  await a.locator('#message-input').fill('Closed keyboard landing');
  await a.getByRole('button',{name:'Send message',exact:true}).click();
  await a.getByText('Closed keyboard landing',{exact:true}).waitFor();
  await a.waitForFunction(()=>!document.querySelector('.message-main.morphing,.message-main.morph-settling'),{timeout:2000});
  const closed=await a.getByText('Closed keyboard landing').boundingBox();
  // Keyboard open: shrink the viewport, send, dismiss mid-morph.
  await viewport(a,520);
  await a.locator('#message-input').focus();
  await a.locator('#message-input').fill('Open keyboard landing');
  await a.getByRole('button',{name:'Send message',exact:true}).click();
  await viewport(a,892);
  const midSnap=await a.evaluate(async()=>{
   const deadline=performance.now()+900;let el=null;
   while(performance.now()<deadline){el=document.querySelector('.message-main.morphing');if(el&&el.getAnimations().length)break;el=null;await new Promise(r=>requestAnimationFrame(r))}
   if(!el)return{found:false};
   const btn=document.querySelector('.composer .send').getBoundingClientRect();
   return{found:true,box:el.querySelector('.bubble').getBoundingClientRect().toJSON(),btn:btn.toJSON()};
  });
  assert.equal(midSnap.found,true,'Morph is in flight as the keyboard dismisses');
  const midBox=midSnap.box,btn=midSnap.btn;
  await a.getByText('Open keyboard landing',{exact:true}).waitFor();
  await a.waitForFunction(()=>!document.querySelector('.message-main.morphing,.message-main.morph-settling'),{timeout:2000});
  const open=await a.getByText('Open keyboard landing').boundingBox();
  assert(Math.abs(open.y-closed.y)<8,'Keyboard-open send must land at the same height as the closed send');
  assert(Math.abs((open.x+open.width)-(closed.x+closed.width))<8,'Own bubbles stay right-aligned in both cases');
  const midC={x:midBox.x+midBox.width/2,y:midBox.y+midBox.height/2},openC={x:open.x+open.width/2,y:open.y+open.height/2},btnC={x:btn.x+btn.width/2,y:btn.y+btn.height/2};
  assert(midC.y>=openC.y-5,'Morph never overshoots above its resting place, even as the keyboard dismisses');
  assert(midC.y<btnC.y,'Morph leaves the button upward');
 });
 await check('long press opens existing actions; scrolling and cancellation never open them',async()=>{await bottom(b);const article=b.locator('[data-message]').last(),box=await article.locator('.bubble').boundingBox();await b.dispatchEvent(`[data-message="${await article.getAttribute('data-message')}"] .bubble`,'pointerdown',{pointerId:77,pointerType:'touch',isPrimary:true,clientX:box.x+30,clientY:box.y+20});await b.getByRole('dialog',{name:'A little moment.',exact:true}).waitFor();await b.getByRole('button',{name:'Close',exact:true}).click();await b.waitForTimeout(180);await article.locator('.bubble').dispatchEvent('pointerdown',{pointerId:78,pointerType:'touch',isPrimary:true,clientX:box.x+30,clientY:box.y+20});await article.locator('.bubble').dispatchEvent('pointercancel',{pointerId:78,pointerType:'touch',isPrimary:true});await b.waitForTimeout(520);assert.equal(await b.getByRole('dialog').count(),0)});
 await check('dialog exits are noninteractive, interruptible and leave no ghosts or stale focus',async()=>{for(let i=0;i<4;i++){await b.getByRole('button',{name:'Conversation options',exact:true}).click();await b.getByRole('button',{name:'Close',exact:true}).click()}await b.waitForTimeout(200);assert.equal(await b.locator('.motion-ghost').count(),0);assert.equal(await b.locator('#app').evaluate(el=>el.inert),false);assert.equal(await b.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Conversation options')});
 await check('native close requests dismiss dialogs and navigation without changing browser history',async()=>{const available=await b.evaluate(()=>!!window.CloseWatcher);if(!available)return;const history=await b.evaluate(()=>window.history.length);await b.getByRole('button',{name:'Conversation options',exact:true}).click();await b.getByRole('dialog').waitFor();await b.evaluate(()=>window.__closeRequests.at(-1).requestClose());await b.getByRole('dialog').waitFor({state:'hidden'});await b.getByRole('button',{name:'Open navigation',exact:true}).click();await b.getByRole('dialog',{name:'Our spaces',exact:true}).waitFor();await b.evaluate(()=>window.__closeRequests.at(-1).requestClose());await b.getByRole('dialog',{name:'Our spaces',exact:true}).waitFor({state:'hidden'});assert.equal(await b.evaluate(()=>window.history.length),history)});
 await check('reduced motion cancels in-flight animations while retaining every interaction',async()=>{await b.getByRole('button',{name:'Conversation options',exact:true}).click();await b.emulateMedia({reducedMotion:'reduce'});assert.equal(await b.locator('#modal-root .modal').evaluate(el=>el.getAnimations().length),0);await b.getByRole('button',{name:'Close',exact:true}).click();assert.equal(await b.locator('.motion-ghost').count(),0);await viewport(b,500,14);assert.equal(Math.round((await b.locator('.app-layout').boundingBox()).y),14,'Reduced motion must retain viewport positioning');const composer=await b.locator('#composer').boundingBox();assert(composer.y+composer.height<=515,'Reduced motion keeps the composer inside the visible viewport');await viewport(b,892);await b.emulateMedia({reducedMotion:'no-preference'})});
 await check('settled mobile typography, colors, spacing and bubble geometry match the baseline',async()=>{
  const props=['fontFamily','fontWeight','fontSize','letterSpacing','lineHeight','color','backgroundColor','borderRadius','paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginBottom','textAlign'];const selectors=['.chat-header','#partner-name','.message.own .bubble','.message:not(.own) .bubble','.composer','.composer textarea','.composer .send','.mobile-spaces'];
  async function capture(base){const c=await browser.newContext({viewport:{width:412,height:892},serviceWorkers:'block'});contexts.push(c);await f.install(c);if(base)await c.route('**/assets/**',route=>{const u=new URL(route.request().url());return route.continue(u.pathname.startsWith('/baseline/')?{}:{url:origin+'/baseline'+u.pathname})});const p=await c.newPage();await p.goto(origin+(base?'/baseline/':'/'));await p.getByRole('button',{name:'Take a peek',exact:false}).click();await p.locator('#message-input').waitFor();await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(450);return p.evaluate(({selectors,props})=>selectors.map(s=>{const e=document.querySelector(s),c=getComputedStyle(e),r=e.getBoundingClientRect();return{selector:s,styles:Object.fromEntries(props.map(k=>[k,c[k]])),width:Math.round(r.width*100)/100,height:Math.round(r.height*100)/100}}),{selectors,props})}
  const baseline=JSON.parse(await readFile('tests/fixtures/motion-resting-styles.json','utf8')).styles,updated=await capture(false);await writeFile('work/native-motion/design-comparison.json',JSON.stringify({baseline,updated},null,2));for(let i=0;i<baseline.length;i++){assert.deepEqual(updated[i].styles,baseline[i].styles);assert(Math.abs(updated[i].width-baseline[i].width)<=.5);assert(Math.abs(updated[i].height-baseline[i].height)<=.5)}
 });
 await check('frame and long-animation-frame diagnostics collect actual browser timings',async()=>{await a.emulateMedia({reducedMotion:'no-preference'});await bottom(a);metrics.frames=await a.evaluate(async()=>{const frames=[],loafs=[];let o;try{o=new PerformanceObserver(list=>loafs.push(...list.getEntries().map(e=>({duration:e.duration,blockingDuration:e.blockingDuration}))));o.observe({type:'long-animation-frame',buffered:false})}catch{}let prior=performance.now();for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);const now=performance.now();frames.push(now-prior);prior=now;if(i%15===0){const t=document.querySelector('#message-input');t.value+=' a little thought';t.dispatchEvent(new Event('input',{bubbles:true}))}}o?.disconnect();return{longAnimationFrameSupported:PerformanceObserver.supportedEntryTypes.includes('long-animation-frame'),samples:frames.length,p50:frames.sort((a,b)=>a-b)[45],p95:frames[85],max:Math.max(...frames),longAnimationFrames:loafs}});console.log('FRAME DIAGNOSTICS '+JSON.stringify(metrics.frames));assert(metrics.frames.longAnimationFrames.every(e=>e.duration<500),'No catastrophic rendering stall')});
 assert.deepEqual(errors,[]);await writeFile('work/native-motion/report.json',JSON.stringify({passed:true,kind:'Chromium emulation and synthetic VisualViewport events, not physical Android IME/120Hz validation',results,metrics,errors},null,2));
}finally{await browser.close();server.close()}
