// Reconstruit l'état du sac à partir des événements et attribue chaque variation :
//  - loot  : ramassé en carte (PickItems, PickItem, Push2, OpenRewardBox)
//  - cost  : consommé à l'ouverture d'une carte (Spv3Open : balises, compas, sondes...)
//  - other : tout le reste (hôtel des ventes, marchand, craft, loot au repaire...)
// Le mode « farm » ne compte que loot + cost ; le mode « tout » compte aussi other.
const { EventEmitter } = require('events');

const LOOT_PROTOS = new Set(['PickItems', 'PickItem', 'Push2', 'OpenRewardBox']);
const COST_PROTOS = new Set(['Spv3Open']);
const IGNORED_PROTOS = new Set(['ResetItemsLayout']); // tri du sac : déplacements seulement

const BEACON_TYPE = '信标';
const { FE_ID: FE } = require('./parser'); // Flame Elementium : toujours compté, même sous le seuil
// Hors carte sans aucune activité dans le log pendant plus de 3 min = AFK.
const AFK_GAP_MS = 3 * 60 * 1000;
// Compteur de la saison Tartarus affiché en jeu (« 8/48 In Tartarus ») : 36 pour entrer, 48 au maximum.
const TARTARUS_KEY = 'Coin_828';
const TARTARUS_ENTRY = 36, TARTARUS_MAX = 48;

function addQty(obj, id, delta) {
  obj[id] = (obj[id] || 0) + delta;
  if (Math.abs(obj[id]) < 1e-9) delete obj[id];
}

class Tracker extends EventEmitter {
  constructor({ prices, items, settings, meta }) {
    super();
    this.prices = prices;
    this.items = items;
    this.settings = settings;
    // meta.data.affixDesc : id -> description ; meta.data.heroNames : heroId -> nom choisi
    this.meta = meta || { data: { affixDesc: {}, heroNames: {} }, save() {} };
    this.replay = false;
    this.resetBag();
    this.zone = { path: null, hub: true, since: Date.now() };
    this.pendingLevelPath = null;
    this.heroId = null;
    this.pendingNode = null; // nœud du Void Chart choisi avant d'ouvrir la carte
    this.newSession();
  }

  resetBag() {
    this.slots = new Map();
    this.snapshotReady = false;
    this.lastInitTs = 0;
    this.initPages = new Set();
    this.proto = null;
  }

  newSession({ recording = false } = {}) {
    if (this.session && this.session.currentRun) this._endRun(Date.now());
    this.session = {
      startedAt: Date.now(),
      recording,          // true = session de farm lancée avec le bouton Démarrer
      netWorthStart: this.snapshotReady ? this.netWorth() : null,
      runs: [],
      currentRun: null,
      pendingCost: {},
      loot: {}, cost: {}, other: {},
      feed: [],
      afkMs: 0,           // temps hors carte sans activité (pauses > 3 min)
      lastActivity: Date.now(),
    };
    if (this.zone && !this.zone.hub) this._startRun(this.zone.path, Date.now());
    this.emit('changed');
  }

  startFarm() { this.newSession({ recording: true }); }

  // Termine la session de farm et renvoie ses données brutes (voir report.js).
  stopFarm() {
    const s = this.session;
    const now = Date.now();
    if (s.currentRun) this._endRun(now);
    const ended = { ...s, endedAt: now, netWorthEnd: this.snapshotReady ? this.netWorth() : null };
    this.newSession();
    return ended;
  }

  heroName(id = this.heroId) {
    if (id == null) return null;
    const auto = this.heroLookup ? this.heroLookup(id) : null;
    return this.meta.data.heroNames[id] || (auto && auto.name) || `Hero ${id}`;
  }

  // Quantité d'un objet dans le sac (tous emplacements confondus).
  bagQty(id) {
    let n = 0;
    for (const s of this.slots.values()) if (s.id === id) n += s.num;
    return n;
  }

  // Valeur totale du sac au prix actuel.
  netWorth() {
    let v = 0;
    for (const { id, num } of this.slots.values()) v += num * this.prices.value(id);
    return v;
  }

  isHub(path) {
    if (!path) return true;
    const pats = this.settings.hubPatterns || [];
    return pats.some((p) => p && path.includes(p));
  }

  handle(ev) {
    // Activité dans le log : sert à mesurer le temps AFK hors carte.
    if (!this.replay && this.session && ev.ts) {
      const s = this.session;
      const gap = ev.ts - Math.max(s.lastActivity, s.startedAt);
      if (gap > AFK_GAP_MS && (!this.zone || this.zone.hub)) s.afkMs += gap;
      if (ev.ts > s.lastActivity) s.lastActivity = ev.ts;
    }
    switch (ev.type) {
      case 'bagInit': return this._onInit(ev);
      case 'bagModify': return this._onModify(ev);
      case 'bagRemove': return this._onRemove(ev);
      case 'protoStart': this.proto = ev.proto; return;
      case 'protoEnd': if (this.proto === ev.proto) this.proto = null; return;
      case 'levelPath': this.pendingLevelPath = ev.path; return;
      case 'enterLevel': return this._onEnterLevel(ev);
      case 'hero': this.heroId = ev.heroId; return;
      case 'consum': {
        // Compteur Tartarus (x/48) : gardé même pendant la relecture (état de départ), alerte seulement en direct.
        if (ev.key !== TARTARUS_KEY) return;
        const prev = this.tartarus;
        this.tartarus = ev.value;
        if (!this.replay) { this.emit('tartarus', { prev, value: ev.value }); this.emit('changed'); }
        return;
      }
      case 'voidNode': this.pendingNode = { areaId: ev.areaId, mapOrder: ev.mapOrder }; return;
      case 'mapModifier': {
        const run = this.session.currentRun;
        // On ne garde que les modificateurs de la première zone (la carte elle-même).
        if (run && !this.zone.hub && run.zones.length === 1) addQty(run.modifiers, ev.id, 1);
        return;
      }
      case 'affixDesc':
        if (this.meta.data.affixDesc[ev.id] !== ev.desc) {
          this.meta.data.affixDesc[ev.id] = ev.desc;
          this.meta.save();
        }
        return;
      case 'price':
        if (this.prices.setFromExchange(ev.id, ev.prices, ev.ts) && !this.replay) {
          this.emit('price', ev.id);
          this.emit('changed');
        }
        return;
    }
  }

  _onInit(ev) {
    // Nouveau bloc d'instantané : on vide les pages qu'il recouvre.
    if (ev.ts - this.lastInitTs > 2000) this.initPages = new Set();
    this.lastInitTs = ev.ts;
    if (!this.initPages.has(ev.page)) {
      this.initPages.add(ev.page);
      for (const key of [...this.slots.keys()]) {
        if (key.startsWith(ev.page + ':')) this.slots.delete(key);
      }
    }
    this.slots.set(`${ev.page}:${ev.slot}`, { id: ev.id, num: ev.num });
    if (!this.snapshotReady) {
      this.snapshotReady = true;
      this.emit('changed');
    }
  }

  _onModify(ev) {
    const key = `${ev.page}:${ev.slot}`;
    const old = this.slots.get(key);
    this.slots.set(key, { id: ev.id, num: ev.num });
    // Sans instantané, on ne connaît pas l'ancienne valeur d'un emplacement inconnu.
    if (!old && !this.snapshotReady) return;
    if (old && old.id === ev.id) {
      this._delta(ev.id, ev.num - old.num, ev.ts);
    } else {
      if (old) this._delta(old.id, -old.num, ev.ts);
      this._delta(ev.id, ev.num, ev.ts);
    }
  }

  _onRemove(ev) {
    const key = `${ev.page}:${ev.slot}`;
    const old = this.slots.get(key);
    this.slots.delete(key);
    if (old) this._delta(old.id, -old.num, ev.ts);
  }

  _delta(id, delta, ts) {
    if (this.replay || !delta) return;
    if (this.proto && IGNORED_PROTOS.has(this.proto)) return;
    const s = this.session;
    const run = s.currentRun;
    let cat;
    if (this.proto && COST_PROTOS.has(this.proto)) {
      cat = 'cost';
      addQty(s.cost, id, delta);
      if (run) addQty(run.cost, id, delta);
      else addQty(s.pendingCost, id, delta);
    } else if (this.proto && LOOT_PROTOS.has(this.proto) && !this.zone.hub && run) {
      cat = 'loot';
      addQty(s.loot, id, delta);
      addQty(run.loot, id, delta);
    } else {
      cat = 'other';
      addQty(s.other, id, delta);
    }
    const entry = { ts, id, delta, cat, proto: this.proto || '-', zone: run ? run.name : 'hideout' };
    s.feed.push(entry);
    if (s.feed.length > 5000) s.feed.splice(0, s.feed.length - 5000);
    this.emit('delta', entry);
    this.emit('changed');
  }

  _onEnterLevel(ev) {
    const path = this.pendingLevelPath || `level-${ev.levelId}`;
    this.pendingLevelPath = null;
    const hub = this.isHub(path);
    if (hub) {
      if (this.session.currentRun) this._endRun(ev.ts);
    } else if (!this.session.currentRun) {
      if (!this.replay) this._startRun(path, ev.ts);
    } else {
      this.session.currentRun.zones.push(shortName(path));
    }
    this.zone = { path, hub, since: ev.ts };
    if (!this.replay) this.emit('changed');
  }

  _startRun(path, ts) {
    const s = this.session;
    const run = {
      name: shortName(path), path, startedAt: ts, endedAt: null,
      zones: [shortName(path)], loot: {}, cost: s.pendingCost,
      heroId: this.heroId, node: this.pendingNode, modifiers: {},
    };
    s.pendingCost = {};
    this.pendingNode = null;
    // Nom lisible : la balise consommée à l'ouverture (ex. « Thunder Wastes Beacon (Timemark 7) »).
    for (const id of Object.keys(run.cost)) {
      const it = this.items.get(+id);
      if (it.type === BEACON_TYPE && run.cost[id] < 0) { run.name = it.name; break; }
    }
    s.currentRun = run;
  }

  _endRun(ts) {
    const s = this.session;
    const run = s.currentRun;
    if (!run) return;
    run.endedAt = ts;
    s.runs.unshift(run);
    s.currentRun = null;
    this.emit('runEnded', run);
  }

  // Appelé quand le bootstrap (relecture de l'historique) est terminé.
  endReplay(ts = Date.now()) {
    this.replay = false;
    this.proto = null;
    if (!this.zone.hub && !this.session.currentRun) this._startRun(this.zone.path, ts);
    this.emit('changed');
  }

  // ---------- Calculs pour l'affichage ----------

  valueOf(qtyMap) {
    let v = 0;
    for (const id in qtyMap) v += qtyMap[id] * this.prices.value(+id);
    return v;
  }

  // Objet de loot sous le seuil choisi (« ignorer ce qui vaut moins de X FE ») : pas compté dans le profit.
  ignored(id) {
    const min = +this.settings.minLootValue || 0;
    return min > 0 && +id !== FE && this.prices.value(+id) < min;
  }
  lootValueOf(qtyMap) {
    let v = 0;
    for (const id in qtyMap) if (!(qtyMap[id] > 0 && this.ignored(id))) v += qtyMap[id] * this.prices.value(+id);
    return v;
  }

  runSummary(run, now = Date.now()) {
    const lootV = this.lootValueOf(run.loot);
    const costV = this.valueOf(run.cost);
    const end = run.endedAt || now;
    return {
      name: run.name, zones: run.zones, startedAt: run.startedAt, endedAt: run.endedAt,
      node: run.node || null, heroId: run.heroId ?? null,
      modifierCount: Object.values(run.modifiers || {}).reduce((a, b) => a + b, 0),
      durationMs: Math.max(0, end - run.startedAt),
      loot: lootV, cost: costV, profit: lootV + costV,
      items: this.itemList(run.loot).concat(this.itemList(run.cost)),
    };
  }

  // Objets sans nom (« Item #1234 ») : masqués partout tant que le joueur ne leur a pas donné de nom.
  visible(id) { return !this.items.known || this.items.known(+id); }

  itemList(qtyMap) {
    return Object.keys(qtyMap).filter((k) => this.visible(k)).map((k) => {
      const id = +k;
      const it = this.items.get(id);
      const p = this.prices.get(id);
      const ignored = qtyMap[k] > 0 && this.ignored(id);
      return { id, name: it.name, img: it.img, qty: qtyMap[k], unit: p.price, source: p.source, value: ignored ? 0 : qtyMap[k] * p.price, ...(ignored ? { ignored: true } : {}) };
    }).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }

  snapshot() {
    const now = Date.now();
    const s = this.session;
    const mode = this.settings.mode;
    const lootV = this.lootValueOf(s.loot);
    const costV = this.valueOf(s.cost);
    const otherV = this.valueOf(s.other);
    const farmProfit = lootV + costV;
    const profit = mode === 'all' ? farmProfit + otherV : farmProfit;

    let mapTime = 0;
    for (const r of s.runs) mapTime += Math.max(0, r.endedAt - r.startedAt);
    if (s.currentRun) mapTime += Math.max(0, now - s.currentRun.startedAt);
    const realTime = Math.max(0, now - s.startedAt);
    const timeBase = this.settings.timeMode === 'map' ? mapTime : realTime;
    // Hors carte : actif (tri du sac, achats…) ou AFK (aucune activité > 3 min, y compris la pause en cours).
    const idleNow = !s.currentRun && now - s.lastActivity > AFK_GAP_MS ? now - Math.max(s.lastActivity, s.startedAt) : 0;
    const afkTime = Math.min(Math.max(0, realTime - mapTime), s.afkMs + idleNow);
    const hubTime = Math.max(0, realTime - mapTime - afkTime);
    const perHour = timeBase > 60000 ? profit / (timeBase / 3600000) : 0;
    const runsDone = s.runs.length;

    const feedFilter = (e) => mode === 'all' || e.cat !== 'other';
    const recent = [];
    for (let i = s.feed.length - 1; i >= 0 && recent.length < 15; i--) {
      if (feedFilter(s.feed[i]) && this.visible(s.feed[i].id)) recent.push(this._feedEntry(s.feed[i]));
    }

    return {
      mode, timeMode: this.settings.timeMode,
      zone: { hub: this.zone.hub, name: this.zone.path ? shortName(this.zone.path) : '?' },
      snapshotReady: this.snapshotReady,
      hero: this.heroId != null ? {
        id: this.heroId, name: this.heroName(), named: !!this.meta.data.heroNames[this.heroId],
        key: (this.meta.data.heroKeys || {})[this.heroId] || ((this.heroLookup && this.heroLookup(this.heroId)) || {}).key || null,
      } : null,
      recording: s.recording,
      tartarus: this.tartarus != null ? { value: this.tartarus, entry: TARTARUS_ENTRY, max: TARTARUS_MAX } : null,
      netWorth: this.snapshotReady ? this.netWorth() : null,
      session: {
        startedAt: s.startedAt, realTimeMs: realTime, mapTimeMs: mapTime, hubTimeMs: hubTime, afkTimeMs: afkTime,
        efficiency: realTime > 60000 ? mapTime / realTime : null,
        // Détail du coût des cartes (balises, compas, sondes…) pour l'infobulle.
        costBreakdown: this.itemList(s.cost).filter((i) => i.qty < 0).slice(0, 10).map((i) => ({ name: i.name, qty: -i.qty, value: -i.value })),
        profit, perHour, loot: lootV, cost: costV, other: otherV,
        runs: runsDone,
        avgPerRun: runsDone ? s.runs.reduce((a, r) => a + this.runSummary(r).profit, 0) / runsDone : 0,
        avgRunMs: runsDone ? s.runs.reduce((a, r) => a + Math.max(0, r.endedAt - r.startedAt), 0) / runsDone : 0,
      },
      current: s.currentRun ? this.runSummary(s.currentRun, now) : null,
      lastRun: s.runs[0] ? this.runSummary(s.runs[0]) : null,
      recent,
    };
  }

  _feedEntry(e) {
    const it = this.items.get(e.id);
    const p = this.prices.get(e.id);
    return { ...e, name: it.name, img: it.img, unit: p.price, source: p.source, value: e.delta * p.price };
  }

  fullData() {
    const s = this.session;
    const merged = {};
    for (const m of [s.loot, s.cost].concat(this.settings.mode === 'all' ? [s.other] : [])) {
      for (const id in m) addQty(merged, id, m[id]);
    }
    return {
      ...this.snapshot(),
      runs: s.runs.map((r) => this.runSummary(r)),
      items: this.itemList(merged),
      feed: s.feed.filter((e) => this.visible(e.id)).slice(-1000).reverse().map((e) => this._feedEntry(e)),
    };
  }

  toJSON() {
    const s = this.session;
    return { startedAt: s.startedAt, runs: s.runs, loot: s.loot, cost: s.cost, other: s.other };
  }
}

// Noms lisibles pour les zones sans balise (ex. « ZhongZuiDiYu » -> « Tartarus »).
let ZONE_NAMES = {};
try { ZONE_NAMES = require('../data/zone_names.json'); } catch { /* facultatif */ }
function zoneLabel(name) { return (name && ZONE_NAMES[name]) || name; }
function shortName(path) {
  const parts = String(path).split('/');
  return zoneLabel(parts[parts.length - 1] || path);
}

module.exports = { Tracker, zoneLabel, TARTARUS_ENTRY, TARTARUS_MAX };
