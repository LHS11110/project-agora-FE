export const isGif= value=>/\.gif(?:$|[?#])/i.test(value||'');
export const mediaFileType=file=>file?.type==='image/gif'||isGif(file?.name)?'gif':file?.type?.startsWith('video/')||/\.(mp4|m4v|mov|webm|ogv)$/i.test(file?.name||'')?'video':null;
export function mediaPosition(state,duration,loop,now=Date.now()){
 const time=Math.max(0,(state?.time||0)+(state&&!state.paused?Math.max(0,now-state.updatedAt)/1000:0));
 return duration>0?(loop?time%duration:Math.min(time,duration)):time;
}
export const storedMedia=item=>item?.kind==='link'&&(item.mediaType==='gif'||/^\/api\/canvases\/\d+\/media\/[a-f0-9-]+\.(?:gif|mp4|webm|ogv)$/.test(item.url||''));
