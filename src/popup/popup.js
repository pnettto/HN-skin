(async () => {
  const HNX = globalThis.HNX;
  let s = await HNX.loadSettings();
  const $ = (sel) => document.querySelector(sel);

  const accents = $('#accents');
  for (const color of HNX.ACCENTS) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.style.setProperty('--c', color);
    b.title = color;
    b.setAttribute('aria-label', `Accent ${color}`);
    b.addEventListener('click', () => save({ accent: color }));
    accents.append(b);
  }

  const render = () => {
    document.body.style.setProperty('--accent', s.accent);
    document.body.classList.toggle('off', !s.enabled);
    $('#enabled').checked = s.enabled;
    for (const seg of document.querySelectorAll('.seg[data-key]')) {
      for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(s[seg.dataset.key] === b.value));
    }
    for (const b of accents.children) b.setAttribute('aria-pressed', String(b.title.toLowerCase() === s.accent.toLowerCase()));
    $('#fontSize').value = s.fontSize;
    $('#fontSizeOut').textContent = `${s.fontSize}px`;
    for (const cb of document.querySelectorAll('.toggles input')) cb.checked = !!s[cb.dataset.key];
  };

  const save = (patch) => {
    s = { ...s, ...patch };
    render();
    HNX.saveSettings(patch);
  };

  $('#enabled').addEventListener('change', (e) => save({ enabled: e.target.checked }));
  for (const seg of document.querySelectorAll('.seg[data-key]')) {
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) save({ [seg.dataset.key]: b.value });
    });
  }
  $('#fontSize').addEventListener('input', (e) => save({ fontSize: Number(e.target.value) }));
  for (const cb of document.querySelectorAll('.toggles input')) {
    cb.addEventListener('change', () => save({ [cb.dataset.key]: cb.checked }));
  }
  $('#reset').addEventListener('click', () => save({ ...HNX.DEFAULTS }));

  // AI provider settings stay in storage.local so the key is never synced.
  let ai = { provider: '', keys: {}, models: {} };
  try {
    ai = { ...ai, ...(await chrome.storage.local.get('ai')).ai };
  } catch {}

  const renderAi = () => {
    const p = ai.provider;
    for (const b of $('#aiProvider').children) b.setAttribute('aria-pressed', String(b.value === p));
    $('#aiFields').hidden = !p;
    $('#aiKey').value = ai.keys[p] || '';
    $('#aiModel').value = ai.models[p] || '';
    $('#aiModel').placeholder = `Model (default ${HNX.AI_MODELS[p] || ''})`;
  };

  const saveAi = (patch) => {
    ai = { ...ai, ...patch };
    renderAi();
    chrome.storage.local.set({ ai });
  };

  $('#aiProvider').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) saveAi({ provider: b.value });
  });
  $('#aiKey').addEventListener('change', (e) => saveAi({ keys: { ...ai.keys, [ai.provider]: e.target.value.trim() } }));
  $('#aiModel').addEventListener('change', (e) => saveAi({ models: { ...ai.models, [ai.provider]: e.target.value.trim() } }));

  render();
  renderAi();
})();
