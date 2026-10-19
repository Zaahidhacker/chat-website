import test from 'node:test';import assert from 'node:assert/strict';import {createReceiptScheduler} from '../src/scheduling.js';
test('scroll bursts coalesce and unchanged receipts stay silent until heartbeat',async()=>{
 let at=0,queued,requests=[];const s=createReceiptScheduler(async v=>requests.push(v),{now:()=>at,setTimer:fn=>{queued=fn;return 1},clearTimer:()=>{}});
 for(let i=0;i<100;i++)s.request(10,10);await queued();assert.equal(requests.length,1);
 at=1000;s.request(10,10);await queued();assert.equal(requests.length,1);
 at=1500;s.request(11,0);await queued();assert.deepEqual(requests[1],{delivered:11,seen:10});
 at=32000;s.request(11,10);await queued();assert.equal(requests.length,3);s.close();
});
test('newly delivered messages remain unread while browsing older history',async()=>{const requests=[];const s=createReceiptScheduler(async v=>requests.push(v),{setTimer:()=>1,clearTimer:()=>{}});s.request(120,100);await s.flush();assert.deepEqual(requests,[{delivered:120,seen:100}]);s.close()});
test('failed receipt is retried, and pending receipts stop on signout',async()=>{let fail=true,n=0;const s=createReceiptScheduler(async()=>{n++;if(fail)throw Error('offline')},{setTimer:()=>1,clearTimer:()=>{}});s.request(4,4);await s.flush();fail=false;s.request(4,4);await s.flush();assert.equal(n,2);s.close();s.request(5,5);await s.flush();assert.equal(n,2)});
