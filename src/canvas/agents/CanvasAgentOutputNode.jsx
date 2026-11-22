import { useId, useMemo, useState } from 'react';
import CanvasSelect from '../content/CanvasSelect.jsx';
import Icon from '../../components/Icon.jsx';
import MarkdownText from '../../components/MarkdownText.jsx';
import { intlLocale, ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import {
  OUTPUT_DISPLAY_MODES,
  readAgentOutputConfig,
  writeAgentOutputPatch,
} from './agentCanvasModel.js';
import { formatTypeLabel } from './agentRouter.js';
import { inspectAgentConnections } from './multiAgentGraph.js';
import './canvas-multi-agent.css';

function formatOutputAsJson(text, meta) {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return JSON.stringify({
      source: meta?.sourceName || '',
      routedBy: meta?.routedBy || undefined,
      inputFormats: meta?.inputFormats || undefined,
      output: text,
    }, null, 2);
  }
}

export default function CanvasAgentOutputNode({
  id,
  item,
  allItems,
  store,
  selected = false,
  readOnly = false,
  onChange,
}) {
  const locale = useUiLocale();
  const fieldId = useId();
  const config = useMemo(() => readAgentOutputConfig(item), [item]);
  const connections = useMemo(() => inspectAgentConnections(allItems || {}, id), [allItems, id]);
  const [tab, setTab] = useState('latest');
  const [copied, setCopied] = useState(false);

  const commitPatch = (patch) => {
    if (readOnly || !onChange) return;
    const nextPatch = writeAgentOutputPatch(item, patch);
    if (nextPatch) onChange(id, nextPatch);
  };

  const results = Array.isArray(item.runtimeResults) ? item.runtimeResults : [];
  const meta = config.lastMeta;
  const hasOutput = Boolean(item.text || results.length);
  const latestText = item.text || results[results.length - 1]?.output || '';
  const statusKey = meta?.status === 'error' ? 'error' : hasOutput ? 'success' : 'idle';
  const accent = item.color || '#0f766e';

  const handleCopy = () => {
    if (!latestText || !navigator.clipboard?.writeText) return;
    void navigator.clipboard.writeText(latestText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }).catch(() => {});
  };

  const handleClear = () => {
    commitPatch({ text: '', lastMeta: null, runtimeResults: [] });
  };

  return (
    <section
      className={`agent-card agent-output-card${selected ? ' is-selected' : ''}`}
      style={{ '--agent-accent': accent }}
      aria-label={item.title || ui('출력 객체')}
    >
      <header className="agent-card-header">
        <span className="agent-card-icon"><Icon name="outputCard" size={15} /></span>
        <div className="agent-card-heading">
          <strong>{item.title || ui('출력 객체')}</strong>
          <small>
            {meta?.sourceName ? `${ui('수신')}: ${meta.sourceName}` : ui('에이전트 응답 대기')}
          </small>
        </div>
        {!readOnly && store?.startConnectorFrom && (
          <button
            type="button"
            className="agent-header-connect-btn"
            data-object-action="agent"
            title={ui('연결 객체로 다음 노드에 연결')}
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
        <span className={`agent-status-pill is-${statusKey}`}>
          {statusKey === 'error' ? ui('오류') : hasOutput ? ui('응답 수신') : ui('대기')}
        </span>
      </header>

      <nav
        className="agent-card-tabs"
        role="tablist"
        aria-label={ui('출력 보기')}
        data-object-action="agent"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" role="tab" aria-selected={tab === 'latest'} onClick={() => setTab('latest')}>{ui('최신 응답')}</button>
        <button type="button" role="tab" aria-selected={tab === 'history'} onClick={() => setTab('history')}>{ui('기록 ({count})', { count: results.length })}</button>
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
        {tab === 'latest' && (
          <div className="agent-tab-panel">
            {config.showMetadata && meta && (
              <div className="agent-output-meta-bar">
                {meta.routedBy && <span>{ui('라우터')}: {meta.routedBy}</span>}
                {meta.inputFormats?.length > 0 && (
                  <span>{meta.inputFormats.map(f => ui(formatTypeLabel(f))).join(', ')}</span>
                )}
                {meta.routeReason && <small>{meta.routeReason}</small>}
              </div>
            )}

            {latestText ? (
              config.displayMode === 'plain' ? (
                <pre className="agent-output-pre">{latestText}</pre>
              ) : config.displayMode === 'json' ? (
                <pre className="agent-output-pre">{formatOutputAsJson(latestText, meta)}</pre>
              ) : (
                <div className="agent-output-markdown">
                  <MarkdownText source={latestText} />
                </div>
              )
            ) : (
              <div className="agent-io-block">
                <p className="agent-empty-hint">{ui('에이전트, 라우터, 또는 오케스트레이터에서 연결 객체로 연결하면 최종 응답이 이곳에 반환됩니다.')}</p>
                {connections.incoming.length > 0 && (
                  <div className="agent-chip-list">
                    {connections.incoming.map(entry => (
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
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="agent-tab-panel">
            {results.length ? (
              <ol className="agent-collab-timeline">
                {[...results].reverse().map((entry, idx) => (
                  <li key={`${entry.runId}-${entry.createdAt}-${idx}`}>
                    <div className="agent-collab-meta">
                      <strong>{entry.codeId}</strong>
                      <span>{new Date(entry.createdAt).toLocaleTimeString(intlLocale(locale))}</span>
                    </div>
                    <pre className="agent-output-pre">{entry.error || entry.output}</pre>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="agent-empty-hint">{ui('누적된 실행 응답 기록이 없습니다.')}</p>
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="agent-tab-panel agent-settings-mini">
            <label htmlFor={`${fieldId}-title`}>
              <span>{ui('출력 객체 이름')}</span>
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
            <label htmlFor={`${fieldId}-display`}>
              <span>{ui('표시 형식')}</span>
              <CanvasSelect
                id={`${fieldId}-display`}
                data-object-action="agent"
                disabled={readOnly}
                value={config.displayMode}
                onChange={e => commitPatch({ displayMode: e.target.value })}
              >
                {OUTPUT_DISPLAY_MODES.map(mode => (
                  <option key={mode.id} value={mode.id}>{ui(mode.label)}</option>
                ))}
              </CanvasSelect>
            </label>
            <label className="agent-mini-check" htmlFor={`${fieldId}-append`}>
              <input
                id={`${fieldId}-append`}
                data-object-action="agent"
                type="checkbox"
                disabled={readOnly}
                checked={config.appendHistory}
                onChange={e => commitPatch({ appendHistory: e.target.checked })}
              />
              <span>{ui('실행 기록 누적 보관')}</span>
            </label>
            <label className="agent-mini-check" htmlFor={`${fieldId}-meta`}>
              <input
                id={`${fieldId}-meta`}
                data-object-action="agent"
                type="checkbox"
                disabled={readOnly}
                checked={config.showMetadata}
                onChange={e => commitPatch({ showMetadata: e.target.checked })}
              />
              <span>{ui('출처·라우팅 정보 표시')}</span>
            </label>
          </div>
        )}
      </div>

      <footer className="agent-card-footer agent-output-footer">
        <button
          type="button"
          className="agent-footer-secondary"
          data-object-action="agent"
          disabled={!latestText}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            handleCopy();
          }}
        >
          <Icon name={copied ? 'check' : 'copy'} size={12} />
          <span>{copied ? ui('복사됨') : ui('복사')}</span>
        </button>
        {!readOnly && (
          <button
            type="button"
            className="agent-footer-secondary"
            data-object-action="agent"
            disabled={!hasOutput}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              handleClear();
            }}
          >
            <Icon name="trash" size={12} />
            <span>{ui('지우기')}</span>
          </button>
        )}
      </footer>
    </section>
  );
}
