export const researchTemplates=[
 {id:'service-flow',label:'개발 · 클라이언트 / API / DB',width:1060,height:260},
 {id:'array',label:'자료 구조 · 배열',width:1060,height:280},
 {id:'stack',label:'자료 구조 · 스택',width:560,height:620},
 {id:'queue',label:'자료 구조 · 큐',width:1060,height:300},
 {id:'vectors',label:'수학 · 좌표와 벡터',width:800,height:560},
 {id:'linked-list',label:'자료 구조 · 연결 리스트',width:1080,height:300},
 {id:'binary-tree',label:'자료 구조 · 이진 탐색 트리',width:960,height:600},
 {id:'min-heap',label:'자료 구조 · 최소 힙',width:960,height:600},
 {id:'experiment',label:'과학 · 실험 절차 흐름도',width:1080,height:440},
 {id:'feedback',label:'공학 · 피드백 제어 블록도',width:1080,height:460},
];
/** Pixel-space manifest, imported through the same validated editor path. */
export function researchTemplateManifest(type,{prefix,x=0,y=0,permission='default'}={}){
 if(!researchTemplates.some(t=>t.id===type))throw new Error('지원하지 않는 예시 구조입니다.');
 if(!prefix)throw new Error('예시 구조의 고유 ID가 필요합니다.');
 const items={},id=name=>`${prefix}-${name}`;
 const text=(name,value,tx,ty,w=180)=>items[id(name)]={kind:'text',renderMode:'plain',text:value,x:x+tx,y:y+ty,width:w,height:55,fontSize:22,color:'#243447',permission,shadowEnabled:false};
 const node=(name,label,nx,ny,w=180,h=95,shapeType='rectangle')=>{
  items[id(name)]={kind:'shape',shapeType,x:x+nx,y:y+ny,width:w,height:h,color:'#57768f',fill:'#edf3f8',strokeWidth:1.5,permission,shadowEnabled:false,groupId:id(name+'-group')};
  text(name+'-label',label,nx+12,ny+(h-46)/2,w-24);items[id(name+'-label')].groupId=id(name+'-group');return id(name);
 };
 const edge=(name,from,to,label='',extra={})=>items[id(name)]={kind:'connector',from:id(from),to:id(to),startHead:'none',endHead:'triangle',headSize:13,strokeWidth:1.7,color:'#57768f',permission,...(label?{label,labelMode:'plain'}:{}),...extra};
 const title=researchTemplates.find(t=>t.id===type).label;text('title',title,0,0,researchTemplates.find(t=>t.id===type).width);
 if(type==='service-flow'){
  node('client','클라이언트',0,115);node('api','API 서버',400,115);node('db','데이터베이스',800,105,180,115,'cylinder');edge('request','client','api','요청 / 응답');edge('query','api','db','조회 / 저장');
 }else if(type==='array'){
  ['12','7','25','4','19'].forEach((v,i)=>{node('cell'+i,v,i*200,120,190,95);text('index'+i,'['+i+']',i*200+55,225,100);});
 }else if(type==='stack'){
  ['D','C','B','A'].forEach((v,i)=>node('cell'+i,v,180,130+i*100,190,95));text('top','TOP →',20,150,150);text('operation','push / pop',180,560,320);
 }else if(type==='queue'){
  ['A','B','C','D'].forEach((v,i)=>node('cell'+i,v,70+i*230,140,210,95));text('front','출구 (front)',70,80,270);text('rear','입구 (rear)',760,80,270);
 }else if(type==='vectors'){
  items[id('axes')]={kind:'shape',shapeType:'math-axes',x:x+100,y:y+100,width:500,height:350,color:'#64748b',fill:'',strokeWidth:1.5,permission,shadowEnabled:false};
  for(const [name,dx,dy] of [['u',300,-180],['v',200,-50]]){
   const len=Math.hypot(dx,dy);items[id(name)]={kind:'shape',shapeType:'arrow',x:x+200+dx/2-len/2,y:y+380+dy/2-.5,width:len,height:1,rotation:(Math.atan2(dy,dx)+Math.atan2(1,len))*180/Math.PI,startHead:'none',endHead:'triangle',headSize:16,color:'#386b94',strokeWidth:2,fill:'',permission,shadowEnabled:false};
   text(name+'-label',name,200+dx,330+dy,80);
  }
  text('origin','O',160,390,60);text('x','x',610,365,60);text('y','y',175,70,60);
 }else if(type==='linked-list'){
  ['A','B','C','D'].forEach((v,i)=>{node('n'+i,v,i*270,115,180,90,'ds-linked-node');if(i)edge('next'+i,'n'+(i-1),'n'+i,'next');});
  text('head','head',0,65,130);text('tail','tail → null',810,220,230);
 }else if(type==='binary-tree'||type==='min-heap'){
  const values=type==='binary-tree'?['8','4','12','2','6','10','14']:['1','3','5','7','9','8','12'];
  const positions=[[420,100],[180,280],[660,280],[60,460],[300,460],[540,460],[780,460]];
  positions.forEach(([nx,ny],i)=>{node('n'+i,values[i],nx,ny,100,100,'ds-tree-node');if(i)edge('parent'+i,'n'+Math.floor((i-1)/2),'n'+i);});
 }else if(type==='experiment'){
  node('question','연구 질문',0,110,190,95,'flow-terminator');node('hypothesis','가설 설정',290,110);node('measure','실험·측정',580,110,190,95,'lab-beaker');node('analysis','자료 분석',880,110);node('conclusion','결론·후속 연구',440,330,230,95,'flow-document');
  edge('a','question','hypothesis');edge('b','hypothesis','measure');edge('c','measure','analysis');edge('d','analysis','conclusion','해석');
 }else if(type==='feedback'){
  node('input','목표 R(s)',0,120,160,90);node('sum','Σ',245,125,75,75,'circle');node('controller','제어기 C(s)',420,120);node('plant','시스템 G(s)',800,120);node('sensor','센서 H(s)',570,335);
  edge('a','input','sum','+');edge('b','sum','controller','E(s)');edge('c','controller','plant','U(s)');edge('d','plant','sensor','Y(s)');edge('e','sensor','sum','−');
 }
 return {version:1,mode:'merge',items,remove:[]};
}

/** Bounded spatial search avoids covering existing diagrams when inserting again. */
export function findResearchTemplatePosition(preset,center,intersects){
 for(let ring=0;ring<=4;ring++)for(let row=-ring;row<=ring;row++)for(let column=-ring;column<=ring;column++){
  if(Math.max(Math.abs(row),Math.abs(column))!==ring)continue;
  const x=center.x-preset.width/2+column*(preset.width+80),y=center.y-preset.height/2+row*(preset.height+80);
  if(!intersects({x:x-24,y:y-24,width:preset.width+48,height:preset.height+48}))return {x,y};
 }
 throw new Error('가까운 빈 공간을 찾지 못했습니다. 화면을 빈 곳으로 이동한 뒤 다시 삽입해주세요.');
}
