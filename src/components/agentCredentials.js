// Remove personal credentials saved by earlier versions of the canvas agent.
export function purgeAgentKeys() {
  try {
    sessionStorage.removeItem('agora-agent-personal-api-key');
    for (let index = sessionStorage.length - 1; index >= 0; index--) {
      const name = sessionStorage.key(index);
      if (name?.startsWith('agora-agent-api-key:') || name?.startsWith('agora-agent-cli-api-key:')) {
        sessionStorage.removeItem(name);
      }
    }
  } catch {
    /* Storage may be unavailable. */
  }
}
