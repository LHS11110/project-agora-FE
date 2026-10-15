import fs from 'node:fs';
import {planManifest} from '../src/canvas/asCode/manifest.js';
const dir='docs/architecture/report';fs.mkdirSync(dir,{recursive:true});
const figures=[],ink='#202a34',muted='#56616b',line='#8b949d',blue='#345b7a';
function figure(id,w,h){const f={id,w,h,elements:[]};figures.push(f);return f;}
const box=(f,id,x,y,w,h,fill='#ffffff',stroke=ink)=>f.elements.push({type:'box',id,x,y,w,h,fill,stroke});
const text=(f,id,value,x,y,w,size=20,bold=false)=>f.elements.push({type:'text',id,value,x,y,w,size,bold});
const route=(f,id,points,label,at,color=blue,head=true)=>{f.elements.push({type:'route',id,points,color,head});if(label)text(f,id+'-label',label,...at,16);};
function node(f,id,title,lines,x,y,w,h){box(f,id,x,y,w,h);text(f,id+'-title',title,x+14,y+12,w-28,22,true);text(f,id+'-body',lines,x+14,y+48,w-28,18);}
function region(f,id,label,x,w){box(f,id,x,140,w,730,'#f6f7f8',line);text(f,id+'-label',label,x+15,157,w-30,20,true);}
const a=figure('01-system-architecture',1600,1135);
text(a,'title','그림 1. Project Agora의 배포 시스템 아키텍처',40,25,1520,31,true);
text(a,'subtitle','실행 환경의 구성과 역할 경계 | 확인 기준: 2026년 10월 15일',40,76,1520,20);
region(a,'client-plane','클라이언트',40,300);region(a,'ingress-plane','외부 진입 계층',380,280);region(a,'service-plane','애플리케이션 서비스',700,390);region(a,'storage-plane','저장소 계층',1130,430);
node(a,'browser','브라우저 애플리케이션','React / Vite / PixiJS\n로컬 편집 초안 + Automerge\n선출된 브라우저 호스트 (term)',65,205,250,190);
node(a,'peer','다른 참여자 브라우저','WebRTC 음성 통화 단말',65,630,250,110);
node(a,'edge','호스트 Nginx','외부 HTTPS / WSS :443',405,205,230,120);
node(a,'gateway','Docker Nginx','정적 프런트엔드 / API / WSS\n경로별 서비스 라우팅',405,485,230,160);
node(a,'spring','Spring Boot','인증·권한·캔버스 등록 관리\n접근 JWT 발급 / 서버 할당',725,205,340,135);
node(a,'search','E5 검색 워커','임베딩 처리 (내부 게이트웨이 경유)',725,365,340,90);
node(a,'phoenix','Phoenix 룸 브로커','참여자 관리 / 호스트 선출\n중계 / 접속 상태 브로드캐스트',725,485,340,155);
node(a,'cpp','C++ 캔버스 서비스','객체 상태 관리 / 쓰기 검증\nRedis 반영 / 수명주기별 스냅샷',725,700,340,135);
node(a,'storage','HAProxy 저장소 브로커','TCP 중계 / TLS 암호문 통과\nSQL · ES · Redis · Sentinel 연결',1155,205,380,120);
node(a,'sql','MS SQL Server','Express / 단일 노드\n계정 / 접근 권한\n캔버스 등록 정보',1155,435,180,135);
node(a,'es','Elasticsearch','데이터 노드 1대\n스냅샷\n검색용 데이터',1355,435,180,135);
node(a,'redis','Redis + Sentinel','주 노드 1대 + 복제본 2대\nSentinel 3대 / 정족수 2\n활성 문서 / RedisJSON / AOF',1155,670,380,165);
route(a,'https',[[315,265],[405,265]],'HTTPS\nWSS',[329,212,75]);
route(a,'loopback',[[520,325],[520,485]],'루프백\n:8444',[535,385,110]);
route(a,'api',[[635,525],[675,525],[675,272],[725,272]],'/api',[676,244,70]);
route(a,'realtime',[[635,575],[725,575]],'/wss',[650,548,75]);
route(a,'voice',[[190,395],[190,630]],'WebRTC\n음성 통화 전용',[206,486,120],muted);
route(a,'signaling',[[315,685],[675,685],[675,615],[725,615]],'RTC 연결 협상',[422,657,190]);
route(a,'broker-cpp',[[895,640],[895,700]],'백엔드 라우팅',[910,661,160]);
route(a,'embedding',[[895,340],[895,365]],null,null);
route(a,'spring-storage',[[1065,270],[1110,270],[1110,240],[1155,240]],null,null);
route(a,'search-storage',[[1065,410],[1120,410],[1120,285],[1155,285]],null,null);
route(a,'cpp-storage',[[1065,760],[1100,760],[1100,310],[1155,310]],null,null);
route(a,'store-sql',[[1300,325],[1300,385],[1245,385],[1245,435]],null,null);
route(a,'store-es',[[1390,325],[1390,385],[1445,385],[1445,435]],null,null);
route(a,'store-redis',[[1535,265],[1547,265],[1547,610],[1345,610],[1345,670]],null,null);
box(a,'control-plane',40,915,1520,115,'#f6f7f8',line);
text(a,'control-title','제어 계층 | Project Orchestra',60,935,490,23,true);
text(a,'control-body','빌드 / Docker 순차 기동 / 상태 점검 / HTTPS·WSS 연결 검증',60,980,1460,20);
text(a,'scope','배포 범위: 하나의 Docker 호스트. SQL·Elasticsearch는 단일 노드이며, Redis 복제는 비동기 방식입니다.',40,1055,1520,18);
text(a,'legend','화살표는 요청·메시지 방향이며 응답 경로는 생략했습니다. 제어 도구는 실제 요청 처리 경로에 포함되지 않습니다.',40,1090,1520,18);
const b=figure('02-replication-protocol',1600,870);
text(b,'title','그림 2. 호스트를 기준으로 하는 편집 내용의 복제 흐름',40,25,1520,31,true);
text(b,'subtitle','논리적 메시지 흐름입니다. 게이트웨이와 저장소까지의 중간 경로는 저장 경로 항목으로 묶어 표시했습니다.',40,76,1520,20);
for(const [id,title,body,x,w] of [['author','편집 중인 브라우저','로컬 미리보기 / 승인 대기 요청',40,290],['broker','Phoenix 브로커','인증된 캔버스 룸 내 중계',425,290],['host','선출된 브라우저 호스트','권한·순서 검증 / 요청 카운터',810,320],['store','저장 경로','Phoenix → C++ → HAProxy → Redis',1220,340]]){
 node(b,id,title,body,x,140,w,110);route(b,id+'-life',[[x+w/2,250],[x+w/2,710]],null,null,'#b6bdc4',false);
}
const X=[185,570,970,1390];
route(b,'proposal',[[X[0],290],[X[1],290]],'1. 편집 변경 제안',[205,261,345]);
route(b,'deliver',[[X[1],345],[X[2],345]],'2. 호스트 term과 함께 전달',[587,316,365]);
route(b,'commit',[[X[2],410],[X[1],410]],'3. 확정 변경 + host_ack',[587,381,365]);
route(b,'broadcast',[[X[1],465],[X[0],465]],'4. 순서가 있는 확정 변경 / 승인 응답',[205,436,365]);
route(b,'persist',[[X[2],555],[X[3],555]],'5. 배치 저장 요청 (host_item_batch)',[990,526,380]);
route(b,'flushed',[[X[3],620],[X[2],620]],'6. 저장 응답 (Redis 반영 확인)',[990,591,390]);
box(b,'notes',40,735,1520,110,'#f6f7f8',line);
text(b,'note-ack','host_ack는 브라우저 수용, host_batch_result는 C++ 적용·Redis 반영을 뜻합니다. 복제·디스크 영속성 완료와는 구분됩니다.',60,750,1480,18);
text(b,'note-retry','복구: 크기를 제한한 분할 전송·수신 확인, 진행 정체 시 재전송, 중복 적용 방지, 순번에 기반한 재동기화.',60,786,1480,18);
text(b,'note-media','접속 상태 이벤트는 Phoenix로 브로드캐스트하며, P2P는 음성 통화에만 사용합니다. 호스트 기반 복제로 Raft 합의 방식과는 다릅니다.',60,820,1480,18);
const escape=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const items={};let n=0;
for(const [index,f] of figures.entries()){
 const oy=index?1420:160;const add=(id,value)=>items[`paper-${++n}-${id}`]={permission:'default',shadowEnabled:false,...value};
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
   svg+=`<polyline points="${e.points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${e.color}" stroke-width="2" ${e.head?'marker-end="url(#arrow)"':''}/>`;
   for(let i=1;i<e.points.length;i++){
    const [ax,ay]=e.points[i-1],[bx,by]=e.points[i],dx=bx-ax,dy=by-ay,w=Math.hypot(dx,dy);if(!w)continue;
    add(e.id+'-'+i,{kind:'shape',shapeType:'arrow',x:(ax+bx-w)/2,y:oy+(ay+by-1)/2,width:w,height:1,rotation:(Math.atan2(dy,dx)+Math.atan2(1,w))*180/Math.PI,bend:0,startHead:'none',endHead:e.head&&i===e.points.length-1?'triangle':'none',headSize:10,strokeWidth:2,color:e.color,fill:'',depth:1,groupId});
   }
  }
 }
 svg+='</svg>\n';fs.writeFileSync(`${dir}/${f.id}.svg`,svg);
}
const manifest={version:1,mode:'merge',items,remove:[]};planManifest(manifest,{},'default');fs.writeFileSync(`${dir}/architecture.canvas.json`,JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(`${dir}/figures.json`,JSON.stringify(figures,null,2)+'\n');console.log(JSON.stringify({figures:figures.length,objects:Object.keys(items).length,output:dir}));
