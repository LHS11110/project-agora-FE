let available;
export function probeHardwareWebGL(createCanvas) {
  let gl;
  try {
    const canvas=createCanvas();
    gl=canvas.getContext('webgl2',{powerPreference:'high-performance',failIfMajorPerformanceCaveat:true}) || canvas.getContext('webgl',{powerPreference:'high-performance',failIfMajorPerformanceCaveat:true});
    if(!gl)return false;
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const adapter=debug?String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)):'';
    return !/swiftshader|llvmpipe|softpipe|software/i.test(adapter);
  } catch { return false; }
  finally { try{gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{ /* A failed probe never blocks CPU rendering. */ } }
}
export function hasHardwareWebGL(){
  return available ??= probeHardwareWebGL(()=>document.createElement('canvas'));
}
