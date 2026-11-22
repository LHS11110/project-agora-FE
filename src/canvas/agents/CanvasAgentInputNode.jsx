import { useEffect, useId, useMemo, useRef, useState } from 'react';
import CanvasSelect from '../content/CanvasSelect.jsx';
import Icon from '../../components/Icon.jsx';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import {
  INPUT_TYPE_OPTIONS,
  readAgentInputConfig,
  writeAgentInputPatch,
} from './agentCanvasModel.js';
import {
  collectInputEnvelope,
  detectFileFormatType,
  formatTypeLabel,
} from './agentRouter.js';
import { inspectAgentConnections } from './multiAgentGraph.js';
import { useAgentNodeState } from './useAgentNodeState.js';
import './canvas-multi-agent.css';

const TEXT_SNIPPET_RE = /\.(?:txt|md|markdown|json|csv|tsv|py|js|jsx|ts|tsx|html|css|sql|yaml|yml|xml|log)$/i;

export default function CanvasAgentInputNode({
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
  const fileInputRef = useRef(null);
  const state = useAgentNodeState(id, item, store);
  const config = useMemo(() => readAgentInputConfig(item), [item]);
  const connections = useMemo(() => inspectAgentConnections(allItems || {}, id), [allItems, id]);
  const envelope = useMemo(() => collectInputEnvelope(allItems || {}, id), [allItems, id]);

  const [textDraft, setTextDraft] = useState(item.text || '');
  const textFocusedRef = useRef(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [urlNameDraft, setUrlNameDraft] = useState('');

  useEffect(() => {
    if (!textFocusedRef.current) setTextDraft(item.text || '');
  }, [item.text]);

  const commitPatch = (patch) => {
    if (readOnly || !onChange) return;
    const nextPatch = writeAgentInputPatch(item, patch);
    if (nextPatch) onChange(id, nextPatch);
  };

  const handleAttachFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length || readOnly) return;

    const added = [];
    for (const file of files) {
      const formatType = detectFileFormatType(file.name, file.type, '');
      let textSnippet = '';
      if ((file.type.startsWith('text/') || TEXT_SNIPPET_RE.test(file.name)) && file.size <= 131072) {
        try {
          textSnippet = (await file.text()).slice(0, 1200);
        } catch {
          textSnippet = '';
        }
      }
      added.push({
        id: globalThis.crypto?.randomUUID?.() || `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        formatType,
        name: file.name,
        mimeType: file.type || '',
        sizeBytes: file.size,
        ...(textSnippet ? { textSnippet } : {}),
      });
    }
    commitPatch({ attachments: [...config.attachments, ...added] });
  };

  const handleAddUrlAttachment = () => {
    const cleanUrl = urlDraft.trim();
    if (!cleanUrl || readOnly) return;
    const formatType = detectFileFormatType(urlNameDraft.trim(), '', cleanUrl);
    const name = urlNameDraft.trim() || cleanUrl.replace(/^https?:\/\//i, '').slice(0, 60) || '미디어 URL';
    const next = {
      id: globalThis.crypto?.randomUUID?.() || `url-${Date.now()}`,
      formatType,
      name,
      mimeType: '',
      url: cleanUrl,
    };
    commitPatch({ attachments: [...config.attachments, next] });
    setUrlDraft('');
    setUrlNameDraft('');
    setShowUrlForm(false);
  };

  const removeAttachment = (attId) => {
    commitPatch({ attachments: config.attachments.filter(att => att.id !== attId) });
  };

  const running = Boolean(state?.running);
  const statusKey = running ? 'running' : state?.error || state?.failed ? 'error' : state?.completed ? 'success' : 'idle';
  const statusText = running ? ui('전송 중…') : statusKey === 'error' ? ui('오류') : statusKey === 'success' ? ui('완료') : ui('입력');
  const accent = item.color || '#2563eb';
  const hasTargets = connections.outgoing.some(e => e.edgeConfig.enabled);
  const detectedFormats = envelope.formats.length ? envelope.formats : [config.inputType === 'auto' ? 'text' : config.inputType];

  return (
    <section
      className={`agent-card agent-input-card${running ? ' is-running' : ''}${selected ? ' is-selected' : ''}`}
      style={{ '--agent-accent': accent }}
      aria-busy={running}
      aria-label={item.title || ui('입력 객체')}
    >
      <header className="agent-card-header">
        <span className="agent-card-icon"><Icon name="inbox" size={15} /></span>
        <div className="agent-card-heading">
          <strong>{item.title || ui('입력 객체')}</strong>
          <small>
            {detectedFormats.map(f => ui(formatTypeLabel(f))).join(' · ')}
            {config.attachments.length ? ` · ${ui('첨부 {count}개', { count: config.attachments.length })}` : ''}
          </small>
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

      <div
        className="agent-card-body"
        data-object-action={selected ? 'agent' : undefined}
        onPointerDown={e => { if (selected || e.target.closest('button,input,textarea,select,a')) e.stopPropagation(); }}
        onClick={e => { if (selected || e.target.closest('button,input,textarea,select,a')) e.stopPropagation(); }}
        onDoubleClick={e => e.stopPropagation()}
        onWheel={e => { if (selected) e.stopPropagation(); }}
        onKeyDown={e => e.stopPropagation()}
      >
        <div className="agent-tab-panel">
          <div className="agent-inline-select-row">
            <label htmlFor={`${fieldId}-type`}>{ui('입력 형식')}</label>
            <CanvasSelect
              id={`${fieldId}-type`}
              data-object-action="agent"
              disabled={readOnly}
              value={config.inputType}
              onChange={e => commitPatch({ inputType: e.target.value })}
            >
              {INPUT_TYPE_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{ui(opt.label)}</option>
              ))}
            </CanvasSelect>
          </div>

          <label className="agent-field-label" htmlFor={`${fieldId}-text`}>
            <span>{ui('사용자 입력 내용')}</span>
            <textarea
              id={`${fieldId}-text`}
              name="agent-input-text"
              data-object-action="agent"
              rows={3}
              maxLength={24000}
              readOnly={readOnly}
              value={textDraft}
              placeholder={ui(config.placeholder)}
              onFocus={() => { textFocusedRef.current = true; }}
              onBlur={() => {
                textFocusedRef.current = false;
                if (textDraft !== (item.text || '')) commitPatch({ text: textDraft });
              }}
              onChange={e => {
                const value = e.target.value;
                setTextDraft(value);
                commitPatch({ text: value });
              }}
            />
          </label>

          <div className="agent-io-block">
            <div className="agent-io-row-head">
              <span className="agent-io-heading">{ui('멀티모달 첨부 ({count})', { count: config.attachments.length })}</span>
              {!readOnly && (
                <div className="agent-inline-btn-group">
                  <button
                    type="button"
                    className="agent-micro-btn"
                    data-object-action="agent"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    + {ui('파일')}
                  </button>
                  <button
                    type="button"
                    className="agent-micro-btn"
                    data-object-action="agent"
                    onClick={() => setShowUrlForm(v => !v)}
                  >
                    + {ui('URL')}
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                id={`${fieldId}-file`}
                type="file"
                multiple
                accept="image/*,audio/*,video/*,application/pdf,.txt,.md,.json,.csv,.tsv,.xlsx,.py,.js,.ts,.html,.css"
                hidden
                onChange={handleAttachFiles}
              />
            </div>

            {showUrlForm && !readOnly && (
              <div className="agent-url-attach-box">
                <input
                  id={`${fieldId}-url`}
                  type="text"
                  data-object-action="agent"
                  placeholder={ui('이미지·오디오·동영상·PDF·웹 URL 입력…')}
                  value={urlDraft}
                  onChange={e => setUrlDraft(e.target.value)}
                />
                <div className="agent-url-attach-actions">
                  <input
                    id={`${fieldId}-url-name`}
                    type="text"
                    data-object-action="agent"
                    placeholder={ui('표시 이름 (선택)')}
                    value={urlNameDraft}
                    onChange={e => setUrlNameDraft(e.target.value)}
                  />
                  <button type="button" data-object-action="agent" onClick={handleAddUrlAttachment}>
                    {ui('추가')}
                  </button>
                </div>
              </div>
            )}

            {config.attachments.length > 0 && (
              <div className="agent-chip-list">
                {config.attachments.map(att => (
                  <span key={att.id} className="agent-attachment-chip">
                    <em>{ui(formatTypeLabel(att.formatType))}</em>
                    <span title={att.url || att.name}>{att.name}</span>
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={ui('첨부 삭제')}
                        data-object-action="agent"
                        onClick={() => removeAttachment(att.id)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          {connections.incoming.length > 0 && (
            <div className="agent-io-block">
              <span className="agent-io-heading">{ui('연결된 소스 ({count})', { count: connections.incoming.length })}</span>
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
            </div>
          )}

          <div className="agent-io-block">
            <span className="agent-io-heading">{ui('전달 대상 ({count})', { count: connections.outgoing.length })}</span>
            {connections.outgoing.length ? (
              <div className="agent-chip-list">
                {connections.outgoing.map(entry => (
                  <button
                    key={entry.connectorId}
                    type="button"
                    className="agent-chip-btn is-outbound"
                    data-object-action="agent"
                    onClick={() => store?.focusCanvasObject?.(entry.otherId)}
                  >
                    <em>{entry.channel}</em>
                    <span>{entry.summary}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="agent-connect-cta">
                <p className="agent-empty-hint">{ui('오케스트레이터, 라우터, 또는 에이전트를 연결 객체로 연결하세요.')}</p>
                {!readOnly && store?.startConnectorFrom && (
                  <button
                    type="button"
                    className="agent-mini-link"
                    data-object-action="agent"
                    onClick={() => store.startConnectorFrom(id)}
                  >
                    {ui('연결 객체로 대상 연결')}
                  </button>
                )}
              </div>
            )}
          </div>

          {state?.error && <p className="agent-error-line" role="alert">{ui(state.error)}</p>}
        </div>
      </div>

      <footer className="agent-card-footer">
        <button
          type="button"
          className={`agent-run-btn${running ? ' is-stop' : ''}`}
          data-object-action="agent"
          data-agent-run="true"
          aria-keyshortcuts="Shift+Enter"
          disabled={!canExecute || !store || (!running && (store.isRunning() || !hasTargets))}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            if (running) store.stop();
            else void store.runInput(id);
          }}
        >
          {running ? (
            <>
              <span className="runtime-spinner" aria-hidden="true" />
              <span>{ui('실행 중지')}</span>
            </>
          ) : (
            <>
              <Icon name="play" size={13} />
              <span>{ui('입력 전송 · 실행')}</span>
              <span className="agent-run-kbd" aria-hidden="true">⇧↵</span>
            </>
          )}
        </button>
      </footer>
    </section>
  );
}
