import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AgentMark } from './CanvasAgentLauncher.jsx';
import { LOCAL_AGENT_PROVIDER as provider } from './agentPreferences.js';
import { isAgentConnectionError, agentTurnOutcome } from './agentRecovery.js';
import AgentTime from './AgentTime.jsx';
import AgentSessionPicker from './AgentSessionPicker.jsx';
import useAgentSessions from './useAgentSessions.js';
import { AGENT_CONSENT_VERSION, loadAgentTerms, saveAgentDecision } from './agentConsent.js';
import { ui } from '../i18n/locale.js';
import { useUiLocale } from '../i18n/useUiLocale.js';
import './canvas-agent.css';

import MarkdownText from './MarkdownText.jsx';

const modelOptions = { provider: 'local', max_tokens: 768, max_steps: 1 };

function ConsentCard({ terms, onAccept, disabled }) {
  const [accepted, setAccepted] = useState(false);
  return <section className="canvas-agent-consent" aria-label={ui('AI 에이전트 이용약관')}>
    <strong>{ui('AI 에이전트 이용약관')}</strong>
    <p>{ui('요청은 Agora 서버의 로컬 모델에서 처리됩니다. 대화와 작업 결과에는 캔버스 권한이 적용됩니다.')}</p>
    <details>
      <summary>{ui('Agora AI 에이전트 이용약관')} ({terms.version})</summary>
      {terms.body.split('\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </details>
    <label className="canvas-agent-check">
      <input type="checkbox" name="agent-consent-terms" checked={accepted} onChange={event => setAccepted(event.target.checked)} />
      {ui('Agora AI 에이전트 이용약관에 동의합니다.')}
    </label>
    <button type="button" disabled={disabled || !accepted} onClick={onAccept}>{ui('동의하고 사용')}</button>
  </section>;
}

export default function CanvasAgentPanel({ open, onClose, request, anchor, canvasId, onBusyChange, theme = 'light', token }) {
  useUiLocale();
  const fieldId = useId();
  const [optimistic, setOptimistic] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now() / 1000);
  const [, setRefreshing] = useState(false);
  const [terms, setTerms] = useState(null);
  const [termsPending, setTermsPending] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [termsReload, setTermsReload] = useState(0);
  const consented = terms?.version === AGENT_CONSENT_VERSION && terms.accepted === true;

  useEffect(() => {
    if (!open) return;
    let active = true;
    setTerms(null);
    setTermsError(false);
    loadAgentTerms(token).then(value => {
      if (!active) return;
      if (value?.version !== AGENT_CONSENT_VERSION || typeof value.body !== 'string') {
        setTermsError(true);
      } else {
        setTerms(value);
      }
    }).catch(() => { if (active) setTermsError(true); });
    return () => { active = false; };
  }, [open, token, termsReload]);

  async function updateConsent(accepted) {
    if (termsPending) return;
    setTermsPending(true);
    setTermsError(false);
    try {
      setTerms(await saveAgentDecision(token, accepted));
    } catch {
      setTermsError(true);
    } finally {
      setTermsPending(false);
    }
  }
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
  useEffect(() => {
    if (!open) return undefined;
    let live = true;
    if (!busy) {
      setStatus(null);
      requestRef.current({ operation: 'status', options: modelOptions })
        .then(value => { if (live) setStatus(value); })
        .catch(e => { if (live) setError(e.message); });
    }
    const timer = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => { live = false; clearInterval(timer); };
  }, [open, canvasId]);

  useEffect(() => { followLatest.current = true; }, [conversation.activeId]);
  useEffect(() => {
    if (followLatest.current) {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      bottom.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    }
  }, [conversation.activeId, messages.at(-1)?.id]);

  async function refreshStatus() {
    setRefreshing(true);
    try {
      setStatus(await requestRef.current({ operation: 'status', options: modelOptions }));
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
    || termsPending
    || !consented
    || status?.configured !== true
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
          operation: 'run',
          message: text,
          anchor,
          options: modelOptions,
          session_id: sessionId,
          turn_id: turnId,
        },
        line => setProgress(line.trim()),
      );
      applyTelemetry(result.telemetry);
    } catch (e) {
      if (e.code === 'AGENT_CONSENT_REQUIRED') setTermsReload(value => value + 1);
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

          {termsError && <div role="alert">
            <p>{ui('에이전트 약관 상태를 확인하지 못했습니다.')}</p>
            <button type="button" onClick={() => setTermsReload(value => value + 1)}>{ui('다시 시도')}</button>
          </div>}
          {terms && !consented && (
            <ConsentCard terms={terms} disabled={busy || termsPending} onAccept={() => updateConsent(true)} />
          )}

          {settingsOpen && (
            <section className="canvas-agent-settings" aria-label={ui('에이전트 설정')}>
              <strong>{ui('로컬 Qwen')}</strong>
              <p>{ui('Qwen2.5 1.5B · 답변과 메모 생성 · 출력 최대 768토큰')}</p>
              {consented && <div className="canvas-agent-key-actions">
                <span>{ui('Agora AI 에이전트 이용약관에 동의함')}</span>
                <button type="button" disabled={busy || termsPending} onClick={() => updateConsent(false)}>{ui('동의 철회')}</button>
              </div>}
            </section>
          )}

          <div className="canvas-agent-conversation" aria-live="polite">
            {!messages.length && (
              <div className="canvas-agent-empty">
                <span className="canvas-agent-empty-badge">YOUR CANVAS COPILOT</span>
                <strong>{ui('어떤 아이디어를 펼쳐볼까요?')}</strong>
                <p>{ui('질문하거나 캔버스에 메모를 추가해보세요.')}</p>
                <div className="canvas-agent-suggestions">
                  {['캔버스에 회의 준비 메모를 추가해줘'].map(text => (
                    <button key={text} type="button" onClick={() => editPrompt(ui(text))}>
                      {ui(text)}<span aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
                <small>
                  {ui('요청은 Agora 서버에서 처리되고, 결과에는 캔버스 권한이 적용됩니다.')}
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
                    {message.role === 'user' ? (message.nickname || session?.nickname || ui('나')) : ui('AI 에이전트 생성 응답')}
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
              <p className="canvas-agent-error">{ui('서버에 {provider}가 설정되면 에이전트를 사용할 수 있습니다.', { provider: provider.label })}</p>
            )}
            <div ref={bottom} />
          </div>
        </div>

        <form onSubmit={submit}>
          {/* Provider terms: tell users they are talking to AI and to verify outputs. */}
          <p className="canvas-agent-ai-notice">{ui('AI가 생성한 응답입니다. 사실 관계는 직접 확인한 뒤 사용하세요.')}</p>
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
              {`${provider.label} · ${status?.model || provider.defaultModel} · Ctrl + Enter`}
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
