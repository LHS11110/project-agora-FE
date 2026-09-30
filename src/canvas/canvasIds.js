export const createId = () => globalThis.crypto?.randomUUID?.()
  || `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
