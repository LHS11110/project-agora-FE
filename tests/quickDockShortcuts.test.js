import test from 'node:test';
import assert from 'node:assert/strict';
import {QUICK_DOCK_TOOLS,quickDockShortcutTool,isQuickDockEditingTarget} from '../src/canvas/quickDockShortcuts.js';
const key=(digit,extra={})=>({key:String(digit),code:'Digit'+digit,ctrlKey:true,...extra});
test('number shortcuts follow the visible tool order; 0 is tenth and Shift reaches remaining tools',()=>{
 assert.equal(quickDockShortcutTool(key(1)),'select');assert.equal(quickDockShortcutTool(key(2)),'hand');assert.equal(quickDockShortcutTool(key(3)),'pen');
 assert.equal(quickDockShortcutTool(key(4)),'eraser');assert.equal(quickDockShortcutTool(key(5)),'laser');assert.equal(quickDockShortcutTool(key(6)),'note');assert.equal(quickDockShortcutTool(key(7)),'shape');assert.equal(quickDockShortcutTool(key(8)),'connect');assert.equal(quickDockShortcutTool(key(9)),'text');assert.equal(quickDockShortcutTool(key(0)),'table');
 assert.equal(quickDockShortcutTool(key(1,{shiftKey:true,key:'!'})),'chart');assert.equal(quickDockShortcutTool(key(2,{shiftKey:true,key:'@'})),'image');assert.equal(QUICK_DOCK_TOOLS.length,12);
});
test('plain numbers, IME, AltGr and unrelated modifier combinations never change tools',()=>{
 for(const extra of [{ctrlKey:false},{altKey:true},{isComposing:true},{shiftKey:true,code:'Digit3',key:'#'},{code:'KeyQ'}])assert.equal(quickDockShortcutTool(key(1,extra)),null);
 assert.equal(quickDockShortcutTool(key(2,{ctrlKey:false,metaKey:true})),'hand');
 assert.equal(quickDockShortcutTool(key(3,{code:'Numpad3'})),'pen');assert.equal(quickDockShortcutTool(key(1,{code:'Numpad1',key:'End'})),null);
});
test('editable fields and modal/menu content are excluded',()=>{
 assert.equal(isQuickDockEditingTarget({isContentEditable:true}),true);assert.equal(isQuickDockEditingTarget({closest:()=>({})}),true);assert.equal(isQuickDockEditingTarget({closest:()=>null}),false);
});
