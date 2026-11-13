import test from 'node:test';import assert from 'node:assert/strict';import {contextualSnippet} from '../src/canvas/completions/snippetContext.js';
const cout='std::cout << ${1:value} << std::endl;$0';
test('C++ cout completion keeps exactly one std qualifier',()=>{for(const before of ['std::','  std::','::std::','  std :: '])assert.equal(contextualSnippet('cpp',before,cout),'cout << ${1:value} << std::endl;$0');assert.equal(contextualSnippet('cpp','  ',cout),cout);});
test('statement snippets do not apply to unrelated members and namespaces',()=>{for(const before of ['other::','value.','pointer->'])assert.equal(contextualSnippet('cpp',before,cout),null);assert.equal(contextualSnippet('python','std::','print($0)'),'print($0)');});
