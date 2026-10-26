(() => {
  const HNX = globalThis.HNX;
  const { h, icon } = HNX;

  /* ---------- Comment text ---------- */

  const BLOCK = /^(P|PRE|DIV|UL|OL|BLOCKQUOTE|TABLE)$/;

  // HN's comment HTML is "first paragraph as bare text, then <p>…" with quotes written as
  // "> text". Normalise into <p>s and turn quoted paragraphs into real blockquotes.
  const formatText = (src) => {
    const box = h('div', { class: 'hnx-c-text' });
    if (!src) return box;
    src.querySelectorAll('.reply').forEach((r) => r.remove());
    const frag = HNX.takeChildren(src);
    let lead = null;
    for (const node of Array.from(frag.childNodes)) {
      if (node.nodeType === 1 && BLOCK.test(node.tagName)) {
        lead = null;
        box.append(node);
      } else {
        if (!lead) {
          if (node.nodeType === 3 && !node.textContent.trim()) continue;
          lead = h('p');
          box.append(lead);
        }
        lead.append(node);
      }
    }
    for (const p of box.querySelectorAll(':scope > p')) {
      if (!p.textContent.trim() && !p.querySelector('img')) {
        p.remove();
        continue;
      }
      const first = firstText(p);
      if (first && /^\s*(>|&gt;)/.test(first.textContent)) {
        first.textContent = first.textContent.replace(/^\s*(>|&gt;)\s?/, '');
        p.classList.add('hnx-quote');
      }
    }
    for (const a of box.querySelectorAll('a[href]')) {
      if (/^https?:/.test(a.getAttribute('href')) && HNX.settings.newTab) {
        a.target = '_blank';
        a.rel = 'nofollow noopener';
      }
    }
    return box;
  };

  const firstText = (el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.textContent.trim() ? 1 : 3) });
    return walker.nextNode();
  };

  /* ---------- Tree ---------- */

  const buildTree = (flat) => {
    const roots = [];
    const stack = [];
    for (const c of flat) {
      c.children = [];
      while (stack.length && stack[stack.length - 1].depth >= c.depth) stack.pop();
      const parent = stack[stack.length - 1] || null;
      c.parent = parent;
      (parent ? parent.children : roots).push(c);
      stack.push(c);
    }
    const count = (c) => (c.descendants = c.children.reduce((n, k) => n + 1 + count(k), 0));
    roots.forEach(count);
    return roots;
  };

  /* ---------- Collapse ---------- */

  const persistCollapsed = () => {
    if (!HNX.thread) return;
    const ids = HNX.$$('.hnx-comment.hnx-collapsed').map((el) => el.dataset.id);
    HNX.store.patch(HNX.thread.id, { x: ids.slice(-500) });
  };

  HNX.toggleComment = (el, force) => {
    if (!el || el.classList.contains('hnx-root-comment')) return;
    const coll = force ?? !el.classList.contains('hnx-collapsed');
    el.classList.toggle('hnx-collapsed', coll);
    el.querySelector(':scope > .hnx-c-self .hnx-c-toggle')?.setAttribute('aria-expanded', String(!coll));
    if (HNX.isLoggedIn()) fetch(`collapse?id=${el.dataset.id}${coll ? '' : '&un=true'}`, { credentials: 'same-origin' }).catch(() => {});
    persistCollapsed();
    // Keep the toggled comment's head on screen when collapsing a long thread.
    if (coll) {
      const top = el.getBoundingClientRect().top;
      if (top < 60) el.scrollIntoView({ block: 'start' });
    }
  };

  /* ---------- Rendering ---------- */

  const actionBtn = (iconName, label, onclick, extra = {}) =>
    h('button', { class: 'hnx-c-action', type: 'button', onclick, ...extra }, icon(iconName), h('span', null, label));

  const renderComment = (c, ctx) => {
    const isRoot = !!ctx.isRoot;
    const el = h('article', {
      class: [
        'hnx-comment',
        c.isNew && 'hnx-new',
        c.dead && 'hnx-dead',
        c.deleted && 'hnx-deleted',
        isRoot && 'hnx-root-comment',
        ctx.collapsed?.has(c.id) || c.collapsed ? 'hnx-collapsed' : null,
      ].filter(Boolean).join(' '),
      id: c.id,
      dataset: { id: c.id, depth: c.depth },
      style: `--depth-color: var(--hnx-thread-${c.depth % 6})`,
    });

    const vote = HNX.voteControl(c, { layout: 'inline' });
    const isOp = ctx.op && c.user === ctx.op;
    const isMe = ctx.me && c.user === ctx.me;

    const toggle = isRoot
      ? null
      : h('button', { class: 'hnx-c-toggle', type: 'button', 'aria-expanded': String(!el.classList.contains('hnx-collapsed')), 'aria-label': 'Collapse thread', title: 'Collapse (x)', onclick: (e) => { e.stopPropagation(); HNX.toggleComment(el); } }, icon('chevron'));

    const head = h(
      'header',
      { class: 'hnx-c-head' },
      toggle,
      c.user ? HNX.userLink(c, { op: isOp, me: isMe }) : h('span', { class: 'hnx-user hnx-user-gone' }, 'deleted'),
      h('span', { class: 'hnx-dot', 'aria-hidden': 'true' }, '·'),
      HNX.timeEl(c.date, c.ageText, c.permalink),
      c.isNew && h('span', { class: 'hnx-badge hnx-badge-new' }, 'new'),
      c.dead && h('span', { class: 'hnx-badge' }, 'dead'),
      c.onStory && h('span', { class: 'hnx-c-on' }, 'on ', h('a', { href: c.onStory.href }, c.onStory.title)),
      h('span', { class: 'hnx-c-count' }, c.descendants ? `+${c.descendants} ${c.descendants === 1 ? 'reply' : 'replies'}` : 'collapsed'),
    );
    head.addEventListener('click', (e) => {
      if (!e.target.closest('a, button') && !isRoot) HNX.toggleComment(el);
    });

    const body = h('div', { class: 'hnx-c-body' });
    if (c.deleted) body.append(h('div', { class: 'hnx-c-text hnx-c-gone' }, c.deleted));
    else {
      const text = formatText(c.textEl);
      if (c.fade > 0.05) {
        text.classList.add('hnx-faded');
        text.style.setProperty('--fade', String(Math.max(0.35, 1 - c.fade * 0.65)));
      }
      body.append(text);
    }

    const composerSlot = h('div', { class: 'hnx-c-composer-slot' });
    const actions = h(
      'div',
      { class: 'hnx-c-actions' },
      (c.upHref || c.downHref) && vote.el,
      c.replyHref && actionBtn('reply', 'Reply', () => HNX.openReply(el), { title: 'Reply (r)', class: 'hnx-c-action hnx-c-primary' }),
      c.parent && !isRoot && actionBtn('parent', 'Parent', () => HNX.keys.gotoComment(document.getElementById(c.parent.id)), { title: 'Go to parent (p)' }),
      !c.parent && c.parentHref && h('a', { class: 'hnx-c-action', href: c.parentHref }, icon('parent'), h('span', null, 'Parent')),
      c.contextHref && h('a', { class: 'hnx-c-action', href: c.contextHref }, icon('layers'), h('span', null, 'Context')),
      actionBtn('link', 'Link', () => {
        const url = new URL(`item?id=${c.id}`, location.href).href;
        navigator.clipboard?.writeText(url).then(() => HNX.toast('Link copied'), () => HNX.toast(url));
      }, { title: 'Copy link' }),
      c.actions.map((a) => h('a', { class: 'hnx-c-action hnx-c-action-text', href: a.href }, a.text)),
    );
    if (!c.deleted) body.append(actions, composerSlot);

    el.hnxComment = c;
    el.hnxVote = vote.vote;
    el.append(h('div', { class: 'hnx-c-self' }, head, body));

    if (c.children.length) {
      const rail = h('button', { class: 'hnx-c-rail', type: 'button', tabindex: '-1', 'aria-label': `Collapse thread by ${c.user}`, onclick: () => { HNX.toggleComment(el); HNX.keys.setFocus(el, false); } });
      const kids = h('div', { class: 'hnx-c-children' }, c.children.map((k) => renderComment(k, { ...ctx, isRoot: false })));
      const showKids = h(
        'button',
        { class: 'hnx-c-showkids', type: 'button', onclick: () => el.classList.add('hnx-kids-open') },
        icon('chevron'),
        `${c.descendants} ${c.descendants === 1 ? 'reply' : 'replies'}`,
      );
      el.append(rail, showKids, kids);
    }

    el.addEventListener('click', (e) => {
      if (e.target.closest('a, button, textarea, input')) return;
      e.stopPropagation();
      HNX.keys?.setFocus(el, false);
    });
    return el;
  };

  /* ---------- Inline reply ---------- */

  HNX.openReply = async (el) => {
    const c = el.hnxComment;
    const slot = el.querySelector(':scope > .hnx-c-self .hnx-c-composer-slot');
    if (!c?.replyHref || !slot) return;
    const existing = slot.querySelector('form');
    if (existing) {
      existing.focusInput();
      return;
    }
    slot.classList.add('hnx-loading-slot');
    try {
      const res = await fetch(c.replyHref, { credentials: 'same-origin' });
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const orig = doc.querySelector('form[action="comment"]');
      if (!orig) throw new Error('no form');
      const form = HNX.composer(orig, {
        placeholder: `Reply to ${c.user}…`,
        submitLabel: 'Reply',
        onCancel: () => {
          form.remove();
          HNX.keys.setFocus(el, false);
        },
      });
      slot.append(form);
      form.focusInput();
    } catch {
      location.href = c.replyHref; // logged out or rate-limited: let HN handle it
    } finally {
      slot.classList.remove('hnx-loading-slot');
    }
  };

  /* ---------- Story header ---------- */

  const renderStoryHero = (s, { toptext, form, extras }) => {
    const { title, chips } = HNX.splitTitle(s.title);
    const external = !!s.host;
    const vote = s.isJob ? null : HNX.voteControl(s, { layout: 'pill' });
    const hero = h('article', { class: 'hnx-hero', dataset: { id: s.id } });

    hero.append(
      (chips.length || s.host) &&
        h(
          'div',
          { class: 'hnx-hero-kicker' },
          chips.map(HNX.chip),
          s.host && h('a', { class: 'hnx-site', href: s.siteHref || `from?site=${s.host}` }, HNX.favicon(s.host), h('span', null, s.site || s.host)),
        ),
      h(
        'h1',
        { class: 'hnx-hero-title' },
        h('a', { href: s.url, target: external ? HNX.openTarget() : null, rel: external ? 'noopener' : null, dataset: external ? { external: '1' } : null, onclick: () => HNX.store.patch(s.id, { l: Date.now() }) }, title, external && icon('external', 'hnx-ext')),
      ),
      h(
        'div',
        { class: 'hnx-meta hnx-hero-meta' },
        vote && vote.el,
        s.user && h('span', { class: 'hnx-by' }, 'by ', HNX.userLink(s)),
        h('span', null, HNX.timeEl(s.date, s.ageText, s.itemHref)),
        s.comments != null && h('a', { href: '#hnx-comments' }, `${s.comments} comments`),
        s.actions.length > 0 && h('span', { class: 'hnx-hero-actions' }, s.actions.map((a) => h('a', { class: 'hnx-action', href: a.href }, a.text))),
      ),
    );
    if (toptext && toptext.textContent.trim()) hero.append(h('div', { class: 'hnx-toptext' }, formatText(toptext)));
    if (extras.length) hero.append(h('div', { class: 'hnx-hero-extra' }, extras));
    if (form) hero.append(form);
    hero.hnxVote = vote?.vote;
    return hero;
  };

  /* ---------- Thread toolbar ---------- */

  const toolbar = ({ total, newCount, prevVisit }) => {
    const section = () => document.querySelector('.hnx-comments');
    const topOnly = h('button', { class: 'hnx-tool', type: 'button', 'aria-pressed': 'false', title: 'Show only top-level comments (T)', onclick: () => HNX.toggleTopOnly() }, icon('layers'), 'Top-level only');
    const expand = h('button', {
      class: 'hnx-tool', type: 'button', title: 'Expand every collapsed comment',
      onclick: () => {
        HNX.$$('.hnx-comment.hnx-collapsed').forEach((el) => el.classList.remove('hnx-collapsed'));
        section()?.classList.remove('hnx-toponly');
        topOnly.setAttribute('aria-pressed', 'false');
        persistCollapsed();
      },
    }, icon('expand'), 'Expand all');
    const jump = newCount
      ? h('button', { class: 'hnx-tool hnx-tool-new', type: 'button', title: prevVisit ? `Since your last visit ${HNX.timeAgo(new Date(prevVisit))}` : null, onclick: () => HNX.keys.nextNew() }, h('span', { class: 'hnx-pulse' }), `${newCount} new`, h('kbd', { class: 'hnx-kbd' }, 'n'))
      : null;
    HNX.toggleTopOnly = () => {
      const s = section();
      if (!s) return;
      const on = s.classList.toggle('hnx-toponly');
      HNX.$$('.hnx-kids-open').forEach((el) => el.classList.remove('hnx-kids-open'));
      topOnly.setAttribute('aria-pressed', String(on));
      HNX.toast(on ? 'Showing top-level comments' : 'Showing all comments');
    };
    return h('div', { class: 'hnx-thread-bar', id: 'hnx-comments' },
      h('h2', null, total === 1 ? '1 comment' : `${total} comments`),
      h('div', { class: 'hnx-thread-tools' }, jump, topOnly, expand),
    );
  };

  /* ---------- Pages ---------- */

  HNX.renderItem = async ({ main, header, bigbox }) => {
    const fat = bigbox.querySelector('table.fatitem');
    const story = HNX.parse.stories(fat)[0] || null;
    const rootComment = story ? null : HNX.parse.comments(fat)[0] || null;
    const tree = bigbox.querySelector('table.comment-tree');
    const flat = HNX.parse.comments(tree || bigbox).filter((c) => !rootComment || c.id !== rootComment.id);
    const id = story?.id || rootComment?.id;
    if (!id) return null;

    const prev = await HNX.store.get(id);
    const maxPrev = prev?.m || 0;
    const collapsed = new Set(prev?.x || []);
    let newCount = 0;
    if (prev?.m && HNX.settings.highlightNew) {
      for (const c of flat) {
        if (Number(c.id) > maxPrev && c.user !== header.user?.name) {
          c.isNew = true;
          newCount++;
        }
      }
    }

    HNX.thread = { id, op: story?.user || null };
    const ctx = { op: story?.user || null, me: header.user?.name || null, collapsed };

    // The comment form (on the item page) or reply form (on /reply).
    const origForm = fat.querySelector('form[action="comment"]');
    const form = origForm
      ? HNX.composer(origForm, {
          placeholder: story ? 'Add to the discussion…' : `Reply to ${rootComment?.user || ''}…`,
          submitLabel: story ? 'Comment' : 'Reply',
          collapsed: !!story && location.pathname !== '/reply',
        })
      : null;
    // Other forms (edit, poll votes, etc.) and poll options: keep them as-is.
    const extras = Array.from(fat.querySelectorAll('form:not([action="comment"]), tr.athing:not(:has(.titleline)):not(:has(.comhead))'))
      .map((n) => h('div', { class: 'hnx-raw' }, n.tagName === 'TR' ? h('table', null, h('tbody', null, n)) : n));

    if (story) {
      main.append(renderStoryHero(story, { toptext: fat.querySelector('.toptext'), form, extras }));
    } else if (rootComment) {
      const root = renderComment({ ...rootComment, children: [], descendants: 0 }, { ...ctx, isRoot: true });
      main.append(h('div', { class: 'hnx-hero hnx-hero-comment' }, root, ...extras, form));
    }

    const roots = buildTree(flat);
    if (story || roots.length) {
      main.append(toolbar({ total: story?.comments ?? flat.length, newCount, prevVisit: prev?.t }));
    }
    const section = h('section', { class: 'hnx-comments', 'aria-label': 'Comments' }, roots.map((c) => renderComment(c, ctx)));
    if (!roots.length) section.append(h('div', { class: 'hnx-empty' }, story ? 'No comments yet. Start the conversation.' : 'No replies yet.'));
    main.append(section);

    const more = HNX.parse.moreLink(bigbox);
    if (more) main.append(h('div', { class: 'hnx-pager' }, h('a', { class: 'hnx-more', href: more, rel: 'next' }, 'More comments', icon('arrowRight'))));

    const maxId = flat.reduce((m, c) => Math.max(m, Number(c.id)), maxPrev);
    HNX.store.patch(id, { t: Date.now(), c: story?.comments ?? flat.length, m: maxId });

    document.title = `${story ? story.title : `Comment by ${rootComment.user}`} | Hacker News`;
    return 'comments';
  };

  // /newcomments, /threads?id=, and other flat comment lists.
  HNX.renderCommentList = async ({ main, header, bigbox }) => {
    const flat = HNX.parse.comments(bigbox);
    if (!flat.length) return null;
    const op = header.op;
    const params = new URLSearchParams(location.search);
    const heading = op === 'threads' ? `Threads · ${params.get('id') || ''}` : op === 'newcomments' ? 'New comments' : 'Comments';
    main.append(h('div', { class: 'hnx-page-head' }, h('h1', null, heading)));
    HNX.thread = null;
    const ctx = { op: null, me: header.user?.name || null, collapsed: new Set() };
    const roots = buildTree(flat);
    main.append(h('section', { class: 'hnx-comments hnx-comment-list', 'aria-label': 'Comments' }, roots.map((c) => renderComment(c, ctx))));
    const more = HNX.parse.moreLink(bigbox);
    if (more) main.append(h('div', { class: 'hnx-pager' }, h('a', { class: 'hnx-more', href: more, rel: 'next' }, 'More', icon('arrowRight'))));
    return 'comments';
  };
})();
