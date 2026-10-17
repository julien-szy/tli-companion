// Builds (classe + étapes d'objets) stockés localement, et conseiller d'achat.
//
// Un build :
// { version: 1, id, title, heroKey, description, createdAt, updatedAt,
//   steps: [{ title, notes, items: [{ id, qty, priority: 'core'|'optional', note }] }],
//   source: { url, author } | null,   // build importé depuis le site
//   shared: { url, at } | null,       // build publié par moi
//   progress: { owned: { [itemId]: true } } }  // ce que je possède déjà (jamais partagé)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUILD_VERSION = 1;
const MAX_STEPS = 30;
const MAX_ITEMS = 60;

// Catégories d'objets (type chinois de la base) -> clé de traduction.
const CATEGORY = {
  '主动技能': 'cat.active', '辅助技能': 'cat.support', '崇高辅助技能': 'cat.support', '华贵辅助技能': 'cat.support',
  '被动技能': 'cat.passive', '触媒技能': 'cat.active', '塔罗斯技能': 'cat.active', '始源塔罗斯技能': 'cat.active',
  '传奇装备': 'cat.legendary', '命运': 'cat.destiny', '神格契约': 'cat.pact', '异度棱镜': 'cat.prism',
  '追随者': 'cat.follower', '罗盘': 'cat.map', '探针': 'cat.map', '信标': 'cat.map',
};
function categoryOf(type) {
  if (CATEGORY[type]) return CATEGORY[type];
  if (type && type.startsWith('核心器官')) return 'cat.organ';
  if (type && /^(完美|特殊器官|普通器官)/.test(type)) return 'cat.organ';
  return 'cat.other';
}

const str = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
const posId = (v) => (Number.isInteger(+v) && +v > 0 ? +v : null);

// Emplacements de compétences comme en jeu : 5 actives et 4 passives, chacune avec jusqu'à 5 soutiens.
function cleanLoadout(l) {
  const slots = (arr, max) => (Array.isArray(arr) ? arr : []).slice(0, max)
    .map((x) => ({ id: posId(x && x.id), supports: (Array.isArray(x && x.supports) ? x.supports : []).map((y) => posId(y && typeof y === 'object' ? y.id : y)).filter(Boolean).slice(0, 5) }))
    .filter((x) => x.id);
  return { active: slots(l && l.active, 5), passive: slots(l && l.passive, 4) };
}

// Nettoie un build (venant de l'interface ou du site) : champs connus, tailles bornées.
function cleanBuild(b, { keepLocal = true } = {}) {
  if (!b || typeof b !== 'object') throw new Error('invalid build');
  const out = {
    version: BUILD_VERSION,
    id: typeof b.id === 'string' && /^[0-9a-f-]{36}$/.test(b.id) ? b.id : crypto.randomUUID(),
    title: str(b.title, 100).trim() || 'Build',
    heroKey: str(b.heroKey, 40),
    description: str(b.description, 4000),
    createdAt: Number.isFinite(b.createdAt) ? b.createdAt : Date.now(),
    updatedAt: Date.now(),
    steps: (Array.isArray(b.steps) ? b.steps : []).slice(0, MAX_STEPS).map((s) => ({
      title: str(s && s.title, 100),
      notes: str(s && s.notes, 2000),
      items: (Array.isArray(s && s.items) ? s.items : []).slice(0, MAX_ITEMS)
        .filter((i) => i && Number.isInteger(+i.id) && +i.id > 0)
        .map((i) => ({
          id: +i.id,
          qty: Math.max(1, Math.min(9999, Math.trunc(+i.qty) || 1)),
          priority: i.priority === 'optional' ? 'optional' : 'core',
          note: str(i.note, 200),
        })),
    })),
    loadout: cleanLoadout(b.loadout),
  };
  if (keepLocal) {
    out.source = b.source && typeof b.source === 'object' ? { url: str(b.source.url, 200), author: str(b.source.author, 40) } : null;
    out.shared = b.shared && typeof b.shared === 'object' ? { url: str(b.shared.url, 200), at: +b.shared.at || 0 } : null;
    const owned = {};
    if (b.progress && b.progress.owned) for (const k of Object.keys(b.progress.owned).slice(0, 2000)) if (/^\d+$/.test(k) && b.progress.owned[k]) owned[k] = true;
    out.progress = { owned };
  }
  return out;
}

// Version publiable : sans la progression ni les infos locales.
function publicBuild(b) {
  const { progress, shared, source, ...pub } = cleanBuild(b);
  return pub;
}

class BuildStore {
  constructor(dir) { this.dir = dir; }
  _file(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('invalid id');
    return path.join(this.dir, `${id}.json`);
  }
  list() {
    let files = [];
    try { files = fs.readdirSync(this.dir).filter((f) => f.endsWith('.json')); } catch { return []; }
    return files.map((f) => { try { return JSON.parse(fs.readFileSync(path.join(this.dir, f), 'utf8')); } catch { return null; } })
      .filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  get(id) { try { return JSON.parse(fs.readFileSync(this._file(id), 'utf8')); } catch { return null; } }
  save(b) {
    const clean = cleanBuild(b);
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this._file(clean.id), JSON.stringify(clean));
    return clean;
  }
  remove(id) { try { fs.unlinkSync(this._file(id)); } catch { /* déjà supprimé */ } }
}

// ---------------- Conseiller d'achat ----------------
//
// ctx = { items, prices, bagQty(id) -> nombre dans le sac, perHour (FE/h ou null), feInBag }
function advise(build, ctx) {
  const owned = (build.progress && build.progress.owned) || {};
  const steps = build.steps.map((s, index) => {
    let total = 0, missingCost = 0, unknownPrices = 0;
    const items = s.items.map((it) => {
      const info = ctx.items.get(it.id);
      const p = ctx.prices.get(it.id);
      const inBag = ctx.bagQty(it.id);
      const manual = !!owned[it.id];
      const have = manual ? it.qty : Math.min(it.qty, inBag);
      const missing = it.qty - have;
      const cost = missing * p.price;
      total += it.qty * p.price;
      missingCost += cost;
      if (missing > 0 && !p.price) unknownPrices++;
      return {
        ...it, name: info.name, img: info.img, category: categoryOf(info.type),
        unit: p.price, source: p.source, inBag, manual, have, missing, cost,
        done: missing <= 0,
      };
    });
    const done = items.every((i) => i.done);
    return { index, title: s.title, notes: s.notes, items, total, missingCost, unknownPrices, done,
      pct: total > 0 ? Math.round(((total - missingCost) / total) * 100) : (done ? 100 : 0) };
  });

  const current = steps.find((s) => !s.done) || null;
  // Achats conseillés : ceux de l'étape en cours, essentiels d'abord, puis du moins cher au plus cher.
  // Les objets sans prix connu passent en dernier (on ne peut pas les chiffrer).
  const next = current
    ? current.items.filter((i) => !i.done).sort((a, b) =>
      (a.priority === 'core' ? 0 : 1) - (b.priority === 'core' ? 0 : 1)
      || (a.unit ? 0 : 1) - (b.unit ? 0 : 1)
      || a.cost - b.cost)
    : [];
  const hours = (fe) => (ctx.perHour && ctx.perHour > 0 ? fe / ctx.perHour : null);
  const remainingAll = steps.reduce((a, s) => a + s.missingCost, 0);
  return {
    steps,
    currentIndex: current ? current.index : null,
    next: next.slice(0, 8).map((i) => ({ ...i, affordable: i.cost > 0 && i.cost <= ctx.feInBag, hours: hours(i.cost) })),
    currentMissing: current ? current.missingCost : 0,
    currentHours: current ? hours(current.missingCost) : null,
    remainingAll,
    remainingHours: hours(remainingAll),
    perHour: ctx.perHour,
    feInBag: ctx.feInBag,
  };
}

module.exports = { BuildStore, cleanBuild, cleanLoadout, publicBuild, advise, categoryOf };
