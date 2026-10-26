(() => {
  const HNX = globalThis.HNX;
  const { h, icon } = HNX;

  const PAGE_TITLES = {
    news: 'Top stories',
    newest: 'New',
    best: 'Best',
    ask: 'Ask HN',
    show: 'Show HN',
    shownew: 'Show HN · new',
    jobs: 'Jobs',
    front: 'Past',
    active: 'Active',
    noobstories: 'New accounts',
    from: 'Stories from',
    favorites: 'Favorites',
    upvoted: 'Upvoted',
    submitted: 'Submissions',
    hidden: 'Hidden',
    flagged: 'Flagged',
  };

  // Rows in the story table that are neither stories nor pagination (e.g. the
  // "Please read the Show HN rules" notice or the "Go back a day" links on /front).
  const collectNotices = (table) => {
    const out = [];
    for (const tr of table.querySelectorAll(':scope > tbody > tr, :scope > tr')) {
      if (tr.classList.contains('athing') || tr.classList.contains('spacer') || tr.classList.contains('morespace')) continue;
      if (tr.querySelector('.subtext, .morelink')) continue;
      if (!tr.textContent.trim()) continue;
      const cells = [...tr.cells].filter((td) => td.textContent.trim());
      if (cells.length) out.push(h('div', { class: 'hnx-notice' }, cells.map((td) => HNX.takeChildren(td))));
    }
    return out;
  };

  /* ---------- Past: day navigator ---------- */

  const HN_LAUNCH = '2007-02-19';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // All date math happens on UTC midnights so time zones never shift a day.
  const parseIso = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  };
  const toIso = (d) => d.toISOString().slice(0, 10);
  const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
  const todayUtc = () => {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  };
  const fmt = (d, opts) => d.toLocaleDateString(undefined, { timeZone: 'UTC', ...opts });

  // The day being shown: ?day=, else HN's own "Stories from October 20, 2026" line, else yesterday.
  const currentDay = (bigbox) => {
    const fromUrl = parseIso(new URLSearchParams(location.search).get('day'));
    if (fromUrl) return fromUrl;
    const m = /Stories from (\w+) (\d{1,2}), (\d{4})/.exec(bigbox.textContent);
    if (m && MONTHS.includes(m[1])) return new Date(Date.UTC(+m[3], MONTHS.indexOf(m[1]), +m[2]));
    return addDays(todayUtc(), -1);
  };

  const dayHref = (d) => `front?day=${toIso(d)}`;

  // Our own month calendar. Chrome's native date popup can't be opened reliably from a
  // content script, and its typed segments navigate on half-entered years.
  const calendar = (day, today, min) => {
    let view = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
    const monthStart = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const minMonth = monthStart(min);
    const maxMonth = monthStart(today);
    const api = { onToggle: null };

    const el = h('div', { class: 'hnx-cal', role: 'dialog', 'aria-label': 'Choose a date', hidden: true });
    el.addEventListener('click', (e) => e.stopPropagation());

    const setView = (d) => {
      view = d < minMonth ? minMonth : d > maxMonth ? maxMonth : d;
      render();
    };

    const render = () => {
      const y = view.getUTCFullYear();
      const m = view.getUTCMonth();
      const monthSel = h('select', { class: 'hnx-cal-sel', 'aria-label': 'Month', onchange: (e) => setView(new Date(Date.UTC(y, +e.target.value, 1))) },
        MONTHS.map((name, i) => h('option', { value: i, selected: i === m }, name)));
      const yearSel = h('select', { class: 'hnx-cal-sel', 'aria-label': 'Year', onchange: (e) => setView(new Date(Date.UTC(+e.target.value, m, 1))) });
      for (let yy = today.getUTCFullYear(); yy >= min.getUTCFullYear(); yy--) yearSel.append(h('option', { value: yy, selected: yy === y }, yy));

      const nav = (dir, label) => {
        const target = new Date(Date.UTC(y, m + dir, 1));
        const off = target < minMonth || target > maxMonth;
        return h('button', { type: 'button', class: 'hnx-cal-nav', 'aria-label': label, disabled: off, onclick: () => setView(target) }, icon('chevron', dir < 0 ? 'hnx-rot-left' : 'hnx-rot-right'));
      };

      // Monday-first grid, always six rows so the popover doesn't jump in height.
      const first = new Date(Date.UTC(y, m, 1));
      const gridStart = addDays(first, -((first.getUTCDay() + 6) % 7));
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const d = addDays(gridStart, i);
        const iso = toIso(d);
        const cls = ['hnx-cal-day', d.getUTCMonth() !== m && 'hnx-cal-out', iso === toIso(day) && 'hnx-cal-sel-day', iso === toIso(today) && 'hnx-cal-today'].filter(Boolean).join(' ');
        cells.push(d < min || d > today
          ? h('span', { class: `${cls} hnx-cal-off` }, d.getUTCDate())
          : h('a', { class: cls, href: dayHref(d), title: fmt(d, { dateStyle: 'full' }) }, d.getUTCDate()));
      }
      const weekdays = Array.from({ length: 7 }, (_, i) => fmt(addDays(gridStart, i), { weekday: 'narrow' }));

      el.replaceChildren(
        h('div', { class: 'hnx-cal-head' }, nav(-1, 'Previous month'), h('div', { class: 'hnx-cal-sels' }, monthSel, yearSel), nav(1, 'Next month')),
        h('div', { class: 'hnx-cal-grid' }, weekdays.map((w) => h('span', { class: 'hnx-cal-wd' }, w)), cells),
      );
    };

    const close = () => api.toggle(false);
    const onDocKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };

    api.toggle = (force) => {
      const open = force ?? el.hidden;
      if (open === !el.hidden) return;
      if (open) {
        view = monthStart(day);
        render();
        document.addEventListener('click', close);
        document.addEventListener('keydown', onDocKey, true);
      } else {
        document.removeEventListener('click', close);
        document.removeEventListener('keydown', onDocKey, true);
      }
      el.hidden = !open;
      api.onToggle?.(open);
      if (open) el.querySelector('.hnx-cal-sel-day, a.hnx-cal-day')?.focus();
    };
    api.el = el;
    return api;
  };

  const pastNavigator = (day) => {
    const today = todayUtc();
    const min = parseIso(HN_LAUNCH);
    const clamp = (d) => (d > today ? today : d < min ? min : d);
    const go = (d) => {
      d = clamp(d);
      if (toIso(d) !== toIso(day)) location.href = dayHref(d);
    };
    HNX.pastNav = (n) => go(addDays(day, n));

    const step = (label, d, title, cls = '') => {
      const off = d < min || d > today || toIso(d) === toIso(day);
      return off
        ? h('span', { class: `hnx-day-step ${cls} hnx-disabled`, 'aria-disabled': 'true' }, label)
        : h('a', { class: `hnx-day-step ${cls}`, href: dayHref(d), title }, label);
    };

    const cal = calendar(day, today, min);
    const pickBtn = h('button', {
      type: 'button',
      class: 'hnx-day-pickbtn',
      title: 'Jump to a date',
      'aria-haspopup': 'dialog',
      'aria-expanded': 'false',
      onclick: (e) => {
        e.stopPropagation();
        cal.toggle();
      },
    }, icon('calendar'), fmt(day, { month: 'short', day: 'numeric', year: 'numeric' }));
    cal.onToggle = (open) => pickBtn.setAttribute('aria-expanded', String(open));

    // A week-long strip around the current day, never running past today.
    const end = clamp(addDays(day, 3));
    const start = addDays(end, -6);
    const strip = [];
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const active = toIso(d) === toIso(day);
      strip.push(
        h(
          active ? 'span' : 'a',
          { class: `hnx-day${active ? ' hnx-active' : ''}`, href: active ? null : dayHref(d), title: fmt(d, { dateStyle: 'full' }), 'aria-current': active ? 'date' : null },
          h('span', { class: 'hnx-day-wd' }, fmt(d, { weekday: 'short' })),
          h('span', { class: 'hnx-day-n' }, d.getUTCDate()),
        ),
      );
    }

    return h(
      'section',
      { class: 'hnx-past', 'aria-label': 'Browse past front pages' },
      h(
        'div',
        { class: 'hnx-past-top' },
        h('h1', null, fmt(day, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })),
        h(
          'div',
          { class: 'hnx-past-pick' },
          step(icon('chevron', 'hnx-rot-left'), addDays(day, -1), 'Previous day ([)', 'hnx-day-arrow'),
          h(
            'span',
            { class: 'hnx-day-pickwrap' },
            pickBtn,
            cal.el,
          ),
          step(icon('chevron', 'hnx-rot-right'), addDays(day, 1), 'Next day (])', 'hnx-day-arrow'),
        ),
      ),
      h('nav', { class: 'hnx-day-strip', 'aria-label': 'Nearby days' }, strip),
    );
  };

  const renderStory = (s, seen) => {
    const { title, chips } = HNX.splitTitle(s.title);
    const external = !!s.host;
    const read = !!(seen && (seen.t || seen.l));
    const newComments = seen && seen.t && s.comments != null && seen.c != null ? Math.max(0, s.comments - seen.c) : 0;

    const li = h('li', {
      class: `hnx-story${read ? ' hnx-read' : ''}${s.isJob ? ' hnx-job' : ''}${s.dead ? ' hnx-dead' : ''}`,
      id: s.id,
      dataset: { id: s.id },
    });

    const vote = s.isJob ? null : HNX.voteControl(s, { layout: 'stack' });

    const titleA = h(
      'a',
      {
        class: 'hnx-title',
        href: s.url,
        target: external ? HNX.openTarget() : null,
        rel: external ? 'noopener' : null,
        dataset: external ? { external: '1' } : null,
        onclick: () => {
          li.classList.add('hnx-read');
          HNX.store.patch(s.id, { l: Date.now() });
        },
      },
      title,
    );

    const meta = h(
      'div',
      { class: 'hnx-meta' },
      s.host && h('a', { class: 'hnx-site', href: s.siteHref || `from?site=${s.host}`, title: `More from ${s.site || s.host}` }, HNX.favicon(s.host), h('span', null, s.site || s.host)),
      s.user && h('span', { class: 'hnx-by' }, HNX.userLink(s)),
      h('span', null, HNX.timeEl(s.date, s.ageText, s.itemHref)),
      s.actions.length > 0 &&
        h(
          'span',
          { class: 'hnx-story-actions' },
          s.actions.map((a) =>
            a.text === 'hide'
              ? h('a', { href: a.href, class: 'hnx-action', onclick: (e) => hideStory(e, li, a.href) }, 'hide')
              : h('a', { href: a.href, class: 'hnx-action' }, a.text),
          ),
        ),
    );

    const comments =
      s.comments != null
        ? h(
            'a',
            {
              class: `hnx-cpill${s.comments === 0 ? ' hnx-cpill-zero' : ''}${s.comments >= 300 ? ' hnx-cpill-hot' : ''}`,
              href: s.itemHref,
              title: newComments ? `${s.comments} comments, ${newComments} new` : `${s.comments} comments`,
              'aria-label': `${s.comments} comments`,
            },
            icon('comment'),
            h('span', { class: 'hnx-cpill-n' }, s.comments === 0 ? 'discuss' : HNX.compactNumber(s.comments)),
            newComments > 0 && h('span', { class: 'hnx-cpill-new' }, `+${newComments}`),
          )
        : h('span');

    li.append(
      vote ? vote.el : h('div', { class: 'hnx-vote hnx-vote-empty' }, s.isJob ? icon('sparkle', 'hnx-job-icon') : null),
      h('div', { class: 'hnx-story-main' }, h('h2', { class: 'hnx-story-title' }, chips.filter((c) => c.kind !== 'year' && c.kind !== 'media').map(HNX.chip), titleA, chips.filter((c) => c.kind === 'year' || c.kind === 'media').map(HNX.chip)), meta),
      comments,
    );

    li.addEventListener('click', (e) => {
      if (!e.target.closest('a, button')) HNX.keys?.setFocus(li, false);
    });
    return li;
  };

  // Mirrors hn.js: /snip-story hides the story server-side.
  const hideStory = async (e, li, hideHref) => {
    const url = new URL(hideHref, location.href);
    if (!url.searchParams.get('auth')) return; // let the link navigate to login
    e.preventDefault();
    li.classList.add('hnx-hiding');
    try {
      url.pathname = '/snip-story';
      url.searchParams.set('onop', url.searchParams.get('goto') || 'news');
      url.searchParams.delete('goto');
      const res = await fetch(url.href, { credentials: 'same-origin' });
      if (!res.ok) throw new Error(res.status);
      setTimeout(() => li.remove(), 220);
      HNX.toast('Story hidden');
    } catch {
      li.classList.remove('hnx-hiding');
      location.href = hideHref;
    }
  };

  HNX.renderList = async ({ main, header, bigbox }) => {
    const stories = HNX.parse.stories(bigbox);
    const table = stories.length ? bigbox.querySelector(`tr[id="${stories[0].id}"]`).closest('table') : null;
    const notices = table ? collectNotices(table) : [];
    const more = HNX.parse.moreLink(bigbox);
    const seen = await HNX.store.getMany(stories.map((s) => s.id));

    const op = header.op;
    let heading = PAGE_TITLES[op] || '';
    if (op === 'from') heading = `Stories from ${new URLSearchParams(location.search).get('site') || ''}`;
    const params = new URLSearchParams(location.search);
    if (['favorites', 'upvoted', 'submitted', 'hidden'].includes(op) && params.get('id')) heading = `${PAGE_TITLES[op]} · ${params.get('id')}`;
    const page = Number(params.get('p')) || 1;

    if (op === 'front') {
      main.append(pastNavigator(currentDay(bigbox)));
    } else if (heading) {
      main.append(
        h('div', { class: 'hnx-page-head' }, h('h1', null, heading), page > 1 && h('span', { class: 'hnx-page-num' }, `Page ${page}`)),
      );
    }
    main.append(...notices);

    if (!stories.length) {
      main.append(h('div', { class: 'hnx-empty' }, op === 'front' ? 'No stories for this day.' : 'Nothing here yet.'));
    } else {
      main.append(h('ol', { class: 'hnx-list', start: stories[0].rank || 1 }, stories.map((s) => renderStory(s, seen[s.id]))));
    }

    if (more) {
      main.append(h('div', { class: 'hnx-pager' }, h('a', { class: 'hnx-more', href: more, rel: 'next' }, 'More stories', icon('arrowRight'))));
    }
    return 'list';
  };
})();
