import test from 'node:test';import assert from 'node:assert/strict';import {containsThreeHearts,createSecretGate,SECRET_LEAD} from '../src/heart-secret-policy.js';
const now=1800000000000,message=(id='one')=>({id,body:'For you ❤️❤️❤️ always',created_at:new Date(now).toISOString(),edited_at:null,deleted:false});
test('only a complete run of exactly three red heart emoji triggers, including within text',()=>{
 for(const body of ['❤️❤️❤️','Hey ❤️❤️❤️ love','❤️❤️❤️ ❤️❤️❤️','🩷❤️❤️❤️💕'])assert(containsThreeHearts(body),body);
 for(const body of ['',null,'❤️❤️','❤️❤️❤️❤️','❤️❤️❤️❤️❤️❤️','❤️ ❤️ ❤️','❤❤❤','❤️❤️❤️❤','❤️❤️❤️‍🔥','❤️‍🔥❤️❤️','💖💖💖'])assert.equal(containsThreeHearts(body),false,String(body));
});
test('confirmation gate ignores edits, deletion, failed sends, history and invalid times',()=>{
 const gate=createSecretGate({now:()=>now});for(const patch of [{pending:true},{failed:true},{deleted:true},{edited_at:new Date(now).toISOString()},{created_at:new Date(now-9000).toISOString()},{created_at:new Date(now+5000).toISOString()},{created_at:'invalid'}])assert.equal(gate.accept({...message(),...patch},'zaahid'),null);assert.equal(gate.accept(message(),null),null);assert(gate.accept(message(),'zaahid'));
});
test('message IDs deduplicate acknowledgement, repeated events and reloads per account',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},options={now:()=>now,storage};let gate=createSecretGate(options);assert(gate.accept(message(),'zaahid'));assert.equal(gate.accept(message(),'zaahid'),null);gate=createSecretGate(options);assert.equal(gate.accept(message(),'zaahid'),null);assert(gate.accept(message(),'layaana'));assert.equal(gate.accept(message(),'zaahid'),null);assert(gate.accept(message('two'),'zaahid'));assert(!JSON.stringify([...map.values()]).includes('For you'));
});
test('both clients derive the same timeline despite different delivery times',()=>{
 const a=createSecretGate({now:()=>now+100}),b=createSecretGate({now:()=>now+1200});assert.equal(a.accept(message(),'a').startAt,b.accept(message(),'b').startAt);assert.equal(createSecretGate({now:()=>now}).accept(message(),'a').startAt,now+SECRET_LEAD);
});
test('dedup remains bounded and works without browser storage',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)},gate=createSecretGate({now:()=>now,storage});for(let i=0;i<200;i++)gate.accept(message(String(i)),'a');assert.equal(JSON.parse([...map.values()][0]).length,128);const privateGate=createSecretGate({now:()=>now,storage:{getItem(){throw Error()},setItem(){throw Error()}}});assert(privateGate.accept(message(),'a'));assert.equal(privateGate.accept(message(),'a'),null);
});
