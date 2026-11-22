export const AGENT_DEFAULTS = {
  reasoning_effort: 'low',
  max_tokens: 8192,
  max_steps: 8,
  temperature: 1,
  top_p: 0.95,
};

export const CLI_TOOLS = [
  { id: 'claude', label: 'Claude Code', packageName: '@anthropic-ai/claude-code', keyEnv: 'ANTHROPIC_API_KEY' },
  { id: 'codex', label: 'OpenAI Codex CLI', packageName: '@openai/codex', keyEnv: 'OPENAI_API_KEY' },
  { id: 'gemini', label: 'Gemini CLI', packageName: '@google/gemini-cli', keyEnv: 'GEMINI_API_KEY' },
  { id: 'opencode', label: 'OpenCode', packageName: 'opencode-ai', keyEnv: 'OPENAI_API_KEY' },
  { id: 'custom', label: '사용자 지정 CLI', packageName: '', keyEnv: 'AGORA_CLI_API_KEY' },
];

const CLI_TOOL_IDS = CLI_TOOLS.map(tool => tool.id);
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
  const rawModel = typeof source.cli_model === 'string' ? source.cli_model.trim() : '';
  const rawCommand = typeof source.cli_command === 'string' ? source.cli_command.trim() : '';
  const result = {
    ...AGENT_DEFAULTS,
    engine: source.engine === 'cli' ? 'cli' : 'api',
    cli_tool: CLI_TOOL_IDS.includes(source.cli_tool) ? source.cli_tool : 'claude',
    cli_model: rawModel.length <= 128 && /^[\x20-\x7e]*$/.test(rawModel) ? rawModel : '',
    cli_command: rawCommand.length <= 512 && !/[\x00\r\n]/.test(rawCommand) ? rawCommand : '',
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
  if (value?.engine === 'cli') {
    const cliTool = CLI_TOOL_IDS.includes(value.cli_tool) ? value.cli_tool : 'claude';
    const options = {
      engine: 'cli',
      cli_tool: cliTool,
      max_steps: Number.isInteger(value.max_steps) && value.max_steps >= 1 && value.max_steps <= 12
        ? value.max_steps
        : AGENT_DEFAULTS.max_steps,
    };
    const model = typeof value.cli_model === 'string' ? value.cli_model.trim() : '';
    if (model && model.length <= 128 && /^[\x20-\x7e]*$/.test(model)) {
      options.cli_model = model;
    }
    const command = typeof value.cli_command === 'string' ? value.cli_command.trim() : '';
    if (cliTool === 'custom' && command && command.length <= 512 && !/[\x00\r\n]/.test(command)) {
      options.cli_command = command;
    }
    return options;
  }
  return Object.fromEntries(Object.keys(AGENT_DEFAULTS).map(k => [k, value[k]]));
}
