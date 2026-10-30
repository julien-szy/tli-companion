// Transforme une session de farm terminée en « fiche stratégie » autonome :
// c'est ce document qui est sauvegardé localement et, si le joueur accepte, partagé.
// Il ne contient aucun identifiant de joueur.
const crypto = require('crypto');

const REPORT_VERSION = 1;

function buildReport(sess, tracker, { appVersion, title = '' } = {}) {
  const runs = sess.runs.slice().reverse(); // ordre chronologique
  const lootV = tracker.lootValueOf(sess.loot);
  const costV = tracker.valueOf(sess.cost);
  const otherV = tracker.gainValueOf(sess.other);
  const profit = lootV + costV;
  // Les pauses (bouton ou AFK automatique) ne comptent pas dans la durée de la session.
  const realMs = Math.max(0, sess.endedAt - sess.startedAt - (sess.pausedMs || 0));
  const mapMs = runs.reduce((a, r) => a + tracker.runMs(r), 0); // sans les pauses
  const perHour = (ms) => (ms > 60000 ? profit / (ms / 3600000) : 0);
  // Temps par mode à part (Tartarus, Vorax, Arcana…), pour la fiche de la session.
  const modeTimes = {};
  for (const r of runs) tracker.runModes(r, sess.endedAt, modeTimes);

  // Héros le plus joué pendant la session
  const heroCount = {};
  for (const r of runs) if (r.heroId != null) heroCount[r.heroId] = (heroCount[r.heroId] || 0) + 1;
  const heroId = Object.keys(heroCount).sort((a, b) => heroCount[b] - heroCount[a])[0] ?? tracker.heroId;

  // Cartes regroupées par nom (balise) : combien, profit moyen
  const maps = {};
  for (const r of runs) {
    const sum = tracker.runSummary(r);
    const m = (maps[r.name] = maps[r.name] || { name: r.name, runs: 0, profit: 0, durationMs: 0, areaIds: {}, zones: {} });
    m.runs++; m.profit += sum.profit; m.durationMs += sum.durationMs;
    // Carte précise : 1re zone de la run (« Glacial Abyss - Singing Sand » -> « Singing Sand »).
    const z = r.zones && r.zones[0];
    if (z && z !== r.name && z.includes(' - ')) { const place = z.split(' - ').slice(1).join(' - '); m.zones[place] = (m.zones[place] || 0) + 1; }
    if (r.node) m.areaIds[r.node.areaId] = (m.areaIds[r.node.areaId] || 0) + 1;
  }

  // Modificateurs : fréquence moyenne par carte (talents Netherrealm, compas, sondes...)
  const modTotals = {};
  let runsWithMods = 0;
  for (const r of runs) {
    if (!r.modifiers || !Object.keys(r.modifiers).length) continue;
    runsWithMods++;
    for (const id in r.modifiers) modTotals[id] = (modTotals[id] || 0) + r.modifiers[id];
  }
  const descs = tracker.meta.data.affixDesc || {};
  const modifiers = Object.keys(modTotals).map((id) => ({
    id: +id,
    desc: descs[id] || null,
    perMap: runsWithMods ? modTotals[id] / runsWithMods : 0,
  })).sort((a, b) => b.perMap - a.perMap);

  const usedIds = new Set([...Object.keys(sess.loot), ...Object.keys(sess.cost)]);
  const prices = {};
  for (const id of usedIds) prices[id] = tracker.unitPrice(+id);

  return {
    version: REPORT_VERSION,
    id: crypto.randomUUID(),
    appVersion,
    title,
    startedAt: sess.startedAt,
    endedAt: sess.endedAt,
    hero: heroId != null ? { id: +heroId, name: tracker.heroName(+heroId) } : null,
    totals: {
      profit, loot: lootV, cost: costV, other: otherV,
      realMs, mapMs, runs: runs.length,
      perHourReal: perHour(realMs), perHourMap: perHour(mapMs),
      avgPerMap: runs.length ? profit / runs.length : 0,
      avgMapMs: runs.length ? mapMs / runs.length : 0,
      netWorthStart: sess.netWorthStart, netWorthEnd: sess.netWorthEnd,
      // Temps hors carte : actif (entre les cartes) / AFK (pauses > 3 min sans activité).
      afkMs: Math.min(Math.max(0, realMs - mapMs), sess.afkMs || 0),
      hubMs: Math.max(0, realMs - mapMs - Math.min(Math.max(0, realMs - mapMs), sess.afkMs || 0)),
      minLootValue: +tracker.settings.minLootValue || 0,
      taxRate: tracker.taxRate(), // valeurs après taxe de l'hôtel des ventes (0 = prix plein)
      pausedMs: sess.pausedMs || 0,
      modes: Object.entries(modeTimes).map(([name, ms]) => ({ name, ms })).sort((a, b) => b.ms - a.ms),
    },
    strategy: {
      maps: Object.values(maps).sort((a, b) => b.runs - a.runs),
      consumables: tracker.itemList(sess.cost).filter((i) => i.qty < 0)
        .map((i) => ({ ...i, perMap: runs.length ? -i.qty / runs.length : 0 })),
      modifiers: modifiers.slice(0, 80),
    },
    loot: marketLoot(tracker, sess.loot), // tout le loot (liste et export CSV de la fiche ; le site n'en garde que 120)
    runs: runs.map((r) => {
      const s = tracker.runSummary(r);
      return {
        name: s.name, node: s.node, startedAt: s.startedAt, durationMs: s.durationMs,
        loot: s.loot, cost: s.cost, profit: s.profit,
        top: s.items.filter((i) => i.qty > 0).slice(0, 5).map((i) => ({ id: i.id, qty: i.qty, value: i.value })),
        items: Object.fromEntries(Object.entries(r.loot).filter(([, q]) => q > 0)), // pour recalculer après un prix modifié
        modifiers: r.modifiers || {},
      };
    }),
    prices,
  };
}

// Loot de la fiche. Objet dont le prix vient du joueur (prix manuel, prix de la session) : on garde aussi sa
// valeur au prix du marché (mUnit, mValue), seule utilisée dans les stats partagées.
function marketLoot(tracker, loot) {
  const list = tracker.itemList(loot);
  const market = new Map(tracker.withMarket(() => tracker.itemList(loot)).map((i) => [i.id, i]));
  for (const i of list) {
    if (i.source !== 'manuel' && i.source !== 'session') continue;
    const m = market.get(i.id);
    i.mUnit = m ? m.unit : 0; i.mValue = m ? m.value : 0;
    // Prix choisi pendant la session : « Revenir au prix auto » dans la fiche reprend le prix du marché.
    if (i.source === 'session') { i.edited = true; i.price = i.sp; i.oUnit = i.mUnit; i.oValue = i.mValue; i.oIgnored = !!(m && m.ignored); }
    delete i.sp;
  }
  return list;
}

// ---------- Modifications après coup (prix d'un drop, loot ajouté à la main) ----------
// Le prix tapé est un prix de vente : la taxe de l'hôtel des ventes s'applique comme pour le reste du loot.
const sellUnit = (r, price) => price * (1 - ((r.totals && r.totals.taxRate) || 0));

function applyDelta(r, delta, perRun) {
  const t = r.totals;
  t.loot += delta; t.profit += delta;
  t.perHourReal = t.realMs > 60000 ? t.profit / (t.realMs / 3600000) : 0;
  t.perHourMap = t.mapMs > 60000 ? t.profit / (t.mapMs / 3600000) : 0;
  t.avgPerMap = t.runs ? t.profit / t.runs : 0;
  if (!perRun) return;
  const byMap = {};
  for (const run of r.runs || []) {
    const d = perRun(run);
    if (!d) continue;
    run.loot += d; run.profit += d;
    byMap[run.name] = (byMap[run.name] || 0) + d;
  }
  for (const m of (r.strategy && r.strategy.maps) || []) if (byMap[m.name]) m.profit += byMap[m.name];
}

// Prix d'un objet du loot pour cette session seulement (null = prix d'origine).
function setReportPrice(r, id, price) {
  const i = (r.loot || []).find((x) => x.id === +id && !x.added && x.qty > 0);
  if (!i) return false;
  if (i.oUnit == null) {
    i.oUnit = i.unit; i.oValue = i.value; i.oIgnored = !!i.ignored;
    if (i.mValue == null) { i.mUnit = i.unit; i.mValue = i.value; }
  }
  const oldUnit = i.ignored ? 0 : i.unit, oldValue = i.value;
  if (price == null || price === '' || !Number.isFinite(+price) || +price < 0) {
    i.unit = i.oUnit; i.value = i.oValue;
    if (i.oIgnored) i.ignored = true; else delete i.ignored;
    delete i.edited; delete i.oUnit; delete i.oValue; delete i.oIgnored;
  } else {
    i.unit = sellUnit(r, +price); i.value = i.qty * i.unit; i.edited = true; i.price = +price;
    delete i.ignored;
  }
  if (!i.edited) delete i.price;
  const newUnit = i.ignored ? 0 : i.unit;
  applyDelta(r, i.value - oldValue, (run) => (run.items && run.items[i.id] ? run.items[i.id] * (newUnit - oldUnit) : 0));
  r.loot.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return true;
}

// Loot ajouté à la main (objet que le log n'a pas vu, légendaire…). Il ne compte jamais dans les stats partagées.
function addReportLoot(r, it) {
  const qty = Math.max(1, Math.round(+it.qty || 1));
  const price = Math.max(0, +it.price || 0);
  const unit = sellUnit(r, price);
  r.loot = r.loot || [];
  r.loot.push({ id: +it.id, name: it.name, img: it.img || null, qty, unit, price, value: qty * unit, added: true, key: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) });
  applyDelta(r, qty * unit);
  r.loot.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}
function removeReportLoot(r, key) {
  const k = (r.loot || []).findIndex((x) => x.added && x.key === key);
  if (k < 0) return false;
  const [i] = r.loot.splice(k, 1);
  applyDelta(r, -i.value);
  return true;
}

// Chiffres envoyés dans les stats partagées : prix du marché seulement, sans les loots ajoutés à la main.
function sharedView(r) {
  const loot = (r.loot || []).filter((i) => !i.added);
  let diff = 0;
  for (const i of r.loot || []) diff += i.added ? i.value : (i.mValue != null ? i.value - i.mValue : 0);
  const profit = r.totals.profit - diff;
  return {
    profit, perHour: r.totals.realMs > 60000 ? profit / (r.totals.realMs / 3600000) : 0,
    loot: loot.map((i) => ({ ...i, unit: i.mUnit != null ? i.mUnit : i.unit, value: i.mValue != null ? i.mValue : i.value })),
  };
}

// Session publiée sur le site : même règle que les stats partagées (prix du marché, sans le loot ajouté à la
// main), cartes et totaux recalculés en conséquence.
function publicView(r) {
  const c = JSON.parse(JSON.stringify(r));
  for (const i of c.loot || []) {
    if (i.added) { applyDelta(c, -i.value); continue; }
    if (i.mValue == null) continue;
    const oldUnit = i.ignored ? 0 : i.unit;
    const newUnit = i.mValue ? i.mUnit : 0;
    applyDelta(c, i.mValue - i.value, (run) => (run.items && run.items[i.id] ? run.items[i.id] * (newUnit - oldUnit) : 0));
    i.unit = i.mUnit; i.value = i.mValue;
    for (const k of ['mUnit', 'mValue', 'oUnit', 'oValue', 'oIgnored', 'edited', 'price']) delete i[k];
  }
  c.loot = (c.loot || []).filter((i) => !i.added).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  return c;
}

module.exports = { buildReport, REPORT_VERSION, setReportPrice, addReportLoot, removeReportLoot, sharedView, publicView };
