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
    dMapsH: 'Maps / hour', dMapTime: 'Average map time', dEff: 'Time in maps', dClasses: 'Classes',
    dMech: 'Farm mechanics (map modifiers)', dLoot: 'What earns the most', dItems: 'Compasses & consumables',
    dLootLine: '{perMap} per map · {share} of the loot · {feh} FE/h', dItemLine: '{perMap} per map · {cost} FE per map',
    dNone: 'Nothing recorded yet.', dNoMech: 'Not recorded yet: mechanics come with players on the latest app version.',
    dMechPartial: 'Known for {n} of {total} sessions (players on older app versions did not send them).', dRoutes: 'Show published routes for this strategy',
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
    mgNether: 'Netherrealm talents (Void Chart)', mgTrial: 'Trials', mgMap: 'Map, compass and probe affixes', mgNodes: '{n} modifiers', mgNode1: '1 modifier',
    mgPerMap: '{n}× per map', mgShare: 'in {p} of sessions',
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
    dMapsH: 'Cartes / heure', dMapTime: 'Durée moyenne d’une carte', dEff: 'Temps en carte', dClasses: 'Classes',
    dMech: 'Mécanique de farm (modificateurs de carte)', dLoot: 'Ce qui rapporte le plus', dItems: 'Compas et consommables',
    dLootLine: '{perMap} par carte · {share} du loot · {feh} FE/h', dItemLine: '{perMap} par carte · {cost} FE par carte',
    dNone: 'Rien d’enregistré pour l’instant.', dNoMech: 'Pas encore enregistrée : la mécanique arrive avec les joueurs sur la dernière version de l’app.',
    dMechPartial: 'Connue pour {n} sessions sur {total} (les joueurs sur une ancienne version de l’app ne l’envoyaient pas).', dRoutes: 'Voir les routes publiées de cette stratégie',
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
    mgNether: 'Talents Netherrealm (Void Chart)', mgTrial: 'Épreuves (Trials)', mgMap: 'Affixes de carte, compas et sondes', mgNodes: '{n} modificateurs', mgNode1: '1 modificateur',
    mgPerMap: '{n}× par carte', mgShare: 'dans {p} des sessions',
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

// ---------- Modificateurs actifs, regroupés par source (talents Netherrealm, épreuves, affixes de carte) ----------
// Chaque modificateur : { desc, perMap, share? }. Le groupe et l'icône sont devinés à partir du texte.
const MOD_ICONS = {
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  chest: '<path d="M4 10h16v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 10a8 5 0 0 1 16 0M12 13v3"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  beacon: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
  wave: '<path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/>',
  up: '<path d="M4 17l6-6 4 4 6-7"/><path d="M14 8h6v6"/>',
  skull: '<path d="M12 3a7 7 0 0 0-7 7c0 2.5 1.3 4.2 3 5.2V19h8v-3.8c1.7-1 3-2.7 3-5.2a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/>',
  swords: '<path d="M4 4l9 9M20 4l-9 9M7 17l-3 3M17 17l3 3M6 14l4 4M18 14l-4 4"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
};
function modIcon(desc) {
  const d = desc.toLowerCase();
  const k = /replicat/.test(d) ? 'copy' : /chest/.test(d) ? 'chest' : /ember/.test(d) ? 'spark' : /beacon/.test(d) ? 'beacon'
    : /resonance/.test(d) ? 'wave' : /drop quantity|drop rarity|additional drop/.test(d) ? 'up' : /monster|boss/.test(d) ? 'skull' : /trial/.test(d) ? 'swords' : 'dot';
  return `<svg viewBox="0 0 24 24">${MOD_ICONS[k]}</svg>`;
}
function modGroup(desc) { return /netherrealm/i.test(desc) ? 'nether' : /trial/i.test(desc) ? 'trial' : 'map'; }
function modGroupsHtml(mods, empty) {
  if (!mods.length) return `<p class="muted">${esc(empty)}</p>`;
  const max = Math.max(1e-9, ...mods.map((m) => m.perMap || 0));
  const groups = { nether: [], trial: [], map: [] };
  for (const m of mods) groups[modGroup(m.desc)].push(m);
  const title = { nether: 'mgNether', trial: 'mgTrial', map: 'mgMap' };
  return `<div class="mgroups">${Object.entries(groups).filter(([, l]) => l.length).map(([g, l]) => `
    <div class="mgroup mg-${g}">
      <div class="mg-head"><span class="mg-ico">${modIcon(g === 'nether' ? 'ember' : g === 'trial' ? 'trial' : 'drop quantity')}</span>${esc(t(title[g]))}<span class="muted">${esc(l.length === 1 ? t('mgNode1') : t('mgNodes', { n: l.length }))}</span></div>
      <div class="mg-nodes">${l.map((m) => `<div class="mg-node"><span class="mg-ico">${modIcon(m.desc)}</span><div>
        <p>${esc(m.desc)}</p><div class="mg-bar"><i style="width:${Math.max(4, Math.round(((m.perMap || 0) / max) * 100))}%"></i></div>
        <span class="muted">${esc(t('mgPerMap', { n: nf1.format(m.perMap || 0) }))}${m.share != null ? ' · ' + esc(t('mgShare', { p: Math.round(m.share * 100) + ' %' })) : ''}</span></div></div>`).join('')}</div>
    </div>`).join('')}</div>`;
}
