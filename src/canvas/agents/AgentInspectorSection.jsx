import { useId, useMemo } from 'react';
import { CLI_TOOLS } from '../../components/agentPreferences.js';
import { intlLocale, ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import {
  AGENT_ACCENT_COLORS,
  AGENT_ROLE_PRESETS,
  EDGE_CHANNELS,
  EDGE_DELIVERY_MODES,
  INPUT_DATA_FORMATS,
  INPUT_TYPE_OPTIONS,
  MULTI_AGENT_TEMPLATES,
  ORCHESTRATION_MODES,
  OUTPUT_DISPLAY_MODES,
  ROUTER_FALLBACK_POLICIES,
  ROUTING_MODES,
  isAgentCanvasObject,
  isAgentRouterItem,
  readAgentEdgeConfig,
  readAgentEdgeRouteConfig,
  readAgentInputConfig,
  readAgentNodeConfig,
  readAgentOutputConfig,
  readAgentRouterConfig,
  readOrchestratorConfig,
  writeAgentEdgePatch,
  writeAgentInputPatch,
  writeAgentNodePatch,
  writeAgentOutputPatch,
  writeAgentRouterPatch,
  writeOrchestratorPatch,
} from './agentCanvasModel.js';
import { buildStarterJsonRoutingRules, extractRouterRoutes, formatTypeLabel, parseRouterJsonRules } from './agentRouter.js';
import { inspectAgentConnections, resolveMultiAgentGraph } from './multiAgentGraph.js';
import MockAgentResponseFields from './MockAgentResponseFields.jsx';

const TOOL_HINTS = {
  'agent-mock': {
    title: '모형 에이전트',
    hint: '모형 에이전트를 배치하고 응답을 설정하세요. 여러 객체를 연결해 실행 순서와 결과 전달을 확인할 수 있습니다.',
  },
  'agent-node': {
    title: 'AI 에이전트 객체',
    hint: '캔버스를 클릭하거나 드래그해 AI 에이전트를 배치하세요. 입력·라우터·출력·다른 에이전트와 연결 객체로 연결해 데이터를 전달하고 협업할 수 있습니다.',
  },
  'agent-orchestrator': {
    title: '에이전트 오케스트레이터',
    hint: '캔버스를 클릭하거나 드래그해 오케스트레이터를 배치하세요. 입력·라우터·에이전트·출력 객체를 연결 객체로 연결해 파이프라인·협업 라운드·감독자 팀을 조율합니다.',
  },
  'agent-input': {
    title: '에이전트 입력 객체',
    hint: '사용자의 텍스트, JSON, 이미지, 오디오, 동영상, PDF, 코드 등의 입력을 받아 연결된 오케스트레이터·라우터·에이전트에 전달합니다.',
  },
  'agent-router': {
    title: '에이전트 라우터 객체',
    hint: '입력 데이터의 포맷(텍스트·이미지·오디오·동영상·PDF·JSON), JSON 필드 조건 규칙, 또는 AI 에이전트의 지능형 판단에 따라 연결된 대상 중 알맞은 에이전트로 분기합니다.',
  },
  'agent-output': {
    title: '에이전트 출력 객체',
    hint: '에이전트·라우터·오케스트레이터에서 연결 객체로 연결하면 최종 응답과 실행 이력이 이곳에 표시됩니다.',
  },
};

export function AgentToolHint({ tool }) {
  useUiLocale();
  const meta = TOOL_HINTS[tool] || TOOL_HINTS['agent-node'];
  return (
    <section className="inspector-section">
      <strong className="inspector-label">{ui(meta.title)}</strong>
      <p className="inspector-hint">{ui(meta.hint)}</p>
    </section>
  );
}

export function AgentEdgeControls({ connector, items, onPatchConnector }) {
  useUiLocale();
  const fieldId = useId();
  const source = items?.[connector?.from];
  const target = items?.[connector?.to];
  if (!isAgentCanvasObject(source) && !isAgentCanvasObject(target)) return null;

  const edgeConfig = readAgentEdgeConfig(connector);
  const routeConfig = readAgentEdgeRouteConfig(connector);
  const fromRouter = isAgentRouterItem(source);
  const updateEdge = (patch) => {
    const next = writeAgentEdgePatch(connector, patch);
    if (next) onPatchConnector?.(next);
  };
  const toggleFormat = (fmtId) => {
    const has = routeConfig.routeFormats.includes(fmtId);
    const nextFormats = has
      ? routeConfig.routeFormats.filter(f => f !== fmtId)
      : [...routeConfig.routeFormats, fmtId];
    updateEdge({ routeFormats: nextFormats });
  };

  return (
    <section className="inspector-section agent-inspector-section">
      <strong className="inspector-label">{ui('멀티 에이전트 그래프 연결')}</strong>
      <label className="agent-inspector-field" htmlFor={`${fieldId}-channel`}>
        <span>{ui('전달 역할')}</span>
        <select
          id={`${fieldId}-channel`}
          value={edgeConfig.channel}
          onChange={e => updateEdge({ channel: e.target.value })}
        >
          {EDGE_CHANNELS.map(ch => (
            <option key={ch.id} value={ch.id}>{ui(ch.label)}</option>
          ))}
        </select>
      </label>
      <label className="agent-inspector-field" htmlFor={`${fieldId}-delivery`}>
        <span>{ui('데이터 전달 방식')}</span>
        <select
          id={`${fieldId}-delivery`}
          value={edgeConfig.delivery}
          onChange={e => updateEdge({ delivery: e.target.value })}
        >
          {EDGE_DELIVERY_MODES.map(mode => (
            <option key={mode.id} value={mode.id}>{ui(mode.label)}</option>
          ))}
        </select>
      </label>
      <label className="agent-inspector-check" htmlFor={`${fieldId}-enabled`}>
        <input
          id={`${fieldId}-enabled`}
          type="checkbox"
          checked={edgeConfig.enabled}
          onChange={e => updateEdge({ enabled: e.target.checked })}
        />
        <span>{ui('이 연결 경로 활성화')}</span>
      </label>

      {fromRouter && (
        <div className="agent-inspector-edges">
          <strong className="inspector-label">{ui('라우터 분기 조건')}</strong>
          <div className="agent-format-pills">
            {INPUT_DATA_FORMATS.map(fmt => (
              <button
                key={fmt.id}
                type="button"
                className={routeConfig.routeFormats.includes(fmt.id) ? 'is-active' : ''}
                onClick={() => toggleFormat(fmt.id)}
              >
                {ui(fmt.label)}
              </button>
            ))}
          </div>
          <label className="agent-inspector-field" htmlFor={`${fieldId}-keywords`}>
            <span>{ui('일치 키워드 (쉼표 구분)')}</span>
            <input
              id={`${fieldId}-keywords`}
              type="text"
              maxLength={240}
              placeholder={ui('예: 번역, 요약, 차트')}
              value={routeConfig.routeKeywords}
              onChange={e => updateEdge({ routeKeywords: e.target.value })}
            />
          </label>
          <label className="agent-inspector-field" htmlFor={`${fieldId}-json-cond`}>
            <span>{ui('JSON 조건식')}</span>
            <input
              id={`${fieldId}-json-cond`}
              type="text"
              maxLength={600}
              placeholder={ui('예: type == "billing" && priority >= 2')}
              value={routeConfig.routeJsonCondition}
              onChange={e => updateEdge({ routeJsonCondition: e.target.value })}
            />
          </label>
          <label className="agent-inspector-field" htmlFor={`${fieldId}-route-desc`}>
            <span>{ui('지능형 라우팅용 경로 설명')}</span>
            <textarea
              id={`${fieldId}-route-desc`}
              rows={2}
              maxLength={400}
              placeholder={ui('지능형 라우터가 이 경로를 선택할 조건 설명…')}
              value={routeConfig.routeDescription}
              onChange={e => updateEdge({ routeDescription: e.target.value })}
            />
          </label>
          <div className="agent-inspector-grid">
            <label className="agent-inspector-field" htmlFor={`${fieldId}-priority`}>
              <span>{ui('우선순위')}</span>
              <input
                id={`${fieldId}-priority`}
                type="number"
                min="0"
                max="100"
                value={routeConfig.routePriority}
                onChange={e => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 0 && n <= 100) updateEdge({ routePriority: n });
                }}
              />
            </label>
            <label className="agent-inspector-check" htmlFor={`${fieldId}-default`}>
              <input
                id={`${fieldId}-default`}
                type="checkbox"
                checked={routeConfig.routeDefault}
                onChange={e => updateEdge({ routeDefault: e.target.checked })}
              />
              <span>{ui('기본 폴백 경로')}</span>
            </label>
          </div>
        </div>
      )}

      <small className="inspector-hint">
        {ui('화살표 방향에 따라 입력·라우팅·핸드오프·검토 피드백·출력이 전달됩니다.')}
      </small>
    </section>
  );
}

export function AgentInputInspector({ id, item, items, store, onPatchItem, onNavigateObject }) {
  useUiLocale();
  const fieldId = useId();
  const config = useMemo(() => readAgentInputConfig(item), [item]);
  const connections = useMemo(() => inspectAgentConnections(items || {}, id), [items, id]);

  const update = (patch) => {
    const next = writeAgentInputPatch(item, patch);
    if (next) onPatchItem?.(id, next);
  };

  return (
    <section className="inspector-section agent-inspector-section">
      <strong className="inspector-label">{ui('입력 객체 설정')}</strong>
      <label className="agent-inspector-field" htmlFor={`${fieldId}-title`}>
        <span>{ui('이름')}</span>
        <input
          id={`${fieldId}-title`}
          type="text"
          maxLength={120}
          value={item.title || ''}
          onChange={e => update({ title: e.target.value })}
        />
      </label>
      <label className="agent-inspector-field" htmlFor={`${fieldId}-type`}>
        <span>{ui('입력 형식')}</span>
        <select
          id={`${fieldId}-type`}
          value={config.inputType}
          onChange={e => update({ inputType: e.target.value })}
        >
          {INPUT_TYPE_OPTIONS.map(opt => (
            <option key={opt.id} value={opt.id}>{ui(opt.label)}</option>
          ))}
        </select>
      </label>
      <div className="agent-color-swatches" role="group" aria-label={ui('강조 색상')}>
        {AGENT_ACCENT_COLORS.map(swatch => (
          <button
            key={swatch}
            type="button"
            className={item.color === swatch ? 'is-selected' : ''}
            style={{ background: swatch }}
            aria-label={swatch}
            onClick={() => update({ color: swatch })}
          />
        ))}
      </div>
      <label className="agent-inspector-field" htmlFor={`${fieldId}-text`}>
        <span>{ui('사용자 입력 내용')}</span>
        <textarea
          id={`${fieldId}-text`}
          rows={4}
          maxLength={24000}
          value={item.text || ''}
          onChange={e => update({ text: e.target.value })}
        />
      </label>
      {store?.startConnectorFrom && (
        <button
          type="button"
          className="inspector-secondary-action"
          onClick={() => store.startConnectorFrom(id)}
        >
          <span>{ui('연결 객체로 대상 연결')}</span>
        </button>
      )}
      <div className="agent-inspector-edges">
        <strong className="inspector-label">{ui('연결된 전달 대상 ({count})', { count: connections.outgoing.length })}</strong>
        {connections.outgoing.length ? (
          <div className="agent-chip-list">
            {connections.outgoing.map(entry => (
              <button
                key={entry.connectorId}
                type="button"
                className="agent-chip-btn is-outbound"
                onClick={() => onNavigateObject?.(entry.otherId)}
              >
                <em>{entry.channel}</em>
                <span>{entry.summary}</span>
              </button>
            ))}
          </div>
        ) : (
          <small className="inspector-hint">{ui('연결된 대상이 없습니다.')}</small>
        )}
      </div>
    </section>
  );
}

export function AgentRouterInspector({ id, item, items, store, onPatchItem, onPatchConnector, onNavigateObject }) {
  useUiLocale();
  const fieldId = useId();
  const config = useMemo(() => readAgentRouterConfig(item), [item]);
  const routes = useMemo(() => extractRouterRoutes(items || {}, id, config), [items, id, config]);
  const jsonSpec = useMemo(() => parseRouterJsonRules(config.jsonRules || ''), [config.jsonRules]);
  const usesJsonRules = config.routingMode === 'json' || config.routingMode === 'hybrid';
  const usesIntelligent = config.routingMode === 'intelligent' || config.routingMode === 'hybrid';

  const update = (patch) => {
    const next = writeAgentRouterPatch(item, patch);
    if (next) onPatchItem?.(id, next);
  };

  return (
    <section className="inspector-section agent-inspector-section">
      <strong className="inspector-label">{ui('라우터 객체 설정')}</strong>
      <label className="agent-inspector-field" htmlFor={`${fieldId}-title`}>
        <span>{ui('이름')}</span>
        <input
          id={`${fieldId}-title`}
          type="text"
          maxLength={120}
          value={item.title || ''}
          onChange={e => update({ title: e.target.value })}
        />
      </label>
      <label className="agent-inspector-field" htmlFor={`${fieldId}-mode`}>
        <span>{ui('라우팅 방식')}</span>
        <select
          id={`${fieldId}-mode`}
          value={config.routingMode}
          onChange={e => update({ routingMode: e.target.value })}
        >
          {ROUTING_MODES.map(mode => (
            <option key={mode.id} value={mode.id}>{ui(mode.label)}</option>
          ))}
        </select>
      </label>
      <small className="inspector-hint">
        {ui(ROUTING_MODES.find(m => m.id === config.routingMode)?.description || '')}
      </small>

      {usesJsonRules && (
        <div className="agent-inspector-field">
          <div className="agent-json-head">
            <label htmlFor={`${fieldId}-json-rules`}>{ui('JSON 라우팅 규칙')}</label>
            <button
              type="button"
              className="agent-micro-btn"
              onClick={() => update({ jsonRules: buildStarterJsonRoutingRules(routes) })}
            >
              {ui('예시 JSON 규칙 생성')}
            </button>
          </div>
          <textarea
            id={`${fieldId}-json-rules`}
            className="agent-json-textarea"
            rows={5}
            maxLength={6000}
            value={config.jsonRules || ''}
            placeholder={ui('{"match":"first","rules":[{"path":"type","op":"equals","value":"billing","targets":["에이전트"]}]}')}
            onChange={e => update({ jsonRules: e.target.value })}
          />
          <small className={`inspector-hint agent-json-status ${jsonSpec.valid ? 'is-valid' : 'is-invalid'}`}>
            {jsonSpec.valid
              ? (jsonSpec.rules.length
                ? ui('JSON 규칙 {count}개 유효', { count: jsonSpec.rules.length })
                : ui('JSON 규칙 배열 또는 {"rules":[...]} 객체를 입력하세요.'))
              : jsonSpec.error}
          </small>
        </div>
      )}

      {usesIntelligent && (
        <>
          <label className="agent-inspector-field" htmlFor={`${fieldId}-prompt`}>
            <span>{ui('지능형 라우팅 기준 프롬프트')}</span>
            <textarea
              id={`${fieldId}-prompt`}
              rows={3}
              maxLength={4000}
              value={config.routingPrompt}
              onChange={e => update({ routingPrompt: e.target.value })}
            />
          </label>
          <label className="agent-inspector-field" htmlFor={`${fieldId}-engine`}>
            <span>{ui('지능형 라우터 엔진')}</span>
            <select
              id={`${fieldId}-engine`}
              value={config.engine}
              onChange={e => update({ engine: e.target.value })}
            >
              <option value="api">{ui('EXAONE 2.5 API')}</option>
              <option value="cli">{ui('VM CLI 에이전트')}</option>
            </select>
          </label>
          {config.engine === 'cli' && (
            <label className="agent-inspector-field" htmlFor={`${fieldId}-cli-tool`}>
              <span>{ui('CLI 도구')}</span>
              <select
                id={`${fieldId}-cli-tool`}
                value={config.cli_tool}
                onChange={e => update({ cli_tool: e.target.value })}
              >
                {CLI_TOOLS.map(tool => (
                  <option key={tool.id} value={tool.id}>{ui(tool.label)}</option>
                ))}
              </select>
            </label>
          )}
        </>
      )}

      <label className="agent-inspector-field" htmlFor={`${fieldId}-fallback`}>
        <span>{ui('미일치 시 폴백 정책')}</span>
        <select
          id={`${fieldId}-fallback`}
          value={config.fallbackPolicy}
          onChange={e => update({ fallbackPolicy: e.target.value })}
        >
          {ROUTER_FALLBACK_POLICIES.map(pol => (
            <option key={pol.id} value={pol.id}>{ui(pol.label)}</option>
          ))}
        </select>
      </label>

      <label className="agent-inspector-check" htmlFor={`${fieldId}-multi-match`}>
        <input
          id={`${fieldId}-multi-match`}
          type="checkbox"
          checked={config.multiMatch}
          onChange={e => update({ multiMatch: e.target.checked })}
        />
        <span>{ui('다중 포맷 일치 시 여러 경로 동시 분기')}</span>
      </label>
      {usesIntelligent && (
        <label className="agent-inspector-check" htmlFor={`${fieldId}-multi-route`}>
          <input
            id={`${fieldId}-multi-route`}
            type="checkbox"
            checked={config.allowMultiRoute}
            onChange={e => update({ allowMultiRoute: e.target.checked })}
          />
          <span>{ui('지능형 모드 복수 에이전트 선택 허용')}</span>
        </label>
      )}

      {store?.startConnectorFrom && (
        <button
          type="button"
          className="inspector-secondary-action"
          onClick={() => store.startConnectorFrom(id)}
        >
          <span>{ui('연결 객체로 대상 연결')}</span>
        </button>
      )}

      <div className="agent-inspector-edges">
        <strong className="inspector-label">{ui('연결된 분기 경로 ({count})', { count: routes.length })}</strong>
        {routes.length ? routes.map(route => (
          <div key={route.connectorId} className="agent-inspector-edge-row">
            <div className="agent-inspector-edge-head">
              <button type="button" onClick={() => onNavigateObject?.(route.targetId)}>
                {route.targetName}
              </button>
              <label htmlFor={`${fieldId}-route-def-${route.connectorId}`}>
                <input
                  id={`${fieldId}-route-def-${route.connectorId}`}
                  type="checkbox"
                  checked={route.isDefault}
                  onChange={e => {
                    const nextDefault = e.target.checked;
                    const patch = writeAgentEdgePatch(route.edge, { routeDefault: nextDefault });
                    if (patch) onPatchConnector?.(route.connectorId, patch);
                  }}
                />
                <span>{ui('기본')}</span>
              </label>
            </div>
            <div className="agent-format-pills">
              {INPUT_DATA_FORMATS.map(fmt => {
                const active = route.formats.includes(fmt.id);
                return (
                  <button
                    key={fmt.id}
                    type="button"
                    className={active ? 'is-active' : ''}
                    onClick={() => {
                      const nextFormats = active
                        ? route.formats.filter(f => f !== fmt.id)
                        : [...route.formats, fmt.id];
                      const patch = writeAgentEdgePatch(route.edge, { routeFormats: nextFormats, channel: 'route' });
                      if (patch) onPatchConnector?.(route.connectorId, patch);
                    }}
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
                aria-label={`${route.targetName} ${ui('JSON 조건식')}`}
                placeholder={ui('JSON 조건 예: type == "billing"')}
                value={route.jsonCondition || ''}
                onChange={e => {
                  const patch = writeAgentEdgePatch(route.edge, { routeJsonCondition: e.target.value, channel: 'route' });
                  if (patch) onPatchConnector?.(route.connectorId, patch);
                }}
              />
            )}
          </div>
        )) : (
          <small className="inspector-hint">{ui('연결된 분기 대상이 없습니다.')}</small>
        )}
      </div>
    </section>
  );
}

export function AgentOutputInspector({ id, item, items, onPatchItem, onNavigateObject }) {
  useUiLocale();
  const fieldId = useId();
  const config = useMemo(() => readAgentOutputConfig(item), [item]);
  const connections = useMemo(() => inspectAgentConnections(items || {}, id), [items, id]);

  const update = (patch) => {
    const next = writeAgentOutputPatch(item, patch);
    if (next) onPatchItem?.(id, next);
  };

  return (
    <section className="inspector-section agent-inspector-section">
      <strong className="inspector-label">{ui('출력 객체 설정')}</strong>
      <label className="agent-inspector-field" htmlFor={`${fieldId}-title`}>
        <span>{ui('이름')}</span>
        <input
          id={`${fieldId}-title`}
          type="text"
          maxLength={120}
          value={item.title || ''}
          onChange={e => update({ title: e.target.value })}
        />
      </label>
      <label className="agent-inspector-field" htmlFor={`${fieldId}-display`}>
        <span>{ui('표시 형식')}</span>
        <select
          id={`${fieldId}-display`}
          value={config.displayMode}
          onChange={e => update({ displayMode: e.target.value })}
        >
          {OUTPUT_DISPLAY_MODES.map(mode => (
            <option key={mode.id} value={mode.id}>{ui(mode.label)}</option>
          ))}
        </select>
      </label>
      <div className="agent-color-swatches" role="group" aria-label={ui('강조 색상')}>
        {AGENT_ACCENT_COLORS.map(swatch => (
          <button
            key={swatch}
            type="button"
            className={item.color === swatch ? 'is-selected' : ''}
            style={{ background: swatch }}
            aria-label={swatch}
            onClick={() => update({ color: swatch })}
          />
        ))}
      </div>
      <label className="agent-inspector-check" htmlFor={`${fieldId}-append`}>
        <input
          id={`${fieldId}-append`}
          type="checkbox"
          checked={config.appendHistory}
          onChange={e => update({ appendHistory: e.target.checked })}
        />
        <span>{ui('실행 기록 누적 보관')}</span>
      </label>
      <label className="agent-inspector-check" htmlFor={`${fieldId}-meta`}>
        <input
          id={`${fieldId}-meta`}
          type="checkbox"
          checked={config.showMetadata}
          onChange={e => update({ showMetadata: e.target.checked })}
        />
        <span>{ui('출처·라우팅 정보 표시')}</span>
      </label>
      {config.lastMeta && (
        <div className="agent-output-meta-bar">
          <span>{ui('최근 출처')}: {config.lastMeta.sourceName || '—'}</span>
          {config.lastMeta.inputFormats?.length > 0 && (
            <span>{config.lastMeta.inputFormats.map(f => ui(formatTypeLabel(f))).join(', ')}</span>
          )}
        </div>
      )}
      <div className="agent-inspector-edges">
        <strong className="inspector-label">{ui('연결된 응답 소스 ({count})', { count: connections.incoming.length })}</strong>
        {connections.incoming.length ? (
          <div className="agent-chip-list">
            {connections.incoming.map(entry => (
              <button
                key={entry.connectorId}
                type="button"
                className="agent-chip-btn"
                onClick={() => onNavigateObject?.(entry.otherId)}
              >
                <em>{entry.channel}</em>
                <span>{entry.summary}</span>
              </button>
            ))}
          </div>
        ) : (
          <small className="inspector-hint">{ui('에이전트나 라우터에서 화살표로 연결하세요.')}</small>
        )}
      </div>
    </section>
  );
}

export function AgentNodeInspector({
  id,
  item,
  items,
  store,
  onPatchAgent,
  onPatchConnector,
  onNavigateObject,
}) {
  const locale = useUiLocale();
  const fieldId = useId();
  const config = useMemo(() => readAgentNodeConfig(item), [item]);
  const connections = useMemo(() => inspectAgentConnections(items || {}, id), [items, id]);

  const update = (patch) => {
    const next = writeAgentNodePatch(item, patch);
    if (next) onPatchAgent?.(id, next);
  };

  return (
    <section className="inspector-section agent-inspector-section">
      <strong className="inspector-label">{ui('AI 에이전트 설정')}</strong>

      <label className="agent-inspector-field" htmlFor={`${fieldId}-title`}>
        <span>{ui('이름')}</span>
        <input
          id={`${fieldId}-title`}
          type="text"
          maxLength={120}
          value={item.title || ''}
          onChange={e => update({ title: e.target.value })}
        />
      </label>

      <label className="agent-inspector-field" htmlFor={`${fieldId}-preset`}>
        <span>{ui('역할 프리셋')}</span>
        <select
          id={`${fieldId}-preset`}
          value={config.presetId}
          onChange={e => {
            const preset = AGENT_ROLE_PRESETS.find(p => p.id === e.target.value);
            if (!preset) return;
            update({
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
        </select>
      </label>

      <label className="agent-inspector-field" htmlFor={`${fieldId}-role`}>
        <span>{ui('역할 설명')}</span>
        <input
          id={`${fieldId}-role`}
          type="text"
          maxLength={120}
          value={config.role}
          onChange={e => update({ role: e.target.value })}
        />
      </label>

      <div className="agent-color-swatches" role="group" aria-label={ui('강조 색상')}>
        {AGENT_ACCENT_COLORS.map(swatch => (
          <button
            key={swatch}
            type="button"
            className={item.color === swatch ? 'is-selected' : ''}
            style={{ background: swatch }}
            aria-label={swatch}
            onClick={() => update({ color: swatch })}
          />
        ))}
      </div>

      <label className="agent-inspector-field" htmlFor={`${fieldId}-prompt`}>
        <span>{ui('기본 프롬프트')}</span>
        <textarea
          id={`${fieldId}-prompt`}
          rows={4}
          maxLength={6000}
          value={config.systemPrompt}
          onChange={e => update({ systemPrompt: e.target.value })}
        />
      </label>

      <label className="agent-inspector-field" htmlFor={`${fieldId}-engine`}>
        <span>{ui('실행 엔진')}</span>
        <select
          id={`${fieldId}-engine`}
          value={config.engine}
          onChange={e => update({ engine: e.target.value })}
        >
          <option value="api">{ui('EXAONE 2.5 API')}</option>
          <option value="cli">{ui('VM CLI 에이전트')}</option>
          <option value="mock">{ui('모형 에이전트')}</option>
        </select>
      </label>

      {config.engine === 'mock' ? (
        <MockAgentResponseFields config={config} onChange={update} className="agent-inspector-field" />
      ) : config.engine === 'cli' ? (
        <>
          <label className="agent-inspector-field" htmlFor={`${fieldId}-cli-tool`}>
            <span>{ui('CLI 도구')}</span>
            <select
              id={`${fieldId}-cli-tool`}
              value={config.cli_tool}
              onChange={e => update({ cli_tool: e.target.value })}
            >
              {CLI_TOOLS.map(tool => (
                <option key={tool.id} value={tool.id}>{ui(tool.label)}</option>
              ))}
            </select>
          </label>
          <label className="agent-inspector-field" htmlFor={`${fieldId}-cli-model`}>
            <span>{ui('CLI 모델 지정 (선택)')}</span>
            <input
              id={`${fieldId}-cli-model`}
              type="text"
              maxLength={128}
              value={config.cli_model}
              placeholder={ui('기본 모델 사용')}
              onChange={e => update({ cli_model: e.target.value })}
            />
          </label>
          {config.cli_tool === 'custom' && (
            <label className="agent-inspector-field" htmlFor={`${fieldId}-cli-command`}>
              <span>{ui('실행 명령어')}</span>
              <input
                id={`${fieldId}-cli-command`}
                type="text"
                maxLength={512}
                value={config.cli_command}
                onChange={e => update({ cli_command: e.target.value })}
              />
            </label>
          )}
        </>
      ) : (
        <div className="agent-inspector-grid">
          <label className="agent-inspector-field" htmlFor={`${fieldId}-reasoning`}>
            <span>{ui('추론 수준')}</span>
            <select
              id={`${fieldId}-reasoning`}
              value={config.reasoning_effort}
              onChange={e => update({ reasoning_effort: e.target.value })}
            >
              <option value="low">{ui('낮음')}</option>
              <option value="high">{ui('높음')}</option>
              <option value="max">{ui('최대')}</option>
            </select>
          </label>
          <label className="agent-inspector-field" htmlFor={`${fieldId}-tokens`}>
            <span>{ui('응답 토큰')}</span>
            <select
              id={`${fieldId}-tokens`}
              value={config.max_tokens}
              onChange={e => update({ max_tokens: Number(e.target.value) })}
            >
              {[1024, 2048, 4096, 8192, 16384, 32768].map(val => (
                <option key={val} value={val}>{val.toLocaleString(intlLocale(locale))}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {config.engine !== 'mock' && <label className="agent-inspector-field" htmlFor={`${fieldId}-steps`}>
        <span>{ui('최대 작업 단계')}</span>
        <input
          id={`${fieldId}-steps`}
          type="number"
          min="1"
          max="12"
          value={config.max_steps}
          onChange={e => {
            const n = Number(e.target.value);
            if (Number.isInteger(n) && n >= 1 && n <= 12) update({ max_steps: n });
          }}
        />
      </label>}

      <label className="agent-inspector-check" htmlFor={`${fieldId}-attach`}>
        <input
          id={`${fieldId}-attach`}
          type="checkbox"
          checked={config.attachInputsAsSelection}
          onChange={e => update({ attachInputsAsSelection: e.target.checked })}
        />
        <span>{ui('연결된 입력 객체를 컨텍스트로 첨부')}</span>
      </label>
      <label className="agent-inspector-check" htmlFor={`${fieldId}-write-out`}>
        <input
          id={`${fieldId}-write-out`}
          type="checkbox"
          checked={config.writeToOutputs}
          onChange={e => update({ writeToOutputs: e.target.checked })}
        />
        <span>{ui('연결된 결과·문서 객체에 출력 기록')}</span>
      </label>
      <label className="agent-inspector-check" htmlFor={`${fieldId}-delegate`}>
        <input
          id={`${fieldId}-delegate`}
          type="checkbox"
          checked={config.canDelegate}
          onChange={e => update({ canDelegate: e.target.checked })}
        />
        <span>{ui('다른 에이전트에게 핸드오프·피드백 전송 허용')}</span>
      </label>
      {config.engine !== 'mock' && <label className="agent-inspector-check" htmlFor={`${fieldId}-delete`}>
        <input
          id={`${fieldId}-delete`}
          type="checkbox"
          checked={config.allow_delete}
          onChange={e => update({ allow_delete: e.target.checked })}
        />
        <span>{ui('캔버스 객체 삭제 도구 허용')}</span>
      </label>}

      {store?.startConnectorFrom && (
        <button
          type="button"
          className="inspector-secondary-action"
          onClick={() => store.startConnectorFrom(id)}
        >
          <span>{ui('연결 객체로 대상 연결')}</span>
        </button>
      )}

      <div className="agent-inspector-edges">
        <strong className="inspector-label">{ui('연결된 입력 구성 ({count})', { count: connections.incoming.length })}</strong>
        {connections.incoming.length ? connections.incoming.map(entry => (
          <div key={entry.connectorId} className="agent-inspector-edge-row">
            <div className="agent-inspector-edge-head">
              <button type="button" onClick={() => onNavigateObject?.(entry.otherId)}>
                {entry.summary}
              </button>
              <label htmlFor={`${fieldId}-edge-${entry.connectorId}-enabled`}>
                <input
                  id={`${fieldId}-edge-${entry.connectorId}-enabled`}
                  name={`agent-edge-${entry.connectorId}-enabled`}
                  type="checkbox"
                  checked={entry.edgeConfig.enabled}
                  onChange={e => {
                    const patch = writeAgentEdgePatch(entry.edge, { enabled: e.target.checked });
                    if (patch) onPatchConnector?.(entry.connectorId, patch);
                  }}
                />
                <span>{ui('활성')}</span>
              </label>
            </div>
            <div className="agent-inspector-edge-controls">
              <select
                id={`${fieldId}-edge-${entry.connectorId}-channel`}
                name={`agent-edge-${entry.connectorId}-channel`}
                aria-label={ui('전달 역할')}
                value={entry.edgeConfig.channel}
                onChange={e => {
                  const patch = writeAgentEdgePatch(entry.edge, { channel: e.target.value });
                  if (patch) onPatchConnector?.(entry.connectorId, patch);
                }}
              >
                {EDGE_CHANNELS.map(ch => (
                  <option key={ch.id} value={ch.id}>{ui(ch.label)}</option>
                ))}
              </select>
              <select
                id={`${fieldId}-edge-${entry.connectorId}-delivery`}
                name={`agent-edge-${entry.connectorId}-delivery`}
                aria-label={ui('데이터 전달 방식')}
                value={entry.edgeConfig.delivery}
                onChange={e => {
                  const patch = writeAgentEdgePatch(entry.edge, { delivery: e.target.value });
                  if (patch) onPatchConnector?.(entry.connectorId, patch);
                }}
              >
                {EDGE_DELIVERY_MODES.map(mode => (
                  <option key={mode.id} value={mode.id}>{ui(mode.label)}</option>
                ))}
              </select>
            </div>
          </div>
        )) : (
          <small className="inspector-hint">{ui('입력으로 연결된 객체가 없습니다.')}</small>
        )}
      </div>

      <button
        type="button"
        className="inspector-secondary-action"
        onClick={() => store?.openAgentPanel?.()}
      >
        <span>{ui('API 키 · CLI 설치 설정 열기')}</span>
      </button>
    </section>
  );
}

export function AgentOrchestratorInspector({
  id,
  item,
  items,
  store,
  onPatchOrchestrator,
  onNavigateObject,
}) {
  useUiLocale();
  const fieldId = useId();
  const config = useMemo(() => readOrchestratorConfig(item), [item]);
  const resolved = useMemo(() => {
    try {
      return { graph: resolveMultiAgentGraph(items || {}, id), error: '' };
    } catch (error) {
      return { graph: null, error: error.message };
    }
  }, [items, id]);

  const update = (patch) => {
    const next = writeOrchestratorPatch(item, patch);
    if (next) onPatchOrchestrator?.(id, next);
  };

  return (
    <section className="inspector-section agent-inspector-section">
      <strong className="inspector-label">{ui('멀티 에이전트 오케스트레이터 설정')}</strong>

      <label className="agent-inspector-field" htmlFor={`${fieldId}-title`}>
        <span>{ui('이름')}</span>
        <input
          id={`${fieldId}-title`}
          type="text"
          maxLength={120}
          value={item.title || ''}
          onChange={e => update({ title: e.target.value })}
        />
      </label>

      <label className="agent-inspector-field" htmlFor={`${fieldId}-mode`}>
        <span>{ui('오케스트레이션 방식')}</span>
        <select
          id={`${fieldId}-mode`}
          value={config.mode}
          onChange={e => update({ mode: e.target.value })}
        >
          {ORCHESTRATION_MODES.map(mode => (
            <option key={mode.id} value={mode.id}>{ui(mode.label)}</option>
          ))}
        </select>
      </label>
      <small className="inspector-hint">
        {ui(ORCHESTRATION_MODES.find(m => m.id === config.mode)?.description || '')}
      </small>

      <label className="agent-inspector-field" htmlFor={`${fieldId}-goal`}>
        <span>{ui('공동 목표')}</span>
        <textarea
          id={`${fieldId}-goal`}
          rows={3}
          maxLength={4000}
          value={config.goal}
          onChange={e => update({ goal: e.target.value })}
        />
      </label>

      {config.mode !== 'graph' && (
        <label className="agent-inspector-field" htmlFor={`${fieldId}-rounds`}>
          <span>{ui('최대 협업 라운드')}</span>
          <input
            id={`${fieldId}-rounds`}
            type="number"
            min="1"
            max="6"
            step="1"
            value={config.maxRounds}
            onChange={e => {
              const n = Number(e.target.value);
              if (Number.isInteger(n) && n >= 1 && n <= 6) update({ maxRounds: n });
            }}
          />
        </label>
      )}

      {config.mode === 'supervisor' && resolved.graph?.agentIds?.length > 0 && (
        <label className="agent-inspector-field" htmlFor={`${fieldId}-supervisor`}>
          <span>{ui('감독 에이전트')}</span>
          <select
            id={`${fieldId}-supervisor`}
            value={resolved.graph.supervisorAgentId}
            onChange={e => update({ supervisorAgentId: e.target.value })}
          >
            {resolved.graph.agentIds.map(agentId => (
              <option key={agentId} value={agentId}>
                {items?.[agentId]?.title || readAgentNodeConfig(items?.[agentId]).role}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="agent-inspector-check" htmlFor={`${fieldId}-shared`}>
        <input
          id={`${fieldId}-shared`}
          type="checkbox"
          checked={config.sharedMemory}
          onChange={e => update({ sharedMemory: e.target.checked })}
        />
        <span>{ui('팀 공유 협업 기억 유지')}</span>
      </label>
      <label className="agent-inspector-check" htmlFor={`${fieldId}-consensus`}>
        <input
          id={`${fieldId}-consensus`}
          type="checkbox"
          checked={config.consensusStop}
          onChange={e => update({ consensusStop: e.target.checked })}
        />
        <span>{ui('합의·승인 시 조기 종료')}</span>
      </label>
      <label className="agent-inspector-check" htmlFor={`${fieldId}-stop-err`}>
        <input
          id={`${fieldId}-stop-err`}
          type="checkbox"
          checked={config.stopOnError}
          onChange={e => update({ stopOnError: e.target.checked })}
        />
        <span>{ui('오류 발생 시 즉시 중단')}</span>
      </label>

      {store?.startConnectorFrom && (
        <button
          type="button"
          className="inspector-secondary-action"
          onClick={() => store.startConnectorFrom(id)}
        >
          <span>{ui('연결 객체로 라우터·에이전트 연결')}</span>
        </button>
      )}

      {resolved.graph ? (
        <div className="agent-inspector-edges">
          {resolved.graph.incomingInputIds?.length > 0 && (
            <>
              <strong className="inspector-label">{ui('연결된 입력 객체 ({count})', { count: resolved.graph.incomingInputIds.length })}</strong>
              <div className="agent-chip-list">
                {resolved.graph.incomingInputIds.map(inId => (
                  <button key={inId} type="button" className="agent-chip-btn" onClick={() => onNavigateObject?.(inId)}>
                    <span>{items?.[inId]?.title || ui('입력 객체')}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {resolved.graph.routerIds?.length > 0 && (
            <>
              <strong className="inspector-label">{ui('연결된 라우터 ({count})', { count: resolved.graph.routerIds.length })}</strong>
              <div className="agent-chip-list">
                {resolved.graph.routerIds.map(rid => (
                  <button key={rid} type="button" className="agent-chip-btn is-router" onClick={() => onNavigateObject?.(rid)}>
                    <span>{items?.[rid]?.title || ui('라우터 객체')}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <strong className="inspector-label">{ui('참여 에이전트 ({count})', { count: resolved.graph.agentIds.length })}</strong>
          <div className="agent-chip-list">
            {resolved.graph.agentIds.map(agentId => (
              <button
                key={agentId}
                type="button"
                className="agent-chip-btn is-team"
                onClick={() => onNavigateObject?.(agentId)}
              >
                <span>{items?.[agentId]?.title || readAgentNodeConfig(items?.[agentId]).role}</span>
              </button>
            ))}
          </div>
          {resolved.graph.outputIds?.length > 0 && (
            <>
              <strong className="inspector-label">{ui('연결된 출력 ({count})', { count: resolved.graph.outputIds.length })}</strong>
              <div className="agent-chip-list">
                {resolved.graph.outputIds.map(oid => (
                  <button key={oid} type="button" className="agent-chip-btn is-outbound" onClick={() => onNavigateObject?.(oid)}>
                    <span>{items?.[oid]?.title || ui('출력 객체')}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="agent-error-line">{resolved.error}</p>
      )}

      {store?.createTemplate && (
        <div className="agent-template-buttons">
          <strong className="inspector-label">{ui('멀티 에이전트 팀 템플릿 생성')}</strong>
          {MULTI_AGENT_TEMPLATES.map(tpl => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => store.createTemplate(id, tpl.id)}
            >
              {ui(tpl.label)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
