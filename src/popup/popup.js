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
    for (const seg of document.querySelectorAll('.seg')) {
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
  for (const seg of document.querySelectorAll('.seg')) {
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

  render();
})();
