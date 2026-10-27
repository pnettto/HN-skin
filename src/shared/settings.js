// Shared between the content scripts and the popup.
(() => {
  const HNX = (globalThis.HNX = globalThis.HNX || {});

  HNX.DEFAULTS = Object.freeze({
    enabled: true,
    theme: 'auto', // auto | light | dark | sepia
    font: 'sans', // sans | serif
    fontSize: 16, // px, 14–20
    width: 'medium', // narrow | medium | wide
    accent: '#ff6600',
    favicons: true,
    newTab: false,
    dimRead: true,
    highlightNew: true,
    keyboard: true,
  });

  HNX.WIDTHS = { narrow: '680px', medium: '780px', wide: '960px' };
  HNX.THEMES = ['auto', 'light', 'dark', 'sepia'];
  // AI topic labels. Provider config lives in chrome.storage.local under `ai`
  // ({ provider, keys: { [provider]: key }, models: { [provider]: model } }) so the key never syncs.
  HNX.AI_MODELS = { openai: 'gpt-5-nano', deepseek: 'deepseek-chat', anthropic: 'claude-haiku-5-5' };
  HNX.TOPICS = [
    { id: 'ai', label: 'AI', hint: 'machine learning, LLMs, AI products and research' },
    { id: 'programming', label: 'Programming', hint: 'languages, tools, libraries, software engineering' },
    { id: 'tech', label: 'Tech', hint: 'tech companies, gadgets, hardware, the internet, open source projects' },
    { id: 'science', label: 'Science', hint: 'physics, biology, space, math, medicine, climate' },
    { id: 'security', label: 'Security', hint: 'vulnerabilities, privacy, hacking, surveillance' },
    { id: 'business', label: 'Business', hint: 'startups, finance, economics, careers, hiring' },
    { id: 'politics', label: 'Politics', hint: 'government, law, regulation, policy, world news' },
    { id: 'philosophy', label: 'Philosophy', hint: 'ethics, mind, meaning, reflective essays on life and work' },
    { id: 'history', label: 'History', hint: 'past events, people and technology from history' },
    { id: 'culture', label: 'Culture', hint: 'books, art, music, games, film, society' },
    { id: 'other', label: 'Other', hint: 'anything that fits none of the above' },
  ];

  HNX.ACCENTS = ['#ff6600', '#e5484d', '#d6409f', '#8e4ec6', '#3e63dd', '#0090ff', '#12a594', '#30a46c'];

  const CACHE_KEY = 'hnx:prefs';

  HNX.loadSettings = () =>
    new Promise((resolve) => {
      try {
        chrome.storage.sync.get(HNX.DEFAULTS, (s) => resolve({ ...HNX.DEFAULTS, ...s }));
      } catch {
        resolve({ ...HNX.DEFAULTS });
      }
    });

  HNX.saveSettings = (patch) =>
    new Promise((resolve) => {
      try {
        chrome.storage.sync.set(patch, resolve);
      } catch {
        resolve();
      }
    });

  // Applies visual preferences to <html>. Cheap and synchronous so it can run at document_start.
  HNX.applyPrefs = (s, root = document.documentElement) => {
    root.dataset.hnxTheme = s.theme;
    root.dataset.hnxFont = s.font;
    root.style.setProperty('--hnx-font-size', `${s.fontSize}px`);
    root.style.setProperty('--hnx-width', HNX.WIDTHS[s.width] || HNX.WIDTHS.medium);
    root.style.setProperty('--hnx-accent', s.accent);
    root.classList.toggle('hnx-no-favicons', !s.favicons);
    root.classList.toggle('hnx-no-dim', !s.dimRead);
  };

  HNX.readCachedPrefs = () => {
    try {
      return { ...HNX.DEFAULTS, ...JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') };
    } catch {
      return { ...HNX.DEFAULTS };
    }
  };

  HNX.writeCachedPrefs = (s) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(s));
    } catch {}
  };
})();
