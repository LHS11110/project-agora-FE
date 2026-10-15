import { writeFileSync } from 'node:fs';
import { planManifest } from '../src/canvas/asCode/manifest.js';
const items = {}, C = { ink:'#263f3a', muted:'#62766e', line:'#d5dfd8', green:'#e4efe8', blue:'#e5edf7', purple:'#eee8f6', peach:'#faecdf', yellow:'#f8f1db', white:'#ffffff' };
let serial=0;
const add = (name, item) => { const id=`arch-${String(++serial).padStart(3,'0')}-${name}`; items[id]={permission:'default',shadowEnabled:false,...item}; return id; };
function box(name,x,y,w,h,fill=C.white,extra={}) { return add(name,{kind:'shape',shapeType:'rectangle',x,y,width:w,height:h,fill,color:C.line,strokeEnabled:true,strokeWidth:1.2,cornerStyle:'rounded',depth:2,...extra}); }
function text(name,value,x,y,w,fs=14,extra={}) { const s=fs/13; return add(name,{kind:'text',renderMode:'markdown',text:value,x:x-12*s,y:y-10*s,width:w+24*s+4,height:value.split('\n').length*fs*1.6+20*s+12,fontSize:fs,depth:4,...extra}); }
function card(name,title,body,x,y,w,h,fill) { const groupId='architecture-'+name; const id=box(name,x,y,w,h,fill,{groupId,shadowEnabled:true,shadowBlur:4,shadowOpacity:.06,shadowOffsetY:2}); text(name+'-title',title,x+18,y+17,w-36,20,{groupId}); text(name+'-body',body,x+18,y+63+(title.split('\n').length-1)*32,w-36,13,{groupId,height:h-46-(title.split('\n').length-1)*32}); return id; }
function arrowSegment(name,a,b,color,head='none',groupId) {
 const dx=b[0]-a[0],dy=b[1]-a[1],w=Math.hypot(dx,dy),h=1;
 if(w<.5)return;
 return add(name,{kind:'shape',shapeType:'arrow',x:(a[0]+b[0]-w)/2,y:(a[1]+b[1]-h)/2,width:w,height:h,rotation:(Math.atan2(dy,dx)+Math.atan2(h,w))*180/Math.PI,bend:0,startHead:'none',endHead:head,headSize:12,strokeWidth:2.2,color,fill:'',visualStyle:'standard',depth:0,groupId});
}
function route(name,points,color=C.muted,label,at) { const groupId='flow-'+name; for(let i=1;i<points.length;i++)arrowSegment(name+'-'+i,points[i-1],points[i],color,i===points.length-1?'triangle':'none',groupId); if(label)text(name+'-label',label,at[0],at[1],at[2]||180,11,{groupId}); }
// First board fits the application's 1600 x 1000 default world view.
box('overview-board',25,20,1535,990,'#fbfcfa',{depth:-5,cornerStyle:'sharp',strokeEnabled:false});
text('eyebrow','PROJECT AGORA  /  CURRENT DEPLOYMENT',60,46,1100,14);
text('main-title','프로젝트 아키텍처',60,108,1300,30);
text('main-subtitle','실행 중인 Docker 구성과 코드 기준 · 2026.10.15 · 아래로 이동하면 데이터 흐름과 운영 상세를 볼 수 있습니다.',62,149,1460,13);
for(const [label,x,c] of [['클라이언트',60,C.green],['HTTPS 진입점',340,C.blue],['라우팅 · 통신',620,C.purple],['애플리케이션',920,C.peach],['저장소 연결',1240,C.yellow]]) {box('column-rule',x,196,240,4,c,{strokeEnabled:false,depth:1});text('column-title',label,x,211,250,12);}
card('browser','브라우저 / FE','React · Vite · PixiJS\n캔버스 편집 · GPU/2D 렌더링\nAutomerge · 브라우저 호스트\n객체 · 포인터 · 레이저 송수신',60,260,230,180,C.green);
card('edge','호스트 Nginx','공개 HTTPS :443\n112.168.71.147\n외부 TLS 종료 · WSS 전달\n127.0.0.1:8444로 프록시',340,260,230,180,C.blue);
card('gateway','Wall / Nginx','Docker HTTPS 게이트웨이\n정적 FE 배포본 · /api · /wss\n내부 C++ 서버 ID 라우팅\n현재 정적 빌드 배포 방식',620,260,240,180,C.blue);
card('spring','Spring Boot','HTTPS :8080\n인증 · 계정 · ACL · 캔버스 등록\n캔버스 접근 JWT · 서버 할당\n검색 API · 내부 C++ 요청',920,260,240,180,C.peach);
card('voice-peer','다른 브라우저','WebRTC P2P: 음성 통화\nRTC 시그널링: Phoenix 경유\n객체·커서·레이저는 브로커 중계\nP2P 데이터 채널로 보내지 않음',60,520,230,180,C.green);
card('phoenix','Phoenix 브로커','WSS :4443 · 캔버스별 Room\nJWT 검증 · 연결/권한 격리\n호스트 선출 · relay · 브로드캐스트\n서버 질의 → C++ /broker/queries',620,520,240,180,C.purple);
card('cpp','C++ 캔버스 서비스','논리 포트 :8002 / 내부 서비스\n객체 CRUD · 설정 · 채팅\n호스트 배치 저장 · Redis flush\nMemoryClass · 프로세스 LRU',920,520,240,180,C.peach);
card('storage','HAProxy\n저장소 브로커','Spring · C++ · 검색 worker 경유\nSQL / ES / Redis / Sentinel\nTCP 중계 · TLS 암호문 통과\n저장소 인증은 원래 드라이버 담당\n메시지 큐 방식이 아닌 연결 중계',1240,340,270,360,C.yellow);
card('orchestra','Project Orchestra','순차 기동 · 빌드 · 정적 FE 배포\nDocker 상태 · HTTPS/WSS 검증\n부하·장애 실험 도구\n운영 데이터 경로 밖의 제어 도구',60,810,230,180,C.white);
card('search','E5 검색 worker','ONNX 임베딩 · HTTPS :8445\nSpring → 내부 Nginx → worker\n브로커 경유 ES 메타데이터 읽기\n검색 projection 비동기 갱신',340,810,230,180,C.peach);
card('sql','MS SQL Server','Express · :1433 / TLS 1.2\n계정 · 그룹 · ACL · 캔버스 등록\n서버 할당 · 리비전\n현재 1노드 / AG 미구성',620,810,240,180,C.yellow);
card('es','Elasticsearch','HTTPS :9200\n스냅샷 · 검색 projection · 로그\n현재 1 data node\n확인된 인덱스 replica 0',920,810,240,180,C.yellow);
card('redis','Redis + Sentinel','Redis primary 1 + replica 2\n작업 문서 · RedisJSON · AOF\nSentinel 3 / quorum 2\n복제는 비동기 · 동일 호스트',1240,810,270,180,C.yellow);
route('browser-edge',[[290,330],[340,330]],'#497b67','HTTPS/WSS',[281,301,98]);
route('edge-gateway',[[570,330],[620,330]],'#497b67');
route('gateway-spring',[[860,330],[920,330]],'#497b67','API',[870,301,60]);
route('gateway-phoenix',[[740,440],[740,520]],'#8a6aa3','WSS',[752,475,80]);
text('relay-note','협업 데이터는 Nginx를 거쳐\nPhoenix에서 참여자에게 전달',340,565,250,13);
route('voice',[[175,440],[175,520]],'#497b67','음성 P2P',[188,475,100]);
route('broker-cpp',[[860,604],[920,604]],'#8a6aa3','WSS',[875,574,45]);
route('spring-store',[[1160,330],[1190,330],[1190,415],[1240,415]],'#a07a30');
route('cpp-store',[[1160,610],[1240,610]],'#a07a30','TLS',[1181,578,60]);
route('sql-storage',[[1300,700],[1300,756],[740,756],[740,810]],'#a07a30');
route('es-storage',[[1368,700],[1368,778],[1040,778],[1040,810]],'#a07a30');
route('redis-storage',[[1455,700],[1455,810]],'#a07a30');
route('worker-storage',[[455,810],[455,733],[1215,733],[1215,670],[1240,670]],'#a07a30');
// Detail board: protocol, persistence and the important architectural boundaries.
box('flow-board',25,1080,1535,1080,'#fbfcfa',{depth:-5,cornerStyle:'sharp',strokeEnabled:false});
text('flow-eyebrow','02 / DATA FLOW & CONSISTENCY',60,1110,1450,14);
text('flow-title','변경 사항이 저장되고 공유되는 경로',60,1150,1450,32);
const stages=[
 ['author','사용자 편집','도형 · 텍스트 · 드로잉\n이동은 ID 목록 + Δx / Δy',60,C.green],
 ['relay','Phoenix relay','참여자 → 브라우저 호스트\n룸·대상·권한에 맞춰 중계',420,C.purple],
 ['host','브라우저 호스트','권한 · 순서 검증 / 수용 ACK\n확정 내역 → relay → 참여자',780,C.green],
 ['persist','C++ 저장 경로','host_item_batch → C++\nHAProxy → Redis flush',1140,C.peach],
];
for(const [name,title,body,x,c] of stages)card('flow-'+name,title,body,x,1240,310,155,c);
for(const [a,b] of [[370,420],[730,780],[1090,1140]])route('flow-step-'+a,[[a,1318],[b,1318]],'#8a6aa3');
card('live-events','실시간 · 전송 제어','커서 · 레이저 · 편집 상태 → Phoenix가 전달\n드로잉 · 지우개 · 선택 영역도 브로커 경유\n호스트 전송 목표 30Hz / 서버 저장 목표 10Hz\n다중 이동 벡터는 100ms 간격 병합\n큰 상태: 분할 전송 · 수신 ACK · 백프레셔',60,1450,450,240,C.white);
card('snapshot','새 참여자 · 복구','C++ 초기 상태 + 현재 호스트의 최신 스냅샷\n동기화가 완료될 때까지 편집 잠금\n이후 순서가 있는 변경 내역으로 최신 상태 유지\n호스트 변경 시 term으로 오래된 저장 차단\nBully 방식 선출 / Raft 합의 시스템은 아님',550,1450,450,240,C.white);
card('durability','ACK와 영속성의 경계','host_ack: 브라우저 메모리 수용 확인\nhost_batch_result: C++ 적용 + Redis flush 확인\nRedis 복제·디스크 fsync 완료와는 구분\nES 스냅샷: unload / 정상 종료 등 별도 단계\n여러 저장소 전체를 묶은 원자 트랜잭션 아님',1040,1450,470,240,C.white);
text('deployment-heading','Docker 네트워크와 현재 가용성',60,1760,1400,25);
card('networks','네트워크 격리','agora-web: 정적 FE 공유 · 게이트웨이\nagora-services: Spring · C++ · Phoenix · Nginx · HAProxy\nagora-net: MS SQL · Elasticsearch · HAProxy\nagora-redis-ha: Redis 3 · Sentinel 3 · HAProxy',60,1820,700,260,C.blue);
card('availability','실행 상태 / HA 범위','핵심 서비스 컨테이너 healthy 확인 (2026.10.15)\nRedis는 복제·Sentinel 자동 선출 구성\nSQL Express는 AG가 없고 ES는 현재 단일 노드\nNginx · Phoenix · C++ · HAProxy도 단일 인스턴스\n모든 노드가 한 Docker 호스트 → 호스트 장애 HA는 미보장',810,1820,700,260,C.yellow);
text('source-note','근거: Docker inspect / Nginx 실행 설정 / CanvasBrokerPeers / HostCanvasSession / BE·DB 구성 · 실제 배포 구조를 표현했습니다.',60,2113,1450,12);
const manifest={version:1,mode:'merge',items,remove:[]};
const plan=planManifest(manifest,{},'default');
const output=process.argv[2]||'docs/architecture/current-project.canvas.json';
writeFileSync(output,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({file:output,objects:plan.creates.length,bounds:{width:1560,height:2160}}));
