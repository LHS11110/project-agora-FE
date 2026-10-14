import { writeFileSync } from 'node:fs';
import { planManifest } from '../src/canvas/asCode/manifest.js';

const C={ink:'#38554b',muted:'#83938a',paper:'#ffffff',canvas:'#f6f7f2',line:'#e0e7e1',green:'#dcece0',lavender:'#e5dff3',peach:'#f7e3d6',blue:'#dceaf4',yellow:'#f5efd4'};
const items={}; let prefix='overview',serial=0;
const add=(label,item)=>{const id=`${prefix}-${String(++serial).padStart(3,'0')}-${label}`;items[id]={...item,permission:'default'};return id;};
const shape=(label,x,y,w,h,fill=C.paper,options={})=>add(label,{kind:'shape',shapeType:'rectangle',x,y,width:w,height:h,fill,color:C.line,strokeWidth:1,strokeEnabled:true,depth:0,shadowEnabled:false,...options});
const text=(label,value,x,y,w,fs=13,options={})=>{const s=fs/13,lines=value.split('\n').length;return add(label,{kind:'text',text:value,x:x-12*s,y:y-10*s,width:w+24*s,height:lines*fs*1.6+20*s+6,fontSize:fs,renderMode:'plain',depth:3,shadowEnabled:false,...options});};
const dot=(label,x,y,size,fill=C.green)=>shape(label,x,y,size,size,fill,{shapeType:'circle',strokeEnabled:false,depth:2});
const button=(label,value,x,y,w=120,fill=C.green)=>{shape(label,x,y,w,34,fill,{depth:2,strokeEnabled:false});text(label+'-label',value,x+12,y+6,w-24,12);};
const card=(label,x,y,w,h,fill=C.paper)=>shape(label,x,y,w,h,fill,{depth:1,shadowEnabled:true,shadowBlur:4,shadowOpacity:.06,shadowOffsetY:3});
const stroke=(label,points,color=C.ink,width=2)=>add(label,{kind:'stroke',points:points.map(([x,y])=>({x,y,pressure:.5})),brush:'pen',strokeWidth:width,color,complete:true,simulatePressure:false,depth:2,shadowEnabled:false});
const specs=[
 ['01','Workspace overview','Projects, activity and team health','web','green'],
 ['02','Analytics & reports','Weekly signals and delivery metrics','web','lavender'],
 ['03','Project board','Sprint planning / ready / in progress / done','kanban','peach'],
 ['04','Team calendar','Editorial schedule and review checkpoints','calendar','blue'],
 ['05','Mobile / Home','Personal workspace and daily focus','mobile','green'],
 ['06','Mobile / Tasks','Task list, details and quick actions','mobile','lavender'],
 ['07','Mobile / Insights','Activity, progress and notifications','mobile','peach'],
 ['08','Mobile / Checkout','Plan selection, payment and confirmation','mobile','blue'],
 ['09','Foundations','Color tokens, typography and spacing','system','green'],
 ['10','Component library','Buttons, navigation, tags and form states','system','lavender'],
 ['11','Onboarding & forms','Sign up, workspace setup and invitations','forms','peach'],
 ['12','Marketing landing','Value proposition, pricing and social proof','landing','blue'],
 ['13','Customer journey','Discover → start → collaborate → grow','flow','green'],
 ['14','Research wall','Interview insights, hypotheses and next steps','research','lavender'],
 ['15','Release planning','Roadmap, changelog and handoff notes','kanban','peach'],
 ['16','Design review','Iteration history, annotations and QA checklist','review','blue'],
];

// A 60-object cover and 16 independently editable 90-object work areas.
shape('cover-frame',80,60,1420,820,C.canvas,{color:C.line,shadowEnabled:true,shadowBlur:8,shadowOpacity:.06});
shape('cover-rule',130,108,48,5,C.ink,{strokeEnabled:false,depth:2});
text('project-title','NORTHSTAR / Product studio',130,134,1240,44);
text('project-subtitle','A MULTI-TEAM DESIGN WORKSPACE   ·   16 WORK AREAS   ·   1,500 EDITABLE OBJECTS',132,212,1200,14);
button('edition','DESIGN FILE  /  V2.4',1220,105,222,C.green);
card('project-brief',132,260,1316,68,C.paper);
text('brief-heading','Design in motion.',152,276,390,20);
text('brief-copy','Web · Mobile · Components · Research     /     Explore the board, then make it yours.',550,281,856,13);
for(let i=0;i<specs.length;i++){
 const [n,title,,,tone]=specs[i],x=132+i%4*334,y=352+Math.floor(i/4)*104;
 card('map-'+n,x,y,314,84,C[tone]);dot('map-marker-'+n,x+16,y+20,28,C.paper);
 text('map-label-'+n,n+'  '+title,x+57,y+24,243,13);
}
text('cover-footer','SPACE + DRAG  /  PAN THE WORKSPACE     ·     CTRL + WHEEL  /  ZOOM     ·     OBJECT LIST  /  JUMP TO A SCREEN',132,800,1316,12);
text('cover-note','Every shape, label, chart mark and annotation is an editable canvas object.',132,835,1270,11);
dot('cover-seal',1420,807,28,C.green);
if(serial!==60)throw Error('Cover has '+serial+' objects');

function base(n,title,subtitle,x,y,tone){
 shape('board-frame',x,y,1340,1080,C.canvas,{color:C.line,shadowEnabled:true,shadowOpacity:.055,shadowBlur:8});
 shape('board-rule',x+36,y+36,34,4,C[tone],{strokeEnabled:false});
 text('screen-heading',n+' / '+title,x+36,y+52,1040,25);
 text('screen-description',subtitle,x+36,y+96,1120,12);
 button('screen-stage','IN DESIGN REVIEW',x+1104,y+46,198,C[tone]);
}
function desktop(n,title,x,y,tone){
 card('app-frame',x+36,y+145,1268,636);
 shape('sidebar',x+36,y+145,176,636,C[tone],{depth:2,strokeEnabled:false});
 dot('brand-symbol',x+58,y+175,26,C.paper);text('brand-name','NORTHSTAR',x+96,y+178,105,12);
 const nav=['Overview','Projects','My tasks','Calendar','Insights','Settings'];
 nav.forEach((value,i)=>{dot('nav-icon-'+i,x+59,y+240+i*56,14,i===0?C.ink:C.paper);text('nav-'+i,value,x+87,y+237+i*56,117,13);});
 text('workspace-plan','Studio workspace\n12 people · Pro plan',x+58,y+684,134,11);
 text('page-heading',title,x+248,y+172,700,24);
 text('page-helper','A clearer picture of the work that matters.',x+250,y+214,690,12);
 button('primary-action','+ Create new',x+1134,y+170,136,C[tone]);
 shape('search-field',x+248,y+254,1020,36,C.canvas,{depth:2});text('search-label','Search projects, teammates or updates…',x+266,y+262,935,12);
}
function dashboard(x,y,tone,n){
 const metrics=[['Active projects','24','+4 this week'],['Delivery health','94%','On track'],['Team activity','1,284','+18% from last week'],['Open reviews','08','2 ready to approve']];
 metrics.forEach(([label,value,hint],i)=>{const cx=x+248+i*260;card('metric-'+i,cx,y+310,240,112,i===0?C[tone]:C.paper);text('metric-name-'+i,label,cx+16,y+326,206,12);text('metric-value-'+i,value,cx+16,y+348,180,29);text('metric-trend-'+i,hint,cx+16,y+392,206,10);});
 card('chart',x+248,y+448,660,304);text('chart-title',n==='02'?'Delivery velocity':'Activity over time',x+270,y+466,468,18);text('chart-range','LAST 18 DAYS',x+738,y+472,149,10);
 for(let i=0;i<18;i++){const height=38+(i*37+n.charCodeAt(1)*7)%160;shape('chart-bar-'+i,x+277+i*33,y+699-height,18,height,i%4===0?C.ink:C[tone],{depth:2,strokeEnabled:false});}
 for(let i=0;i<6;i++)text('chart-axis-'+i,String(1+i*3).padStart(2,'0'),x+270+i*101,y+719,48,10);
 card('activity',x+928,y+448,340,304);text('activity-title','Recent work',x+946,y+467,305,18);
 ['Website launch / approved','Mobile onboarding / review','Design tokens / updated'].forEach((value,i)=>{dot('activity-dot-'+i,x+948,y+529+i*66,18,C[tone]);text('activity-row-'+i,value,x+980,y+526+i*66,264,11);});
}
function kanban(x,y,tone,release=false){
 const columns=release?['Now','Next','Later']:['Ready','In progress','Done'];
 columns.forEach((name,c)=>{const cx=x+248+c*344;shape('column-'+c,cx,y+315,326,438,C.canvas,{depth:2});text('column-title-'+c,name+'  /  03',cx+16,y+331,295,15);
 for(let r=0;r<3;r++){const cy=y+380+r*119;card('task-'+c+'-'+r,cx+14,cy,298,102);shape('task-tag-'+c+'-'+r,cx+28,cy+13,64,18,C[tone],{depth:2,strokeEnabled:false});text('task-label-'+c+'-'+r,['DESIGN','CONTENT','PRODUCT'][r],cx+34,cy+13,60,8);text('task-title-'+c+'-'+r,['Refine the navigation','Validate core journeys','Prepare developer handoff'][r],cx+28,cy+42,270,12);dot('task-avatar-'+c+'-'+r,cx+28,cy+76,14,C[tone]);}
 });
}
function calendar(x,y,tone){
 text('month-title','October 2026',x+254,y+320,430,20);
 ['MON','TUE','WED','THU','FRI'].forEach((value,i)=>text('day-label-'+i,value,x+270+i*200,y+366,176,11));
 for(let r=0;r<3;r++)for(let c=0;c<5;c++){const cx=x+248+c*204,cy=y+401+r*106;shape('day-'+r+'-'+c,cx,cy,194,96,C.paper,{depth:2});text('date-'+r+'-'+c,String(5+r*7+c),cx+12,cy+10,50,12);
 if((r+c)%2===0){shape('event-'+r+'-'+c,cx+12,cy+48,168,29,C[tone],{depth:2,strokeEnabled:false});text('event-label-'+r+'-'+c,['Design review','User interviews','Product sync'][(r+c)%3],cx+18,cy+54,157,10);}}
}
function mobile(x,y,tone,n){
 const rows=n==='08'?['Studio plan · $12 / month','Payment card · •••• 4242','Billing email · alex@studio.example']:n==='07'?['Projects shipped · 12','Review turnaround · 1.4 days','Team collaboration · +18%']:n==='06'?['Refine onboarding · High priority','Review typography · Due today','Prepare handoff · In progress']:['Review the new homepage','Invite your collaborators','Check the release notes'];
 const names=n==='08'?['Choose a plan','Payment details','You’re all set']:n==='06'?['My tasks','Task details','Quick actions']:n==='07'?['Weekly pulse','Activity','Notifications']:['Today','Projects','Profile'];
 names.forEach((name,i)=>{const px=x+86+i*402,py=y+172;card('phone-'+i,px,py,342,610);shape('phone-top-'+i,px+110,py+10,122,10,C.line,{depth:2,strokeEnabled:false});text('phone-status-'+i,'9:41                         ●  ▰',px+24,py+31,290,11);text('phone-screen-'+i,name,px+24,py+88,294,23);text('phone-greeting-'+i,'Your workspace, at your pace.',px+24,py+128,287,11);
 card('mobile-focus-'+i,px+20,py+168,302,108,C[tone]);text('mobile-focus-title-'+i,(n==='08'?['Choose a plan that fits','Secure, simple checkout','Welcome to Studio']:n==='07'?['Your week, at a glance','A little progress each day','Keep the momentum']:['Today’s focus','Make progress','Built for your team'])[i],px+36,py+184,267,17);text('mobile-focus-hint-'+i,['3 tasks to move forward','Weekly goal · 72% complete','One shared source of truth'][i],px+36,py+225,268,11);
 for(let r=0;r<3;r++){const cy=py+308+r*66;shape('mobile-row-'+i+'-'+r,px+20,cy,302,54,C.canvas,{depth:2,strokeEnabled:false});dot('mobile-row-icon-'+i+'-'+r,px+34,cy+17,20,C[tone]);text('mobile-row-title-'+i+'-'+r,rows[r],px+66,cy+18,242,11);}
 button('mobile-cta-'+i,n==='08'?['Choose Studio','Confirm payment','Go to workspace'][i]:i===2?'Continue':'View workspace',px+20,py+533,302,C[tone]);shape('home-indicator-'+i,px+119,py+591,104,4,C.ink,{depth:2,strokeEnabled:false});
 });
}
function system(x,y,tone,n){
 const palette=[['Forest','#38554b'],['Sage',C.green],['Lilac',C.lavender],['Apricot',C.peach],['Sky',C.blue],['Canvas',C.canvas]];
 palette.forEach(([name,fill],i)=>{const cx=x+44+i*213;card('token-card-'+i,cx,y+164,198,149);shape('token-color-'+i,cx+12,y+177,174,74,fill,{depth:2,strokeEnabled:false});text('token-name-'+i,name,cx+14,y+264,166,13);text('token-value-'+i,fill.toUpperCase(),cx+14,y+287,166,10);});
 text('type-heading',n==='09'?'Typography / a clear hierarchy':'Components / interaction states',x+44,y+345,1200,20);
 const sizes=[32,24,18,14];sizes.forEach((fs,i)=>{text('type-sample-'+i,['Make room for ideas.','Clarity in every detail.','A shared design language.','Thoughtful defaults, less friction.'][i],x+48,y+398+i*73,842,fs);text('type-caption-'+i,'TYPE / '+fs+' PX',x+1040,y+412+i*73,234,11);});
 for(let r=0;r<2;r++)for(let c=0;c<6;c++){const cx=x+44+c*212,cy=y+734+r*67;button('component-'+r+'-'+c,['Primary','Secondary','Selected','Disabled','Success','Warning'][c],cx,cy,194,r?C.paper:[C.green,C.canvas,C.lavender,C.line,C.blue,C.peach][c]);}
}
function forms(x,y,tone){
 ['Create your account','Set up a workspace','Invite the team'].forEach((name,c)=>{const px=x+44+c*427;card('form-card-'+c,px,y+165,410,617);dot('form-step-'+c,px+24,y+190,30,C[tone]);text('form-step-label-'+c,String(c+1).padStart(2,'0'),px+30,y+193,30,12);text('form-title-'+c,name,px+24,y+248,360,22);text('form-description-'+c,'A few details, then you’re ready to go.',px+24,y+297,360,12);
 for(let r=0;r<4;r++){const cy=y+349+r*78;text('field-label-'+c+'-'+r,['Full name','Email address','Workspace name','Your role'][r],px+24,cy,360,11);shape('field-'+c+'-'+r,px+24,cy+25,362,36,C.canvas,{depth:2});text('field-placeholder-'+c+'-'+r,['Alex Morgan','alex@studio.example','Northstar studio','Product designer'][r],px+36,cy+33,330,12);}
 button('form-submit-'+c,'Continue →',px+24,y+692,362,C[tone]);text('form-footnote-'+c,'Your information stays in your workspace.',px+24,y+744,358,10);});
}
function landing(x,y,tone){
 card('site-frame',x+36,y+154,1268,645);text('site-logo','NORTHSTAR',x+68,y+185,290,15);text('site-nav','Product       Customers       Pricing       Resources',x+488,y+187,630,12);button('site-login','Get started',x+1151,y+180,122,C[tone]);
 shape('hero-surface',x+60,y+243,1220,240,C[tone],{depth:2,strokeEnabled:false});text('hero-eyebrow','ONE PLACE FOR WHAT’S NEXT',x+88,y+266,890,12);text('hero-title','Bring your best work\ninto focus.',x+88,y+296,870,36);text('hero-description','Plan clearly. Work together. Turn ideas into meaningful progress.',x+88,y+428,1030,13);
 for(let i=0;i<3;i++){const cx=x+60+i*412;card('pricing-'+i,cx,y+521,396,242);text('pricing-name-'+i,['Starter','Studio','Scale'][i],cx+20,y+539,356,17);text('pricing-cost-'+i,['Free','$12','$29'][i],cx+20,y+575,350,29);text('pricing-unit-'+i,'PER PERSON / MONTH',cx+20,y+624,350,10);button('pricing-action-'+i,['Start creating','Try Studio','Talk to us'][i],cx+20,y+670,356,C[tone]);}
}
function flow(x,y,tone){
 const nodes=[];const names=['Discover a shared need','Create your workspace','Invite collaborators','Plan the first sprint','Review progress','Celebrate the outcome'];
 names.forEach((value,i)=>{const cx=x+66+(i<3?i%3:2-i%3)*427,cy=y+197+Math.floor(i/3)*292;const id=card('journey-step-'+i,cx,cy,346,187,C[tone]);nodes.push(id);text('journey-number-'+i,'STEP / '+String(i+1).padStart(2,'0'),cx+20,cy+20,304,11);text('journey-name-'+i,value,cx+20,cy+60,304,18);text('journey-helper-'+i,['Awareness → consideration','A guided, calm first run','People make the workspace','One priority at a time','A feedback loop, not a gate','Build a habit of momentum'][i],cx+20,cy+117,304,11);});
 for(let i=0;i<5;i++){
  if(i<2)shape('journey-connection-'+i,x+66+i*427+358,y+197+82,56,23,C.ink,{shapeType:'arrow',strokeEnabled:false,depth:2,endHead:'triangle',startHead:'none'});
  else if(i===2)shape('journey-connection-'+i,x+66+2*427+137,y+197+230,74,23,C.ink,{shapeType:'arrow',strokeEnabled:false,depth:2,rotation:90,endHead:'triangle',startHead:'none'});
  else shape('journey-connection-'+i,x+66+(4-i)*427+358,y+489+82,56,23,C.ink,{shapeType:'arrow',strokeEnabled:false,depth:2,rotation:180,endHead:'triangle',startHead:'none'});
 }
 text('flow-caption','TOUCHPOINTS / Landing · Onboarding · Invitation · Board · Review · Insights',x+66,y+810,1200,13);
}
function research(x,y,tone,review=false){
 const headings=review?['What changed','Open questions','Ready to ship']:['What we heard','What we believe','What we’ll test'];
 headings.forEach((heading,c)=>{const cx=x+44+c*428;text('research-column-'+c,heading,cx+4,y+171,394,20);
 for(let r=0;r<3;r++){const cy=y+227+r*187;shape('insight-'+c+'-'+r,cx,cy,405,167,[C.yellow,C[tone],C.peach][(c+r)%3],{depth:1,shadowEnabled:true,shadowOpacity:.06,shadowBlur:3,rotation:(r-c)*.5});text('insight-label-'+c+'-'+r,['INTERVIEW / 03','HYPOTHESIS / 02','NEXT ACTION / 01'][c],cx+20,cy+18,368,10);text('insight-copy-'+c+'-'+r,[['“Show me what matters\nwithout making me search.”','Review steps feel clearer\nwhen they have an owner.','People want a calm place\nto see the whole picture.'],['Prioritize the next action\nover another empty metric.','Keep defaults predictable\nacross desktop and mobile.','Make shared progress visible\nwithout adding more noise.'],['Test the first-run checklist\nwith 5 new collaborators.','Compare invitation copy\nand measure completion.','Validate keyboard navigation\nand interaction states.']][c][r],cx+20,cy+51,365,14);text('insight-owner-'+c+'-'+r,'ALEX M.    /    REVIEWED 12 OCT',cx+20,cy+135,366,10);}
 });
}
function finishBudget(x,y,tone){
 let remaining=90-serial;if(remaining<0)throw Error(prefix+' exceeds budget: '+serial);
 if(remaining%2){text('handoff-note','HANDOFF / Each component remains independently editable.',x+42,y+826,1258,11);remaining--;}
 for(let i=0;i<remaining/2;i++){const cx=x+44+i%6*212,cy=y+848+Math.floor(i/6)*42;
  const labels=['Default','Hover','Focus','Selected','Pending','Complete','Spacing / 8','Spacing / 16','Spacing / 24','Radius / 6','Stroke / 1','Shadow / soft'];
  shape('state-sample-'+i,cx,cy,194,29,i%3===0?C[tone]:C.paper,{depth:2,strokeEnabled:true});
  text('state-caption-'+i,labels[i%labels.length],cx+12,cy+7,170,10);
 }
 if(serial!==90)throw Error(prefix+' has '+serial+' objects');
}

const sections=[];
for(let i=0;i<specs.length;i++){
 const [n,title,subtitle,type,tone]=specs[i];prefix='area-'+n;serial=0;
 const x=i<4?1800+i*1500:80+(i-4)%4*1500,y=i<4?60:1250+Math.floor((i-4)/4)*1150;
 base(n,title,subtitle,x,y,tone);
 if(['web','kanban','calendar'].includes(type)){desktop(n,title,x,y,tone);if(type==='web')dashboard(x,y,tone,n);if(type==='kanban')kanban(x,y,tone,n==='15');if(type==='calendar')calendar(x,y,tone);}
 else if(type==='mobile')mobile(x,y,tone,n);
 else if(type==='system')system(x,y,tone,n);
 else if(type==='forms')forms(x,y,tone);
 else if(type==='landing')landing(x,y,tone);
 else if(type==='flow')flow(x,y,tone);
 else if(type==='research'||type==='review')research(x,y,tone,type==='review');
 finishBudget(x,y,tone);sections.push({id:prefix,title,x,y,width:1340,height:1080,objects:serial});
}
const manifest={version:1,mode:'merge',items,remove:[]};
if(Object.keys(items).length!==1500)throw Error('Expected exactly 1500 objects');
planManifest(manifest,{},'default');
writeFileSync(new URL('../examples/northstar-product-studio-1500.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
writeFileSync(new URL('../examples/northstar-product-studio-1500-layout.json',import.meta.url),JSON.stringify({name:'NORTHSTAR · Product Studio / 1,500 Objects',objects:1500,cover:{x:80,y:60,width:1420,height:820,objects:60},sections},null,2)+'\n');
console.log('Generated NORTHSTAR: '+Object.keys(items).length+' objects, '+sections.length+' work areas');
