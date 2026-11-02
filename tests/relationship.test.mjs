import test from 'node:test';import assert from 'node:assert/strict';import {relationshipDays} from '../src/relationship.js';
test('relationship counter follows Sri Lankan calendar midnights',()=>{
 assert.equal(relationshipDays('2026-09-26T18:30:00Z'),0);
 assert.equal(relationshipDays('2026-09-27T18:29:59Z'),0);
 assert.equal(relationshipDays('2026-09-27T18:30:00Z'),1);
 assert.equal(relationshipDays('2026-11-02T18:29:59Z'),36);
 assert.equal(relationshipDays('2026-11-02T18:30:00Z'),37);
 assert.equal(relationshipDays('2026-11-03T00:00:00+05:30'),37);
 assert.equal(relationshipDays('2026-09-01T00:00:00Z'),0);
});
