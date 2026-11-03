import test from 'node:test';import assert from 'node:assert/strict';import {createPresence} from '../src/live-presence.js';
test('presence serializes visibility changes and retracks after a reconnect during an unacknowledged update',async()=>{
 const saved=Object.fromEntries(['document','window','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));const doc=new EventTarget(),win=new EventTarget();doc.hidden=false;
 for(const [k,v] of Object.entries({document:doc,window:win,navigator:{onLine:true}}))Object.defineProperty(globalThis,k,{configurable:true,value:v});
 let status,sync,finishFirst,tracks=0,untracks=0,removed=0,leaves=0,options,me={share_presence:true},state={};let controller;
 const room={on(_type,_filter,fn){sync=fn;return this},subscribe(fn){status=fn;return this},track(){tracks++;return tracks===1?new Promise(r=>finishFirst=r):Promise.resolve('ok')},untrack(){untracks++;return Promise.resolve('ok')},presenceState:()=>state};
 const tick=()=>new Promise(r=>setImmediate(r));
 try{
  controller=createPresence({channel(_name,o){options=o;return room},rpc(){leaves++;return Promise.resolve({})},removeChannel(){removed++}},{userId:'me',member:()=>me,onChange:()=>{}});
  status('SUBSCRIBED');assert.equal(tracks,1);assert.equal(options.config.private,true);assert.equal(controller.online('partner'),false);
  status('CHANNEL_ERROR');status('SUBSCRIBED');finishFirst('ok');await tick();assert.equal(tracks,2);
  state={partner:[{active:true}]};sync();assert.equal(controller.online('partner'),true);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(untracks,1);assert.equal(leaves,1);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(tracks,3);
  me.share_presence=false;controller.reconcile();await tick();assert.equal(untracks,2);
  controller.close();assert.equal(removed,1);assert.equal(controller.online('partner'),false);doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(untracks,2);
 }finally{controller?.close();for(const [k,d]of Object.entries(saved)){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k]}}
});
