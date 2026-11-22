import { useEffect, useState, useSyncExternalStore } from 'react';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import './canvas-multi-agent.css';

export default function MultiAgentActivity({ store, onFocusObject }) {
  useUiLocale();
  const activity = useSyncExternalStore(
    listener => (store ? store.subscribeActivity(listener) : () => {}),
    () => store?.getActivity() || null,
    () => null,
  );
  const [now, setNow] = useState(() => Date.now());
  const running = activity?.status === 'running';

  useEffect(() => {
    if (!running) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activity?.startedAt, running]);

  if (!activity) return null;

  const elapsed = Math.max(0, Math.floor(((activity.endedAt || now) - activity.startedAt) / 1000));
  const heading = running
    ? (activity.kind === 'orchestrator'
      ? ui('멀티 에이전트 협업 중')
      : activity.kind === 'router'
        ? ui('라우팅 판단 중')
        : activity.kind === 'input'
          ? ui('입력 파이프라인 실행 중')
          : ui('AI 에이전트 실행 중'))
    : activity.status === 'error'
      ? ui('에이전트 작업 실패')
      : ui('에이전트 작업 완료');

  return (
    <aside className={`multi-agent-activity is-${activity.status}`} aria-label={heading}>
      {running ? (
        <span className="runtime-spinner" aria-hidden="true" />
      ) : (
        <span className="multi-agent-outcome-icon" aria-hidden="true">
          {activity.status === 'error' ? '!' : '✓'}
        </span>
      )}

      <div className="multi-agent-activity-copy">
        <strong role="status">{heading}</strong>
        <span>
          {activity.title}
          {activity.maxRounds > 1 ? ` · R${activity.round || 1}/${activity.maxRounds}` : ''}
        </span>
        {activity.currentAgentName && running && (
          <div className="multi-agent-active-agent">{activity.currentAgentName}</div>
        )}
        {running && activity.progress && (
          <small className="multi-agent-activity-progress">{activity.progress}</small>
        )}
        {activity.error && <small className="multi-agent-activity-error">{activity.error}</small>}

        {Boolean(activity.entries?.length) && (
          <ol className="multi-agent-step-list">
            {activity.entries.map((entry, idx) => (
              <li key={`${entry.agentId}-${entry.round}-${idx}`} className={`is-${entry.status}`}>
                <span aria-hidden="true">{entry.status === 'running' ? '◷' : entry.status === 'error' ? '!' : '✓'}</span>
                <button
                  type="button"
                  onClick={() => onFocusObject?.(entry.agentId)}
                >
                  R{entry.round} · {entry.agentName}
                </button>
                <span>
                  {entry.approved ? ui('승인됨') : entry.done ? ui('완료') : ui(entry.status === 'running' ? '진행 중' : entry.status === 'error' ? '실패' : '완료')}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="multi-agent-activity-actions">
        <time>{elapsed}s</time>
        {running ? (
          <button
            type="button"
            className="multi-agent-stop-btn"
            onClick={() => store?.stop()}
          >
            {ui('중지')}
          </button>
        ) : (
          <button
            type="button"
            className="multi-agent-dismiss-btn"
            aria-label={ui('상태 닫기')}
            onClick={() => store?.dismissActivity()}
          >
            ×
          </button>
        )}
      </div>
    </aside>
  );
}
