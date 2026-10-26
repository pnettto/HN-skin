(() => {
  const HNX = globalThis.HNX;
  const { h, icon } = HNX;

  const NAV = [
    { href: 'news', text: 'Top', ops: ['news', ''] },
    { href: 'newest', text: 'New', ops: ['newest'] },
    { href: 'best', text: 'Best', ops: ['best'] },
    { href: 'ask', text: 'Ask', ops: ['ask'] },
    { href: 'show', text: 'Show', ops: ['show', 'shownew'] },
    { href: 'jobs', text: 'Jobs', ops: ['jobs'] },
    { href: 'front', text: 'Past', ops: ['front'] },
    { href: 'newcomments', text: 'Comments', ops: ['newcomments'] },
  ];

  const THEME_ICON = { auto: 'auto', light: 'sun', dark: 'moon', sepia: 'sepia' };

  HNX.openTarget = () => (HNX.settings.newTab ? '_blank' : null);

  /* ---------- Shell ---------- */

  HNX.buildShell = (header) => {
    const op = header.op;
    const extraNav = header.nav.filter(
      (n) => !NAV.some((x) => x.href === n.href) && n.href && !/^submit/.test(n.href),
    );
    const navItems = [
      ...NAV.map((n) => ({ ...n, active: n.ops.includes(op) && location.pathname !== '/item' })),
      ...extraNav.map((n) => ({ href: n.href, text: cap(n.text), active: n.active })),
    ];

    const themeBtn = h(
      'button',
      { class: 'hnx-iconbtn hnx-theme-btn', type: 'button', title: 'Theme (t)', 'aria-label': 'Change theme', onclick: () => HNX.cycleTheme() },
      icon(THEME_ICON[HNX.settings.theme] || 'auto'),
    );

    const search = h(
      'form',
      { class: 'hnx-search', action: 'https://hn.algolia.com/', method: 'get', role: 'search' },
      icon('search'),
      h('input', { type: 'search', name: 'q', placeholder: 'Search', 'aria-label': 'Search Hacker News', autocomplete: 'off', spellcheck: 'false' }),
      h('kbd', { class: 'hnx-kbd' }, '/'),
    );

    const account = header.user
      ? h(
          'div',
          { class: 'hnx-account' },
          h('a', { class: 'hnx-user-chip', href: header.user.href, title: 'Your profile' },
            h('span', { class: 'hnx-avatar' }, header.user.name.slice(0, 1).toUpperCase()),
            h('span', { class: 'hnx-user-name' }, header.user.name),
            header.user.karma && h('span', { class: 'hnx-karma' }, header.user.karma),
          ),
          header.logout && h('a', { class: 'hnx-textbtn hnx-logout', href: header.logout }, 'Log out'),
        )
      : h('a', { class: 'hnx-textbtn', href: header.login || `login?goto=${encodeURIComponent(location.pathname.slice(1) + location.search)}` }, 'Log in');

    const progress = h('div', { class: 'hnx-progress', 'aria-hidden': 'true' }, h('span'));

    const topbar = h(
      'header',
      { class: 'hnx-topbar' },
      h(
        'div',
        { class: 'hnx-topbar-inner' },
        h('a', { class: 'hnx-brand', href: 'news', title: 'Hacker News' }, icon('logo', 'hnx-logo'), h('span', { class: 'hnx-brand-text' }, 'Hacker News')),
        h('nav', { class: 'hnx-nav', 'aria-label': 'Sections' },
          navItems.map((n) => h('a', { href: n.href, class: n.active ? 'hnx-active' : null, 'aria-current': n.active ? 'page' : null }, n.text)),
        ),
        h('div', { class: 'hnx-top-actions' },
          search,
          h('a', { class: 'hnx-iconbtn hnx-search-mobile', href: 'https://hn.algolia.com/', title: 'Search', 'aria-label': 'Search' }, icon('search')),
          h('a', { class: 'hnx-submit', href: 'submit', rel: 'nofollow' }, icon('plus'), h('span', null, 'Submit')),
          themeBtn,
          h('button', { class: 'hnx-iconbtn hnx-help-btn', type: 'button', title: 'Keyboard shortcuts (?)', 'aria-label': 'Keyboard shortcuts', onclick: () => HNX.toggleHelp() }, icon('keyboard')),
          account,
        ),
      ),
      progress,
    );

    const main = h('main', { class: 'hnx-main', id: 'hnx-main' });

    const yc = Array.from(document.querySelectorAll('.yclinks a')).map((a) =>
      h('a', { href: a.getAttribute('href') }, a.textContent.trim()),
    );
    const footer = h(
      'footer',
      { class: 'hnx-footer' },
      h('nav', { class: 'hnx-footer-links' }, yc.length ? yc : [h('a', { href: 'newsguidelines.html' }, 'Guidelines'), h('a', { href: 'newsfaq.html' }, 'FAQ')]),
      h('p', { class: 'hnx-footer-note' }, 'Reading with HN Skin · press ', h('kbd', { class: 'hnx-kbd' }, '?'), ' for shortcuts'),
    );

    const toTop = h(
      'button',
      { class: 'hnx-totop', type: 'button', title: 'Back to top', 'aria-label': 'Back to top', onclick: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
      icon('top'),
    );

    const app = h('div', { class: 'hnx-app' }, h('a', { class: 'hnx-skip', href: '#hnx-main' }, 'Skip to content'), topbar, main, footer, toTop);

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const max = document.documentElement.scrollHeight - innerHeight;
        progress.firstChild.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
        topbar.classList.toggle('hnx-scrolled', scrollY > 4);
        toTop.classList.toggle('hnx-show', scrollY > innerHeight * 1.5);
      });
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return { app, main, topbar };
  };

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  HNX.cycleTheme = async () => {
    const i = HNX.THEMES.indexOf(HNX.settings.theme);
    const theme = HNX.THEMES[(i + 1) % HNX.THEMES.length];
    HNX.updateSettings({ theme });
    HNX.toast(`Theme: ${cap(theme)}`);
    HNX.saveSettings({ theme });
  };

  HNX.updateSettings = (patch) => {
    Object.assign(HNX.settings, patch);
    HNX.applyPrefs(HNX.settings);
    HNX.writeCachedPrefs(HNX.settings);
    const btn = document.querySelector('.hnx-theme-btn');
    if (btn) btn.replaceChildren(icon(THEME_ICON[HNX.settings.theme] || 'auto'));
    if (patch.favicons) HNX.loadFavicons();
    if ('newTab' in patch) {
      for (const a of document.querySelectorAll('a.hnx-title, .hnx-hero-title a')) {
        if (a.dataset.external) a.target = patch.newTab ? '_blank' : '';
      }
    }
  };

  /* ---------- Votes ---------- */

  // Sends a vote the same way HN's own hn.js does. Logged-out links have no auth
  // token, so we navigate to them instead (HN shows its login page).
  HNX.sendVote = async (voteHref, how) => {
    const url = new URL(voteHref, location.href);
    if (!url.searchParams.get('auth')) {
      location.href = url.href;
      return false;
    }
    url.searchParams.set('how', how);
    url.searchParams.set('js', 't');
    const res = await fetch(url.href, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(`vote failed: ${res.status}`);
    return true;
  };

  // item: { id, upHref, downHref, voted, score? }. Returns { el, vote(how) }.
  HNX.voteControl = (item, { layout = 'stack' } = {}) => {
    let state = item.voted || null;
    let score = item.score;
    const scoreEl = item.score != null ? h('span', { class: 'hnx-score', title: `${item.score} points` }, HNX.compactNumber(item.score)) : null;

    const up = item.upHref
      ? h('button', { class: 'hnx-vote-btn hnx-up', type: 'button', title: 'Upvote (u)', 'aria-label': 'Upvote', 'aria-pressed': 'false' }, icon('up'))
      : null;
    const down = item.downHref
      ? h('button', { class: 'hnx-vote-btn hnx-down', type: 'button', title: 'Downvote', 'aria-label': 'Downvote', 'aria-pressed': 'false' }, icon('down'))
      : null;

    const el = h('div', { class: `hnx-vote hnx-vote-${layout}` }, up, scoreEl, down);
    if (!up && !down && !scoreEl) el.classList.add('hnx-vote-empty');

    const render = () => {
      el.dataset.voted = state || '';
      up?.setAttribute('aria-pressed', String(state === 'up'));
      down?.setAttribute('aria-pressed', String(state === 'down'));
      if (up) up.title = state === 'up' ? 'Unvote (u)' : 'Upvote (u)';
      if (scoreEl && score != null) scoreEl.textContent = HNX.compactNumber(score);
    };

    const vote = async (how) => {
      const href = item.upHref || item.downHref;
      if (!href) return;
      const prev = state;
      const prevScore = score;
      const next = state === how ? null : how;
      if (prev === 'up' && score != null) score -= 1;
      if (next === 'up' && score != null) score += 1;
      state = next;
      render();
      try {
        // Switching directly between up and down requires an unvote first.
        if (prev && next) await HNX.sendVote(href, 'un');
        const ok = await HNX.sendVote(href, next || 'un');
        if (ok && next === 'up') HNX.flash(up);
      } catch {
        state = prev;
        score = prevScore;
        render();
        HNX.toast('Vote failed. Try again?');
      }
    };

    up?.addEventListener('click', (e) => { e.stopPropagation(); vote('up'); });
    down?.addEventListener('click', (e) => { e.stopPropagation(); vote('down'); });
    render();
    el.hnxVote = vote;
    return { el, vote };
  };

  /* ---------- Composer ---------- */

  // Rebuilds HN's comment form with nicer UI, keeping its hidden inputs (parent, goto, hmac).
  HNX.composer = (origForm, { placeholder = 'Write a reply…', submitLabel = 'Reply', collapsed = false, onCancel } = {}) => {
    const action = origForm.getAttribute('action') || 'comment';
    const origText = origForm.querySelector('textarea');
    const form = h('form', { class: 'hnx-composer', method: 'post', action });
    for (const input of origForm.querySelectorAll('input[type="hidden"]')) {
      form.append(h('input', { type: 'hidden', name: input.name, value: input.value }));
    }
    const ta = h('textarea', { name: origText?.name || 'text', placeholder, rows: '4', required: true });
    if (origText?.value) ta.value = origText.value;
    const submit = h('button', { class: 'hnx-btn hnx-btn-primary', type: 'submit' }, submitLabel);
    const cancel = onCancel ? h('button', { class: 'hnx-btn', type: 'button', onclick: onCancel }, 'Cancel') : null;
    const bar = h(
      'div',
      { class: 'hnx-composer-bar' },
      h('span', { class: 'hnx-composer-hint' }, h('a', { href: 'formatdoc', target: '_blank', rel: 'noopener' }, 'Formatting help'), ' · ', h('kbd', { class: 'hnx-kbd' }, navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'), h('kbd', { class: 'hnx-kbd' }, '↵'), ' to send'),
      h('span', { class: 'hnx-composer-buttons' }, cancel, submit),
    );
    form.append(ta, bar);

    const autosize = () => {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight + 2, innerHeight * 0.6)}px`;
    };
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (ta.value.trim()) form.requestSubmit(submit);
      } else if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    });
    form.addEventListener('submit', () => {
      submit.disabled = true;
      submit.textContent = 'Sending…';
    });

    if (collapsed) {
      form.classList.add('hnx-composer-collapsed');
      ta.rows = 1;
      ta.addEventListener('focus', () => {
        form.classList.remove('hnx-composer-collapsed');
        ta.rows = 4;
      });
    }
    form.focusInput = () => {
      ta.focus();
      autosize();
    };
    return form;
  };

  /* ---------- Help overlay ---------- */

  const SHORTCUTS = {
    Everywhere: [['?', 'Show / hide this help'], ['/', 'Search'], ['t', 'Cycle theme'], ['Esc', 'Close / clear focus']],
    'Story lists': [['j  k', 'Next / previous story'], ['o  ↵', 'Open link'], ['c', 'Open comments'], ['u', 'Upvote'], ['n', 'Next page'], ['[  ]', 'Previous / next day (Past)']],
    Comments: [
      ['j  k', 'Next / previous comment'],
      ['J  K', 'Next / previous sibling'],
      ['p', 'Go to parent'],
      ['x  ↵', 'Collapse / expand'],
      ['n', 'Next new comment'],
      ['u', 'Upvote'],
      ['r', 'Reply'],
      ['o', 'Open story link'],
      ['T', 'Toggle top-level only'],
    ],
  };

  HNX.toggleHelp = (force) => {
    let dlg = document.querySelector('.hnx-help');
    if (!dlg) {
      dlg = h(
        'div',
        { class: 'hnx-help', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Keyboard shortcuts', onclick: (e) => e.target === dlg && HNX.toggleHelp(false) },
        h(
          'div',
          { class: 'hnx-help-card' },
          h('div', { class: 'hnx-help-head' }, h('h2', null, 'Keyboard shortcuts'), h('button', { class: 'hnx-iconbtn', type: 'button', 'aria-label': 'Close', onclick: () => HNX.toggleHelp(false) }, '✕')),
          h(
            'div',
            { class: 'hnx-help-grid' },
            Object.entries(SHORTCUTS).map(([group, rows]) =>
              h('section', null, h('h3', null, group), h('dl', null, rows.map(([k, d]) => [h('dt', null, k.split('  ').map((x) => h('kbd', { class: 'hnx-kbd' }, x))), h('dd', null, d)]))),
            ),
          ),
          !HNX.settings.keyboard && h('p', { class: 'hnx-help-note' }, 'Shortcuts are currently turned off in the HN Skin popup.'),
        ),
      );
      document.body.append(dlg);
    }
    const open = force ?? !dlg.classList.contains('hnx-show');
    dlg.classList.toggle('hnx-show', open);
  };

  /* ---------- Small pieces ---------- */

  HNX.userLink = (item, { op, me } = {}) =>
    h(
      'a',
      { class: `hnx-user${item.newUser ? ' hnx-newuser' : ''}`, href: item.userHref, title: item.newUser ? 'New account' : null },
      item.user,
      op && h('span', { class: 'hnx-badge hnx-badge-op', title: 'Original poster' }, 'OP'),
      me && h('span', { class: 'hnx-badge hnx-badge-me' }, 'you'),
    );

  // A coloured monogram first; HNX.loadFavicons() swaps in the real icon when it arrives.
  HNX.favicon = (host) => {
    if (!host) return null;
    let hash = 0;
    for (const ch of host) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return h('span', { class: 'hnx-favicon', 'aria-hidden': 'true', dataset: { host }, style: `--hue: ${Math.abs(hash) % 360}` }, host.charAt(0).toUpperCase());
  };

  HNX.loadFavicons = async () => {
    if (!HNX.settings.favicons) return;
    const els = HNX.$$('.hnx-favicon[data-host]:not(.hnx-fav-done)');
    const hosts = [...new Set(els.map((el) => el.dataset.host))];
    if (!hosts.length) return;
    let icons;
    try {
      icons = await chrome.runtime.sendMessage({ type: 'favicons', hosts });
    } catch {
      return;
    }
    const bitmaps = {};
    await Promise.all(
      hosts.map(async (host) => {
        if (!icons?.[host]) return;
        try {
          const bytes = Uint8Array.from(atob(icons[host]), (c) => c.charCodeAt(0));
          bitmaps[host] = await createImageBitmap(new Blob([bytes]));
        } catch {}
      }),
    );
    for (const el of els) {
      el.classList.add('hnx-fav-done');
      const bmp = bitmaps[el.dataset.host];
      if (!bmp) continue;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 32;
      const g = canvas.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(bmp, 0, 0, 32, 32);
      el.replaceChildren(canvas);
      el.classList.add('hnx-fav-img');
    }
  };

  // "Show HN: Foo (2019) [pdf]" -> chips + clean title
  HNX.splitTitle = (title) => {
    const chips = [];
    let t = title;
    const pre = t.match(/^(Ask|Show|Tell|Launch) HN\s*[:–-]\s*/i);
    if (pre) {
      chips.push({ text: `${cap(pre[1].toLowerCase())} HN`, kind: pre[1].toLowerCase() });
      t = t.slice(pre[0].length);
    }
    for (let guard = 0; guard < 3; guard++) {
      const m = t.match(/\s*(\[(pdf|video|audio|slides|flagged|dupe|dead)\]|\((\d{4})\))\s*$/i);
      if (!m) break;
      chips.push({ text: m[2] ? m[2].toLowerCase() : m[3], kind: m[2] ? 'media' : 'year' });
      t = t.slice(0, m.index);
    }
    if (/\(YC [A-Z]\d{2}\) is hiring/i.test(t)) chips.push({ text: 'Hiring', kind: 'job' });
    return { title: t, chips };
  };

  HNX.chip = (c) => h('span', { class: `hnx-chip hnx-chip-${c.kind}` }, c.text);
})();
