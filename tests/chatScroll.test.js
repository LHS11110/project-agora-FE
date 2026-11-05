import test from 'node:test';
import assert from 'node:assert/strict';
import {isNearLatest} from '../src/canvas/comments/useLatestMessages.js';
import {CHAT_HISTORY_LIMIT} from '../src/canvas/canvasChat.js';
test('chat follows only inside a one-message fraction of the content height',()=>{
 assert.equal(CHAT_HISTORY_LIMIT,10);
 assert.equal(isNearLatest(1000,200,790,100),true);
 assert.equal(isNearLatest(1000,200,788,100),false);
 // Total server history, rather than the ten messages currently loaded.
 assert.equal(isNearLatest(1000,200,780,100),false);
 assert.equal(isNearLatest(1000,200,780,10),true);
 assert.equal(isNearLatest(1000,200,800,100000),true);
 assert.equal(isNearLatest(100,200,0,0),true);
});
