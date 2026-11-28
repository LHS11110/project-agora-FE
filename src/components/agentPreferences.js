export const AGENT_DEFAULTS = {
  reasoning_effort: 'low',
  max_tokens: 8192,
  max_steps: 8,
  temperature: 1,
  top_p: 0.95,
};

export const LOCAL_AGENT_PROVIDER = {
  id: 'local', label: '로컬 Gemma', defaultModel: 'gemma4:12b', models: ['gemma4:12b'],
};
export const DEFAULT_AGENT_PROVIDER = LOCAL_AGENT_PROVIDER.id;
export function agentProvider() { return LOCAL_AGENT_PROVIDER; }

const key = 'agora-agent-preferences-v1';

export function loadAgentPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return normalizeAgentPreferences(saved);
  } catch {
    return normalizeAgentPreferences({});
  }
}

export function normalizeAgentPreferences(value) {
  const source = value && typeof value === 'object' ? value : {};
  // The API engine is the only agent runtime; saved VM CLI preferences fall back to it.
  const provider = agentProvider(source.provider);
  const model = typeof source.model === 'string' ? source.model.trim() : '';
  const result = {
    ...AGENT_DEFAULTS,
    engine: 'api',
    provider: provider.id,
    model: provider.models.includes(model) ? model : '',
  };
  if (['low', 'high', 'max'].includes(source.reasoning_effort)) {
    result.reasoning_effort = source.reasoning_effort;
  }
  for (const [name, min, max] of [
    ['max_tokens', 512, 32768],
    ['max_steps', 1, 12],
    ['temperature', 0, 2],
    ['top_p', 0.05, 1],
  ]) {
    if (
      Number.isFinite(source[name])
      && source[name] >= min
      && source[name] <= max
      && (!['max_tokens', 'max_steps'].includes(name) || Number.isInteger(source[name]))
    ) {
      result[name] = source[name];
    }
  }
  return result;
}

export function saveAgentPreferences(value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Settings remain usable when storage is unavailable. */
  }
}

export function modelOptions(value) {
  const options = Object.fromEntries(Object.keys(AGENT_DEFAULTS).map(k => [k, value[k]]));
  const provider = agentProvider(value.provider);
  options.provider = provider.id;
  if (provider.models.includes(value.model)) options.model = value.model;
  return options;
}
