import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { planManifest } from '../src/canvas/asCode/manifest.js';
import { logicGateCatalog, logicPorts } from '../src/canvas/logicGates.js';
const C={ink:'#35554a',line:'#d7e1d9',green:'#e4efe8',blue:'#e5edf7',purple:'#eee8f6',orange:'#b58133',paper:'#fbfcfa',zero:'#a6b5ac'};
export function fullAdder(a,b,cin){const p=a^b;return {sum:p^cin,cout:(a&b)|(p&cin)};}
export function rippleAdder8(a,b,cin=0){
 if(!Number.isInteger(a)||a<0||a>255||!Number.isInteger(b)||b<0||b>255||![0,1].includes(cin))throw Error('8비트 입력과 0/1 캐리가 필요합니다.');
 const stages=[];let carry=cin,sum=0;
 for(let i=0;i<8;i++){const stage={bit:i,a:(a>>i)&1,b:(b>>i)&1,cin:carry,...fullAdder((a>>i)&1,(b>>i)&1,carry)};stages.push(stage);sum|=stage.sum<<i;carry=stage.cout;}
 return {sum,cout:carry,stages};
}
export function generateAdderCanvas(){
 const items={},sample=rippleAdder8(0x35,0x1b,0);
 const add=(id,item)=>{if(items[id])throw Error('Duplicate '+id);items[id]={permission:'default',shadowEnabled:false,...item};return id;};
 const rect=(id,x,y,w,h,fill=C.paper,extra={})=>add(id,{kind:'shape',shapeType:'rectangle',x,y,width:w,height:h,fill,color:C.line,strokeWidth:1,depth:-3,...extra});
 const text=(id,value,x,y,w,fs=14,extra={})=>{const s=fs/13;return add(id,{kind:'text',renderMode:'markdown',text:value,x:x-12*s,y:y-10*s,width:w+24*s+4,height:value.split('\n').length*fs*2.2+20*s+10,fontSize:fs,depth:3,...extra});};
 const dot=(id,x,y,value,extra={})=>add(id,{kind:'shape',shapeType:'circle',x:x-3,y:y-3,width:6,height:6,fill:value===1?C.ink:C.zero,color:C.ink,strokeEnabled:false,depth:2,...extra});
 const gate=(id,type,x,y,w,h,fill=C.green,extra={})=>add(id,{kind:'shape',shapeType:type,x,y,width:w,height:h,fill,color:C.ink,strokeWidth:1.8,strokeEnabled:true,depth:1,...extra});
 const wire=(id,from,to,fromPort,toPort,color=C.ink)=>add(id,{kind:'connector',from,to,...(fromPort?{fromPort}:{}),...(toPort?{toPort}:{}),startHead:'none',endHead:'none',strokeWidth:1.8,color,bend:0,depth:0});
 rect('rca-board',25,120,1535,930);
 text('rca-eyebrow','DIGITAL LOGIC / 8-BIT RIPPLE-CARRY ADDER',65,155,1400,14);
 text('rca-title','8비트 전가산기',65,198,1400,32);
 text('rca-subtitle','FA0(LSB) → FA7(MSB) · 각 단계가 Aᵢ + Bᵢ + Cᵢ를 계산하고 다음 단계로 캐리를 전달합니다.',65,262,1400,14);
 text('rca-vector','입력 A = 53 (00110101₂)     +     입력 B = 27 (00011011₂)     +     캐리 입력 Cin = 0',65,302,1440,16);
 rect('rca-input-a-rail',80,337,1450,58,C.green,{depth:-2});
 rect('rca-input-b-rail',80,407,1450,58,C.blue,{depth:-2});
 text('rca-input-a-title','A',93,356,32,17);
 text('rca-input-b-title','B',93,426,32,17);
 for(const stage of sample.stages){
  const i=stage.bit,x=100+i*170,y=540,w=130,h=120,groupId='rca-stage-'+i;
  const fa=gate('rca-fa-'+i,'logic-full-adder',x,y,w,h,i%2?C.blue:C.green,{groupId});
  const aX=x+w*.35,bX=x+w*.65,sumX=x+w*.5;
  rect('rca-A'+i,aX-33,348,66,36,stage.a? '#c2dbc9':'#ffffff',{depth:2,groupId,color:'#648674'});
  rect('rca-B'+i,bX-33,418,66,36,stage.b? '#c5d8ed':'#ffffff',{depth:2,groupId,color:'#587a9b'});
  text('rca-a-value-'+i,`A${i} · ${stage.a}`,aX-24,357,62,14,{groupId});
  text('rca-b-value-'+i,`B${i} · ${stage.b}`,bX-24,427,62,14,{groupId});
  dot('rca-S'+i,sumX,740,stage.sum,{groupId});
  wire('rca-a-wire-'+i,'rca-A'+i,fa,null,'a');wire('rca-b-wire-'+i,'rca-B'+i,fa,null,'b','#587a9b');wire('rca-s-wire-'+i,fa,'rca-S'+i,'sum',null);
  text('rca-input-'+i,`비트 ${i}`,x+40,482,90,13,{groupId});
  text('rca-pin-a-'+i,'A',aX-5,512,16,11,{groupId});text('rca-pin-b-'+i,'B',bX-5,512,16,11,{groupId});
  text('rca-stage-label-'+i,'FA'+i,x+4,683,55,13,{groupId});
  text('rca-sum-label-'+i,`S${i} = ${stage.sum}`,sumX-23,765,90,15,{groupId});
  if(i){wire('rca-carry-'+i,'rca-fa-'+(i-1),fa,'cout','cin',C.orange);text('rca-carry-label-'+i,'C'+i+'='+stage.cin,x-43,570,70,11);}
 }
 rect('rca-cin',32,583,52,34,'#f3e7ce',{depth:2,color:C.orange});text('rca-cin-value','0',49,590,32,17);wire('rca-cin-wire','rca-cin','rca-fa-0',null,'cin',C.orange);text('rca-cin-label','Cin',35,554,70,13);
 dot('rca-cout',1490,600,sample.cout);wire('rca-cout-wire','rca-fa-7','rca-cout','cout',null,C.orange);text('rca-cout-label','Cout=0',1435,570,100,12);
 text('rca-result','S[7:0] = 01010000₂ = 0x50 = 80    /    Cout = 0',80,825,1400,23);
 text('rca-note','초록 행은 입력 A, 파랑 행은 입력 B입니다. 진한 칸은 1, 흰 칸은 0이며 아래의 같은 비트 FA로 연결됩니다.\n왼쪽부터 비트 0~7(LSB → MSB), 결과를 읽는 순서는 S7…S0입니다. 주황색은 캐리 경로입니다. 게이트를 이동하거나 회전해도 연결선은 선택한 핀을 따라갑니다.',80,890,1410,14);
 text('rca-jump','아래쪽: 1비트 전가산기의 실제 게이트 구성 · 게이트 기호 · 진리표 · 캐리 발생 예시',80,1000,1400,13);
 rect('fa-detail-board',25,1120,1535,960);
 text('fa-detail-heading','1비트 내부 회로 / 모든 FA 단계가 이 구성을 사용합니다',65,1170,1430,27);
 text('fa-detail-description','XOR 2개 + AND 2개 + OR 1개 · 점이 있는 분기만 같은 신호로 연결됩니다.',65,1235,1430,14);
 gate('fa-xor-p','logic-xor',300,1320,140,100,C.purple);gate('fa-xor-s','logic-xor',650,1320,140,100,C.purple);
 gate('fa-and-g','logic-and',300,1630,140,100,C.green);gate('fa-and-h','logic-and',650,1510,140,100,C.green);gate('fa-or-c','logic-or',1000,1630,140,100,C.blue);
 for(const [id,label,x,y] of [['fa-A','입력 A',110,1350],['fa-B','입력 B',210,1450],['fa-Cin','캐리 입력',450,1550],['fa-P','P = A XOR B',520,1370],['fa-S','S',1300,1370],['fa-Cout','Cout',1300,1680]]){
  if(['fa-A','fa-B','fa-Cin'].includes(id)){
   const signal=id==='fa-Cin'?'Cin':id.slice(-1);
   rect(id,x-38,y-18,76,36,id==='fa-B'?C.blue:id==='fa-Cin'?'#f3e7ce':C.green,{depth:2,color:id==='fa-Cin'?C.orange:C.ink});
   text(id+'-value',signal,x-20,y-9,60,17);
  }else dot(id,x,y,1);
  text(id+'-label',label,x-32,y-46,200,14);
 }
 wire('fa-a-xor','fa-A','fa-xor-p',null,'a');wire('fa-b-xor','fa-B','fa-xor-p',null,'b', '#587a9b');
 wire('fa-a-and','fa-A','fa-and-g',null,'a');wire('fa-b-and','fa-B','fa-and-g',null,'b','#587a9b');
 wire('fa-p-junction','fa-xor-p','fa-P','out',null,'#8c6ba1');wire('fa-p-xor','fa-P','fa-xor-s',null,'a','#8c6ba1');wire('fa-p-and','fa-P','fa-and-h',null,'a','#8c6ba1');
 wire('fa-cin-xor','fa-Cin','fa-xor-s',null,'b',C.orange);wire('fa-cin-and','fa-Cin','fa-and-h',null,'b',C.orange);
 wire('fa-g-or','fa-and-g','fa-or-c','out','b');wire('fa-h-or','fa-and-h','fa-or-c','out','a');wire('fa-s-output','fa-xor-s','fa-S','out',null);wire('fa-cout-output','fa-or-c','fa-Cout','out',null,C.orange);
 for(const [id,label,x,y] of [['xor-p','XOR / P',300,1437],['xor-s','XOR / SUM',650,1437],['and-g','AND / A·B',300,1750],['and-h','AND / P·Cin',650,1630],['or-c','OR / CARRY',1000,1750]])text('fa-name-'+id,label,x,y,220,13);
 text('fa-equations','P = A XOR B\nS = P XOR Cin\nCout = (A AND B) OR (P AND Cin)',80,1860,1360,21);
 rect('gate-gallery-board',25,2150,1535,450);
 text('gate-gallery-title','도형 도구 → 논리 회로',65,2200,1420,26);
 for(const [i,spec] of logicGateCatalog.entries()){
  const x=80+i*161;gate('gallery-'+spec.id,spec.id,x,2320,118,84,i%2?C.blue:C.green);
  text('gallery-label-'+spec.id,spec.label,x,2430,150,13);
 }
 text('gate-gallery-note','기본·손그림 스타일, 테두리 굵기, 채우기·투명도 설정을 그대로 사용할 수 있습니다.',65,2520,1410,14);
 rect('truth-board',25,2670,1535,710);
 text('truth-title','진리표와 검산',65,2720,1400,27);
 add('truth-table',{kind:'table',columns:['A','B','Cin','S','Cout'],rows:Array.from({length:8},(_,i)=>{const a=(i>>2)&1,b=(i>>1)&1,cin=i&1,r=fullAdder(a,b,cin);return [a,b,cin,r.sum,r.cout].map(String);}),x:80,y:2810,width:660,height:430,fontSize:16,depth:2});
 text('truth-cases','53 + 27 + 0 = 80\nS = 01010000₂, Cout = 0\n255 + 1 + 0 = 256\nS = 00000000₂, Cout = 1\n255 + 255 + 1 = 511\nS = 11111111₂, Cout = 1',810,2820,660,20);
 text('truth-footer','Cout은 부호 없는 8비트 덧셈의 자리올림입니다. 입력 256 × 256 × Cin 2가지 조합을 회로 구성으로 검산했습니다.',65,3300,1410,13);
 const manifest={version:1,mode:'merge',items,remove:[]};planManifest(manifest,{},'default');return manifest;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){const manifest=generateAdderCanvas(),file=process.argv[2]||'docs/examples/8-bit-full-adder.canvas.json';writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({file,objects:Object.keys(manifest.items).length}));}
