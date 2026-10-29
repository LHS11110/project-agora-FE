import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { planManifest } from '../src/canvas/asCode/manifest.js';
const directory=new URL('../docs/travel-template/',import.meta.url);
const items={};
const C={paper:'#f6f5ef',ink:'#263c36',muted:'#7c8980',line:'#dddeda',purple:'#8d73ba',pink:'#cc7e8c',green:'#607c61'};
let serial=0;
const add=(name,item)=>{const id='trip-'+String(++serial).padStart(3,'0')+'-'+name;items[id]={permission:'default',shadowEnabled:false,...item};return id};
const box=(name,x,y,width,height,fill='#ffffff',extra={})=>add(name,{kind:'shape',shapeType:'rectangle',x,y,width,height,fill,color:C.line,strokeEnabled:true,strokeWidth:1,cornerStyle:'rounded',depth:1,...extra});
const text=(name,value,x,y,width,fontSize=14,extra={})=>{const scale=fontSize/13;return add(name,{kind:'text',renderMode:'plain',text:value,x:x-12*scale,y:y-10*scale,width:width+24*scale+4,height:Math.max(fontSize*1.6,value.split('\n').length*fontSize*1.65)+20*scale+8,fontSize,color:C.ink,depth:10,...extra})};
const photo=(name,file,x,y,width,height,caption)=>{const groupId='travel-photo-'+name;box(name+'-frame',x-8,y-8,width+16,height+41,'#ffffff',{groupId,depth:3,shadowEnabled:true,shadowBlur:7,shadowOpacity:.07,shadowOffsetY:3});add(name,{kind:'image',src:'data:image/jpeg;base64,'+fs.readFileSync(new URL('assets/'+file,directory)).toString('base64'),filename:caption,x,y,width,height,imageFrameEnabled:false,depth:4,groupId});text(name+'-caption',caption,x+2,y+height+8,width-4,12,{groupId,depth:5,color:C.muted});};
const ink=(name,points,color=C.purple,width=2.5,extra={})=>add(name,{kind:'stroke',brush:'pen',strokeWidth:width,color,opacity:.9,points:points.map(([x,y],i)=>({x,y,pressure:.55+(i%5)*.018})),complete:true,simulatePressure:false,depth:7,...extra});
const curve=(points)=>{const out=[];for(let k=0;k<points.length-1;k++){const a=points[k],b=points[k+1];const steps=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/6);for(let i=0;i<steps;i++){const t=i/steps;out.push([a[0]+(b[0]-a[0])*t+Math.sin(t*Math.PI*3)*.45,a[1]+(b[1]-a[1])*t+Math.sin(t*Math.PI*2)*.4]);}}out.push(points.at(-1));return out};
const circle=(name,cx,cy,r,color,width=2,extra={})=>ink(name,Array.from({length:61},(_,i)=>{const a=i/60*Math.PI*2;return[cx+Math.cos(a)*r+Math.sin(a*3)*1.2,cy+Math.sin(a)*r*.48+Math.cos(a*2)*.6]}),color,width,extra);
const map={x:80,y:204,width:960,height:506,west:127.028,east:127.076,south:37.5278,north:37.5478};
const point=(lat,lon)=>[map.x+(lon-map.west)/(map.east-map.west)*map.width,map.y+(map.north-lat)/(map.north-map.south)*map.height];
const stations={meet:point(37.543695,127.044707),forest:point(37.544625,127.03984),seongsu:point(37.544581,127.055961),river:point(37.529341,127.066713)};
function marker(name,location,label,number,color,dx,dy){const [x,y]=location,groupId='travel-marker-'+name;add(name+'-halo',{kind:'shape',shapeType:'ellipse',x:x-18,y:y-18,width:36,height:36,fill:'#ffffff',color,strokeWidth:2,depth:8,groupId});text(name+'-number',number,x-4.5,y-9,15,14,{color,depth:9,groupId});box(name+'-label',x+dx,y+dy,150,31,'#ffffff',{color:'#e0e0dc',depth:8,groupId});text(name+'-label-text',label,x+dx+9,y+dy+7,137,12,{color,depth:9,groupId});}
box('board',30,28,1540,975,C.paper,{depth:-10,strokeEnabled:false});
text('eyebrow','OUR LITTLE ESCAPE  /  SEOUL DAY TRIP',67,52,700,11,{color:C.muted});
text('title','서울숲에서 한강까지, 우리끼리 하루',64,78,1050,35);
text('subtitle','지도에 약속을 남기고, 사진에 가고 싶은 마음을 붙여보세요.  날짜·시간·참가자는 자유롭게 바꾸는 예시 템플릿입니다.',66,134,1050,12,{color:C.muted});
box('date-chip',1242,62,282,78,'#e9eddf',{strokeEnabled:false});text('date-chip-title','여행 날짜  ____ / ____',1263,79,240,15);text('date-chip-sub','참가자  민서 · 지우 · 나  (예시)',1263,108,250,11,{color:C.muted});
// An original render of OSM geometry, with editable pins and freehand route overlays.
box('map-card',64,178,993,550,'#ffffff',{groupId:'travel-basemap',depth:0});
text('map-heading','01   OUR MAP',81,186,400,11,{color:C.muted,groupId:'travel-basemap'});
add('basemap',{kind:'image',src:'data:image/png;base64,'+fs.readFileSync(new URL('assets/seoul-map.png',directory)).toString('base64'),filename:'서울숲·성수·뚝섬 위치도 | © OpenStreetMap contributors',x:map.x,y:map.y,width:map.width,height:map.height,imageFrameEnabled:false,depth:2,groupId:'travel-basemap'});
text('map-hangang','한  강',416,611,200,28,{color:'#769eaa',depth:4});text('map-seongsu','성 수 동',580,417,170,20,{color:'#95998d',depth:4});text('map-forest','서 울 숲',140,334,170,20,{color:'#7f956d',depth:4});
text('map-north','N ↑',1005,224,28,12,{color:'#6f7b73',depth:5});
box('map-key',100,672,416,28,'#fffff9',{depth:5,strokeEnabled:false});text('map-attribution','© OpenStreetMap contributors / ODbL',785,690,245,9,{color:'#6f7d77',depth:6});
text('map-key-text','● 약속 장소    1 서울숲    2 성수    3 한강',111,678,394,11,{color:'#74826e',depth:6});
ink('forest-route',curve([stations.meet,[398,311],[375,318],[350,315],stations.forest]),C.pink,2.8,{groupId:'travel-route'});
ink('seongsu-route',curve([stations.forest,[379,270],[442,267],[503,278],[571,287],stations.seongsu]),C.purple,3.2,{groupId:'travel-route'});
ink('river-route',curve([stations.seongsu,[685,330],[720,380],[744,430],[771,490],[810,549],[830,600],stations.river]),C.purple,3.2,{groupId:'travel-route'});
// Hand drawn direction arrow, heart, coffee cup and photo annotations.
const [rx,ry]=stations.river;ink('route-arrow',[[rx-14,ry-13],[rx,ry],[rx+3,ry-20]],C.purple,3,{groupId:'travel-route'});
marker('meeting',stations.meet,'서울숲역 · 여기서 만나!', '●',C.pink,-15,28);
marker('forest',stations.forest,'서울숲 · 산책 & 사진','1',C.green,-178,-47);
marker('seongsu',stations.seongsu,'성수 · 점심 & 카페','2',C.purple,24,-39);
marker('river',stations.river,'뚝섬한강공원 · 쉬어가기','3',C.purple,-203,-32);
text('route-note','선은 방문 순서예요. 실제 이동 경로는 지도 앱에서 확인!',624,467,320,12,{color:'#8a759d',rotation:4,depth:8});
ink('sun-circle',Array.from({length:41},(_,i)=>[968+Math.cos(i/40*Math.PI*2)*11,560+Math.sin(i/40*Math.PI*2)*11]),'#caa166',2);
for(let i=0;i<8;i++){const a=i/8*Math.PI*2;ink('sun-ray-'+i,[[968+Math.cos(a)*17,560+Math.sin(a)*17],[968+Math.cos(a)*24,560+Math.sin(a)*24]],'#caa166',1.8)}
// Meeting details and a useful external map link.
box('meet-card',1080,178,444,224,'#eee7f5',{color:'#dfd3ea',groupId:'travel-meeting'});
text('meet-eyebrow','MEET HERE  /  약속 장소',1102,195,390,11,{color:'#9a83ae',groupId:'travel-meeting'});
text('meet-time','11:00, 서울숲역 3번 출구',1102,223,400,24,{color:'#67517c',groupId:'travel-meeting'});
text('meet-memo','날짜는 위 칸에 적기 · 늦으면 댓글로 알려주기\n지상 출구 주변에서 만나 함께 출발해요.',1103,271,390,13,{color:'#8b789a',groupId:'travel-meeting'});
add('meeting-map-link',{kind:'link',url:'https://www.google.com/maps/search/?api=1&query=37.543695%2C127.044707',title:'약속 장소 지도 열기 · 서울숲역',mediaType:'link',x:1100,y:327,width:400,height:62,contentScale:1,depth:8,groupId:'travel-meeting'});
// Editable schedule as native text, rather than a flattened screenshot.
box('schedule-card',1080,422,444,287,'#ffffff',{groupId:'travel-schedule'});
text('schedule-heading','02   TODAY’S PLAN',1103,441,390,11,{color:C.muted,groupId:'travel-schedule'});
const rows=[['11:00','서울숲역에서 만나기','출구와 도착 시간을 댓글로 공유'],['11:20','서울숲 천천히 걷기','사진 찍고, 가고 싶은 곳 지도에 표시'],['13:00','성수에서 점심 + 카페','가게는 함께 고르고 예약 여부 확인'],['16:00','뚝섬한강공원에서 쉬기','날씨를 보고 한강 / 실내로 결정']];
rows.forEach(([time,title,body],i)=>{const y=478+i*54;text('time-'+i,time,1103,y,67,15,{color:i===0?C.pink:C.purple,groupId:'travel-schedule'});text('plan-'+i,title,1188,y,306,14,{groupId:'travel-schedule'});text('plan-sub-'+i,body,1188,y+24,306,10,{color:C.muted,groupId:'travel-schedule'});if(i<3)box('schedule-rule-'+i,1104,y+43,395,1,'#eceee7',{depth:2,strokeEnabled:false,groupId:'travel-schedule'})});
// A small moodboard, with photos embedded so it does not depend on hotlinks.
text('photos-heading','03   PLACES WE WANT TO KEEP',76,745,700,11,{color:C.muted});
photo('forest-photo','forest-walk.jpg',76,777,262,157,'서울숲 · 물가 옆, 나무 그늘 아래');
photo('path-photo','forest-path.jpg',365,777,92,157,'숲길 한 컷');
photo('river-photo','hangang.jpg',484,777,262,157,'뚝섬한강공원 · 강바람 쐬기');
box('photo-memo',777,774,272,179,'#e5eadc',{strokeEnabled:false,depth:3});
text('photo-memo-title','이 순간은 꼭!',796,793,230,18,{color:'#5b7459',depth:6});
text('photo-memo-copy','나무 아래 단체 사진 한 장\n각자 고른 카페 메뉴 찍기\n한강에서 오늘의 한 줄 남기기',796,834,232,12,{color:'#7b8d70',depth:6});
ink('photo-heart',curve([[1010,807],[1002,798],[991,799],[988,808],[995,819],[1010,830],[1024,817],[1029,807],[1024,799],[1015,799],[1010,807]]),'#c28582',2.2);
ink('photo-underline',curve([[796,822],[825,824],[858,823],[891,824]]),'#8c9d78',1.7);
// Real sticky notes stay editable and can be rearranged by the group.
add('packing-note',{kind:'note',x:1085,y:742,width:207,height:214,fontSize:12,color:'#f6eccb',rotation:-1.5,text:'## 챙길 것\n□ 보조배터리\n□ 편한 운동화\n□ 물 + 작은 간식\n□ 돗자리 / 가벼운 겉옷\n□ 각자 좋아하는 플레이리스트',depth:6,shadowEnabled:true,shadowBlur:6,shadowOpacity:.08,shadowOffsetY:3});
add('budget-note',{kind:'note',x:1311,y:742,width:207,height:214,fontSize:12,color:'#f4e2dd',rotation:1.2,text:'## 예산 메모 · 1인 예시\n식사 18,000 + 카페 7,000\n이동 5,000 + 여유 5,000\n**합계 35,000원**\n\n비 오면? 실내 카페로 변경\n정산 담당: __________',depth:6,shadowEnabled:true,shadowBlur:6,shadowOpacity:.08,shadowOffsetY:3});
text('map-credit','지도 © OpenStreetMap contributors · ODbL / 사진: CartoonChess CC BY-SA 4.0 · Striker9498 CC0 · Wikihyo CC0',67,975,1390,9,{color:'#93998e'});
// Keep detailed references and usage notes nearby, outside the initial frame.
box('reference-card',65,1058,1460,239,'#ffffff',{depth:0});
text('reference-title','사용 가이드 & 출처',88,1081,650,23);
text('reference-guide','핀·이동선·텍스트·메모는 모두 편집 가능해요. 지도 배경과 사진도 각각의 이미지 객체입니다.\n날짜·참가자·약속 시간과 예산을 바꾸고, 댓글·멘션으로 의견을 모아보세요. 시간과 비용은 계획 예시이며 실제 운영 정보는 방문 전에 확인하세요.',88,1127,1368,13,{color:C.muted});
text('reference-links','서울숲 공식 안내: https://korean.visitseoul.net/etc-area/서울숲/KOP001838\n지도: https://www.openstreetmap.org/copyright · 지도에 표시한 좌표는 장소를 찾기 위한 근사 위치입니다.\n사진별 원본 주소·작가·라이선스는 docs/travel-template/sources.json에 기록했습니다. 사진은 현재의 실시간 풍경이 아닌 참고 이미지입니다.',88,1194,1368,11,{color:C.muted});
const manifest={version:1,mode:'merge',items};
planManifest(manifest,{},'default');
fs.writeFileSync(new URL('seoul-day-trip.canvas.json',directory),JSON.stringify(manifest,null,2));
fs.writeFileSync(new URL('layout.json',directory),JSON.stringify({canvasFrame:{x:30,y:28,width:1540,height:975},map,stations,objectCount:Object.keys(items).length},null,2));
console.log('Travel template ready:',Object.keys(items).length,'editable objects',Math.round(JSON.stringify(manifest).length/1024),'KB');
