import { useEffect, useId, useMemo, useRef, useState } from 'react';
import CanvasSelect from '../content/CanvasSelect.jsx';
import Icon from '../../components/Icon.jsx';
import MarkdownText from '../../components/MarkdownText.jsx';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import { agentProvider } from '../../components/agentPreferences.js';
import {
  AGENT_ROLE_PRESETS,
  readAgentNodeConfig,
  writeAgentNodePatch,
} from './agentCanvasModel.js';
import { inspectAgentConnections } from './multiAgentGraph.js';
import { useAgentNodeState } from './useAgentNodeState.js';
import MockAgentResponseFields from './MockAgentResponseFields.jsx';
import './canvas-multi-agent.css';

const CHANNEL_BADGES = {
  input: '입력',
  route: '라우팅',
  supervisor: '감독',
  prompt: '프롬프트',
  data: '데이터',
  context: '컨텍스트',
  handoff: '핸드오프',
  feedback: '피드백',
  output: '출력',
  orchestrate: '오케스트라',
};

export default function CanvasAgentNode({
  id,
  item,
  allItems,
  store,
  selected = false,
  readOnly = false,
  canExecute = true,
  isAdmin = false,
  onChange,
}) {
  useUiLocale();
  const fieldId = useId();
  const state = useAgentNodeState(id, item, store);
  const config = useMemo(() => readAgentNodeConfig(item), [item]);
  const connections = useMemo(() => inspectAgentConnections(allItems || {}, id), [allItems, id]);

  const [tab, setTab] = useState('graph');
  const [promptDraft, setPromptDraft] = useState(config.systemPrompt);
  const promptFocusedRef = useRef(false);

  useEffect(() => {
    if (!promptFocusedRef.current) setPromptDraft(config.systemPrompt);
  }, [config.systemPrompt]);

  const commitPatch = (patch) => {
    if (readOnly || !onChange) return;
    const nextPatch = writeAgentNodePatch(item, patch);
    if (nextPatch) onChange(id, nextPatch);
  };

  const running = Boolean(state?.running);
  const statusKey = running ? 'running' : state?.error || state?.failed ? 'error' : state?.status === 'skipped' ? 'skipped' : state?.completed || config.lastMeta?.status === 'success' ? 'success' : state?.status === 'queued' ? 'queued' : 'idle';
  const statusText = running
    ? ui('작업 중…')
    : statusKey === 'queued'
      ? ui('대기')
      : statusKey === 'skipped'
        ? ui('건너뜀')
        : statusKey === 'error'
          ? ui('오류')
          : statusKey === 'success'
            ? ui('완료')
            : ui('준비');

  const provider = agentProvider(config.provider);
  const engineLabel = config.engine === 'mock' ? ui('모형 에이전트') : `${provider.label}${config.model || provider.defaultModel ? ` · ${config.model || provider.defaultModel}` : ''}`;

  const inputItems = [...connections.inputNodes, ...connections.routerNodes, ...connections.promptInputs, ...connections.dataInputs, ...connections.upstreamAgents, ...connections.feedbackAgents];
  const outputItems = [...connections.outgoingRouters, ...connections.downstreamAgents, ...connections.feedbackTargets, ...connections.outputSinks];
  const accent = item.color || '#6d5ce7';

  return (
    <section
      className={`agent-card agent-node-card${running ? ' is-running' : ''}${selected ? ' is-selected' : ''}`}
      style={{ '--agent-accent': accent }}
      aria-busy={running}
      aria-label={item.title || ui('AI 에이전트 객체')}
    >
      <header className="agent-card-header">
        <span className="agent-card-icon"><Icon name="sparkle" size={15} /></span>
        <div className="agent-card-heading">
          <strong>{item.title || ui('AI 에이전트')}</strong>
          <small>{config.role} · {engineLabel}</small>
        </div>
        {!readOnly && store?.startConnectorFrom && (
          <button
            type="button"
            className="agent-header-connect-btn"
            data-object-action="agent"
            title={ui('연결 객체로 다른 노드에 연결')}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              store.startConnectorFrom(id);
            }}
          >
            <Icon name="connect" size={12} />
            <span>{ui('연결')}</span>
          </button>
        )}
        <span className={`agent-status-pill is-${statusKey}`}>{statusText}</span>
      </header>

      <nav
        className="agent-card-tabs"
        role="tablist"
        aria-label={ui('에이전트 보기')}
        data-object-action="agent"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" role="tab" aria-selected={tab === 'graph'} onClick={() => setTab('graph')}>{ui('연결 그래프')}</button>
        <button type="button" role="tab" aria-selected={tab === 'output'} onClick={() => setTab('output')}>{ui('결과')}</button>
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
        {tab === 'graph' && (
          <div className="agent-tab-panel">
            <label className="agent-field-label" htmlFor={`${fieldId}-prompt`}>
              <span>{ui('기본 프롬프트')}</span>
              <textarea
                id={`${fieldId}-prompt`}
                name="agent-node-system-prompt"
                data-object-action="agent"
                rows={3}
                maxLength={6000}
                readOnly={readOnly}
                value={promptDraft}
                placeholder={ui('이 에이전트의 역할, 행동 규칙, 기본 지시사항을 입력하세요…')}
                onFocus={() => { promptFocusedRef.current = true; }}
                onBlur={() => {
                  promptFocusedRef.current = false;
                  if (promptDraft !== config.systemPrompt) commitPatch({ systemPrompt: promptDraft });
                }}
                onChange={e => {
                  const value = e.target.value;
                  setPromptDraft(value);
                  commitPatch({ systemPrompt: value });
                }}
              />
            </label>

            <div className="agent-io-block">
              <span className="agent-io-heading">{ui('수신 그래프 ({count})', { count: inputItems.length })}</span>
              {inputItems.length ? (
                <div className="agent-chip-list">
                  {inputItems.map(entry => (
                    <button
                      key={entry.connectorId}
                      type="button"
                      className="agent-chip-btn"
                      data-object-action="agent"
                      title={`${entry.summary} (${ui(CHANNEL_BADGES[entry.channel] || entry.channel)})`}
                      onClick={() => store?.focusCanvasObject?.(entry.otherId)}
                    >
                      <em>{ui(CHANNEL_BADGES[entry.channel] || entry.channel)}</em>
                      <span>{entry.summary}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="agent-empty-hint">{ui('메모·코드·데이터·다른 에이전트를 화살표로 연결하면 입력으로 전달됩니다.')}</p>
              )}
            </div>

            <div className="agent-io-block">
              <span className="agent-io-heading">{ui('송신 그래프 ({count})', { count: outputItems.length })}</span>
              {outputItems.length ? (
                <div className="agent-chip-list">
                  {outputItems.map(entry => (
                    <button
                      key={entry.connectorId}
                      type="button"
                      className="agent-chip-btn is-outbound"
                      data-object-action="agent"
                      title={`${entry.summary} (${ui(CHANNEL_BADGES[entry.channel] || entry.channel)})`}
                      onClick={() => store?.focusCanvasObject?.(entry.otherId)}
                    >
                      <em>{ui(CHANNEL_BADGES[entry.channel] || entry.channel)}</em>
                      <span>{entry.summary}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="agent-empty-hint">{ui('결과 객체·텍스트·값 또는 다음 에이전트로 연결할 수 있습니다.')}</p>
              )}
            </div>
          </div>
        )}

        {tab === 'output' && (
          <div className="agent-tab-panel">
            {(running || state?.detail) && (
              <p className="agent-progress-line" role="status">{state?.detail ? ui(state.detail) : ui('에이전트 응답을 기다리는 중…')}</p>
            )}
            {state?.error && <p className="agent-error-line" role="alert">{ui(state.error)}</p>}
            {item.text ? (
              <div className="agent-output-markdown">
                <MarkdownText source={item.text} />
              </div>
            ) : (
              <p className="agent-empty-hint">{ui('실행 후 에이전트 결과가 여기에 표시되고 연결된 결과 객체에도 전달됩니다.')}</p>
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="agent-tab-panel agent-settings-mini">
            <label htmlFor={`${fieldId}-title`}>
              <span>{ui('에이전트 이름')}</span>
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
            <label htmlFor={`${fieldId}-preset`}>
              <span>{ui('역할 프리셋')}</span>
              <CanvasSelect
                id={`${fieldId}-preset`}
                data-object-action="agent"
                disabled={readOnly}
                value={config.presetId}
                onChange={e => {
                  const preset = AGENT_ROLE_PRESETS.find(p => p.id === e.target.value);
                  if (!preset) return;
                  setPromptDraft(preset.systemPrompt);
                  commitPatch({
                    presetId: preset.id,
                    role: preset.role,
                    color: preset.color,
                    title: preset.defaultTitle,
                    systemPrompt: preset.systemPrompt,
                  });
                }}
              >
                {AGENT_ROLE_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{ui(p.label)}</option>
                ))}
              </CanvasSelect>
            </label>
            <label htmlFor={`${fieldId}-role`}>
              <span>{ui('역할 설명')}</span>
              <input
                id={`${fieldId}-role`}
                data-object-action="agent"
                type="text"
                maxLength={120}
                readOnly={readOnly}
                value={config.role}
                onChange={e => commitPatch({ role: e.target.value })}
              />
            </label>
            <label htmlFor={`${fieldId}-engine`}>
              <span>{ui('실행 엔진')}</span>
              <CanvasSelect
                id={`${fieldId}-engine`}
                data-object-action="agent"
                disabled={readOnly}
                value={config.engine}
                onChange={e => commitPatch({ engine: e.target.value })}
              >
                <option value="api">{ui('모델 API')}</option>
                <option value="mock">{ui('모형 에이전트')}</option>
              </CanvasSelect>
            </label>
            {config.engine === 'mock' && (
              <MockAgentResponseFields config={config} onChange={commitPatch} readOnly={readOnly} />
            )}
            {config.engine !== 'mock' && <button
              type="button"
              className="agent-mini-link"
              data-object-action="agent"
              onClick={() => store?.openAgentPanel?.()}
            >
              {ui('에이전트 설정')}
            </button>}
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
          disabled={!canExecute || !store || (!running && store.isRunning())}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            if (running) store.stop();
            else void store.runAgent(id);
          }}
        >
          {running ? (
            <>
              <span className="runtime-spinner" aria-hidden="true" />
              <span>{ui('작업 중지')}</span>
            </>
          ) : (
            <>
              <Icon name="play" size={13} />
              <span>{ui('단독 실행')}</span>
              <span className="agent-run-kbd" aria-hidden="true">⇧↵</span>
            </>
          )}
        </button>
      </footer>
    </section>
  );
}
