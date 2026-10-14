import test from 'node:test';
import assert from 'node:assert/strict';
import { SocketSendBudget } from '../src/canvas/socketSendBudget.js';
test('rolling send budget reserves capacity for host data and resumes without dropping accepted requests',()=>{
 const sent=[],socket={readyState:1,bufferedAmount:0,send:message=>sent.push(message)},budget=new SocketSendBudget();
 for(let i=0;i<140;i++)assert.equal(budget.send(socket,{payload:{type:'cursor'}},999),true);
 assert.equal(budget.send(socket,{payload:{type:'cursor'}},1000),false,'crossing a second boundary cannot double the burst');
 for(let i=0;i<40;i++)assert.equal(budget.send(socket,{payload:{type:'host_commit'}},1000),true);
 assert.equal(budget.send(socket,{payload:{type:'host_commit'}},1001),false);
 assert.equal(budget.send(socket,{payload:{type:'host_commit'}},1999),true);
 socket.bufferedAmount=300*1024;
 assert.equal(budget.send(socket,{toJSON(){throw Error('blocked payload must not be serialized')}},2000),false);
 socket.bufferedAmount=0;assert.equal(budget.send(socket,{payload:{type:'host_commit'}},2001),true);
 assert.equal(sent.length,182);
});
