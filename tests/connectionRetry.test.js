import test from 'node:test';
import assert from 'node:assert/strict';
import { retryableConnectionError } from '../src/canvas/connectionRetry.js';
test('temporary initial API/network failures retry while authorization and configuration errors stop',()=>{
 for(const status of [429,500,502,503,504])assert.equal(retryableConnectionError({status}),true);
 assert.equal(retryableConnectionError(new TypeError('Failed to fetch')),true);
 for(const status of [400,401,403,404])assert.equal(retryableConnectionError({status}),false);
 assert.equal(retryableConnectionError(new Error('Invalid WSS origin')),false);
});
