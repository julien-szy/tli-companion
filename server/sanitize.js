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

// Cartes précises jouées sous une balise : { « Singing Sand »: 12, … } (texte court, compteurs entiers).
// Nœuds du Void Chart cochés par le joueur : { constellation: [ids de nœuds] }.
function cleanVoidChart(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [slug, ids] of Object.entries(v).slice(0, 40)) {
    if (!/^[A-Za-z_]{3,60}$/.test(slug) || !Array.isArray(ids)) continue;
    const list = [...new Set(ids.map((x) => Math.trunc(+x)).filter((x) => x > 0 && x < 1e7))].slice(0, 250);
    if (list.length) out[slug] = list;
  }
  return out;
}
function zoneCounts(o) {
  const out = {};
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  for (const [k, v] of Object.entries(o).slice(0, 12)) {
    const name = String(k).replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 60);
    const n = Math.trunc(+v);
    if (name && n > 0 && n < 100000) out[name] = n;
  }
  return out;
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
  if (m) return { region: m[1].trim(), timemark: +m[2] };
  const b = /^(.*?)\s*Beacon\s*$/i.exec(name || ''); // « Deep Space Beacon » -> Deep Space
  return b ? { region: b[1].trim(), timemark: null } : { region: name || null, timemark: null };
}

// Niveau de la carte : T8-0 / T8-1 / T8-2 / Profound (T8) ou Deep Space.
// - T8 : les deux derniers chiffres de la zone (areaId) la plus jouée donnent la profondeur
//   (09 = T8-0, 10 = T8-1, 11 = T8-2, 12 = Profound). Sans zone connue : sonde Profound consommée.
// - Deep Space : carte « Deep Space Beacon », ou balise / résonance / sondes Deep Space consommées.
const DEEP_IDS = new Set([400008, 5040, 6040, 12001, 12011, 12021, 12031, 12041, 12101, 12111, 12121, 12131]);
const PROFOUND_IDS = new Set([12000, 12010, 12020, 12030, 12040, 12050]);
const DEPTHS = ['8-0', '8-1', '8-2', 'profound', 'deep'];
function depthOf({ mainMap, timemark, areaIds, consumables }) {
  const ids = (consumables || []).map((c) => +(c && c.id));
  if (/deep space/i.test(mainMap || '') || ids.some((id) => DEEP_IDS.has(id))) return 'deep';
  if (timemark !== 8) return null;
  let top = 0, n = 0;
  for (const a in areaIds || {}) if (+areaIds[a] > n) { n = +areaIds[a]; top = +a; }
  const d = top ? { 9: '8-0', 10: '8-1', 11: '8-2', 12: 'profound' }[top % 100] : null;
  if (d) return d;
  return ids.some((id) => PROFOUND_IDS.has(id)) ? 'profound' : null;
}

// Pactspirits de loot indiqués par le joueur au partage : 3 au plus, noms de la liste connue, niveau 1 à 6.
const LOOT_PACTS = new Set((() => { try { return require('./loot_pacts.json').pacts.map((p) => p.name); } catch { return []; } })());
function cleanLootPacts(v) {
  const seen = new Set();
  return arr(v, 10).filter((p) => p && LOOT_PACTS.has(p.name) && !seen.has(p.name) && seen.add(p.name)).slice(0, 3)
    .map((p) => ({ name: p.name, level: Number.isInteger(p.level) && p.level >= 1 && p.level <= 6 ? p.level : null }));
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
    gameCode: ((v) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 4000))(r.gameCode) || null,
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
    voidChart: cleanVoidChart(r.voidChart),
    lootPacts: cleanLootPacts(r.lootPacts),
    strategy: {
      maps: arr(s.maps, 40).map((m) => ({
        name: str(m && m.name, 120), runs: int(m && m.runs), profit: num(m && m.profit),
        durationMs: int(m && m.durationMs), areaIds: idCounts(m && m.areaIds, 20),
        zones: zoneCounts(m && m.zones),
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
// Talents : 4 arbres (le 1er est un dieu), points par nœud (« colonne-ligne ») et talents principaux choisis.
// Traits de héros : un id par niveau requis.
function cleanTalents(t) {
  const out = { trees: [], nodes: {}, core: {} };
  if (!t || typeof t !== 'object') return out;
  const slug = (s) => (typeof s === 'string' && /^[A-Za-z_]{3,40}$/.test(s) ? s : null);
  out.trees = (Array.isArray(t.trees) ? t.trees : []).slice(0, 4).map(slug);
  while (out.trees.length && !out.trees[out.trees.length - 1]) out.trees.pop();
  for (const s of out.trees.filter(Boolean)) {
    const n = t.nodes && t.nodes[s];
    const pts = {};
    if (n && typeof n === 'object') for (const [k, v] of Object.entries(n).slice(0, 60)) if (/^\d-\d$/.test(k) && Number.isInteger(+v) && +v > 0) pts[k] = Math.min(5, +v);
    if (Object.keys(pts).length) out.nodes[s] = pts;
    const c = t.core && t.core[s];
    const core = (Array.isArray(c) ? c : []).filter((x) => typeof x === 'string' && /^c\d$/.test(x)).slice(0, 3);
    if (core.length) out.core[s] = [...new Set(core)];
  }
  return out;
}
const cleanTraits = (v) => [...new Set((Array.isArray(v) ? v : []).map((x) => Math.trunc(+x)).filter((x) => x > 0 && x < 1e8))].slice(0, 10);

// Équipement : un objet par emplacement, légendaire (avec ses stats) ou rare fabriqué par le joueur
// (base + préfixes / suffixes choisis). Tout est du texte borné : rien n'est calculé à partir de ces lignes.
const GEAR_SLOTS = ['helmet', 'chest', 'necklace', 'gloves', 'belt', 'boots', 'ring1', 'ring2', 'weapon1', 'weapon2'];
const GEAR_IMG = /^https:\/\/cdn\.tlidb\.com\/[\w./%'()-]+$/;
function cleanGearItem(g) {
  if (typeof g === 'number' || typeof g === 'string') g = { id: g };
  if (!g || typeof g !== 'object') return null;
  const s = (v, n) => (typeof v === 'string' ? v.slice(0, n).trim() : '');
  const lines = (v, n) => (Array.isArray(v) ? v : []).map((x) => s(x, 160)).filter(Boolean).slice(0, n);
  const id = Number.isInteger(+g.id) && +g.id > 0 ? +g.id : null;
  const out = {
    rarity: g.rarity === 'rare' ? 'rare' : 'legendary',
    id, name: s(g.name, 80), img: typeof g.img === 'string' && GEAR_IMG.test(g.img) ? g.img : null,
    type: /^[\w-]{2,40}$/.test(g.type || '') ? g.type : null, base: s(g.base, 80),
    implicit: lines(g.implicit, 4), prefixes: lines(g.prefixes, 3), suffixes: lines(g.suffixes, 3), stats: lines(g.stats, 12),
  };
  return out.id || out.name ? out : null;
}
function cleanGear(g) {
  const out = {};
  if (g && typeof g === 'object') for (const k of GEAR_SLOTS) { const it = cleanGearItem(g[k]); if (it) out[k] = it; }
  return out;
}

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
  const slug = (v) => (typeof v === 'string' && /^[\w'-]{2,60}$/.test(v) ? v : null);
  const ref = (y) => ({ id: Math.max(0, int(y && y.id)) || null, skill: slug(y && y.skill), name: str(y && y.name, 120), img: img(y && y.img) });
  const slots = (v, max) => arr(v, max).filter((x) => x && (int(x.id) > 0 || slug(x.skill)))
    .map((x) => ({ ...ref(x), supports: arr(x.supports, 5).filter((y) => y && (int(y.id) > 0 || slug(y.skill))).map(ref) }));
  out.gear = cleanGear(b.gear);
  out.loadout = { active: slots(b.loadout && b.loadout.active, 5), passive: slots(b.loadout && b.loadout.passive, 4) };
  out.talents = cleanTalents(b.talents);
  out.traits = cleanTraits(b.traits);
  if (!out.title) throw bad('missing title');
  const talentPts = Object.values(out.talents.nodes).reduce((n, o) => n + Object.values(o).reduce((a, v) => a + v, 0), 0);
  if (!out.steps.some((s) => s.items.length) && !out.loadout.active.length && !talentPts && !out.traits.length) throw bad('empty build');
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
    loot: arr(b.loot, 150).map((i) => ({ id: int(i && i.id), qty: num(i && i.qty), unit: num(i && i.unit),
      ...(i && i.name ? { name: str(i.name, 120), img: img(i.img) } : {}) })).filter((i) => i.id > 0),
    modifiers: arr(b.modifiers, 25).map((m) => ({ id: int(m && m.id), desc: str(m && m.desc, 200), perMap: num(m && m.perMap) })).filter((m) => m.desc),
    consumables: arr(b.consumables, 40).map((i) => ({ id: int(i && i.id), name: str(i && i.name, 120), img: img(i && i.img), qty: num(i && i.qty), unit: num(i && i.unit) })).filter((i) => i.id > 0),
    // Zones de la carte principale (numéro -> nombre de cartes) : sert à trouver le niveau (T8-1, Profound…).
    areaIds: Object.fromEntries(Object.entries(b.areaIds && typeof b.areaIds === 'object' && !Array.isArray(b.areaIds) ? b.areaIds : {})
      .slice(0, 20).map(([k, v]) => [String(parseInt(k, 10) || 0), int(v)]).filter(([k, v]) => +k > 0 && v > 0)),
  };
  // Bornes de bon sens : au moins 3 cartes et 5 minutes, FE/h plausible.
  if (out.runs < 3 || out.realMs < 5 * 60000) throw bad('session too short');
  if (Math.abs(out.perHour) > 5e6) throw bad('implausible numbers');
  return out;
}

// Avis d'un joueur : texte brut seulement. Caractères de contrôle et caractères invisibles retirés,
// longueurs bornées, types connus. Rien n'est jamais interprété comme du HTML ou du SQL côté serveur.
const FEEDBACK_TYPES = ['bug', 'idea', 'question', 'other'];
const cleanText = (v, max) => (typeof v === 'string' ? v : '')
  .normalize('NFC')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, '')
  .replace(/\r\n?/g, '\n').replace(/\n{4,}/g, '\n\n\n')
  .trim().slice(0, max);
function sanitizeFeedback(b) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw bad('invalid feedback');
  if (b.website) throw bad('invalid feedback'); // champ piège invisible : seuls les robots le remplissent
  const message = cleanText(b.message, 2000);
  if (message.length < 10) throw bad('message too short');
  const contact = cleanText(b.contact, 100).replace(/\n/g, ' ') || null;
  return {
    type: FEEDBACK_TYPES.includes(b.type) ? b.type : 'other',
    message, contact,
    source: b.source === 'app' ? 'app' : 'site',
    lang: b.lang === 'fr' ? 'fr' : 'en',
  };
}

module.exports = { parseMapName, STRATEGY_TAGS, sanitizeReport, sanitizeBuild, sanitizeMeta, sanitizeFarmStats, sanitizeFeedback, depthOf, DEPTHS };
