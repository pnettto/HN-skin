// Stats: the last 30, 15, 7 or 1 days on HN, from the HN Algolia API. The background worker
// fetches and caches one UTC day at a time; everything here is aggregation and rendering.
(() => {
  const HNX = globalThis.HNX;
  const { h, icon } = HNX;

  const PERIODS = [
    { days: 30, label: '30 days', noun: 'month', title: 'The month on Hacker News' },
    { days: 15, label: '15 days', noun: 'fortnight', title: 'Two weeks on Hacker News' },
    { days: 7, label: '7 days', noun: 'week', title: 'The week on Hacker News' },
    { days: 1, label: '1 day', noun: 'day', title: 'A day on Hacker News' },
  ];
  const HIT = 100; // points for a story to count as a hit
  const POOL = 5; // days fetched at once

  const AI_RE = /\b(ai|agi|llms?|gpt[\w.-]*|chatgpt|openai|anthropic|claude|gemini|deepmind|copilot|mistral|deepseek|llama|qwen|grok|neural|machine learning|agents?|agentic|vibe[- ]cod\w*|transformers?|diffusion)\b/i;
  const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'’.+#-]*[\p{L}\p{N}+#]|[\p{L}\p{N}]/gu;
  const STOP = new Set(
    `a about after all also an and any are as at back be been before being best but by can could did do does don't down even ever every few for from get gets got had has have how i i'm if in into is isn't it it's its just know last less like make makes made many may more most much my need new no not now of off on one only or other our out over own people really says should so some still than that the their them then there these they thing things this those through time to too two up us use used using very via vs want was way we say said run runs work works working making built build building first big part look inside against what when where which while who why will with without would years you your yet`.split(' '),
  );

  const toIso = (d) => d.toISOString().slice(0, 10);
  const fmtDay = (d, opts) => d.toLocaleDateString(undefined, { timeZone: 'UTC', ...opts });
  const num = (n) => Math.round(n).toLocaleString();
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const plural = (n, one, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pad = (x) => String(x).padStart(2, '0');

  // The last `count` complete UTC days, oldest first.
  const dayList = (count) => {
    const n = new Date();
    const today = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
    return Array.from({ length: count }, (_, i) => new Date(today - (count - i) * 864e5));
  };

  const ask = async (msg) => {
    try {
      const res = await chrome.runtime.sendMessage(msg);
      return res && !res.error ? res : null;
    } catch {
      return null;
    }
  };

  // Day data for every day, plus hourly counts when a single day is shown.
  const load = async (days, onProgress) => {
    const out = new Array(days.length).fill(null);
    const total = days.length + (days.length === 1 ? 1 : 0);
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < days.length) {
        const i = next++;
        out[i] = await ask({ type: 'statsDay', day: toIso(days[i]) });
        onProgress(++done / total);
      }
    };
    const [hours] = await Promise.all([
      days.length === 1 ? ask({ type: 'statsHours', day: toIso(days[0]) }).finally(() => onProgress(++done / total)) : null,
      ...Array.from({ length: POOL }, worker),
    ]);
    return { raw: out, hours };
  };

  // One bar per day, or per UTC hour for a single day.
  const buildSeries = (data, hours) => {
    const n = data.daily.length;
    if (n === 1 && hours) {
      return hours.c.map((c, x) => ({
        ok: true,
        dim: false,
        comments: c,
        stories: hours.s[x],
        hits: data.hits.filter((s) => s.date.getUTCHours() === x).length,
        title: `${pad(x)}:00–${pad(x + 1)}:00 UTC`,
        tick: x % 6 === 0 ? `${pad(x)}:00` : '',
      }));
    }
    const step = n <= 7 ? 1 : n <= 15 ? 3 : 7;
    return data.daily.map((d, i) => ({
      ok: d.ok,
      dim: d.weekend,
      comments: d.comments,
      stories: d.stories,
      hits: d.hits,
      title: fmtDay(d.date, { weekday: 'long', month: 'short', day: 'numeric' }),
      tick: i % step === 0 ? fmtDay(d.date, n <= 7 ? { weekday: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' }) : '',
    }));
  };

  const aggregate = (days, raw) => {
    const daily = days.map((date, i) => {
      const r = raw[i];
      const items = (r?.i || []).map(([id, full, host, by, points, comments, time]) => ({
        id, full, host, by, points, comments, date: new Date(time * 1000), ...HNX.splitTitle(full),
      }));
      const weekend = [0, 6].includes(date.getUTCDay());
      return { date, ok: !!r, weekend, stories: r?.s || 0, comments: r?.c || 0, hits: items.filter((s) => s.points >= HIT).length, items };
    });
    const ok = daily.filter((d) => d.ok);
    const items = ok.flatMap((d) => d.items);
    return {
      daily,
      ok,
      items,
      hits: items.filter((s) => s.points >= HIT),
      stories: sum(ok, (d) => d.stories),
      comments: sum(ok, (d) => d.comments),
    };
  };

  /* ---------- Small pieces ---------- */

  const countUp = (el, to, fmt = num) => {
    if (reduced()) {
      el.textContent = fmt(to);
      return;
    }
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 1200);
      el.textContent = fmt(to * (1 - (1 - p) ** 3));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  let tipEl = null;
  const tip = () => {
    if (!tipEl) {
      tipEl = h('div', { class: 'hnx-st-tip', role: 'tooltip' });
      document.body.append(tipEl);
      addEventListener('scroll', () => tipEl.classList.remove('hnx-show'), { passive: true });
    }
    return tipEl;
  };

  // Hover / focus tooltip anchored above `anchor()` (or the target itself).
  const bindTip = (target, content, anchor = () => target) => {
    const show = () => {
      const el = tip();
      el.replaceChildren(...content());
      el.classList.add('hnx-show');
      const r = anchor().getBoundingClientRect();
      const x = Math.min(innerWidth - el.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - el.offsetWidth / 2));
      const y = r.top - el.offsetHeight - 10 < 8 ? r.bottom + 10 : r.top - el.offsetHeight - 10;
      el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };
    const hide = () => tip().classList.remove('hnx-show');
    target.addEventListener('pointerenter', show);
    target.addEventListener('pointerleave', hide);
    target.addEventListener('focus', show);
    target.addEventListener('blur', hide);
  };

  const tipLines = (title, ...rows) => [h('strong', null, title), ...rows.filter(Boolean).map((r) => h('span', null, r))];

  let cardIndex = 0;
  const card = (title, desc, ...body) =>
    h(
      'section',
      { class: 'hnx-st-card', style: `--i: ${cardIndex++}` },
      h('div', { class: 'hnx-st-card-head' }, h('div', null, h('h2', null, title), desc && h('p', null, desc))),
      ...body,
    );

  const site = (host) => host && h('a', { class: 'hnx-site', href: `from?site=${host}`, title: `More from ${host}` }, HNX.favicon(host), h('span', null, host));

  // A ranked story row. `value` is the right-hand figure, `w` the 0–1 width of the backing bar.
  const storyRow = (s, rank, value, w) =>
    h(
      'li',
      { class: 'hnx-st-row', style: w != null ? `--w: ${w}` : null },
      h('span', { class: 'hnx-st-rank' }, rank),
      h(
        'div',
        { class: 'hnx-st-row-main' },
        h('a', { class: 'hnx-st-row-title', href: `item?id=${s.id}` }, s.chips.filter((c) => c.kind !== 'year' && c.kind !== 'media').map(HNX.chip), s.title),
        h(
          'div',
          { class: 'hnx-st-row-meta' },
          site(s.host),
          h('a', { class: 'hnx-user', href: `user?id=${encodeURIComponent(s.by)}` }, s.by),
          h('span', null, s.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
        ),
      ),
      h('span', { class: 'hnx-st-value' }, value),
    );

  // Shows `first` rows, with a button for the rest.
  const rankedList = (rows, first) => {
    const ol = h('ol', { class: 'hnx-st-rows' }, rows);
    rows.forEach((li, i) => (li.hidden = i >= first));
    if (rows.length <= first) return ol;
    const more = h('button', { type: 'button', class: 'hnx-st-more' }, `Show ${rows.length - first} more`, icon('chevron'));
    more.addEventListener('click', () => {
      rows.forEach((li) => (li.hidden = false));
      more.remove();
    });
    return [ol, more];
  };

  const figure = (n, unit) => [h('b', null, n), h('small', null, unit)];

  /* ---------- Sections ---------- */

  const tiles = (data, period) => {
    const days = data.ok.length;
    const thousand = data.hits.filter((s) => s.points >= 1000);
    const tile = (label, value, sub, fmt) => {
      const n = h('span', { class: 'hnx-st-num' }, '0');
      countUp(n, value, fmt);
      return h('div', { class: 'hnx-st-tile' }, h('span', { class: 'hnx-st-tile-label' }, label), n, h('span', { class: 'hnx-st-tile-sub' }, sub));
    };
    return h(
      'div',
      { class: 'hnx-st-tiles' },
      tile('Stories submitted', data.stories, days === 1 ? `${(data.stories / 24).toFixed(0)} an hour` : `${num(data.stories / days)} a day`),
      tile('Comments written', data.comments, `${(data.comments / days / 1440).toFixed(1)} every minute`),
      tile(`Reached ${HIT} points`, data.hits.length, `${((data.hits.length / Math.max(1, data.stories)) * 100).toFixed(1)}% of all stories`),
      tile('Passed 1,000 points', thousand.length, thousand.length ? 'the thousand club' : `a quiet ${period.noun}`),
    );
  };

  const niceMax = (v) => {
    const p = 10 ** Math.floor(Math.log10(Math.max(1, v)));
    return [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => m * p).find((x) => x >= v);
  };

  const METRICS = [
    { id: 'comments', label: 'Comments', unit: 'comments' },
    { id: 'stories', label: 'Stories', unit: 'stories' },
    { id: 'hits', label: `${HIT}+ points`, unit: `stories reached ${HIT} points` },
  ];

  const pulse = (data) => {
    const series = data.series;
    const cols = series.map((d, i) =>
      h(
        'div',
        { class: `hnx-st-col${d.dim ? ' hnx-st-weekend' : ''}${d.ok ? '' : ' hnx-st-missing'}`, tabindex: '0', 'aria-label': d.title },
        h('span', { class: 'hnx-st-bar', style: `--d: ${i * 18}ms` }),
        h('span', { class: 'hnx-st-peak' }),
      ),
    );
    const grid = [1, 0.5].map((f) => h('div', { class: 'hnx-st-grid', style: `--y: ${f}` }, h('span')));
    const avgLine = h('div', { class: 'hnx-st-avg' }, h('span'));
    const plot = h('div', { class: 'hnx-st-plot' }, grid, avgLine, h('div', { class: 'hnx-st-cols' }, cols));
    const xAxis = h('div', { class: 'hnx-st-xaxis', 'aria-hidden': 'true' }, series.map((d) => h('span', null, d.tick)));
    plot.style.setProperty('--n', series.length);
    xAxis.style.setProperty('--n', series.length);

    let metric = METRICS[0];
    const render = () => {
      const vals = series.map((d) => d[metric.id]);
      const okVals = series.filter((d) => d.ok).map((d) => d[metric.id]);
      const top = niceMax(Math.max(1, ...vals));
      const avg = sum(okVals, (v) => v) / Math.max(1, okVals.length);
      const peak = vals.indexOf(Math.max(...vals));
      grid.forEach((g, i) => (g.firstChild.textContent = HNX.compactNumber(Math.round(top * [1, 0.5][i]))));
      avgLine.style.setProperty('--y', avg / top);
      avgLine.firstChild.textContent = `avg ${HNX.compactNumber(Math.round(avg))}`;
      cols.forEach((c, i) => {
        c.style.setProperty('--v', vals[i] / top);
        c.lastChild.textContent = i === peak ? HNX.compactNumber(vals[i]) : '';
      });
    };

    series.forEach((d, i) =>
      bindTip(
        cols[i],
        () =>
          d.ok
            ? tipLines(d.title, `${num(d.comments)} comments`, `${num(d.stories)} stories`, `${plural(d.hits, 'story', 'stories')} reached ${HIT} points`)
            : tipLines(d.title, 'No data for this day'),
        () => cols[i].firstChild,
      ),
    );

    const tabs = h(
      'div',
      { class: 'hnx-st-tabs', role: 'group', 'aria-label': 'Measure' },
      METRICS.map((m) =>
        h('button', {
          type: 'button',
          class: 'hnx-st-tab',
          'aria-pressed': String(m === metric),
          onclick: (e) => {
            metric = m;
            for (const b of tabs.children) b.setAttribute('aria-pressed', String(b === e.currentTarget));
            render();
          },
        }, m.label),
      ),
    );

    render();
    const hourly = series.length === 24 && data.daily.length === 1;
    const c = card(
      hourly ? 'Hourly pulse' : 'Daily pulse',
      hourly ? `Each bar is one hour of ${fmtDay(data.daily[0].date, { weekday: 'long', month: 'short', day: 'numeric' })} (UTC). Stories with ${HIT}+ points are counted by when they were posted.` : 'Each bar is one UTC day. Lighter bars are weekends.',
      h('div', { class: 'hnx-st-chart' }, plot, xAxis),
    );
    c.firstChild.append(tabs);
    return c;
  };

  const topStories = (data) => {
    const top = [...data.items].sort((a, b) => b.points - a.points).slice(0, 25);
    const max = top[0]?.points || 1;
    return card('Top stories', 'Ranked by points.', rankedList(top.map((s, i) => storyRow(s, i + 1, figure(num(s.points), 'points'), s.points / max)), 10));
  };

  const mostDiscussed = (data) => {
    const top = [...data.items].sort((a, b) => b.comments - a.comments).slice(0, 5);
    const max = top[0]?.comments || 1;
    return card('Most discussed', 'The longest threads.', rankedList(top.map((s, i) => storyRow(s, i + 1, figure(num(s.comments), 'comments'), s.comments / max)), 5));
  };

  const debates = (data) => {
    const top = data.items
      .filter((s) => s.comments >= 100 && s.points > 0)
      .map((s) => ({ ...s, ratio: s.comments / s.points }))
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5);
    if (!top.length) return null;
    return card('Hottest debates', 'Most comments per point. More talking than upvoting.', rankedList(top.map((s, i) => storyRow(s, i + 1, figure(s.ratio.toFixed(1), 'per point'))), 5));
  };

  // Points summed per key (site or user) over stories with 20+ points.
  const leaderboard = (items, key) => {
    const m = new Map();
    for (const s of items) {
      const k = key(s);
      if (!k) continue;
      const e = m.get(k) || { k, points: 0, n: 0 };
      e.points += s.points;
      e.n++;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => b.points - a.points).slice(0, 8);
  };

  const barList = (rows, label, href) => {
    const max = rows[0]?.points || 1;
    return h(
      'ol',
      { class: 'hnx-st-bars' },
      rows.map((r) =>
        h(
          'li',
          { style: `--w: ${r.points / max}` },
          h('a', { class: 'hnx-st-bars-label', href: href(r.k) }, label(r.k)),
          h('span', { class: 'hnx-st-bars-n' }, plural(r.n, 'story', 'stories')),
          h('span', { class: 'hnx-st-value' }, figure(HNX.compactNumber(r.points), 'pts')),
        ),
      ),
    );
  };

  const sites = (data) =>
    card('Top sites', 'Points earned by stories from each site.', barList(leaderboard(data.items, (s) => s.host), (k) => [HNX.favicon(k), h('span', null, k)], (k) => `from?site=${k}`));

  const submitters = (data) =>
    card('Top submitters', 'Points earned by the stories each person posted.', barList(leaderboard(data.items, (s) => s.by), (k) => [h('span', { class: 'hnx-avatar' }, k.slice(0, 1).toUpperCase()), h('span', null, k)], (k) => `user?id=${encodeURIComponent(k)}`));

  const heatmap = (data) => {
    if (data.daily.length < 7 || !data.hits.length) return null;
    const grid = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const s of data.hits) grid[(s.date.getDay() + 6) % 7][s.date.getHours()]++;
    const max = Math.max(1, ...grid.flat());
    // 2024-01-01 was a Monday.
    const wd = (i, style) => new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: style });
    const hr = (x) => new Date(2024, 0, 1, x).toLocaleTimeString(undefined, { hour: 'numeric' });

    const byDay = grid.map((row) => sum(row, (v) => v));
    const byHour = grid[0].map((_, x) => sum(grid, (row) => row[x]));
    const bestDay = byDay.indexOf(Math.max(...byDay));
    const bestHour = byHour.indexOf(Math.max(...byHour));

    const cells = [];
    grid.forEach((row, y) => {
      cells.push(h('span', { class: 'hnx-st-hm-wd' }, wd(y, 'short')));
      row.forEach((v, x) => {
        const cell = h('span', { class: `hnx-st-cell${v ? '' : ' hnx-st-zero'}`, style: `--v: ${v / max}; --d: ${(x + y) * 12}ms` });
        bindTip(cell, () => tipLines(`${wd(y, 'long')}, ${hr(x)}–${hr((x + 1) % 24)}`, plural(v, 'story', 'stories') + ` reached ${HIT} points`));
        cells.push(cell);
      });
    });
    const hours = [h('span')];
    for (let x = 0; x < 24; x++) hours.push(h('span', null, x % 6 === 0 ? hr(x) : ''));

    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone?.replace(/_/g, ' ');
    return card(
      'When hits get posted',
      `Stories that reached ${HIT} points, by the time they were submitted (your time${zone ? `, ${zone}` : ''}).`,
      h('p', { class: 'hnx-st-callout' }, 'The sweet spot: ', h('b', null, `${wd(bestDay, 'long')}s`), ' and around ', h('b', null, hr(bestHour)), '.'),
      h(
        'div',
        { class: 'hnx-st-hm-wrap' },
        h('div', { class: 'hnx-st-hm', role: 'img', 'aria-label': `Most hits were posted on ${wd(bestDay, 'long')}s and around ${hr(bestHour)}` }, cells, hours.map((x) => (x.classList.add('hnx-st-hm-hr'), x))),
      ),
      h('div', { class: 'hnx-st-legend', 'aria-hidden': 'true' }, 'Fewer', [0.08, 0.3, 0.55, 0.8, 1].map((v) => h('span', { class: 'hnx-st-cell', style: `--v: ${v}` })), 'More'),
    );
  };

  const topWords = (items, min, n = 40) => {
    const counts = new Map();
    for (const s of items) {
      const seen = new Set();
      for (let w of s.title.match(TOKEN) || []) {
        w = w.replace(/['’]s$/i, '');
        if (/^([A-Za-z]\.)+[A-Za-z]$/.test(w)) w = w.replace(/\./g, '').toUpperCase(); // U.S. -> US
        const k = w.toLowerCase();
        if (seen.has(k) || (STOP.has(k) && !/^[A-Z]{2,}$/.test(w)) || /^[\d.,'’+-]+$/.test(w)) continue;
        if (k.length < 3 && !/^[A-Z]{2}$/.test(w)) continue;
        seen.add(k);
        const e = counts.get(k) || { k, n: 0, forms: {} };
        e.n++;
        e.forms[w] = (e.forms[w] || 0) + 1;
        counts.set(k, e);
      }
    }
    return [...counts.values()]
      .filter((e) => e.n >= min)
      .sort((a, b) => b.n - a.n)
      .slice(0, n)
      .map((e) => ({ ...e, text: Object.entries(e.forms).sort((a, b) => b[1] - a[1])[0][0] }));
  };

  const words = (data, period) => {
    const list = topWords(data.items, period.days >= 7 ? 3 : 2);
    if (list.length < 8) return null;
    const max = list[0].n;
    const min = list.at(-1).n;
    // A stable shuffle so the biggest words don't all bunch up at the start.
    const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
    const shuffled = [...list].sort((a, b) => hash(a.k) - hash(b.k));
    const t = (n) => (max === min ? 0.5 : Math.sqrt((n - min) / (max - min)));
    return card(
      `Words of the ${period.noun}`,
      'The most common words in popular titles. Click one to search.',
      h(
        'div',
        { class: 'hnx-st-cloud' },
        shuffled.map((w, i) =>
          h(
            'a',
            {
              class: `hnx-st-word${list.indexOf(w) < 3 ? ' hnx-st-word-top' : ''}`,
              href: `https://hn.algolia.com/?dateRange=pastMonth&type=story&sort=byPopularity&query=${encodeURIComponent(w.text)}`,
              style: `--t: ${t(w.n).toFixed(3)}; --d: ${i * 15}ms`,
              title: `In ${w.n} titles`,
            },
            w.text,
          ),
        ),
      ),
    );
  };

  const kindList = (data, kind, title, desc) => {
    const top = data.items.filter((s) => s.chips.some((c) => c.kind === kind)).sort((a, b) => b.points - a.points).slice(0, 5);
    if (!top.length) return null;
    return card(title, desc, rankedList(top.map((s, i) => storyRow(s, i + 1, figure(num(s.points), 'points'))), 5));
  };

  const facts = (data) => {
    const out = [];
    const fact = (label, value, detail) => out.push(h('div', { class: 'hnx-st-fact' }, h('span', { class: 'hnx-st-tile-label' }, label), h('div', { class: 'hnx-st-fact-value' }, value), detail && h('p', null, detail)));
    const storyLink = (s) => h('a', { href: `item?id=${s.id}` }, s.title);
    const day = (d) => fmtDay(d.date, { weekday: 'long', month: 'short', day: 'numeric' });

    if (data.ok.length > 1) {
      const byComments = [...data.ok].sort((a, b) => b.comments - a.comments);
      fact('Busiest day', day(byComments[0]), `${num(byComments[0].comments)} comments`);
      fact('Quietest day', day(byComments.at(-1)), `${num(byComments.at(-1).comments)} comments`);
    } else if (data.series.length === 24) {
      const byHour = [...data.series].sort((a, b) => b.comments - a.comments);
      fact('Busiest hour', byHour[0].title, `${num(byHour[0].comments)} comments`);
      fact('Quietest hour', byHour.at(-1).title, `${num(byHour.at(-1).comments)} comments`);
    }

    const wk = data.ok.filter((d) => !d.weekend);
    const we = data.ok.filter((d) => d.weekend);
    if (wk.length && we.length) {
      const a = sum(wk, (d) => d.comments) / wk.length;
      const b = sum(we, (d) => d.comments) / we.length;
      const diff = Math.round((1 - b / a) * 100);
      fact('The weekend dip', diff > 0 ? `${diff}% quieter` : `${-diff}% busier`, `${num(b)} comments a day on weekends, ${num(a)} on weekdays`);
    }

    if (data.hits.length) {
      const ai = data.hits.filter((s) => AI_RE.test(s.full)).length;
      const pct = Math.round((ai / data.hits.length) * 100);
      out.push(
        h(
          'div',
          { class: 'hnx-st-fact' },
          h('span', { class: 'hnx-st-tile-label' }, 'AI-o-meter'),
          h('div', { class: 'hnx-st-fact-value' }, `${pct}%`),
          h('div', { class: 'hnx-st-meter', role: 'meter', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, style: `--w: ${pct / 100}` }, h('span')),
          h('p', null, `of stories with ${HIT}+ points mention AI, LLMs or a model by name`),
        ),
      );

      const hitBy = leaderboard(data.hits.map((s) => ({ ...s, points: 1 })), (s) => s.by)[0];
      if (hitBy?.n > 1) fact('Hitmaker', h('a', { href: `user?id=${encodeURIComponent(hitBy.k)}` }, hitBy.k), `submitted ${hitBy.n} stories that reached ${HIT} points`);

      const shortest = [...data.hits].sort((a, b) => a.title.length - b.title.length)[0];
      fact('Fewest words, most points', storyLink(shortest), `${num(shortest.points)} points with a ${shortest.title.length}-character title`);

      const dated = data.hits.map((s) => ({ s, year: +s.chips.find((c) => c.kind === 'year')?.text })).filter((x) => x.year).sort((a, b) => a.year - b.year);
      if (dated.length) fact('Time capsule', `${dated[0].year}`, [`${plural(dated.length, 'popular story', 'popular stories')} carried a year tag. The oldest: `, storyLink(dated[0].s)]);

      const shows = data.hits.filter((s) => s.chips.some((c) => c.kind === 'show')).length;
      fact('Show HN launches', `${num(shows)}`, `projects shown to HN that reached ${HIT} points`);
    }

    return out.length ? card('Odds & ends', null, h('div', { class: 'hnx-st-facts' }, out)) : null;
  };

  const skeleton = () =>
    h('div', { class: 'hnx-st-skeleton', 'aria-hidden': 'true' },
      h('div', { class: 'hnx-st-tiles' }, Array.from({ length: 4 }, () => h('div', { class: 'hnx-st-tile hnx-st-ghost' }))),
      h('div', { class: 'hnx-st-card hnx-st-ghost hnx-st-ghost-tall' }),
      h('div', { class: 'hnx-st-card hnx-st-ghost' }),
    );

  /* ---------- Page ---------- */

  const periodFromUrl = () => PERIODS.find((p) => p.days === Number(new URLSearchParams(location.search).get('days'))) || PERIODS[0];

  HNX.renderStats = async ({ main }) => {
    main.classList.add('hnx-main-stats');
    let period = periodFromUrl();
    let run = 0;

    const kicker = h('span');
    const range = h('span', { class: 'hnx-st-range' });
    const title = h('h1');
    const lead = h('p', { class: 'hnx-st-lead' });
    const progress = h('div', { class: 'hnx-st-progress', 'aria-hidden': 'true' }, h('span'));
    const body = h('div', { class: 'hnx-st-body' });

    const switcher = h(
      'div',
      { class: 'hnx-st-tabs hnx-st-periods', role: 'group', 'aria-label': 'Period' },
      PERIODS.map((p) =>
        h('a', {
          class: 'hnx-st-tab',
          href: p === PERIODS[0] ? 'stats' : `stats?days=${p.days}`,
          dataset: { days: p.days },
          onclick: (e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            if (p === period) return;
            history.pushState(null, '', e.currentTarget.href);
            show(p);
          },
        }, p.label),
      ),
    );

    main.append(
      h(
        'header',
        { class: 'hnx-st-head' },
        h('div', { class: 'hnx-st-head-top' }, h('div', { class: 'hnx-st-kicker' }, h('span', { class: 'hnx-st-dot' }), kicker, range), switcher),
        title,
        lead,
        progress,
      ),
      body,
    );

    const fill = async () => {
      const mine = ++run;
      const days = dayList(period.days);
      body.setAttribute('aria-busy', 'true');
      body.replaceChildren(skeleton());
      progress.hidden = false;
      progress.firstChild.style.transform = 'scaleX(0)';
      lead.textContent = 'Gathering the numbers…';
      const { raw, hours } = await load(days, (f) => {
        if (mine === run) progress.firstChild.style.transform = `scaleX(${f})`;
      });
      if (mine !== run) return; // the period changed while loading
      const data = aggregate(days, raw);
      data.series = buildSeries(data, hours);
      progress.hidden = true;
      body.removeAttribute('aria-busy');

      if (!data.ok.length) {
        lead.textContent = 'Couldn’t reach the HN Search API.';
        body.replaceChildren(h('div', { class: 'hnx-empty' }, 'No data came back. ', h('button', { type: 'button', class: 'hnx-btn', onclick: fill }, 'Try again')));
        return;
      }

      lead.replaceChildren(
        h('b', null, num(data.comments)), ' comments on ', h('b', null, num(data.stories)), ' stories. ',
        `That’s roughly one comment every ${Math.max(1, Math.round((data.ok.length * 86400) / Math.max(1, data.comments)))} seconds, around the clock.`,
      );

      cardIndex = 0;
      const sections = [
        tiles(data, period),
        pulse(data),
        h('div', { class: 'hnx-st-cols2' }, topStories(data), h('div', { class: 'hnx-st-stack' }, mostDiscussed(data), debates(data))),
        h('div', { class: 'hnx-st-cols2' }, sites(data), submitters(data)),
        heatmap(data),
        words(data, period),
        h('div', { class: 'hnx-st-cols2' }, kindList(data, 'show', 'Best of Show HN', 'Things people made.'), kindList(data, 'ask', 'Best of Ask HN', 'Questions that got answers.')),
        facts(data),
        h(
          'p',
          { class: 'hnx-st-foot' },
          data.ok.length < days.length && `${days.length - data.ok.length} of ${days.length} days couldn’t be loaded and are left out. `,
          'Data from the ',
          h('a', { href: 'https://hn.algolia.com/api', target: '_blank', rel: 'noopener' }, 'HN Search API'),
          `. Days are UTC. Lists cover stories with 20+ points; points and comments are as of the last fetch.`,
        ),
      ];
      body.replaceChildren(...sections);
      HNX.loadFavicons();
    };

    const show = (p) => {
      period = p;
      const days = dayList(p.days);
      document.title = `${p.days === 1 ? 'Last full day' : `Last ${p.label}`} | Hacker News`;
      kicker.textContent = p.days === 1 ? 'Last full day' : `Last ${p.label}`;
      range.textContent =
        p.days === 1
          ? fmtDay(days[0], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
          : `${fmtDay(days[0], { month: 'short', day: 'numeric' })} – ${fmtDay(days.at(-1), { month: 'short', day: 'numeric', year: 'numeric' })}`;
      title.textContent = p.title;
      for (const a of switcher.children) a.setAttribute('aria-current', String(Number(a.dataset.days) === p.days));
      tip().classList.remove('hnx-show');
      fill();
    };

    addEventListener('popstate', () => show(periodFromUrl()));
    show(period);
    return 'stats';
  };
})();
