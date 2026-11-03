import test from 'node:test';import assert from 'node:assert/strict';
import {createSessionStorage} from '../src/session-storage.js';
const store=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}};
test('remember choice moves auth between stores and native changes remain visible',()=>{
 const a=store(),b=store();let remember=true;const storage=createSessionStorage({local:()=>a,session:()=>b,remember:()=>remember});
 storage.setItem('auth','first');assert.equal(a.getItem('auth'),'first');assert.equal(b.getItem('auth'),null);
 remember=false;storage.setItem('auth','private');assert.equal(a.getItem('auth'),null);assert.equal(b.getItem('auth'),'private');
 b.setItem('auth','refreshed');assert.equal(storage.getItem('auth'),'refreshed');storage.removeItem('auth');assert.equal(storage.getItem('auth'),null);
});
test('blocked storage keeps an in-memory session and signs out safely',()=>{
 const blocked=()=>{throw Error('SecurityError')};const storage=createSessionStorage({local:blocked,session:blocked});
 assert.equal(storage.getItem('auth'),null);storage.setItem('auth','token');assert.equal(storage.getItem('auth'),'token');storage.removeItem('auth');assert.equal(storage.getItem('auth'),null);
});
test('unchecked remember never persists auth when session storage is full',()=>{
 const local=store(),session=store();session.setItem=()=>{throw Error('QuotaExceededError')};
 const storage=createSessionStorage({local:()=>local,session:()=>session,remember:()=>false});storage.setItem('auth','private');assert.equal(storage.getItem('auth'),'private');assert.equal(local.getItem('auth'),null);
});
test('blocked session reads still allow remembered local auth',()=>{
 const local=store();local.setItem('auth','remembered');const storage=createSessionStorage({local:()=>local,session:()=>{throw Error('blocked')}});assert.equal(storage.getItem('auth'),'remembered');
});
test('failed removal cannot resurrect an old token in the current tab',()=>{
 const local=store(),session=store();local.setItem('auth','stale');local.removeItem=()=>{throw Error('blocked')};const storage=createSessionStorage({local:()=>local,session:()=>session,remember:()=>false});
 storage.setItem('auth','new');assert.equal(storage.getItem('auth'),'new');storage.removeItem('auth');assert.equal(storage.getItem('auth'),null);
});
