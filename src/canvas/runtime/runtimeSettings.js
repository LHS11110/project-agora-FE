import {ensureCanvasPasswordGrant} from '../canvasPasswordSession.js';
import { api } from '../../api/client.js';
import { canvasPasswordGrantKey } from '../canvasAccess.js';

export function runtimeSettingsApi({ canvasId, token, user }) {
  const path=`/api/canvases/${encodeURIComponent(canvasId)}/runtime/settings`;
  const grant=()=>ensureCanvasPasswordGrant(canvasPasswordGrantKey(canvasId,user));
  return {
    load:async()=>{const passwordGrant=await grant();return api(path,{token,headers:passwordGrant?{'X-Canvas-Password-Grant':passwordGrant}:{}});},
    resources:async(template,revision)=>api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/resources`,{method:'PUT',token,body:{template,revision,passwordGrant:await grant()}}),
    disk:async(sizeGiB,revision)=>api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/disk`,{method:'PUT',token,body:{sizeGiB,revision,passwordGrant:await grant()}}),
    installJava:async()=>api(`/api/canvases/${encodeURIComponent(canvasId)}/runtime/java/dependencies`,{method:'POST',token,body:{passwordGrant:await grant()}}),
    apply:async(language,config,revision)=>api(path,{method:'PUT',token,body:{language,config,revision,passwordGrant:await grant()}}),
  };
}

export function selectRuntimeEngine(language, config, engine) {
  return {...config,engine,...(language==='java'?{release:engine.replace(/^jdk/,'')}: {})};
}
