import { resolveBlueprint, resolveCode } from './blueprintGraph.js';
import { contentSource } from '../content/contentPresentation.js';
import { runBlueprint } from './runBlueprint.js';

export function createBlueprintStore({ getItems, execute, saveOutput }) {
  const states = new Map(), listeners = new Map();
  let active = null, disposed = false, activity = null;
  const activityListeners = new Set();
  const setActivity = value => { activity = value; activityListeners.forEach(listener => listener()); };
  const publish = (id, state) => { states.set(id, state); listeners.get(id)?.forEach(listener => listener()); };
  return {
    isRunning: () => Boolean(active),
    getActivity: () => activity,
    dismissActivity() { if (!active) setActivity(null); },
    subscribeActivity(listener) { activityListeners.add(listener); return () => activityListeners.delete(listener); },
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
      setActivity({id, startedAt: Date.now(), phase: "reset", status:"running"});
      try {
        const result = await execute({ action: 'reset' });
        if (result?.reset !== true) throw new Error('실행 환경을 초기화하지 못했습니다.');
        // All executor objects share the same canvas environment.
        for (const key of states.keys()) publish(key, null);
        publish(id, { running: false, reset: true });
        setActivity({...activity,status:"success",endedAt:Date.now()});
      } catch (error) { publish(id, { running: false, error: error.message }); setActivity({...activity,status:"error",error:error.message,endedAt:Date.now()}); }
      finally { active = null; }
    },
    runCode(id) { return this.run(id,{codeOnly:true}); },
    build(id) { return this.run(id,{buildOnly:true}); },
    buildCode(id) { return this.run(id,{codeOnly:true,buildOnly:true}); },
    async run(id, {codeOnly=false,buildOnly=false}={}) {
      id = String(id);
      if (active || disposed) return;
      active = id;
      publish(id, { running: true, building: buildOnly });
      const startedAt = Date.now();
      const phase=buildOnly?"build":"run";
      let steps=[];
      setActivity({id, startedAt, phase: buildOnly?"build":"run", status:"running", entries:[]});
      try {
        const items = getItems(), output = new Map(), resolve=codeOnly?resolveCode:resolveBlueprint;
        const runId = `${Date.now()}-${id}`;
        steps=resolve(items,id);
        for(const step of steps) publish(step.codeId,{running:false,status:'queued',phase,source:contentSource(items[step.codeId]),language:items[step.codeId].language||'javascript'});
        const outcome = await runBlueprint(items, id, async (request, onOutput) => {
          if (disposed || !getItems()[id]) throw new Error(codeOnly?'코드 객체가 없어 실행을 중지했습니다.':'실행 객체가 없어 실행을 중지했습니다.');
          return execute(typeof onOutput==='function'?{...request,onOutput}:request);
        }, (outputId, entry) => {
          if (disposed) return;
          // Connections may be edited while the VM is running. Only outputs still
          // connected to this source receive the snapshot's result.
          const current = getItems();
          if (!resolve(current, id).find(step => step.codeId === entry.codeId)?.outputIds.includes(outputId)) return;
          const previous = output.get(outputId) || [];
          const existing = previous.find(record => record.runId === runId && record.codeId === entry.codeId);
          const record = {runId, codeId:entry.codeId, createdAt:existing?.createdAt??Date.now(), ...entry.result};
          const records = existing ? previous.map(value => value===existing?record:value) : [...previous,record];
          while (records.length > 32 || new TextEncoder().encode(JSON.stringify(records)).length > 524288) records.shift();
          output.set(outputId, records);
          if (!saveOutput(outputId, records)) throw new Error('실행 결과를 저장하지 못했습니다. 연결을 확인하세요.');
        },{codeOnly,buildOnly,
          onStep: step => {
            publish(step.codeId,{...states.get(step.codeId),running:true,status:'running'});
            setActivity({id, startedAt, phase, status:"running", ...step, entries:[...(activity?.entries||[]),{...step,status:"running"}]});
          },
          onStepResult: result => {
            publish(result.codeId,{...states.get(result.codeId),...result,running:false,completed:true,status:result.failed?'error':'success',detail:result.detail?.slice(-12000)});
            setActivity({...activity, entries:activity.entries.map(entry=>entry.codeId===result.codeId?{...entry,...result,detail:result.detail?.slice(-800),status:result.failed?"error":"success"}:entry)});
          }
        });
        for(const step of steps) if(states.get(step.codeId)?.status==='queued') publish(step.codeId,{...states.get(step.codeId),status:'skipped'});
        publish(id, { ...states.get(id), running: false, status:outcome.failed?'error':'success', completed: true, built: buildOnly, failed: outcome.failed, runId });
        setActivity({...activity,status:outcome.failed?"error":"success",endedAt:Date.now()});
      } catch (error) {
        for(const step of steps){
          const state=states.get(step.codeId);
          if(state?.status==='queued'||state?.status==='running')publish(step.codeId,{...state,running:false,status:state.status==='running'?'error':'skipped',detail:state.status==='running'?error.message:undefined});
        }
        publish(id, { ...states.get(id), ...(codeOnly&&getItems()[id]?{source:contentSource(getItems()[id]),language:getItems()[id].language||'javascript',phase}:{}), running: false, status:'error', error: error.message });
        setActivity({...activity,status:"error",error:error.message,endedAt:Date.now()});
      }
      finally { active = null; }
    },
  };
}
