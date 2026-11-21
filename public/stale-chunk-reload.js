// Loaded as a classic script before the app so a stale deploy can recover.
// Kept out of index.html: the production CSP allows no inline scripts.
(() => {
  const reloadKey = 'agora:stale-vite-chunk-reload-at';
  window.addEventListener('vite:preloadError', (event) => {
    let lastReloadAt = 0;
    try {
      lastReloadAt = Number(sessionStorage.getItem(reloadKey)) || 0;
      if (Date.now() - lastReloadAt < 15000) return;
      sessionStorage.setItem(reloadKey, String(Date.now()));
    } catch {
      return;
    }
    event.preventDefault();
    window.location.reload();
  });
})();
