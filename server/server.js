// Serveur communautaire TLI Companion : API de partage des sessions de farm, prix partagés et site web.
// Aucune dépendance externe : node:http + node:sqlite (Node 22.13+).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { openDb } = require('./db');
const AI = require('./ai');
const TITrack = require('./titrack');
const { sanitizeReport, sanitizeBuild, sanitizeMeta, parseMapName, sanitizeFarmStats, sanitizeFeedback } = require('./sanitize');

const PORT = +(process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY = 512 * 1024;

const db = openDb(DATA_DIR);
TITrack.start(DATA_DIR);
// Anciennes sessions : région et Timemark déduits du nom de la carte.
for (const row of db.prepare('SELECT id, main_map FROM reports WHERE region IS NULL AND main_map IS NOT NULL').all()) {
  const { region, timemark } = parseMapName(row.main_map);
  db.prepare('UPDATE reports SET region = ?, timemark = ? WHERE id = ?').run(region, timemark, row.id);
}
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Extensions locales facultatives (dossier non publié) : sans elles, le serveur fonctionne pareil.
const ext = (() => { try { return require('./local')({ db, DATA_DIR, clientIp: (req) => clientIp(req), sha256 }); } catch { return {}; } })();

// ---------------- Utilitaires HTTP ----------------

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'object' && !Buffer.isBuffer(body) ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  });
  res.end(data);
}

// maxBody : taille max reçue ; les requêtes compressées (Content-Encoding: gzip) sont décompressées
// avec une limite de 8 Mo pour éviter les « bombes » de compression.
function readJson(req, maxBody = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBody) { reject(new HttpError(413, 'request too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        let buf = Buffer.concat(chunks);
        if ((req.headers['content-encoding'] || '').toLowerCase() === 'gzip') buf = zlib.gunzipSync(buf, { maxOutputLength: 8 * 1024 * 1024 });
        resolve(buf.length ? JSON.parse(buf.toString('utf8')) : {});
      } catch { reject(new HttpError(400, 'invalid JSON')); }
    });
    req.on('error', reject);
  });
}

// Limite de débit simple en mémoire : `max` requêtes par `windowMs` par clé.
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  if (++b.count > max) throw new HttpError(429, 'too many requests, try again later');
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k); }, 60000).unref();

function clientIp(req) {
  // Derrière Caddy : l'IP réelle est dans X-Forwarded-For (Caddy écrase la valeur fournie par le client).
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
}

// Qui fait la requête : jeton de l'app ou cookie du site (voir accounts.js).
function auth(req) { return Accounts.auth(req); }

function cleanName(n) {
  n = String(n || '').normalize('NFKC').replace(/[\u0000-\u001f<>]/g, '').trim();
  if (n.length < 2 || n.length > 24) throw new HttpError(400, 'username: 2 to 24 characters');
  return n;
}

// ---------------- Routes API ----------------

const routes = [];
const route = (method, pattern, handler) => routes.push({ method, pattern, handler });
const Accounts = require('./accounts')({ db, route, HttpError, sha256, clientIp, rateLimit, readJson, DATA_DIR });
const Social = require('./social')({ db, route, HttpError, rateLimit, readJson, Accounts });

route('GET', /^\/api\/health$/, () => ({ ok: true, time: Date.now() }));

// Inscription anonyme : renvoie un jeton secret que l'app garde.
route('POST', /^\/api\/register$/, async (req) => {
  rateLimit('register:' + clientIp(req), 5, 3600000);
  const body = await readJson(req);
  const name = cleanName(body.name);
  const token = crypto.randomBytes(32).toString('base64url');
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO users (id, name, token_hash, created_at) VALUES (?, ?, ?, ?)').run(id, name, sha256(token), Date.now());
  return { userId: id, name, token };
});

// Publier (ou mettre à jour) une fiche de session.
route('POST', /^\/api\/reports$/, async (req) => {
  const u = auth(req);
  rateLimit('report:' + u.id, 30, 3600000);
  const r = sanitizeReport(await readJson(req));
  const existing = db.prepare('SELECT user_id FROM reports WHERE id = ?').get(r.id);
  if (existing && existing.user_id !== u.id) throw new HttpError(403, 'this session belongs to someone else');
  const mainMap = r.strategy.maps[0] ? r.strategy.maps[0].name : null;
  const t = r.totals;
  const { region, timemark } = parseMapName(mainMap);
  // Consommables (compas, sondes…) : « |id|id| » pour filtrer avec LIKE.
  const cons = r.strategy.consumables.length ? '|' + r.strategy.consumables.map((c) => c.id).join('|') + '|' : null;
  db.prepare(`INSERT INTO reports (id, user_id, hero_id, hero_name, title, main_map, profit, per_hour_real, per_hour_map, runs, real_ms, started_at, created_at, json,
      region, timemark, strategy_tag, server_region, season, consumables)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET hero_id = excluded.hero_id, hero_name = excluded.hero_name, title = excluded.title,
      main_map = excluded.main_map, profit = excluded.profit, per_hour_real = excluded.per_hour_real,
      per_hour_map = excluded.per_hour_map, runs = excluded.runs, real_ms = excluded.real_ms, json = excluded.json,
      region = excluded.region, timemark = excluded.timemark, strategy_tag = excluded.strategy_tag,
      server_region = excluded.server_region, season = excluded.season, consumables = excluded.consumables`)
    .run(r.id, u.id, r.hero ? r.hero.id : null, r.hero ? r.hero.name : null, r.title, mainMap,
      t.profit, t.perHourReal, t.perHourMap, t.runs, t.realMs, r.startedAt, Date.now(), JSON.stringify(r),
      region, timemark, r.strategyTag, r.context ? r.context.server : null, r.context ? r.context.season : null, cons);
  bestCache.clear();
  if (r.hero && r.hero.name && !/^(Hero|Héros) \d+$/.test(r.hero.name)) {
    db.prepare('INSERT INTO hero_names (hero_id, user_id, name) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET name = excluded.name')
      .run(r.hero.id, u.id, r.hero.name.slice(0, 60));
  }
  return { id: r.id, url: `/s/${r.id}` };
});

const SORTS = {
  perhour: 'per_hour_real DESC',
  perhourmap: 'per_hour_map DESC',
  profit: 'profit DESC',
  recent: 'created_at DESC',
  likes: '(likes - dislikes) DESC, likes DESC, created_at DESC',
};

// Nom le plus proposé pour chaque héros.
function heroNameMap() {
  const rows = db.prepare('SELECT hero_id, name, COUNT(*) n FROM hero_names GROUP BY hero_id, name ORDER BY n DESC').all();
  const out = {};
  for (const r of rows) if (!(r.hero_id in out)) out[r.hero_id] = r.name;
  return out;
}

// Filtres communs : classe, région, Timemark, type de stratégie, consommable, serveur, carte exacte, joueur.
function reportFilters(q) {
  const where = ['u.banned = 0', 'r.runs >= ?'];
  const args = [Math.max(1, +q.get('minRuns') || 3)];
  if (q.get('hero')) { where.push('r.hero_id = ?'); args.push(+q.get('hero')); }
  if (q.get('map')) { where.push('r.main_map = ?'); args.push(q.get('map')); }
  if (q.get('region')) { where.push('r.region = ?'); args.push(q.get('region')); }
  if (q.get('tier')) { where.push('r.timemark = ?'); args.push(+q.get('tier')); }
  if (q.get('tag')) { where.push('r.strategy_tag = ?'); args.push(q.get('tag')); }
  if (q.get('item')) { where.push('r.consumables LIKE ?'); args.push(`%|${+q.get('item')}|%`); }
  if (q.get('server')) { where.push('r.server_region = ?'); args.push(q.get('server')); }
  if (q.get('user')) { where.push('r.user_id = ?'); args.push(q.get('user')); }
  return { where, args };
}

route('GET', /^\/api\/reports$/, (req, url) => {
  const q = url.searchParams;
  const { where, args } = reportFilters(q);
  const sort = SORTS[q.get('sort')] || SORTS.perhour;
  const limit = Math.min(100, Math.max(1, +q.get('limit') || 50));
  const offset = Math.max(0, +q.get('offset') || 0);
  const rows = db.prepare(`SELECT r.id, r.user_id, u.name AS author, r.hero_id, r.hero_name, r.title, r.main_map, r.profit,
      r.per_hour_real, r.per_hour_map, r.runs, r.real_ms, r.started_at, r.created_at, r.likes,
      r.region, r.timemark, r.strategy_tag, r.server_region
    FROM reports r JOIN users u ON u.id = r.user_id WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT ? OFFSET ?`)
    .all(...args, limit, offset);
  const names = heroNameMap();
  for (const r of rows) r.hero_display = names[r.hero_id] || r.hero_name;
  return { reports: rows };
});

route('GET', /^\/api\/reports\/([0-9a-f-]{36})$/, (req, url, m) => {
  const row = db.prepare(`SELECT r.json, r.user_id, r.likes, r.dislikes, r.created_at, u.name AS author FROM reports r
    JOIN users u ON u.id = r.user_id WHERE r.id = ? AND u.banned = 0`).get(m[1]);
  if (!row) throw new HttpError(404, 'session not found');
  const names = heroNameMap();
  const report = JSON.parse(row.json);
  if (report.hero && names[report.hero.id]) report.hero.display = names[report.hero.id];
  return { report, author: row.author, userId: row.user_id, likes: row.likes, dislikes: row.dislikes, myVote: Social.myVote(req, 'report', m[1]), createdAt: row.created_at };
});

route('DELETE', /^\/api\/reports\/([0-9a-f-]{36})$/, (req, url, m) => {
  const u = auth(req);
  const r = db.prepare('DELETE FROM reports WHERE id = ? AND user_id = ?').run(m[1], u.id);
  if (!r.changes) throw new HttpError(404, 'session not found');
  return { deleted: true };
});

route('POST', /^\/api\/reports\/([0-9a-f-]{36})\/like$/, (req, url, m) => {
  const u = auth(req);
  rateLimit('like:' + u.id, 120, 3600000);
  const ins = db.prepare('INSERT OR IGNORE INTO likes (user_id, report_id) VALUES (?, ?)').run(u.id, m[1]);
  if (ins.changes) db.prepare('UPDATE reports SET likes = likes + 1 WHERE id = ?').run(m[1]);
  return { liked: true };
});

// Filtres disponibles pour le site / l'app.
route('GET', /^\/api\/stats$/, () => {
  const names = heroNameMap();
  const heroes = db.prepare('SELECT hero_id, COUNT(*) n, AVG(per_hour_real) avg FROM reports WHERE hero_id IS NOT NULL GROUP BY hero_id ORDER BY n DESC').all()
    .map((h) => ({ ...h, name: names[h.hero_id] || `Hero ${h.hero_id}` }));
  const maps = db.prepare('SELECT main_map, COUNT(*) n, AVG(per_hour_real) avg FROM reports WHERE main_map IS NOT NULL GROUP BY main_map ORDER BY n DESC LIMIT 50').all();
  const totals = db.prepare('SELECT COUNT(*) reports, COUNT(DISTINCT user_id) players FROM reports').get();
  // Chiffres de la page d'accueil : cartes des stats anonymes et objets dont le prix vient de nos joueurs.
  Object.assign(totals, db.prepare('SELECT COUNT(*) farmSessions, COALESCE(SUM(runs), 0) farmMaps FROM farm_stats').get());
  totals.pricedItems = db.prepare('SELECT COUNT(DISTINCT item_id) n FROM price_obs').get().n;
  const regions = db.prepare('SELECT region, COUNT(*) n FROM reports WHERE region IS NOT NULL GROUP BY region ORDER BY n DESC LIMIT 60').all();
  const tiers = db.prepare('SELECT timemark, COUNT(*) n FROM reports WHERE timemark IS NOT NULL GROUP BY timemark ORDER BY timemark DESC').all();
  const tags = db.prepare('SELECT strategy_tag tag, COUNT(*) n FROM reports WHERE strategy_tag IS NOT NULL GROUP BY strategy_tag ORDER BY n DESC').all();
  const servers = db.prepare('SELECT server_region server, COUNT(*) n FROM reports WHERE server_region IS NOT NULL GROUP BY server_region ORDER BY n DESC').all();
  // Consommables les plus utilisés (compas, sondes…), avec leur nom et icône.
  const items = {};
  for (const row of db.prepare('SELECT json FROM reports ORDER BY created_at DESC LIMIT 2000').all()) {
    for (const c of JSON.parse(row.json).strategy.consumables || []) {
      const it = (items[c.id] = items[c.id] || { id: c.id, name: c.name, img: c.img, n: 0 });
      it.n++;
    }
  }
  return { heroes, maps, totals, regions, tiers, tags, servers, items: Object.values(items).sort((a, b) => b.n - a.n).slice(0, 60) };
});

// ---------------- Avis des joueurs ----------------
// Texte brut seulement (8 Ko max par envoi), requête préparée, 3 avis par heure et 10 par jour par adresse.
route('POST', /^\/api\/feedback$/, async (req) => {
  rateLimit('feedback-h:' + clientIp(req), 3, 3600000);
  rateLimit('feedback-d:' + clientIp(req), 10, 86400000);
  if (req.headers['content-encoding']) throw new HttpError(415, 'compressed body not accepted');
  const f = sanitizeFeedback(await readJson(req, 8 * 1024));
  const version = String(req.headers['x-tli-version'] || '').replace(/[^\w.-]/g, '').slice(0, 20) || null;
  db.prepare('INSERT INTO feedback (created_at, type, message, contact, version, source, lang) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(Date.now(), f.type, f.message, f.contact, version, f.source, f.lang);
  return { ok: true };
});

// ---------------- Statistiques de farm anonymes ----------------
const bestCache = new Map();
// Un chiffre n'est affiché que s'il repose sur au moins 3 joueurs différents (personne n'est identifiable).
const MIN_PLAYERS = 3;
route('POST', /^\/api\/stats\/farm$/, async (req) => {
  rateLimit('farmstats:' + clientIp(req), 30, 3600000);
  const s = sanitizeFarmStats(await readJson(req));
  const contributor = sha256('farm-stats:' + s.anonId);
  const existing = db.prepare('SELECT contributor FROM farm_stats WHERE id = ?').get(s.id);
  if (existing && existing.contributor !== contributor) throw new HttpError(403, 'not yours');
  const { region, timemark } = parseMapName(s.mainMap);
  const cons = s.consumables.length ? '|' + s.consumables.map((c) => c.id).join('|') + '|' : null;
  db.prepare(`INSERT INTO farm_stats (id, contributor, created_at, hero_id, main_map, region, timemark, strategy_tag, server_region, season,
      runs, real_ms, map_ms, afk_ms, profit, per_hour, consumables, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET strategy_tag = excluded.strategy_tag, json = excluded.json`)
    .run(s.id, contributor, Date.now(), s.heroId, s.mainMap, region, timemark, s.strategyTag, s.server, s.season,
      s.runs, s.realMs, s.mapMs, s.afkMs, s.profit, s.perHour, cons, JSON.stringify({ loot: s.loot, consumables: s.consumables, modifiers: s.modifiers }));
  bestCache.clear();
  return { ok: true };
});

function statsFilters(q) {
  const where = ['1 = 1'];
  const args = [];
  if (q.get('hero')) { where.push('hero_id = ?'); args.push(+q.get('hero')); }
  if (q.get('region')) { where.push('region = ?'); args.push(q.get('region')); }
  if (q.get('tier')) { where.push('timemark = ?'); args.push(+q.get('tier')); }
  if (q.get('tag')) { where.push('strategy_tag = ?'); args.push(q.get('tag')); }
  if (q.get('item')) { where.push('consumables LIKE ?'); args.push(`%|${+q.get('item')}|%`); }
  if (q.get('server')) { where.push('server_region = ?'); args.push(q.get('server')); }
  // Saison en cours seulement (les 120 derniers jours au plus).
  where.push('created_at > ?'); args.push(Date.now() - 120 * 86400000);
  return { where, args };
}
const quantile = (sorted, q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1) + 0.5))] : 0);

// Comparaison pour l'app : « ton FE/h sur cette carte » face à la communauté (même carte, même Timemark).
route('GET', /^\/api\/stats\/compare$/, (req, url) => {
  const q = url.searchParams;
  const { where, args } = statsFilters(q);
  const rows = db.prepare(`SELECT contributor, per_hour, json FROM farm_stats WHERE ${where.join(' AND ')}`).all(...args);
  const players = new Set(rows.map((r) => r.contributor)).size;
  if (players < MIN_PLAYERS) return { enough: false, sessions: rows.length, players, needed: MIN_PLAYERS };
  const ph = rows.map((r) => r.per_hour).sort((a, b) => a - b);
  // Consommables des meilleures sessions (quart supérieur) : « ce que font ceux qui gagnent le plus ».
  const p75 = quantile(ph, 0.75);
  const items = {};
  for (const r of rows.filter((x) => x.per_hour >= p75)) {
    for (const c of JSON.parse(r.json).consumables || []) {
      const it = (items[c.id] = items[c.id] || { id: c.id, name: c.name, img: c.img, n: 0 });
      it.n++;
    }
  }
  return { enough: true, sessions: rows.length, players, median: quantile(ph, 0.5), p90: quantile(ph, 0.9),
    avg: ph.reduce((a, b) => a + b, 0) / ph.length, topItems: Object.values(items).sort((a, b) => b.n - a.n).slice(0, 4) };
});

// Stratégies les plus rentables : sessions regroupées par région + Timemark + type,
// profit recalculé avec les prix actuels de la communauté (sinon le prix au moment de la session).
// Prix « actuel » d'un objet pour la stratégie globale : nos joueurs si au moins 2 le confirment,
// sinon la copie TITrack (2 joueurs ou plus), sinon notre prix à 1 joueur, sinon le prix au moment de la session.
// Noms et icônes des objets (copie de la base de l'app), pour nommer le loot des stats anonymes.
let ITEM_NAMES = {};
try { ITEM_NAMES = JSON.parse(fs.readFileSync(path.join(__dirname, 'item_names_seed.json'), 'utf8')); } catch { /* facultatif */ }
function reliablePrices() {
  const ours = currentPrices().prices;
  const tc = TITrack.get().prices || {};
  return (id, old) => {
    const o = ours[id], c = tc[id];
    if (o && o.n >= 2) return o.price;
    if (c && (c.devices || 0) >= 5) return c.price;
    // Prix peu confirmés (ex. souvenirs de héros, dont la qualité change tout) : on garde le plus bas, par prudence.
    const low = [o && o.price, c && c.price].filter((v) => typeof v === 'number');
    if (low.length) return Math.min(...low);
    return old ?? 0;
  };
}

route('GET', /^\/api\/strategies\/best$/, (req, url) => {
  const q = url.searchParams;
  const key = q.toString();
  const hit = bestCache.get(key);
  if (hit && Date.now() - hit.at < 5 * 60000) return hit.body;
  const { where, args } = statsFilters(q);
  const rows = db.prepare(`SELECT contributor, region, timemark, strategy_tag, hero_id, runs, real_ms, map_ms, afk_ms, per_hour, json
    FROM farm_stats WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 5000`).all(...args);
  const priceNow = reliablePrices();
  const nameStmt = db.prepare('SELECT name, img FROM item_names WHERE id = ?');
  const nameOf = { get: (id) => { const n = ITEM_NAMES[id]; return n ? { name: n[0], img: n[1] } : nameStmt.get(id); } };
  const groups = {};
  for (const row of rows) {
    const d = JSON.parse(row.json);
    let value = 0;
    const k = `${row.region || '?'}|${row.timemark ?? ''}|${row.strategy_tag || ''}`;
    const g = (groups[k] = groups[k] || { region: row.region, timemark: row.timemark, tag: row.strategy_tag, sessions: 0, players: new Set(),
      hours: 0, mapHours: 0, runs: 0, valueNow: 0, valueThen: 0, heroes: {}, items: {}, loot: {}, mods: {}, modSessions: 0 });
    for (const i of d.loot) {
      const v = i.qty * priceNow(i.id, i.unit);
      value += v;
      const l = (g.loot[i.id] = g.loot[i.id] || { id: i.id, name: i.name || null, img: i.img || null, qty: 0, value: 0 });
      l.qty += i.qty; l.value += v;
      if (!l.name && i.name) { l.name = i.name; l.img = i.img || null; }
    }
    for (const c of d.consumables) {
      const v = (c.qty || 0) * priceNow(c.id, c.unit); // qty < 0 : coût
      value += v;
      const it = (g.items[c.id] = g.items[c.id] || { id: c.id, name: c.name, img: c.img, n: 0, qty: 0, cost: 0 });
      it.n++; it.qty += -(c.qty || 0); it.cost += -v;
    }
    if ((d.modifiers || []).length) {
      g.modSessions++;
      for (const m of d.modifiers) {
        const mm = (g.mods[m.desc] = g.mods[m.desc] || { desc: m.desc, sessions: 0, perMap: 0 });
        mm.sessions++; mm.perMap += m.perMap;
      }
    }
    const hours = Math.max(row.real_ms, 60000) / 3600000;
    g.sessions++; g.players.add(row.contributor); g.hours += hours; g.mapHours += row.map_ms / 3600000; g.runs += row.runs;
    g.valueNow += value; g.valueThen += row.per_hour * hours;
    if (row.hero_id != null) g.heroes[row.hero_id] = (g.heroes[row.hero_id] || 0) + 1;
  }
  const names = heroNameMap();
  const all = Object.values(groups);
  const best = all.filter((g) => g.players.size >= MIN_PLAYERS).map((g) => {
    const lootTotal = Object.values(g.loot).reduce((a, l) => a + Math.max(0, l.value), 0) || 1;
    const topLoot = Object.values(g.loot).filter((l) => l.value > 0).sort((a, b) => b.value - a.value).slice(0, 4).map((l) => {
      if (!l.name) { const n = nameOf.get(l.id); if (n) { l.name = n.name; l.img = n.img; } }
      return { id: l.id, name: l.name || null, img: l.img || null, perMap: l.qty / g.runs, share: l.value / lootTotal, fePerHour: l.value / g.hours };
    });
    return {
      region: g.region, timemark: g.timemark, tag: g.tag, sessions: g.sessions, players: g.players.size,
      hours: Math.round(g.hours * 10) / 10, efficiency: g.hours ? g.mapHours / g.hours : null,
      mapsPerHour: g.runs / g.hours, avgMapMin: g.runs ? (g.mapHours * 60) / g.runs : null,
      perHourNow: g.valueNow / g.hours, perHourThen: g.valueThen / g.hours,
      heroes: Object.entries(g.heroes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, n]) => ({ id: +id, name: names[id] || null, n })),
      items: Object.values(g.items).sort((a, b) => b.n - a.n).slice(0, 6).map((i) => ({ ...i, perMap: i.qty / g.runs, costPerMap: i.cost / g.runs })),
      topLoot,
      mechanics: Object.values(g.mods).sort((a, b) => b.sessions - a.sessions || b.perMap - a.perMap).slice(0, 12)
        .map((m) => ({ desc: m.desc, share: m.sessions / g.modSessions, perMap: m.perMap / m.sessions })),
      mechanicsKnown: g.modSessions,
    };
  }).sort((a, b) => b.perHourNow - a.perHourNow).slice(0, 30);
  // Groupes pas encore assez fournis : on dit juste combien de sessions attendent d'autres joueurs.
  const pending = all.filter((g) => g.players.size < MIN_PLAYERS).reduce((n, g) => n + g.sessions, 0);
  const body = { best, sessions: rows.length, players: new Set(rows.map((r) => r.contributor)).size, pending, minPlayers: MIN_PLAYERS };
  bestCache.set(key, { at: Date.now(), body });
  if (bestCache.size > 300) bestCache.delete(bestCache.keys().next().value);
  return body;
});

// ---------------- Builds ----------------

route('POST', /^\/api\/builds$/, async (req) => {
  const u = auth(req);
  rateLimit('build:' + u.id, 30, 3600000);
  const b = sanitizeBuild(await readJson(req));
  const existing = db.prepare('SELECT user_id FROM builds WHERE id = ?').get(b.id);
  if (existing && existing.user_id !== u.id) throw new HttpError(403, 'this build belongs to someone else');
  const steps = b.steps.length;
  db.prepare(`INSERT INTO builds (id, user_id, hero_key, title, steps, created_at, updated_at, json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET hero_key = excluded.hero_key, title = excluded.title, steps = excluded.steps,
      updated_at = excluded.updated_at, json = excluded.json`)
    .run(b.id, u.id, b.heroKey, b.title, steps, Date.now(), Date.now(), JSON.stringify(b));
  return { id: b.id, url: `/b/${b.id}` };
});

// Liste des builds publiés : filtres (classe, arbre de talents, texte) et tri (récents, aimés, nom, points).
// Le résumé (arbres, points, compétence principale) est tiré du JSON du build.
const BUILD_SORT = { recent: 'b.updated_at DESC', likes: '(b.likes - b.dislikes) DESC, b.likes DESC, b.updated_at DESC', name: 'b.title COLLATE NOCASE ASC' };
route('GET', /^\/api\/builds$/, (req, url) => {
  const q = url.searchParams;
  const where = ['u.banned = 0'];
  const args = [];
  if (q.get('hero')) { where.push('b.hero_key = ?'); args.push(String(q.get('hero')).slice(0, 40)); }
  const tree = String(q.get('tree') || '');
  if (/^[A-Za-z_]{3,40}$/.test(tree)) { where.push("instr(json_extract(b.json, '$.talents.trees'), ?) > 0"); args.push(`"${tree}"`); }
  const text = String(q.get('q') || '').trim().slice(0, 60);
  if (text) { where.push("(b.title LIKE ? ESCAPE '!' OR u.name LIKE ? ESCAPE '!')"); const like = '%' + text.replace(/[!%_]/g, (c) => '!' + c) + '%'; args.push(like, like); }
  const sort = BUILD_SORT[q.get('sort')] || BUILD_SORT.recent;
  const limit = Math.min(100, Math.max(1, +q.get('limit') || 60));
  const offset = Math.max(0, +q.get('offset') || 0);
  const rows = db.prepare(`SELECT b.id, b.hero_key, b.title, b.steps, b.likes, b.dislikes, b.created_at, b.updated_at, u.name AS author, b.json,
    (SELECT COUNT(*) FROM comments c WHERE c.kind = 'build' AND c.target_id = b.id AND c.deleted = 0) AS comments
    FROM builds b JOIN users u ON u.id = b.user_id WHERE ${where.join(' AND ')} ORDER BY ${sort} LIMIT ? OFFSET ?`)
    .all(...args, limit, offset);
  const builds = rows.map(({ json, ...r }) => {
    let b = {};
    try { b = JSON.parse(json); } catch { /* ancien build illisible : résumé vide */ }
    const tal = b.talents || {};
    const points = Object.values(tal.nodes || {}).reduce((n, o) => n + Object.values(o).reduce((a, v) => a + v, 0), 0);
    const main = b.loadout && b.loadout.active && b.loadout.active[0];
    return { ...r, trees: (tal.trees || []).filter(Boolean), points, mainSkill: main ? { name: main.name, img: main.img } : null };
  });
  return { builds };
});

route('POST', /^\/api\/builds\/([0-9a-f-]{36})\/like$/, (req, url, m) => {
  const u = auth(req);
  rateLimit('like:' + u.id, 120, 3600000);
  if (!db.prepare('SELECT 1 FROM builds WHERE id = ?').get(m[1])) throw new HttpError(404, 'build not found');
  const ins = db.prepare('INSERT OR IGNORE INTO build_likes (user_id, build_id) VALUES (?, ?)').run(u.id, m[1]);
  if (ins.changes) db.prepare('UPDATE builds SET likes = likes + 1 WHERE id = ?').run(m[1]);
  return { liked: true, likes: db.prepare('SELECT likes FROM builds WHERE id = ?').get(m[1]).likes };
});

route('GET', /^\/api\/builds\/([0-9a-f-]{36})$/, (req, url, m) => {
  const row = db.prepare(`SELECT b.json, b.likes, b.dislikes, b.updated_at, b.user_id, u.name AS author FROM builds b
    JOIN users u ON u.id = b.user_id WHERE b.id = ? AND u.banned = 0`).get(m[1]);
  if (!row) throw new HttpError(404, 'build not found');
  return { build: JSON.parse(row.json), author: row.author, userId: row.user_id, likes: row.likes, dislikes: row.dislikes, myVote: Social.myVote(req, 'build', m[1]), updatedAt: row.updated_at };
});

route('DELETE', /^\/api\/builds\/([0-9a-f-]{36})$/, (req, url, m) => {
  const u = auth(req);
  const r = db.prepare('DELETE FROM builds WHERE id = ? AND user_id = ?').run(m[1], u.id);
  if (!r.changes) throw new HttpError(404, 'build not found');
  db.prepare('DELETE FROM build_likes WHERE build_id = ?').run(m[1]);
  return { deleted: true };
});

// ---------------- Correspondance des numéros de classe ----------------

const HERO_KEYS = new Set(JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'heroes.json'), 'utf8')).heroes.map((h) => h.key));

// Un joueur indique quelle classe correspond au numéro de son héros. Sans compte, on vote par IP (hachée).
route('POST', /^\/api\/heromap$/, async (req) => {
  let voter;
  try { voter = 'u:' + auth(req).id; } catch { voter = 'ip:' + sha256(String(clientIp(req))).slice(0, 32); }
  rateLimit('heromap:' + voter, 20, 3600000);
  const body = await readJson(req);
  const heroId = Math.trunc(+body.heroId);
  if (!(heroId > 0 && heroId < 1e6) || !HERO_KEYS.has(body.key)) throw new HttpError(400, 'invalid hero');
  db.prepare(`INSERT INTO hero_map_votes (hero_id, voter, hero_key, ts) VALUES (?, ?, ?, ?)
    ON CONFLICT(hero_id, voter) DO UPDATE SET hero_key = excluded.hero_key, ts = excluded.ts`)
    .run(heroId, voter, body.key, Date.now());
  heroMapCache.at = 0;
  return { ok: true };
});

// Classe la plus votée pour chaque numéro.
const heroMapCache = { at: 0, body: null };
route('GET', /^\/api\/heromap$/, () => {
  if (Date.now() - heroMapCache.at < 60000) return heroMapCache.body;
  const rows = db.prepare('SELECT hero_id, hero_key, COUNT(*) n FROM hero_map_votes GROUP BY hero_id, hero_key ORDER BY n DESC').all();
  const map = {};
  for (const r of rows) {
    const e = map[r.hero_id] || (map[r.hero_id] = { key: r.hero_key, votes: r.n, total: 0 });
    e.total += r.n;
  }
  heroMapCache.at = Date.now();
  heroMapCache.body = { map };
  return heroMapCache.body;
});

// ---------------- Méta (Hero Ranking agrégé, par serveur + global) ----------------

route('POST', /^\/api\/meta$/, async (req) => {
  let uploader;
  try { uploader = 'u:' + auth(req).id; } catch { uploader = 'ip:' + sha256(String(clientIp(req))).slice(0, 32); }
  rateLimit('meta:' + uploader, 30, 3600000);
  const { server, snapshot: s, names, players } = sanitizeMeta(await readJson(req, 2 * 1024 * 1024));
  const existing = db.prepare('SELECT captured_at, uploads FROM meta_snapshots WHERE server = ? AND season = ? AND mode = ?').get(server, s.season, s.mode);
  // On ne garde que le classement le plus récent pour chaque serveur / saison / classement.
  if (existing && existing.captured_at > s.capturedAt) return { stored: false, reason: 'older snapshot' };
  db.prepare(`INSERT INTO meta_snapshots (server, season, mode, captured_at, received_at, uploader, uploads, json)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    ON CONFLICT(server, season, mode) DO UPDATE SET captured_at = excluded.captured_at, received_at = excluded.received_at,
      uploader = excluded.uploader, uploads = meta_snapshots.uploads + 1, json = excluded.json`)
    .run(server, s.season, s.mode, s.capturedAt, Date.now(), uploader, JSON.stringify(s));
  if (players) {
    // Remplace la liste des joueurs de ce classement.
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM meta_players WHERE server = ? AND season = ? AND mode = ?').run(server, s.season, s.mode);
      const insP = db.prepare(`INSERT INTO meta_players (server, season, mode, rank, hero_id, name, level, dps, build)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const p of players) insP.run(server, s.season, s.mode, p.r, p.h, p.n, p.l, p.d, JSON.stringify({ b: p.b, t: p.t, u: p.u, a: p.a, p: p.p, s: p.s }));
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  const ins = db.prepare('INSERT INTO item_names (id, name, img) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, img = COALESCE(excluded.img, item_names.img)');
  for (const [id, [name, img]] of Object.entries(names)) if (name) ins.run(+id, name, img);
  metaCache.clear();
  return { stored: true };
});

// Liste des méta disponibles (une ligne « global » par saison/classement couvert par 2 serveurs ou plus).
route('GET', /^\/api\/meta\/index$/, () => {
  const rows = db.prepare('SELECT server, season, mode, captured_at, uploads, json FROM meta_snapshots ORDER BY season DESC, mode, server').all();
  const out = rows.map((r) => ({ server: r.server, season: r.season, mode: r.mode, capturedAt: r.captured_at, uploads: r.uploads, total: JSON.parse(r.json).total }));
  const groups = new Map();
  for (const r of out) {
    const k = `${r.season}|${r.mode}`;
    const g = groups.get(k) || { server: 'global', season: r.season, mode: r.mode, capturedAt: 0, uploads: 0, total: 0, servers: 0 };
    g.capturedAt = Math.max(g.capturedAt, r.capturedAt); g.uploads += r.uploads; g.total += r.total; g.servers++;
    groups.set(k, g);
  }
  return { snapshots: [...[...groups.values()].filter((g) => g.servers > 1), ...out] };
});

// Fusion de plusieurs serveurs : effectifs et comptages additionnés, DPS médian pondéré par l'échantillon.
function mergeSnapshots(list) {
  const byHero = new Map();
  const merged = { version: 1, season: list[0].season, mode: list[0].mode, capturedAt: 0, total: 0, withSkills: 0, classes: [] };
  for (const s of list) {
    merged.capturedAt = Math.max(merged.capturedAt, s.capturedAt);
    merged.total += s.total; merged.withSkills += s.withSkills;
    for (const c of s.classes) {
      const m = byHero.get(c.heroId) || { heroId: c.heroId, players: 0, inTop100: 0, bestRank: Infinity, dpsW: 0, lvlW: 0, maxDps: 0,
        sample: 0, sampleWithSkills: 0, uniques: new Map(), skills: new Map(), supports: new Map(), boards: new Map(), talents: new Map(), servants: new Map() };
      m.players += c.players; m.inTop100 += c.inTop100; m.bestRank = Math.min(m.bestRank, c.bestRank);
      m.dpsW += c.medianDps * c.sample; m.lvlW += c.medianLevel * c.sample; m.maxDps = Math.max(m.maxDps, c.maxDps);
      m.sample += c.sample; m.sampleWithSkills += c.sampleWithSkills;
      for (const k of ['uniques', 'skills', 'supports', 'boards', 'talents', 'servants']) for (const [id, n] of (c[k] || [])) m[k].set(id, (m[k].get(id) || 0) + n);
      byHero.set(c.heroId, m);
    }
  }
  merged.classes = [...byHero.values()].map((m) => ({
    heroId: m.heroId, players: m.players, inTop100: m.inTop100, bestRank: m.bestRank,
    medianDps: m.sample ? m.dpsW / m.sample : 0, medianLevel: m.sample ? m.lvlW / m.sample : 0, maxDps: m.maxDps,
    sample: m.sample, sampleWithSkills: m.sampleWithSkills,
    ...Object.fromEntries(['uniques', 'skills', 'supports', 'boards', 'talents', 'servants'].map((k) => [k, [...m[k].entries()].sort((a, b) => b[1] - a[1]).slice(0, 40)])),
  }));
  merged.sources = list.length;
  return merged;
}

const metaCache = new Map();
route('GET', /^\/api\/meta$/, (req, url) => {
  const q = url.searchParams;
  const server = q.get('server') || 'global';
  const season = Math.trunc(+q.get('season')), mode = Math.trunc(+q.get('mode'));
  const k = `${server}|${season}|${mode}|${q.get('names') ? 1 : 0}`;
  if (metaCache.has(k)) return metaCache.get(k);
  const rows = server === 'global'
    ? db.prepare('SELECT server, json FROM meta_snapshots WHERE season = ? AND mode = ?').all(season, mode)
    : db.prepare('SELECT server, json FROM meta_snapshots WHERE server = ? AND season = ? AND mode = ?').all(server, season, mode);
  if (!rows.length) throw new HttpError(404, 'no meta for this server');
  const snap = rows.length === 1 ? { ...JSON.parse(rows[0].json), sources: 1 } : mergeSnapshots(rows.map((r) => JSON.parse(r.json)));
  snap.servers = rows.map((r) => r.server);
  if (q.get('names')) {
    // Pour le site : noms et icônes des objets cités.
    const ids = new Set();
    for (const c of snap.classes) for (const kk of ['uniques', 'skills', 'supports']) for (const [id] of c[kk]) ids.add(id);
    const get = db.prepare('SELECT name, img FROM item_names WHERE id = ?');
    snap.names = {};
    for (const id of ids) { const r = get.get(id); if (r) snap.names[id] = [r.name, r.img]; }
  }
  metaCache.set(k, snap);
  return snap;
});

// Joueurs d'une classe : un serveur (ordre du classement ou DPS) ou tous les serveurs (par DPS).
route('GET', /^\/api\/meta\/players$/, (req, url) => {
  const q = url.searchParams;
  const server = q.get('server') || 'global';
  const season = Math.trunc(+q.get('season')), mode = Math.trunc(+q.get('mode')), hero = Math.trunc(+q.get('hero'));
  const limit = Math.min(200, Math.max(1, +q.get('limit') || 50));
  const offset = Math.max(0, Math.min(20000, +q.get('offset') || 0));
  const byDps = server === 'global' || q.get('sort') === 'dps';
  const where = 'season = ? AND mode = ? AND hero_id = ?' + (server === 'global' ? '' : ' AND server = ?');
  const args = [season, mode, hero, ...(server === 'global' ? [] : [server])];
  const total = db.prepare(`SELECT COUNT(*) n FROM meta_players WHERE ${where}`).get(...args).n;
  const rows = db.prepare(`SELECT server, rank, name, level, dps, build FROM meta_players WHERE ${where}
    ORDER BY ${byDps ? 'dps DESC' : 'rank ASC'} LIMIT ? OFFSET ?`).all(...args, limit, offset);
  const ids = new Set();
  const players = rows.map((r, i) => {
    const b = JSON.parse(r.build);
    for (const id of b.u) ids.add(id);
    for (const [m, sup] of [...b.a, ...b.p]) { ids.add(m); for (const x of sup) ids.add(x); }
    return { pos: offset + i + 1, server: r.server, rank: r.rank, name: r.name, level: r.level, dps: r.dps,
      boards: b.b, talents: b.t, uniques: b.u, active: b.a, passive: b.p, servants: b.s || [] };
  });
  const names = {};
  const get = db.prepare('SELECT name, img FROM item_names WHERE id = ?');
  for (const id of ids) { const r = get.get(id); if (r) names[id] = [r.name, r.img]; }
  return { total, sort: byDps ? 'dps' : 'rank', players, names };
});

// ---------------- Prix partagés ----------------

route('POST', /^\/api\/prices$/, async (req) => {
  const u = auth(req);
  rateLimit('prices:' + u.id, 60, 3600000);
  const body = await readJson(req);
  const obs = Array.isArray(body.observations) ? body.observations.slice(0, 500) : [];
  const now = Date.now();
  const stmt = db.prepare(`INSERT INTO price_obs (user_id, item_id, price, ts) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET price = excluded.price, ts = excluded.ts WHERE excluded.ts > price_obs.ts`);
  const hist = db.prepare('INSERT OR IGNORE INTO price_hist (item_id, user_id, price, ts) VALUES (?, ?, ?, ?)');
  let n = 0;
  for (const o of obs) {
    const id = Math.trunc(+o.id), price = +o.price, ts = Math.min(now, Math.trunc(+o.ts));
    if (!(id > 0) || !(price > 0 && price < 1e7) || !(ts > now - 7 * 86400000)) continue;
    stmt.run(u.id, id, price, ts);
    hist.run(id, u.id, price, ts);
    n++;
  }
  return { accepted: n };
});

// Courbe de prix d'un objet : par jour, prix médian, plus bas, nombre de relevés et de joueurs.
route('GET', /^\/api\/prices\/history\/(\d+)$/, (req, url, m) => {
  const q = url.searchParams;
  const id = +m[1];
  const days = Math.min(120, Math.max(1, +q.get('days') || 30));
  const rows = db.prepare('SELECT price, ts, user_id FROM price_hist WHERE item_id = ? AND ts > ? ORDER BY ts')
    .all(id, Date.now() - days * 86400000);
  const byDay = new Map();
  for (const r of rows) {
    const day = new Date(r.ts).toISOString().slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, { prices: [], users: new Set() });
    const d = byDay.get(day); d.prices.push(r.price); d.users.add(r.user_id);
  }
  const points = [...byDay.entries()].map(([day, d]) => {
    const p = d.prices.sort((a, b) => a - b);
    const mid = p.length >> 1;
    return { day, median: p.length % 2 ? p[mid] : (p[mid - 1] + p[mid]) / 2, low: p[0], n: p.length, players: d.users.size };
  });
  return { id, days, points };
});
// Ménage quotidien de l'historique (plus de 120 jours).
setInterval(() => { try { db.prepare('DELETE FROM price_hist WHERE ts < ?').run(Date.now() - 120 * 86400000); } catch { /* rien */ } }, 24 * 3600000).unref();

// Médiane des derniers prix de chaque joueur sur 7 jours.
let pricesCache = { at: 0, body: null };
route('GET', /^\/api\/prices$/, () => currentPrices());
// Copie des prix communautaires TITrack (rafraîchie toutes les 15 min).
route('GET', /^\/api\/prices\/community$/, () => TITrack.get());
function currentPrices() {
  if (Date.now() - pricesCache.at < 60000) return pricesCache.body;
  const rows = db.prepare('SELECT item_id, price, ts FROM price_obs WHERE ts > ? ORDER BY item_id, price').all(Date.now() - 7 * 86400000);
  const out = {};
  let i = 0;
  while (i < rows.length) {
    let j = i;
    while (j < rows.length && rows[j].item_id === rows[i].item_id) j++;
    const group = rows.slice(i, j);
    const mid = group.length >> 1;
    const median = group.length % 2 ? group[mid].price : (group[mid - 1].price + group[mid].price) / 2;
    out[rows[i].item_id] = { price: median, n: group.length, ts: Math.max(...group.map((g) => g.ts)) };
    i = j;
  }
  pricesCache = { at: Date.now(), body: { prices: out } };
  return pricesCache.body;
}

// ---------------- Fichiers statiques (site) ----------------

const MIME = { '.webp': 'image/webp', '.json': 'application/json; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const SECURITY_HEADERS = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' https://cdn.tlidb.com data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
};

// ---------------- Téléchargement de l'application ----------------
// DOWNLOAD_DIR contient l'installateur et latest.json { version, file, size, sha256, date }.
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || path.join(DATA_DIR, 'downloads');
function latestRelease() {
  try { return JSON.parse(fs.readFileSync(path.join(DOWNLOAD_DIR, 'latest.json'), 'utf8')); } catch { return null; }
}
// Version minimale acceptée : fichier min_version.txt à côté de l'installateur (vide = pas de minimum).
function minVersion() {
  try { return fs.readFileSync(path.join(DOWNLOAD_DIR, 'min_version.txt'), 'utf8').trim() || null; } catch { return null; }
}
const verNum = (v) => String(v || '0').split('.').map((x) => parseInt(x, 10) || 0).reduce((a, x) => a * 1000 + x, 0);
route('GET', /^\/api\/version$/, () => ({ ...(latestRelease() || { version: null }), minVersion: minVersion() }));

// L'app envoie X-TLI-Version depuis la 0.9.9. Les versions plus anciennes (sans mise à jour automatique
// avant la 0.9.4) n'envoient rien : on refuse leurs requêtes avec un message qui demande de télécharger la nouvelle version.
const OUTDATED_MSG = 'TLI Companion is out of date: download the new version on https://tlicompanion.com (TLI Companion n\'est plus à jour : télécharge la nouvelle version sur tlicompanion.com)';
function checkClientVersion(req, pathname) {
  if (pathname === '/api/version' || pathname === '/api/health') return;
  const v = req.headers['x-tli-version'];
  const ua = String(req.headers['user-agent'] || '');
  if (!v) {
    if (/Mozilla/i.test(ua)) return; // navigateur : le site
    throw new HttpError(426, OUTDATED_MSG);
  }
  const min = minVersion();
  if (min && verNum(v) < verNum(min)) throw new HttpError(426, OUTDATED_MSG);
}

function serveDownload(req, res, name) {
  const rel = latestRelease();
  if (name === 'latest') {
    if (!rel) return send(res, 404, 'no release yet');
    res.writeHead(302, { Location: `/download/${encodeURIComponent(rel.file)}` });
    return res.end();
  }
  // Installateur, et pour les mises à jour automatiques : latest.yml + fichier .blockmap (téléchargement différentiel).
  if (!/^[\w.-]+\.(exe|blockmap)$/.test(name) && name !== 'latest.yml') return send(res, 404, 'not found');
  if (ext.onDownload) ext.onDownload(req, name);
  const file = path.join(DOWNLOAD_DIR, name);
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'not found');
    const ext = path.extname(name);
    res.writeHead(200, {
      'Content-Type': ext === '.exe' ? 'application/vnd.microsoft.portable-executable' : ext === '.yml' ? 'text/yaml; charset=utf-8' : 'application/octet-stream',
      'Content-Length': st.size,
      ...(ext === '.exe' ? { 'Content-Disposition': `attachment; filename="${name}"` } : {}),
      'Cache-Control': ext === '.yml' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const PAGES = {
  '/': '/home.html', '/strategies': '/strategies.html', '/builds': '/builds.html', '/meta': '/meta.html',
  '/download': '/download.html', '/account': '/account.html', '/planner': '/planner.html', '/privacy': '/privacy.html', '/terms': '/terms.html',
};
function serveStatic(req, res, pathname) {
  const dl = /^\/download\/([^/]+)$/.exec(pathname);
  if (dl) return serveDownload(req, res, decodeURIComponent(dl[1]));
  if (PAGES[pathname]) pathname = PAGES[pathname];
  else if (/^\/s\/[0-9a-f-]{36}$/.test(pathname)) pathname = '/strategy.html';
  else if (/^\/b\/[0-9a-f-]{36}$/.test(pathname)) pathname = '/build.html';
  // Les noms d'icônes contiennent des caractères encodés (%27, %28…).
  try { pathname = decodeURIComponent(pathname); } catch { return send(res, 400, 'bad path'); }
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, 'not found');
  const isIcon = pathname.startsWith('/icons/') || pathname.startsWith('/img/');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'not found');
    send(res, 200, data, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': isIcon ? 'public, max-age=604800' : 'public, max-age=300',
      // Les icônes sont aussi affichées dans l'app de bureau (autre origine).
      ...(isIcon ? { 'Cross-Origin-Resource-Policy': 'cross-origin' } : {}),
      ...SECURITY_HEADERS,
    });
  });
}

// ---------------- Serveur ----------------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      rateLimit('ip:' + clientIp(req), 600, 60000);
      checkClientVersion(req, url.pathname);
      if (ext.onApiRequest) ext.onApiRequest(req);
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const m = r.pattern.exec(url.pathname);
        if (m) {
          const out = await r.handler(req, url, m);
          const headers = { 'Cache-Control': 'no-store' };
          if (out && out.__cookie) { headers['Set-Cookie'] = out.__cookie; delete out.__cookie; }
          return send(res, 200, out, headers);
        }
      }
      throw new HttpError(404, 'unknown route');
    }
    if (url.pathname.startsWith('/auth/') && await Accounts.handlePage(req, res, url)) return;
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method not allowed');
    serveStatic(req, res, url.pathname);
  } catch (e) {
    const status = e.status || 400;
    if (!e.status) console.error(new Date().toISOString(), req.method, url.pathname, e);
    send(res, status, { error: e.message || 'error' });
  }
});

server.listen(PORT, HOST, () => console.log(`TLI Companion server sur http://${HOST}:${PORT} (données : ${DATA_DIR})`));
