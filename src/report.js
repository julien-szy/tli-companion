// Transforme une session de farm terminée en « fiche stratégie » autonome :
// c'est ce document qui est sauvegardé localement et, si le joueur accepte, partagé.
// Il ne contient aucun identifiant de joueur.
const crypto = require('crypto');

const REPORT_VERSION = 1;

function buildReport(sess, tracker, { appVersion, title = '' } = {}) {
  const runs = sess.runs.slice().reverse(); // ordre chronologique
  const lootV = tracker.lootValueOf(sess.loot);
  const costV = tracker.valueOf(sess.cost);
  const otherV = tracker.valueOf(sess.other);
  const profit = lootV + costV;
  const realMs = Math.max(0, sess.endedAt - sess.startedAt);
  const mapMs = runs.reduce((a, r) => a + Math.max(0, r.endedAt - r.startedAt), 0);
  const perHour = (ms) => (ms > 60000 ? profit / (ms / 3600000) : 0);

  // Héros le plus joué pendant la session
  const heroCount = {};
  for (const r of runs) if (r.heroId != null) heroCount[r.heroId] = (heroCount[r.heroId] || 0) + 1;
  const heroId = Object.keys(heroCount).sort((a, b) => heroCount[b] - heroCount[a])[0] ?? tracker.heroId;

  // Cartes regroupées par nom (balise) : combien, profit moyen
  const maps = {};
  for (const r of runs) {
    const sum = tracker.runSummary(r);
    const m = (maps[r.name] = maps[r.name] || { name: r.name, runs: 0, profit: 0, durationMs: 0, areaIds: {} });
    m.runs++; m.profit += sum.profit; m.durationMs += sum.durationMs;
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
  for (const id of usedIds) prices[id] = tracker.prices.value(+id);

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
    },
    strategy: {
      maps: Object.values(maps).sort((a, b) => b.runs - a.runs),
      consumables: tracker.itemList(sess.cost).filter((i) => i.qty < 0)
        .map((i) => ({ ...i, perMap: runs.length ? -i.qty / runs.length : 0 })),
      modifiers: modifiers.slice(0, 80),
    },
    loot: tracker.itemList(sess.loot).slice(0, 80),
    runs: runs.map((r) => {
      const s = tracker.runSummary(r);
      return {
        name: s.name, node: s.node, startedAt: s.startedAt, durationMs: s.durationMs,
        loot: s.loot, cost: s.cost, profit: s.profit,
        top: s.items.filter((i) => i.qty > 0).slice(0, 5).map((i) => ({ id: i.id, qty: i.qty, value: i.value })),
        modifiers: r.modifiers || {},
      };
    }),
    prices,
  };
}

module.exports = { buildReport, REPORT_VERSION };
