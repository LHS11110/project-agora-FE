import fs from 'node:fs';
import {planManifest} from '../src/canvas/asCode/manifest.js';
const dir='docs/canvas-lifecycle';fs.mkdirSync(dir,{recursive:true});
const figures=[],ink='#202a34',muted='#56616b',line='#8b949d',blue='#345b7a';
function figure(id,w,h){const f={id,w,h,elements:[]};figures.push(f);return f;}
const box=(f,id,x,y,w,h,fill='#ffffff',stroke=ink)=>f.elements.push({type:'box',id,x,y,w,h,fill,stroke});
const text=(f,id,value,x,y,w,size=20,bold=false)=>f.elements.push({type:'text',id,value,x,y,w,size,bold});
const route=(f,id,points,label,at,color=blue,head=true,both=false)=>{f.elements.push({type:'route',id,points,color,head,both});if(label)text(f,id+'-label',label,...at,16);};
function node(f,id,title,lines,x,y,w,h){box(f,id,x,y,w,h);text(f,id+'-title',title,x+14,y+12,w-28,22,true);text(f,id+'-body',lines,x+14,y+48,w-28,18);}
function region(f,id,label,x,w){box(f,id,x,140,w,730,'#f6f7f8',line);text(f,id+'-label',label,x+15,157,w-30,20,true);}
const a=figure('01-canvas-lifecycle',1600,1135);
text(a,'title','그림 1. Canvas 데이터의 생명 주기',40,25,1520,32,true);
text(a,'subtitle','생성 → 비활성 보관 → 활성화·공동 편집 → 안전한 회수 → 재접속 또는 삭제',40,78,1520,21);
node(a,'create','1. 캔버스 생성','Spring: 이름·소유자·접근 정보 생성\nMS SQL ID 발급 / 초기 ES 문서 저장',60,170,440,130);
node(a,'inactive','2. 비활성 상태로 보관','MS SQL: 등록·할당 정보\nElasticsearch: 캔버스 문서',580,170,440,130);
node(a,'access','3. 접근 요청·권한 확인','Spring: 권한·비밀번호 확인\nC++ 서버 할당 / 접근 JWT 발급',1100,170,440,130);
node(a,'load','4. 활성 데이터 준비','캐시 존재: 기존 Redis 문서 재사용\n캐시 없음: ES → Redis 복원\nC++ 인스턴스 / cached=true',1100,425,440,160);
node(a,'active','5. 최신 상태 제공','브로커 등록 후 서버 스냅샷 조회\n객체·전역 순번·처리 카운터 전달\n브라우저별 로컬 렌더링',580,425,440,160);
node(a,'edit','6. 공동 편집·즉시 저장','브라우저 → Phoenix → C++ → Redis\n변경·순번·처리 기록을 원자 반영\n확정 변경을 참여자에게 전달',60,425,440,160);
node(a,'idle','7. 유휴 상태 판정','데이터 소켓의 lease가 활성 유지\n최근 질의 없음: 기본 TTL 90초\n회수 조건 확인 후 언로드 시도',60,735,440,150);
node(a,'snapshot','8. 안전한 스냅샷 저장','대기 쓰기 완료 / LRU flush 확인\nRedis 최신 문서 → Elasticsearch\n저장 실패 시 Redis·할당 유지',580,735,440,150);
node(a,'unload','9. 활성 자원 회수','MS SQL: cached=false 먼저 반영\n세대가 일치하는 Redis 캐시만 제거\nC++ 메모리 풀에서 해제',1100,735,440,150);
route(a,'create-inactive',[[500,235],[580,235]]);
route(a,'inactive-access',[[1020,235],[1100,235]]);
route(a,'access-load',[[1320,300],[1320,425]],'접속 준비',[1335,346,180]);
route(a,'load-active',[[1100,505],[1020,505]]);
route(a,'active-edit',[[580,505],[500,505]]);
route(a,'edit-idle',[[280,585],[280,735]],'모든 연결 종료 후',[300,650,250]);
route(a,'idle-snapshot',[[500,810],[580,810]]);
route(a,'snapshot-unload',[[1020,810],[1100,810]]);
route(a,'reuse',[[1540,810],[1570,810],[1570,350],[1450,350],[1450,300]],null,null,muted);
text(a,'reuse-label','재접속하면 다시 활성화',1110,363,420,18);
box(a,'notes',40,965,1520,125,'#f6f7f8',line);
text(a,'notes-title','회수는 데이터 삭제가 아닙니다.',60,980,1480,22,true);
text(a,'notes-body','비활성 캔버스는 ES에 보관됩니다. 다시 접속하면 복원합니다. 서버 재기동 시 기존 활성 Redis를 우선 사용합니다.\n활성 Redis를 읽지 못했을 때 오래된 ES 스냅샷으로 조용히 되돌리지 않습니다. 브라우저 호스트는 필요하지 않습니다.',60,1020,1480,18);
const b=figure('02-persistence-and-deletion',1600,1135);
text(b,'title','그림 2. 데이터 보존과 영구 삭제의 경계',40,25,1520,32,true);
text(b,'subtitle','저장 확인, 캐시 회수, 영구 삭제는 서로 다른 단계입니다. | 현재 코드 기준: 2026.10.15',40,78,1520,20);
box(b,'save-region',40,145,1520,410,'#f6f7f8',line);
text(b,'save-title','A. 활성 데이터의 보존',60,160,1480,24,true);
node(b,'redis','활성 원본: Redis','객체 / 채팅 / 캔버스 설정\nCRDT 이력 / 순번 / 중복 처리 기록',70,240,430,130);
node(b,'guard','회수 전 저장 검증','대기 쓰기 완료 + LRU flush\n최신 문서 읽기 / 캐시 세대 확인',585,240,430,130);
node(b,'es','비활성 원본: Elasticsearch','전체 문서 스냅샷\n객체·처리 기록은 인코딩해 보관',1100,240,430,130);
route(b,'redis-guard',[[500,305],[585,305]]);
route(b,'guard-es',[[1015,305],[1100,305]]);
text(b,'failure','실패 → Redis와 서버 할당 유지. 저장에 성공하기 전에는 활성 데이터를 버리지 않습니다.',75,425,1440,20,true);
text(b,'ack','canvas_result는 Redis 주 노드 반영 확인입니다. 복제본 동기화·디스크 fsync·ES 스냅샷 완료와는 구분됩니다.',75,485,1440,18);
box(b,'delete-region',40,600,1520,365,'#f6f7f8',line);
text(b,'delete-title','B. 소유자 또는 시스템 관리자의 영구 삭제 요청',60,615,1480,24,true);
node(b,'check','삭제 조건 확인','소유자·시스템 관리자 권한\n활성 cached=true이면 삭제 거절',70,695,430,125);
node(b,'delete','비활성 캔버스 삭제','MS SQL 등록 제거 요청\nElasticsearch 문서 삭제\n대표 이미지·리소스 디렉터리 정리',585,695,430,160);
node(b,'deleted','삭제 완료','캔버스 목록·저장 문서·리소스 제거\n같은 캔버스에 다시 접속할 수 없음',1100,695,430,125);
route(b,'check-delete',[[500,755],[585,755]]);
route(b,'delete-done',[[1015,755],[1100,755]]);
text(b,'delete-note','접속 종료 직후에는 유휴 회수까지 기다려야 할 수 있습니다. 여러 저장소 전체를 묶는 단일 원자 트랜잭션은 아닙니다.',75,895,1440,18);
text(b,'scope','범위: 캔버스 문서의 논리적 수명 주기입니다. 서버 정상 종료 시에도 저장 절차를 수행하며, 전원·복제 장애의 무손실을 뜻하지 않습니다.',40,1020,1520,18);
text(b,'source','근거: Spring CanvasService / C++ CanvasLifecycleMemory·CanvasServiceMemory·CanvasSnapshotMemory / Phoenix Room',40,1070,1520,17);
const escape=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const items={};let n=0;
for(const [index,f] of figures.entries()){
 const oy=160+index*1320;const add=(id,value)=>items[`lifecycle-${++n}-${id}`]={permission:'default',shadowEnabled:false,...value};
 add(f.id+'-page',{kind:'shape',shapeType:'rectangle',x:0,y:oy,width:f.w,height:f.h,fill:'#ffffff',strokeEnabled:false,depth:-5});
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f.w} ${f.h}" width="${f.w}" height="${f.h}" role="img" aria-label="${escape(f.id)}"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${blue}"/></marker></defs><rect width="100%" height="100%" fill="white"/>`;
 // Boundaries first, then routes, then text: no box covers a route or label.
 for(const e of [...f.elements].sort((a,b)=>['box','route','text'].indexOf(a.type)-['box','route','text'].indexOf(b.type))){
  const groupId=f.id+'-'+e.id;
  if(e.type==='box'){
   svg+=`<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" fill="${e.fill}" stroke="${e.stroke}" stroke-width="1.5"/>`;
   add(e.id,{kind:'shape',shapeType:'rectangle',x:e.x,y:oy+e.y,width:e.w,height:e.h,fill:e.fill,color:e.stroke,strokeWidth:1.5,depth:e.fill==='#f6f7f8'?-3:-1,groupId});
  }else if(e.type==='text'){
   const lines=e.value.split('\n');svg+=`<text font-family="Noto Sans CJK KR, sans-serif" font-size="${e.size}" fill="${ink}" font-weight="${e.bold?600:400}">${lines.map((v,i)=>`<tspan x="${e.x}" y="${e.y+e.size+i*e.size*1.4}">${escape(v)}</tspan>`).join('')}</text>`;
   const scale=e.size/13;
   add(e.id,{kind:'text',renderMode:'markdown',text:e.bold?lines.map(v=>`**${v}**`).join('\n'):e.value,x:e.x-12*scale,y:oy+e.y-10*scale,width:e.w+24*scale,height:lines.length*e.size*1.6+20*scale+10,fontSize:e.size,color:ink,depth:3,groupId});
  }else{
   svg+=`<polyline points="${e.points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${e.color}" stroke-width="2" ${e.head?`marker-end="url(#arrow)" ${e.both?'marker-start="url(#arrow)"':''}`:''}/>`;
   for(let i=1;i<e.points.length;i++){
    const [ax,ay]=e.points[i-1],[bx,by]=e.points[i],dx=bx-ax,dy=by-ay,w=Math.hypot(dx,dy);if(!w)continue;
    add(e.id+'-'+i,{kind:'shape',shapeType:'arrow',x:(ax+bx-w)/2,y:oy+(ay+by-1)/2,width:w,height:1,rotation:(Math.atan2(dy,dx)+Math.atan2(1,w))*180/Math.PI,bend:0,startHead:e.both&&i===1?'triangle':'none',endHead:e.head&&i===e.points.length-1?'triangle':'none',headSize:10,strokeWidth:2,color:e.color,fill:'',depth:1,groupId});
   }
  }
 }
 svg+='</svg>\n';fs.writeFileSync(`${dir}/${f.id}.svg`,svg);
}
const manifest={version:1,mode:'merge',items,remove:[]};planManifest(manifest,{},'default');fs.writeFileSync(`${dir}/canvas-lifecycle.canvas.json`,JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(`${dir}/figures.json`,JSON.stringify(figures,null,2)+'\n');console.log(JSON.stringify({figures:figures.length,objects:Object.keys(items).length,output:dir}));
