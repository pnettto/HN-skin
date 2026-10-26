(async () => {
  const HNX = globalThis.HNX;
  const root = document.documentElement;
  const { h } = HNX;

  const settings = await HNX.loadSettings();
  HNX.settings = settings;
  HNX.writeCachedPrefs(settings);

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      const patch = Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.newValue]));
      if ('enabled' in patch) {
        HNX.writeCachedPrefs({ ...HNX.settings, ...patch });
        location.reload();
        return;
      }
      HNX.updateSettings(patch);
    });
  } catch {}

  if (HNX.disabled === 'once' || !settings.enabled) return;
  if (HNX.disabled === 'prefs') {
    // Cache said "off" but the real setting is "on" (changed in another browser).
    location.reload();
    return;
  }

  const finish = () => {
    clearTimeout(HNX.loadingTimer);
    root.classList.remove('hnx-loading');
  };

  const original = document.querySelector('body > center') || document.getElementById('hnmain');
  const bigbox = document.getElementById('bigbox')?.querySelector(':scope > td') || null;

  try {
    // HN's stylesheet fights ours on every element; the new UI replaces it entirely.
    document.querySelectorAll('link[rel="stylesheet"][href*="news.css"]').forEach((l) => (l.disabled = true));
    HNX.applyPrefs(settings);

    const header = HNX.parse.header();
    HNX.header = header;
    const { app, main } = HNX.buildShell(header);

    let mode = null;
    if (bigbox) {
      const ctx = { main, header, bigbox };
      if (bigbox.querySelector('table.fatitem')) mode = await HNX.renderItem(ctx);
      else if (bigbox.querySelector('tr.athing .titleline')) mode = await HNX.renderList(ctx);
      else if (bigbox.querySelector('tr.athing .comhead')) mode = await HNX.renderCommentList(ctx);
    }

    if (!mode) {
      // Profiles, submit, login, FAQ…: keep HN's markup but skin it.
      main.textContent = '';
      const source = bigbox || (original ? null : document.body);
      const raw = h('div', { class: 'hnx-raw hnx-card' });
      if (source) {
        for (const node of Array.from(source.childNodes)) if (node !== app) raw.append(node);
      } else if (original) {
        raw.append(...Array.from(original.querySelectorAll('#hnmain > tbody > tr, #hnmain > tr')).slice(1).flatMap((tr) => Array.from(tr.childNodes)));
      }
      main.append(raw);
      main.classList.add('hnx-main-raw');
    }

    document.body.prepend(app);
    original?.remove();
    root.classList.add('hnx-built');
    if (mode) HNX.keys.init(mode);
    HNX.loadFavicons();
    if (mode === 'comments') root.classList.add('hnx-page-comments');

    // Honour #<comment-id> deep links now that the ids live on our elements.
    const hash = decodeURIComponent(location.hash.slice(1));
    const target = hash ? document.getElementById(hash) : null;
    if (target?.classList.contains('hnx-comment')) {
      requestAnimationFrame(() => HNX.keys.gotoComment(target));
    } else if (target) {
      target.scrollIntoView();
    }
  } catch (err) {
    console.error('[HN Skin] render failed, falling back to the original page', err);
    try {
      sessionStorage.setItem('hnx:off-once', '1');
    } catch {}
    location.reload();
    return;
  } finally {
    finish();
  }
})();
