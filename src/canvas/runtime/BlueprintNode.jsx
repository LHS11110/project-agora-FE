import { useCallback, useSyncExternalStore } from 'react';
import { ui } from '../../i18n/locale.js';
import Icon from '../../components/Icon.jsx';
import './blueprint.css';

export default function BlueprintNode({ id, item, store, selected = false }) {
  const subscribe = useCallback(listener => store ? store.subscribe(id, listener) : () => {}, [store, id]);
  const snapshot = useCallback(() => store?.get(id) || null, [store, id]);
  const state = useSyncExternalStore(subscribe, snapshot, () => null);
  const executor = item.runtimeRole === 'executor';
  return <div className={`blueprint-node blueprint-${item.runtimeRole}`}>
    <header><Icon name={executor ? 'code' : 'document'} size={16} /><strong>{ui(executor ? '실행 객체' : '실행 결과 객체')}</strong></header>
    <div className="blueprint-node-body" data-object-action={executor || selected ? 'blueprint' : undefined} onPointerDown={event => { if (executor || selected) event.stopPropagation(); }} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
      {executor ? <><p>{ui('같은 언어의 변수와 함수는 다음 실행에도 유지됩니다.')}</p><button type="button" disabled={!store || state?.running} onClick={() => store.run(id)}>{ui(state?.running ? '실행 중…' : '코드 실행')}</button>
        <button type="button" disabled={!store || state?.running} onClick={() => store.reset(id)}>{ui('실행 환경 초기화')}</button>
        {state?.reset && <p role="status">{ui('변수와 함수를 초기화했습니다. 파일은 유지됩니다.')}</p>}
        {state?.error && <p role="alert">{ui(state.error)}</p>}
        {state?.completed && <p role="status">{ui(state.failed ? '실행 실패 · 연결된 결과 객체를 확인하세요.' : '실행 완료')}</p>}</>
        : item.runtimeResults?.length ? <div className="blueprint-results" role="region" aria-label={ui('실행 결과')} aria-live="polite">{item.runtimeResults.map((entry, index) => <section key={`${entry.runId}-${entry.codeId}-${index}`}><div className="blueprint-result-meta"><span>{entry.codeId}</span><span>{entry.error ? ui('실행 실패') : entry.timedOut ? ui('시간 제한으로 종료됨') : `${ui('종료 코드')}: ${entry.exitCode}`}{entry.truncated ? ` · ${ui('출력 일부 생략')}` : ''}</span></div><pre>{entry.error || entry.output || ui('출력 없음')}</pre></section>)}</div>
          : <p>{ui('코드 객체 또는 다른 결과 객체를 연결하면 실행 결과가 표시됩니다.')}</p>}
    </div>
    <footer>{ui(executor ? '실행 → 코드 → 결과' : '결과 객체끼리 연결해 출력을 여러 곳에서 확인할 수 있습니다.')}</footer>
  </div>;
}
