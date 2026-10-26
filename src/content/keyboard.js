(() => {
  const HNX = globalThis.HNX;
  let mode = null; // 'list' | 'comments'
  let focused = null;

  const visibleComments = () => HNX.$$('.hnx-comment').filter((el) => el.offsetParent !== null);
  const items = () => (mode === 'list' ? HNX.$$('.hnx-story') : visibleComments());

  const setFocus = (el, scroll = true) => {
    if (!el) return;
    focused?.classList.remove('hnx-focused');
    focused = el;
    el.classList.add('hnx-focused');
    if (scroll) {
      const target = mode === 'comments' ? el.querySelector(':scope > .hnx-c-self') || el : el;
      const r = target.getBoundingClientRect();
      const topbar = 72;
      if (mode === 'list') {
        if (r.top < topbar || r.bottom > innerHeight - 16) target.scrollIntoView({ block: 'nearest' });
      } else if (r.top < topbar || r.top > innerHeight * 0.6) {
        target.scrollIntoView({ block: 'start' });
      }
    }
  };

  const move = (delta) => {
    const list = items();
    if (!list.length) return;
    let i = list.indexOf(focused);
    if (i === -1) {
      // Start from whatever is on screen rather than the top of the page.
      i = list.findIndex((el) => el.getBoundingClientRect().bottom > 80);
      setFocus(list[Math.max(0, i)]);
      return;
    }
    setFocus(list[Math.min(list.length - 1, Math.max(0, i + delta))]);
  };

  const sibling = (delta) => {
    if (!focused) return move(delta);
    let el = focused;
    const step = delta > 0 ? 'nextElementSibling' : 'previousElementSibling';
    let next = el[step];
    // At the end of a sibling group, climb up so J keeps moving forward through the thread.
    while (!next && delta > 0 && el.parentElement.closest('.hnx-comment')) {
      el = el.parentElement.closest('.hnx-comment');
      next = el[step];
    }
    if (next?.classList.contains('hnx-comment')) setFocus(next);
  };

  // Scrolls to a comment, expanding collapsed ancestors on the way.
  const gotoComment = (el) => {
    if (!el) return;
    for (let p = el.parentElement.closest('.hnx-comment'); p; p = p.parentElement.closest('.hnx-comment')) {
      p.classList.remove('hnx-collapsed');
      p.classList.add('hnx-kids-open');
    }
    setFocus(el);
    HNX.flash(el.querySelector(':scope > .hnx-c-self'));
  };

  const nextNew = () => {
    const news = HNX.$$('.hnx-comment.hnx-new');
    if (!news.length) return HNX.toast('No new comments');
    const after = focused ? news.find((el) => focused.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
    gotoComment(after || news[0]);
    if (!after && focused && news.length) HNX.toast('Back to the first new comment');
  };

  const open = (href, newTab) => {
    if (!href) return;
    if (newTab) window.open(href, '_blank', 'noopener');
    else location.href = href;
  };

  const onKey = (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (HNX.isTyping(e.target)) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const k = e.key;
    const helpOpen = document.querySelector('.hnx-help.hnx-show');
    if (k === 'Escape') {
      if (helpOpen) HNX.toggleHelp(false);
      else if (focused) {
        focused.classList.remove('hnx-focused');
        focused = null;
      }
      return;
    }
    if (k === '?') {
      e.preventDefault();
      return HNX.toggleHelp();
    }
    if (!HNX.settings.keyboard || helpOpen) return;

    const run = (fn) => {
      e.preventDefault();
      fn();
    };

    if (k === '/') return run(() => document.querySelector('.hnx-search input')?.focus() || open('https://hn.algolia.com/'));
    if (k === 't') return run(HNX.cycleTheme);
    if (k === 'j') return run(() => move(1));
    if (k === 'k') return run(() => move(-1));

    if (mode === 'list') {
      const link = focused?.querySelector('.hnx-title');
      if ((k === 'o' || k === 'Enter') && link) return run(() => { link.click(); });
      if (k === 'c' && focused) return run(() => open(focused.querySelector('.hnx-cpill')?.getAttribute('href') || `item?id=${focused.dataset.id}`));
      if (k === 'u' && focused) return run(() => focused.querySelector('.hnx-vote')?.hnxVote?.('up'));
      if (k === 'n') return run(() => open(document.querySelector('.hnx-more')?.getAttribute('href')));
      return;
    }

    if (mode === 'comments') {
      if (k === 'J') return run(() => sibling(1));
      if (k === 'K') return run(() => sibling(-1));
      if (k === 'n') return run(nextNew);
      if (k === 'T') return run(() => HNX.toggleTopOnly?.());
      if (k === 'o') return run(() => document.querySelector('.hnx-hero-title a')?.click());
      if (k === 'u' && !focused) return run(() => document.querySelector('.hnx-hero')?.hnxVote?.('up'));
      if (!focused) return;
      if (k === 'x' || k === 'Enter') return run(() => { HNX.toggleComment(focused); setFocus(focused); });
      if (k === 'p' || k === 'h') return run(() => gotoComment(focused.parentElement.closest('.hnx-comment')));
      if (k === 'u') return run(() => focused.hnxVote?.('up'));
      if (k === 'r') return run(() => HNX.openReply(focused));
    }
  };

  HNX.keys = {
    init(m) {
      mode = m;
      document.addEventListener('keydown', onKey);
    },
    setFocus,
    gotoComment,
    nextNew,
  };
})();
