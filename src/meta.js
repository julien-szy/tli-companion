// Méta des classes à partir du cache « Hero Ranking » du jeu.
// Le jeu écrit dans UE_game\Local\AccountCache\<compte>\<perso>\HeroRanking<mode><saison> la liste
// des 5000 joueurs du classement consulté : classe (HeroId), DPS, niveau, arbres de talents,
// légendaires portés, compétences (pour la plupart des joueurs des classements niveau 100).
// Les pseudos sont affichés et partagés (choix du projet), sauf pour les profils masqués en jeu (Hide) ;
// l'identifiant interne du joueur (PlayerId) n'est jamais repris.
const fs = require('fs');
const path = require('path');

const toIds = (x) => (Array.isArray(x) ? x.filter((n) => typeof n === 'number' && n > 0) : []); // listes vides = {}
const skillMap = (x) => (Array.isArray(x) ? x : [])
  .filter((s) => s && typeof s.mainSkill === 'number')
  .map((s) => [s.mainSkill, toIds(s.supportSkills)]);

function accountCacheDir(logPath) {
  return logPath ? path.join(logPath, '..', '..', '..', '..', 'Local', 'AccountCache') : null;
}

// Liste des fichiers de classement non vides : { file, mode, season, mtime, size }.
// Un classement n'est utilisé que s'il est À JOUR : saison en cours et écrit il y a moins de MAX_AGE.
// (Le jeu garde de vieux fichiers d'anciennes saisons, et le Hero Ranking peut ne pas se charger : on ne
// doit jamais afficher ni partager une méta périmée.)
const MAX_AGE_MS = 48 * 3600 * 1000;
const seasonOf = (s) => Math.floor(s / 100); // 1601 -> 16 (les 2 derniers chiffres : 01 = SC, 21 = SSF)

function listRankingFiles(logPath, { includeStale = false } = {}) {
  const root = accountCacheDir(logPath);
  const out = [];
  if (!root) return out;
  let currentSeason = 0; // saison la plus récente vue dans les noms de fichiers (même vides)
  let accounts = [];
  try { accounts = fs.readdirSync(root); } catch { return out; }
  for (const acc of accounts) {
    let chars = [];
    try { chars = fs.readdirSync(path.join(root, acc)); } catch { continue; }
    for (const ch of chars) {
      let files = [];
      try { files = fs.readdirSync(path.join(root, acc, ch)); } catch { continue; }
      // Date d'expiration de chaque classement selon le jeu ({"01601": 1792123254, …} en secondes).
      let expires = {};
      try { expires = JSON.parse(fs.readFileSync(path.join(root, acc, ch, 'HeroRankingTimeLineExpires'), 'utf8')) || {}; } catch { /* absent */ }
      for (const f of files) {
        // HeroRanking<classement><saison 2 chiffres><01 = SC | 21 = SSF>, ex. HeroRanking121501 = classement 12, S15, SC
        const m = /^HeroRanking(\d+?)(\d{4})$/.exec(f);
        if (!m) continue;
        currentSeason = Math.max(currentSeason, seasonOf(+m[2]));
        const file = path.join(root, acc, ch, f);
        try {
          const st = fs.statSync(file);
          if (st.size < 100) continue; // « {} » : classement pas encore chargé
          const exp = +expires[m[1] + m[2]] || 0;
          out.push({ file, key: `${m[1]}-${m[2]}-${ch}`, mode: +m[1], season: +m[2], charId: ch, account: acc, mtime: st.mtimeMs, size: st.size, expiresAt: exp ? exp * 1000 : null });
        } catch { /* ignoré */ }
      }
    }
  }
  // À jour = saison en cours ET (le jeu le considère encore valide, ou à défaut écrit il y a moins de 48 h).
  const fresh = (f) => seasonOf(f.season) === currentSeason
    && (f.expiresAt ? f.expiresAt > Date.now() : Date.now() - f.mtime < MAX_AGE_MS);
  return out.filter((f) => includeStale || fresh(f)).sort((a, b) => b.season - a.season || b.mtime - a.mtime);
}

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function countIn(players, pick) {
  const c = new Map();
  for (const p of players) for (const id of new Set(pick(p))) c.set(id, (c.get(id) || 0) + 1);
  return c;
}

// Charge et agrège un fichier. Le résultat est mis en cache tant que le fichier ne change pas.
const cache = new Map();
function loadRanking(f) {
  const hit = cache.get(f.file);
  if (hit && hit.mtime === f.mtime) return hit.data;
  const raw = JSON.parse(fs.readFileSync(f.file, 'utf8'));
  const players = (Array.isArray(raw) ? raw : []).map((p, rank) => ({
    rank: rank + 1,
    heroId: +p.HeroId || 0,
    dps: +p.Dps || 0,
    level: +p.level || 0,
    boards: toIds(p.TalentBoards),
    talents: toIds(p.TalentSkills),
    uniques: toIds(p.UniqueItems),
    skills: [...toIds(p.MainSkills), ...toIds(p.PassiveSkills)],
    supports: [...toIds(p.SupportSkills), ...toIds(p.PassiveSupportSkills)],
    name: p.Hide || typeof p.Name !== 'string' ? null : p.Name.slice(0, 40),
    // Compétences avec leurs soutiens : [[principale, [soutiens…]], …]
    active: skillMap(p.ActiveSkillsMap),
    passive: skillMap(p.PassiveSkillsMap),
    servants: toIds(p.Servants), // pactes (familiers)
  })).filter((p) => p.heroId);
  const data = { players, withSkills: players.filter((p) => p.skills.length).length };
  cache.set(f.file, { mtime: f.mtime, data });
  return data;
}

// Vue d'ensemble : une ligne par classe.
function overview(f) {
  const { players, withSkills } = loadRanking(f);
  const byHero = new Map();
  for (const p of players) {
    if (!byHero.has(p.heroId)) byHero.set(p.heroId, []);
    byHero.get(p.heroId).push(p);
  }
  const classes = [...byHero.entries()].map(([heroId, list]) => {
    const top = list.slice(0, 100);
    return {
      heroId, players: list.length, share: list.length / players.length,
      bestRank: list[0].rank, inTop100: players.slice(0, 100).filter((p) => p.heroId === heroId).length,
      medianDps: median(top.map((p) => p.dps)), medianLevel: median(top.map((p) => p.level)),
    };
  }).sort((a, b) => b.players - a.players);
  return { total: players.length, withSkills, classes };
}

// Détail d'une classe sur ses N meilleurs joueurs.
function classDetail(f, heroId, topN = 100) {
  const { players } = loadRanking(f);
  const list = players.filter((p) => p.heroId === heroId).slice(0, topN);
  const n = list.length || 1;
  const withSkills = list.filter((p) => p.skills.length);
  const ns = withSkills.length || 1;
  const rows = (counts, denom) => [...counts.entries()].map(([id, c]) => ({ id, count: c, pct: c / denom }))
    .sort((a, b) => b.count - a.count);
  return {
    heroId, sample: list.length, sampleWithSkills: withSkills.length,
    medianDps: median(list.map((p) => p.dps)), maxDps: Math.max(0, ...list.map((p) => p.dps)),
    medianLevel: median(list.map((p) => p.level)),
    uniques: rows(countIn(list, (p) => p.uniques), n).slice(0, 40),
    boards: rows(countIn(list, (p) => p.boards), n).slice(0, 15),
    talents: rows(countIn(list, (p) => p.talents), n).slice(0, 15),
    servants: rows(countIn(list, (p) => p.servants), n).slice(0, 15),
    skills: rows(countIn(withSkills, (p) => p.skills), ns).slice(0, 25),
    supports: rows(countIn(withSkills, (p) => p.supports), ns).slice(0, 30),
  };
}

// ---------------- Instantané partageable (statistiques agrégées uniquement) ----------------

// Résumé d'un classement : par classe, comptages sur TOUTE la classe, plus la liste des joueurs
// (rang, pseudo sauf profil masqué, niveau, DPS, build). Jamais d'identifiant de joueur.
function snapshot(f) {
  const o = overview(f);
  const { players } = loadRanking(f);
  const pairs = (rows) => rows.map((r) => [r.id, r.count]);
  return {
    version: 2, season: f.season, mode: f.mode, capturedAt: Math.round(f.mtime), expiresAt: f.expiresAt, total: o.total, withSkills: o.withSkills,
    players: players.map((p) => ({ r: p.rank, h: p.heroId, n: p.name, l: p.level, d: p.dps,
      b: p.boards, t: p.talents, u: p.uniques, a: p.active, p: p.passive, s: p.servants })),
    classes: o.classes.map((c) => {
      const d = classDetail(f, c.heroId, Infinity);
      return {
        heroId: c.heroId, players: c.players, inTop100: c.inTop100, bestRank: c.bestRank,
        medianDps: c.medianDps, medianLevel: c.medianLevel, maxDps: d.maxDps,
        sample: d.sample, sampleWithSkills: d.sampleWithSkills,
        uniques: pairs(d.uniques), skills: pairs(d.skills), supports: pairs(d.supports),
        boards: pairs(d.boards), talents: pairs(d.talents), servants: pairs(d.servants),
      };
    }),
  };
}

// Même forme que overview()/classDetail(), mais à partir d'un instantané (local ou venu du serveur).
function overviewFromSnapshot(s) {
  return {
    total: s.total, withSkills: s.withSkills,
    classes: s.classes.map((c) => ({
      heroId: c.heroId, players: c.players, share: c.players / (s.total || 1), bestRank: c.bestRank,
      inTop100: c.inTop100, medianDps: c.medianDps, medianLevel: c.medianLevel,
    })).sort((a, b) => b.players - a.players),
  };
}
function detailFromSnapshot(s, heroId) {
  const c = s.classes.find((x) => x.heroId === heroId);
  if (!c) return null;
  const rows = (pairs, denom) => pairs.map(([id, count]) => ({ id, count, pct: count / (denom || 1) })).sort((a, b) => b.count - a.count);
  return {
    heroId, sample: c.sample, sampleWithSkills: c.sampleWithSkills,
    medianDps: c.medianDps, maxDps: c.maxDps, medianLevel: c.medianLevel,
    uniques: rows(c.uniques, c.sample), boards: rows(c.boards, c.sample), talents: rows(c.talents, c.sample),
    servants: rows(c.servants || [], c.sample),
    skills: rows(c.skills, c.sampleWithSkills), supports: rows(c.supports, c.sampleWithSkills),
  };
}

// Serveur de jeu du perso connecté. Le fichier UserData contient aussi des jetons de connexion :
// on n'en lit QUE le nom du serveur et l'id du perso, rien d'autre n'est conservé ni envoyé.
function currentServer(logPath) {
  if (!logPath) return null;
  try {
    const f = path.join(logPath, '..', '..', '..', '..', 'Local', 'CommonCache', 'UserData');
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    const server = typeof d.LastLoginServerName === 'string' ? d.LastLoginServerName.slice(0, 40) : null;
    const charId = typeof d.PlayerId === 'string' && /^\d{5,25}$/.test(d.PlayerId) ? d.PlayerId : null;
    return server && charId ? { server, charId } : null;
  } catch { return null; }
}

// Joueurs d'une classe (classement local). sort : 'rank' (ordre du jeu) ou 'dps'.
function classPlayers(f, heroId, { sort = 'rank', limit = 100, offset = 0 } = {}) {
  const { players } = loadRanking(f);
  let list = players.filter((p) => p.heroId === heroId);
  if (sort === 'dps') list = list.slice().sort((a, b) => b.dps - a.dps);
  return {
    total: list.length,
    players: list.slice(offset, offset + limit).map((p, i) => ({
      pos: offset + i + 1, rank: p.rank, name: p.name, level: p.level, dps: p.dps,
      boards: p.boards, talents: p.talents, uniques: p.uniques, active: p.active, passive: p.passive, servants: p.servants,
    })),
  };
}

// « Tier list » : score sur 100 combinant la présence dans le top 100 du classement et le DPS médian.
function withTiers(classes) {
  const maxTop = Math.max(1, ...classes.map((c) => c.inTop100));
  const dpsSorted = classes.map((c) => c.medianDps).sort((a, b) => a - b);
  const dpsPct = (v) => (dpsSorted.length > 1 ? dpsSorted.findIndex((x) => x >= v) / (dpsSorted.length - 1) : 1);
  return classes.map((c) => {
    const score = Math.round(100 * (0.6 * (c.inTop100 / maxTop) + 0.4 * dpsPct(c.medianDps)));
    const tier = score >= 70 ? 'S' : score >= 50 ? 'A' : score >= 30 ? 'B' : score >= 15 ? 'C' : 'D';
    return { ...c, score, tier };
  });
}

module.exports = { listRankingFiles, overview, classDetail, classPlayers, withTiers, snapshot, overviewFromSnapshot, detailFromSnapshot, currentServer };
