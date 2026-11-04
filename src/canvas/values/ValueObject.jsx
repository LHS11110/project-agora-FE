import {useEffect,useRef,useState} from 'react';
import {ui} from '../../i18n/locale.js';
import {createValue,displayedValue,validValue,valueDefinition} from './valueData.js';
import './value-object.css';
const labels={real:'실수 값',integer:'정수 값',button:'버튼 값',select:'선택 값',text:'입력 값'};
export default function ValueObject({id,item,readOnly,onChange}){
 const [settings,setSettings]=useState(false),[draft,setDraft]=useState(null),[error,setError]=useState(''),[number,setNumber]=useState(String(item.valueNumber));
 const queued=useRef(null),frame=useRef(null),current=useRef({item,readOnly,onChange});current.current={item,readOnly,onChange};
 useEffect(()=>{setNumber(String(item.valueNumber));},[item.valueNumber]);
 const flush=()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);frame.current=null;const value=queued.current;queued.current=null;if(value!==null&&!current.current.readOnly)current.current.onChange(id,{valueNumber:value});};
 useEffect(()=>()=>{if(frame.current!==null)cancelAnimationFrame(frame.current);},[]);
 const change=patch=>{if(readOnly)return;const next=valueDefinition(item,patch);if(!next){setError(ui('값과 범위 설정을 확인해주세요.'));return;}setError('');onChange(id,patch);};
 const numeric=value=>{setNumber(value);const n=Number(value);if(value.trim()&&Number.isFinite(n)&&validValue({...item,valueNumber:n}))change({valueNumber:n});};
 const configure=()=>{setDraft({...item,valueOptions:item.valueOptions.join('\n')});setError('');setSettings(true);};
 return <section className="canvas-value-object" data-value-type={item.valueType} data-value={String(displayedValue(item))}>
  <header><strong>{item.title||ui(labels[item.valueType])}</strong>{!readOnly&&<button type="button" data-object-action="value" aria-label={ui('값 객체 설정')} onClick={configure}>⚙</button>}</header>
  <div className="value-object-body" data-object-action="value" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
   {settings?<form className="value-settings" onSubmit={e=>{e.preventDefault();const patch=Object.fromEntries(['title','valueType','valueMin','valueMax','valueStep'].map(k=>[k,draft[k]]));patch.valueOptions=draft.valueOptions.split('\n').map(v=>v.trim()).filter(Boolean);if(draft.valueType!==item.valueType){patch.valueNumber=0;patch.valueText='';}const next=valueDefinition(item,patch);if(!next){setError(ui('값과 범위 설정을 확인해주세요.'));return;}onChange(id,Object.fromEntries(['title','valueType','valueMin','valueMax','valueStep','valueOptions','valueNumber','valueText'].map(k=>[k,next[k]])));setSettings(false);}}>
    <label>{ui('이름')}<input value={draft.title} maxLength={128} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
    <label>{ui('입력 유형')}<select value={draft.valueType} onChange={e=>setDraft({...draft,...createValue(e.target.value),width:draft.width,height:draft.height,title:draft.title,valueOptions:createValue(e.target.value).valueOptions.join('\n')})}>{Object.entries(labels).map(([type,label])=><option key={type} value={type}>{ui(label)}</option>)}</select></label>
    {['real','integer'].includes(draft.valueType)&&<div className="value-range-settings">{[['valueMin','최솟값'],['valueMax','최댓값'],['valueStep','증감 단위']].map(([key,label])=><label key={key}>{ui(label)}<input type="number" step="any" required value={draft[key]} onChange={e=>setDraft({...draft,[key]:e.target.value===''?'':Number(e.target.value)})}/></label>)}</div>}
    {draft.valueType==='select'&&<label>{ui('선택 항목 · 한 줄에 하나')}<textarea rows={3} maxLength={4096} value={draft.valueOptions} onChange={e=>setDraft({...draft,valueOptions:e.target.value})}/></label>}
    <div className="value-settings-actions"><button type="button" onClick={()=>setSettings(false)}>{ui('취소')}</button><button type="submit">{ui('설정 저장')}</button></div>
   </form>:<>
    {item.valueType==='real'&&<><output className="value-current">{number}</output><input aria-label={ui('실수 슬라이더')} type="range" disabled={readOnly} min={item.valueMin} max={item.valueMax} step={item.valueStep} value={number} onChange={e=>{const n=Number(e.target.value);setNumber(e.target.value);queued.current=n;if(frame.current===null)frame.current=requestAnimationFrame(flush);}} onPointerUp={flush} onBlur={flush}/></>}
    {['real','integer'].includes(item.valueType)&&<div className="value-number-row">{item.valueType==='integer'&&<button disabled={readOnly||item.valueNumber<=item.valueMin} aria-label={ui('값 감소')} onClick={()=>change({valueNumber:Math.max(item.valueMin,item.valueNumber-item.valueStep)})}>−</button>}<input aria-label={ui(labels[item.valueType])} type="number" readOnly={readOnly} min={item.valueMin} max={item.valueMax} step={item.valueType==='integer'?item.valueStep:'any'} value={number} onChange={e=>numeric(e.target.value)} onBlur={()=>setNumber(String(item.valueNumber))}/>{item.valueType==='integer'&&<button disabled={readOnly||item.valueNumber>=item.valueMax} aria-label={ui('값 증가')} onClick={()=>change({valueNumber:Math.min(item.valueMax,item.valueNumber+item.valueStep)})}>+</button>}</div>}
    {item.valueType==='button'&&<button className="value-toggle" aria-label={ui('버튼 값')} aria-pressed={Boolean(item.valueNumber)} disabled={readOnly} onClick={()=>change({valueNumber:item.valueNumber?0:1})}>{ui(item.valueNumber?'켜짐':'꺼짐')}<small>{item.valueNumber}</small></button>}
    {item.valueType==='select'&&<select aria-label={ui('선택 값')} disabled={readOnly} value={item.valueNumber} onChange={e=>change({valueNumber:Number(e.target.value)})}>{item.valueOptions.map((v,index)=><option value={index} key={index}>{v}</option>)}</select>}
    {item.valueType==='text'&&<input aria-label={ui('입력 값')} maxLength={4096} readOnly={readOnly} value={item.valueText} onChange={e=>change({valueText:e.target.value})}/>}
   </>}
   {error&&<p className="value-error" role="alert">{error}</p>}
  </div>
  {!settings&&<footer>{['real','integer'].includes(item.valueType)?`${item.valueMin} — ${item.valueMax}`:ui('공동 값')}<span>{ui('실시간 공유')}</span></footer>}
 </section>;
}
