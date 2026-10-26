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

    if (heading) {
      main.append(
        h('div', { class: 'hnx-page-head' }, h('h1', null, heading), page > 1 && h('span', { class: 'hnx-page-num' }, `Page ${page}`)),
      );
    }
    main.append(...notices);

    if (!stories.length) {
      main.append(h('div', { class: 'hnx-empty' }, 'Nothing here yet.'));
    } else {
      main.append(h('ol', { class: 'hnx-list', start: stories[0].rank || 1 }, stories.map((s) => renderStory(s, seen[s.id]))));
    }

    if (more) {
      main.append(h('div', { class: 'hnx-pager' }, h('a', { class: 'hnx-more', href: more, rel: 'next' }, 'More stories', icon('arrowRight'))));
    }
    return 'list';
  };
})();
