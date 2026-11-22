export const AGENT_DEFAULTS = {
  reasoning_effort: 'low',
  max_tokens: 8192,
  max_steps: 8,
  temperature: 1,
  top_p: 0.95,
};

// Model providers the agent service can call. Endpoints are fixed on the server;
// the browser sends only a provider id and a model name. An empty model uses the
// provider default. EXAONE is not offered: its API terms (2026-11-09) allow only
// non-commercial use and forbid integrating the API into products or services.
// dataNotice summarizes each provider's terms on training with API data.
export const AGENT_PROVIDERS = [
  {
    id: 'openai', label: 'OpenAI', defaultModel: 'gpt-5', models: ['gpt-5', 'gpt-5-mini', 'gpt-4.1'],
    termsUrl: 'https://openai.com/policies/services-agreement/', policyUrl: 'https://openai.com/policies/usage-policies/',
    dataNotice: 'OpenAI는 고객이 동의하지 않는 한 API 입력과 출력을 모델 학습에 쓰지 않습니다.',
  },
  {
    id: 'anthropic', label: 'Anthropic Claude', defaultModel: 'claude-opus-5-5', models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    termsUrl: 'https://www.anthropic.com/legal/commercial-terms', policyUrl: 'https://www.anthropic.com/legal/aup',
    dataNotice: 'Anthropic은 API 입력과 출력으로 모델을 학습하지 않습니다.',
  },
  {
    id: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.5-flash', models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    termsUrl: 'https://ai.google.dev/gemini-api/terms', policyUrl: 'https://policies.google.com/terms/generative-ai/use-policy',
    dataNotice: '무료 사용분의 입력과 출력은 Google 제품 개선에 쓰이고 사람이 검토할 수 있습니다. 유료 사용분은 개선에 쓰지 않습니다.',
    // Gemini API Additional Terms: developer/business use, paid only in the EEA, CH and UK.
    extraConsent: '업무·개발 목적으로만 사용하며, EEA·스위스·영국에서는 유료 결제 키만 사용합니다.',
  },
  {
    id: 'openrouter', label: 'OpenRouter', defaultModel: 'openrouter/auto', models: ['openrouter/auto'],
    termsUrl: 'https://openrouter.ai/terms', policyUrl: 'https://openrouter.ai/privacy',
    dataNotice: 'OpenRouter는 입력을 학습에 쓰지 않지만, 실제 모델 제공사의 약관에 따라 입력이 학습에 쓰일 수 있습니다.',
  },
];
export const DEFAULT_AGENT_PROVIDER = 'openai';
const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,127}$/;

export function agentProvider(id) {
  return AGENT_PROVIDERS.find(provider => provider.id === id) || AGENT_PROVIDERS[0];
}

export function normalizeAgentModel(value) {
  const model = typeof value === 'string' ? value.trim() : '';
  return MODEL_PATTERN.test(model) ? model : '';
}

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
  const result = {
    ...AGENT_DEFAULTS,
    engine: 'api',
    provider: agentProvider(source.provider).id,
    model: normalizeAgentModel(source.model),
    includeHistory: source.includeHistory !== false,
    attachSelection: source.attachSelection !== false,
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
  options.provider = agentProvider(value.provider).id;
  const model = normalizeAgentModel(value.model);
  if (model) options.model = model;
  return options;
}
