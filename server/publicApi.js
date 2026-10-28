// API publique des prix (v1), pour les autres sites et outils (ex. tlicompendium) : lecture seule, sans clé,
// ouverte à toutes les origines (CORS). Seulement nos prix (relevés de l'hôtel des ventes par les joueurs
// TLI Companion), jamais ceux de TITrack. Un objet n'apparaît que s'il a été vu par au moins 3 joueurs sur
// 7 jours ; un jour de l'historique, seulement s'il a au moins 3 joueurs. Format figé : ne rien retirer ni
// renommer en v1, seulement ajouter des champs. Documentation : /api (public/api.html).
const SITE = 'https://tlicompanion.com';
const MIN_PLAYERS = 3;
const CACHE_S = 600;

module.exports = function ({ db, priceTable, itemName, ITEM_CATS, rateLimit, clientIp, send, HttpError }) {
  const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  const meta = () => ({
    source: 'TLI Companion',
    sourceUrl: SITE,
    attribution: 'Prices: tlicompanion.com',
    docs: `${SITE}/api`,
    currency: 'FE',
    minPlayers: MIN_PLAYERS,
  });
  const icon = (img) => (!img ? null : /^https?:\/\//.test(img) ? img : SITE + (img.startsWith('/') ? '' : '/') + img);
  const round = (v, d = 4) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);

  // Liste de tous les objets : reprend la table de la page Prix (déjà en cache 10 min).
  function list() {
    const t = priceTable();
    const items = t.items
      .filter((i) => i.players >= MIN_PLAYERS)
      .map((i) => ({
        id: i.id,
        name: i.name,
        icon: icon(i.img),
        category: i.cat,
        price: round(i.price),
        players7d: i.players,
        updatedAt: new Date(i.ts).toISOString(),
        change24h: round(i.d1),
        change7d: round(i.d7),
      }));
    return { ...meta(), updatedAt: new Date(t.updatedAt).toISOString(), count: items.length, items };
  }

  // Un objet, avec son historique : prix médian par jour (UTC), plus bas, plus haut, nombre de joueurs.
  const itemCache = new Map();
  function item(id, days) {
    const key = `${id}|${days}`;
    const hit = itemCache.get(key);
    if (hit && Date.now() - hit.at < CACHE_S * 1000) return hit.body;
    const cur = priceTable().items.find((i) => i.id === id && i.players >= MIN_PLAYERS);
    if (!cur) throw new HttpError(404, 'unknown item, or seen by fewer than 3 players in the last 7 days');
    const rows = db.prepare('SELECT price, ts, user_id FROM price_hist WHERE item_id = ? AND ts > ? ORDER BY ts')
      .all(id, Date.now() - days * 86400000);
    const byDay = new Map();
    for (const r of rows) {
      const day = new Date(r.ts).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { prices: [], users: new Set() });
      const d = byDay.get(day);
      d.prices.push(r.price);
      d.users.add(r.user_id);
    }
    const history = [];
    for (const [day, d] of byDay) {
      if (d.users.size < MIN_PLAYERS) continue;
      const p = d.prices.sort((a, b) => a - b);
      const mid = p.length >> 1;
      history.push({ day, median: round(p.length % 2 ? p[mid] : (p[mid - 1] + p[mid]) / 2), low: round(p[0]), high: round(p[p.length - 1]), players: d.users.size });
    }
    const n = itemName(id) || {};
    const body = {
      ...meta(),
      id,
      name: cur.name || n.name || null,
      icon: icon(cur.img || n.img),
      category: (ITEM_CATS && ITEM_CATS[id]) || cur.cat || 'other',
      price: round(cur.price),
      players7d: cur.players,
      updatedAt: new Date(cur.ts).toISOString(),
      change24h: round(cur.d1),
      change7d: round(cur.d7),
      days,
      history,
    };
    itemCache.set(key, { at: Date.now(), body });
    if (itemCache.size > 3000) itemCache.clear();
    return body;
  }

  // Renvoie true si la requête était pour l'API publique (réponse envoyée).
  return function handle(req, res, url) {
    if (!url.pathname.startsWith('/api/public/')) return false;
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, CORS);
        res.end();
        return true;
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method not allowed');
      rateLimit('public:' + clientIp(req), 60, 60000);
      let body;
      let m;
      if (url.pathname === '/api/public/v1/prices') body = list();
      else if ((m = /^\/api\/public\/v1\/prices\/(\d{1,12})$/.exec(url.pathname))) {
        const days = Math.min(120, Math.max(1, Math.trunc(+url.searchParams.get('days')) || 30));
        body = item(+m[1], days);
      } else throw new HttpError(404, `unknown route, see ${SITE}/api`);
      send(res, 200, body, { ...CORS, 'Cache-Control': `public, max-age=${CACHE_S}` });
    } catch (e) {
      const status = e.status || 500;
      if (!e.status) console.error(new Date().toISOString(), 'public api', url.pathname, e);
      send(res, status, { error: e.status ? e.message : 'server error' }, { ...CORS, 'Cache-Control': 'no-store' });
    }
    return true;
  };
};
