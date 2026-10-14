export function gridProjection(camera){
  const scale=Number.isFinite(camera?.scale) && camera.scale>0?camera.scale:1;
  const baseLog=Math.log2(20)+Math.log2(scale),step=Math.ceil(Math.log2(12)-baseLog);
  const spacing=2**(baseLog+step),offset=value=>((Number(value)||0)%spacing)-spacing/2;
  const x=offset(camera?.x),y=offset(camera?.y);
  return {spacing,x,y,transform:`translate3d(${x-spacing*2}px,${y-spacing*2}px,0) scale(${spacing/24})`};
}
