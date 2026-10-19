import test from 'node:test';import assert from 'node:assert/strict';import {boundMessages,visibleMessages} from '../src/logic.js';
const history=Array.from({length:10000},(_,i)=>({id:String(i),seq:i+1,created_at:'2026-01-01T00:00:00Z'}));
test('ten thousand messages retain a bounded two-hundred-message latest window',()=>{const result=boundMessages(history);assert.equal(result.length,200);assert.equal(result[0].seq,9801);assert.equal(result.at(-1).seq,10000)});
test('browsing old history retains the oldest window without losing a failed send',()=>{const result=boundMessages([...history,{id:'retry',seq:10001,failed:true,created_at:'2026-01-02'}],{older:true});assert.equal(result.length,201);assert.equal(result[0].seq,1);assert.equal(result.at(-1).id,'retry')});
test('unconfirmed messages remain visible above the clear boundary',()=>{assert.deepEqual(visibleMessages([{id:'failed',seq:1,failed:true,created_at:'2026'}],100).map(m=>m.id),['failed'])});
