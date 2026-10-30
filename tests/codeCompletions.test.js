import test from 'node:test';
import assert from 'node:assert/strict';
import {snippetPreview,vocabularyPresentation} from '../src/canvas/completions/presentation.js';
import {registerModelCompletions} from '../src/canvas/completions/registerModelCompletions.js';

test('snippet preview resolves repeated placeholders without insertion markers',()=>{
 assert.equal(snippetPreview('for (int ${1:i}=0; $1<${2:count}; $1++) {\n\t$0\n}'),'for (int i=0; i<count; i++) {\n\t\n}');
 assert.equal(snippetPreview('print(${1:value})$0'),'print(value)');
 assert.equal(snippetPreview('${1:\\$items} as ${2:\\$item}'),'$items as $item');
});
test('completion presentation separates snippets, keywords and local names without duplicate print',()=>{
 let provider;const monaco={languages:{CompletionItemKind:{Snippet:28,Keyword:17,Text:18,Function:1,Class:5},CompletionItemInsertTextRule:{InsertAsSnippet:4},registerCompletionItemProvider:(_selector,value)=>{provider=value;return {dispose(){}};}}};
 const model={uri:{path:'/one/snippet'},getWordUntilPosition:()=>({word:'pr',startColumn:1,endColumn:3}),getVersionId:()=>1,getLineCount:()=>2,getLineMaxColumn:()=>20,getValueInRange:()=> 'def prepare_report(): pass\npr'};
 registerModelCompletions(monaco,model,()=> 'python');
 const result=provider.provideCompletionItems(model,{lineNumber:2,column:3},{},{isCancellationRequested:false}).suggestions;
 assert.equal(result.filter(item=>item.label.label==='print').length,1);
 const print=result.find(item=>item.label.label==='print');assert.equal(print.kind,28);assert.equal(print.label.detail,'(value)');assert.match(print.documentation.value,/print\(value\)/);assert.equal(print.documentation.isTrusted,false);
 assert.equal(result.find(item=>item.label.label==='prepare_report').kind,1);
 assert.deepEqual(provider.provideCompletionItems({}, {}, {}, {isCancellationRequested:false}).suggestions,[]);
 assert.deepEqual(provider.provideCompletionItems(model, {}, {}, {isCancellationRequested:true}).suggestions,[]);
});

test('known built-ins have meaningful function, type and namespace categories',()=>{
 assert.equal(vocabularyPresentation('python','len').kind,'Function');
 assert.equal(vocabularyPresentation('python','list').kind,'Class');
 assert.equal(vocabularyPresentation('java','List').kind,'Interface');
 assert.equal(vocabularyPresentation('cpp','std').kind,'Module');
 assert.equal(vocabularyPresentation('python','return').kind,'Keyword');
});
