import test from 'node:test';
import assert from 'node:assert/strict';
import {newProject,newIssue,validProject,validProjectConfig,validateProjectLinks,statusPatch,sprintReport,closeSprint,reorderIssue,timelineModel,removeProject} from '../src/canvas/projects/projectModel.js';
const board=()=>({...newProject(),x:0,y:0,permission:'team'});
const issue=(id,patch={})=>({id,...newIssue('b'),...patch});
test('project schema validates dates, sprint lifecycle, hierarchy requirements and bounds',()=>{
 const b=board(),i=newIssue('b');assert.ok(validProject(b));assert.ok(validProject(i));assert.equal(validProject({...i,projectDue:'2026-02-30'}),false);assert.equal(validProject({...i,projectStart:'2026-11-11',projectDue:'2026-11-10'}),false);assert.equal(validProject({...i,projectIssueType:'Sub-task'}),false);assert.equal(validProject({...i,projectPoints:2**40}),false);assert.equal(validProjectConfig({...b.projectConfig,statuses:[]}),false);
 const sprint={id:'s',title:'Sprint',start:'2026-11-10',end:'2026-11-24',goal:'Ship',state:'active'};assert.equal(validProjectConfig({...b.projectConfig,sprints:[sprint,{...sprint,id:'s2'}]}),false);
});
test('dependencies reject cycles/cross-board links while accepting a shared DAG',()=>{
 const records={b:board(),a:issue('a'),c:issue('c',{projectDependencies:['a']}),d:issue('d',{projectDependencies:['a','c']})};assert.doesNotThrow(()=>validateProjectLinks(records,'d'));records.a.projectDependencies=['d'];assert.throws(()=>validateProjectLinks(records,'a'),/순환/);records.a.projectDependencies=[];records.c.projectBoard='other';assert.throws(()=>validateProjectLinks(records,'d'),/같은/);
});
test('Epic, Story and Sub-task form a validated hierarchy',()=>{
 const r={b:board(),epic:issue('epic',{projectIssueType:'Epic'}),story:issue('story',{projectIssueType:'Story',projectParent:'epic'}),sub:issue('sub',{projectIssueType:'Sub-task',projectParent:'story'})};assert.doesNotThrow(()=>validateProjectLinks(r,'sub'));r.epic.projectParent='story';assert.throws(()=>validateProjectLinks(r,'epic'));
});
test('approval requests do not change canonical status until an administrator accepts',()=>{
 const b=board();b.projectConfig.statuses[2].approval=true;assert.deepEqual(statusPatch(b,issue('a'),'done',false),{projectStatus:'todo',projectRequestedStatus:'done'});assert.deepEqual(statusPatch(b,issue('a'),'done',true),{projectStatus:'done',projectRequestedStatus:''});
});
test('sprint close records a stable result and returns incomplete work to backlog',()=>{
 const b=board();b.projectConfig.sprints=[{id:'s',title:'S',start:'2026-11-10',end:'2026-11-24',goal:'',state:'active'}];const issues=[issue('a',{projectSprint:'s',projectStatus:'done',projectPoints:3}),issue('c',{projectSprint:'s',projectPoints:5})];const p=closeSprint(b,issues,'s');assert.equal(p.board.projectConfig.sprints[0].state,'closed');assert.equal(p.changes.c.projectSprint,'');p.changes.a.projectPoints=100;p.changes.c.projectStatus='done';assert.deepEqual(sprintReport(Object.values(p.changes),'s'),{count:2,done:1,planned:8,completed:3,remaining:1,rate:50});assert.throws(()=>closeSprint(p.board,issues,'s'));
});
test('backlog reorder, roadmap range, and deletion preserve consistent links',()=>{
 const rows=[issue('a',{projectRank:100}),issue('b',{projectRank:200}),issue('c',{projectRank:300})];assert.equal(reorderIssue(rows,'c','b'),150);assert.equal(reorderIssue(rows,'a'),1324);
 const t=timelineModel([issue('a',{projectStart:'2026-11-10',projectDue:'2026-11-17'})],[{date:'2026-11-20'}]);assert.equal(t.days,11);assert.equal(t.offset('2026-11-12'),2);
 const r={b:board(),a:issue('a'),sub:issue('sub',{projectParent:'a',projectIssueType:'Sub-task'}),other:issue('other',{projectDependencies:['a']})};const p=removeProject(r,'a');assert.deepEqual(new Set(p.removed),new Set(['a','sub']));assert.deepEqual(p.changes.other.projectDependencies,[]);assert.equal(removeProject(r,'b').removed.length,4);
});
test('clipboard remaps project ownership, parents and dependencies before bounded creation',async()=>{
 const {captureObjects,preparePaste}=await import('../src/canvas/clipboard/objectClipboard.js');
 const r={b:board(),a:newIssue('b'),c:{...newIssue('b'),projectParent:'a',projectIssueType:'Sub-task',projectDependencies:['a']}};for(const item of Object.values(r)){item.x=0;item.y=0;}
 const copy=captureObjects(r,['b','a','c'],'1');const plan=preparePaste(copy.text,{},'2','team',{x:0,y:0});assert.equal(plan.creates.length,3);const [b,a,c]=plan.creates;assert.equal(b.item.projectType,'board');assert.equal(a.item.projectBoard,b.id);assert.equal(c.item.projectParent,a.id);assert.deepEqual(c.item.projectDependencies,[a.id]);
 const issueOnly=captureObjects(r,['a'],'1');assert.equal(preparePaste(issueOnly.text,{},'2','team',{x:0,y:0}).creates.length,0);
});
