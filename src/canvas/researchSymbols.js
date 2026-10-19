/** Bounded native vector symbols shared by SVG, GPU, hit bounds and previews. */
export const researchSymbolCatalog = [
 ['flow-terminator','시작·종료',2,'development','순서도 흐름도 terminal'],
 ['flow-io','입력·출력',1.8,'development','순서도 데이터 IO'],
 ['flow-document','문서',1.4,'development','순서도 document'],
 ['flow-subprocess','서브프로세스',1.8,'development','미리 정의된 처리 함수'],
 ['flow-delay','지연',1.5,'development','순서도 대기 delay'],
 ['uml-class','UML 클래스',1.25,'development','속성 메서드 class'],
 ['uml-package','UML 패키지',1.5,'development','모듈 폴더 package'],
 ['server-rack','서버',.9,'development','서비스 인프라 rack'],
 ['ds-array','배열',3,'data','array 셀 인덱스'],
 ['ds-stack','스택',.9,'data','stack LIFO'],
 ['ds-queue','큐',3,'data','queue FIFO'],
 ['ds-linked-node','연결 리스트 노드',2,'data','포인터 linked list'],
 ['ds-tree-node','트리 노드',1,'data','tree graph 정점'],
 ['ds-hash-table','해시 버킷',1.7,'data','hash map dictionary'],
 ['math-axes','좌표축',1,'math','좌표 평면 함수 그래프'],
 ['math-number-line','수직선',4,'math','실수 number line'],
 ['math-vector','벡터',1.6,'math','방향 크기 vector'],
 ['math-angle','각도',1,'math','기하 angle'],
 ['math-venn','벤 다이어그램',1.6,'math','집합 교집합 합집합 venn'],
 ['math-matrix','행렬',1.4,'math','matrix 선형대수'],
 ['lab-beaker','비커',1,'science','실험 화학 beaker'],
 ['lab-flask','삼각 플라스크',1,'science','실험 화학 flask'],
 ['lab-test-tube','시험관',.45,'science','실험 tube'],
 ['lab-petri','페트리 접시',1.6,'science','생물 배양 petri'],
 ['science-atom','원자 모형',1,'science','물리 atom 전자'],
 ['science-wave','파동',2.5,'science','물리 sine wave 진동'],
 ['eng-resistor','저항',3,'engineering','회로 resistor'],
 ['eng-capacitor','커패시터',2,'engineering','회로 capacitor 축전기'],
 ['eng-inductor','인덕터',3,'engineering','회로 inductor 코일'],
 ['eng-ground','접지',1.2,'engineering','회로 ground'],
 ['eng-battery','전지',2,'engineering','회로 battery 전원'],
 ['eng-opamp','연산 증폭기',1.4,'engineering','회로 op amp amplifier'],
 ['eng-spring','스프링',3,'engineering','기계 spring 탄성'],
 ['eng-damper','댐퍼',2,'engineering','기계 damper 감쇠'],
 ['geo-parallelogram','평행사변형',1.5,'geometry','기하 사각형'],
 ['geo-right-triangle','직각삼각형',1,'geometry','기하 피타고라스'],
 ['geo-cube','정육면체',1,'geometry','입체 cube'],
 ['geo-sphere','구',1,'geometry','입체 sphere'],
 ['geo-cone','원뿔',1,'geometry','입체 cone'],
 ['geo-pyramid','각뿔',1,'geometry','입체 pyramid'],
].map(([id,label,aspect,category,keywords])=>({id,label,aspect,category,keywords}));
const types=new Set(researchSymbolCatalog.map(s=>s.id)),cache=new Map();
const p=(x,y)=>({x,y});
const line=(...coords)=>coords.map(([x,y])=>p(x,y));
const close=points=>[...points,{...points[0]}];
const rect=(x,y,w,h)=>close(line([x,y],[x+w,y],[x+w,y+h],[x,y+h]));
const ellipse=(cx,cy,rx,ry,start=0,end=2*Math.PI,n=40)=>{
 const points=Array.from({length:n+1},(_,i)=>p(cx+rx*Math.cos(start+(end-start)*i/n),cy+ry*Math.sin(start+(end-start)*i/n)));
 if(Math.abs(end-start-2*Math.PI)<1e-9)points[n]={...points[0]};
 return points;
};
export const isResearchSymbol=type=>types.has(type);
// Line-only glyphs and circuit terminals connect at the selection frame,
// never at an internal tick, capacitor plate or summing mark.
export const researchSymbolUsesFrameAnchors=type=>types.has(type)&&(type.startsWith('eng-')||type.startsWith('math-')||['science-atom','science-wave','ds-stack'].includes(type));
function base(type){
 if(cache.has(type))return cache.get(type);
 const paths=[],fills=[],outline=points=>{paths.push(points);fills.push(points);},stroke=(...coords)=>paths.push(line(...coords));
 if(type==='flow-terminator')outline(close([...ellipse(25,50,25,50,Math.PI/2,Math.PI*1.5,24),...ellipse(75,50,25,50,-Math.PI/2,Math.PI/2,24)]));
 else if(type==='flow-io'||type==='geo-parallelogram')outline(close(line([22,0],[100,0],[78,100],[0,100])));
 else if(type==='flow-document'){
  outline(close([...line([0,0],[100,0],[100,80]),...Array.from({length:33},(_,i)=>p(100-i*100/32,80+14*Math.sin(i/32*2*Math.PI)))]));
 }else if(type==='flow-subprocess'){outline(rect(0,0,100,100));stroke([12,0],[12,100]);stroke([88,0],[88,100]);}
 else if(type==='flow-delay')outline(close([...line([0,0],[50,0]),...ellipse(50,50,50,50,-Math.PI/2,Math.PI/2,32),p(0,100)]));
 else if(type==='uml-class'){outline(rect(0,0,100,100));stroke([0,28],[100,28]);stroke([0,62],[100,62]);}
 else if(type==='uml-package'){outline(close(line([0,0],[40,0],[48,18],[100,18],[100,100],[0,100])));stroke([0,18],[48,18]);}
 else if(type==='server-rack'){
  outline(rect(10,0,80,100));for(let i=0;i<3;i++){paths.push(rect(18,8+i*30,64,22));stroke([25,19+i*30],[50,19+i*30]);paths.push(ellipse(72,19+i*30,3,3));}
 }else if(type==='ds-array'||type==='ds-queue'){
  outline(rect(0,18,100,64));for(let i=1;i<5;i++)stroke([i*20,18],[i*20,82]);
  if(type==='ds-queue'){stroke([0,8],[26,8]);stroke([20,2],[26,8],[20,14]);stroke([74,92],[100,92]);stroke([94,86],[100,92],[94,98]);}
 }else if(type==='ds-stack'){
  stroke([0,0],[0,100],[100,100],[100,0]);for(let i=1;i<4;i++)stroke([0,i*25],[100,i*25]);
 }else if(type==='ds-linked-node'){outline(rect(0,0,100,100));stroke([68,0],[68,100]);paths.push(ellipse(84,50,5,5));}
 else if(type==='ds-tree-node')outline(ellipse(50,50,50,50));
 else if(type==='ds-hash-table'){
  outline(rect(0,0,100,100));stroke([30,0],[30,100]);for(let i=1;i<4;i++)stroke([0,i*25],[100,i*25]);
 }else if(type==='math-axes'){
  stroke([0,80],[100,80]);stroke([94,74],[100,80],[94,86]);stroke([20,100],[20,0]);stroke([14,6],[20,0],[26,6]);
  for(let i=1;i<5;i++){if(i!==1)stroke([i*20,77],[i*20,83]);if(i!==4)stroke([17,i*20],[23,i*20]);}
 }else if(type==='math-number-line'){
  stroke([0,50],[100,50]);stroke([7,35],[0,50],[7,65]);stroke([93,35],[100,50],[93,65]);for(let i=1;i<8;i++)stroke([i*12.5,35],[i*12.5,65]);
 }else if(type==='math-vector'){stroke([0,100],[100,0]);stroke([73,4],[100,0],[96,27]);}
 else if(type==='math-angle'){stroke([0,0],[0,100],[100,100]);paths.push(ellipse(0,100,38,38,-Math.PI/2,0,24));}
 else if(type==='math-venn'){paths.push(ellipse(35,50,35,50),ellipse(65,50,35,50));}
 else if(type==='math-matrix'){
  stroke([12,0],[0,0],[0,100],[12,100]);stroke([88,0],[100,0],[100,100],[88,100]);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)paths.push(ellipse(25+j*25,20+i*30,2.5,2.5,0,2*Math.PI,12));
 }else if(type==='lab-beaker'){
  outline(close(line([4,0],[96,0],[90,10],[90,100],[10,100],[10,10])));stroke([10,64],[90,64]);for(let i=0;i<3;i++)stroke([70,24+i*14],[90,24+i*14]);
 }else if(type==='lab-flask'){
  outline(close(line([33,0],[67,0],[67,10],[62,10],[62,36],[100,100],[0,100],[38,36],[38,10],[33,10])));stroke([16,74],[84,74]);
 }else if(type==='lab-test-tube'){
  outline(close([...line([8,0],[92,0],[92,70]),...ellipse(50,70,42,30,0,Math.PI,24),p(8,0)]));stroke([8,46],[92,46]);
 }else if(type==='lab-petri'){
  outline(close([...ellipse(50,26,50,20,Math.PI,2*Math.PI,24),...line([100,26],[100,72]),...ellipse(50,72,50,22,0,Math.PI,24),p(0,26)]));paths.push(ellipse(50,26,50,20),ellipse(50,70,40,13));
 }else if(type==='science-atom'){
  for(const angle of [0,Math.PI/3,-Math.PI/3])paths.push(ellipse(50,50,46,15).map(q=>p(50+(q.x-50)*Math.cos(angle)-(q.y-50)*Math.sin(angle),50+(q.x-50)*Math.sin(angle)+(q.y-50)*Math.cos(angle))));
  outline(ellipse(50,50,5,5));
 }else if(type==='science-wave')paths.push(Array.from({length:65},(_,i)=>p(i*100/64,50-42*Math.sin(i/64*4*Math.PI))));
 else if(type==='eng-resistor'||type==='eng-spring'){
  stroke([0,50],[15,50]);paths.push(line([15,50],...Array.from({length:9},(_,i)=>[22+i*7, i%2?25:75]),[85,50]));stroke([85,50],[100,50]);
 }else if(type==='eng-capacitor'){stroke([0,50],[40,50]);stroke([40,0],[40,100]);stroke([60,0],[60,100]);stroke([60,50],[100,50]);}
 else if(type==='eng-inductor'){
  stroke([0,60],[14,60]);for(let i=0;i<4;i++)paths.push(ellipse(23+i*18,60,9,45,Math.PI,2*Math.PI,20));stroke([86,60],[100,60]);
 }else if(type==='eng-ground'){stroke([50,0],[50,46]);stroke([0,46],[100,46]);stroke([18,72],[82,72]);stroke([36,100],[64,100]);}
 else if(type==='eng-battery'){
  stroke([0,50],[32,50]);stroke([32,0],[32,100]);stroke([49,25],[49,75]);stroke([65,0],[65,100]);stroke([82,25],[82,75]);stroke([82,50],[100,50]);
 }else if(type==='eng-opamp'){
  outline(close(line([18,0],[82,50],[18,100])));stroke([0,25],[18,25]);stroke([0,75],[18,75]);stroke([82,50],[100,50]);stroke([26,23],[36,23]);stroke([31,18],[31,28]);stroke([26,75],[36,75]);
 }else if(type==='eng-damper'){
  stroke([0,50],[22,50]);stroke([22,15],[22,85]);stroke([22,25],[78,25],[78,75],[22,75]);stroke([52,25],[52,75]);stroke([52,50],[100,50]);
 }else if(type==='geo-right-triangle'){outline(close(line([0,0],[0,100],[100,100])));stroke([0,80],[20,80],[20,100]);}
 else if(type==='geo-cube'){
  outline(close(line([0,25],[65,25],[100,0],[100,75],[65,100],[0,100])));stroke([0,25],[35,0],[100,0]);stroke([65,25],[65,100]);stroke([35,0],[35,75],[0,100]);stroke([35,75],[100,75]);
 }else if(type==='geo-sphere'){outline(ellipse(50,50,50,50));paths.push(ellipse(50,50,50,15),ellipse(50,50,16,50));}
 else if(type==='geo-cone'){
  outline(close([...line([50,0],[100,80]),...ellipse(50,80,50,20,0,Math.PI,24)]));paths.push(ellipse(50,80,50,20));stroke([0,80],[50,0]);
 }else if(type==='geo-pyramid'){
  outline(close(line([50,0],[100,75],[50,100],[0,75])));stroke([50,0],[50,100]);stroke([0,75],[50,55],[100,75]);stroke([50,0],[50,55]);
 }
 // Normalize once, including open symbols, so previews/selection/ports share bounds.
 const vertices=paths.flat(),xs=vertices.map(q=>q.x),ys=vertices.map(q=>q.y),x0=Math.min(...xs),y0=Math.min(...ys),w=Math.max(...xs)-x0||1,h=Math.max(...ys)-y0||1;
 const scale=path=>path.map(q=>p((q.x-x0)/w,(q.y-y0)/h));
 const result={paths:paths.map(scale),fills:fills.map(scale)};cache.set(type,result);return result;
}
export function researchSymbolGeometry(type,width,height){
 if(!types.has(type))return null;
 const b=base(type),scale=path=>path.map(q=>p(q.x*width,q.y*height));
 return {paths:b.paths.map(scale),fills:b.fills.map(scale)};
}
