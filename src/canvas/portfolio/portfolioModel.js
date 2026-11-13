export const PORTFOLIO_ID='portfolio-settings';
export const EFFECTS=['none','fade','slide-up','slide-left','zoom','pulse','float','spin'];
export const defaultAnimation=()=>({effect:'none',duration:1000,delay:0,loop:false,easing:'ease-in-out',distance:40});
export const hasAnimation=item=>Boolean(item?.animation&&item.animation.effect!=='none');
export function validAnimation(a){return Boolean(a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).length===6&&EFFECTS.includes(a.effect)&&Number.isInteger(a.duration)&&a.duration>=100&&a.duration<=30000&&Number.isInteger(a.delay)&&a.delay>=0&&a.delay<=30000&&typeof a.loop==='boolean'&&['linear','ease','ease-in-out'].includes(a.easing)&&Number.isFinite(a.distance)&&a.distance>=0&&a.distance<=400);}
export function validPlayback(p){return Boolean(p&&['play','stop'].includes(p.action)&&typeof p.runId==='string'&&p.runId.length>0&&p.runId.length<=128&&Number.isSafeInteger(p.startedAt)&&p.startedAt>=0&&p.startedAt<=8640000000000000&&validAnimation(p.config)&&Object.keys(p).length===4);}
export function validPortfolio(p){return Boolean(p?.kind==='portfolio'&&typeof p.title==='string'&&p.title.length<=200&&typeof p.portfolioDescription==='string'&&p.portfolioDescription.length<=4000&&Array.isArray(p.portfolioPages)&&p.portfolioPages.length<=100&&new Set(p.portfolioPages.map(s=>s?.id)).size===p.portfolioPages.length&&p.portfolioPages.every(s=>s&&typeof s.id==='string'&&s.id.length>0&&s.id.length<=128&&typeof s.title==='string'&&s.title.trim()&&s.title.length<=200&&typeof s.notes==='string'&&s.notes.length<=4000&&Array.isArray(s.objectIds)&&s.objectIds.length<=2000&&new Set(s.objectIds).size===s.objectIds.length&&s.objectIds.every(id=>typeof id==='string'&&id.length>0&&id.length<=128)));}
export const newPortfolio=permission=>({kind:'portfolio',title:'포트폴리오',portfolioDescription:'',portfolioPages:[],permission,x:0,y:0,width:.01,height:.01});
export function animationFrames(a){switch(a.effect){case'fade':return [{opacity:0},{opacity:1}];case'slide-up':return [{opacity:0,translate:`0 ${a.distance}px`},{opacity:1,translate:'0 0'}];case'slide-left':return [{opacity:0,translate:`${a.distance}px 0`},{opacity:1,translate:'0 0'}];case'zoom':return [{opacity:0,scale:'.8'},{opacity:1,scale:'1'}];case'pulse':return [{scale:'1'},{scale:'1.08'},{scale:'1'}];case'float':return [{translate:'0 0'},{translate:`0 -${a.distance}px`},{translate:'0 0'}];case'spin':return [{rotate:'0deg'},{rotate:'360deg'}];default:return[];}}
export function playbackOffset(p,now=Date.now()){return now-p.startedAt;}

// Merely assigning an effect must not allocate a DOM/raster surface for every
// dormant object in a large document. Shared playback still uses the full renderer.
export function hasRenderedAnimation(item){
 const p=item?.animationPlayback;
 return hasAnimation(item)&&p?.action==='play'&&p.startedAt>0;
}
