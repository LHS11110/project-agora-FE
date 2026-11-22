import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AgentMark } from './CanvasAgentLauncher.jsx';
import {
  AGENT_DEFAULTS,
  loadAgentPreferences,
  modelOptions,
  saveAgentPreferences,
} from './agentPreferences.js';
import { isAgentConnectionError, agentTurnOutcome } from './agentRecovery.js';
import AgentTime from './AgentTime.jsx';
import AgentSessionPicker from './AgentSessionPicker.jsx';
import useAgentSessions from './useAgentSessions.js';
import {
  loadAgentKey,
  normalizeAgentKey,
  saveAgentKey,
} from './agentCredentials.js';
import { intlLocale, ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import './canvas-agent.css';
import MarkdownText from './MarkdownText.jsx';

// Provider headers (x-{second,minute,day}-rate-limit*) describe the moment of the last
// response. A second/minute window has fully refilled once that much time passed;
// the daily reset time is not reported, so its remaining count stays as observed.
const WINDOW_SECONDS = { second: 1, minute: 60 };
function windowRemaining(entry, key, observed, now) {
  if (!entry) return null;
  if (observed && WINDOW_SECONDS[key] && now - observed >= WINDOW_SECONDS[key] && entry.limit != null) return entry.limit;
  return entry.remaining;
}

function LimitCard({ telemetry, now, onRefresh, refreshing, personal }) {
  const locale = useUiLocale();
  const data = telemetry?.limits || {}, observed = telemetry?.limits_observed_at;
  const retry = Math.max(0, Math.ceil((telemetry?.retry_at || 0) - now));
  return (
    <section className="canvas-agent-limits" aria-label={ui('API 호출 한도')}>
      <div className="canvas-agent-section-title">
        <strong>{ui('API 호출 한도')}</strong>
        <button
          type="button"
          className="canvas-agent-quota-refresh"
          aria-label={ui('호출 한도 새로고침')}
          title={ui('모델 호출 없이 서버에 보관된 최근 응답을 확인합니다')}
          disabled={refreshing}
          onClick={onRefresh}
        >
          ↻
        </button>
        <span>{observed ? ui('{time} 응답 기준', { time: new Date(observed * 1000).toLocaleTimeString(intlLocale(locale)) }) : ui('첫 응답 후 표시')}</span>
      </div>
      <div className="canvas-agent-limit-grid">
        {[['second', '초당'], ['minute', '분당'], ['day', '일일']].map(([key, label]) => (
          <div key={key}>
            <span>{ui(label)}</span>
            <strong>{windowRemaining(data[key], key, observed, now) ?? '—'}<small> / {data[key]?.limit ?? '—'}</small></strong>
            <span>{ui('잔여 / 한도')}</span>
          </div>
        ))}
      </div>
      <p>
        {personal ? ui('현재 개인 API 키의 한도입니다.') : ui('서버 기본 API 키를 사용하는 모든 캔버스의 공유 한도입니다.')}
        {retry > 0 && <b role="status">{` ${ui('약 {seconds}초 후 다시 시도할 수 있습니다.', { seconds: retry })}`}</b>}
      </p>
    </section>
  );
}

export default function CanvasAgentPanel({ open, onClose, request, selectedIds, anchor, canvasId, onBusyChange, theme = 'light', isAdmin = false }) {
  const locale = useUiLocale();
  const fieldId = useId();
  const [optimistic, setOptimistic] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [allowDelete, setAllowDelete] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preferences, setPreferences] = useState(loadAgentPreferences);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const [refreshing, setRefreshing] = useState(false);
  const [personalKey, setPersonalKey] = useState(loadAgentKey);
  const [keyDraft, setKeyDraft] = useState(loadAgentKey);
  const [recovery, setRecovery] = useState(null);
  const [startedAt, setStartedAt] = useState(null);

  const requestRef = useRef(request);
  requestRef.current = request;
  const activeTurnRef = useRef(null);
  const bottom = useRef(null), bodyRef = useRef(null), followLatest = useRef(true);
  const conversation = useAgentSessions({ canvasId, open, requestRef });
  const inputDrafts = useRef(new Map());
  const storedMessages = conversation.detail?.messages || [];
  const messages = optimistic && optimistic.session_id === conversation.activeId && !storedMessages.some(message => message.id === optimistic.id)
    ? [...storedMessages, optimistic]
    : storedMessages;
  const session = conversation.detail?.session;
  const canContinue = session?.can_continue === true && session.id === conversation.activeId;
  const working = busy || session?.status === 'running';
  const visibleSessions = [...new Map([...(session && session.status !== 'draft' ? [session] : []), ...conversation.sessions].map(value => [value.id, value])).values()];
  const runningRef = useRef(null);

  useEffect(() => {
    setPrompt(inputDrafts.current.get(conversation.activeId) || '');
    setError('');
  }, [conversation.activeId]);

  function editPrompt(value) {
    inputDrafts.current.set(conversation.activeRef.current, value);
    setPrompt(value);
  }

  function reusePrompt(value) {
    const id = canContinue ? conversation.activeId : conversation.draft?.id;
    if (!id) return;
    inputDrafts.current.set(id, value);
    if (id !== conversation.activeId) conversation.choose(id);
    else setPrompt(value);
  }

  useEffect(() => { onBusyChange?.(working); }, [working, onBusyChange]);
  useEffect(() => { saveAgentPreferences(preferences); }, [preferences]);
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    if (!busy) {
      requestRef.current({ operation: 'status', api_key: personalKey })
        .then(value => { if (live) setStatus(value); })
        .catch(e => { if (live) setError(e.message); });
    }
    const timer = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => { live = false; clearInterval(timer); };
  }, [open, canvasId, personalKey]);

  useEffect(() => { followLatest.current = true; }, [conversation.activeId]);
  useEffect(() => {
    if (followLatest.current) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      bottom.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    }
  }, [conversation.activeId, messages.at(-1)?.id]);

  function update(name, value) {
    setPreferences(previous => ({ ...previous, [name]: value }));
  }

  function applyKey(value) {
    const normalized = normalizeAgentKey(value);
    if (value.trim() && !normalized) {
      setError(ui('API 키 형식을 확인해주세요. 공백·줄바꿈 없이 입력해주세요.'));
      return;
    }
    if (normalized === personalKey) {
      setKeyDraft(normalized);
      refreshStatus();
      return;
    }
    saveAgentKey(normalized);
    setPersonalKey(normalized);
    setKeyDraft(normalized);
    setStatus(null);
    setError('');
  }

  async function refreshStatus() {
    setRefreshing(true);
    try {
      setStatus(await requestRef.current({ operation: 'status', api_key: personalKey }));
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  function applyTelemetry(telemetry) {
    if (telemetry) setStatus(previous => ({ ...previous, telemetry }));
  }

  useEffect(() => {
    if (!recovery) return undefined;
    let cancelled = false, timer, checking = false;
    const finish = async outcome => {
      if (cancelled) return;
      if (outcome.status === 'complete') inputDrafts.current.set(recovery.sessionId, '');
      if (outcome.status !== 'complete') {
        inputDrafts.current.set(recovery.sessionId, recovery.original);
        if (conversation.activeRef.current === recovery.sessionId) setPrompt(recovery.original);
        setError(outcome.message || ui('작업 상태를 확인하지 못했습니다. 프롬프트는 보존했습니다. 이미 반영된 변경을 확인해주세요.'));
      }
      await conversation.reload();
      if (cancelled) return;
      setRecovery(null);
      setBusy(false);
      setProgress('');
      setOptimistic(null);
      runningRef.current = null;
      activeTurnRef.current = null;
      setStartedAt(null);
    };
    const check = async () => {
      if (cancelled || checking) return;
      checking = true;
      clearTimeout(timer);
      try {
        const value = await conversation.metadata({ operation: 'session_get', session_id: recovery.sessionId, limit: 50 });
        if (cancelled) return;
        const outcome = agentTurnOutcome(value, recovery.turnId);
        if (outcome.status !== 'running') { await finish(outcome); return; }
      } catch (failure) {
        if (cancelled) return;
        if (['AGENT_SESSION_ACCESS_DENIED', 'AGENT_SESSION_NOT_FOUND'].includes(failure.code)) {
          await finish({ status: 'unknown', message: failure.message });
          return;
        }
      } finally {
        checking = false;
      }
      if (Date.now() - recovery.since > 330000) { await finish({ status: 'unknown' }); return; }
      if (!cancelled) timer = setTimeout(check, 2000);
    };
    const changed = event => { if (String(event.detail?.canvasId) === String(canvasId)) void check(); };
    window.addEventListener('agora:agent-sessions-changed', changed);
    void check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('agora:agent-sessions-changed', changed);
    };
  }, [recovery, conversation.metadata, conversation.reload, canvasId]);

  const blocked = busy
    || !prompt.trim()
    || !canContinue
    || session?.status === 'running'
    || status?.configured === false
    || (status?.telemetry?.retry_at || 0) > now;

  async function submit(event) {
    event.preventDefault();
    if (blocked) return;
    const original = prompt, text = prompt.trim(), sessionId = conversation.activeId, turnId = crypto.randomUUID();
    let recovering = false;
    inputDrafts.current.set(sessionId, '');
    setPrompt('');
    setOptimistic({ id: turnId, turn_id: turnId, session_id: sessionId, role: 'user', content: text, status: 'running', created_at: Date.now() });
    runningRef.current = sessionId;
    activeTurnRef.current = { turnId };
    followLatest.current = true;
    setBusy(true);
    setStartedAt(Date.now());
    setError('');
    setProgress(ui('연결 중…'));
    try {
      const result = await requestRef.current(
        {
          message: text,
          selected_ids: preferences.attachSelection ? selectedIds.slice(0, 20) : [],
          anchor,
          include_history: preferences.includeHistory,
          allow_delete: allowDelete,
          options: modelOptions(preferences),
          api_key: personalKey,
          session_id: sessionId,
          turn_id: turnId,
        },
        line => setProgress(line.trim()),
      );
      applyTelemetry(result.telemetry);
    } catch (e) {
      applyTelemetry(e.payload?.result?.telemetry);
      inputDrafts.current.set(sessionId, original);
      if (isAgentConnectionError(e)) {
        recovering = true;
        setProgress(ui('연결을 복구하고 기존 작업의 결과를 확인하고 있습니다.'));
        setRecovery({ sessionId, turnId, original, since: Date.now() });
      } else {
        if (conversation.activeRef.current === sessionId) setPrompt(original);
        setError(e.message.includes('이미 반영된') ? e.message : ui('{message} 이미 반영된 변경은 유지됩니다.', { message: e.message }));
      }
    } finally {
      if (!recovering) {
        await conversation.reload();
        setBusy(false);
        setProgress('');
        setOptimistic(null);
        runningRef.current = null;
        activeTurnRef.current = null;
        setStartedAt(null);
      }
    }
  }

  const elapsed = Math.max(0, Math.floor(now - ((startedAt || session?.updated_at || Date.now()) / 1000)));
  if (!open) return null;

  return createPortal(
    <div className="canvas-agent-backdrop">
      <section
        id="canvas-agent-panel"
        data-theme={theme}
        className={`canvas-agent-panel${working ? ' is-working' : ''}`}
        role="dialog"
        aria-modal="false"
        aria-labelledby="canvas-agent-title"
        onKeyDown={e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}
      >
        <header>
          <AgentMark />
          <div className="canvas-agent-title">
            <h2 id="canvas-agent-title">{ui('AI 에이전트')}</h2>
            <span>
              {working
                ? ui('캔버스에서 작업 중 · {seconds}초', { seconds: elapsed })
                : ui('EXAONE · 아이디어를 함께 만드는 공간')}
            </span>
          </div>
          <button
            type="button"
            className="canvas-agent-settings-toggle"
            aria-label={ui('에이전트 설정')}
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(value => !value)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M4 7h16M4 17h16" />
              <circle cx="9" cy="7" r="3" fill="currentColor" />
              <circle cx="15" cy="17" r="3" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="canvas-agent-close"
            aria-label={ui('닫기')}
            title={busy ? ui('작업은 계속 진행됩니다') : ui('닫기')}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <section className="canvas-agent-session-bar" aria-label={ui('공유 대화 세션')}>
          <div>
            <AgentSessionPicker
              sessions={visibleSessions}
              draft={conversation.draft}
              activeId={conversation.activeId}
              onChoose={conversation.choose}
              onDelete={conversation.remove}
              loading={conversation.loading}
              onMore={conversation.more}
              hasMore={conversation.nextOffset !== null}
            />
            <button
              type="button"
              className="agent-session-new"
              disabled={!conversation.draft}
              onClick={() => conversation.choose(conversation.draft.id)}
            >
              <span aria-hidden="true">＋</span> {ui('새 대화')}
            </button>
          </div>
          <small>{canContinue ? ui('내 대화 · 권한이 있는 참가자에게 공유됩니다.') : session ? ui('다른 참가자의 대화 · 읽기 전용') : ui('대화를 불러오고 있습니다.')}</small>
        </section>

        <div
          className="canvas-agent-body"
          ref={bodyRef}
          onScroll={() => {
            const element = bodyRef.current;
            followLatest.current = !element || element.scrollHeight - element.scrollTop - element.clientHeight < 96;
          }}
        >
          {conversation.connection === 'reconnecting' && (
            <p className="canvas-agent-reconnecting" role="status">{ui('연결을 복구하고 있습니다. 대화와 입력 내용은 유지됩니다.')}</p>
          )}

          <LimitCard telemetry={status?.telemetry} now={now} onRefresh={refreshStatus} refreshing={refreshing || busy} personal={Boolean(personalKey)} />

          {settingsOpen && (
            <section className="canvas-agent-settings" aria-label={ui('에이전트 설정')}>
              <div className="canvas-agent-section-title">
                <strong>{ui('작업 설정')}</strong>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPreferences({
                      ...AGENT_DEFAULTS,
                      engine: 'api',
                      includeHistory: true,
                      attachSelection: true,
                    });
                    setAllowDelete(false);
                  }}
                >
                  {ui('기본값 복원')}
                </button>
              </div>
              <fieldset disabled={busy}>
                <legend>{ui('모델 설정')}</legend>

                    <section className="canvas-agent-credentials">
                      <label htmlFor={`${fieldId}-api-key`}>
                        {ui('EXAONE 2.5 API 키')}
                        <input
                          id={`${fieldId}-api-key`}
                          name="agent-api-key"
                          type="password"
                          aria-label={ui('EXAONE API 키')}
                          value={keyDraft}
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          maxLength={4096}
                          placeholder={ui('개인 API 키 입력')}
                          onChange={e => setKeyDraft(e.target.value)}
                        />
                      </label>
                      <div className="canvas-agent-key-actions">
                        <span>{personalKey ? ui('개인 키 사용 중') : ui('서버 기본 키 사용 중')}</span>
                        <button type="button" disabled={busy || !keyDraft.trim()} onClick={() => applyKey(keyDraft)}>{ui('키 적용')}</button>
                        <button type="button" disabled={busy || !personalKey} onClick={() => applyKey('')}>{ui('서버 기본 키 사용')}</button>
                      </div>
                      <small>{ui('개인 키는 현재 탭에만 보관하며 캔버스에 저장하거나 다른 참가자에게 공유하지 않습니다. 키 인증은 실제 요청 시 확인됩니다.')}</small>
                    </section>
                    <div className="canvas-agent-settings-grid">
                      <label htmlFor={`${fieldId}-max-tokens`}>
                        {ui('응답 토큰 상한')}
                        <select
                          id={`${fieldId}-max-tokens`}
                          name="agent-max-tokens"
                          value={preferences.max_tokens}
                          onChange={e => update('max_tokens', Number(e.target.value))}
                          aria-label={ui('응답 토큰 상한')}
                        >
                          {[512, 1024, 2048, 4096, 8192, 16384, 32768].map(value => (
                            <option key={value} value={value}>{value.toLocaleString(intlLocale(locale))}</option>
                          ))}
                        </select>
                      </label>
                      <label htmlFor={`${fieldId}-max-steps`}>
                        {ui('최대 작업 단계')}
                        <input
                          id={`${fieldId}-max-steps`}
                          name="agent-max-steps"
                          type="number"
                          aria-label={ui('최대 작업 단계')}
                          min="1"
                          max="12"
                          step="1"
                          value={preferences.max_steps}
                          onChange={e => { if (e.target.value && e.target.validity.valid) update('max_steps', Number(e.target.value)); }}
                        />
                      </label>
                    </div>
                    <small>{ui('토큰 상한에는 추론도 포함됩니다. 한 요청이 여러 모델 호출을 사용할 수 있습니다.')}</small>
                    <details>
                      <summary>{ui('응답 생성 세부 설정')}</summary>
                      <label htmlFor={`${fieldId}-temperature`}>
                        {ui('다양성 (Temperature)')}
                        <input id={`${fieldId}-temperature`} name="agent-temperature" type="range" aria-label="Temperature" min="0" max="2" step="0.1" value={preferences.temperature} onChange={e => update('temperature', Number(e.target.value))} />
                        <output>{preferences.temperature}</output>
                      </label>
                      <label htmlFor={`${fieldId}-top-p`}>
                        {ui('후보 범위 (Top P)')}
                        <input id={`${fieldId}-top-p`} name="agent-top-p" type="range" aria-label="Top P" min="0.05" max="1" step="0.05" value={preferences.top_p} onChange={e => update('top_p', Number(e.target.value))} />
                        <output>{preferences.top_p}</output>
                      </label>
                      <small>{ui('권장값: Temperature 1 · Top P 0.95')}</small>
                    </details>

                <label className="canvas-agent-check" htmlFor={`${fieldId}-attach-selection`}>
                  <input id={`${fieldId}-attach-selection`} name="agent-attach-selection" type="checkbox" checked={preferences.attachSelection} onChange={e => update('attachSelection', e.target.checked)} />
                  {ui('선택한 객체 첨부')}
                </label>
                <label className="canvas-agent-check" htmlFor={`${fieldId}-include-history`}>
                  <input id={`${fieldId}-include-history`} name="agent-include-history" type="checkbox" checked={preferences.includeHistory} onChange={e => update('includeHistory', e.target.checked)} />
                  {ui('최근 대화 포함')}
                </label>
                <label className="canvas-agent-check" htmlFor={`${fieldId}-allow-delete`}>
                  <input id={`${fieldId}-allow-delete`} name="agent-allow-delete" type="checkbox" checked={allowDelete} onChange={e => setAllowDelete(e.target.checked)} />
                  {ui('이번 대화에서 객체 삭제 허용')}
                </label>
              </fieldset>
            </section>
          )}

          <div className="canvas-agent-conversation" aria-live="polite">
            {!messages.length && (
              <div className="canvas-agent-empty">
                <span className="canvas-agent-empty-badge">YOUR CANVAS COPILOT</span>
                <strong>{ui('어떤 아이디어를 펼쳐볼까요?')}</strong>
                <p>{ui('선택한 객체를 다듬거나, 새로운 코드를 작성해보세요.')}</p>
                <div className="canvas-agent-suggestions">
                  {['파이썬 정렬 함수 객체를 만들어줘', '선택한 코드를 읽고 개선해줘'].map(text => (
                    <button key={text} type="button" onClick={() => editPrompt(ui(text))}>
                      {ui(text)}<span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
                <small>
                  {ui('요청과 도구로 읽은 객체 내용은 모델 제공 서비스에 전달됩니다. 변경은 현재 사용자의 권한으로 저장되고 공유됩니다.')}
                </small>
              </div>
            )}
            {conversation.detail?.has_more && (
              <button type="button" className="canvas-agent-older" disabled={conversation.loading} onClick={conversation.older}>
                {ui('이전 메시지 불러오기')}
              </button>
            )}
            {messages.map((message, index) => (
              <article key={message.id || index} className={`canvas-agent-message ${message.role}${message.kind === 'error' ? ' is-error' : ''}`}>
                <div className="canvas-agent-message-heading">
                  <small>
                    {message.role === 'user' ? (message.nickname || session?.nickname || ui('나')) : ui('에이전트')}
                    {message.status === 'running' ? ui(' · 요청 중') : message.status === 'failed' ? ui(' · 실패') : message.status === 'interrupted' ? ui(' · 연결 종료') : ''}
                  </small>
                  {message.role === 'user' && (
                    <button type="button" aria-label={ui('이 프롬프트 다시 사용')} disabled={busy || !conversation.draft} onClick={() => reusePrompt(message.content)}>
                      {ui('다시 사용')}
                    </button>
                  )}
                </div>
                <div className="canvas-agent-message-content">
                  <MarkdownText source={message.content || ''} />
                </div>
                <div className="canvas-agent-message-meta">
                  <AgentTime value={message.created_at} clock />
                  {message.role === 'user' && message.options?.reasoning_effort && (
                    <span>{ui({ low: '낮은 추론', high: '높은 추론', max: '최대 추론' }[message.options.reasoning_effort])}</span>
                  )}
                </div>
              </article>
            ))}
            {working && (runningRef.current === conversation.activeId || !busy) && (
              <p className="canvas-agent-progress" role="status">
                <span className="canvas-agent-wave" aria-hidden="true"><i /><i /><i /></span>
                <span className="canvas-agent-progress-text" key={progress || 'idle'}>{progress || ui('에이전트가 작업을 처리하고 있습니다.')}</span>
                <span className="canvas-agent-elapsed">{ui('{seconds}초', { seconds: elapsed })}</span>
              </p>
            )}
            {error && !messages.some(message => message.kind === 'error' && error.includes(message.content)) && (
              <p className="canvas-agent-error" role="alert">{error}</p>
            )}
            {conversation.error && <p className="canvas-agent-error" role="alert">{conversation.error}</p>}
            {session?.status === 'interrupted' && (
              <p className="canvas-agent-error">{ui('이전 작업의 연결이 종료되었습니다. 이미 반영된 변경을 확인한 뒤 다시 요청해주세요.')}</p>
            )}
            {status?.configured === false && (
              <p className="canvas-agent-error">{ui('API 키가 설정되지 않았습니다. 에이전트 설정에서 개인 EXAONE API 키를 입력해주세요.')}</p>
            )}
            <div ref={bottom} />
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="canvas-agent-context">
            <span>
              {preferences.attachSelection && selectedIds.length
                ? ui('선택 객체 {count}개 첨부', { count: Math.min(selectedIds.length, 20) })
                : ui('선택한 객체 첨부 없음')}
            </span>
              <label className="canvas-agent-inline-reasoning" htmlFor={`${fieldId}-reasoning-effort`}>
                {ui('추론 수준')}
                <select
                  id={`${fieldId}-reasoning-effort`}
                  name="agent-reasoning-effort"
                  aria-label={ui('추론 수준')}
                  title={ui('추론 수준이 높을수록 응답 시간과 토큰 사용량이 늘어날 수 있습니다.')}
                  value={preferences.reasoning_effort}
                  disabled={busy}
                  onChange={e => update('reasoning_effort', e.target.value)}
                >
                  <option value="low">{ui('낮음 · 빠르게')}</option>
                  <option value="high">{ui('높음 · 깊이 있게')}</option>
                  <option value="max">{ui('최대 · 정확성 우선')}</option>
                </select>
              </label>
          </div>
          <textarea
            id={`${fieldId}-prompt`}
            name="agent-prompt"
            aria-label={ui('에이전트에게 요청')}
            placeholder={ui('아이디어를 적어보세요…')}
            value={prompt}
            maxLength={8000}
            disabled={busy || !canContinue}
            onChange={e => editPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit(e);
              }
            }}
          />
          <footer>
            <span>
              {`${status?.model || 'k-exaone_v2.5'} · Ctrl + Enter`}
            </span>
              <button type="submit" disabled={blocked}>
              {busy ? ui('작업 중…') : ui('보내기')}
              <span aria-hidden="true"> ↗</span>
            </button>
          </footer>
        </form>
      </section>
    </div>,
    document.body,
  );
}
