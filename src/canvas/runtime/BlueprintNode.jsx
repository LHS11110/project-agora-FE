import { useCallback, useSyncExternalStore } from 'react';
import { ui } from '../../i18n/locale.js';
import Icon from '../../components/Icon.jsx';
import './blueprint.css';

export default function BlueprintNode({ id, item, store, selected = false, canExecute = true, canReset = true }) {
  const subscribe = useCallback(listener => store ? store.subscribe(id, listener) : () => {}, [store, id]);
  const snapshot = useCallback(() => store?.get(id) || null, [store, id]);
  const state = useSyncExternalStore(subscribe, snapshot, () => null);
  const executor = item.runtimeRole === 'executor';
  return <div className={`blueprint-node blueprint-${item.runtimeRole}${state?.running?' is-running':''}`} aria-busy={Boolean(state?.running)}>
    <header><span className={executor?'executor-mark':undefined}><Icon name={executor ? 'code' : 'document'} size={16} /></span><strong>{ui(executor ? '실행 객체' : '실행 결과 객체')}</strong>{executor&&<span className={"executor-status"+(state?.error||state?.failed?' is-error':state?.completed?' is-success':'')}>{ui(state?.running?(state?.building?'빌드 중…':'실행 중…'):state?.error||state?.failed?'실패':state?.completed?'완료':'준비')}</span>}</header>
    <div className="blueprint-node-body" data-object-action={!executor&&selected ? 'blueprint' : undefined} onPointerDown={event => { if ((!executor&&selected)||event.target.closest('button')) event.stopPropagation(); }} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      {executor ? <><p className="executor-description">{ui('연결된 코드를 순서대로 실행합니다.')}</p><div className="executor-actions"><button className="executor-run" data-object-action="blueprint" data-blueprint-run="true" aria-keyshortcuts="Shift+Enter" aria-label={ui(state?.running?(state?.building?'빌드 중…':'실행 중…'):'코드 실행')} type="button" disabled={!canExecute || !store || state?.running} onClick={() => store.run(id)}>{state?.running?<span className="runtime-spinner" aria-hidden="true" />:<svg aria-hidden="true" width="14" height="14" viewBox="0 0 20 20"><path fill="currentColor" d="M5 3.5a1 1 0 0 1 1.5-.86l10 6.5a1 1 0 0 1 0 1.72l-10 6.5A1 1 0 0 1 5 16.5z"/></svg>}<span>{ui(state?.running?(state?.building?'빌드 중…':'실행 중…'):'코드 실행')}</span><span className="executor-button-shortcut" aria-hidden="true">⇧ ↵</span></button>
        <button className="executor-reset" data-object-action="blueprint" type="button" disabled={!canExecute || !store || state?.running} onClick={() => store.build(id)}>{ui('사전 빌드')}</button>
        <button className="executor-reset" data-object-action="blueprint" type="button" disabled={!canReset || !store || state?.running} onClick={() => store.reset(id)}>{ui('실행 환경 초기화')}</button></div>
        {state?.reset && <p role="status">{ui('변수와 함수를 초기화했습니다. 파일은 유지됩니다.')}</p>}
        {state?.error && <p role="alert">{ui(state.error)}</p>}
        {state?.completed && <p role="status">{ui(state.failed ? '실행 실패 · 연결된 결과 객체를 확인하세요.' : state?.built?'빌드 완료':'실행 완료')}</p>}</>
        : item.runtimeResults?.length ? <div className="blueprint-results" role="region" aria-label={ui('실행 결과')} aria-live="polite">{item.runtimeResults.map((entry, index) => <section key={`${entry.runId}-${entry.codeId}-${index}`}><div className="blueprint-result-meta"><span>{entry.codeId}</span><span>{entry.error ? ui('실행 실패') : entry.timedOut ? ui('시간 제한으로 종료됨') : `${ui('종료 코드')}: ${entry.exitCode}`}{entry.truncated ? ` · ${ui('출력 일부 생략')}` : ''}</span></div><pre>{entry.error || entry.output || ui('출력 없음')}</pre></section>)}</div>
          : <p>{ui('코드 객체 또는 다른 결과 객체를 연결하면 실행 결과가 표시됩니다.')}</p>}
    </div>
    <footer>{executor?<><span>{ui('선택 후 실행')}</span><span className="executor-shortcut"><kbd>Shift</kbd><span>+</span><kbd>Enter</kbd></span></>:ui('결과 → 코드 연결은 출력을 표준 입력으로 전달합니다.')}</footer>
  </div>;
}
