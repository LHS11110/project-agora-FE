import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AgentMark } from './CanvasAgentLauncher.jsx';
import {
  AGENT_DEFAULTS,
  AGENT_PROVIDERS,
  agentProvider,
  loadAgentPreferences,
  modelOptions,
  normalizeAgentModel,
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
import { hasAgentConsent, revokeAgentConsent, saveAgentConsent } from './agentConsent.js';
import { intlLocale, ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import './canvas-agent.css';
import MarkdownText from './MarkdownText.jsx';

// Shown before a provider is used: what is sent where, the provider's data terms,
// and the confirmations its terms require (age, terms, overseas transfer).
function ConsentCard({ provider, onAccept, disabled }) {
  const [checks, setChecks] = useState({ terms: false, transfer: false, extra: false });
  const ready = checks.terms && checks.transfer && (!provider.extraConsent || checks.extra);
  const toggle = name => event => setChecks(previous => ({ ...previous, [name]: event.target.checked }));
  return (
    <section className="canvas-agent-consent" aria-label={ui('{provider} 사용 전 확인', { provider: provider.label })}>
      <strong>{ui('{provider} 사용 전 확인', { provider: provider.label })}</strong>
      <p>{ui('AI 에이전트는 요청, 선택한 객체, 에이전트가 읽은 캔버스 내용(다른 참가자가 작성한 내용 포함)을 {provider}로 보냅니다. {provider}는 미국 등 해외에서 이를 처리합니다.', { provider: provider.label })}</p>
      <p>{ui(provider.dataNotice)}</p>
      <p>
        <a href={provider.termsUrl} target="_blank" rel="noreferrer">{ui('{provider} 이용약관', { provider: provider.label })}</a>
        {' · '}
        <a href={provider.policyUrl} target="_blank" rel="noreferrer">{ui('{provider} 이용 정책·개인정보', { provider: provider.label })}</a>
      </p>
      <label className="canvas-agent-check">
        <input type="checkbox" name="agent-consent-terms" checked={checks.terms} onChange={toggle('terms')} />
        {ui('만 18세 이상이며, {provider}의 이용약관과 이용 정책을 지키겠습니다. 개인 API 키를 쓰면 키 소유자로서 그 사용에 책임을 집니다.', { provider: provider.label })}
      </label>
      <label className="canvas-agent-check">
        <input type="checkbox" name="agent-consent-transfer" checked={checks.transfer} onChange={toggle('transfer')} />
        {ui('위 내용이 {provider}(해외)로 전송되는 것에 동의합니다.', { provider: provider.label })}
      </label>
      {provider.extraConsent && (
        <label className="canvas-agent-check">
          <input type="checkbox" name="agent-consent-extra" checked={checks.extra} onChange={toggle('extra')} />
          {ui(provider.extraConsent)}
        </label>
      )}
      <button type="button" disabled={disabled || !ready} onClick={onAccept}>{ui('동의하고 사용')}</button>
      <small>{ui('동의하지 않으면 이 제공 서비스로 AI 에이전트를 사용할 수 없습니다. 동의는 에이전트 설정에서 철회할 수 있습니다.')}</small>
    </section>
  );
}

export default function CanvasAgentPanel({ open, onClose, request, selectedIds, anchor, canvasId, onBusyChange, theme = 'light', isAdmin = false, userId = null }) {
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
  const [, setRefreshing] = useState(false);
  // Personal keys are kept per provider; switching providers swaps in that provider's key.
  const [personalKey, setPersonalKey] = useState(() => loadAgentKey(preferences.provider));
  const [keyDraft, setKeyDraft] = useState(() => loadAgentKey(preferences.provider));
  const [modelDraft, setModelDraft] = useState(preferences.model);
  const provider = agentProvider(preferences.provider);
  const [consentRevision, setConsentRevision] = useState(0);
  const consented = consentRevision >= 0 && hasAgentConsent(userId, provider.id);
  const statusOptions = modelOptions(preferences);
  const statusKey = JSON.stringify(statusOptions);
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
      requestRef.current({ operation: 'status', api_key: personalKey, options: statusOptions })
        .then(value => { if (live) setStatus(value); })
        .catch(e => { if (live) setError(e.message); });
    }
    const timer = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => { live = false; clearInterval(timer); };
  }, [open, canvasId, personalKey, statusKey]);

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

  function chooseProvider(id) {
    const next = agentProvider(id).id;
    const key = loadAgentKey(next);
    setPreferences(previous => ({ ...previous, provider: next, model: '' }));
    setModelDraft('');
    setPersonalKey(key);
    setKeyDraft(key);
    setStatus(null);
    setError('');
  }

  function applyModel(value) {
    const model = normalizeAgentModel(value);
    if (value.trim() && !model) {
      setError(ui('모델 이름은 영문·숫자와 . _ : / @ - 만 사용할 수 있습니다.'));
      return;
    }
    setModelDraft(model);
    update('model', model);
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
    saveAgentKey(normalized, preferences.provider);
    setPersonalKey(normalized);
    setKeyDraft(normalized);
    setStatus(null);
    setError('');
  }

  async function refreshStatus() {
    setRefreshing(true);
    try {
      setStatus(await requestRef.current({ operation: 'status', api_key: personalKey, options: statusOptions }));
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
    || !consented
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
                : ui('{provider} · 아이디어를 함께 만드는 공간', { provider: provider.label })}
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

          {!consented && (
            <ConsentCard
              key={provider.id}
              provider={provider}
              disabled={busy}
              onAccept={() => { saveAgentConsent(userId, provider.id); setConsentRevision(value => value + 1); }}
            />
          )}

          {settingsOpen && (
            <section className="canvas-agent-settings" aria-label={ui('에이전트 설정')}>
              <div className="canvas-agent-section-title">
                <strong>{ui('작업 설정')}</strong>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    // Tuning resets; the chosen provider and model stay.
                    setPreferences(previous => ({
                      ...AGENT_DEFAULTS,
                      engine: 'api',
                      provider: previous.provider,
                      model: previous.model,
                      includeHistory: true,
                      attachSelection: true,
                    }));
                    setAllowDelete(false);
                  }}
                >
                  {ui('기본값 복원')}
                </button>
              </div>
              <fieldset disabled={busy}>
                <legend>{ui('모델 설정')}</legend>

                    <div className="canvas-agent-settings-grid">
                      <label htmlFor={`${fieldId}-provider`}>
                        {ui('모델 제공 서비스')}
                        <select
                          id={`${fieldId}-provider`}
                          name="agent-provider"
                          value={provider.id}
                          onChange={e => chooseProvider(e.target.value)}
                        >
                          {AGENT_PROVIDERS.map(entry => <option key={entry.id} value={entry.id}>{entry.label}</option>)}
                        </select>
                      </label>
                      <label htmlFor={`${fieldId}-model`}>
                        {ui('모델')}
                        <input
                          id={`${fieldId}-model`}
                          name="agent-model"
                          type="text"
                          list={`${fieldId}-model-options`}
                          maxLength={128}
                          autoComplete="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          value={modelDraft}
                          placeholder={provider.defaultModel || status?.model || ui('서버 기본 모델')}
                          onChange={e => setModelDraft(e.target.value)}
                          onBlur={e => applyModel(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyModel(e.currentTarget.value); } }}
                        />
                        <datalist id={`${fieldId}-model-options`}>
                          {provider.models.map(model => <option key={model} value={model} />)}
                        </datalist>
                      </label>
                    </div>
                    <small>{ui('모델을 비워 두면 제공 서비스의 기본 모델을 사용합니다.')}</small>
                    {consented && (
                      <div className="canvas-agent-key-actions">
                        <span>{ui('{provider} 이용 조건과 데이터 전송에 동의함', { provider: provider.label })}</span>
                        <button type="button" disabled={busy} onClick={() => { revokeAgentConsent(userId, provider.id); setConsentRevision(value => value + 1); }}>{ui('동의 철회')}</button>
                      </div>
                    )}
                    <section className="canvas-agent-credentials">
                      <label htmlFor={`${fieldId}-api-key`}>
                        {ui('{provider} API 키', { provider: provider.label })}
                        <input
                          id={`${fieldId}-api-key`}
                          name="agent-api-key"
                          type="password"
                          aria-label={ui('{provider} API 키', { provider: provider.label })}
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
                        <span>{personalKey ? ui('개인 키 사용 중') : status?.default_configured === false ? ui('API 키 필요') : ui('서버 기본 키 사용 중')}</span>
                        <button type="button" disabled={busy || !consented || !keyDraft.trim()} onClick={() => applyKey(keyDraft)}>{ui('키 적용')}</button>
                        <button type="button" disabled={busy || !personalKey} onClick={() => applyKey('')}>{status?.default_configured === false ? ui('키 지우기') : ui('서버 기본 키 사용')}</button>
                      </div>
                      <small>{ui('개인 키는 현재 탭에만 보관하며 캔버스에 저장하거나 다른 참가자에게 공유하지 않습니다. 키 인증은 실제 요청 시 확인됩니다.')}</small>
                      <small>{ui('키는 제공 서비스별로 따로 보관하며, 선택한 제공 서비스의 공식 API로만 전송됩니다.')}</small>
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
            {consented && status?.configured === false && (
              <p className="canvas-agent-error">{ui('API 키가 설정되지 않았습니다. 에이전트 설정에서 {provider} API 키를 입력해주세요.', { provider: provider.label })}</p>
            )}
            <div ref={bottom} />
          </div>
        </div>

        <form onSubmit={submit}>
          {/* Provider terms: tell users they are talking to AI and to verify outputs. */}
          <p className="canvas-agent-ai-notice">{ui('AI가 생성한 응답입니다. 사실 관계는 직접 확인한 뒤 사용하세요.')}</p>
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
              {`${provider.label} · ${status?.model || preferences.model || provider.defaultModel} · Ctrl + Enter`}
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
