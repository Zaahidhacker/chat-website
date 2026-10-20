import test from 'node:test';import assert from 'node:assert/strict';import {resilientFetch} from '../src/connection.js';
test('transport retries a read once and respects explicit aborts and non-idempotent Request methods',async()=>{
 const originalFetch=globalThis.fetch,descriptor=Object.getOwnPropertyDescriptor(globalThis,'navigator');Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 try{let calls=0;globalThis.fetch=async()=>{if(++calls===1)throw new TypeError('Failed to fetch');return new Response('ok')};assert.equal(await(await resilientFetch('https://example.invalid/rest/v1/messages')).text(),'ok');assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;throw new TypeError('Failed to fetch')};await assert.rejects(resilientFetch(new Request('https://example.invalid/rest/v1/universe_reactions',{method:'POST',body:'{}'})));assert.equal(calls,1);
 const controller=new AbortController();controller.abort();calls=0;await assert.rejects(resilientFetch('https://example.invalid/rest/v1/messages',{signal:controller.signal}));assert.equal(calls,1);
 }finally{globalThis.fetch=originalFetch;if(descriptor)Object.defineProperty(globalThis,'navigator',descriptor);else delete globalThis.navigator}
});
