importScripts('shared/settings.js');

// HN's CSP only allows images from its own origin, so the content script can't load
// favicons directly. We fetch them here and hand back base64 bytes, which the page
// paints into a <canvas> (not subject to img-src).
const TTL = 14 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 64 * 1024;

const toBase64 = (buf) => {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const fetchIcon = async (host) => {
  try {
    const res = await fetch(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`, { credentials: 'omit' });
    if (!res.ok) return '';
    const buf = await res.arrayBuffer();
    return buf.byteLength && buf.byteLength < MAX_BYTES ? toBase64(buf) : '';
  } catch {
    return '';
  }
};

const getIcons = async (hosts) => {
  hosts = [...new Set(hosts)].filter((h) => /^[a-z0-9.-]+$/i.test(h)).slice(0, 100);
  const cached = await chrome.storage.local.get(hosts.map((h) => `fav:${h}`));
  const out = {};
  const fresh = {};
  await Promise.all(
    hosts.map(async (host) => {
      const c = cached[`fav:${host}`];
      if (c && Date.now() - c.t < TTL) {
        out[host] = c.d;
        return;
      }
      out[host] = await fetchIcon(host);
      fresh[`fav:${host}`] = { d: out[host], t: Date.now() };
    }),
  );
  if (Object.keys(fresh).length) await chrome.storage.local.set(fresh);
  return out;
};

// Topic labels. Only titles and hostnames are sent, all uncached stories of a page go
// in one request, and results are cached per story id (topic:<id>), so a page that was
// seen before costs nothing.
const { AI_MODELS, TOPICS } = globalThis.HNX;
const TOPIC_IDS = new Set(TOPICS.map((t) => t.id));

const TOPIC_PROMPT = `You sort Hacker News stories into topics. Pick the single best topic for each story from:
${TOPICS.map((t) => `- ${t.id}: ${t.hint}`).join('\n')}
Each input line is "<id><TAB><title> (<site>)". Reply with only a JSON object mapping every id to a topic id, e.g. {"41234567":"science"}.`;

const CHAT_URLS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
};

const readJson = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return data;
};

// OpenAI and DeepSeek share the chat completions format.
const askChat = async (provider, key, model, input) => {
  const body = {
    model,
    messages: [
      { role: 'system', content: TOPIC_PROMPT },
      { role: 'user', content: input },
    ],
    response_format: { type: 'json_object' },
  };
  if (/^(gpt-5|o\d)/.test(model)) body.reasoning_effort = 'minimal';
  const res = await fetch(CHAT_URLS[provider], {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  return (await readJson(res)).choices?.[0]?.message?.content || '';
};

const askClaude = async (key, model, input) => {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      output_config: { effort: 'low' },
      system: TOPIC_PROMPT,
      messages: [{ role: 'user', content: input }],
    }),
  });
  const data = await readJson(res);
  if (data.stop_reason === 'refusal') throw new Error('Request declined by the model');
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
};

const getTopics = async (stories) => {
  const { ai } = await chrome.storage.local.get('ai');
  const provider = ai?.provider;
  const key = ai?.keys?.[provider]?.trim();
  if (!provider || !key) return { topics: {} };

  stories = stories.filter((s) => /^\d+$/.test(s?.id) && typeof s.title === 'string').slice(0, 100);
  const cached = await chrome.storage.local.get(stories.map((s) => `topic:${s.id}`));
  const topics = {};
  const todo = [];
  for (const s of stories) {
    const c = cached[`topic:${s.id}`];
    if (c) topics[s.id] = c.c;
    else todo.push(s);
  }
  if (!todo.length) return { topics };

  const model = ai.models?.[provider]?.trim() || AI_MODELS[provider];
  const input = todo.map((s) => `${s.id}\t${s.title.slice(0, 200)}${s.host ? ` (${s.host})` : ''}`).join('\n');
  try {
    const text = provider === 'anthropic' ? await askClaude(key, model, input) : await askChat(provider, key, model, input);
    const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{}');
    const fresh = {};
    for (const s of todo) {
      const c = String(parsed[s.id] || '').toLowerCase();
      if (!TOPIC_IDS.has(c)) continue;
      topics[s.id] = c;
      fresh[`topic:${s.id}`] = { c, t: Date.now() };
    }
    if (Object.keys(fresh).length) await chrome.storage.local.set(fresh);
    return { topics };
  } catch (err) {
    return { topics, error: String(err?.message || err) };
  }
};

// Stats page: one UTC day of activity from the HN Algolia API. Each day is two counts
// (stories, comments) plus every story that reached 20 points, cached as stats:<day>.
// The one-day view also asks for hourly counts, cached as stats:<day>:h.
const ALGOLIA = 'https://hn.algolia.com/api/v1/search_by_date';

const algolia = async (params) => {
  const res = await fetch(`${ALGOLIA}?${new URLSearchParams(params)}`, { credentials: 'omit' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const hostOf = (url) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : '';
  } catch {
    return '';
  }
};

const cachedDay = async (day, suffix, build) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('bad day');
  const start = Date.parse(`${day}T00:00:00Z`) / 1000;
  const end = start + 86400;
  const key = `stats:${day}${suffix}`;
  const { [key]: cached } = await chrome.storage.local.get(key);
  // Points keep moving for a couple of days after posting; older days are close to final.
  const ttl = Date.now() / 1000 - end > 3 * 86400 ? 24 * 3600e3 : 30 * 60e3;
  if (cached && Date.now() - cached.t < ttl) return cached;
  const out = { t: Date.now(), ...(await build(start, end)) };
  await chrome.storage.local.set({ [key]: out });
  return out;
};

const getStatsDay = (day) =>
  cachedDay(day, '', async (start, end) => {
    const range = `created_at_i>=${start},created_at_i<${end}`;
    const [stories, comments, top] = await Promise.all([
      algolia({ tags: 'story', numericFilters: range, hitsPerPage: 0 }),
      algolia({ tags: 'comment', numericFilters: range, hitsPerPage: 0 }),
      algolia({
        tags: 'story',
        numericFilters: `${range},points>=20`,
        hitsPerPage: 1000,
        attributesToRetrieve: 'title,url,author,points,num_comments,created_at_i',
        attributesToHighlight: '_none_',
      }),
    ]);
    return {
      s: stories.nbHits,
      c: comments.nbHits,
      // [id, title, host, author, points, comments, unix time]
      i: top.hits.map((x) => [Number(x.objectID), x.title || '', hostOf(x.url), x.author, x.points || 0, x.num_comments || 0, x.created_at_i]),
    };
  });

// 24 story counts and 24 comment counts, one per UTC hour.
const getStatsHours = (day) =>
  cachedDay(day, ':h', async (start) => {
    const counts = (tags) =>
      Promise.all(
        Array.from({ length: 24 }, (_, x) =>
          algolia({ tags, numericFilters: `created_at_i>=${start + x * 3600},created_at_i<${start + (x + 1) * 3600}`, hitsPerPage: 0 }).then((r) => r.nbHits),
        ),
      );
    const [s, c] = await Promise.all([counts('story'), counts('comment')]);
    return { s, c };
  });

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'favicons' && Array.isArray(msg.hosts)) {
    getIcons(msg.hosts).then(sendResponse, () => sendResponse({}));
    return true;
  }
  if (msg?.type === 'topics' && Array.isArray(msg.stories)) {
    getTopics(msg.stories).then(sendResponse, (err) => sendResponse({ topics: {}, error: String(err) }));
    return true;
  }
  if (msg?.type === 'statsDay' || msg?.type === 'statsHours') {
    (msg.type === 'statsDay' ? getStatsDay : getStatsHours)(msg.day).then(sendResponse, (err) => sendResponse({ error: String(err?.message || err) }));
    return true;
  }
  return false;
});
