import { resolveBlueprint, resolveCode } from './blueprintGraph.js';
import { runBlueprint } from './runBlueprint.js';

export function createBlueprintStore({ getItems, execute, saveOutput }) {
  const states = new Map(), listeners = new Map();
  let active = null, disposed = false;
  const publish = (id, state) => { states.set(id, state); listeners.get(id)?.forEach(listener => listener()); };
  return {
    isRunning: () => Boolean(active),
    get: id => states.get(String(id)) || null,
    subscribe(id, listener) {
      id = String(id);
      if (!listeners.has(id)) listeners.set(id, new Set());
      listeners.get(id).add(listener);
      return () => { listeners.get(id)?.delete(listener); if (!listeners.get(id)?.size) listeners.delete(id); };
    },
    dispose() { disposed = true; },
    resume() { disposed = false; },
    async reset(id) {
      id = String(id);
      if (active || disposed) return;
      active = id;
      publish(id, { running: true });
      try {
        const result = await execute({ action: 'reset' });
        if (result?.reset !== true) throw new Error('실행 환경을 초기화하지 못했습니다.');
        // All executor objects share the same canvas environment.
        for (const key of states.keys()) publish(key, null);
        publish(id, { running: false, reset: true });
      } catch (error) { publish(id, { running: false, error: error.message }); }
      finally { active = null; }
    },
    runCode(id) { return this.run(id,{codeOnly:true}); },
    async run(id, {codeOnly=false}={}) {
      id = String(id);
      if (active || disposed) return;
      active = id;
      publish(id, { running: true });
      try {
        const items = getItems(), output = new Map(), resolve=codeOnly?resolveCode:resolveBlueprint;
        const runId = `${Date.now()}-${id}`;
        const outcome = await runBlueprint(items, id, async request => {
          if (disposed || !getItems()[id]) throw new Error(codeOnly?'코드 객체가 없어 실행을 중지했습니다.':'실행 객체가 없어 실행을 중지했습니다.');
          return execute(request);
        }, (outputId, entry) => {
          if (disposed) return;
          // Connections may be edited while the VM is running. Only outputs still
          // connected to this source receive the snapshot's result.
          const current = getItems();
          if (!resolve(current, id).find(step => step.codeId === entry.codeId)?.outputIds.includes(outputId)) return;
          const records = [...(output.get(outputId) || []), { runId, codeId: entry.codeId, createdAt: Date.now(), ...entry.result }];
          while (records.length > 32 || new TextEncoder().encode(JSON.stringify(records)).length > 524288) records.shift();
          output.set(outputId, records);
          if (!saveOutput(outputId, records)) throw new Error('실행 결과를 저장하지 못했습니다. 연결을 확인하세요.');
        },{codeOnly});
        publish(id, { running: false, completed: true, failed: outcome.failed, runId });
      } catch (error) { publish(id, { running: false, error: error.message }); }
      finally { active = null; }
    },
  };
}
