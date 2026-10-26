// Runs at document_start: paint the right background immediately and hide HN's
// original layout until the new one is built, so there is no flash of old styles.
(() => {
  const HNX = globalThis.HNX;
  const root = document.documentElement;

  // A failed render sets this flag and reloads, so the page falls back to plain HN once.
  let skipOnce = false;
  try {
    skipOnce = sessionStorage.getItem('hnx:off-once') === '1';
    sessionStorage.removeItem('hnx:off-once');
  } catch {}

  const prefs = HNX.readCachedPrefs();
  if (skipOnce || !prefs.enabled) {
    HNX.disabled = skipOnce ? 'once' : 'prefs';
    return;
  }

  root.classList.add('hnx', 'hnx-loading');
  HNX.applyPrefs(prefs, root);

  // Safety net: never leave the page blank if something goes wrong later.
  HNX.loadingTimer = setTimeout(() => root.classList.remove('hnx-loading'), 2500);
})();
