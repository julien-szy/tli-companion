// Noms d'objets + prix (manuel > hôtel des ventes local > communauté).
const fs = require('fs');
const path = require('path');
const { FE_ID } = require('./parser');

const COMMUNITY_URL = 'https://qhjulyngunwiculnharg.supabase.co/rest/v1/aggregated_prices';
const COMMUNITY_KEY = 'sb_publishable_YgqYSMUarrM_IKvcNpJlBw_KwTpp7ho';
const COMMUNITY_MAX_AGE_MS = 45 * 24 * 3600 * 1000;

class ItemDb {
  constructor(seedFile) {
    this.items = new Map();
    // Icônes à jour (tlidb a déplacé une partie de ses images ; les anciennes URL renvoient 403).
    let icons = {};
    try { icons = JSON.parse(fs.readFileSync(path.join(path.dirname(seedFile), 'extra_icons.json'), 'utf8')).icons || {}; } catch { /* facultatif */ }
    try {
      const data = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
      for (const it of data.items) {
        const name = it.name_en || it.name_cn || `#${it.id}`;
        this.items.set(+it.id, {
          name,
          type: it.type_cn || '',
          img: icons[name] || it.img || null,
          ...(it.baseItemId ? { base: +it.baseItemId } : {}), // légendaire : sa base (même numéro que la pièce rare)
        });
      }
    } catch (e) {
      console.error('Base objets introuvable :', e.message);
    }
  }
  // Objets absents de la base publique (tlidb) : nom donné par le joueur, sinon « Item #id ».
  get(id) {
    return this.items.get(id) || (this.custom && this.custom[id] ? { name: this.custom[id], type: '', img: null, custom: true } : null)
      || { name: `Item #${id}`, type: '', img: null, unknown: true };
  }
  known(id) { return this.items.has(id) || !!(this.custom && this.custom[id]); }
  search(q, limit = 50) {
    q = q.toLowerCase();
    const out = [];
    for (const [id, name] of Object.entries(this.custom || {})) if (name.toLowerCase().includes(q)) out.push(+id);
    for (const [id, it] of this.items) {
      if (it.name.toLowerCase().includes(q) || String(id) === q) out.push(id);
      if (out.length >= limit) break;
    }
    return out;
  }
}

class PriceBook {
  constructor(file) {
    this.file = file;
    this.exchange = {};  // id -> { price, ts }
    this.exHistory = {}; // id -> [[ts, prix], …] tes vérifications à l'HdV (courbe de prix)
    this.manual = {};    // id -> price
    this.community = {}; // id -> { price, ts, devices }  (base TITrack)
    this.server = {};    // id -> { price, ts, n }        (notre serveur, n = nb de joueurs)
    this.communityFetchedAt = 0;
    try {
      const d = JSON.parse(fs.readFileSync(file, 'utf8'));
      Object.assign(this.exchange, d.exchange || {});
      Object.assign(this.exHistory, d.exHistory || {});
      Object.assign(this.manual, d.manual || {});
      Object.assign(this.community, d.community || {});
      this.communityFetchedAt = d.communityFetchedAt || 0;
    } catch { /* premier lancement */ }
    this._saveTimer = null;
  }

  // Prix unitaire en FE + source. market = true : prix du marché seul, sans le prix manuel du joueur
  // (stats partagées : un prix tapé à la main ne doit pas fausser les moyennes des autres).
  get(id, market = false) {
    if (id === FE_ID) return { price: 1, source: 'fe' };
    if (!market && this.manual[id] != null) return { price: this.manual[id], source: 'manuel' };
    // Objet sans nom (« Item #1234 ») : jamais compté, sauf prix manuel ou nom donné par le joueur.
    if (this.isKnown && !this.isKnown(id)) {
      const any = this.exchange[id] || this.server[id] || this.community[id];
      return { price: 0, source: 'nonconfirme', ts: any && any.ts, ignoredPrice: any ? any.price : null };
    }
    // Le prix le plus récent gagne, quelle que soit sa source : ton propre prix vu à l'HdV,
    // celui des joueurs TLI Companion (serveur) ou la base communautaire.
    const ex = this.exchange[id], sv = this.server[id], tc = this.community[id];
    const cands = [
      ex && { price: ex.price, source: 'hdv', ts: ex.ts },
      sv && { price: sv.price, source: 'serveur', ts: sv.ts, players: sv.n || null },
      tc && { price: tc.price, source: 'communauté', ts: tc.ts, players: tc.devices || null },
    ].filter((c) => c && c.price > 0);
    if (cands.length) return cands.reduce((a, c) => ((c.ts || 0) > (a.ts || 0) ? c : a));
    return { price: 0, source: 'inconnu' };
  }
  value(id) { return this.get(id).price; }

  // Prix de référence = 10e percentile des annonces (évite les annonces pièges).
  setFromExchange(id, prices, ts) {
    const sorted = [...prices].sort((a, b) => a - b);
    const p = sorted[Math.floor(0.1 * (sorted.length - 1))];
    const prev = this.exchange[id];
    if (prev && prev.ts > ts) return false;
    this.exchange[id] = { price: p, ts };
    const h = (this.exHistory[id] = this.exHistory[id] || []);
    if (!h.length || h[h.length - 1][0] !== ts) { h.push([ts, p]); if (h.length > 200) h.splice(0, h.length - 200); }
    this._scheduleSave();
    return true;
  }

  setManual(id, price) {
    if (price == null || price === '' || isNaN(price)) delete this.manual[id];
    else this.manual[id] = +price;
    this._scheduleSave();
  }

  // Prix communautaires : copie de notre serveur en priorité (fetchMirror), sinon TITrack directement.
  async fetchCommunity(fetchMirror) {
    if (fetchMirror) {
      try {
        const m = await fetchMirror();
        const n = m && m.prices ? Object.keys(m.prices).length : 0;
        if (n >= 100 && Date.now() - m.fetchedAt < 2 * 3600 * 1000) {
          this.community = m.prices;
          this.communityFetchedAt = Date.now();
          this._scheduleSave();
          return n;
        }
      } catch { /* serveur injoignable : TITrack directement */ }
    }
    const result = {};
    const pageSize = 1000;
    for (let offset = 0; offset < 50000; offset += pageSize) {
      const url = `${COMMUNITY_URL}?select=config_base_id,price_fe_median,unique_devices,updated_at` +
        `&order=updated_at.desc&limit=${pageSize}&offset=${offset}`;
      const res = await fetch(url, { headers: { apikey: COMMUNITY_KEY } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = await res.json();
      for (const r of rows) {
        const ts = Date.parse(r.updated_at);
        if (Date.now() - ts > COMMUNITY_MAX_AGE_MS) continue;
        if (result[r.config_base_id]) continue; // déjà la ligne la plus récente
        result[r.config_base_id] = { price: r.price_fe_median, ts, devices: r.unique_devices };
      }
      if (rows.length < pageSize) break;
      const last = rows[rows.length - 1];
      if (Date.now() - Date.parse(last.updated_at) > COMMUNITY_MAX_AGE_MS) break;
    }
    this.community = result;
    this.communityFetchedAt = Date.now();
    this._scheduleSave();
    return Object.keys(result).length;
  }

  setServerPrices(map) {
    this.server = map || {};
  }

  list() {
    const ids = new Set([...Object.keys(this.exchange), ...Object.keys(this.manual), ...Object.keys(this.community), ...Object.keys(this.server)]);
    return [...ids].map(Number);
  }

  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.save(), 2000);
  }
  save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify({
        exchange: this.exchange, exHistory: this.exHistory, manual: this.manual,
        community: this.community, communityFetchedAt: this.communityFetchedAt,
      }));
    } catch (e) { console.error('Sauvegarde des prix impossible :', e.message); }
  }
}

module.exports = { ItemDb, PriceBook };
