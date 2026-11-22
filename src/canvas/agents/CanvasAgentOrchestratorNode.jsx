import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import MarkdownText from '../../components/MarkdownText.jsx';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import {
  MULTI_AGENT_TEMPLATES,
  ORCHESTRATION_MODES,
  readAgentNodeConfig,
  readOrchestratorConfig,
  writeOrchestratorPatch,
} from './agentCanvasModel.js';
import { inspectAgentConnections, resolveMultiAgentGraph } from './multiAgentGraph.js';
import { useAgentNodeState } from './useAgentNodeState.js';
import './canvas-multi-agent.css';

export default function CanvasAgentOrchestratorNode({
  id,
  item,
  allItems,
  store,
  selected = false,
  readOnly = false,
  canExecute = true,
  onChange,
}) {
  useUiLocale();
  const fieldId = useId();
  const state = useAgentNodeState(id, item, store);
  const config = useMemo(() => readOrchestratorConfig(item), [item]);
  const connections = useMemo(() => inspectAgentConnections(allItems || {}, id), [allItems, id]);

  const resolved = useMemo(() => {
    try {
      return { graph: resolveMultiAgentGraph(allItems || {}, id), error: '' };
    } catch (error) {
      return { graph: null, error: error.message };
    }
  }, [allItems, id]);

  const [tab, setTab] = useState('orchestra');
  const [goalDraft, setGoalDraft] = useState(config.goal);
  const goalFocusedRef = useRef(false);

  useEffect(() => {
    if (!goalFocusedRef.current) setGoalDraft(config.goal);
  }, [config.goal]);

  const commitPatch = (patch) => {
    if (readOnly || !onChange) return;
    const nextPatch = writeOrchestratorPatch(item, patch);
    if (nextPatch) onChange(id, nextPatch);
  };

  const running = Boolean(state?.running);
  const statusKey = running ? 'running' : state?.error || state?.failed ? 'error' : state?.completed || config.lastRun?.status === 'success' ? 'success' : 'idle';
  const modeInfo = ORCHESTRATION_MODES.find(m => m.id === config.mode) || ORCHESTRATION_MODES[1];
  const teamLog = config.lastRun?.log || [];

  const goalInputs = connections.incoming.filter(e => e.edgeConfig.enabled);
  const accent = item.color || '#7055d6';

  return (
    <section
      className={`agent-card agent-orchestrator-card${running ? ' is-running' : ''}${selected ? ' is-selected' : ''}`}
      style={{ '--agent-accent': accent }}
      aria-busy={running}
      aria-label={item.title || ui('멀티 에이전트 오케스트레이터')}
    >
      <header className="agent-card-header">
        <span className="agent-card-icon"><Icon name="network" size={16} /></span>
        <div className="agent-card-heading">
          <strong>{item.title || ui('멀티 에이전트 오케스트레이터')}</strong>
          <small>
            {ui(modeInfo.label)}
            {resolved.graph ? ` · ${ui('{count}개 에이전트', { count: resolved.graph.agentIds.length })}` : ''}
          </small>
        </div>
        <span className={`agent-status-pill is-${statusKey}`}>
          {running
            ? (state?.round ? `R${state.round}/${config.mode === 'graph' ? 1 : config.maxRounds}` : ui('실행 중…'))
            : statusKey === 'error'
              ? ui('오류')
              : statusKey === 'success'
                ? ui('완료')
                : ui('대기')}
        </span>
      </header>

      <nav
        className="agent-card-tabs"
        role="tablist"
        aria-label={ui('오케스트레이터 보기')}
        data-object-action="agent"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" role="tab" aria-selected={tab === 'orchestra'} onClick={() => setTab('orchestra')}>{ui('오케스트라')}</button>
        <button type="button" role="tab" aria-selected={tab === 'log'} onClick={() => setTab('log')}>{ui('협업 로그')}</button>
        <button type="button" role="tab" aria-selected={tab === 'settings'} onClick={() => setTab('settings')}>{ui('설정')}</button>
      </nav>

      <div
        className="agent-card-body"
        data-object-action={selected ? 'agent' : undefined}
        onPointerDown={e => { if (selected || e.target.closest('button,input,textarea,select,a')) e.stopPropagation(); }}
        onClick={e => { if (selected || e.target.closest('button,input,textarea,select,a')) e.stopPropagation(); }}
        onDoubleClick={e => e.stopPropagation()}
        onWheel={e => { if (selected) e.stopPropagation(); }}
        onKeyDown={e => e.stopPropagation()}
      >
        {tab === 'orchestra' && (
          <div className="agent-tab-panel">
            <label className="agent-field-label" htmlFor={`${fieldId}-goal`}>
              <span>{ui('공동 목표 · 오케스트레이션 지시')}</span>
              <textarea
                id={`${fieldId}-goal`}
                name="orchestrator-goal"
                data-object-action="agent"
                rows={2}
                maxLength={4000}
                readOnly={readOnly}
                value={goalDraft}
                placeholder={ui('팀 에이전트가 함께 달성할 공통 목표나 작업 맥락을 적어주세요…')}
                onFocus={() => { goalFocusedRef.current = true; }}
                onBlur={() => {
                  goalFocusedRef.current = false;
                  if (goalDraft !== config.goal) commitPatch({ goal: goalDraft });
                }}
                onChange={e => {
                  const value = e.target.value;
                  setGoalDraft(value);
                  commitPatch({ goal: value });
                }}
              />
            </label>

            {goalInputs.length > 0 && (
              <div className="agent-io-block">
                <span className="agent-io-heading">{ui('입력 자료 ({count})', { count: goalInputs.length })}</span>
                <div className="agent-chip-list">
                  {goalInputs.map(entry => (
                    <button
                      key={entry.connectorId}
                      type="button"
                      className="agent-chip-btn"
                      data-object-action="agent"
                      onClick={() => store?.focusCanvasObject?.(entry.otherId)}
                    >
                      <em>{entry.channel}</em>
                      <span>{entry.summary}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {resolved.graph ? (
              <div className="agent-topology-box">
                <span className="agent-io-heading">{ui('팀 협업 그래프 ({waves}단계)', { waves: resolved.graph.waves.length })}</span>
                <div className="agent-wave-list">
                  {resolved.graph.waves.map((wave, waveIndex) => (
                    <div key={waveIndex} className="agent-wave-row">
                      <span className="agent-wave-badge">W{waveIndex + 1}</span>
                      <div className="agent-chip-list">
                        {wave.map(agentId => {
                          const agent = allItems?.[agentId];
                          const cfg = readAgentNodeConfig(agent);
                          const isSup = resolved.graph.supervisorAgentId === agentId;
                          return (
                            <button
                              key={agentId}
                              type="button"
                              className="agent-chip-btn is-team"
                              data-object-action="agent"
                              style={{ '--chip-accent': agent?.color || '#6d5ce7' }}
                              onClick={() => store?.focusCanvasObject?.(agentId)}
                            >
                              {isSup && <em>{ui('감독')}</em>}
                              <span>{agent?.title || cfg.role}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {resolved.graph.feedbackEdges.length > 0 && (
                  <small className="agent-feedback-note">
                    {ui('피드백 루프 {count}개 연결됨', { count: resolved.graph.feedbackEdges.length })}
                  </small>
                )}
              </div>
            ) : (
              <div className="agent-template-starter">
                <p className="agent-empty-hint">{resolved.error}</p>
                {!readOnly && store?.createTemplate && (
                  <div className="agent-template-buttons">
                    <strong>{ui('빠른 멀티 에이전트 팀 배치')}</strong>
                    {MULTI_AGENT_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.id}
                        type="button"
                        data-object-action="agent"
                        onClick={() => store.createTemplate(id, tpl.id)}
                      >
                        {ui(tpl.label)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {state?.error && <p className="agent-error-line" role="alert">{state.error}</p>}
            {running && state?.detail && <p className="agent-progress-line" role="status">{state.detail}</p>}
          </div>
        )}

        {tab === 'log' && (
          <div className="agent-tab-panel">
            {teamLog.length > 0 && (
              <ol className="agent-collab-timeline">
                {teamLog.map((entry, idx) => (
                  <li key={`${entry.round}-${entry.agentId}-${idx}`} className={`is-${entry.status}`}>
                    <div className="agent-collab-meta">
                      <strong>R{entry.round} · {entry.agentName}</strong>
                      <span>{entry.approved ? ui('승인됨') : entry.done ? ui('완료') : ui(entry.status === 'error' ? '오류' : '응답')}</span>
                    </div>
                    <p>{entry.summary}</p>
                    {entry.directives?.length > 0 && (
                      <div className="agent-collab-directives">
                        {entry.directives.map((d, dIdx) => (
                          <span key={dIdx}>{d.type.toUpperCase()} → {d.toName}</span>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {item.text ? (
              <div className="agent-output-markdown">
                <MarkdownText source={item.text} />
              </div>
            ) : !teamLog.length ? (
              <p className="agent-empty-hint">{ui('멀티 에이전트를 실행하면 에이전트 간 핸드오프·피드백 기록과 최종 결과가 표시됩니다.')}</p>
            ) : null}
          </div>
        )}

        {tab === 'settings' && (
          <div className="agent-tab-panel agent-settings-mini">
            <label htmlFor={`${fieldId}-title`}>
              <span>{ui('오케스트레이터 이름')}</span>
              <input
                id={`${fieldId}-title`}
                data-object-action="agent"
                type="text"
                maxLength={120}
                readOnly={readOnly}
                value={item.title || ''}
                onChange={e => commitPatch({ title: e.target.value })}
              />
            </label>
            <label htmlFor={`${fieldId}-mode`}>
              <span>{ui('오케스트레이션 방식')}</span>
              <select
                id={`${fieldId}-mode`}
                data-object-action="agent"
                disabled={readOnly}
                value={config.mode}
                onChange={e => commitPatch({ mode: e.target.value })}
              >
                {ORCHESTRATION_MODES.map(mode => (
                  <option key={mode.id} value={mode.id}>{ui(mode.label)}</option>
                ))}
              </select>
            </label>
            {config.mode !== 'graph' && (
              <label htmlFor={`${fieldId}-rounds`}>
                <span>{ui('최대 협업 라운드')}</span>
                <input
                  id={`${fieldId}-rounds`}
                  data-object-action="agent"
                  type="number"
                  min="1"
                  max="6"
                  step="1"
                  readOnly={readOnly}
                  value={config.maxRounds}
                  onChange={e => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 1 && n <= 6) commitPatch({ maxRounds: n });
                  }}
                />
              </label>
            )}
            {config.mode === 'supervisor' && resolved.graph?.agentIds?.length > 0 && (
              <label htmlFor={`${fieldId}-supervisor`}>
                <span>{ui('감독 에이전트')}</span>
                <select
                  id={`${fieldId}-supervisor`}
                  data-object-action="agent"
                  disabled={readOnly}
                  value={resolved.graph.supervisorAgentId}
                  onChange={e => commitPatch({ supervisorAgentId: e.target.value })}
                >
                  {resolved.graph.agentIds.map(agentId => (
                    <option key={agentId} value={agentId}>
                      {allItems?.[agentId]?.title || readAgentNodeConfig(allItems?.[agentId]).role}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="agent-mini-check" htmlFor={`${fieldId}-shared`}>
              <input
                id={`${fieldId}-shared`}
                data-object-action="agent"
                type="checkbox"
                disabled={readOnly}
                checked={config.sharedMemory}
                onChange={e => commitPatch({ sharedMemory: e.target.checked })}
              />
              <span>{ui('팀 공유 협업 기억 유지')}</span>
            </label>
            <label className="agent-mini-check" htmlFor={`${fieldId}-consensus`}>
              <input
                id={`${fieldId}-consensus`}
                data-object-action="agent"
                type="checkbox"
                disabled={readOnly}
                checked={config.consensusStop}
                onChange={e => commitPatch({ consensusStop: e.target.checked })}
              />
              <span>{ui('합의·승인 시 조기 종료')}</span>
            </label>
          </div>
        )}
      </div>

      <footer className="agent-card-footer">
        <button
          type="button"
          className={`agent-run-btn${running ? ' is-stop' : ''}`}
          data-object-action="agent"
          data-agent-run="true"
          aria-keyshortcuts="Shift+Enter"
          disabled={!canExecute || !store || (!running && (store.isRunning() || Boolean(resolved.error)))}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            if (running) store.stop();
            else void store.runOrchestrator(id);
          }}
        >
          {running ? (
            <>
              <span className="runtime-spinner" aria-hidden="true" />
              <span>{ui('협업 중지')}</span>
            </>
          ) : (
            <>
              <Icon name="play" size={13} />
              <span>{ui('멀티 에이전트 실행')}</span>
              <span className="agent-run-kbd" aria-hidden="true">⇧↵</span>
            </>
          )}
        </button>
      </footer>
    </section>
  );
}
