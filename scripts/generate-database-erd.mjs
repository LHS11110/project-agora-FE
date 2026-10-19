import fs from 'node:fs';
import {planManifest} from '../src/canvas/asCode/manifest.js';
const dir='docs/database-erd',schema=JSON.parse(fs.readFileSync(`${dir}/schema.json`));
const W=2940,H=1800,items={},elements=[],removed=[],ink='#243447',muted='#64748b',blue='#386b94';
let serial=0;
const add=(id,item)=>{items['erd-'+id]={permission:'default',shadowEnabled:false,...item};};
function box(id,x,y,w,h,fill='#ffffff',stroke='#c5d0dc',depth=0,groupId=id){add(id,{kind:'shape',shapeType:'rectangle',x,y,width:w,height:h,fill,color:stroke,strokeWidth:1.2,depth,groupId});elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/>`);}
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function text(id,value,x,y,w,size=19,bold=false,color=ink,groupId=id){if(!value.trim()){removed.push('erd-'+id);return;}const scale=size/13,lines=value.split('\n');add(id,{kind:'text',renderMode:bold?'markdown':'plain',text:bold?lines.map(v=>`**${v}**`).join('\n'):value,x:x-12*scale,y:y-10*scale,width:w+24*scale,height:lines.length*size*1.5+20*scale+12,fontSize:size,color,depth:5,groupId});elements.push(`<text font-family="Noto Sans CJK KR, sans-serif" font-size="${size}" fill="${color}" font-weight="${bold?650:400}">${lines.map((v,i)=>`<tspan x="${x}" y="${y+size+i*size*1.5}">${esc(v)}</tspan>`).join('')}</text>`);}
function path(id,points,color=blue,width=2){elements.push(`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}"/>`);for(let i=1;i<points.length;i++){const [ax,ay]=points[i-1],[bx,by]=points[i],dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy);if(!len)continue;add(id+'-'+i,{kind:'shape',shapeType:'arrow',x:(ax+bx-len)/2,y:(ay+by-1)/2,width:len,height:1,rotation:(Math.atan2(dy,dx)+Math.atan2(1,len))*180/Math.PI,bend:0,startHead:'none',endHead:'none',headSize:8,strokeWidth:width,color,fill:'',depth:2,groupId:id});}}
text('title','데이터베이스 ERD',80,30,2700,40,true);
text('subtitle','AGORA / FreLog · SQL Server 실제 시스템 카탈로그 기준 · 2026.10.19',80,92,2700,22,false,muted);
text('summary','5 TABLES     36 COLUMNS     5 FOREIGN KEYS     |     PK · FK · UQ · NULLABLE',80,140,2700,19,true,blue);
const pos={users:[80,250],user_sessions:[1040,250],canvas_info:[2060,250],cpp_server:[1040,960],redis_server:[2060,960]};
const titles={users:'사용자 계정',user_sessions:'사용자 접속 상태',canvas_info:'캔버스 등록·할당',cpp_server:'C++ 서버 인스턴스',redis_server:'Redis 서버 등록'};
const rows={},cw=640,rowH=34,header=110;
function type(c){if(['nvarchar','nchar'].includes(c.type))return c.type+'('+(c.max_length<0?'max':c.max_length/2)+')';if(['varchar','char','varbinary','binary'].includes(c.type))return c.type+'('+(c.max_length<0?'max':c.max_length)+')';if(c.type==='datetime2')return `datetime2(${c.scale})`;if(['decimal','numeric'].includes(c.type))return `${c.type}(${c.precision},${c.scale})`;return c.type;}
for(const [table,[x,y]] of Object.entries(pos)){
 const cols=schema.columns.filter(c=>c.table===table),group='erd-table-'+table;
 const uniques=Object.values(Object.groupBy(schema.unique_keys.filter(k=>k.table===table&&!k.is_primary_key),k=>k.name)).map(keys=>keys.sort((a,b)=>a.key_ordinal-b.key_ordinal).map(k=>k.column).join(' + '));
 const h=header+cols.length*rowH+28+uniques.length*29;
 box(table,x,y,cw,h,'#ffffff','#94a3b8',0,group);box(table+'-head',x,y,cw,70,'#edf3f8','#94a3b8',1,group);
 text(table+'-title',table,x+18,y+9,410,26,true,ink,group);text(table+'-ko',titles[table],x+18,y+43,600,16,false,muted,group);
 text(table+'-cols','컬럼',x+18,y+79,280,17,true,muted,group);text(table+'-types','SQL 타입',x+338,y+79,174,17,true,muted,group);text(table+'-flags','제약',x+525,y+79,105,17,true,muted,group);
 cols.forEach((c,i)=>{const ry=y+header+i*rowH;rows[table+'.'+c.name]=ry+17;
  if(i%2===1)box(table+'-stripe-'+i,x+1,ry,cw-2,rowH,'#f7f9fc','#f7f9fc',1,group);
  const fk=schema.foreign_keys.some(k=>k.source_table===table&&k.source_column===c.name);
  const flag=[c.is_primary_key?'PK':'',fk?'FK':'',c.is_nullable?'NULL':''].filter(Boolean).join(' ');
  text(table+'-name-'+i,c.name+(c.is_identity?'  ↗':''),x+18,ry+3,310,19,c.is_primary_key,ink,group);
  text(table+'-type-'+i,type(c),x+338,ry+3,178,18,false,muted,group);text(table+'-flag-'+i,flag,x+525,ry+5,108,15,true,fk?blue:muted,group);
 });
 uniques.forEach((u,i)=>text(table+'-uq-'+i,'UQ  '+u,x+18,y+header+cols.length*rowH+9+i*29,cw-30,16,false,blue,group));
}
// Non-overlapping orthogonal routes terminate at the actual referenced columns.
const yy=key=>rows[key];
path('fk-session-user',[[720,yy('users.user_id')],[1040,yy('user_sessions.user_id')]]);
text('card-user','1',748,yy('users.user_id')-35,70,19,true,blue);text('card-session-user','0..1',950,yy('users.user_id')-35,80,19,true,blue);
text('fk-user-label','user_id = PK + FK',748,yy('users.user_id')+20,270,16,false,muted);
path('fk-session-canvas',[[1680,yy('user_sessions.canvas_id')],[1850,yy('user_sessions.canvas_id')],[1850,yy('canvas_info.canvas_id')],[2060,yy('canvas_info.canvas_id')]]);
text('card-session-canvas','0..N',1696,yy('user_sessions.canvas_id')+12,90,18,true,blue);text('card-canvas-session','0..1',1975,yy('canvas_info.canvas_id')-34,80,18,true,blue);
path('fk-session-cpp',[[1040,yy('user_sessions.cpp_server_id')],[910,yy('user_sessions.cpp_server_id')],[910,yy('cpp_server.server_id')],[1040,yy('cpp_server.server_id')]]);
text('card-session-cpp','0..N',950,yy('user_sessions.cpp_server_id')+14,80,18,true,blue);text('card-cpp-session','0..1',950,yy('cpp_server.server_id')+12,80,18,true,blue);
path('fk-canvas-cpp',[[2060,yy('canvas_info.cpp_server_id')],[1930,yy('canvas_info.cpp_server_id')],[1930,yy('cpp_server.server_id')],[1680,yy('cpp_server.server_id')]]);
text('card-canvas-cpp','0..N',1967,yy('canvas_info.cpp_server_id')+12,80,18,true,blue);text('card-cpp-canvas','0..1',1698,yy('cpp_server.server_id')+12,80,18,true,blue);
path('fk-canvas-redis',[[2700,yy('canvas_info.redis_id')],[2810,yy('canvas_info.redis_id')],[2810,yy('redis_server.redis_id')],[2700,yy('redis_server.redis_id')]]);
text('card-canvas-redis','0..N',2717,yy('canvas_info.redis_id')-32,90,18,true,blue);text('card-redis-canvas','0..1',2717,yy('redis_server.redis_id')+14,90,18,true,blue);
box('legend',80,980,640,290,'#f7f9fc','#c5d0dc');text('legend-title','표기와 관계 읽기',100,997,600,23,true);
text('legend-body','PK  기본 키   /   FK  실제 외래 키\nUQ  UNIQUE 제약 ( + 는 복합 키)\nNULL  값 없음 허용 / 미표시 컬럼은 NOT NULL\n↗  IDENTITY 자동 증가\n선 끝의 숫자 = 상대 행 1개당 가능한 행 수\n모든 FK: DELETE · UPDATE = NO ACTION',100,1045,600,18);
box('notes',80,1440,2620,265,'#f7f9fc','#c5d0dc');text('notes-title','문서 저장소와 관계형 스키마의 경계',104,1458,2540,25,true);
text('notes-body','MS SQL: 사용자 계정·접속 상태·서버 등록·캔버스 할당을 관리합니다. users → user_sessions는 사용자당 최대 1행입니다.\nRedis: 활성 캔버스 문서 canvas:{canvas_id}를 저장합니다. SQL의 canvas_id와 연결하는 애플리케이션 키이며 SQL FK는 아닙니다.\nElasticsearch: canvas 인덱스에 캔버스 문서·스냅샷을 보관합니다. 객체·참여자·그룹은 문서 내부 데이터이므로 SQL 테이블로 그리지 않았습니다.\n비밀번호 해시·이메일 등 실제 사용자 값은 도식에 포함하지 않았습니다. 스키마 메타데이터만 사용했습니다.',104,1510,2540,21);
text('footer','SOURCE  sys.tables · sys.columns · sys.indexes · sys.foreign_keys  |  범위: agora_db / dbo  |  비활성·미신뢰 FK 없음',80,1740,2700,17,false,muted);
const manifest={version:1,mode:'merge',items,remove:removed};planManifest(manifest,{},'default');
fs.writeFileSync(`${dir}/database-erd.canvas.json`,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(`${dir}/database-erd.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="100%" height="100%" fill="#ffffff"/>${elements.join('\n')}</svg>`);
console.log(JSON.stringify({tables:Object.keys(pos).length,columns:schema.columns.length,foreign_keys:schema.foreign_keys.length,objects:Object.keys(items).length}));
