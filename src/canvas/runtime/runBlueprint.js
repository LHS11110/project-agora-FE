import { resolveBlueprint, resolveCode } from './blueprintGraph.js';
import { contentSource } from '../content/contentPresentation.js';
import { runtimeLanguages } from './runtimeLanguages.js';

/** Run a snapshot of the graph sequentially; results are delivered only to connected outputs. */
export async function runBlueprint(items, executorId, execute, publish, {codeOnly=false, buildOnly=false, onStep=()=>{}, onStepResult=()=>{}}={}) {
  const graph = (codeOnly?resolveCode:resolveBlueprint)(items, executorId);
  if (!graph.length) throw new Error('연결된 코드 객체가 없습니다.');
  const snapshot = graph.map(({ codeId, outputIds }) => ({
    codeId, outputIds, language: items[codeId].language || 'javascript', code: contentSource(items[codeId]),
  }));
  for (const step of snapshot) {
    if (!runtimeLanguages.has(step.language)) throw new Error('실행할 수 없는 언어가 연결되어 있습니다.');
  }
  const outputs = new Map();
  for (const [index, step] of snapshot.entries()) {
    onStep({codeId:step.codeId, codeName:items[step.codeId].filename || step.codeId, preview:step.code.split('\n').find(line=>line.trim())?.slice(0,100)||'', language:step.language, current:index+1, total:snapshot.length});
    let result, streamed = '', timer = null, lastSent = 0, streamError;
    const emit = () => {
      timer = null; lastSent = Date.now();
      if (streamError) return;
      try { for (const outputId of step.outputIds) publish(outputId, {codeId:step.codeId,result:{output:streamed},partial:true}); }
      catch (error) { streamError = error; }
    };
    const onOutput = chunk => {
      streamed += chunk;
      if (streamError) throw streamError;
      if (!step.outputIds.length) return;
      if (Date.now() - lastSent >= 100) emit();
      else if (timer === null) timer = setTimeout(emit, 100 - (Date.now() - lastSent));
    };
    try {
      const inputIds = [...new Set(Object.values(items).filter(edge => edge?.kind === 'connector' && String(edge.to) === step.codeId && items[String(edge.from)]?.runtimeRole === 'output').map(edge => String(edge.from)))].sort((a,b)=>(items[a].y||0)-(items[b].y||0)||(items[a].x||0)-(items[b].x||0)||a.localeCompare(b));
      const chunks = inputIds.flatMap(id => (outputs.get(id) || items[id].runtimeResults || []).map(entry => typeof entry.output === 'string' ? entry.output : ''));
      const stdin = chunks.filter(text=>text.length).map(text=>text.endsWith('\n')?text:text+'\n').join('');
      if (!buildOnly && new TextEncoder().encode(stdin).length > 65536) throw new Error('표준 입력은 64KB 이하여야 합니다.');
      const { environmentReset, ...response } = await execute({ language: step.language, code: step.code, ...(buildOnly?{action:'build'}:inputIds.length?{stdin}:{}) }, buildOnly?undefined:onOutput);
      if (streamError) throw streamError;
      result = response;
      if (environmentReset) result.error = `${result.output || ''}\n실행 환경이 종료되어 변수와 함수가 초기화되었습니다.`.trim();
    }
    catch (error) { result = { output:streamed, error: [streamed,error?.message||'코드 실행에 실패했습니다.'].filter(Boolean).join('\n') }; }
    finally { if (timer !== null) clearTimeout(timer); }
    onStepResult({codeId:step.codeId, failed:Boolean(result.error || result.timedOut || result.exitCode !== 0), exitCode:result.exitCode, timedOut:Boolean(result.timedOut), detail:result.error || ((result.exitCode !== 0 || result.timedOut)?result.output:undefined)});
    for (const outputId of (buildOnly?[]:step.outputIds)) {
      outputs.set(outputId,[...(outputs.get(outputId)||[]),result]);
      publish(outputId, { codeId: step.codeId, result });
    }
    if (result.error || result.timedOut || result.exitCode !== 0) return { failed: true };
  }
  return { failed: false };
}
