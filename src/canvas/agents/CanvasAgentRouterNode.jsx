import { useEffect, useId, useMemo, useRef, useState } from 'react';
import CanvasSelect from '../content/CanvasSelect.jsx';
import Icon from '../../components/Icon.jsx';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import {
  INPUT_DATA_FORMATS,
  ROUTER_FALLBACK_POLICIES,
  ROUTING_MODES,
  readAgentRouterConfig,
  writeAgentEdgePatch,
  writeAgentRouterPatch,
} from './agentCanvasModel.js';
import {
  buildStarterJsonRoutingRules,
  collectInputEnvelope,
  extractRouterRoutes,
  formatTypeLabel,
  parseRouterJsonRules,
} from './agentRouter.js';
import { useAgentNodeState } from './useAgentNodeState.js';
import './canvas-multi-agent.css';

export default function CanvasAgentRouterNode({
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
  const config = useMemo(() => readAgentRouterConfig(item), [item]);
  const envelope = useMemo(() => collectInputEnvelope(allItems || {}, id), [allItems, id]);
  const routes = useMemo(() => extractRouterRoutes(allItems || {}, id, config), [allItems, id, config]);

  const [tab, setTab] = useState('routing');
  const [promptDraft, setPromptDraft] = useState(config.routingPrompt);
  const promptFocusedRef = useRef(false);
  const [jsonRulesDraft, setJsonRulesDraft] = useState(config.jsonRules || '');
  const jsonRulesFocusedRef = useRef(false);
  const jsonSpec = useMemo(() => parseRouterJsonRules(jsonRulesDraft), [jsonRulesDraft]);

  useEffect(() => {
    if (!promptFocusedRef.current) setPromptDraft(config.routingPrompt);
  }, [config.routingPrompt]);

  useEffect(() => {
    if (!jsonRulesFocusedRef.current) setJsonRulesDraft(config.jsonRules || '');
  }, [config.jsonRules]);

  const commitPatch = (patch) => {
    if (readOnly || !onChange) return;
    const nextPatch = writeAgentRouterPatch(item, patch);
    if (nextPatch) onChange(id, nextPatch);
  };

  const updateRouteRule = (route, rulePatch) => {
    if (readOnly) return;
    const nextFormats = rulePatch.formats !== undefined ? rulePatch.formats : route.formats;
    const nextDefault = rulePatch.isDefault !== undefined ? rulePatch.isDefault : route.isDefault;
    const nextJsonCond = rulePatch.jsonCondition !== undefined ? rulePatch.jsonCondition : (route.jsonCondition || '');
    if (store?.patchConnector) {
      const edgePatch = writeAgentEdgePatch(route.edge, {
        channel: 'route',
        routeFormats: nextFormats,
        routeDefault: nextDefault,
        ...(rulePatch.jsonCondition !== undefined ? { routeJsonCondition: rulePatch.jsonCondition } : {}),
        ...(rulePatch.description !== undefined ? { routeDescription: rulePatch.description } : {}),
      });
      if (edgePatch) store.patchConnector(route.connectorId, edgePatch);
    }
    const existing = config.routes?.[route.targetId] || {};
    commitPatch({
      routes: {
        ...config.routes,
        [route.targetId]: {
          ...existing,
          formats: nextFormats,
          keywords: route.keywords,
          jsonCondition: nextJsonCond,
          description: rulePatch.description !== undefined ? rulePatch.description : route.description,
          isDefault: nextDefault,
          priority: route.priority,
        },
      },
    });
  };

  const toggleRouteFormat = (route, fmtId) => {
    const has = route.formats.includes(fmtId);
    const nextFormats = has
      ? route.formats.filter(f => f !== fmtId)
      : [...route.formats, fmtId];
    updateRouteRule(route, { formats: nextFormats });
  };

  const running = Boolean(state?.running);
  const statusKey = running ? 'running'
    : state?.error || state?.failed ? 'error'
    : state?.status === 'skipped' ? 'skipped'
    : state?.completed || config.lastDecision ? 'success'
    : 'idle';
  const modeMeta = ROUTING_MODES.find(m => m.id === config.routingMode) || ROUTING_MODES[3];
  const usesJsonRules = config.routingMode === 'json' || config.routingMode === 'hybrid';
  const usesIntelligent = config.routingMode === 'intelligent' || config.routingMode === 'hybrid';
  const primaryJsonKeys = envelope.primaryJson && !Array.isArray(envelope.primaryJson)
    ? Object.keys(envelope.primaryJson).slice(0, 5)
    : [];
  const decision = config.lastDecision;
  const accent = item.color || '#d97706';

  return (
    <section
      className={`agent-card agent-router-card${running ? ' is-running' : ''}${selected ? ' is-selected' : ''}`}
      style={{ '--agent-accent': accent }}
      aria-busy={running}
      aria-label={item.title || ui('라우터 객체')}
    >
      <header className="agent-card-header">
        <span className="agent-card-icon"><Icon name="router" size={15} /></span>
        <div className="agent-card-heading">
          <strong>{item.title || ui('라우터 객체')}</strong>
          <small>{ui(modeMeta.label)} · {ui('{count}개 경로', { count: routes.length })}</small>
        </div>
        {!readOnly && store?.startConnectorFrom && (
          <button
            type="button"
            className="agent-header-connect-btn"
            data-object-action="agent"
            title={ui('연결 객체로 대상 에이전트 연결')}
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
          {running ? ui('판단 중…') : statusKey === 'error' ? ui('오류') : statusKey === 'skipped' ? ui('건너뜀') : statusKey === 'success' ? ui('분기됨') : ui('대기')}
        </span>
      </header>

      <nav
        className="agent-card-tabs"
        role="tablist"
        aria-label={ui('라우터 보기')}
        data-object-action="agent"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" role="tab" aria-selected={tab === 'routing'} onClick={() => setTab('routing')}>{ui('라우팅')}</button>
        <button type="button" role="tab" aria-selected={tab === 'decision'} onClick={() => setTab('decision')}>{ui('결정 로그')}</button>
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
        {tab === 'routing' && (
          <div className="agent-tab-panel">
            <div className="agent-mode-pills" role="group" aria-label={ui('라우팅 방식')}>
              {ROUTING_MODES.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  data-object-action="agent"
                  disabled={readOnly}
                  className={config.routingMode === mode.id ? 'is-active' : ''}
                  onClick={() => commitPatch({ routingMode: mode.id })}
                >
                  {ui(
                    mode.id === 'format'
                      ? '포맷 기반'
                      : mode.id === 'json'
                        ? 'JSON 기반'
                        : mode.id === 'intelligent'
                          ? '지능형'
                          : '하이브리드',
                  )}
                </button>
              ))}
            </div>

            {envelope.items.length > 0 && (
              <div className="agent-io-block">
                <span className="agent-io-heading">{ui('감지된 입력 포맷')}</span>
                <div className="agent-chip-list">
                  {envelope.formats.map(fmt => (
                    <span key={fmt} className="agent-format-badge">{ui(formatTypeLabel(fmt))}</span>
                  ))}
                  {primaryJsonKeys.map(k => (
                    <span key={`json-${k}`} className="agent-json-key-chip">{`$.${k}`}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="agent-io-block">
              <span className="agent-io-heading">{ui('연결된 분기 경로 ({count})', { count: routes.length })}</span>
              {routes.length ? (
                <div className="agent-route-list">
                  {routes.map(route => {
                    const wasSelected = decision?.selectedTargetIds?.includes(route.targetId);
                    return (
                      <div key={route.connectorId} className={`agent-route-row${wasSelected ? ' is-chosen' : ''}`}>
                        <div className="agent-route-row-head">
                          <button
                            type="button"
                            className="agent-route-target-btn"
                            data-object-action="agent"
                            onClick={() => store?.focusCanvasObject?.(route.targetId)}
                          >
                            {route.targetName}
                          </button>
                          <button
                            type="button"
                            className={`agent-default-toggle${route.isDefault ? ' is-on' : ''}`}
                            data-object-action="agent"
                            disabled={readOnly}
                            title={ui('기본 폴백 경로 지정')}
                            onClick={() => updateRouteRule(route, { isDefault: !route.isDefault })}
                          >
                            {ui('기본')}
                          </button>
                        </div>
                        <div className="agent-format-pills">
                          {INPUT_DATA_FORMATS.map(fmt => {
                            const active = route.formats.includes(fmt.id);
                            return (
                              <button
                                key={fmt.id}
                                type="button"
                                data-object-action="agent"
                                disabled={readOnly}
                                className={active ? 'is-active' : ''}
                                onClick={() => toggleRouteFormat(route, fmt.id)}
                              >
                                {ui(fmt.label)}
                              </button>
                            );
                          })}
                        </div>
                        {usesJsonRules && (
                          <input
                            id={`${fieldId}-route-json-${route.connectorId}`}
                            className="agent-route-json-input"
                            type="text"
                            maxLength={600}
                            readOnly={readOnly}
                            data-object-action="agent"
                            aria-label={`${route.targetName} ${ui('JSON 조건식')}`}
                            placeholder={ui('JSON 조건 예: type == "billing" && priority >= 2')}
                            value={route.jsonCondition || ''}
                            onChange={e => updateRouteRule(route, { jsonCondition: e.target.value })}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="agent-connect-cta">
                  <p className="agent-empty-hint">{ui('라우터에서 대상 에이전트·출력 객체로 화살표를 연결하세요.')}</p>
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

            {usesJsonRules && (
              <div className="agent-io-block">
                <div className="agent-json-head">
                  <label className="agent-io-heading" htmlFor={`${fieldId}-json-rules`}>
                    {ui('JSON 라우팅 규칙')}
                  </label>
                  <div className="agent-inline-btn-group">
                    <span className={`agent-json-status ${jsonSpec.valid ? 'is-valid' : 'is-invalid'}`}>
                      {jsonSpec.valid
                        ? (jsonSpec.rules.length
                          ? ui('JSON 규칙 {count}개 유효', { count: jsonSpec.rules.length })
                          : ui('비어 있음'))
                        : ui('JSON 문법 오류')}
                    </span>
                    {!readOnly && (
                      <button
                        type="button"
                        className="agent-micro-btn"
                        data-object-action="agent"
                        onClick={() => {
                          const sample = buildStarterJsonRoutingRules(routes);
                          setJsonRulesDraft(sample);
                          commitPatch({ jsonRules: sample });
                        }}
                      >
                        {ui('예시 삽입')}
                      </button>
                    )}
                  </div>
                </div>
                <textarea
                  id={`${fieldId}-json-rules`}
                  className="agent-json-textarea"
                  data-object-action="agent"
                  rows={4}
                  maxLength={6000}
                  readOnly={readOnly}
                  value={jsonRulesDraft}
                  placeholder={ui('{"match":"first","rules":[{"path":"type","op":"equals","value":"billing","targets":["에이전트"]}]}')}
                  onFocus={() => { jsonRulesFocusedRef.current = true; }}
                  onBlur={() => {
                    jsonRulesFocusedRef.current = false;
                    if (jsonRulesDraft !== (config.jsonRules || '')) commitPatch({ jsonRules: jsonRulesDraft });
                  }}
                  onChange={e => {
                    const value = e.target.value;
                    setJsonRulesDraft(value);
                    commitPatch({ jsonRules: value });
                  }}
                />
                {!jsonSpec.valid && jsonSpec.error && (
                  <small className="agent-error-line">{ui(jsonSpec.error)}</small>
                )}
              </div>
            )}

            {usesIntelligent && (
              <label className="agent-field-label" htmlFor={`${fieldId}-prompt`}>
                <span>{ui('지능형 라우팅 기준 프롬프트')}</span>
                <textarea
                  id={`${fieldId}-prompt`}
                  name="agent-router-prompt"
                  data-object-action="agent"
                  rows={2}
                  maxLength={4000}
                  readOnly={readOnly}
                  value={promptDraft}
                  placeholder={ui('입력 내용을 보고 어떤 에이전트로 보낼지 판단 기준을 입력하세요…')}
                  onFocus={() => { promptFocusedRef.current = true; }}
                  onBlur={() => {
                    promptFocusedRef.current = false;
                    if (promptDraft !== config.routingPrompt) commitPatch({ routingPrompt: promptDraft });
                  }}
                  onChange={e => {
                    const value = e.target.value;
                    setPromptDraft(value);
                    commitPatch({ routingPrompt: value });
                  }}
                />
              </label>
            )}

            {decision && (
              <div className="agent-decision-banner">
                <strong>{ui('최근 결정')}: {decision.selectedTargetNames?.join(', ') || ui('없음')}</strong>
                <small>{decision.reason}</small>
              </div>
            )}
            {state?.error && <p className="agent-error-line" role="alert">{state.error}</p>}
          </div>
        )}

        {tab === 'decision' && (
          <div className="agent-tab-panel">
            {decision ? (
              <div className="agent-decision-detail">
                <div className="agent-decision-row">
                  <span>{ui('적용 방식')}</span>
                  <strong>
                    {decision.modeUsed === 'json'
                      ? ui('JSON 규칙 기반')
                      : decision.modeUsed === 'intelligent'
                        ? ui('에이전트 지능형')
                        : ui('데이터 포맷 기반')}
                    {decision.fallbackUsed ? ` (${ui('폴백')})` : ''}
                  </strong>
                </div>
                <div className="agent-decision-row">
                  <span>{ui('감지된 포맷')}</span>
                  <strong>{(decision.detectedFormats || []).map(f => ui(formatTypeLabel(f))).join(', ') || '—'}</strong>
                </div>
                <div className="agent-decision-row">
                  <span>{ui('선택 대상')}</span>
                  <strong>{(decision.selectedTargetNames || []).join(', ') || ui('없음')}</strong>
                </div>
                <p className="agent-decision-reason">{decision.reason}</p>
              </div>
            ) : (
              <p className="agent-empty-hint">{ui('라우터를 실행하면 입력 포맷 분석과 분기 판단 근거가 여기에 표시됩니다.')}</p>
            )}
          </div>
        )}

        {tab === 'settings' && (
          <div className="agent-tab-panel agent-settings-mini">
            <label htmlFor={`${fieldId}-title`}>
              <span>{ui('라우터 이름')}</span>
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
            <label htmlFor={`${fieldId}-fallback`}>
              <span>{ui('미일치 시 폴백 정책')}</span>
              <CanvasSelect
                id={`${fieldId}-fallback`}
                data-object-action="agent"
                disabled={readOnly}
                value={config.fallbackPolicy}
                onChange={e => commitPatch({ fallbackPolicy: e.target.value })}
              >
                {ROUTER_FALLBACK_POLICIES.map(pol => (
                  <option key={pol.id} value={pol.id}>{ui(pol.label)}</option>
                ))}
              </CanvasSelect>
            </label>
            <label className="agent-mini-check" htmlFor={`${fieldId}-multi-match`}>
              <input
                id={`${fieldId}-multi-match`}
                data-object-action="agent"
                type="checkbox"
                disabled={readOnly}
                checked={config.multiMatch}
                onChange={e => commitPatch({ multiMatch: e.target.checked })}
              />
              <span>{ui('다중 포맷 일치 시 여러 경로 동시 분기')}</span>
            </label>
            {usesIntelligent && (
              <>
                <label className="agent-mini-check" htmlFor={`${fieldId}-multi-route`}>
                  <input
                    id={`${fieldId}-multi-route`}
                    data-object-action="agent"
                    type="checkbox"
                    disabled={readOnly}
                    checked={config.allowMultiRoute}
                    onChange={e => commitPatch({ allowMultiRoute: e.target.checked })}
                  />
                  <span>{ui('지능형 모드 복수 에이전트 선택 허용')}</span>
                </label>
              </>
            )}
          </div>
        )}
      </div>

      <footer className="agent-card-footer">
        {store?.hasAgentAccess() && <button
          type="button"
          className={`agent-run-btn${running ? ' is-stop' : ''}`}
          data-object-action="agent"
          data-agent-run="true"
          aria-keyshortcuts="Shift+Enter"
          disabled={!canExecute || !store || (!running && (store.isRunning() || !routes.length))}
          onPointerDown={e => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            if (running) store.stop();
            else void store.runRouter(id);
          }}
        >
          {running ? (
            <>
              <span className="runtime-spinner" aria-hidden="true" />
              <span>{ui('라우팅 중지')}</span>
            </>
          ) : (
            <>
              <Icon name="play" size={13} />
              <span>{ui('라우팅 실행')}</span>
              <span className="agent-run-kbd" aria-hidden="true">⇧↵</span>
            </>
          )}
        </button>}
      </footer>
    </section>
  );
}
