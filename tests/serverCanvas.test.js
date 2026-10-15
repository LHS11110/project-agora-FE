import test from 'node:test';
import assert from 'node:assert/strict';
import { ServerCanvasSession } from '../src/canvas/sync/ServerCanvasSession.js';
const box = {kind:'shape',x:0,y:0,width:1,height:1,permission:'default'};
function client(items={box}, revision=0) {
  const sent=[], views=[], errors=[];
  const session=new ServerCanvasSession({available:()=>true,send:m=>{sent.push(structuredClone(m));return true;},
    publish:(items,touched)=>views.push({items,touched}),status:()=>{},reject:m=>errors.push(m)});
  session.seed(items,{sync_protocol:2,revision,accepted_count:0});
  return {session,sent,views,errors};
}
const commit=(session, flight, revision, extra={})=>session.receiveServer({type:'canvas_commit',client_id:flight.client_id,request_count:flight.request_count,request_id:flight.request_id,revision,...extra});
test('edits are sent without RTC membership, election or a host',()=>{
  const {session,sent}=client();
  assert.equal(session.editable,true);session.submit([{action:'patch',id:'box',patch:{x:2}}]);session.tick();
  assert.equal(sent[0].type,'canvas_ops');assert.equal(sent[0].request_count,1);
  assert.deepEqual(sent[0].operations,[{action:'patch',id:'box',patch:{x:2}}]);
});
test('ACK alone retains preview until canonical commit; translation applied once',()=>{
  const {session,sent}=client();session.submit([{action:'translate',ids:['box'],dx:3,dy:4}]);session.tick();
  const flight=sent[0];session.receiveServer({...flight,type:'canvas_result',ok:true,revision:1,server_revision:1});
  assert.equal(session.pendingOperations.length,1);
  commit(session,flight,1,{translations:flight.operations});
  assert.equal(session.items.box.x,3);assert.equal(session.items.box.y,4);assert.equal(session.pendingOperations.length,0);
  commit(session,flight,1,{translations:flight.operations});assert.equal(session.items.box.x,3);
});
test('lost commit is healed on watermark without reconnecting',()=>{
  const {session,sent}=client();session.receiveServer({type:'canvas_watermark',revision:2});
  assert.equal(sent[0].type,'canvas_sync');assert.equal(session.ready,false);
  session.receiveServer({type:'canvas_snapshot',sync_protocol:2,revision:2,accepted_count:0,items:{box:{...box,x:9}}});
  assert.equal(session.ready,true);assert.equal(session.items.box.x,9);
});
test('revision gap requests a snapshot rather than applying out-of-order movement',()=>{
  const {session,sent}=client();session.receiveServer({type:'canvas_commit',revision:2,translations:[{ids:['box'],dx:3,dy:0}]});
  assert.equal(session.items.box.x,0);assert.equal(sent[0].type,'canvas_sync');
});
test('reconnect receipt removes a saved vector whose ACK was lost',()=>{
  const {session,sent}=client();session.submit([{action:'translate',ids:['box'],dx:3,dy:0}]);session.tick();
  session.pause();session.seed({box:{...box,x:3}},{sync_protocol:2,revision:1,accepted_count:1});session.tick();
  assert.equal(session.flight,null);assert.equal(session.count,1);assert.equal(sent.filter(m=>m.type==='canvas_ops').length,1);
});
test('unknown outcome retries the exact request and counter',()=>{
  const {session,sent}=client();session.submit([{action:'translate',ids:['box'],dx:3,dy:0}]);session.tick();
  session.receiveServer({type:'error',request_id:sent[0].request_id,code:'QUERY_OUTCOME_UNKNOWN'});
  session.sentAt=0;session.tick();assert.deepEqual(sent[1],sent[0]);
});
test('permanent rejection rolls back the failed draft without consuming its counter',()=>{
  const {session,sent,errors}=client();session.submit([{action:'delete',id:'box'}]);session.tick();
  session.receiveServer({type:'error',request_id:sent[0].request_id,code:'ITEM_ACCESS_DENIED'});
  assert.equal(session.pendingOperations.length,0);assert.equal(session.items.box,box);assert.equal(session.count,0);assert.equal(errors.length,1);
});
test('snapshots invalidate objects removed while disconnected',()=>{
  const {session,views}=client();session.seed({}, {sync_protocol:2,revision:1,accepted_count:0});
  assert.ok(views.at(-1).touched.includes('box'));assert.equal(session.items.box,undefined);
});
test('compact movement coalesces while text patch and unset retain order',()=>{
  const {session}=client();session.submit([{action:'translate',ids:['box'],dx:1,dy:0},{action:'translate',ids:['box'],dx:2,dy:0}]);
  assert.equal(session.queue.length,1);assert.equal(session.queue[0].dx,3);
  session.submit([{action:'patch',id:'box',patch:{color:'red'},unset:['fill']},{action:'patch',id:'box',patch:{fill:'blue'},unset:['color']}]);
  assert.deepEqual(session.queue.at(-1).patch,{fill:'blue'});assert.deepEqual(session.queue.at(-1).unset,['color']);
});

test('another user cannot acknowledge a local draft by copying its client ID',()=>{
  const {session,sent}=client();session.userId=7;
  session.submit([{action:'patch',id:'box',patch:{x:1}}]);session.tick();
  commit(session,sent[0],1,{author_id:8,items:{box:{...box,x:8}}});
  assert.equal(session.pendingOperations.length,1);assert.equal(session.items.box.x,8);
  commit(session,sent[0],2,{author_id:7,items:{box:{...box,x:1}}});assert.equal(session.pendingOperations.length,0);
});

test('mutable drawing input cannot change an in-flight retry payload',()=>{
  const {session,sent}=client();const points=[{x:1,y:1}];
  session.submit([{action:'patch',id:'box',patch:{points}}]);session.tick();
  points.push({x:2,y:2});session.sentAt=0;session.tick();
  assert.deepEqual(sent[1],sent[0]);assert.equal(session.flight.operations[0].patch.points.length,1);
});

test('oversized object is rejected locally before it can break the backend socket',()=>{
  const {session,sent,errors}=client();
  assert.equal(session.submit([{action:'patch',id:'box',patch:{src:'x'.repeat(8*1024*1024)}}]),false);
  session.tick();assert.equal(sent.length,0);assert.equal(errors.length,1);
});
