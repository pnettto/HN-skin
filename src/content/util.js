(() => {
  const HNX = globalThis.HNX;

  // Tiny hyperscript helper: h('a', { class: 'x', href, onclick }, child, 'text', ...)
  HNX.h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : String(kid));
    }
    return el;
  };

  HNX.$ = (sel, root = document) => root.querySelector(sel);
  HNX.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // Lucide-style 24px stroke icons. Static, trusted markup only.
  const ICONS = {
    up: '<path d="M12 5.5 19 16H5z" fill="currentColor" stroke-width="1.5"/>',
    down: '<path d="M12 18.5 5 8h14z" fill="currentColor" stroke-width="1.5"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    comment: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    search: '<circle cx="11" cy="11" r="7.5"/><path d="m21 21-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    sepia: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    reply: '<path d="M9 17 4 12l5-5"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    parent: '<path d="M14 9 9 4 4 9"/><path d="M20 20h-7a4 4 0 0 1-4-4V4"/>',
    hide: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13 13 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    top: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    expand: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    logo: '<rect x="1.5" y="1.5" width="21" height="21" rx="6" fill="var(--hnx-accent)" stroke="none"/><path d="M12 6.5 17.5 15h-11z" fill="#fff" stroke="none"/>',
  };

  HNX.icon = (name, cls = '') => {
    const span = document.createElement('span');
    span.className = `hnx-icon ${cls}`.trim();
    span.setAttribute('aria-hidden', 'true');
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
    return span;
  };

  // HN ages look like "2026-10-26T08:46:09" (UTC) or "2026-10-26T08:46:09 1761468369".
  HNX.parseAge = (title) => {
    if (!title) return null;
    const [iso, unix] = title.trim().split(/\s+/);
    if (unix && /^\d+$/.test(unix)) return new Date(Number(unix) * 1000);
    const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
    return isNaN(d) ? null : d;
  };

  HNX.timeAgo = (date) => {
    if (!date) return '';
    const s = Math.max(0, (Date.now() - date.getTime()) / 1000);
    if (s < 60) return 'just now';
    const m = s / 60;
    if (m < 60) return `${Math.floor(m)}m ago`;
    const h = m / 60;
    if (h < 24) return `${Math.floor(h)}h ago`;
    const d = h / 24;
    if (d < 30) return `${Math.floor(d)}d ago`;
    if (d < 365) return `${Math.floor(d / 30)}mo ago`;
    return `${Math.floor(d / 365)}y ago`;
  };

  HNX.fullDate = (date) =>
    date ? date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';

  HNX.timeEl = (date, fallbackText, href) => {
    const props = {
      class: 'hnx-time',
      title: HNX.fullDate(date),
      datetime: date ? date.toISOString() : null,
    };
    const t = HNX.h('time', props, date ? HNX.timeAgo(date) : fallbackText || '');
    return href ? HNX.h('a', { class: 'hnx-time-link', href }, t) : t;
  };

  HNX.compactNumber = (n) => {
    if (n == null) return '';
    if (n < 1000) return String(n);
    return `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(/\.0$/, '')}k`;
  };

  HNX.isLoggedIn = () => !!document.getElementById('logout') || !!HNX.header?.logout;

  HNX.isTyping = (el) =>
    !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  // Moves the children of `from` into a new fragment.
  HNX.takeChildren = (from) => {
    const frag = document.createDocumentFragment();
    if (from) while (from.firstChild) frag.append(from.firstChild);
    return frag;
  };

  let toastTimer;
  HNX.toast = (msg) => {
    let t = document.querySelector('.hnx-toast');
    if (!t) {
      t = HNX.h('div', { class: 'hnx-toast', role: 'status', 'aria-live': 'polite' });
      document.body.append(t);
    }
    t.textContent = msg;
    t.classList.add('hnx-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('hnx-show'), 2200);
  };

  HNX.flash = (el) => {
    if (!el) return;
    el.classList.remove('hnx-flash');
    void el.offsetWidth;
    el.classList.add('hnx-flash');
  };
})();
