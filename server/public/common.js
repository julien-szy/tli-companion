const $ = (id) => document.getElementById(id);

// ---------- Langue (anglais par défaut, français en option) ----------
const STR = {
  en: {
    tagline: 'Torchlight: Infinite farming strategies shared by players, measured for real.',
    allClasses: 'All classes', allMaps: 'All maps',
    stratTagline: 'Real farm sessions shared by TLI Companion players. Profit is recalculated with today’s market prices.',
    fClass: 'Class', fMap: 'Map', fTier: 'Timemark', fTag: 'Strategy type', fItem: 'Compass / consumable', fSort: 'Sort by',
    allTiers: 'All Timemarks', allTags: 'All types', allItems: 'Any', allServers: 'All servers', resetFilters: 'Reset filters',
    timemarkN: 'Timemark {n}', bestTitle: 'Global strategy: most profitable right now',
    bestSub: 'Built from the anonymous farm stats of every TLI Companion player, grouped by map, Timemark and strategy type. FE/h at current prices: drops minus compasses and consumables, valued at today’s market. A strategy is only shown once at least 3 different players have farmed it.',
    bestEmpty: 'Not enough sessions for these filters yet.', bestPending: 'Not enough data yet: {n} anonymous sessions are waiting for more players (3 different players needed per strategy).', allTitle: 'Published routes',
    colItems: 'Compasses / consumables', colSessions: 'Sessions / players', colHours: 'Farmed', colPerHourNow: 'FE/h now', colPerHourThen: 'FE/h at the time',
    tag_mapping: 'Mapping (Timemark)', tag_boss: 'Boss rush', tag_netherrealm: 'Netherrealm', tag_dream: 'Dream Talking', tag_vorax: 'Vorax',
    tag_overrealm: 'Overrealm', tag_sandlord: 'Sandlord', tag_clockwork: 'Clockwork Ballet', tag_blacksail: 'Blacksail', tag_deepspace: 'Deep Space',
    tag_leveling: 'Leveling', tag_other: 'Other',
    sortPerHour: 'Best FE/h (real time)', sortPerHourMap: 'Best FE/h (in map)', sortProfit: 'Biggest profit',
    sortLikes: 'Most liked', sortRecent: 'Most recent',
    totals: '{reports} sessions shared by {players} player(s)',
    colStrategy: 'Strategy', colClass: 'Class', colPlayer: 'Player', colMaps: 'Maps', colDuration: 'Duration',
    colProfit: 'Profit', colPerHour: 'FE/h', farmSession: 'Farm session',
    empty: 'No strategy shared yet. Be the first: finish a session in the app and click "Share".',
    loading: 'Loading…', error: 'Error: {msg}', back: '← all strategies',
    by: 'By', perHourReal: 'FE / h (real)', perHourMap: 'FE / h (in map)', profit: 'Profit', maps: 'Maps',
    duration: 'Duration', avgMap: 'Avg / map', durMap: 'Time / map', totalCost: 'Total cost',
    explained: 'The strategy explained', mapsPlayed: 'Maps played', map: 'Map', count: 'Runs',
    avgProfit: 'Avg profit', avgDuration: 'Avg time', zone: 'zone {id}',
    toBuy: 'What to buy (per map)', item: 'Item', perMap: '/ map', unit: 'Unit price', cost: 'Cost',
    nothingToBuy: 'Nothing to buy', modifiers: 'Active modifiers (Netherrealm talents, compasses, probes…)',
    none: 'None', bestDrops: 'Best drops', qty: 'Qty', value: 'Value', pageTitle: 'Farming strategies',
    navStrategies: 'Strategies', navBuilds: 'Builds', buildsTitle: 'Builds',
    buildsTagline: 'Builds shared by players. Import one in the app to follow it with a purchase advisor.',
    colBuild: 'Build', colAuthor: 'Author', colSteps: 'Steps', colUpdated: 'Updated',
    buildsEmpty: 'No build shared yet. Create one in the app (Build tab) and click "Share".',
    step: 'Step {n}', needed: 'Qty', optional: 'optional', getApp: 'Follow this build with live price advice: import it in the TLI Companion app.',
    seeTlidb: 'Class on tlidb ↗', noClass: 'No class',
    navMeta: 'Meta', metaTagline: 'What the top players of each class use, per server and worldwide.',
    metaEmpty: 'No meta yet. It fills itself when TLI Companion users browse the Hero Ranking in game.',
    global: 'Global ({n} servers)', globalShort: 'Global (all servers)', seasonN: 'Season {n}', boardN: 'Leaderboard {n}', modeSc: 'Seasonal (SC)', modeSsf: 'Solo (SSF)', fServer: 'Region', fSeason: 'Season', fBoard: 'Ranking date', fMode: 'Mode', metaInfo2: '{total} ranked players · servers: {servers}', seasonMode: 'season {season} · leaderboard {mode}',
    metaInfo: '{total} ranked players · servers: {servers}', unknownClass: 'Unknown class #{id}',
    players: 'Players', share: 'Share', inTop100: 'In top 100', medianDps: 'Median DPS (top)',
    sample: 'Top {n} of this class analysed ({skills} with skills).', legendaries: 'Legendary gear',
    skillsTitle: 'Main skills', supportsTitle: 'Support skills',
    getAppMeta: 'In the TLI Companion app, one click turns this into a build, with the purchase advisor and current prices.',
    tier: 'Tier', tierHelp: 'Best classes first. Tier = presence in the leaderboard top 100 (60%) + median DPS (40%).',
    bestPlayers: 'Best players (by DPS)', player: 'Player', serverCol: 'Server', level: 'Level', hidden: 'Hidden profile',
    noBuildVisible: 'This player hides their build in game.',
    coreTalents: 'Core talents', talentTrees: 'Talent trees', pacts: 'Pactspirits',
    buildsSoonTitle: 'The build planner is under construction', buildsSoonText: 'We are rebuilding it to work like the game: in-game build codes, talent trees, skill energy and pactspirits, with a real visual planner. Coming in a future update.', soonBadge: 'Coming soon',
  },
  fr: {
    tagline: 'Stratégies de farm Torchlight: Infinite partagées par les joueurs, mesurées en vrai.',
    allClasses: 'Toutes les classes', allMaps: 'Toutes les cartes',
    stratTagline: 'De vraies sessions de farm partagées par les joueurs de TLI Companion. Le profit est recalculé avec les prix actuels du marché.',
    fClass: 'Classe', fMap: 'Carte', fTier: 'Timemark', fTag: 'Type de stratégie', fItem: 'Compas / consommable', fSort: 'Trier par',
    allTiers: 'Tous les Timemarks', allTags: 'Tous les types', allItems: 'Tous', allServers: 'Tous les serveurs', resetFilters: 'Réinitialiser',
    timemarkN: 'Timemark {n}', bestTitle: 'Stratégie globale : les plus rentables en ce moment',
    bestSub: 'Construite à partir des stats de farm anonymes de tous les joueurs de TLI Companion, regroupées par carte, Timemark et type de stratégie. FE/h au cours actuel : drops moins compas et consommables, au prix du marché d’aujourd’hui. Une stratégie n’apparaît qu’à partir de 3 joueurs différents.',
    bestEmpty: 'Pas encore assez de sessions pour ces filtres.', bestPending: 'Pas encore assez de données : {n} sessions anonymes attendent d’autres joueurs (3 joueurs différents par stratégie).', allTitle: 'Routes publiées',
    colItems: 'Compas / consommables', colSessions: 'Sessions / joueurs', colHours: 'Farmé', colPerHourNow: 'FE/h actuel', colPerHourThen: 'FE/h à l’époque',
    tag_mapping: 'Mapping (Timemark)', tag_boss: 'Boss rush', tag_netherrealm: 'Netherrealm', tag_dream: 'Dream Talking', tag_vorax: 'Vorax',
    tag_overrealm: 'Overrealm', tag_sandlord: 'Sandlord', tag_clockwork: 'Clockwork Ballet', tag_blacksail: 'Blacksail', tag_deepspace: 'Deep Space',
    tag_leveling: 'Leveling', tag_other: 'Autre',
    sortPerHour: 'Meilleur FE/h (temps réel)', sortPerHourMap: 'Meilleur FE/h (en carte)', sortProfit: 'Plus gros profit',
    sortLikes: 'Plus aimées', sortRecent: 'Plus récentes',
    totals: '{reports} sessions partagées par {players} joueur(s)',
    colStrategy: 'Stratégie', colClass: 'Classe', colPlayer: 'Joueur', colMaps: 'Cartes', colDuration: 'Durée',
    colProfit: 'Profit', colPerHour: 'FE/h', farmSession: 'Session de farm',
    empty: "Aucune stratégie partagée pour l'instant. Sois le premier : termine une session dans l'app et clique sur « Partager ».",
    loading: 'Chargement…', error: 'Erreur : {msg}', back: '← toutes les stratégies',
    by: 'Par', perHourReal: 'FE / h (réel)', perHourMap: 'FE / h (en carte)', profit: 'Profit', maps: 'Cartes',
    duration: 'Durée', avgMap: 'Moy. / carte', durMap: 'Durée / carte', totalCost: 'Coût total',
    explained: 'La strat expliquée', mapsPlayed: 'Cartes jouées', map: 'Carte', count: 'Nb',
    avgProfit: 'Moy. profit', avgDuration: 'Moy. durée', zone: 'zone {id}',
    toBuy: "Ce qu'il faut acheter (par carte)", item: 'Objet', perMap: '/ carte', unit: 'Prix u.', cost: 'Coût',
    nothingToBuy: 'Rien à acheter', modifiers: 'Modificateurs actifs (talents Netherrealm, compas, sondes…)',
    none: 'Aucun', bestDrops: 'Meilleurs drops', qty: 'Qté', value: 'Valeur', pageTitle: 'Stratégies de farm',
    navStrategies: 'Stratégies', navBuilds: 'Builds', buildsTitle: 'Builds',
    buildsTagline: "Builds partagés par les joueurs. Importe-en un dans l'app pour le suivre avec un conseiller d'achat.",
    colBuild: 'Build', colAuthor: 'Auteur', colSteps: 'Étapes', colUpdated: 'Mis à jour',
    buildsEmpty: "Aucun build partagé pour l'instant. Crée-en un dans l'app (onglet Build) et clique sur « Partager ».",
    step: 'Étape {n}', needed: 'Qté', optional: 'optionnel', getApp: "Suis ce build avec des conseils d'achat en direct : importe-le dans l'app TLI Companion.",
    seeTlidb: 'Classe sur tlidb ↗', noClass: 'Aucune classe',
    navMeta: 'Méta', metaTagline: 'Ce que jouent les meilleurs joueurs de chaque classe, par serveur et au global.',
    metaEmpty: "Pas encore de méta. Elle se remplit toute seule quand les utilisateurs de TLI Companion consultent le Hero Ranking en jeu.",
    global: 'Global ({n} serveurs)', globalShort: 'Global (tous les serveurs)', seasonN: 'Saison {n}', boardN: 'Classement {n}', modeSc: 'Saisonnier (SC)', modeSsf: 'Solo (SSF)', fServer: 'Région', fSeason: 'Saison', fBoard: 'Date du classement', fMode: 'Mode', metaInfo2: '{total} joueurs classés · serveurs : {servers}', seasonMode: 'saison {season} · classement {mode}',
    metaInfo: '{total} joueurs classés · serveurs : {servers}', unknownClass: 'Classe inconnue n°{id}',
    players: 'Joueurs', share: 'Part', inTop100: 'Dans le top 100', medianDps: 'DPS médian (top)',
    sample: 'Top {n} de cette classe analysé ({skills} avec compétences).', legendaries: 'Équipement légendaire',
    skillsTitle: 'Compétences principales', supportsTitle: 'Compétences de soutien',
    getAppMeta: "Dans l'app TLI Companion, un clic transforme ça en build, avec le conseiller d'achat et les prix du moment.",
    tier: 'Tier', tierHelp: 'Meilleures classes en premier. Tier = présence dans le top 100 du classement (60 %) + DPS médian (40 %).',
    bestPlayers: 'Meilleurs joueurs (par DPS)', player: 'Joueur', serverCol: 'Serveur', level: 'Niveau', hidden: 'Profil masqué',
    noBuildVisible: 'Ce joueur masque son build en jeu.',
    coreTalents: 'Talents principaux', talentTrees: 'Arbres de talents', pacts: 'Pactes',
    buildsSoonTitle: 'Le planificateur de build est en travaux', buildsSoonText: "On le refait pour qu'il fonctionne comme dans le jeu : codes de build du jeu, arbres de talents, énergie des compétences et pactes, avec un vrai planificateur visuel. Il arrive dans une prochaine mise à jour.", soonBadge: 'Bientôt disponible',
  },
};
// Textes des pages vitrine (layout.js), fusionnés dans le dictionnaire.
if (window.SITE_STR) for (const l of ['en', 'fr']) Object.assign(STR[l], window.SITE_STR[l]);
let LANG = 'en';
try {
  const fromUrl = new URLSearchParams(location.search).get('lang');
  if (fromUrl) localStorage.setItem('lang', fromUrl);
  LANG = fromUrl || localStorage.getItem('lang') || 'en';
} catch { /* stockage bloqué */ }
if (!STR[LANG]) LANG = 'en';
const LOCALE = LANG === 'fr' ? 'fr-FR' : 'en-US';
document.documentElement.lang = LANG;
function t(key, vars) {
  let s = STR[LANG][key] ?? STR.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, n) => (vars[n] != null ? vars[n] : m));
  return s;
}
function applyI18n() {
  if (typeof renderLayout === 'function') renderLayout();
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); }); // textes de confiance (dictionnaire)
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  const sw = $('langSwitch');
  if (sw) {
    sw.textContent = LANG === 'en' ? 'FR' : 'EN';
    sw.onclick = () => {
      try { localStorage.setItem('lang', LANG === 'en' ? 'fr' : 'en'); } catch { /* ignoré */ }
      const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u;
    };
  }
}

// ---------- Formatage ----------
const nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf3 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 });
function fe(v, signed = false) {
  if (v == null || isNaN(v)) return '–';
  const s = Math.abs(v) >= 100 ? nf0.format(v) : nf1.format(v);
  return signed && v > 0 ? '+' + s : s;
}
function unit(v) { return v ? nf3.format(v) : '–'; }
function qty(q) { return (q > 0 ? '+' : '') + nf0.format(q); }
function dur(ms) {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
function cls(v) { return v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'zero'; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function icon(img) { return img ? `<img class="ico" src="${esc(img)}" loading="lazy" alt="">` : '<span class="ico"></span>'; }
document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.style.visibility = 'hidden'; }, true);
async function api(path) {
  const r = await fetch(path);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.status);
  return j;
}
applyI18n();

// Classes (liste tlidb) pour les builds.
let HEROES = null;
async function heroes() {
  if (!HEROES) HEROES = (await api('/heroes.json')).heroes;
  return HEROES;
}
function heroLabel(h) { return h ? `${h.hero} — ${h.trait}` : t('noClass'); }
function portrait(h, size = 28) {
  return h ? `<img class="portrait" style="width:${size}px;height:${size}px" src="${esc(h.portrait)}" alt="">` : '';
}
