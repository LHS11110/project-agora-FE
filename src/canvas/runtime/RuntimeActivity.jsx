import {useEffect, useState, useSyncExternalStore} from 'react';
import {ui} from '../../i18n/locale.js';
import './runtime-activity.css';

export default function RuntimeActivity({store,onFocusCode}) {
  const activity=useSyncExternalStore(store.subscribeActivity,store.getActivity,()=>null);
  const [now,setNow]=useState(Date.now());
  const running=activity?.status==='running';
  useEffect(()=>{if(!running)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[activity?.startedAt,running]);
  if(!activity)return null;
  const label=ui(activity.phase==='build'?(running?'사전 빌드 중':activity.status==='error'?'빌드 실패':'빌드 완료'):activity.phase==='reset'?(running?'실행 환경 초기화 중':activity.status==='error'?'초기화 실패':'초기화 완료'):(running?'코드 실행 중':activity.status==='error'?'코드 실행 실패':'코드 정상 종료'));
  const last=activity.entries?.at(-1);
  return <aside className={`runtime-activity is-${activity.status}`} aria-label={label}>
    {running?<span className="runtime-spinner" aria-hidden="true" />:<span className="runtime-outcome-icon" aria-hidden="true">{activity.status==='error'?'!':'✓'}</span>}
    <div className="runtime-activity-copy"><strong role="status">{label}</strong><span>{activity.language?.toUpperCase()}{activity.total?` · ${activity.current} / ${activity.total}`:''}</span>
      {activity.codeName&&<div className="runtime-active-code" title={activity.codeId}>{activity.codeName}</div>}
      {running&&activity.preview&&<code className="runtime-code-preview">{activity.preview}</code>}
      {running&&!activity.codeName&&<small>{ui('실행 환경 준비와 코드 처리를 기다리고 있습니다.')}</small>}
      {!running&&last&&<small>{last.timedOut?ui('시간 제한으로 종료됨'):last.exitCode!==undefined?`${ui('종료 코드')}: ${last.exitCode}`:ui('실행 실패')}</small>}
      {activity.error&&<small className="runtime-activity-error">{ui(activity.error)}</small>}
      {Boolean(activity.entries?.length)&&<ol className="runtime-step-list">{activity.entries.map(entry=><li key={entry.codeId} className={`is-${entry.status}`}><span aria-hidden="true">{entry.status==='running'?'◷':entry.status==='error'?'!':'✓'}</span>{onFocusCode?<button type="button" className="runtime-step-name" title={entry.codeId} aria-label={ui('코드로 이동: {name}',{name:entry.codeName})} onClick={()=>onFocusCode(entry.codeId)}>{entry.codeName}</button>:<span className="runtime-step-name" title={entry.codeId}>{entry.codeName}</span>}<span>{ui(activity.phase==='build'?(entry.status==='running'?'빌드 중…':entry.status==='error'?'빌드 실패':'빌드 완료'):(entry.status==='running'?'실행 중…':entry.status==='error'?'실행 실패':'정상 종료'))}</span></li>)}</ol>}
      {!running&&last?.detail&&<details className="runtime-error-details"><summary>{ui('실패 상세')}</summary><pre>{last.detail}</pre></details>}
    </div>
    <time>{Math.max(0,Math.floor(((activity.endedAt||now)-activity.startedAt)/1000))}s</time>
    {!running&&<button type="button" className="runtime-activity-dismiss" aria-label={ui('실행 상태 닫기')} onClick={()=>store.dismissActivity()}>×</button>}
    {running&&<div className="runtime-activity-track" aria-hidden="true"><span /></div>}
  </aside>;
}
