import { useId, useMemo } from 'react';
import { CLI_TOOLS } from '../../components/agentPreferences.js';
import { ui } from '../../i18n/locale.js';
import { useUiLocale } from '../../i18n/useUiLocale.js';
import {
  AGENT_ACCENT_COLORS,
  AGENT_ROLE_PRESETS,
  EDGE_CHANNELS,
  EDGE_DELIVERY_MODES,
  MULTI_AGENT_TEMPLATES,
  ORCHESTRATION_MODES,
  isAgentCanvasObject,
  readAgentEdgeConfig,
  readAgentNodeConfig,
  readOrchestratorConfig,
  writeAgentEdgePatch,
  writeAgentNodePatch,
  writeOrchestratorPatch,
} from './agentCanvasModel.js';
import { inspectAgentConnections, resolveMultiAgentGraph } from './multiAgentGraph.js';

export function AgentToolHint({ tool }) {
  useUiLocale();
  const isOrch = tool === 'agent-orchestrator';
  return (
    <section className="inspector-section">
      <strong className="inspector-label">
        {ui(isOrch ? '에이전트 오케스트레이터' : 'AI 에이전트 객체')}
      </strong>
      <p className="inspector-hint">
        {ui(isOrch
          ? '캔버스를 클릭하거나 드래그해 오케스트레이터를 배치하세요. 여러 AI 에이전트를 연결해 파이프라인·협업 라운드·감독자 팀을 실행합니다.'
          : '캔버스를 클릭하거나 드래그해 AI 에이전트를 배치하세요. 메모·코드·테이블·다른 에이전트를 화살표로 연결해 데이터를 전달하고 협업할 수 있습니다.')}
      </p>
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
  const updateEdge = (patch) => {
    const next = writeAgentEdgePatch(connector, patch);
    if (next) onPatchConnector?.(next);
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
      <small className="inspector-hint">
        {ui('화살표 방향에 따라 데이터·프롬프트·핸드오프·검토 피드백이 전달됩니다.')}
      </small>
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
  useUiLocale();
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
        </select>
      </label>

      {config.engine === 'cli' ? (
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
                <option key={val} value={val}>{val.toLocaleString()}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <label className="agent-inspector-field" htmlFor={`${fieldId}-steps`}>
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
      </label>

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
      <label className="agent-inspector-check" htmlFor={`${fieldId}-delete`}>
        <input
          id={`${fieldId}-delete`}
          type="checkbox"
          checked={config.allow_delete}
          onChange={e => update({ allow_delete: e.target.checked })}
        />
        <span>{ui('캔버스 객체 삭제 도구 허용')}</span>
      </label>

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

      {resolved.graph ? (
        <div className="agent-inspector-edges">
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
