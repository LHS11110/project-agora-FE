import {cloneElement,useCallback,useEffect,useState,useSyncExternalStore} from 'react';
import {contentSource} from '../content/contentPresentation.js';
import {ui} from '../../i18n/locale.js';
import './runtime-code-frame.css';

/** Subscribe only the affected code block; never rerender the canvas per step. */
export default function RuntimeCodeFrame({id,item,store,children}) {
  const subscribe=useCallback(listener=>store?store.subscribe(id,listener):()=>{},[store,id]);
  const snapshot=useCallback(()=>store?.get(id)||null,[store,id]);
  const state=useSyncExternalStore(subscribe,snapshot,()=>null);
  const [expanded,setExpanded]=useState(false);
  const current=state&&state.source===contentSource(item)&&state.language===(item.language||'javascript');
  const status=current?state.status:null;
  const building=state?.phase==='build';
  const label=status==='running'?(building?'빌드 중…':'실행 중…'):status==='success'?(building?'빌드 완료':'실행 성공'):status==='error'?(building?'빌드 실패':'실행 실패'):status==='queued'?'대기 중':status==='skipped'?'실행되지 않음':'';
  const detail=state?.error||state?.detail;
  useEffect(()=>{if(status!=='error')setExpanded(false);},[status]);
  return cloneElement(children,{
    'data-runtime-state':status||undefined,
    'aria-busy':status==='running',
  },children.props.children,status&&<>
    <span className="runtime-code-border" aria-hidden="true" />
    <div className="runtime-code-status" data-object-action="runtime-status" onPointerDown={event=>event.stopPropagation()} onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()}>
      {status==='error'&&detail?<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)} title={ui('실패 상세')}><span aria-hidden="true">!</span>{ui(label)}</button>:<span role="status"><i aria-hidden="true">{status==='success'?'✓':status==='running'?'◷':status==='queued'?'·':'−'}</i>{ui(label)}</span>}
      {status==='error'&&detail&&expanded&&<pre tabIndex={0} className="runtime-code-diagnostic" onWheel={event=>event.stopPropagation()}>{detail}</pre>}
    </div>
  </>);
}
