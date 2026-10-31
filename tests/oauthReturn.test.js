import test from 'node:test';import assert from 'node:assert/strict';
import {oauthReturnPath} from '../src/auth/oauthReturn.js';
test('OAuth return locations accept local canvas paths and reject external URLs or callback loops',()=>{
 for(const value of [null,'https://evil.example','//evil.example','/\\evil.example','/login','/login?oauth=success','/search\n'])assert.equal(oauthReturnPath(value),'/search');
 assert.equal(oauthReturnPath('/canvases/2009'),'/canvases/2009');
 assert.equal(oauthReturnPath('/docs?section=auth'),'/docs?section=auth');
});
