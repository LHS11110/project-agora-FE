import { contentMode, isTextContent } from '../content/contentPresentation.js';
export const isBlueprintCode = item => isTextContent(item) && contentMode(item) === 'code';
export const isBlueprintNode = item => item?.kind === 'shape' && ['executor', 'output'].includes(item.runtimeRole);

/** Directed control flow is a DAG; output nodes may forward to more output nodes. */
export function resolveBlueprint(items, executorId) { return resolveGraph(items,executorId,false); }
export function resolveCode(items, codeId) { return resolveGraph(items,codeId,true); }

function resolveGraph(items, executorId, codeOnly) {
  executorId = String(executorId);
  if (codeOnly ? !isBlueprintCode(items[executorId]) : items[executorId]?.runtimeRole !== 'executor') throw new Error(codeOnly?'코드 객체가 필요합니다.':'실행 객체가 필요합니다.');
  const adjacent = new Map();
  for (const [, edge] of Object.entries(items).filter(([, item]) => item?.kind === 'connector').sort(([a], [b]) => a.localeCompare(b))) {
    const from = String(edge.from), to = String(edge.to), source = items[from], target = items[to];
    const allowed = (!codeOnly && (from === executorId || isBlueprintCode(source)) && isBlueprintCode(target))
      || ((isBlueprintCode(source) || source?.runtimeRole === 'output') && target?.runtimeRole === 'output');
    if (allowed) {
      if (!adjacent.has(from)) adjacent.set(from, new Set());
      adjacent.get(from).add(to);
    }
  }
  const visiting = new Set(), visited = new Set(), rank = new Map();
  const visit = id => {
    if (visiting.has(id)) throw new Error('블루프린트에 순환 연결이 있습니다.');
    if (visited.has(id)) return;
    if (visited.size + visiting.size >= 256) throw new Error('블루프린트는 한 번에 256개 객체까지 실행할 수 있습니다.');
    rank.set(id, rank.size);
    visiting.add(id);
    for (const next of adjacent.get(id) || []) visit(next);
    visiting.delete(id); visited.add(id);
  };
  visit(executorId);
  const degree = new Map([...visited].map(id => [id, 0]));
  for (const id of visited) for (const next of adjacent.get(id) || []) degree.set(next, degree.get(next) + 1);
  const queue = [...visited].filter(id => degree.get(id) === 0), order = [];
  while (queue.length) {
    queue.sort((a, b) => rank.get(a) - rank.get(b));
    const id = queue.shift(); order.push(id);
    for (const next of adjacent.get(id) || []) { degree.set(next, degree.get(next) - 1); if (!degree.get(next)) queue.push(next); }
  }
  const codes = order.filter(id => isBlueprintCode(items[id]));
  if (codes.length > 32) throw new Error('한 번에 실행할 코드 객체는 32개 이하여야 합니다.');
  return codes.map(codeId => {
    const outputIds = new Set();
    const collect = id => {
      for (const next of adjacent.get(id) || []) if (items[next]?.runtimeRole === 'output' && !outputIds.has(next)) {
        outputIds.add(next); collect(next);
      }
    };
    collect(codeId);
    return { codeId, outputIds: [...outputIds] };
  });
}
