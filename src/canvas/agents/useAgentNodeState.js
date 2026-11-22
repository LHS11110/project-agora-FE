import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';

const AGENT_RUNTIME_TTL_MS = 120_000;

export function useAgentNodeState(id, item, store) {
  const subscribe = useCallback(listener => (store ? store.subscribeNode(id, listener) : () => {}), [store, id]);
  const snapshot = useCallback(() => store?.getNodeState(id) || item?.runtimeState || null, [store, id, item?.runtimeState]);
  const state = useSyncExternalStore(subscribe, snapshot, () => null);
  const [clock, setClock] = useState(0);

  useEffect(() => {
    if (!state?.running || !Number.isFinite(state.updatedAt)) return undefined;
    const delay = Math.max(0, state.updatedAt + AGENT_RUNTIME_TTL_MS - Date.now());
    const timer = setTimeout(() => setClock(n => n + 1), delay);
    return () => clearTimeout(timer);
  }, [state]);

  return useMemo(() => {
    if (state?.running && Number.isFinite(state.updatedAt) && Date.now() - state.updatedAt >= AGENT_RUNTIME_TTL_MS) {
      return {
        ...state,
        running: false,
        status: 'error',
        failed: true,
        error: '실행 상태가 만료되었습니다. 다시 실행할 수 있습니다.',
      };
    }
    return state;
  }, [state, clock]);
}
