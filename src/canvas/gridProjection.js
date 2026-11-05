export function gridProjection(camera,interval){
  const scale=Number.isFinite(camera?.scale) && camera.scale>0?camera.scale:1;
  const projected=value=>{const baseLog=Math.log2(Number.isFinite(Number(value))&&Number(value)>0?Number(value):20)+Math.log2(scale);const step=interval===undefined?Math.ceil(Math.log2(12)-baseLog):Math.max(0,Math.ceil(Math.log2(12)-baseLog));return 2**(baseLog+step);};
  const spacingX=projected(interval&&typeof interval==='object'?interval.x:interval),spacingY=projected(interval&&typeof interval==='object'?interval.y:interval);
  const x=((Number(camera?.x)||0)%spacingX)-spacingX/2,y=((Number(camera?.y)||0)%spacingY)-spacingY/2,coarse=Math.max(spacingX,spacingY)>96;
  return {spacing:spacingX,spacingX,spacingY,x,y,coarse,transform:coarse?'translate3d(-48px,-48px,0)':`translate3d(${x-spacingX*2}px,${y-spacingY*2}px,0) scale(${spacingX/24},${spacingY/24})`};
}
export function applyGridProjection(grid,camera,interval){
 const p=gridProjection(camera,interval),radius=p.coarse?1.5:36/p.spacing;
 grid.style.transform=p.transform;
 grid.style.backgroundSize=p.coarse?`${p.spacingX}px ${p.spacingY}px`:'24px 24px';
 grid.style.backgroundPosition=p.coarse?`${p.x+48}px ${p.y+48}px`:'0 0';
 grid.style.setProperty('--surface-dot-x',`${p.coarse?2:48/p.spacingX}px`);
 grid.style.setProperty('--surface-dot-y',`${p.coarse?2:48/p.spacingY}px`);
 grid.style.setProperty('--surface-dot-radius',`${radius}px`);
 grid.style.setProperty('--surface-dot-end',`${p.coarse?2:48/p.spacing}px`);
}
