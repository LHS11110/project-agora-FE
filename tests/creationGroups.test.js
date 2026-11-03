import test from 'node:test';
import assert from 'node:assert/strict';
import {creationGroupPermission} from '../src/canvas/permissions/creationGroups.js';
import {canPeerAccessItem} from '../src/canvas/collaborativeSync.js';
import {assertAccessOperations} from '../src/canvas/permissions/access.js';
import {planManifest,exportManifest} from '../src/canvas/asCode/manifest.js';
test('new object includes all roles, including roles without write access',()=>{
 const identity={member_groups:['design','research','archive'],groups:['design','research'],write_groups:['design']};
 const permission=creationGroupPermission(identity);assert.deepEqual(permission,['archive','design','research']);
 const item={kind:'shape',shapeType:'rectangle',x:0,y:0,width:.1,height:.1,permission};
 assertAccessOperations({},[{action:'create',id:'a',patch:item}],identity);
 assert.equal(canPeerAccessItem(item,{groups:['research']}),true);assert.equal(canPeerAccessItem(item,{groups:['unrelated']}),false);
 assert.equal(canPeerAccessItem(item,{groups:[],is_admin:true}),true);
 const plan=planManifest({version:1,items:{a:{kind:'shape',shapeType:'rectangle',x:0,y:0}}},{},permission);assert.deepEqual(plan.creates[0].item.permission,permission);
 assert.deepEqual(exportManifest({a:item}).items.a.permission,permission);
});
test('legacy peers use readable groups, not just a first default or writable group',()=>{
 assert.deepEqual(creationGroupPermission({groups:['B','A','A'],write_groups:['A']}),['A','B']);
 assert.deepEqual(creationGroupPermission(null,['team']),['team']);
 assert.deepEqual(creationGroupPermission({member_groups:[],groups:['default']}),[]);
});
test('canvas manifests accept explicit group arrays and reject ambiguous permission maps',()=>{
 const source={version:1,items:{a:{kind:'shape',shapeType:'rectangle',x:0,y:0,permission:{writers:1,readers:0}}}};
 assert.throws(()=>planManifest(source,{},['writers']),/permission/);
});
