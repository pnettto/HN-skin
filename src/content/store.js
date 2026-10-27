// Per-item reading history, kept locally:
//   s:<id> = { t: last visit (ms), c: comment count at visit, m: highest comment id seen,
//              l: link opened (ms), x: collapsed comment ids }
// HN ids are monotonic, so "id > m" means the comment is new since the last visit.
(() => {
  const HNX = globalThis.HNX;
  const MAX_ENTRIES = 5000;
  const key = (id) => `s:${id}`;

  const local = () => {
    try {
      return chrome.runtime?.id ? chrome.storage.local : null;
    } catch {
      return null; // extension was reloaded; this page's context is stale
    }
  };

  HNX.store = {
    async getMany(ids) {
      const out = {};
      const area = local();
      if (!area || !ids.length) return out;
      try {
        const res = await area.get(ids.map(key));
        for (const id of ids) if (res[key(id)]) out[id] = res[key(id)];
      } catch {}
      return out;
    },

    async get(id) {
      return (await this.getMany([id]))[id] || null;
    },

    async patch(id, partial) {
      const area = local();
      if (!area) return;
      try {
        const prev = (await this.get(id)) || {};
        await area.set({ [key(id)]: { ...prev, ...partial } });
      } catch {}
      if (Math.random() < 0.03) this.prune();
    },

    async prune() {
      const area = local();
      if (!area) return;
      try {
        const all = await area.get(null);
        const stale = Object.entries(all).filter(([k, v]) => /^(fav|topic):/.test(k) && Date.now() - v.t > 30 * 864e5);
        if (stale.length) await area.remove(stale.map(([k]) => k));
        const entries = Object.entries(all).filter(([k]) => k.startsWith('s:'));
        if (entries.length <= MAX_ENTRIES) return;
        entries.sort((a, b) => (a[1].t || a[1].l || 0) - (b[1].t || b[1].l || 0));
        await area.remove(entries.slice(0, entries.length - MAX_ENTRIES * 0.8).map(([k]) => k));
      } catch {}
    },
  };
})();
