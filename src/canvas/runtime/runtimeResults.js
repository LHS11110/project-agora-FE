export function validRuntimeResults(value) {
  const fields = new Set(['runId', 'codeId', 'createdAt', 'output', 'error', 'exitCode', 'timedOut', 'truncated']);
  return Array.isArray(value) && value.length <= 32 && new TextEncoder().encode(JSON.stringify(value)).length <= 524288 && value.every(entry =>
    entry && typeof entry === 'object' && !Array.isArray(entry) && Object.keys(entry).every(key => fields.has(key))
    && typeof entry.runId === 'string' && entry.runId.length <= 256 && typeof entry.codeId === 'string' && entry.codeId.length <= 128
    && Number.isSafeInteger(entry.createdAt) && entry.createdAt >= 0
    && ['output', 'error'].every(key => entry[key] == null || typeof entry[key] === 'string')
    && (entry.exitCode == null || Number.isSafeInteger(entry.exitCode))
    && ['timedOut', 'truncated'].every(key => entry[key] == null || typeof entry[key] === 'boolean'));
}
