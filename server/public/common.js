const $ = (id) => document.getElementById(id);

// ---------- Langue (anglais par défaut, français en option) ----------
const STR = {
  en: {
    tagline: 'Torchlight: Infinite farming strategies shared by players, measured for real.',
    allClasses: 'All classes', allMaps: 'All maps',
    stratTagline: 'Real farm sessions shared by TLI Companion players. Profit is recalculated with today’s market prices.',
    fClass: 'Class', fMap: 'Map', fTier: 'Timemark', fTag: 'Strategy type', fItem: 'Compass / consumable', fSort: 'Sort by',
    fDepth: 'Level', allDepths: 'All levels', 'depth_8-0': 'T8-0', 'depth_8-1': 'T8-1', 'depth_8-2': 'T8-2', depth_profound: 'Profound', depth_deep: 'Deep Space',
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
    fBig: 'Big drops', bigAll: 'Keep all', bigHelp: 'Remove rare expensive drops (items worth at least this much each) for an FE/h closer to a normal session', bigRemoved: 'big drops', bigRemovedTip: 'Value of the big drops removed from this session',
    sortLikes: 'Most liked', sortRecent: 'Most recent', sortOldest: 'Oldest first', colPublished: 'Published',
    totals: '{reports} sessions shared by {players} player(s)',
    colStrategy: 'Strategy', colClass: 'Class', colPlayer: 'Player', colMaps: 'Maps', colDuration: 'Duration',
    colProfit: 'Profit', colPerHour: 'FE/h', farmSession: 'Farm session',
    empty: 'No strategy shared yet. Be the first: finish a session in the app and click "Share".',
    loading: 'Loading…', error: 'Error: {msg}', back: '← all strategies',
    by: 'By', perHourReal: 'FE / h (real)', perHourMap: 'FE / h (in map)', profit: 'Profit', maps: 'Maps',
    duration: 'Duration', avgMap: 'Avg / map', durMap: 'Time / map', totalCost: 'Total cost',
    gcTitle: 'Game code', gcHelp: 'Code shared by the player: copy it and paste it in the game.', gcCopy: 'Copy the code', gcCopied: 'Copied ✓',
    explained: 'The strategy explained', mapsPlayed: 'Maps played', map: 'Map', count: 'Runs',
    avgProfit: 'Avg profit', avgDuration: 'Avg time', zone: 'zone {id}',
    toBuy: 'What to buy (per map)', item: 'Item', perMap: '/ map', unit: 'Unit price', cost: 'Cost',
    nothingToBuy: 'Nothing to buy', modifiers: 'Active modifiers (Netherrealm talents, compasses, probes…)',
    mgNether: 'Netherrealm talents (Void Chart)', mgTrial: 'Trials', mgMap: 'Map, compass and probe affixes', mgNodes: '{n} modifiers', mgNode1: '1 modifier',
    mgPerMap: '{n}× per map', mgShare: 'in {p} of sessions',
    vcPath: 'Path node: needed to reach the talents above (not shown in the log)',
    vcExact: 'set by the player', vcHelpExact: 'Void Chart set by the player in TLI Companion. Tree layout: tlidb.com.',
    vcTitle: 'Void Chart', vcHelp: 'Bright nodes: talents read from the game log. Darker nodes: path nodes needed to reach them. When an effect exists on several nodes, the closest one is shown. Tree layout: tlidb.com.', vcNodes: '{n} nodes',
    none: 'None', bestDrops: 'Best drops', qty: 'Qty', value: 'Value', pageTitle: 'Farming strategies',
    navStrategies: 'Strategies', navBuilds: 'Builds', buildsTitle: 'Builds',
    buildsTagline: 'Builds shared by players. Import one in the app to follow it with a purchase advisor.',
    colBuild: 'Build', colAuthor: 'Author', colSteps: 'Steps', colUpdated: 'Updated',
    buildsEmpty: 'No build shared yet. Create one in the app (Build tab) and click "Share".',
    step: 'Step {n}', needed: 'Qty', optional: 'optional', getApp: 'Follow this build with live price advice: import it in the TLI Companion app.',
    seeTlidb: 'Class on tlidb ↗', noClass: 'No class',
    navPrices: 'Prices', prTitle: 'Item prices', prSub: 'Auction House prices seen by TLI Companion players, without any change: median of the latest price each player saw over the last 7 days.',
    prSearch: 'Search an item…', prAll: 'All items', prItems: '{n} items', prName: 'Item', prCat: 'Category', prPrice: 'Price (FE)', prTrend: '7 days', prD1: '24h', prD7: '7d',
    prLow: 'Lowest ({n} days)', prHigh: 'Highest ({n} days)', prLastSeen: 'Last seen', prDays: '{n} days', prNoHist: 'No price history for this period yet.',
    prObs: '{n} checks by {players} players', prAgoMin: '{n} min ago', prAgoH: '{n} h ago', prAgoD: '{n} days ago',
    prChartHelp: 'Daily median of the prices seen by TLI Companion players. A point only appears on days when someone searched this item at the Auction House.',
    prBack: 'All prices', pr24h: '24h', pr7d: '7 days', pr30d: '30 days', prAll2: 'All', prMedian: 'Median', prBand: 'Lowest – highest seen', prRangeLH: 'lowest {lo} · highest {hi}',
    prH24High: '24h high', prH24Low: '24h low', prD7High: '7 days high', prD7Low: '7 days low', prAllHigh: 'All-time high', prAllLow: 'All-time low',
    prAvgPlayers: 'Players per day', prSpan24: 'Last 24h (low → high)', prSpan7: 'Last 7 days', prSpanAll: 'All time', prLastUpdate: 'Last update', prUnknown: 'Unknown item.',
    prPlayers: 'Players', prUpdated: 'Updated {t}', prLoading: 'Loading prices…', prNone: 'No item found.', prFew: 'Seen by one player only: less reliable.',
    prHow: 'Prices are collected automatically when players search the Auction House in game (only prices the game writes in its log, never typed by hand). The more players, the more accurate.',
    'cat.materials': 'Materials', 'cat.embers': 'Embers', 'cat.compass': 'Compasses & probes', 'cat.beacon': 'Beacons & invitations', 'cat.gear': 'Legendary gear',
    'cat.skills': 'Skills', 'cat.fate': 'Fate cards', 'cat.organs': 'Vorax organs', 'cat.memory': 'Memories', 'cat.divinity': 'Divinity', 'cat.prism': 'Prisms', 'cat.spices': 'Spices', 'cat.other': 'Other', 'cat.fe': 'Flame Elementium',
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
    fDepth: 'Niveau', allDepths: 'Tous les niveaux', 'depth_8-0': 'T8-0', 'depth_8-1': 'T8-1', 'depth_8-2': 'T8-2', depth_profound: 'Profound', depth_deep: 'Deep Space',
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
    fBig: 'Gros drops', bigAll: 'Tout garder', bigHelp: 'Retire les drops rares et chers (objets qui valent au moins ce montant chacun) pour un FE/h plus proche d\'une session normale', bigRemoved: 'gros drops', bigRemovedTip: 'Valeur des gros drops retirés de cette session',
    sortLikes: 'Plus aimées', sortRecent: 'Plus récentes', sortOldest: 'Plus anciennes', colPublished: 'Publiée le',
    totals: '{reports} sessions partagées par {players} joueur(s)',
    colStrategy: 'Stratégie', colClass: 'Classe', colPlayer: 'Joueur', colMaps: 'Cartes', colDuration: 'Durée',
    colProfit: 'Profit', colPerHour: 'FE/h', farmSession: 'Session de farm',
    empty: "Aucune stratégie partagée pour l'instant. Sois le premier : termine une session dans l'app et clique sur « Partager ».",
    loading: 'Chargement…', error: 'Erreur : {msg}', back: '← toutes les stratégies',
    by: 'Par', perHourReal: 'FE / h (réel)', perHourMap: 'FE / h (en carte)', profit: 'Profit', maps: 'Cartes',
    duration: 'Durée', avgMap: 'Moy. / carte', durMap: 'Durée / carte', totalCost: 'Coût total',
    gcTitle: 'Code du jeu', gcHelp: 'Code partagé par le joueur : copie-le puis colle-le dans le jeu.', gcCopy: 'Copier le code', gcCopied: 'Copié ✓',
    explained: 'La strat expliquée', mapsPlayed: 'Cartes jouées', map: 'Carte', count: 'Nb',
    avgProfit: 'Moy. profit', avgDuration: 'Moy. durée', zone: 'zone {id}',
    toBuy: "Ce qu'il faut acheter (par carte)", item: 'Objet', perMap: '/ carte', unit: 'Prix u.', cost: 'Coût',
    nothingToBuy: 'Rien à acheter', modifiers: 'Modificateurs actifs (talents Netherrealm, compas, sondes…)',
    mgNether: 'Talents Netherrealm (Void Chart)', mgTrial: 'Épreuves (Trials)', mgMap: 'Affixes de carte, compas et sondes', mgNodes: '{n} modificateurs', mgNode1: '1 modificateur',
    mgPerMap: '{n}× par carte', mgShare: 'dans {p} des sessions',
    vcPath: 'Nœud de passage : nécessaire pour atteindre les talents au-dessus (absent du log)',
    vcExact: 'coché par le joueur', vcHelpExact: 'Void Chart coché par le joueur dans TLI Companion. Forme de l’arbre : tlidb.com.',
    vcTitle: 'Void Chart', vcHelp: 'Nœuds vifs : talents lus dans le log du jeu. Nœuds plus sombres : nœuds de passage nécessaires pour les atteindre. Quand un effet existe sur plusieurs nœuds, le plus proche est affiché. Forme de l’arbre : tlidb.com.', vcNodes: '{n} nœuds',
    none: 'Aucun', bestDrops: 'Meilleurs drops', qty: 'Qté', value: 'Valeur', pageTitle: 'Stratégies de farm',
    navStrategies: 'Stratégies', navBuilds: 'Builds', buildsTitle: 'Builds',
    buildsTagline: "Builds partagés par les joueurs. Importe-en un dans l'app pour le suivre avec un conseiller d'achat.",
    colBuild: 'Build', colAuthor: 'Auteur', colSteps: 'Étapes', colUpdated: 'Mis à jour',
    buildsEmpty: "Aucun build partagé pour l'instant. Crée-en un dans l'app (onglet Build) et clique sur « Partager ».",
    step: 'Étape {n}', needed: 'Qté', optional: 'optionnel', getApp: "Suis ce build avec des conseils d'achat en direct : importe-le dans l'app TLI Companion.",
    seeTlidb: 'Classe sur tlidb ↗', noClass: 'Aucune classe',
    navPrices: 'Prix', prTitle: 'Prix des objets', prSub: "Prix de l'hôtel des ventes vus par les joueurs de TLI Companion, sans aucune modification : médiane du dernier prix vu par chaque joueur sur les 7 derniers jours.",
    prSearch: 'Chercher un objet…', prAll: 'Tous les objets', prItems: '{n} objets', prName: 'Objet', prCat: 'Catégorie', prPrice: 'Prix (FE)', prTrend: '7 jours', prD1: '24 h', prD7: '7 j',
    prLow: 'Plus bas ({n} jours)', prHigh: 'Plus haut ({n} jours)', prLastSeen: 'Dernier relevé', prDays: '{n} jours', prNoHist: "Pas encore d'historique de prix sur cette période.",
    prObs: '{n} relevés par {players} joueurs', prAgoMin: 'il y a {n} min', prAgoH: 'il y a {n} h', prAgoD: 'il y a {n} jours',
    prChartHelp: "Médiane par jour des prix vus par les joueurs de TLI Companion. Un point n'apparaît que les jours où quelqu'un a cherché cet objet à l'hôtel des ventes.",
    prBack: 'Tous les prix', pr24h: '24 h', pr7d: '7 jours', pr30d: '30 jours', prAll2: 'Tout', prMedian: 'Médiane', prBand: 'Plus bas – plus haut vus', prRangeLH: 'plus bas {lo} · plus haut {hi}',
    prH24High: 'Plus haut 24 h', prH24Low: 'Plus bas 24 h', prD7High: 'Plus haut 7 jours', prD7Low: 'Plus bas 7 jours', prAllHigh: 'Plus haut (tout)', prAllLow: 'Plus bas (tout)',
    prAvgPlayers: 'Joueurs par jour', prSpan24: '24 dernières h (bas → haut)', prSpan7: '7 derniers jours', prSpanAll: 'Depuis le début', prLastUpdate: 'Dernière mise à jour', prUnknown: 'Objet inconnu.',
    prPlayers: 'Joueurs', prUpdated: 'Mis à jour {t}', prLoading: 'Chargement des prix…', prNone: 'Aucun objet trouvé.', prFew: "Vu par un seul joueur : moins fiable.",
    prHow: "Les prix sont relevés automatiquement quand les joueurs cherchent à l'hôtel des ventes en jeu (seulement les prix que le jeu écrit dans son log, jamais saisis à la main). Plus il y a de joueurs, plus ils sont justes.",
    'cat.materials': 'Matériaux', 'cat.embers': 'Braises', 'cat.compass': 'Compas et sondes', 'cat.beacon': 'Balises et invitations', 'cat.gear': 'Équipement légendaire',
    'cat.skills': 'Compétences', 'cat.fate': 'Cartes du destin', 'cat.organs': 'Organes Vorax', 'cat.memory': 'Souvenirs', 'cat.divinity': 'Divinité', 'cat.prism': 'Prismes', 'cat.spices': 'Épices', 'cat.other': 'Autre', 'cat.fe': 'Flame Elementium',
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
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
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

// ---------- Void Chart : l'arbre de talents Netherrealm, avec les nœuds utilisés allumés ----------
// Arbre (positions, liens, icônes) : tlidb.com, via scripts/voidchart.js. Les modificateurs lus dans le log
// sont reliés aux nœuds par leur texte ; « 5× par carte » allume les 5 nœuds de cet effet les plus proches du départ.
let VC = null;
const vcNorm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// Texte sans les nombres (« … 2% chance … » et « … 10% chance … » ont le même gabarit) et 1re valeur.
const vcTpl = (s) => String(s || '').toLowerCase().replace(/\d+(\.\d+)?/g, '#').replace(/[^a-z#]+/g, '');
const vcNum = (s) => { const m = /(\d+(?:\.\d+)?)/.exec(String(s || '')); return m ? +m[1] : null; };
function voidChartBlock(mods, picked) {
  const list = (mods || []).filter((m) => m && m.desc).map((m) => ({ desc: m.desc, perMap: m.perMap || 0, share: m.share }));
  // Arbre coché par le joueur dans l'app : affiché tel quel, sans rien deviner.
  if (picked && typeof picked === 'object' && Object.keys(picked).length) return `<div class="vc" data-vc="${esc(JSON.stringify(list))}" data-picked="${esc(JSON.stringify(picked))}"></div>`;
  return list.length ? `<div class="vc" data-vc="${esc(JSON.stringify(list))}"></div>` : '';
}
async function hydrateVoidCharts(root) {
  const boxes = [...(root || document).querySelectorAll('.vc[data-vc]:not([data-done])')];
  if (!boxes.length) return;
  if (!VC) {
    try { VC = await fetch('/voidchart.json').then((r) => r.json()); } catch { return; }
    // Distance au nœud de départ (le plus gros nœud) pour chaque constellation.
    for (const c of VC.constellations) {
      const adj = new Map(c.nodes.map((n) => [n.id, []]));
      for (const [a, b] of c.links) { if (adj.has(a) && adj.has(b)) { adj.get(a).push(b); adj.get(b).push(a); } }
      const start = c.nodes.find((n) => /initial node/i.test(n.name)) || c.nodes.reduce((a, n) => (n.r > a.r ? n : a), c.nodes[0]);
      const dist = new Map([[start.id, 0]]);
      const q = [start.id];
      while (q.length) { const id = q.shift(); for (const nb of adj.get(id)) if (!dist.has(nb)) { dist.set(nb, dist.get(id) + 1); q.push(nb); } }
      c.dist = dist; c.adj = adj; c.start = start.id; c.byId = new Map(c.nodes.map((n) => [n.id, n]));
    }
  }
  for (const box of boxes) {
    box.dataset.done = '1';
    let mods = [];
    try { mods = JSON.parse(box.dataset.vc); } catch { continue; }
    // Nœuds pris, par constellation. Comme dans le jeu, un nœud n'est accessible que relié au départ :
    // on prend chaque talent lu dans le log au plus près de ce qui est déjà pris, et on allume aussi les
    // nœuds de passage (valeur 'path'), que le log ne montre pas toujours.
    const lit = new Map(); // constellation -> Map(nodeId -> mod | 'path')
    const jobs = [];
    // Le jeu additionne les nœuds identiques : « Embers … 10% » = cinq nœuds « Embers … 2% ». On compare donc
    // le texte sans les nombres, et la valeur du log (× nombre d'apparitions par carte) donne combien de nœuds
    // prendre, en déduisant la valeur de chaque nœud pris (un nœud à 8 % compte pour quatre à 2 %).
    for (const m of mods) {
      const key = vcTpl(m.desc), exact = vcNorm(m.desc), want = vcNum(m.desc), times = Math.max(1, Math.round(m.perMap || 1));
      // Sans nombre identique, seulement pour les effets propres au Void Chart (pas les affixes de compas ou de carte).
      // 1er passage : texte identique, dans toutes les constellations ; 2e passage seulement sinon : même texte, autres nombres.
      const anyExact = VC.constellations.some((c) => c.nodes.some((n) => n.effects.some((x) => vcNorm(x) === exact)));
      const loose = !anyExact && /netherrealm|trial|malice/i.test(m.desc);
      for (const c of VC.constellations) {
        const vals = new Map();
        for (const n of c.nodes) {
          const e = n.effects.find((x) => vcNorm(x) === exact) || (loose ? n.effects.find((x) => vcTpl(x) === key) : null);
          if (!e) continue;
          const v = vcNum(e);
          if (want != null && v != null && v > want + 1e-9) continue; // un nœud plus fort que le total ne peut pas en faire partie
          vals.set(n.id, v);
        }
        if (!vals.size) continue;
        const target = want != null ? want * times : times; // sans nombre : un nœud par apparition
        jobs.push({ c, m, cands: new Set(vals.keys()), vals, target, numeric: want != null });
        break;
      }
    }
    let picked = null;
    try { picked = box.dataset.picked ? JSON.parse(box.dataset.picked) : null; } catch { picked = null; }
    if (picked) {
      // Le texte de chaque nœud coché retrouve la fréquence lue dans le log, quand elle existe.
      const byText = new Map(mods.map((m) => [vcNorm(m.desc), m]));
      for (const c of VC.constellations) {
        const ids = picked[c.slug];
        if (!Array.isArray(ids) || !ids.length) continue;
        const taken = new Map([[c.start, 'path']]);
        for (const id of ids) { const n = c.byId.get(+id); if (!n) continue; const m = n.effects.map((e) => byText.get(vcNorm(e))).find(Boolean);
          taken.set(n.id, m || { desc: n.effects.join(' '), perMap: null }); }
        lit.set(c, taken);
      }
      jobs.length = 0;
      box.dataset.exact = '1';
    }
    jobs.sort((a, b) => a.cands.size - b.cands.size); // les talents les moins ambigus d'abord
    for (const { c, m, cands, vals, target, numeric } of jobs) {
      if (!lit.has(c)) lit.set(c, new Map([[c.start, 'path']]));
      const taken = lit.get(c);
      let left = target;
      for (let guard = 0; left > 1e-6 && guard < 60; guard++) {
        // Recherche en largeur depuis tout ce qui est pris : le candidat libre le plus proche, et le chemin pour l'atteindre.
        const prev = new Map([...taken.keys()].map((id) => [id, null]));
        const q = [...taken.keys()];
        let found = null;
        while (q.length && !found) {
          const id = q.shift();
          for (const nb of c.adj.get(id) || []) {
            if (prev.has(nb)) continue;
            prev.set(nb, id); q.push(nb);
            if (cands.has(nb)) { found = nb; break; }
          }
        }
        if (!found) break;
        taken.set(found, m);
        cands.delete(found);
        left -= numeric ? (vals.get(found) || left) : 1;
        for (let id = prev.get(found); id != null && !taken.has(id); id = prev.get(id)) taken.set(id, 'path');
      }
    }
    for (const [c, taken] of [...lit]) if (![...taken.values()].some((v) => v !== 'path')) lit.delete(c);
    if (!lit.size) { box.remove(); continue; }
    const order = [...lit.entries()].sort((a, b) => b[1].size - a[1].size);
    const count = (on) => on.size - 1; // sans le nœud de départ
    const draw = (c) => {
      const on = lit.get(c);
      const xs = c.nodes.map((n) => n.x), ys = c.nodes.map((n) => n.y), pad = 80;
      const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
      const lines = c.links.map(([a, b]) => { const A = c.byId.get(a), B = c.byId.get(b); if (!A || !B) return ''; const hot = on.has(a) && on.has(b);
        return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="${hot ? 'vc-hot' : ''}"/>`; }).join('');
      const nodes = c.nodes.map((n) => { const v = on.get(n.id); const m = v && v !== 'path' ? v : null; const path = v === 'path';
        const tip = [n.name, ...n.effects].concat(path ? [t('vcPath')] : []).concat(m && m.perMap != null ? [t('mgPerMap', { n: nf1.format(m.perMap || 0) }) + (m.share != null ? ' · ' + t('mgShare', { p: Math.round(m.share * 100) + ' %' }) : '')] : []).join('\n');
        // Les icônes de talents de tlidb ne sont plus servies : on dessine des ronds (taille = type de nœud).
        const big = n.r >= 45, mid = n.r >= 38;
        return `<g class="vc-n${m ? ' on' : path ? ' path' : ''}${big ? ' big' : mid ? ' mid' : ''}"><title>${esc(tip)}</title>${m ? `<circle class="vc-glow" cx="${n.x}" cy="${n.y}" r="${n.r + 14}"/>` : ''}<circle class="vc-dot" cx="${n.x}" cy="${n.y}" r="${Math.max(16, n.r * 0.7)}"/></g>`; }).join('');
      return `<svg class="vc-svg" viewBox="${vb.join(' ')}"><g class="vc-links">${lines}</g>${nodes}</svg>`;
    };
    box.innerHTML = `<div class="vc-head"><h4>${esc(t('vcTitle'))}</h4>${box.dataset.exact ? `<span class="tag">${esc(t('vcExact'))}</span>` : ''}<div class="vc-tabs">${order.map(([c, on], i) => `<button class="vc-tab${i ? '' : ' on'}" data-i="${i}">${esc(c.name)} <b>${count(on)}</b></button>`).join('')}</div></div>
      <div class="vc-view">${draw(order[0][0])}</div><p class="muted small">${esc(t(box.dataset.exact ? 'vcHelpExact' : 'vcHelp'))}</p>`;
    box.querySelectorAll('.vc-tab').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      box.querySelectorAll('.vc-tab').forEach((x) => x.classList.toggle('on', x === b));
      box.querySelector('.vc-view').innerHTML = draw(order[+b.dataset.i][0]);
    }));
  }
}
