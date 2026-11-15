import {chromium} from 'playwright';
import assert from 'node:assert/strict';import http from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';import {existsSync} from 'node:fs';
import {createFixture,users} from './transport-fixture.mjs';import {callFixture} from './calls-fixture.mjs';
const root=path.resolve('dist'),types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=http.createServer(async(req,res)=>{try{const name=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--autoplay-policy=user-gesture-required']});
const transport=createFixture(3),fixture=callFixture(transport),contexts=[],errors=[],results=[];
async function client(user){const context=await browser.newContext({viewport:{width:390,height:844},permissions:['microphone'],serviceWorkers:'block'});contexts.push(context);await transport.install(context);await fixture.install(context);await context.addInitScript(()=>{
 window.peers=[];const RealPeer=window.RTCPeerConnection;window.RTCPeerConnection=class extends RealPeer{constructor(...args){super(...args);peers.push(this)}};Object.defineProperty(document,'hidden',{configurable:true,value:false});window.toneCount=0;window.mediaStreams=[];
 const oscillator=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(...args){toneCount++;return oscillator.apply(this,args)};
 const media=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async opts=>{const s=await media(opts);mediaStreams.push(s);return s};
 });const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);await page.locator('#email').fill(user.email);await page.locator('#password').fill('test-password-only');await page.getByRole('button',{name:'Enter our universe',exact:true}).click();await page.locator('#message-input').waitFor();return page}
async function check(name,fn){await fn();results.push(name);console.log('PASS '+name)}
async function hidden(page,value){await page.evaluate(value=>{Object.defineProperty(document,'hidden',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'))},value)}
async function start(page){await page.getByRole('button',{name:'Start voice call',exact:true}).click()}
async function label(page,text){await page.locator('.call-state').filter({hasText:text}).waitFor({timeout:18000})}
async function tracksEnded(page){await page.waitForFunction(()=>mediaStreams.every(s=>s.getTracks().every(t=>t.readyState==='ended')))}
try{
 const a=await client(users[0]),b=await client(users[1]);
 await check('caller stays silent; an online recipient hears an incoming ringtone and caller sees Ringing',async()=>{
  await b.locator('.mobile-spaces [data-action=space-settings]').click();await b.getByRole('button',{name:'Enable incoming ringtone',exact:true}).click();await b.locator('.mobile-spaces [data-action=space-chat]').click();await start(a);await label(b,'Incoming voice call');await label(a,'Ringing');await b.waitForFunction(()=>toneCount>0);assert.equal(await a.evaluate(()=>toneCount),0);assert.equal(await b.evaluate(()=>mediaStreams.length),0,'Incoming calls must not open the microphone before acceptance');
 });
 await check('acceptance establishes real two-way WebRTC audio; mute and hang-up release both microphones',async()=>{
  await b.getByRole('button',{name:'Accept',exact:true}).click();await label(a,'Connected');await label(b,'Connected');
  for(const p of [a,b])assert(await p.evaluate(()=>[...document.querySelectorAll('audio')].some(a=>a.srcObject?.getAudioTracks().some(t=>t.readyState==='live'))));
  await a.getByRole('button',{name:'Mute microphone',exact:true}).click();assert(await a.evaluate(()=>mediaStreams.at(-1).getAudioTracks().every(t=>!t.enabled)));await a.getByRole('button',{name:'Unmute microphone',exact:true}).click();assert(await a.evaluate(()=>mediaStreams.at(-1).getAudioTracks().every(t=>t.enabled)));
  await a.getByRole('button',{name:'End call',exact:true}).click();await label(b,'Call ended');await tracksEnded(a);await tracksEnded(b);assert.equal(await a.evaluate(()=>toneCount),0);
 });
 await check('a hidden recipient receives the invitation while the caller sees Calling; foreground acknowledgement changes it to Ringing',async()=>{
  await hidden(b,true);await start(a);await label(b,'Incoming voice call');await label(a,'Calling');await hidden(b,false);await label(a,'Ringing');await b.getByRole('button',{name:'Decline',exact:true}).click();await label(a,'Call declined');await tracksEnded(a);
 });
 await check('only one of two recipient devices can answer; the other releases its microphone',async()=>{
  await start(a);await label(b,'Incoming voice call');const c=await client(users[1]);await label(c,'Incoming voice call');await Promise.all([b.getByRole('button',{name:'Accept',exact:true}).click(),c.getByRole('button',{name:'Accept',exact:true}).click()]);await label(a,'Connected');await b.waitForTimeout(700);const connectedB=await b.locator('.call-state').innerText(),connectedC=await c.locator('.call-state').innerText();assert.equal([connectedB,connectedC].filter(t=>t.startsWith('Connected')).length,1);await tracksEnded(connectedB.startsWith('Connected')?c:b);await a.getByRole('button',{name:'End call',exact:true}).click();await tracksEnded(a);await tracksEnded(b);await tracksEnded(c);await c.context().close();
 });
 await check('a cancelled invitation stops the recipient ringtone and never acquires their microphone',async()=>{
  const count=await b.evaluate(()=>mediaStreams.length);await start(a);await label(b,'Incoming voice call');await a.getByRole('button',{name:'Cancel call',exact:true}).click();await label(b,'Call ended');const before=await b.evaluate(()=>toneCount);await b.waitForTimeout(3200);assert.equal(await b.evaluate(()=>toneCount),before);assert.equal(await b.evaluate(()=>mediaStreams.length),count);await tracksEnded(a);
 });
 await check('an expired incoming invitation cannot be answered and releases the caller microphone',async()=>{
  await start(a);await label(b,'Incoming voice call');fixture.expire();await label(a,'No answer');await label(b,'No answer');assert.equal(await b.getByRole('button',{name:'Accept',exact:true}).count(),0);await tracksEnded(a);
 });
 await check('a microphone permission granted after cancel is stopped and creates no call',async()=>{
  const count=fixture.calls.size;await a.evaluate(()=>{window.originalMicrophone=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.allowMicrophone=resolve)});await start(a);await a.getByRole('button',{name:'End call',exact:true}).click();await a.evaluate(async()=>{const stream=await originalMicrophone({audio:true});allowMicrophone(stream);navigator.mediaDevices.getUserMedia=originalMicrophone});await tracksEnded(a);assert.equal(fixture.calls.size,count);
 });
 await check('permission denial is explained and the next call can be retried',async()=>{
  await a.evaluate(()=>{window.originalMicrophone=navigator.mediaDevices.getUserMedia;navigator.mediaDevices.getUserMedia=async()=>{throw new DOMException('Denied','NotAllowedError')}});await start(a);await label(a,'Microphone access is blocked');await a.evaluate(()=>navigator.mediaDevices.getUserMedia=originalMicrophone);await start(a);await label(b,'Incoming voice call');await b.getByRole('button',{name:'Decline',exact:true}).click();await tracksEnded(a);
 });
 await check('cancelling while call creation is in flight ends the server invitation and ignores the late acknowledgement',async()=>{
  fixture.setStartDelay(700);await start(a);await label(b,'Incoming voice call');await a.getByRole('button',{name:'Cancel call',exact:true}).click();await label(b,'Call ended');await a.waitForTimeout(900);assert.equal([...fixture.calls.values()].at(-1).state,'ended');assert.equal(await b.getByRole('button',{name:'Accept',exact:true}).count(),0);await tracksEnded(a);fixture.setStartDelay(0);
 });
 await check('connected audio and its signaling survive the chat connection pausing after 30 seconds in the background',async()=>{
  await start(a);await label(b,'Incoming voice call');await b.getByRole('button',{name:'Accept',exact:true}).click();await label(a,'Connected');await hidden(a,true);await hidden(b,true);await a.waitForTimeout(32000);await label(a,'Connected');await label(b,'Connected');for(const p of [a,b])assert(await p.evaluate(async()=>{const pc=peers.at(-1),stats=await pc.getStats();return [...stats.values()].some(s=>s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0)}));await hidden(a,false);await hidden(b,false);await a.getByRole('button',{name:'End call',exact:true}).click();await label(b,'Call ended');await tracksEnded(a);await tracksEnded(b);
 });
 await check('signing out during a call releases local media and ends it for the recipient',async()=>{
  await start(a);await label(b,'Incoming voice call');await b.getByRole('button',{name:'Accept',exact:true}).click();await label(a,'Connected');await a.getByRole('button',{name:'Minimize call controls',exact:true}).click();await a.locator('.mobile-spaces [data-action=space-settings]').click();await a.locator('.settings-footer').getByRole('button',{name:'Sign out of this device',exact:true}).click();await a.locator('#login-form').waitFor();await tracksEnded(a);await label(b,'Call ended');await tracksEnded(b);assert.equal(await a.locator('.call-panel').count(),0);
 });
 assert.deepEqual(errors,[]);await mkdir('work',{recursive:true});await writeFile('work/calls-report.json',JSON.stringify({passed:true,results,errors},null,2));
}catch(error){for(const [i,c] of contexts.entries())for(const p of c.pages())if(!p.isClosed()){console.log('Client',i,(await p.locator('body').innerText()).slice(-1600));console.log('Peers',await p.evaluate(()=>peers.map(pc=>({state:pc.connectionState,ice:pc.iceConnectionState,local:pc.localDescription?.type,remote:pc.remoteDescription?.type,gathering:pc.iceGatheringState}))));await mkdir('work',{recursive:true});await p.screenshot({path:'work/call-failure-'+i+'.png'})}console.log('Signal count',fixture.signals.length,fixture.signals.map(s=>({sender:s.sender,type:s.payload.candidate.candidate?.split(' typ ')[1]?.split(' ')[0]})));console.log('Call states',[...fixture.calls.values()].map(c=>({id:c.id,state:c.state})));console.log('Recent call requests',fixture.requests.slice(-6).map(r=>({path:r.path,action:r.body.action})));throw error}
finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();server.close()}
