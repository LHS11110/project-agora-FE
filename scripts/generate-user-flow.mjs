import fs from 'node:fs';
import {planManifest} from '../src/canvas/asCode/manifest.js';
const dir='docs/user-flow';fs.mkdirSync(dir,{recursive:true});
const figures=[],ink='#202a34',muted='#56616b',line='#8b949d',blue='#345b7a';
function figure(id,w,h){const f={id,w,h,elements:[]};figures.push(f);return f;}
const box=(f,id,x,y,w,h,fill='#ffffff',stroke=ink)=>f.elements.push({type:'box',id,x,y,w,h,fill,stroke});
const text=(f,id,value,x,y,w,size=20,bold=false)=>f.elements.push({type:'text',id,value,x,y,w,size,bold});
const route=(f,id,points,label,at,color=blue,head=true,both=false)=>{f.elements.push({type:'route',id,points,color,head,both});if(label)text(f,id+'-label',label,...at,16);};
function node(f,id,title,lines,x,y,w,h){box(f,id,x,y,w,h);text(f,id+'-title',title,x+14,y+12,w-28,22,true);text(f,id+'-body',lines,x+14,y+48,w-28,18);}
function region(f,id,label,x,w){box(f,id,x,140,w,730,'#f6f7f8',line);text(f,id+'-label',label,x+15,157,w-30,20,true);}
const a=figure('01-user-journey',1600,1210);
text(a,'title','사용자 관점 핵심 흐름도',40,25,1520,32,true);
text(a,'subtitle','로그인 → 캔버스 검색·생성 → 접속 → 공동 편집 → 다른 캔버스 탐색',40,78,1520,21);
node(a,'login','1. 로그인','이메일·비밀번호 입력\n계정이 없으면 회원가입',610,140,380,105);
node(a,'explore','2. 캔버스 탐색','검색 또는 새 캔버스 만들기',610,295,380,90);
node(a,'search','기존 캔버스 검색','캔버스 이름으로 검색\n목록에서 원하는 캔버스 선택',150,440,460,100);
node(a,'create','새 캔버스 생성','캔버스 이름 입력\n설명·대표 이미지·비밀번호는 선택',990,440,460,100);
node(a,'enter','3. 캔버스 접속','접근 권한 확인\n필요 시 캔버스 비밀번호 입력',590,610,420,100);
node(a,'sync','4. 최신 상태 동기화','기존 작업 내용 불러오기\n동기화가 끝나면 편집 가능',590,770,420,100);
node(a,'edit','5. 편집 및 공동 작업','도형·텍스트·드로잉·이미지 편집\n참여자의 변경·포인터 실시간 공유',590,930,420,110);
node(a,'talk','함께 소통하기 (선택)','채팅 / 음성 통화\n참여자와 같은 캔버스에서 작업',1190,930,320,110);
node(a,'leave','6. 캔버스 나가기','캔버스 목록으로 돌아가기\n다른 캔버스 검색·생성',150,930,350,110);
node(a,'recover','작업 중 연결이 끊기면','연결 복구·재동기화\n준비 완료 후 작업 계속',150,770,350,100);
route(a,'login-explore',[[800,245],[800,295]]);
route(a,'search-branch',[[800,385],[800,410],[380,410],[380,440]]);
route(a,'create-branch',[[800,385],[800,410],[1220,410],[1220,440]]);
text(a,'choose-search','기존 작업에 참여',480,382,220,17);
text(a,'choose-create','새 작업 시작',1015,382,220,17);
route(a,'search-enter',[[380,540],[380,575],[800,575],[800,610]]);
route(a,'create-enter',[[1220,540],[1220,575],[800,575]],null,null,blue,false);
text(a,'auto-enter','생성 후 자동 이동',1025,548,220,17);
route(a,'enter-sync',[[800,710],[800,770]]);
route(a,'sync-edit',[[800,870],[800,930]]);
route(a,'edit-talk',[[1010,985],[1190,985]],'필요할 때',[1040,950,140],muted,true,true);
route(a,'edit-leave',[[590,985],[500,985]]);
route(a,'recover-sync',[[500,820],[590,820]],null,null,muted,true,true);
route(a,'leave-explore',[[150,985],[90,985],[90,340],[610,340]]);
text(a,'repeat','다른 캔버스 선택',100,1090,300,18);
text(a,'note-main','검색과 생성은 두 가지 진입 경로입니다. 어느 경로로 시작해도 같은 캔버스 접속·편집 흐름으로 이어집니다.',40,1140,1520,18);
text(a,'note-error','로그인·권한·비밀번호 오류가 표시되면 안내에 따라 계정과 접근 정보를 확인합니다. | 실제 화면 흐름 기준: 2026.10.15',40,1175,1520,17);
const escape=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const items={};let n=0;
for(const [index,f] of figures.entries()){
 const oy=160;const add=(id,value)=>items[`user-flow-${++n}-${id}`]={permission:'default',shadowEnabled:false,...value};
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
const manifest={version:1,mode:'merge',items,remove:[]};planManifest(manifest,{},'default');fs.writeFileSync(`${dir}/user-flow.canvas.json`,JSON.stringify(manifest,null,2)+'\n');fs.writeFileSync(`${dir}/figures.json`,JSON.stringify(figures,null,2)+'\n');console.log(JSON.stringify({figures:figures.length,objects:Object.keys(items).length,output:dir}));
