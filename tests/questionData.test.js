import test from 'node:test';
import assert from 'node:assert/strict';
import {newQuestion,validQuestion,questionDefinitionPatch,questionSubmissionPatch,questionGradePatch} from '../src/canvas/questions/questionData.js';
import {planManifest,exportManifest} from '../src/canvas/asCode/manifest.js';
const question=()=>({...newQuestion(),questionPrompt:'2 + 2 = ?',questionOptions:['3','4'],kind:'question',x:0,y:0,width:.28,height:.4,permission:'default'});
test('choice/subjective questions submit shared answers and require manual grading of the same revision',()=>{
 let q=question();assert.equal(validQuestion(q),true);q={...q,...questionSubmissionPatch('1')};assert.equal(validQuestion(q),true);assert.equal(q.questionScore,-1);
 q={...q,...questionGradePatch(q,8.5,'Check your work')};assert.equal(validQuestion(q),true);
 const stale=questionGradePatch(q,10,'old grade');q={...q,...questionSubmissionPatch('0')};assert.equal(q.questionScore,-1);assert.equal(q.questionFeedback,'');assert.equal(validQuestion({...q,...stale}),false);
 q={...q,...questionDefinitionPatch({...q,questionType:'short-answer',questionPrompt:'Explain'})};assert.equal(q.questionAnswer,'');assert.equal(q.questionSubmitted,false);
 q={...q,...questionSubmissionPatch('An explanation'),...{questionScore:-1}};assert.equal(validQuestion(q),true);assert.equal(validQuestion({...q,...questionGradePatch(q,10,'Good')}),true);
});
test('rejects invalid types, empty submissions, invalid choices and out of range scores',()=>{
 const q=question();
 for(const patch of [{questionType:'auto'},{questionOptions:['only']},{questionOptions:Array(11).fill('x')},{questionSubmitted:true},{questionAnswer:'2'},{questionAnswer:'01'},{questionScore:11},{questionMaxScore:0},{questionPrompt:'x'.repeat(4001)},{questionAnswer:'x'.repeat(8001)},{questionFeedback:'x'.repeat(2001)},{questionSubmitted:'yes'},{questionVersion:''}])assert.equal(validQuestion({...q,...patch}),false,JSON.stringify(patch));
});
test('question fields survive canvas manifest import/export and bad data fails before mutation',()=>{
 const q=question();const exported=exportManifest({q});const plan=planManifest(exported,{});assert.equal(plan.creates[0].item.questionType,'choice');assert.deepEqual(plan.creates[0].item.questionOptions,['3','4']);
 exported.items.q.questionScore=100;assert.throws(()=>planManifest(exported,{}),/문제/);
});

test('a graded written answer can become an unsubmitted choice draft without prior options',()=>{
 let q={...question(),questionType:'short-answer',questionOptions:['','']};
 q={...q,...questionSubmissionPatch('written answer')};q={...q,...questionGradePatch(q,7,'feedback')};
 const previous=q.questionVersion;q={...q,...questionDefinitionPatch({...q,questionType:'choice'})};
 assert.equal(validQuestion(q),true);assert.equal(q.questionType,'choice');assert.deepEqual(q.questionOptions,['','']);assert.equal(q.questionAnswer,'');assert.equal(q.questionScore,-1);assert.equal(q.questionFeedback,'');assert.equal(q.questionSubmitted,false);assert.notEqual(q.questionVersion,previous);
 assert.equal(validQuestion({...q,...questionSubmissionPatch('0')}),false,'empty options cannot be submitted');
});
