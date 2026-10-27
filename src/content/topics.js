// AI topic labels and the topic filter row on story lists. The provider call happens in
// the background worker, which holds the API key; this side only renders the results.
(() => {
  const HNX = globalThis.HNX;
  const { h } = HNX;
  const FILTER_KEY = 'hnx:topic';
  const LABELS = Object.fromEntries(HNX.TOPICS.map((t) => [t.id, t.label]));

  const readFilter = () => {
    try {
      return localStorage.getItem(FILTER_KEY) || '';
    } catch {
      return '';
    }
  };

  const writeFilter = (id) => {
    try {
      if (id) localStorage.setItem(FILTER_KEY, id);
      else localStorage.removeItem(FILTER_KEY);
    } catch {}
  };

  const aiEnabled = async () => {
    try {
      const { ai } = await chrome.storage.local.get('ai');
      return !!(ai?.provider && ai.keys?.[ai.provider]?.trim());
    } catch {
      return false;
    }
  };

  HNX.decorateTopics = async (list, stories) => {
    if (!(await aiEnabled())) return;

    const status = h('span', { class: 'hnx-topics-status' }, 'Sorting by topic…');
    const bar = h('nav', { class: 'hnx-topics', 'aria-label': 'Filter by topic' }, status);
    list.before(bar);

    let res = null;
    try {
      res = await chrome.runtime.sendMessage({
        type: 'topics',
        stories: stories.map(({ id, title, host }) => ({ id, title, host })),
      });
    } catch {}
    const topics = res?.topics || {};
    const counts = {};
    for (const t of Object.values(topics)) counts[t] = (counts[t] || 0) + 1;

    if (!Object.keys(topics).length) {
      if (res?.error) {
        status.textContent = `Topics unavailable: ${res.error}`;
        status.classList.add('hnx-error');
      } else {
        bar.remove();
      }
      return;
    }

    let current = '';
    const apply = (id, save) => {
      current = id;
      if (save) writeFilter(id);
      for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.topic === id));
      let first = true;
      for (const li of list.children) {
        const hidden = !!id && li.dataset.topic !== id;
        li.classList.toggle('hnx-filtered', hidden);
        li.classList.toggle('hnx-filter-first', !hidden && first);
        if (!hidden) first = false;
      }
      if (list.querySelector('.hnx-focused.hnx-filtered')) list.querySelector('.hnx-focused').classList.remove('hnx-focused');
    };

    const chips = [['', 'All', Object.keys(topics).length], ...HNX.TOPICS.filter((t) => counts[t.id]).map((t) => [t.id, t.label, counts[t.id]])];
    const buttons = chips.map(([id, label, n]) =>
      h(
        'button',
        { type: 'button', class: 'hnx-topic-chip', dataset: { topic: id }, onclick: () => apply(current === id ? '' : id, true) },
        label,
        h('span', { class: 'hnx-topic-n' }, n),
      ),
    );
    bar.replaceChildren(...buttons);
    if (res?.error) bar.append(h('span', { class: 'hnx-topics-status hnx-error', title: res.error }, 'Some stories could not be sorted'));

    for (const li of list.children) {
      const t = topics[li.dataset.id];
      if (!t) continue;
      li.dataset.topic = t;
      li.querySelector('.hnx-meta')?.append(
        h('button', { type: 'button', class: 'hnx-topic', title: `Show only ${LABELS[t]}`, onclick: () => apply(t, true) }, LABELS[t]),
      );
    }

    // A saved filter with no matches on this page shows everything but stays saved.
    const saved = readFilter();
    apply(counts[saved] ? saved : '', false);
  };
})();
