// Ne garde d'une fiche envoyée par un client que les champs connus, avec les bons types et des tailles bornées.
// Tout ce qui n'est pas listé ici est jeté.

const num = (v, def = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v) => Math.trunc(num(v));
const arr = (v, max) => (Array.isArray(v) ? v.slice(0, max) : []);
const img = (v) => (typeof v === 'string' && /^https:\/\/(cdn\.tlidb\.com|tlicompanion\.com\/icons)\/[\w./%'()-]+$/.test(v) ? v : null);

function item(i) {
  return {
    id: int(i && i.id), name: str(i && i.name, 120), img: img(i && i.img),
    qty: num(i && i.qty), unit: num(i && i.unit), value: num(i && i.value),
    ...(i && typeof i.perMap === 'number' ? { perMap: num(i.perMap) } : {}),
  };
}

function idCounts(o, maxKeys = 200) {
  const out = {};
  if (!o || typeof o !== 'object') return out;
  for (const k of Object.keys(o).slice(0, maxKeys)) if (/^\d{1,12}$/.test(k)) out[k] = num(o[k]);
  return out;
}

function bad(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}

const STRATEGY_TAGS = ['mapping', 'boss', 'netherrealm', 'dream', 'vorax', 'overrealm', 'sandlord', 'clockwork', 'blacksail', 'deepspace', 'leveling', 'other'];

// « Thunder Wastes Beacon (Timemark 7) » -> région + Timemark.
function parseMapName(name) {
  const m = /^(.*?)\s*Beacon\s*\(Timemark\s*(\d+)\)/i.exec(name || '');
  return m ? { region: m[1].trim(), timemark: +m[2] } : { region: name || null, timemark: null };
}

function sanitizeReport(r) {
  if (!r || typeof r !== 'object') throw bad('invalid session');
  if (r.version !== 1) throw bad('unsupported session version');
  if (typeof r.id !== 'string' || !/^[0-9a-f-]{36}$/.test(r.id)) throw bad('invalid id');
  const t = r.totals || {};
  const s = r.strategy || {};
  const out = {
    version: 1,
    id: r.id,
    appVersion: str(r.appVersion, 20),
    title: str(r.title, 120),
    notes: str(r.notes, 4000),
    startedAt: int(r.startedAt),
    endedAt: int(r.endedAt),
    hero: r.hero && typeof r.hero === 'object' ? { id: int(r.hero.id), name: str(r.hero.name, 60) } : null,
    totals: {
      profit: num(t.profit), loot: num(t.loot), cost: num(t.cost), other: num(t.other),
      realMs: int(t.realMs), mapMs: int(t.mapMs), runs: int(t.runs),
      perHourReal: num(t.perHourReal), perHourMap: num(t.perHourMap),
      avgPerMap: num(t.avgPerMap), avgMapMs: num(t.avgMapMs),
      netWorthStart: numOrNull(t.netWorthStart), netWorthEnd: numOrNull(t.netWorthEnd),
      afkMs: int(t.afkMs), hubMs: int(t.hubMs), minLootValue: num(t.minLootValue),
    },
    strategy: {
      maps: arr(s.maps, 40).map((m) => ({
        name: str(m && m.name, 120), runs: int(m && m.runs), profit: num(m && m.profit),
        durationMs: int(m && m.durationMs), areaIds: idCounts(m && m.areaIds, 20),
      })),
      consumables: arr(s.consumables, 60).map(item),
      modifiers: arr(s.modifiers, 120).map((m) => ({
        id: int(m && m.id), desc: m && typeof m.desc === 'string' ? m.desc.slice(0, 300) : null, perMap: num(m && m.perMap),
      })),
    },
    loot: arr(r.loot, 120).map(item),
    runs: arr(r.runs, 600).map((x) => ({
      name: str(x && x.name, 120),
      node: x && x.node ? { areaId: int(x.node.areaId), mapOrder: int(x.node.mapOrder) } : null,
      startedAt: int(x && x.startedAt), durationMs: int(x && x.durationMs),
      loot: num(x && x.loot), cost: num(x && x.cost), profit: num(x && x.profit),
      top: arr(x && x.top, 5).map((i) => ({ id: int(i && i.id), qty: num(i && i.qty), value: num(i && i.value) })),
      modifiers: idCounts(x && x.modifiers, 120),
    })),
    prices: idCounts(r.prices, 2000),
    strategyTag: STRATEGY_TAGS.includes(r.strategyTag) ? r.strategyTag : null,
    context: r.context && typeof r.context === 'object' ? {
      server: r.context.server ? str(r.context.server, 40) : null,
      season: r.context.season ? int(r.context.season) : null,
    } : null,
  };
  if (out.totals.runs < 1) throw bad('empty session');
  if (out.endedAt < out.startedAt) throw bad('inconsistent dates');
  return out;
}

// Build partagé : classe + étapes d'objets (avec nom et icône pour l'affichage sur le site).
function sanitizeBuild(b) {
  if (!b || typeof b !== 'object') throw bad('invalid build');
  if (b.version !== 1) throw bad('unsupported build version');
  if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/.test(b.id)) throw bad('invalid id');
  const out = {
    version: 1,
    id: b.id,
    title: str(b.title, 100).trim(),
    heroKey: /^[a-z0-9_-]{1,40}$/.test(b.heroKey || '') ? b.heroKey : '',
    description: str(b.description, 4000),
    createdAt: int(b.createdAt),
    updatedAt: int(b.updatedAt),
    steps: arr(b.steps, 30).map((s) => ({
      title: str(s && s.title, 100),
      notes: str(s && s.notes, 2000),
      items: arr(s && s.items, 60).filter((i) => i && int(i.id) > 0).map((i) => ({
        id: int(i.id), name: str(i.name, 120), img: img(i.img),
        qty: Math.max(1, Math.min(9999, int(i.qty) || 1)),
        priority: i.priority === 'optional' ? 'optional' : 'core',
        note: str(i.note, 200),
      })),
    })),
  };
  const slots = (v, max) => arr(v, max).filter((x) => x && int(x.id) > 0)
    .map((x) => ({ id: int(x.id), name: str(x.name, 120), img: img(x.img),
      supports: arr(x.supports, 5).filter((y) => y && int(y.id) > 0).map((y) => ({ id: int(y.id), name: str(y.name, 120), img: img(y.img) })) }));
  out.loadout = { active: slots(b.loadout && b.loadout.active, 5), passive: slots(b.loadout && b.loadout.passive, 4) };
  if (!out.title) throw bad('missing title');
  if (!out.steps.some((s) => s.items.length) && !out.loadout.active.length) throw bad('empty build');
  return out;
}

// Instantané de méta : uniquement des nombres (ids d'objets et comptages), aucune donnée de joueur.
function sanitizeMeta(body) {
  if (!body || typeof body !== 'object') throw bad('invalid meta');
  const server = str(body.server, 40).trim();
  if (!/^[\w .()-]{2,40}$/.test(server) || server.toLowerCase() === 'global') throw bad('invalid server');
  const s = body.snapshot || {};
  if (s.version !== 1 && s.version !== 2) throw bad('unsupported meta version');
  const pairs = (v, max, cap) => arr(v, max)
    .filter((p) => Array.isArray(p) && int(p[0]) > 0)
    .map((p) => [int(p[0]), Math.max(0, Math.min(cap, int(p[1])))]);
  const out = {
    version: 1,
    season: int(s.season), mode: int(s.mode),
    capturedAt: Math.min(Date.now() + 3600000, int(s.capturedAt)),
    total: Math.min(10000, int(s.total)), withSkills: Math.min(10000, int(s.withSkills)),
    classes: arr(s.classes, 80).filter((c) => c && int(c.heroId) > 0).map((c) => {
      const sample = Math.max(0, Math.min(10000, int(c.sample)));
      const sampleWithSkills = Math.max(0, Math.min(sample, int(c.sampleWithSkills)));
      return {
        heroId: int(c.heroId), players: Math.min(10000, int(c.players)), inTop100: Math.min(100, int(c.inTop100)),
        bestRank: Math.max(1, int(c.bestRank)), medianDps: Math.max(0, num(c.medianDps)), maxDps: Math.max(0, num(c.maxDps)),
        medianLevel: Math.max(0, Math.min(200, num(c.medianLevel))), sample, sampleWithSkills,
        uniques: pairs(c.uniques, 40, sample), skills: pairs(c.skills, 25, sampleWithSkills),
        supports: pairs(c.supports, 30, sampleWithSkills), boards: pairs(c.boards, 15, sample), talents: pairs(c.talents, 15, sample),
        servants: pairs(c.servants, 15, sample),
      };
    }),
  };
  if (!(out.season > 0 && out.season < 100000) || out.mode < 0 || out.mode > 9) throw bad('invalid season');
  if (!out.classes.length || out.total < 10) throw bad('empty meta');
  // Seulement des classements à jour : capturé il y a moins de 24 h et pas expiré selon le jeu.
  if (Date.now() - out.capturedAt > 24 * 3600 * 1000) throw bad('ranking too old');
  if (s.expiresAt != null && +s.expiresAt < Date.now()) throw bad('ranking expired');
  const names = {};
  if (body.names && typeof body.names === 'object') {
    for (const k of Object.keys(body.names).slice(0, 3000)) {
      const v = body.names[k];
      if (/^\d{1,12}$/.test(k) && Array.isArray(v)) names[k] = [str(v[0], 120), img(v[1])];
    }
  }
  // v2 : liste des joueurs (pseudo ou null si masqué, build). Aucun identifiant de joueur accepté.
  let players = null;
  if (s.version === 2 && Array.isArray(s.players)) {
    const ids = (v, max) => arr(v, max).filter((n) => int(n) > 0).map(int);
    const skills = (v) => arr(v, 12).filter((x) => Array.isArray(x) && int(x[0]) > 0).map((x) => [int(x[0]), ids(x[1], 8)]);
    players = s.players.slice(0, 10000).filter((p) => p && int(p.h) > 0 && int(p.r) > 0).map((p) => ({
      r: int(p.r), h: int(p.h), n: typeof p.n === 'string' ? p.n.normalize('NFKC').replace(/[\u0000-\u001f<>]/g, '').slice(0, 40) : null,
      l: Math.max(0, Math.min(200, int(p.l))), d: Math.max(0, num(p.d)),
      b: ids(p.b, 12), t: ids(p.t, 20), u: ids(p.u, 15), a: skills(p.a), p: skills(p.p), s: ids(p.s, 12),
    }));
  }
  out.version = 1; // les agrégats gardent le même format
  return { server, snapshot: out, names, players };
}

// Statistiques anonymes d'une session de farm : seulement des chiffres et des numéros d'objets.
function sanitizeFarmStats(b) {
  if (!b || typeof b !== 'object') throw bad('invalid stats');
  if (typeof b.id !== 'string' || !/^[0-9a-f-]{36}$/.test(b.id)) throw bad('invalid id');
  if (typeof b.anonId !== 'string' || !/^[0-9a-f-]{36}$/.test(b.anonId)) throw bad('invalid anonymous id');
  const out = {
    id: b.id, anonId: b.anonId,
    heroId: b.heroId != null ? int(b.heroId) : null,
    mainMap: str(b.mainMap, 120) || null,
    strategyTag: STRATEGY_TAGS.includes(b.strategyTag) ? b.strategyTag : null,
    server: b.server ? str(b.server, 40) : null,
    season: b.season ? int(b.season) : null,
    runs: int(b.runs), realMs: int(b.realMs), mapMs: int(b.mapMs), afkMs: Math.max(0, int(b.afkMs)),
    profit: num(b.profit), perHour: num(b.perHour),
    loot: arr(b.loot, 150).map((i) => ({ id: int(i && i.id), qty: num(i && i.qty), unit: num(i && i.unit) })).filter((i) => i.id > 0),
    consumables: arr(b.consumables, 40).map((i) => ({ id: int(i && i.id), name: str(i && i.name, 120), img: img(i && i.img), qty: num(i && i.qty), unit: num(i && i.unit) })).filter((i) => i.id > 0),
  };
  // Bornes de bon sens : au moins 3 cartes et 5 minutes, FE/h plausible.
  if (out.runs < 3 || out.realMs < 5 * 60000) throw bad('session too short');
  if (Math.abs(out.perHour) > 5e6) throw bad('implausible numbers');
  return out;
}

module.exports = { parseMapName, STRATEGY_TAGS, sanitizeReport, sanitizeBuild, sanitizeMeta, sanitizeFarmStats };
