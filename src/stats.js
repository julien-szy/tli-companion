// Onglet Stats : morts (carte, XP perdue), expérience gagnée (XP/h) et DPS / défense du perso tels que le jeu
// les calcule. Tout vient du log ; gardé dans stats.json.
// Le log est relu en entier à chaque démarrage : on ne retient que les événements plus récents que le dernier
// déjà enregistré (lastTs), sans doublon. On retrouve ainsi aussi ce qui s'est passé pendant que l'app était fermée.
const path = require('path');
const { JsonStore } = require('./store');
const { shortName } = require('./tracker');

const BUCKET_MS = 5 * 60000; // XP gagnée regroupée par tranches de 5 minutes
const KEEP_MS = 60 * 86400000; // 60 jours d'historique
const MAX_DEATHS = 3000;
const MAX_POWER = 400; // points de DPS / défense par perso

class StatsBook {
  constructor(dir, tracker) {
    this.tracker = tracker;
    this.store = new JsonStore(path.join(dir, 'stats.json'), {
      lastTs: 0, deaths: [], xp: {}, levels: {}, levelMax: {}, power: {}, sheets: {}, loadout: {}, gear: {},
    });
    this.prevExp = null; // dernière valeur d'XP lue (même ancienne), pour calculer les écarts
    this.pendingDef = null;
  }
  get d() { return this.store.data; }

  // Événements du parseur (appelé pour tous, y compris pendant la relecture du log).
  handle(ev) {
    if (ev.type === 'roleLogin') { this.prevExp = null; return; } // autre perso : son XP n'a rien à voir
    // Compétences équipées : l'état final ne dépend que de l'ordre des lignes, relire le log entier redonne le
    // même résultat. Donc pas de filtre lastTs.
    if (ev.type === 'skillReset' || ev.type === 'skillSlot') { this._skill(ev); return; }
    if (ev.type === 'gearDump' || ev.type === 'gearReset' || ev.type === 'gearSlot') { this._gear(ev); return; }
    if (!['exp', 'death', 'deathKiller', 'power', 'attr'].includes(ev.type)) return;
    const fresh = ev.ts > this.d.lastTs;
    if (ev.type === 'exp') return this._exp(ev, fresh);
    if (!fresh) return;
    // Fiche et compétences : relire deux fois la même ligne ne change rien, donc pas de lastTs (les ~190 lignes
    // de la fiche ont toutes la même heure ; avec lastTs, seule la première passerait).
    if (ev.type === 'attr') { this._attr(ev); this.store.save(); return; }
    if (ev.type === 'death') {
      const z = this.tracker.zone;
      const run = this.tracker.session && this.tracker.session.currentRun;
      this.d.deaths.push({
        ts: ev.ts, hero: this.tracker.heroId || null,
        zone: z && !z.hub ? shortName(z.path, z.levelId) : null, map: run ? run.name : null, xpLost: 0, killer: null,
      });
      if (this.d.deaths.length > MAX_DEATHS) this.d.deaths.splice(0, this.d.deaths.length - MAX_DEATHS);
      // La perte d'XP arrive parfois juste avant l'écran d'échec.
      if (this.lastLoss && ev.ts - this.lastLoss.ts < 3000) { this._last().xpLost = this.lastLoss.n; this.lastLoss = null; }
    } else if (ev.type === 'deathKiller') {
      const last = this._last();
      if (last && ev.ts - last.ts < 3000) last.killer = ev.skill;
    } else if (ev.type === 'power') {
      // Le jeu écrit DPS puis DEF à la suite (valeurs actuelles, avant l'objet comparé).
      if (ev.stat === 'DPS') { this.pendingDps = { ts: ev.ts, dps: ev.value }; return; }
      const p = this.pendingDps && ev.ts - this.pendingDps.ts < 1000 ? this.pendingDps : null;
      this.pendingDps = null;
      if (p) this._power(ev.ts, p.dps, ev.value);
    }
    this._touch(ev.ts);
  }

  _last() { return this.d.deaths[this.d.deaths.length - 1]; }
  _touch(ts) { if (ts > this.d.lastTs) this.d.lastTs = ts; this.store.save(); }

  _exp(ev, fresh) {
    const prev = this.prevExp;
    this.prevExp = { xp: ev.xp, level: ev.level, ts: ev.ts };
    const hero = String(this.tracker.heroId || 0);
    if (!prev || !fresh) return;
    this.d.levels[hero] = { level: ev.level, xp: ev.xp, ts: ev.ts };
    if (ev.level > prev.level) {
      // Passage de niveau : la valeur repart de zéro. L'ancienne valeur donne une idée du maximum du niveau.
      this.d.levelMax[prev.level] = Math.max(this.d.levelMax[prev.level] || 0, prev.xp);
      this._gain(ev.ts, ev.xp);
    } else if (ev.level === prev.level) {
      const diff = ev.xp - prev.xp;
      if (diff > 0) this._gain(ev.ts, diff);
      else if (diff < 0) {
        // XP perdue : à la mort (avant ou juste après l'écran d'échec).
        const last = this._last();
        if (last && ev.ts - last.ts < 3000 && !last.xpLost) last.xpLost = -diff;
        else this.lastLoss = { ts: ev.ts, n: -diff };
      }
    }
    this._touch(ev.ts);
  }

  // Fiche du perso : toutes les lignes arrivent d'un coup (moins de 2 s). La fiche précédente est gardée
  // pour montrer ce qui a changé depuis.
  _attr(ev) {
    const hero = String(this.tracker.heroId || 0);
    const box = (this.d.sheets[hero] = this.d.sheets[hero] || { cur: null, prev: null });
    if (!box.cur || ev.ts - box.cur.last > 2000) {
      if (box.cur && Object.keys(box.cur.attrs).length > 20) box.prev = { ts: box.cur.ts, attrs: box.cur.attrs };
      box.cur = { ts: ev.ts, last: ev.ts, attrs: {} };
    }
    box.cur.last = ev.ts;
    box.cur.attrs[ev.id] = { n: ev.name, v: ev.v };
  }

  _skill(ev) {
    const hero = String(this.tracker.heroId || 0);
    if (ev.type === 'skillReset') { this.d.loadout[hero] = { ts: ev.ts, slots: {} }; return; }
    const lo = (this.d.loadout[hero] = this.d.loadout[hero] || { ts: ev.ts, slots: {} });
    if (ev.op === 'del') { if (lo.slots[ev.slot] === ev.id) delete lo.slots[ev.slot]; } else lo.slots[ev.slot] = ev.id;
    lo.ts = ev.ts;
    this.store.save();
  }

  // Équipement : la connexion donne chaque pièce avec ses affixes (portée et onglet équipement du sac) ; ensuite
  // on suit quelle pièce est dans quel emplacement. Une pièce qui n'était pas dans le bloc de connexion reste
  // sans affixes jusqu'à la connexion suivante.
  _gear(ev) {
    const hero = String(this.tracker.heroId || 0);
    const g = (this.d.gear[hero] = this.d.gear[hero] || { ts: ev.ts, slots: {}, items: {} });
    if (ev.type === 'gearDump') {
      const keep = {};
      for (const uid of Object.values(g.slots)) if (g.items[uid]) keep[uid] = g.items[uid];
      for (const it of ev.items) keep[it.uid] = { base: it.base, unique: it.unique || 0, level: it.level || 0, corroded: !!it.corroded, affixes: it.affixes };
      g.items = keep;
      g.slots = {};
      for (const it of ev.items) if (it.page === -1) g.slots[it.slot] = it.uid;
    } else if (ev.type === 'gearReset') {
      g.slots = {};
    } else if (ev.op === 'del') {
      if (g.slots[ev.slot] === ev.uid) delete g.slots[ev.slot];
    } else g.slots[ev.slot] = ev.uid;
    g.ts = ev.ts;
    this.store.save();
  }

  _gain(ts, n) {
    const k = String(Math.floor(ts / BUCKET_MS) * BUCKET_MS);
    this.d.xp[k] = (this.d.xp[k] || 0) + n;
  }

  _power(ts, dps, def) {
    const hero = String(this.tracker.heroId || 0);
    const list = (this.d.power[hero] = this.d.power[hero] || []);
    const last = list[list.length - 1];
    // On ne garde un point que si le DPS ou la défense a bougé (plus de 0,5 %).
    const moved = (a, b) => Math.abs(a - b) > Math.max(1, b * 0.005);
    if (last && !moved(dps, last.dps) && !moved(def, last.def)) { last.ts = ts; return; }
    list.push({ ts, dps: Math.round(dps), def: Math.round(def) });
    if (list.length > MAX_POWER) list.splice(0, list.length - MAX_POWER);
  }

  prune(now = Date.now()) {
    const min = now - KEEP_MS;
    for (const k of Object.keys(this.d.xp)) if (+k < min) delete this.d.xp[k];
    this.d.deaths = this.d.deaths.filter((x) => x.ts >= min);
  }

  // Résumé pour l'onglet : période « session » (session de farm en cours ou dernière), « today », « week ».
  summary(now = Date.now(), sessionMs = 0) {
    const s = this.tracker.session || {};
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const periods = {
      session: s.startedAt || now,
      today: startOfDay.getTime(),
      week: now - 7 * 86400000,
    };
    const out = {};
    for (const [name, from] of Object.entries(periods)) {
      let gain = 0;
      for (const [k, n] of Object.entries(this.d.xp)) if (+k + BUCKET_MS > from) gain += n;
      const deaths = this.d.deaths.filter((x) => x.ts >= from);
      out[name] = { from, gain, deaths: deaths.length, lost: deaths.reduce((a, x) => a + (x.xpLost || 0), 0) };
    }
    // XP/h de la session : sur le temps réel de la session (pauses retirées), donné par main.js.
    out.session.ms = sessionMs || 0;
    // XP par heure sur les 7 derniers jours (pour le graphique), par tranche d'une heure.
    const hours = {};
    for (const [k, n] of Object.entries(this.d.xp)) {
      if (+k < periods.week) continue;
      const h = Math.floor(+k / 3600000) * 3600000;
      hours[h] = (hours[h] || 0) + n;
    }
    // Morts par carte (les plus fréquentes d'abord).
    const byMap = {};
    for (const x of this.d.deaths) {
      const key = x.map || x.zone || '?';
      const e = (byMap[key] = byMap[key] || { name: key, n: 0, lost: 0, last: 0 });
      e.n++; e.lost += x.xpLost || 0; e.last = Math.max(e.last, x.ts);
    }
    const hero = String(this.tracker.heroId || 0);
    const lv = this.d.levels[hero] || null;
    const max = lv ? this.d.levelMax[lv.level] || 0 : 0;
    return {
      ...out,
      hours: Object.entries(hours).map(([h, n]) => [+h, n]).sort((a, b) => a[0] - b[0]),
      deathsRecent: this.d.deaths.slice(-30).reverse(),
      deathsByMap: Object.values(byMap).sort((a, b) => b.n - a.n).slice(0, 15),
      level: lv && { ...lv, max: max > lv.xp ? max : 0 },
      power: (this.d.power[hero] || []).slice(),
      sheet: (this.d.sheets[hero] || {}).cur || null,
      sheetPrev: (this.d.sheets[hero] || {}).prev || null,
      loadout: this.d.loadout[hero] || null,
      gear: this.d.gear[hero] || null,
      hero: this.tracker.heroId || null,
    };
  }
}

module.exports = { StatsBook };
