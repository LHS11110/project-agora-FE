import { api } from '../../api/client.js';
import { canvasPasswordGrantKey, readCanvasPasswordGrant } from '../canvasAccess.js';

export function runtimeSettingsApi({ canvasId, token, user }) {
  const path=`/api/canvases/${encodeURIComponent(canvasId)}/runtime/settings`;
  const grant=()=>readCanvasPasswordGrant(canvasPasswordGrantKey(canvasId,user));
  return {
    load:()=>{const passwordGrant=grant();return api(path,{token,headers:passwordGrant?{'X-Canvas-Password-Grant':passwordGrant}:{}});},
    resources:(template,revision)=>api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/resources`,{method:'PUT',token,body:{template,revision,passwordGrant:grant()}}),
    disk:(sizeGiB,revision)=>api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/disk`,{method:'PUT',token,body:{sizeGiB,revision,passwordGrant:grant()}}),
    installJava:()=>api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/java/dependencies`,{method:'POST',token,body:{passwordGrant:grant()}}),
    apply:(language,config,revision)=>api(path,{method:'PUT',token,body:{language,config,revision,passwordGrant:grant()}}),
  };
}

export function selectRuntimeEngine(language, config, engine) {
  return {...config,engine,...(language==='java'?{release:engine.replace(/^jdk/,'')}: {})};
}
