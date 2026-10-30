import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {ui} from '../../i18n/locale.js';
import {useUiLocale} from '../../i18n/useUiLocale.js';
import {runtimeSettingsApi,selectRuntimeEngine} from './runtimeSettings.js';
import './runtime-settings.css';

export default function RuntimeSettingsDialog({canvasId,token,user,initialLanguage='cpp',isRunning,onClose}) {
  useUiLocale();
  const [snapshot,setSnapshot]=useState(null),[drafts,setDrafts]=useState({}),[language,setLanguage]=useState(initialLanguage);
  const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [resource,setResource]=useState('');
  const [disk,setDisk]=useState(6);
  const alive=useRef(true),generation=useRef(0),closeRef=useRef(null);
  const api=runtimeSettingsApi({canvasId,token,user});
  const load=async()=>{
    const id=++generation.current;setLoading(true);setError('');setMessage('');
    try {const response=await api.load();if(alive.current&&generation.current===id){setSnapshot(response);setDrafts(response.languages);setResource(response.resourceTemplate);setDisk(response.diskGiB??6);if(!response.catalog[language])setLanguage('cpp');}}
    catch(failure){if(alive.current&&generation.current===id)setError(failure.message);}
    finally{if(alive.current&&generation.current===id)setLoading(false);}
  };
  useEffect(()=>{alive.current=true;const previous=document.activeElement;closeRef.current?.focus();load();return()=>{alive.current=false;previous?.focus?.();};},[]);
  const catalog=snapshot?.catalog[language],draft=drafts[language];
  const dirty=Boolean(draft&&JSON.stringify(draft)!==JSON.stringify(snapshot.languages[language]));
  const change=(field,value)=>{setDrafts(current=>({...current,[language]:{...current[language],[field]:value}}));setMessage('');setError('');};
  const installJava=async()=>{
    setMessage('Java 라이브러리를 설치하고 있습니다…');
    const result=await api.installJava();
    if(!result.installed)throw new Error(result.output||'Java 라이브러리 설치에 실패했습니다.');
    return result;
  };
  const retryJava=async()=>{
    if(isRunning?.()){setError('코드 실행이 끝난 후 설정을 적용하세요.');return;}
    setSaving(true);setError('');
    try {await installJava();if(alive.current)setMessage('Java 라이브러리를 설치했습니다. 코드 객체에서 import할 수 있습니다.');}
    catch(failure){if(alive.current){setMessage('');setError(failure.message);}}
    finally{if(alive.current)setSaving(false);}
  };
  const apply=async()=>{
    if(isRunning?.()){setError('코드 실행이 끝난 후 설정을 적용하세요.');return;}
    setSaving(true);setError('');setMessage('');
    try {
      const response=await api.apply(language,draft,snapshot.revision);
      if(alive.current){setSnapshot(response);setDrafts(previous=>({...response.languages,...previous,[language]:response.languages[language]}));}
      if(language==='java'&&response.languages.java.dependencies?.length){await installJava();if(alive.current)setMessage('Java 라이브러리를 설치했습니다. 코드 객체에서 import할 수 있습니다.');}
      else if(alive.current)setMessage('실행 환경을 적용했습니다. 다음 실행부터 사용합니다.');
    } catch(failure){if(alive.current){setMessage('');setError(failure.message);}}
    finally{if(alive.current)setSaving(false);}
  };
  const applyResources=async()=>{
    if(isRunning?.()){setError('코드 실행이 끝난 후 설정을 적용하세요.');return;}
    setSaving(true);setError('');setMessage('');
    try {
      const response=await api.resources(resource,snapshot.revision);
      if(alive.current){setSnapshot(response);setResource(response.resourceTemplate);setMessage('VM 템플릿을 적용했습니다. 다음 실행부터 새 사양으로 시작합니다.');}
    }catch(failure){if(alive.current)setError(failure.message);}
    finally{if(alive.current)setSaving(false);}
  };
  const applyDisk=async()=>{
    if(isRunning?.()){setError('코드 실행이 끝난 후 설정을 적용하세요.');return;}
    setSaving(true);setError('');setMessage('');
    try {
      const response=await api.disk(disk,snapshot.revision);
      if(alive.current){setSnapshot(response);setDisk(response.diskGiB);setMessage('디스크 용량을 적용했습니다. 다음 실행부터 사용합니다.');}
    }catch(failure){if(alive.current)setError(failure.message);}
    finally{if(alive.current)setSaving(false);}
  };
  return createPortal(<div className="runtime-settings-overlay" onPointerDown={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()} onKeyDown={event=>{
    event.stopPropagation();
    if(event.key==='Escape'&&!saving){event.preventDefault();onClose();}
    if(event.key==='Tab'){
      const controls=[...event.currentTarget.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),textarea:not(:disabled)')].filter(element=>element.getClientRects().length);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  }}><section className="runtime-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="runtime-settings-title">
    <header><div><small>CANVAS RUNTIME</small><h2 id="runtime-settings-title">{ui('실행 환경')}</h2></div><button ref={closeRef} type="button" disabled={saving} onClick={onClose} aria-label={ui('실행 환경 설정 닫기')}>{ui('닫기')}</button></header>
    <p>{ui('언어별 설정은 이 캔버스의 참가자들이 공유합니다.')}</p>
    {loading?<p role="status">{ui('실행 환경을 불러오는 중입니다.')}</p>:catalog&&draft&&<>
      {snapshot.resourceTemplates&&<section className="runtime-resource-settings" aria-label={ui('VM 리소스')}>
        <h3>{ui('VM 리소스')}</h3>
        <div className="runtime-resource-templates">{Object.entries(snapshot.resourceTemplates).map(([key,template])=><label key={key} className={resource===key?'selected':''}>
          <input type="radio" name="runtime-resource-template" value={key} checked={resource===key} disabled={saving} onChange={()=>{setResource(key);setMessage('');setError('');}} />
          <strong>{ui(template.label)}</strong><span>{template.vcpus} vCPU · {template.memoryMiB/1024} GiB RAM</span>
        </label>)}</div>
        <p>{ui('템플릿을 변경하면 VM이 종료되고 모든 언어의 변수와 함수가 초기화됩니다. 파일은 유지됩니다.')}</p>
        <p>{ui('서버 자원이 부족하면 실행이 제한될 수 있습니다.')}</p>
        <button type="button" disabled={saving||resource===snapshot.resourceTemplate} onClick={applyResources}>{ui('VM 템플릿 적용')}</button>
      </section>}
      {snapshot.diskSizesGiB&&<section className="runtime-resource-settings" aria-label={ui('VM 디스크')}>
        <h3>{ui('VM 디스크')}</h3>
        <label>{ui('디스크 용량')}<select aria-label={ui('디스크 용량')} value={disk} disabled={saving} onChange={event=>{setDisk(Number(event.target.value));setMessage('');setError('');}}>{snapshot.diskSizesGiB.map(size=><option key={size} value={size} disabled={size<snapshot.diskGiB}>{size} GiB</option>)}</select></label>
        <p>{ui('OS와 설치된 패키지를 포함한 전체 디스크 용량입니다. 축소는 지원하지 않습니다.')}</p>
        <p>{ui('확장하면 VM이 종료되어 변수와 함수가 초기화됩니다. 파일은 보존되며 서버 여유 공간이 필요합니다.')}</p>
        <button type="button" disabled={saving||disk===snapshot.diskGiB} onClick={applyDisk}>{ui('디스크 용량 적용')}</button>
      </section>}
      <div className="runtime-settings-selectors"><label>{ui('프로그래밍 언어')}<select aria-label={ui('실행 언어')} value={language} disabled={saving} onChange={event=>{setLanguage(event.target.value);setMessage('');setError('');}}>{Object.entries(snapshot.catalog).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label>
      <label>{ui('컴파일러 / 인터프리터')}<select aria-label={ui('컴파일러 / 인터프리터')} value={draft.engine} disabled={saving} onChange={event=>{setDrafts(current=>({...current,[language]:selectRuntimeEngine(language,current[language],event.target.value)}));setMessage('');setError('');}}>{Object.entries(catalog.engines).map(([key,value])=><option key={key} value={key}>{value.label}</option>)}</select></label></div>
      <p className="runtime-settings-mode">{ui(catalog.engines[draft.engine].mode==='program'?'독립 프로그램 모드: main이 필요하며 코드 객체 사이에 메모리를 공유하지 않습니다.':'같은 언어의 코드 객체는 변수와 함수를 공유합니다.')}</p>
      <div className="runtime-settings-fields">{Object.entries(catalog.fields).map(([key,field])=>field.type==='dependencies'?<label className="runtime-java-dependencies" key={key+'-'+snapshot.revision+'-'+generation.current}>{ui(field.label)}<textarea aria-label={ui(field.label)} defaultValue={(draft[key]||[]).join('\n')} rows={4} spellCheck={false} disabled={saving} placeholder="org.apache.commons:commons-lang3:3.17.0" onChange={event=>change(key,event.target.value.split(/\s+/).filter(Boolean))}/><small>{ui('한 줄에 group:artifact:version 하나를 입력하세요. 하위 의존성도 함께 설치합니다.')}</small></label>:field.type==='boolean'?<label className="runtime-setting-toggle" key={key}><input type="checkbox" checked={draft[key]} disabled={saving} onChange={event=>change(key,event.target.checked)} />{ui(field.label)}</label>:<label key={key}>{ui(field.label)}<select aria-label={ui(field.label)} value={draft[key]} disabled={saving} onChange={event=>change(key,event.target.value)}>{field.values.filter(value=>language!=='java'||key!=='release'||Number(value)<=Number(draft.engine.replace('jdk',''))).map(value=><option value={value} key={value}>{key==='optimization'?'-O'+value:key==='standard'?'-std='+value:value}</option>)}</select></label>)}</div>
      {language==='java'&&Boolean(draft.dependencies?.length)&&<button type="button" disabled={saving||dirty} onClick={retryJava}>{ui('라이브러리 설치 / 다시 시도')}</button>}
      {language==='python'&&<p>{ui('Python 버전별 패키지는 별도로 설치합니다.')}</p>}
      <p className="runtime-settings-notice">{ui('적용하면 해당 언어의 변수와 함수가 초기화됩니다. 저장 파일과 기존 결과는 유지됩니다.')}</p>
    </>}
    {error&&<p className="runtime-settings-error" role="alert">{ui(error)}</p>}{message&&<p role="status">{ui(message)}</p>}
    <footer><button type="button" disabled={loading||saving} onClick={load}>{ui('다시 불러오기')}</button><button className="runtime-settings-apply" type="button" disabled={loading||saving||!dirty} onClick={apply}>{ui(saving?'적용 중…':'이 언어에 적용')}</button></footer>
  </section></div>,document.body);
}
