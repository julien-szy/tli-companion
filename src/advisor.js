// Conseiller (IA) — préparation.
// Plus tard, une IA hébergée sur le serveur répondra aux questions du joueur (« quoi crafter en premier ? »,
// « comment monter mon DPS ? »). Ce module assemble le CONTEXTE qu'on lui enverra : uniquement des
// informations de jeu utiles, jamais d'identifiant de compte ni de chemin de fichier.
//
// Forme du contexte (version 1) :
// {
//   version: 1, lang,
//   character: { class: { id, key, name }, skillsOwned: [nom…] },
//   economy:   { feInBag, bagValue, farmRatePerHour, lastSessions: [{ maps, profit, perHour, mainMap }] },
//   meta:      { tier, rank, players, topLegendaries: [{ name, pct, price }], topSkills: [...], topSupports: [...] },
//   topPlayers: [{ name, dps, level, skills: [{ main, supports: [...] }], legendaries: [...], talents: [...], pacts: [...] }],
//   market:    { prices: { nom: prixFE } }  // objets cités ci-dessus
// }

function buildAdvisorContext({ lang, hero, skillsOwned, feInBag, bagValue, farmRate, sessions, meta, topPlayers, priceOf }) {
  const prices = {};
  const note = (name, id) => { if (name && id && priceOf) { const p = priceOf(id); if (p) prices[name] = p; } };
  const metaOut = meta ? {
    tier: meta.tier, rank: meta.rank, players: meta.players,
    topLegendaries: (meta.uniques || []).slice(0, 10).map((u) => { note(u.name, u.id); return { name: u.name, pct: Math.round(u.pct * 100), price: u.price || null }; }),
    topSkills: (meta.skills || []).slice(0, 6).map((u) => ({ name: u.name, pct: Math.round(u.pct * 100) })),
    topSupports: (meta.supports || []).slice(0, 12).map((u) => ({ name: u.name, pct: Math.round(u.pct * 100) })),
  } : null;
  return {
    version: 1,
    lang,
    character: { class: hero || null, skillsOwned: (skillsOwned || []).slice(0, 80) },
    economy: {
      feInBag: Math.round(feInBag || 0), bagValue: Math.round(bagValue || 0),
      farmRatePerHour: farmRate ? Math.round(farmRate) : null,
      lastSessions: (sessions || []).slice(0, 5).map((s) => ({
        maps: s.totals.runs, profit: Math.round(s.totals.profit), perHour: Math.round(s.totals.perHourReal), mainMap: (s.maps || [])[0] || null,
      })),
    },
    meta: metaOut,
    topPlayers: (topPlayers || []).slice(0, 10).map((p) => ({
      name: p.name || null, dps: Math.round(p.dps), level: p.level,
      skills: [...p.active, ...p.passive].map((s) => ({ main: s.name, supports: s.supports.map((x) => x.name) })),
      legendaries: p.uniques.map((u) => u.name),
      talents: (p.talents || []).map((x) => x.name).filter(Boolean),
      pacts: (p.servants || []).map((x) => x.name).filter(Boolean),
    })),
    market: { prices },
  };
}

module.exports = { buildAdvisorContext };
