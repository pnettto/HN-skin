// Reads HN's table-based markup into plain objects. Nothing here mutates the page,
// except that comment/toptext *nodes* are referenced so renderers can move them.
(() => {
  const HNX = globalThis.HNX;
  const { $, $$ } = HNX;

  const href = (a) => (a ? a.getAttribute('href') : null);
  const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
  const int = (s) => {
    const n = parseInt(String(s).replace(/[^\d-]/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  };

  const EXTRA_ACTIONS = new Set([
    'flag', 'unflag', 'vouch', 'unvouch', 'edit', 'delete', 'favorite', 'un-favorite', 'past', 'hide', 'un-hide',
  ]);

  // Vote state for an item: HN hides the arrow with .nosee and fills #unv_<id> once voted.
  const voteState = (scope, id) => {
    const up = scope.querySelector(`#up_${id}`);
    const down = scope.querySelector(`#down_${id}`);
    const unv = scope.querySelector(`#unv_${id} a`);
    let voted = null;
    if (unv) voted = /undown/i.test(unv.textContent) ? 'down' : 'up';
    else if (up && up.classList.contains('nosee')) voted = 'up';
    return { upHref: href(up), downHref: href(down), voted };
  };

  HNX.parse = {
    header() {
      const tops = $$('.pagetop');
      const nav = [];
      let user = null;
      let login = null;
      let logout = null;
      if (tops[0]) {
        for (const a of $$('a', tops[0])) {
          if (a.closest('.hnname')) continue;
          nav.push({ href: href(a), text: text(a), active: !!a.closest('.topsel') });
        }
      }
      const right = tops[tops.length - 1];
      if (right && right !== tops[0]) {
        const me = $('#me', right);
        if (me) user = { name: text(me), href: href(me), karma: text($('#karma', right)) };
        logout = href($('#logout', right));
        login = href($$('a', right).find((a) => /^login/.test(href(a) || '')));
      }
      return { nav, user, login, logout, op: document.documentElement.getAttribute('op') || '' };
    },

    stories(scope = document) {
      return $$('tr.athing', scope)
        .filter((tr) => $('.titleline', tr))
        .map((tr) => {
          const id = tr.id;
          const titleA = $('.titleline > a', tr);
          const subRow = tr.nextElementSibling;
          const sub = subRow ? $('.subtext', subRow) : null;
          const links = sub ? $$('a', sub) : [];
          const userA = sub ? $('.hnuser', sub) : null;
          const age = sub ? $('.age', sub) : null;
          const unv = sub ? $(`#unv_${id}`, sub) : null;
          const commentsA = [...links]
            .reverse()
            .find((a) => /^item\?id=/.test(href(a) || '') && /comment|discuss/i.test(a.textContent));
          const commentsText = text(commentsA);

          let host = '';
          try {
            const u = new URL(titleA.href);
            if (u.hostname !== location.hostname) host = u.hostname.replace(/^www\./, '');
          } catch {}

          const actions = links
            .filter((a) => a !== userA && a !== commentsA && !a.closest('.age') && !(unv && unv.contains(a)))
            .filter((a) => EXTRA_ACTIONS.has(text(a).toLowerCase()))
            .map((a) => ({ text: text(a), href: href(a) }));

          return {
            id,
            kind: 'story',
            rank: int(text($('.rank', tr))),
            title: text(titleA),
            url: href(titleA),
            host,
            site: text($('.sitestr', tr)),
            siteHref: href($('.sitebit a', tr)),
            score: int(text(sub && $('.score', sub))),
            user: text(userA),
            userHref: href(userA),
            newUser: !!(userA && $('font', userA)),
            date: HNX.parseAge(age && age.getAttribute('title')),
            ageText: text(age),
            itemHref: href(commentsA) || href(age && $('a', age)) || `item?id=${id}`,
            comments: commentsA ? (/discuss/i.test(commentsText) ? 0 : int(commentsText)) : null,
            actions,
            isJob: !userA && !(sub && $('.score', sub)),
            dead: /\[(dead|flagged)\]/i.test(text(tr)),
            ...voteState(tr, id),
          };
        });
    },

    comments(scope = document) {
      if (!scope) return [];
      return $$('tr.athing', scope)
        .filter((tr) => $('.comhead', tr) && !$('.titleline', tr))
        .map((tr) => {
          const id = tr.id;
          const ind = $('td.ind', tr);
          let depth = int(ind && ind.getAttribute('indent'));
          if (depth == null) {
            const w = int(ind && $('img', ind) && $('img', ind).getAttribute('width'));
            depth = w == null ? 0 : Math.round(w / 40);
          }
          const head = $('.comhead', tr);
          const userA = $('.hnuser', head);
          const age = $('.age', head);
          const textEl = $('.commtext', tr);
          const navLinks = $$('.navs a', head);
          const onStory = $('.onstory a', head);
          const fade = textEl ? [...textEl.classList].find((c) => /^c[0-9a-f]{2}$/.test(c)) : null;
          const headText = text(head);
          const bodyText = text($('.comment', tr));

          return {
            id,
            kind: 'comment',
            depth,
            user: text(userA),
            userHref: href(userA),
            newUser: !!(userA && $('font', userA)),
            date: HNX.parseAge(age && age.getAttribute('title')),
            ageText: text(age),
            permalink: href(age && $('a', age)) || `item?id=${id}`,
            textEl,
            fade: fade ? parseInt(fade.slice(1), 16) / 0xdd : 0,
            deleted: !textEl ? bodyText || '[deleted]' : null,
            dead: /\[(dead|flagged)\]/i.test(headText),
            replyHref: href($('.reply a[href^="reply"]', tr)),
            parentHref: href(navLinks.find((a) => text(a) === 'parent')),
            contextHref: href(navLinks.find((a) => text(a) === 'context')),
            onStory: onStory ? { title: onStory.getAttribute('title') || text(onStory), href: href(onStory) } : null,
            collapsed: tr.classList.contains('coll'),
            actions: $$('a', head)
              .filter((a) => EXTRA_ACTIONS.has(text(a).toLowerCase()) && text(a) !== 'past')
              .map((a) => ({ text: text(a), href: href(a) })),
            ...voteState(tr, id),
          };
        });
    },

    moreLink(scope = document) {
      return href($('a.morelink', scope));
    },
  };
})();
