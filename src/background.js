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

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== 'favicons' || !Array.isArray(msg.hosts)) return false;
  getIcons(msg.hosts).then(sendResponse, () => sendResponse({}));
  return true;
});
