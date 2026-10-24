// Client du serveur communautaire (partage des sessions, prix partagés).
const zlib = require('zlib');
class CommunityClient {
  constructor(settings, save) {
    this.settings = settings; // settings.server = { url, token, userId, name }
    this.save = save;
    this.queue = new Map();   // prix HdV observés en attente d'envoi : id -> { id, price, ts }
  }

  get cfg() { return this.settings.server; }
  get registered() { return !!(this.cfg && this.cfg.token); }

  async _req(method, path, body, authed = true, gzip = false) {
    const headers = { 'Content-Type': 'application/json', 'X-TLI-Version': require('electron').app.getVersion() };
    if (gzip) headers['Content-Encoding'] = 'gzip';
    if (authed === 'optional') { if (this.registered) headers.Authorization = `Bearer ${this.cfg.token}`; }
    else if (authed) {
      if (!this.registered) throw new Error('no username yet');
      headers.Authorization = `Bearer ${this.cfg.token}`;
    }
    const res = await fetch(this.cfg.url.replace(/\/$/, '') + path, {
      method, headers, signal: AbortSignal.timeout(gzip ? 60000 : 15000),
      body: body ? (gzip ? zlib.gzipSync(JSON.stringify(body)) : JSON.stringify(body)) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    // 426 = version trop ancienne pour le serveur : on prévient l'app pour qu'elle cherche la mise à jour tout de suite.
    if (res.status === 426 && this.onOutdated) this.onOutdated();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  async register(name) {
    if (this.registered) {
      const r = await this._req('PATCH', '/api/me', { name });
      this.cfg.name = r.name;
    } else {
      const r = await this._req('POST', '/api/register', { name }, false);
      Object.assign(this.cfg, { token: r.token, userId: r.userId, name: r.name });
    }
    this.save();
    return { name: this.cfg.name };
  }

  share(report) { return this._req('POST', '/api/reports', report); }
  // Compte Google (bêta) : l'app demande un code, ouvre le navigateur, puis attend son jeton.
  appLoginStart() { return this._req('POST', '/api/auth/app/start', null, 'optional'); }
  appLoginPoll(code) { return this._req('GET', `/api/auth/app/poll?code=${encodeURIComponent(code)}`, null, false); }
  logout() { return this._req('POST', '/api/auth/logout', null, 'optional'); }
  myContent() { return this._req('GET', '/api/me/content'); }
  vote(kind, id, value) { return this._req('POST', '/api/votes', { kind, id, value }); }
  comments(kind, id) { return this._req('GET', `/api/comments?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`, null, 'optional'); }
  commentPost(kind, id, body, parentId) { return this._req('POST', '/api/comments', { kind, id, body, parentId }); }
  commentEdit(cid, body) { return this._req('PATCH', `/api/comments/${encodeURIComponent(cid)}`, { body }); }
  commentDelete(cid) { return this._req('DELETE', `/api/comments/${encodeURIComponent(cid)}`); }
  uploadMeta(payload) { return this._req('POST', '/api/meta', payload, this.registered, true); }
  metaPlayers(server, season, mode, hero, { sort = 'rank', limit = 50, offset = 0 } = {}) {
    const q = new URLSearchParams({ server, season: String(season), mode: String(mode), hero: String(hero), sort, limit: String(limit), offset: String(offset) });
    return this._req('GET', `/api/meta/players?${q}`, null, false);
  }
  aiStatus() { return this._req('GET', '/api/ai/status', null, false); }
  aiChat(body) { return this._req('POST', '/api/ai/chat', body, 'optional', true); }
  priceHistory(id, days) { return this._req('GET', `/api/prices/history/${+id}?days=${+days || 30}`, null, false); }
  sendFeedback(body) { return this._req('POST', '/api/feedback', body, false); }
  sendFarmStats(body) { return this._req('POST', '/api/stats/farm', body, false); }
  compareStats({ region, tier }) { return this._req('GET', `/api/stats/compare?region=${encodeURIComponent(region || '')}&tier=${encodeURIComponent(tier || '')}`, null, false); }
  communityPrices() { return this._req('GET', '/api/prices/community', null, false); }
  version() { return this._req('GET', '/api/version', null, false); }
  metaIndex() { return this._req('GET', '/api/meta/index', null, false); }
  metaSnapshot(server, season, mode) {
    const q = new URLSearchParams({ server, season: String(season), mode: String(mode) });
    return this._req('GET', `/api/meta?${q}`, null, false);
  }
  voteHero(heroId, key) { return this._req('POST', '/api/heromap', { heroId, key }, this.registered); }
  heroMap() { return this._req('GET', '/api/heromap', null, false); }
  shareBuild(build) { return this._req('POST', '/api/builds', build); }
  unshareBuild(id) { return this._req('DELETE', `/api/builds/${id}`); }
  // Builds publiés : { hero, tree, q, sort } (tous facultatifs).
  listBuilds(f = {}) {
    if (typeof f === 'string') f = { hero: f };
    const p = new URLSearchParams();
    for (const k of ['hero', 'tree', 'q', 'sort']) if (f[k]) p.set(k, String(f[k]).slice(0, 60));
    const qs = p.toString();
    return this._req('GET', '/api/builds' + (qs ? '?' + qs : ''), null, false);
  }
  likeBuild(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('invalid id');
    return this._req('POST', `/api/builds/${id}/like`);
  }
  getBuild(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('invalid id');
    return this._req('GET', `/api/builds/${id}`, null, false);
  }
  unshare(id) { return this._req('DELETE', `/api/reports/${id}`); }
  siteUrl(path = '/') { return this.cfg.url.replace(/\/$/, '') + path; }

  queuePrice(id, price, ts) { this.queue.set(id, { id, price, ts }); }

  // Prix vus à l'hôtel des ventes (lus dans le log). Avec un compte : envoyés avec le compte.
  // Sans compte : envoyés anonymement si les stats anonymes sont activées.
  async flushPrices() {
    const anon = !this.registered;
    if (!this.queue.size || (anon && !(this.settings.shareFarmStats && this.settings.anonId))) return 0;
    const observations = [...this.queue.values()];
    this.queue.clear();
    try {
      const r = anon
        ? await this._req('POST', '/api/prices/anon', { anonId: this.settings.anonId, observations }, false)
        : await this._req('POST', '/api/prices', { observations });
      return r.accepted;
    } catch (e) {
      for (const o of observations) if (!this.queue.has(o.id)) this.queue.set(o.id, o); // on réessaiera
      throw e;
    }
  }

  async fetchPrices() {
    const r = await this._req('GET', '/api/prices', null, false);
    return r.prices || {};
  }
}

module.exports = { CommunityClient };
