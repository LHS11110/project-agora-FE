import { resolveBlueprint } from './blueprintGraph.js';
import { contentSource } from '../content/contentPresentation.js';
import { runtimeLanguages } from './runtimeLanguages.js';

/** Run a snapshot of the graph sequentially; results are delivered only to connected outputs. */
export async function runBlueprint(items, executorId, execute, publish) {
  const graph = resolveBlueprint(items, executorId);
  if (!graph.length) throw new Error('연결된 코드 객체가 없습니다.');
  const snapshot = graph.map(({ codeId, outputIds }) => ({
    codeId, outputIds, language: items[codeId].language || 'javascript', code: contentSource(items[codeId]),
  }));
  for (const step of snapshot) {
    if (!runtimeLanguages.has(step.language)) throw new Error('실행할 수 없는 언어가 연결되어 있습니다.');
  }
  for (const step of snapshot) {
    let result;
    try { result = await execute({ language: step.language, code: step.code }); }
    catch (error) { result = { error: error?.message || '코드 실행에 실패했습니다.' }; }
    for (const outputId of step.outputIds) publish(outputId, { codeId: step.codeId, result });
    if (result.error || result.timedOut || result.exitCode !== 0) return { failed: true };
  }
  return { failed: false };
}
