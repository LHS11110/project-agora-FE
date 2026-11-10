export const ISSUE_TYPES=['Epic','Story','Task','Bug','Sub-task'];
export const PRIORITIES=['critical','high','medium','low'];
export const PROJECT_FIELDS=['projectType','projectBoard','projectIssueType','projectStatus','projectRequestedStatus','projectAssignee','projectPriority','projectStart','projectDue','projectParent','projectDependencies','projectSprint','projectPoints','projectRank','projectHistory','projectConfig'];
export const defaultProjectConfig=()=>({statuses:[{id:'todo',label:'To Do',approval:false},{id:'progress',label:'In Progress',approval:false},{id:'done',label:'Done',approval:false}],sprints:[],milestones:[]});
export const newProject=()=>({kind:'project',projectType:'board',title:'프로젝트',projectConfig:defaultProjectConfig(),width:1,height:.68});
export const newIssue=(board,rank=1024)=>({kind:'project',projectType:'issue',projectBoard:board,title:'새 작업',text:'',projectIssueType:'Task',projectStatus:'todo',projectRequestedStatus:'',projectAssignee:'',projectPriority:'medium',projectStart:'',projectDue:'',projectParent:'',projectDependencies:[],projectSprint:'',projectPoints:0,projectRank:rank,projectHistory:[],width:.28,height:.14});
export const isoDate=value=>typeof value==='string'&&(/^\d{4}-\d{2}-\d{2}$/.test(value))&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const text=(v,n)=>typeof v==='string'&&v.length<=n;
const id=v=>text(v,128)&&!['__proto__','prototype','constructor'].includes(v);
export function validProjectConfig(c){
 if(!c||!Array.isArray(c.statuses)||c.statuses.length<2||c.statuses.length>12||!Array.isArray(c.sprints)||c.sprints.length>200||!Array.isArray(c.milestones)||c.milestones.length>200)return false;
 for(const list of [c.statuses,c.sprints,c.milestones])if(list.some(v=>!v||typeof v!=='object')||new Set(list.map(v=>v.id)).size!==list.length||list.some(v=>!id(v.id)||!v.id))return false;
 if(c.statuses.some(v=>!text(v.label,80)||!v.label.trim()||typeof v.approval!=='boolean')||!c.statuses.some(s=>s.id==='todo')||!c.statuses.some(s=>s.id==='done'))return false;
 if(c.sprints.filter(s=>s.state==='active').length>1)return false;
 if(c.sprints.some(s=>!text(s.title,160)||!s.title.trim()||!text(s.goal,2000)||!['planned','active','closed'].includes(s.state)||!isoDate(s.start)||!isoDate(s.end)||s.start>s.end))return false;
 return c.milestones.every(m=>text(m.title,160)&&m.title.trim()&&isoDate(m.date));
}
export function validProject(item){
 if(item?.kind!=='project'||!text(item.title,300))return false;
 if(item.projectType==='board')return validProjectConfig(item.projectConfig);
 if(item.projectType!=='issue'||!id(item.projectBoard)||!item.projectBoard||!ISSUE_TYPES.includes(item.projectIssueType)||!PRIORITIES.includes(item.projectPriority)||!text(item.text,20000))return false;
 if(![item.projectStatus,item.projectRequestedStatus,item.projectParent,item.projectSprint].every(v=>id(v)))return false;
 if(item.projectIssueType==='Sub-task'&&!item.projectParent)return false;
 if(!text(item.projectAssignee,160)||![item.projectStart,item.projectDue].every(v=>v===''||isoDate(v))||item.projectStart&&item.projectDue&&item.projectStart>item.projectDue)return false;
 if(!Number.isInteger(item.projectPoints)||item.projectPoints<0||item.projectPoints>1000||!Number.isFinite(item.projectRank)||Math.abs(item.projectRank)>1e12)return false;
 if(!Array.isArray(item.projectDependencies)||item.projectDependencies.length>64||new Set(item.projectDependencies).size!==item.projectDependencies.length||item.projectDependencies.some(v=>!id(v)||!v))return false;
 return Array.isArray(item.projectHistory)&&item.projectHistory.length<=200&&item.projectHistory.every(h=>h&&id(h.sprint)&&Number.isInteger(h.points)&&h.points>=0&&h.points<=1000&&typeof h.done==='boolean');
}
export function validateProjectLinks(items,key){
 const issue=items[key];if(issue?.kind!=='project'||issue.projectType!=='issue')return;
 const board=items[issue.projectBoard];if(board?.projectType!=='board')throw Error('프로젝트 보드를 찾을 수 없습니다.');
 if(!board.projectConfig.statuses.some(s=>s.id===issue.projectStatus)||issue.projectRequestedStatus&&!board.projectConfig.statuses.some(s=>s.id===issue.projectRequestedStatus))throw Error('작업 상태를 확인해주세요.');
 if(issue.projectSprint&&!board.projectConfig.sprints.some(s=>s.id===issue.projectSprint))throw Error('스프린트를 찾을 수 없습니다.');
 for(const field of ['projectDependencies','projectParent']){
  const done=new Set();
  const visit=(node,path,depth=0)=>{if(depth>128||path.has(node))throw Error('순환 의존성 또는 하위 작업 순환은 만들 수 없습니다.');if(done.has(node))return;const current=items[node];if(!current||current.projectType!=='issue'||current.projectBoard!==issue.projectBoard)throw Error('같은 프로젝트의 작업만 연결할 수 있습니다.');const seen=new Set(path);seen.add(node);for(const next of field==='projectParent'?(current.projectParent?[current.projectParent]:[]):current.projectDependencies||[])visit(next,seen,depth+1);done.add(node);};
  visit(key,new Set());
 }
 if(issue.projectParent){const parent=items[issue.projectParent];if(issue.projectIssueType==='Epic'||parent.projectIssueType==='Sub-task'||issue.projectIssueType==='Story'&&parent.projectIssueType!=='Epic')throw Error('Epic → Story/Task/Bug → Sub-task 계층을 확인해주세요.');}
}
export const projectIssues=(records,board)=>Object.entries(records).filter(([,v])=>v?.kind==='project'&&v.projectType==='issue'&&v.projectBoard===board).map(([id,item])=>({id,...item})).sort((a,b)=>a.projectRank-b.projectRank||a.id.localeCompare(b.id));
export function statusPatch(board,issue,status,admin){const target=board.projectConfig.statuses.find(s=>s.id===status);if(!target)throw Error('작업 상태를 확인해주세요.');return target.approval&&!admin?{projectStatus:issue.projectStatus,projectRequestedStatus:status}:{projectStatus:status,projectRequestedStatus:''};}
export function sprintReport(issues,sprint){const rows=issues.flatMap(issue=>{const old=issue.projectHistory.find(h=>h.sprint===sprint);return old?[old]:issue.projectSprint===sprint?[{points:issue.projectPoints,done:issue.projectStatus==='done'}]:[];});const planned=rows.reduce((n,r)=>n+r.points,0),completed=rows.filter(r=>r.done);return {count:rows.length,done:completed.length,planned,completed:completed.reduce((n,r)=>n+r.points,0),remaining:rows.length-completed.length,rate:rows.length?Math.round(completed.length/rows.length*100):0};}
export function closeSprint(board,issues,sprintId){const sprint=board.projectConfig.sprints.find(s=>s.id===sprintId);if(sprint?.state!=='active')throw Error('진행 중인 스프린트만 종료할 수 있습니다.');const changes={};for(const issue of issues.filter(i=>i.projectSprint===sprintId)){changes[issue.id]={...issue,projectSprint:issue.projectStatus==='done'?sprintId:'',projectHistory:[...issue.projectHistory.filter(h=>h.sprint!==sprintId),{sprint:sprintId,points:issue.projectPoints,done:issue.projectStatus==='done'}]};delete changes[issue.id].id;}return {board:{...board,projectConfig:{...board.projectConfig,sprints:board.projectConfig.sprints.map(s=>s.id===sprintId?{...s,state:'closed'}:s)}},changes};}
export function reorderIssue(issues,id,before){const sorted=issues.filter(i=>i.id!==id),index=before?sorted.findIndex(i=>i.id===before):sorted.length;const n=index<0?sorted.length:index;const low=n?sorted[n-1].projectRank:((sorted[0]?.projectRank||1024)-2048),high=n<sorted.length?sorted[n].projectRank:low+2048;return (low+high)/2;}
export function timelineModel(issues,milestones=[]){const dates=[...issues.flatMap(i=>[i.projectStart,i.projectDue]),...milestones.map(m=>m.date)].filter(Boolean).sort();const start=dates[0]||new Date().toISOString().slice(0,10),end=dates.at(-1)||start;const days=Math.max(7,Math.ceil((Date.parse(end)-Date.parse(start))/86400000)+1);return {start,end,days,offset:date=>date?(Date.parse(date)-Date.parse(start))/86400000:0};}
// Delete descendants together; clear incoming dependencies so surviving issues stay valid.
export function removeProject(records,id){
 const removed=new Set([id]);let changed=true;
 while(changed){changed=false;for(const [key,item] of Object.entries(records))if(item.kind==='project'&&item.projectType==='issue'&&!removed.has(key)&&(removed.has(item.projectBoard)||removed.has(item.projectParent))){removed.add(key);changed=true;}}
 const changes={};for(const [key,item] of Object.entries(records))if(item.projectType==='issue'&&!removed.has(key)&&item.projectDependencies.some(dep=>removed.has(dep)))changes[key]={...item,projectDependencies:item.projectDependencies.filter(dep=>!removed.has(dep))};
 return {changes,removed:[...removed]};
}
export function orderProjectCreates(entries){
 const pending=new Map(entries.map(entry=>[entry.id,entry])),ordered=[],visiting=new Set();
 const visit=(id,depth=0)=>{const entry=pending.get(id);if(!entry)return;if(depth>128||visiting.has(id))throw Error('순환 의존성 또는 하위 작업 순환은 만들 수 없습니다.');visiting.add(id);const item=entry.item;const refs=[...(item.frameId?[item.frameId]:[]),...(item.kind==='project'&&item.projectType==='issue'?[item.projectBoard,item.projectParent,...item.projectDependencies]:item.kind==='connector'?[item.from,item.to]:[])];for(const ref of refs)visit(ref,depth+1);visiting.delete(id);pending.delete(id);ordered.push(entry);};
 for(const id of [...pending.keys()])visit(id);return ordered;
}
