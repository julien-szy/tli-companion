const { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, nativeImage, dialog, screen, shell, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');
const { LogParser } = require('./parser');
const { Tracker, zoneLabel, TARTARUS_ENTRY, TARTARUS_MAX, STAR_MAX } = require('./tracker');
const { ItemDb, PriceBook } = require('./prices');
const { LogWatcher, findLogPath, findGameDir, expectedLogDir } = require('./logwatcher');
const { JsonStore } = require('./store');
const { buildReport } = require('./report');
const { CommunityClient } = require('./community');
const { BuildStore, cleanBuild, publicBuild, advise } = require('./builds');
const Meta = require('./meta');
const { buildAdvisorContext } = require('./advisor');
const AI = require('./ai');
const { autoUpdater } = require('electron-updater');
// Fonctions en travaux, masquées dans la version publiée (« Bientôt disponible »).
// accounts : comptes Google, votes et commentaires (bêta) ; TLI_ACCOUNTS=0 les cache.
const FEATURES = { builds: false, advisor: false, accounts: process.env.TLI_ACCOUNTS !== '0' };
const I18N = require('./i18n');

// TLI_USERDATA : dossier de données séparé (tests à côté de l'app installée).
// Sinon le dossier reste %APPDATA%\tli-profit-tracker quel que soit le nom affiché de l'app,
// pour garder les réglages, prix et sessions des versions précédentes.
app.setPath('userData', process.env.TLI_USERDATA || path.join(app.getPath('appData'), 'tli-profit-tracker'));
const userDir = app.getPath('userData');
const SETTINGS_FILE = path.join(userDir, 'settings.json');
const HISTORY_FILE = path.join(userDir, 'history.json');
const SESSIONS_DIR = path.join(userDir, 'sessions');
// Session de farm en cours, sauvegardée régulièrement pour survivre à un redémarrage (mise à jour, plantage).
const LIVE_FILE = path.join(userDir, 'live-session.json');
const LIVE_MAX_AGE = 12 * 3600000;
const HEROES = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'heroes.json'), 'utf8')).heroes;
const FE_ID = 100300;
// Noms des arbres de talents, talents principaux, pactes et traits (ids du jeu), avec leurs icônes.
const GAME_NAMES = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'game_names.json'), 'utf8')); } catch { return {}; } })();
const EXTRA_ICONS = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'extra_icons.json'), 'utf8')).icons; } catch { return {}; } })();
function gameNamed(cat, id) {
  const name = (GAME_NAMES[cat] || {})[id];
  return { id, name: name || null, img: name ? EXTRA_ICONS[name] || null : null };
}

const DEFAULTS = {
  logPath: null,
  lang: 'en',            // langue de l'interface : 'en' (défaut) ou 'fr'
  mode: 'farm',          // 'farm' = loot en carte - coût des cartes ; 'all' = tout ce qui entre/sort du sac
  timeMode: 'real',      // 'real' = temps réel de session ; 'map' = temps passé en carte
  communityPrices: true,
  hubPatterns: ['/XZ_'], // chemins de map considérés comme repaire / ville
  overlay: { x: null, y: null, collapsed: false, opacity: 0.92, scale: 1, solid: false, locked: false, dropsSort: 'recent', ultra: false, unitPrice: false, noFlash: false, compact: false },
  server: { url: 'https://tlicompanion.com', token: null, userId: null, name: null },
  activeBuild: null,     // id du build suivi par le conseiller d'achat
  shareMeta: true,       // partage auto du Hero Ranking consulté (pseudos sauf profils masqués)
  stockAlerts: true,     // alerte (avec son) quand il reste 10, 5 puis 1 balise / compas / sonde
  tartarusAlerts: true,  // alerte (avec son) quand le compteur Tartarus atteint 36 (entrée possible) puis 48 (plein)
  // Son de chaque alerte : « builtin » (son intégré : bips pour le stock, sons créés pour Tartarus) ou « file:<chemin> » (fichier du joueur).
  starAlerts: true, // alerte quand les Star Shards d'une région arrivent à 80, et rappel si on lance une carte déjà à 80
  sounds: { tartarusReady: 'builtin', tartarusFull: 'builtin', stock: 'builtin', beacon: 'builtin', beaconEmpty: 'builtin', starFull: 'builtin' },
  volumes: { tartarusReady: 100, tartarusFull: 100, stock: 100, beacon: 100, beaconEmpty: 100, starFull: 100 }, // volume de chaque son d'alerte, en %
  minLootValue: 0,       // loot qui vaut moins de X FE pièce : ignoré dans le profit (0 = tout compter)
  afterTax: true,        // valeurs de vente après la taxe de l'hôtel des ventes (1 FE sur 8 en jeu), décochable
  taxRate: 12.5,         // taxe en % (les 200 premiers FE de la saison, sans taxe, ne sont pas comptés)
  shareFarmStats: true,  // stats de farm ANONYMES envoyées à chaque session (désactivable)
  farmStatsNotice: false,
  keepItems: [],         // objets du sac marqués « à garder » : jamais suggérés à la vente
  autoPause: true, // pause automatique de la session de farm après 3 min sans activité au repaire // information « stats anonymes » déjà montrée
  onboarded: false,      // guide du premier lancement terminé
  tipsSeen: 0,           // version du tutoriel « astuces » déjà vue (montré une fois à tout le monde)
};
const COLLAPSED = { w: 420, h: 48 };
const ULTRA = { w: 210, h: 96 }; // mode ultra minimal : quelques chiffres, sans fond
const EXPANDED = { w: 340, h: 520 };
// Taille du widget choisie en tirant son coin (avant le zoom de « Taille du widget ») :
// largeur et hauteur libres, le contenu ne change pas d'échelle, on voit juste plus ou moins de choses.
const WIDGET_MIN = { w: 260, h: 110 }, WIDGET_MAX = { w: 900, h: 1400 }, COLLAPSED_MIN_W = 300;
function widgetSize() {
  const o = settings.overlay;
  if (o.ultra) return ULTRA;
  return o.collapsed ? { w: o.cw || COLLAPSED.w, h: COLLAPSED.h } : { w: o.w || EXPANDED.w, h: o.h || EXPANDED.h };
}

let settings = loadJson(SETTINGS_FILE, {});
settings = {
  ...DEFAULTS, ...settings,
  overlay: { ...DEFAULTS.overlay, ...(settings.overlay || {}) },
  server: { ...DEFAULTS.server, ...(settings.server || {}) },
  volumes: { ...DEFAULTS.volumes, ...(settings.volumes || {}) },
  sounds: Object.fromEntries(Object.entries({ ...DEFAULTS.sounds, ...(settings.sounds || {}) }).map(([k, v]) => [k, String(v).startsWith('file:') ? v : 'builtin'])),
};
delete settings.overlay.clickThrough; // option retirée (0.3.0)
const tr = () => I18N.make(settings.lang);

const items = new ItemDb(path.join(__dirname, '..', 'data', 'items_seed_en.json'));
const prices = new PriceBook(path.join(userDir, 'prices.json'));
prices.isKnown = (id) => items.known(id);
const meta = new JsonStore(path.join(userDir, 'meta.json'), { affixDesc: {}, heroNames: {} });
items.custom = meta.data.itemNames || {};
const tracker = new Tracker({ prices, items, settings, meta });
// Nom de classe automatique quand le numéro de héros est connu.
tracker.heroLookup = (id) => { const h = HEROES.find((x) => x.gameId === +id); return h ? { key: h.key, name: `${h.hero} — ${h.trait}` } : null; };
const parser = new LogParser((ev) => tracker.handle(ev));
const community = new CommunityClient(settings, () => saveSettings());
const builds = new BuildStore(path.join(userDir, 'builds'));
// Chaque prix vu à l'hôtel des ventes est partagé (anonymement) avec le serveur.
tracker.on('price', (id) => { const e = prices.exchange[id]; if (e) community.queuePrice(id, e.price, e.ts); });

async function syncServerPrices() {
  try { await community.flushPrices(); } catch { /* serveur injoignable : on réessaiera */ }
  try { prices.setServerPrices(await community.fetchPrices()); } catch { /* idem */ }
}
let watcher = null;
let status = { logPath: null, state: 'init', progress: 0, error: '', msgKey: null, msgVars: null };

let overlay = null;
let dashboard = null;
let tray = null;

function loadJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
// Réglages envoyés aux fenêtres : sans le jeton secret du serveur.
function publicSettings() {
  const { token, ...server } = settings.server;
  return { ...settings, server: { ...server, registered: !!token } };
}
function saveSettings() {
  fs.mkdirSync(userDir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}
// Renomme les zones déjà enregistrées (historique, sessions) avec la table data/zone_names.json.
function renameStoredZones() {
  const fix = (n) => zoneLabel(n);
  try {
    const hist = loadJson(HISTORY_FILE, null);
    if (Array.isArray(hist)) {
      let changed = false;
      for (const r of hist) {
        if (fix(r.name) !== r.name) { r.name = fix(r.name); changed = true; }
        if (Array.isArray(r.zones)) r.zones = r.zones.map((z) => { const f = fix(z); if (f !== z) changed = true; return f; });
      }
      if (changed) fs.writeFileSync(HISTORY_FILE, JSON.stringify(hist));
    }
    for (const f of fs.existsSync(SESSIONS_DIR) ? fs.readdirSync(SESSIONS_DIR) : []) {
      if (!f.endsWith('.json')) continue;
      const file = path.join(SESSIONS_DIR, f);
      const r = loadJson(file, null);
      if (!r || !r.strategy) continue;
      let changed = false;
      for (const m of [...(r.strategy.maps || []), ...(r.runs || [])]) if (fix(m.name) !== m.name) { m.name = fix(m.name); changed = true; }
      if (changed) fs.writeFileSync(file, JSON.stringify(r));
    }
  } catch (e) { console.error('Noms de zones :', e.message); }
}

function appendHistory(run) {
  const hist = loadJson(HISTORY_FILE, []);
  hist.push({ ...tracker.runSummary(run), items: tracker.runSummary(run).items.slice(0, 20) });
  if (hist.length > 5000) hist.splice(0, hist.length - 5000);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(hist));
}

// ---------------- Sessions de farm ----------------

function saveReport(report) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.writeFileSync(path.join(SESSIONS_DIR, `${report.id}.json`), JSON.stringify(report));
}
function listReports() {
  let files = [];
  try { files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json')); } catch { return []; }
  return files.map((f) => {
    const r = loadJson(path.join(SESSIONS_DIR, f), null);
    if (!r) return null;
    return {
      id: r.id, title: r.title, startedAt: r.startedAt, endedAt: r.endedAt, hero: r.hero,
      totals: r.totals, maps: r.strategy.maps.slice(0, 3).map((m) => m.name), shared: r.shared || null, strategyTag: r.strategyTag || null,
    };
  }).filter(Boolean).sort((a, b) => b.startedAt - a.startedAt);
}
function reportPath(id) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('invalid id');
  return path.join(SESSIONS_DIR, `${id}.json`);
}

function beginFarm() {
  autoStatsFlush();
  tracker.startFarm();
  saveLiveSession();
}

// Identifiant aléatoire de l'installation, seulement pour compter les joueurs distincts dans les stats anonymes
// (jamais relié au pseudo ; le serveur n'en garde qu'une empreinte).
if (!settings.anonId) { settings.anonId = require('crypto').randomUUID(); saveSettings(); }

// Stats anonymes d'une session : seulement des chiffres et des numéros d'objets, ni pseudo, ni titre, ni notes.
async function sendFarmStats(report) {
  if (!settings.shareFarmStats || !report || report.statsSent) return false;
  const t = report.totals;
  if (t.runs < 3 || t.realMs < 5 * 60000) return false;
  const body = {
    id: report.id, anonId: settings.anonId,
    heroId: report.hero ? report.hero.id : null,
    mainMap: report.strategy.maps[0] ? report.strategy.maps[0].name : null,
    strategyTag: report.strategyTag || null,
    server: report.context ? report.context.server : null, season: report.context ? report.context.season : null,
    runs: t.runs, realMs: t.realMs, mapMs: t.mapMs, afkMs: t.afkMs || 0, profit: t.profit, perHour: t.perHourReal,
    loot: report.loot.map((i, k) => ({ id: i.id, qty: i.qty, unit: i.unit, ...(k < 40 ? { name: i.name, img: i.img } : {}) })),
    // Mécanique de farm : modificateurs de carte (talents Netherrealm, compas, sondes…) et leur fréquence par carte.
    modifiers: (report.strategy.modifiers || []).filter((m) => m.desc).slice(0, 25).map((m) => ({ id: m.id, desc: m.desc, perMap: m.perMap })),
    consumables: report.strategy.consumables.map((c) => ({ id: c.id, name: c.name, img: c.img, qty: c.qty, unit: c.unit })),
    // Zones de la carte principale : le serveur en déduit le niveau (T8-1, Profound…).
    areaIds: report.strategy.maps[0] ? report.strategy.maps[0].areaIds || {} : {},
  };
  try {
    await community.sendFarmStats(body);
    report.statsSent = true;
    saveReport(report);
    return true;
  } catch (e) { console.error('Stats anonymes :', e.message); return false; }
}
const STRATEGY_TAGS = ['mapping', 'boss', 'netherrealm', 'dream', 'vorax', 'overrealm', 'sandlord', 'clockwork', 'blacksail', 'deepspace', 'leveling', 'other'];

// Contexte de la session (sans identifiant) : région du serveur et saison en cours.
function farmContext() {
  const cs = Meta.currentServer(status.logPath);
  let season = null;
  try { season = Math.max(...Meta.listRankingFiles(status.logPath, { includeStale: true }).map((f) => Math.floor(f.season / 100))) || null; } catch { /* aucun classement */ }
  return { server: cs ? cs.server : null, season: Number.isFinite(season) ? season : null };
}

// open = false : la session est enregistrée sans ouvrir la fenêtre principale (bouton « Arrêter et relancer » du widget).
function stopFarm(title, open = true) {
  const ended = tracker.stopFarm();
  saveLiveSession();
  if (!ended.runs.length) return null;
  const report = buildReport(ended, tracker, { appVersion: app.getVersion(), title });
  report.context = farmContext();
  saveReport(report);
  sendFarmStats(report);
  refreshFarmRate();
  // La fenêtre principale demande alors : enregistrer ? publier ?
  if (open) openDashboard(`endsession:${report.id}`);
  return report.id;
}

// ---------------- Log ----------------

async function startWatching() {
  if (watcher) watcher.stop();
  const file = process.env.TLI_NOLOG ? null : findLogPath(settings.logPath); // TLI_NOLOG : test de l'aide
  // Pas de log : jeu trouvé (= « Enable Log » pas activé) ou jeu introuvable (= choisir le fichier à la main).
  const gameDir = file ? null : findGameDir();
  status = { ...status, logPath: file, gameDir, expectedLog: gameDir ? path.join(expectedLogDir(gameDir), 'UE_game.log') : null,
    state: file ? 'loading' : 'nolog', progress: 0, error: '' };
  broadcast();
  if (!file) return;

  tracker.resetBag();
  tracker.replay = true;
  watcher = new LogWatcher(file, (l) => parser.feed(l));
  watcher.onRotate = () => { tracker.resetBag(); broadcast(); };
  try {
    const simulateMb = +(process.env.TLI_SIMULATE_MB || 0);
    await watcher.bootstrap((p) => { status.progress = p; broadcastThrottled(); }, simulateMb * 1024 * 1024);
  } catch (e) {
    status.state = 'error';
    status.error = e.message;
  }
  tracker.endReplay(parser.lastTs);
  if (!restoreLiveSession()) tracker.session.startedAt = Date.now();
  if (status.state !== 'error') status.state = 'live';
  if (process.env.TLI_SIMULATE_MB && process.env.TLI_SHOT) tracker.startFarm();
  watcher.start();
  broadcast();
}

async function refreshCommunity() {
  if (!settings.communityPrices) return;
  try {
    const n = await prices.fetchCommunity(() => community.communityPrices());
    status.msgKey = 'msg.communityLoaded'; status.msgVars = { n };
  } catch (e) {
    status.msgKey = 'msg.communityFailed'; status.msgVars = { err: e.message };
  }
  broadcast();
}

// ---------------- Diffusion de l'état vers les fenêtres ----------------

let lastBroadcast = 0;
let pendingBroadcast = null;
// ---------------- Conseiller d'achat ----------------

// FE/h de référence : la session en cours si elle dure assez, sinon la moyenne des 5 dernières sessions de farm.
let pastFarmRate = null;
function refreshFarmRate() {
  const recent = listReports().filter((r) => r.totals.realMs > 10 * 60000).slice(0, 5);
  pastFarmRate = recent.length ? recent.reduce((a, r) => a + r.totals.perHourReal, 0) / recent.length : null;
}
function farmRate(snap) {
  if (snap && snap.session.realTimeMs > 10 * 60000 && snap.session.perHour > 0) return snap.session.perHour;
  return pastFarmRate;
}
// Compétences possédées : le jeu les liste dans AccountCache\<compte>\<perso>\SkillStateData.
// On prend le fichier le plus récent (dernier personnage joué). Relu au plus toutes les 30 s.
let ownedSkills = { at: 0, ids: new Set() };
function readOwnedSkills() {
  if (Date.now() - ownedSkills.at < 30000) return ownedSkills.ids;
  ownedSkills.at = Date.now();
  try {
    if (!status.logPath) return ownedSkills.ids;
    const cache = path.join(status.logPath, '..', '..', '..', '..', 'Local', 'AccountCache');
    let best = null;
    for (const acc of fs.readdirSync(cache)) {
      let chars = [];
      try { chars = fs.readdirSync(path.join(cache, acc)); } catch { continue; }
      for (const ch of chars) {
        const f = path.join(cache, acc, ch, 'SkillStateData');
        try { const st = fs.statSync(f); if (!best || st.mtimeMs > best.t) best = { f, t: st.mtimeMs }; } catch { /* pas un perso */ }
      }
    }
    if (best) {
      const d = JSON.parse(fs.readFileSync(best.f, 'utf8'));
      ownedSkills.ids = new Set(Object.keys(d.SkillCacheList || {}).map((k) => +k.split('_')[0]).filter((n) => n > 0));
    }
  } catch { /* cache absent ou format changé : on garde la dernière lecture */ }
  return ownedSkills.ids;
}

function adviceFor(build, snap) {
  const skills = readOwnedSkills();
  return advise(build, {
    items, prices,
    bagQty: (id) => tracker.bagQty(id) + (skills.has(id) ? 1 : 0),
    equipped: tracker.equippedIds(),
    perHour: farmRate(snap),
    feInBag: tracker.bagQty(FE_ID),
  });
}
// Résumé pour le widget : le prochain achat conseillé du build suivi.
function adviceSummary(snap) {
  if (!FEATURES.builds || !settings.activeBuild) return null;
  const b = builds.get(settings.activeBuild);
  if (!b) return null;
  const a = adviceFor(b, snap);
  const n = a.next[0];
  return {
    buildTitle: b.title, stepIndex: a.currentIndex, stepCount: b.steps.length,
    next: n ? { name: n.name, img: n.img, cost: n.cost, missing: n.missing, affordable: n.affordable, hours: n.hours } : null,
    stepMissing: a.currentMissing, stepHours: a.currentHours,
  };
}

// Récap du build suivi pour l'accueil : étape visée, progression, FE du sac (FE seulement) et prochains achats.
let recapCache = { at: 0, key: '', value: null };
function buildRecap(snap) {
  if (!settings.activeBuild) return null;
  const b = builds.get(settings.activeBuild);
  if (!b) return null;
  const key = b.id + ':' + b.updatedAt;
  if (recapCache.key === key && Date.now() - recapCache.at < 5000) return recapCache.value;
  const a = adviceFor(b, snap);
  const st = a.currentIndex != null ? a.steps[a.currentIndex] : null;
  const total = a.steps.reduce((n, s) => n + s.total, 0);
  const value = {
    id: b.id, title: b.title, heroKey: b.heroKey, stepCount: b.steps.length,
    stepIndex: a.currentIndex, stepTitle: st ? st.title : '', stepPct: st ? st.pct : 100, chosen: a.chosenIndex,
    overallPct: total > 0 ? Math.round(((total - a.remainingAll) / total) * 100) : 0,
    missing: a.currentMissing, hours: a.currentHours, feInBag: a.feInBag,
    next: a.next.slice(0, 4).map((i) => ({ name: i.name, img: i.img, cost: i.cost, affordable: i.affordable })),
  };
  recapCache = { at: Date.now(), key, value };
  return value;
}

function broadcast() {
  lastBroadcast = Date.now();
  const snap = { ...tracker.snapshot(), status, settings: publicSettings() };
  snap.overlayVisible = !!(overlay && !overlay.isDestroyed() && overlay.isVisible());
  snap.update = updateState;
  snap.updateRequired = updateRequired;
  snap.appVersion = app.getVersion();
  snap.advice = adviceSummary(snap);
  snap.features = { accounts: FEATURES.accounts };
  snap.buildRecap = buildRecap(snap);
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send('state', snap);
  if (dashboard && !dashboard.isDestroyed()) dashboard.webContents.send('state', snap);
}
function broadcastThrottled() {
  if (pendingBroadcast) return;
  const wait = Math.max(0, 250 - (Date.now() - lastBroadcast));
  pendingBroadcast = setTimeout(() => { pendingBroadcast = null; broadcast(); }, wait);
}
tracker.on('changed', () => { if (!tracker.replay) broadcastThrottled(); });
tracker.on('delta', (e) => {
  if (dashboard && !dashboard.isDestroyed() && tracker.visible(e.id)) dashboard.webContents.send('delta', tracker._feedEntry(e));
  if (e.cat === 'cost' && e.delta < 0) setImmediate(() => checkStock(e.id));
});

// ---------------- Sons des alertes ----------------
// stock = compas, sondes et autres consommables ; beacon = balises (10, 5, dernière) ; beaconEmpty = plus aucune balise.
const SOUND_KEYS = ['tartarusReady', 'tartarusFull', 'stock', 'beacon', 'beaconEmpty', 'starFull'];
const BUILTIN_SOUNDS = { tartarusReady: 'tartarus-ready-voice.mp3', tartarusFull: 'tartarus-full.wav', beaconEmpty: 'beacon-empty-voice.mp3', starFull: 'star-full-voice.mp3' }; // 36 : voix « It's time to Tartarus » (ElevenLabs)
// Son à jouer : fichier du joueur, son intégré créé pour l'app (Tartarus) ou bips (stock).
function soundSpecFor(key) {
  const v = settings.sounds[key] || 'builtin';
  if (v.startsWith('file:')) return v;
  return BUILTIN_SOUNDS[key] ? 'builtin:' + key : 'synth';
}
// Contenu d'un son en data URL (son intégré, ou fichier choisi par le joueur dans les réglages).
const soundCache = new Map();
ipcMain.handle('soundData', (_e, spec) => {
  if (typeof spec !== 'string') return null;
  let file = null;
  if (spec.startsWith('builtin:') && BUILTIN_SOUNDS[spec.slice(8)]) file = path.join(__dirname, '..', 'data', 'sounds', BUILTIN_SOUNDS[spec.slice(8)]);
  else if (spec.startsWith('file:') && Object.values(settings.sounds).includes(spec)) file = spec.slice(5);
  if (!file) return null;
  if (soundCache.has(file)) return soundCache.get(file);
  try {
    if (fs.statSync(file).size > 8 * 1024 * 1024) return null;
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime = { wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4' }[ext] || 'audio/wav';
    const url = `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
    soundCache.set(file, url);
    return url;
  } catch { return null; }
});
ipcMain.handle('soundSpec', (_e, key) => (SOUND_KEYS.includes(key) ? soundSpecFor(key) : null));

// ---------------- Alerte Tartarus ----------------
// 36 = assez pour entrer dans Tartarus ; 48 = plein (les suivants sont perdus).
tracker.on('tartarus', ({ prev, value }) => {
  if (!settings.tartarusAlerts || prev == null) return;
  let kind = null;
  if (prev < TARTARUS_MAX && value >= TARTARUS_MAX) kind = 'full';
  else if (prev < TARTARUS_ENTRY && value >= TARTARUS_ENTRY) kind = 'ready';
  if (kind) sendAlert({ kind: 'tartarus-' + kind, text: tr()('tart.' + kind, { n: value, max: TARTARUS_MAX }), level: kind === 'full' ? 1 : 5, qty: kind === 'full' ? 1 : 5 });
});

// ---------------- Star Shards (x/80 par région) ----------------
// Alerte quand une région arrive à 80, et rappel quand on utilise une balise d'une région déjà à 80
// (au plus une fois toutes les 30 min par région, pour ne pas répéter à chaque carte).
const starReminded = {};
function starAlert(region, value, kind) {
  const name = region || tr()('star.unknownRegion');
  sendAlert({ kind: 'star-full', text: tr()(kind === 'reached' ? 'star.reached' : 'star.already', { region: name, n: value, max: STAR_MAX }), level: 1, qty: 1 });
}
tracker.on('starShard', ({ prev, value, region }) => {
  if (!settings.starAlerts || prev == null) return;
  if (prev < STAR_MAX && value >= STAR_MAX) { starAlert(region, value, 'reached'); if (region) starReminded[region] = Date.now(); }
});
tracker.on('beaconUsed', ({ region }) => {
  if (!settings.starAlerts || !region) return;
  const key = Object.keys(tracker.starShards).find((k) => tracker.starRegion(k) === region);
  if (!key || tracker.starShards[key] < STAR_MAX) return;
  if (Date.now() - (starReminded[region] || 0) < 30 * 60000) return;
  starReminded[region] = Date.now();
  starAlert(region, tracker.starShards[key], 'already');
});

// ---------------- Alertes de stock ----------------
// Objets consommés à l'ouverture des cartes (balises, compas, sondes…) : alerte à 10, 5 puis au dernier.
const STOCK_LEVELS = [10, 5, 1];
const BEACON_LEVELS = [10, 5, 1, 0]; // balises : aussi une alerte quand on utilise la dernière
function checkStock(id) {
  if (!tracker.visible(id)) return; // objet sans nom : pas d'alerte « Item #1234 »
  meta.data.mapConsumables = meta.data.mapConsumables || {};
  const known = meta.data.mapConsumables;
  const qty = tracker.bagQty(id);
  const beacon = items.get(id).type === '信标';
  const levels = beacon ? BEACON_LEVELS : STOCK_LEVELS;
  const level = levels.slice().reverse().find((l) => qty <= l) ?? null; // 0, 1, 5 ou 10
  const prev = known[id] ? known[id].level : null;
  known[id] = { level: qty > STOCK_LEVELS[0] ? null : (prev != null && level != null ? Math.min(prev, level) : level) };
  meta.save();
  if (!settings.stockAlerts || level == null || (prev != null && level >= prev)) return;
  const it = items.get(id);
  sendAlert({ id, name: it.name, img: it.img, qty, level, beacon });
}
// Son joué par une seule fenêtre : le widget s'il est affiché (en jeu), sinon la fenêtre principale.
const soundVolume = (key) => Math.min(100, Math.max(0, +((settings.volumes || {})[key] ?? 100))) / 100;
function sendAlert(alert) {
  const key = alert.kind === 'star-full' ? 'starFull' : alert.kind === 'tartarus-full' ? 'tartarusFull' : alert.kind === 'tartarus-ready' ? 'tartarusReady'
    : alert.beacon ? (alert.level === 0 ? 'beaconEmpty' : 'beacon') : 'stock';
  alert = { ...alert, soundSpec: soundSpecFor(key), volume: soundVolume(key) };
  const ovShown = overlay && !overlay.isDestroyed() && overlay.isVisible();
  if (ovShown) overlay.webContents.send('stockAlert', { ...alert, sound: true });
  if (dashboard && !dashboard.isDestroyed()) dashboard.webContents.send('stockAlert', { ...alert, sound: !ovShown });
}
tracker.on('runEnded', (run) => {
  try { appendHistory(run); } catch (e) { console.error(e); }
  // Les cartes ne sont comptées que pendant une session de farm : les stats anonymes partent à la fin de la session.
});

// ---------------- Stats anonymes automatiques (toutes les cartes, sans « Démarrer ») ----------------
// Les cartes enchaînées sur le même type de balise (région + Timemark) forment un lot, envoyé
// quand il atteint 10 cartes, quand le joueur change de carte, après 20 min sans carte ou à la fermeture.
const AUTO_MAX_RUNS = 10, AUTO_IDLE_MS = 20 * 60000;
let autoRuns = [];
let autoIdleTimer = null;
const mapKey = (name) => { const m = /^(.*?)\s*Beacon\s*\(Timemark\s*(\d+)\)/i.exec(name || ''); return m ? `${m[1].trim()}|${m[2]}` : name || '?'; };
function autoStatsAdd(run) {
  if (!settings.shareFarmStats) return;
  if (autoRuns.length && mapKey(autoRuns[0].name) !== mapKey(run.name)) autoStatsFlush();
  autoRuns.push(run);
  if (autoRuns.length >= AUTO_MAX_RUNS) autoStatsFlush();
  clearTimeout(autoIdleTimer);
  autoIdleTimer = setTimeout(autoStatsFlush, AUTO_IDLE_MS);
}
// Modificateurs des cartes du lot (même calcul que la fiche de session) : fréquence moyenne par carte.
function autoModifiers(runs) {
  const totals = {};
  let n = 0;
  for (const r of runs) {
    if (!r.modifiers || !Object.keys(r.modifiers).length) continue;
    n++;
    for (const id in r.modifiers) totals[id] = (totals[id] || 0) + r.modifiers[id];
  }
  const descs = tracker.meta.data.affixDesc || {};
  return Object.keys(totals).filter((id) => descs[id]).map((id) => ({ id: +id, desc: descs[id], perMap: n ? totals[id] / n : 0 }))
    .sort((a, b) => b.perMap - a.perMap).slice(0, 25);
}
function autoStatsFlush() {
  clearTimeout(autoIdleTimer);
  const runs = autoRuns;
  autoRuns = [];
  if (runs.length < 3 || !settings.shareFarmStats) return null;
  const first = runs[0], last = runs[runs.length - 1];
  const realMs = Math.max(0, last.endedAt - first.startedAt);
  if (realMs < 5 * 60000) return null;
  const loot = {}, cost = {};
  let mapMs = 0;
  for (const r of runs) {
    mapMs += Math.max(0, r.endedAt - r.startedAt);
    for (const id in r.loot) loot[id] = (loot[id] || 0) + r.loot[id];
    for (const id in r.cost) cost[id] = (cost[id] || 0) + r.cost[id];
  }
  const profit = tracker.lootValueOf(loot) + tracker.valueOf(cost);
  const heroes = {};
  for (const r of runs) if (r.heroId != null) heroes[r.heroId] = (heroes[r.heroId] || 0) + 1;
  const heroId = Object.keys(heroes).sort((a, b) => heroes[b] - heroes[a])[0];
  const ctx = farmContext();
  const body = {
    id: require('crypto').randomUUID(), anonId: settings.anonId,
    heroId: heroId != null ? +heroId : null, mainMap: first.name, strategyTag: null,
    server: ctx.server, season: ctx.season,
    runs: runs.length, realMs, mapMs, afkMs: 0, profit, perHour: profit / (realMs / 3600000),
    loot: tracker.itemList(loot).filter((i) => i.qty > 0).slice(0, 150).map((i, k) => ({ id: i.id, qty: i.qty, unit: i.unit, ...(k < 40 ? { name: i.name, img: i.img } : {}) })),
    modifiers: autoModifiers(runs),
    consumables: tracker.itemList(cost).filter((i) => i.qty < 0).slice(0, 40).map((i) => ({ id: i.id, name: i.name, img: i.img, qty: i.qty, unit: i.unit })),
    areaIds: runs.filter((r) => r.name === first.name && r.node).reduce((a, r) => { a[r.node.areaId] = (a[r.node.areaId] || 0) + 1; return a; }, {}),
  };
  return community.sendFarmStats(body).catch((e) => console.error('Stats anonymes (auto) :', e.message));
}
// Fermeture de l'app : on envoie le dernier lot (3 s maximum) avant de quitter.
let quittingAfterFlush = false;
// ---------------- Session en cours sauvegardée ----------------
// Écrite toutes les 30 s pendant une session, à la fermeture et avant une mise à jour ; effacée à la fin
// de la session. Reprise une seule fois, au premier chargement du log.
let liveRestoreTried = false;
function saveLiveSession() {
  if (!liveRestoreTried) return; // pas avant d'avoir essayé de reprendre l'ancienne
  const s = tracker.session;
  try {
    if (!s || !s.recording) { if (fs.existsSync(LIVE_FILE)) fs.unlinkSync(LIVE_FILE); return; }
    const data = { savedAt: Date.now(), appVersion: app.getVersion(), session: { ...s, feed: s.feed.slice(-300) } };
    const tmp = LIVE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, LIVE_FILE);
  } catch (e) { console.error('Sauvegarde de la session en cours :', e.message); }
}
function restoreLiveSession() {
  if (liveRestoreTried) return false;
  liveRestoreTried = true;
  const d = loadJson(LIVE_FILE, null);
  if (!d || !d.session || !d.session.recording || !(Date.now() - d.savedAt < LIVE_MAX_AGE)) return false;
  try {
    const ok = tracker.restoreSession(d.session, d.savedAt);
    if (ok) console.log(`Session de farm reprise (${d.session.runs.length} cartes, sauvegardée il y a ${Math.round((Date.now() - d.savedAt) / 1000)} s)`);
    return ok;
  } catch (e) { console.error('Reprise de la session :', e.message); return false; }
}
setInterval(saveLiveSession, 30000).unref();
app.on('before-quit', () => saveLiveSession());

app.on('before-quit', (e) => {
  if (quittingAfterFlush || autoRuns.length < 3) return;
  const p = autoStatsFlush();
  if (!p) return;
  e.preventDefault();
  quittingAfterFlush = true;
  Promise.race([p, new Promise((r) => setTimeout(r, 3000))]).then(() => app.quit());
});
setInterval(broadcast, 1000); // chronos

// ---------------- Fenêtres ----------------

function createOverlay() {
  const o = settings.overlay;
  const size = widgetSize();
  const wa = screen.getPrimaryDisplay().workArea;
  overlay = new BrowserWindow({
    width: Math.round(size.w * o.scale), height: Math.round(size.h * o.scale),
    x: o.x ?? wa.x + wa.width - size.w - 20, y: o.y ?? wa.y + 80,
    frame: false, transparent: true, resizable: false, skipTaskbar: true,
    alwaysOnTop: true, hasShadow: false, focusable: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  overlay.setVisibleOnAllWorkspaces(true);
  overlay.loadFile(path.join(__dirname, 'ui', 'overlay.html'));
  overlay.once('ready-to-show', () => { overlay.webContents.setZoomFactor(o.scale); overlay.showInactive(); applyOpacity(); applyLock(); broadcast(); });
  overlay.on('moved', () => {
    const [x, y] = overlay.getPosition();
    settings.overlay.x = x; settings.overlay.y = y; saveSettings();
  });
  overlay.on('closed', () => { overlay = null; });
}

function setCollapsed(c) {
  settings.overlay.collapsed = c;
  saveSettings();
  if (!overlay) return;
  const size = widgetSize();
  const s = settings.overlay.scale;
  overlay.setResizable(true);
  overlay.setSize(Math.round(size.w * s), Math.round(size.h * s));
  overlay.setResizable(false);
  overlay.webContents.setZoomFactor(s);
  broadcast();
}

// Widget verrouillé : il ne bouge plus et les clics passent au jeu à travers lui.
// Déverrouillage : Ctrl+Maj+L, menu de l'icône près de l'horloge, ou case des Réglages.
function applyLock() {
  if (!overlay || overlay.isDestroyed()) return;
  const locked = !!settings.overlay.locked;
  overlay.setIgnoreMouseEvents(locked, { forward: true });
  overlay.setMovable(!locked);
}
function setLocked(v) {
  settings.overlay.locked = !!v;
  saveSettings();
  applyLock();
  buildTrayMenu();
  broadcast();
}

function applyOpacity() {
  if (!overlay) return;
  // Mode opaque : aucune transparence (fenêtre et fond du widget).
  overlay.setOpacity(settings.overlay.solid ? 1 : settings.overlay.opacity);
}

// Redimensionner le widget en tirant son coin : on suit la souris depuis le processus principal
// (indépendant du zoom de la page) et on change sa largeur et sa hauteur, sans toucher au zoom.
const SCALE_MIN = 0.6, SCALE_MAX = 2;
let resizeTimer = null;
function applyScale(s) {
  const size = widgetSize();
  overlay.setResizable(true);
  overlay.setSize(Math.round(size.w * s), Math.round(size.h * s));
  overlay.setResizable(false);
  overlay.webContents.setZoomFactor(s);
}
function startResize() {
  if (!overlay || resizeTimer) return;
  const o = settings.overlay;
  const size = widgetSize();
  const start = screen.getCursorScreenPoint();
  const s = o.scale || 1;
  const t0 = Date.now();
  const clamp = (v, a, b) => Math.round(Math.min(b, Math.max(a, v)));
  resizeTimer = setInterval(() => {
    if (!overlay || overlay.isDestroyed() || Date.now() - t0 > 30000) return endResize();
    const p = screen.getCursorScreenPoint();
    const w = clamp(size.w + (p.x - start.x) / s, o.collapsed ? COLLAPSED_MIN_W : WIDGET_MIN.w, WIDGET_MAX.w);
    // Widget réduit : seule la largeur change.
    const h = o.collapsed ? size.h : clamp(size.h + (p.y - start.y) / s, WIDGET_MIN.h, WIDGET_MAX.h);
    const cur = widgetSize();
    if (w === cur.w && h === cur.h) return;
    if (o.collapsed) o.cw = w; else { o.w = w; o.h = h; }
    overlay.setResizable(true);
    overlay.setSize(Math.round(w * s), Math.round(h * s));
    overlay.setResizable(false);
  }, 16);
}
function endResize() {
  if (!resizeTimer) return;
  clearInterval(resizeTimer); resizeTimer = null;
  saveSettings(); broadcast();
}

// nav (facultatif) : onglet ou « session:<id> » à afficher à l'ouverture.
// Ouvre la fenêtre principale, ou la cache si elle est déjà affichée (bouton du widget, Ctrl+Maj+D).
function toggleDashboard() {
  if (dashboard && !dashboard.isDestroyed() && dashboard.isVisible() && !dashboard.isMinimized()) dashboard.hide();
  else openDashboard();
  if (process.env.TLI_SHOT) console.log('DASH visible =', dashboard.isVisible());
}
function openDashboard(nav) {
  nav = typeof nav === 'string' ? nav : null;
  if (dashboard && !dashboard.isDestroyed()) {
    dashboard.show(); dashboard.focus();
    if (nav) dashboard.webContents.send('navigate', nav);
    return;
  }
  dashboard = new BrowserWindow({
    width: 1180, height: 760, minWidth: 820, minHeight: 520,
    backgroundColor: '#0f1115', title: tr()('dash.windowTitle'), autoHideMenuBar: true, icon: APP_ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  dashboard.loadFile(path.join(__dirname, 'ui', 'dashboard.html'));
  dashboard.on('page-title-updated', (e) => e.preventDefault());
  dashboard.webContents.once('did-finish-load', () => {
    broadcast();
    if (nav) dashboard.webContents.send('navigate', nav);
  });
  dashboard.on('closed', () => {
    dashboard = null;
    // Fermer la fenêtre principale quitte l'app, sauf si le widget est affiché par-dessus le jeu.
    if (!(overlay && !overlay.isDestroyed() && overlay.isVisible()) && !process.env.TLI_SHOT) app.quit();
  });
}

// Icône de l'app (flamme) : zone de notification et fenêtres.
const APP_ICON = path.join(__dirname, 'ui', 'icon.png');
function trayIcon() {
  return nativeImage.createFromPath(APP_ICON).resize({ width: 16, height: 16, quality: 'best' });
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('TLI Companion');
  buildTrayMenu();
  tray.on('click', openDashboard);
}

// Menu de la zone de notification, dans la langue choisie.
function buildTrayMenu() {
  if (!tray) return;
  const t = tr();
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: t('tray.dashboard'), click: openDashboard },
    { label: t('tray.toggleOverlay'), click: toggleOverlay },
    { label: t('tray.collapse'), click: () => setCollapsed(!settings.overlay.collapsed) },
    { label: t('tray.lock'), type: 'checkbox', checked: !!settings.overlay.locked, click: (item) => setLocked(item.checked) },
    { type: 'separator' },
    { label: t('tray.farm'), click: () => (tracker.session.recording ? stopFarm('') : beginFarm()) },
    { label: t('tray.reset'), click: () => tracker.newSession() },
    { type: 'separator' },
    { label: t('tray.quit'), click: () => app.quit() },
  ]));
}

function toggleOverlay() {
  if (!overlay) { createOverlay(); return broadcast(); }
  if (overlay.isVisible()) overlay.hide(); else overlay.showInactive();
  broadcast();
}

// ---------------- IPC ----------------

ipcMain.handle('getFull', () => ({ ...tracker.fullData(), status, settings: publicSettings() }));
ipcMain.handle('getHistory', () => loadJson(HISTORY_FILE, []));
// Onglet Prix : tous les objets qui ont un prix, filtrés / triés / paginés.
// Les objets non identifiés (prix communautaire sans nom public) sont masqués sauf demande.
ipcMain.handle('searchPrices', (_e, opts) => {
  const o = typeof opts === 'string' ? { q: opts } : (opts || {});
  const q = (o.q || '').trim();
  let ids = q ? items.search(q, 2000) : prices.list();
  const unknownCount = ids.filter((id) => !items.known(id)).length;
  if (!o.showUnknown) ids = ids.filter((id) => items.known(id));
  let rows = ids.map((id) => ({ id, ...items.get(id), ...prices.get(id), manual: prices.manual[id] ?? null }));
  if (o.source === 'hdv') rows = rows.filter((r) => r.source === 'hdv');
  else if (o.source === 'manual') rows = rows.filter((r) => r.manual != null);
  else if (o.source === 'community') rows = rows.filter((r) => r.source === 'communauté' || r.source === 'serveur');
  const sorts = {
    name: (a, b) => a.name.localeCompare(b.name),
    priceDesc: (a, b) => b.price - a.price,
    priceAsc: (a, b) => a.price - b.price,
    recent: (a, b) => (b.ts || 0) - (a.ts || 0),
  };
  rows.sort(sorts[o.sort] || sorts.name);
  const limit = Math.min(2000, +o.limit || 200);
  return { total: rows.length, unknownCount, rows: rows.slice(0, limit) };
});
// « Analyser mon sac » (bêta) : chaque objet du sac avec son prix, la valeur du tas et un verdict.
// Verdicts : sell (le tas vaut au moins le seuil), low (moins), noprice (prix inconnu ou non confirmé), bound (lié, invendable).
// Compétences : leur prix dépend du niveau, que le log ne donne pas (le prix communautaire est souvent celui d'une version haut niveau).
// Les légendaires et les organes ont un prix assez fixe : ils restent comptés.
const VARIABLE_TYPES = new Set(['主动技能', '辅助技能', '崇高辅助技能', '华贵辅助技能', '被动技能', '塔罗斯技能', '始源塔罗斯技能', '英雄追忆']);
const isVariablePrice = (it) => VARIABLE_TYPES.has(it.type);
// Courbe de prix d'un objet : prix vus par les joueurs TLI Companion (serveur) + tes propres vérifications.
ipcMain.handle('priceHistory', async (_e, id, days) => {
  id = +id; days = Math.min(120, Math.max(1, +days || 30));
  const since = Date.now() - days * 86400000;
  const own = (prices.exHistory[id] || []).filter(([ts]) => ts > since).map(([ts, price]) => ({ ts, price }));
  let server = [];
  try { server = (await community.priceHistory(id, days)).points || []; } catch { /* hors ligne */ }
  const it = items.get(id);
  return { id, name: it.name, img: it.img, days, now: prices.get(id), own, server };
});
ipcMain.handle('bagScan', (_e, opts) => {
  const min = Math.max(0, +((opts && opts.min) ?? 1) || 0);
  const STALE = 24 * 3600 * 1000; // prix non revu depuis plus d'un jour : à vérifier en jeu
  const qty = new Map();
  for (const { id, num } of tracker.slots.values()) if (id !== FE_ID) qty.set(id, (qty.get(id) || 0) + num);
  let hidden = 0;
  const rows = [];
  const keep = new Set(settings.keepItems || []);
  for (const [id, n] of qty) {
    if (n <= 0) continue;
    if (!tracker.visible(id)) { hidden++; continue; }
    const it = items.get(id);
    const p = prices.get(id);
    const bound = /^Bound /i.test(it.name);
    const unit = (p.price || 0) * (1 - tracker.taxRate());
    const value = unit * n;
    const verdict = keep.has(id) ? 'keep' : bound ? 'bound' : isVariablePrice(it) ? 'variable' : (!unit || p.source === 'inconnu' || p.source === 'nonconfirme') ? 'noprice' : value >= min ? 'sell' : 'low';
    rows.push({ id, name: it.name, img: it.img, qty: n, unit, value: verdict === 'variable' ? 0 : value, source: p.source, ts: p.ts || null, players: p.players || null,
      stale: !!(p.ts && Date.now() - p.ts > STALE), verdict, kept: keep.has(id) });
  }
  rows.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const sum = (v) => rows.filter((r) => r.verdict === v);
  const total = (l) => l.reduce((x, r) => x + r.value, 0);
  return {
    ready: tracker.snapshotReady, fe: tracker.bagQty(FE_ID), hidden, min, rows, taxRate: tracker.taxRate(),
    totals: { all: total(rows), sell: total(sum('sell')), low: total(sum('low')) },
    staleSell: rows.filter((r) => r.verdict === 'sell' && (r.stale || !r.ts)).length,
    counts: { all: rows.length, sell: sum('sell').length, low: sum('low').length, noprice: sum('noprice').length, variable: sum('variable').length, bound: sum('bound').length, keep: sum('keep').length },
  };
});

// « Prix à vérifier » : objets du sac et des drops de la session sans prix, ou avec un prix de plus de 3 jours.
// Les chercher à l'HdV en jeu remplit notre base de prix pour tout le monde.
ipcMain.handle('priceTodo', () => {
  const STALE = 3 * 24 * 3600 * 1000;
  const qty = new Map();
  for (const { id, num } of tracker.slots.values()) qty.set(id, (qty.get(id) || 0) + num);
  for (const m of [tracker.session.loot, tracker.session.cost]) for (const id in m) if (!qty.has(+id)) qty.set(+id, Math.abs(m[id]));
  const out = [];
  for (const [id, n] of qty) {
    if (id === FE_ID || !tracker.visible(id)) continue;
    const p = prices.get(id);
    if (p.source === 'manuel' || p.source === 'fe') continue;
    const missing = p.source === 'inconnu' || !p.price;
    const stale = !missing && p.ts && Date.now() - p.ts > STALE;
    if (!missing && !stale) continue;
    const it = items.get(id);
    if (/^Bound /i.test(it.name)) continue; // objets liés : impossibles à échanger, donc pas de prix
    out.push({ id, name: it.name, img: it.img, qty: n, price: p.price, ts: p.ts || null, missing, weight: missing ? 1e12 + n : n * p.price });
  }
  return out.sort((a, b) => b.weight - a.weight).slice(0, 15);
});

// Nom donné par le joueur à un objet non identifié (gardé sur ce PC).
ipcMain.handle('setItemName', (_e, id, name) => {
  meta.data.itemNames = meta.data.itemNames || {};
  name = typeof name === 'string' ? name.trim().slice(0, 80) : '';
  if (name) meta.data.itemNames[+id] = name; else delete meta.data.itemNames[+id];
  meta.save();
  items.custom = meta.data.itemNames;
  broadcast();
});
ipcMain.handle('setManualPrice', (_e, id, price) => { prices.setManual(id, price); broadcast(); });
ipcMain.handle('listReports', () => listReports());
ipcMain.handle('getHeroes', () => HEROES);
// Liens externes autorisés : uniquement les pages de classe tlidb.
const SUPPORT_URL = 'https://buymeacoffee.com/snoopiisz';
ipcMain.handle('openExternal', (_e, url) => {
  if (typeof url === 'string' && /^https:\/\/tlidb\.com\/en\/[\w-]+$/.test(url)) shell.openExternal(url);
});
// Page de soutien du projet (lien fixe, jamais fourni par la page).
ipcMain.handle('openSupport', () => shell.openExternal(SUPPORT_URL));
ipcMain.handle('searchItems', (_e, q) => (q ? items.search(q, 40) : []).map((id) => ({ id, ...items.get(id), price: prices.value(id) })));
ipcMain.handle('listBuilds', () => builds.list().map((b) => ({
  id: b.id, title: b.title, heroKey: b.heroKey, steps: b.steps.length, updatedAt: b.updatedAt,
  trees: ((b.talents && b.talents.trees) || []).filter(Boolean),
  points: Object.values((b.talents && b.talents.nodes) || {}).reduce((n, o) => n + Object.values(o).reduce((a, v) => a + v, 0), 0),
  shared: b.shared, source: b.source, active: b.id === settings.activeBuild,
})));
ipcMain.handle('getBuild', (_e, id) => {
  const b = builds.get(id);
  if (!b) return null;
  // Emplacements de compétences avec noms, icônes et « possédée » (cache de compétences du jeu).
  const owned = readOwnedSkills();
  const view = (sl) => ({ ...skillView(sl), owned: !!sl.id && (owned.has(sl.id) || tracker.bagQty(sl.id) > 0) });
  const lo = b.loadout || { active: [], passive: [] };
  const loadout = {
    active: lo.active.map((sl) => ({ ...view(sl), supports: sl.supports.map(view) })),
    passive: lo.passive.map((sl) => ({ ...view(sl), supports: sl.supports.map(view) })),
  };
  return { build: b, advice: adviceFor(b, { ...tracker.snapshot() }), loadout, gear: gearView(b.gear) };
});
ipcMain.handle('saveBuild', (_e, b) => { const saved = builds.save(b); broadcast(); return saved; });
ipcMain.handle('deleteBuild', (_e, id) => {
  builds.remove(id);
  if (settings.activeBuild === id) { settings.activeBuild = null; saveSettings(); }
  broadcast();
});
ipcMain.handle('setActiveBuild', (_e, id) => { settings.activeBuild = id || null; saveSettings(); broadcast(); });
// Étape où en est le joueur pour ce build (null : automatique).
ipcMain.handle('setBuildStage', (_e, id, stage) => {
  const b = builds.get(id);
  if (!b) return null;
  b.progress = b.progress || { owned: {} };
  b.progress.stage = Number.isInteger(stage) ? stage : null;
  builds.save(b);
  broadcast();
  return true;
});
ipcMain.handle('setOwned', (_e, id, itemId, owned) => {
  const b = builds.get(id);
  if (!b) return null;
  b.progress = b.progress || { owned: {} };
  if (owned) b.progress.owned[itemId] = true; else delete b.progress.owned[itemId];
  builds.save(b);
  broadcast();
  return true;
});
ipcMain.handle('shareBuild', async (_e, id) => {
  const b = builds.get(id);
  if (!b) throw new Error('build not found');
  const pub = publicBuild(b);
  for (const s of pub.steps) for (const it of s.items) { const info = items.get(it.id); it.name = info.name; it.img = info.img; }
  pub.loadout = {
    active: pub.loadout.active.map((sl) => ({ ...skillView(sl), supports: sl.supports.map(skillView) })),
    passive: pub.loadout.passive.map((sl) => ({ ...skillView(sl), supports: sl.supports.map(skillView) })),
  };
  pub.gear = gearView(pub.gear);
  const res = await community.shareBuild(pub);
  b.shared = { url: community.siteUrl(res.url), at: Date.now() };
  builds.save(b);
  return b.shared;
});
ipcMain.handle('unshareBuild', async (_e, id) => {
  await community.unshareBuild(id);
  const b = builds.get(id);
  if (b) { b.shared = null; builds.save(b); }
});
// Stratégies de farm (onglets Meilleur FE/h et Routes partagées) : lecture seule, chemins autorisés uniquement.
const SITE_GET = /^\/api\/(stats|strategies\/best|reports|reports\/[0-9a-f-]{36})(\?[\w=&%.\-|+]*)?$/;
ipcMain.handle('siteGet', (_e, p) => {
  if (typeof p !== 'string' || !SITE_GET.test(p)) throw new Error('invalid path');
  return community._req('GET', p, null, 'optional');
});
ipcMain.handle('browseBuilds', (_e, f) => community.listBuilds(f && typeof f === 'object' ? f : { hero: f }));
ipcMain.handle('likeBuild', (_e, id) => community.likeBuild(id));
// Aperçu d'un build publié, sans l'importer.
ipcMain.handle('remoteBuild', (_e, id) => community.getBuild(id));
// Héros (traits), arbres de talents et compétences de la saison (tlidb.com, via scripts/buildsdata.js).
let buildDataCache = null;
const buildData = () => (buildDataCache = buildDataCache || loadJson(path.join(__dirname, '..', 'data', 'builddata.json'), { heroes: [], trees: [], skills: [] }));
// Nom et icône d'une compétence de build : la compétence tlidb si elle est connue, sinon l'objet de la base.
function skillView(sl) {
  const s = sl.skill && buildData().skills.find((x) => x.slug === sl.skill);
  const it = sl.id ? items.get(sl.id) : null;
  return { id: sl.id || null, skill: sl.skill || null, name: (s && s.name) || (it && it.name) || '?', img: (s && s.icon) || (it && it.img) || null };
}
// Équipement d'un build : les objets portent déjà nom, icône et stats ; un ancien emplacement (id seul) reprend ceux de la base.
function gearView(g) {
  const out = {};
  for (const [k, it] of Object.entries(g || {})) {
    if (!it.name && it.id) { const info = items.get(it.id); out[k] = { ...it, name: info.name, img: it.img || info.img }; } else out[k] = it;
    if (out[k].id) out[k].price = prices.value(out[k].id) || null;
  }
  return out;
}
// Équipement de la saison (tlidb.com, via scripts/geardata.js) : chargé à la demande (environ 1 Mo).
let gearDataCache = null;
ipcMain.handle('gearData', () => (gearDataCache = gearDataCache || loadJson(path.join(__dirname, '..', 'data', 'geardata.json'), { slots: {}, types: {} })));
ipcMain.handle('itemPrice', (_e, id) => (Number.isInteger(id) ? prices.value(id) || null : null));
ipcMain.handle('buildData', () => buildData());
// Copie un build du site dans « mes builds » (nouvel id, progression vide).
ipcMain.handle('importBuild', async (_e, remoteId) => {
  const { build, author, userId } = await community.getBuild(remoteId);
  if (userId && userId === settings.server.userId) {
    return builds.save(cleanBuild({ ...build, progress: { owned: {} }, shared: { url: community.siteUrl(`/b/${remoteId}`), at: Date.now() } }));
  }
  const copy = cleanBuild({ ...build, id: undefined, createdAt: Date.now(), progress: { owned: {} },
    source: { url: community.siteUrl(`/b/${remoteId}`), author } });
  return builds.save(copy);
});
// Connexion avec Google (bêta) : le navigateur s'ouvre sur tlicompanion.com, l'app attend son jeton (10 min max).
// Un ancien pseudo de l'app est rattaché au compte Google, avec tout ce qu'il a partagé.
let googleLogin = null;
ipcMain.handle('googleLogin', async () => {
  if (googleLogin) return googleLogin;
  googleLogin = (async () => {
    const { code, url } = await community.appLoginStart();
    shell.openExternal(community.siteUrl(url));
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      let r;
      try { r = await community.appLoginPoll(code); } catch (e) { if (/expired|410/.test(e.message)) throw new Error('expired'); continue; }
      if (r.pending) continue;
      Object.assign(settings.server, { token: r.token, userId: r.userId, name: r.name, google: true, named: r.named });
      saveSettings(); broadcast();
      return { name: r.name, named: r.named };
    }
    throw new Error('expired');
  })().finally(() => { googleLogin = null; });
  return googleLogin;
});
ipcMain.handle('accountLogout', async () => {
  if (settings.server.google) await community.logout().catch(() => {});
  Object.assign(settings.server, { token: null, userId: null, name: null, google: false, named: true });
  saveSettings(); broadcast();
});
// Votes et commentaires (bêta).
const isKind = (k) => k === 'build' || k === 'report';
const isId = (v) => typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v);
ipcMain.handle('vote', (_e, kind, id, value) => { if (!isKind(kind) || !isId(id)) throw new Error('invalid'); return community.vote(kind, id, value === 1 || value === -1 ? value : 0); });
ipcMain.handle('comments', (_e, kind, id) => { if (!isKind(kind) || !isId(id)) throw new Error('invalid'); return community.comments(kind, id); });
ipcMain.handle('commentPost', (_e, kind, id, body, parentId) => { if (!isKind(kind) || !isId(id)) throw new Error('invalid'); return community.commentPost(kind, id, String(body || '').slice(0, 1000), isId(parentId) ? parentId : null); });
ipcMain.handle('commentEdit', (_e, cid, body) => { if (!isId(cid)) throw new Error('invalid'); return community.commentEdit(cid, String(body || '').slice(0, 1000)); });
ipcMain.handle('commentDelete', (_e, cid) => { if (!isId(cid)) throw new Error('invalid'); return community.commentDelete(cid); });
ipcMain.handle('myOnlineBuilds', async () => (FEATURES.accounts && community.registered ? (await community.myContent()).builds : []));
ipcMain.handle('register', async (_e, name) => { const r = await community.register(name); broadcast(); return r; });
ipcMain.handle('shareReport', async (_e, id) => {
  const r = loadJson(reportPath(id), null);
  if (!r) throw new Error('session not found');
  if (r.hero) r.hero.name = tracker.heroName(r.hero.id); // nom donné à la classe depuis
  const { prices: _p, shared: _s, ...payload } = r;
  const res = await community.share({ ...payload, prices: _p });
  r.shared = { url: community.siteUrl(res.url), at: Date.now() };
  saveReport(r);
  return r.shared;
});
ipcMain.handle('unshareReport', async (_e, id) => {
  await community.unshare(id);
  const r = loadJson(reportPath(id), null);
  if (r) { delete r.shared; saveReport(r); }
});
ipcMain.handle('openSite', (_e, sitePath) => {
  // Uniquement des pages de notre serveur.
  const p = typeof sitePath === 'string' && /^\/[\w/?=&.-]*$/.test(sitePath) ? sitePath : '/';
  shell.openExternal(community.siteUrl(p));
});
// Nouveautés : notes des versions installées depuis la dernière ouverture (rien à la première installation).
ipcMain.handle('whatsNew', () => {
  const cur = app.getVersion();
  if (settings.lastSeenVersion === cur) return null;
  const log = loadJson(path.join(__dirname, '..', 'data', 'changelog.json'), { releases: [] });
  // Joueur déjà installé mais venant d'une version sans cette fenêtre : on montre au moins les notes de cette version.
  const from = settings.lastSeenVersion || null;
  // Sans version vue (mise à jour depuis 0.9.9 ou avant) : les deux dernières versions, pour ne rien rater.
  const upToCur = log.releases.filter((r) => verNum(r.version) <= verNum(cur));
  const releases = from ? upToCur.filter((r) => verNum(r.version) > verNum(from)) : upToCur.slice(0, 2);
  if (!releases.length) { settings.lastSeenVersion = cur; saveSettings(); return null; }
  return { version: cur, releases };
});
ipcMain.handle('getReport', (_e, id) => loadJson(reportPath(id), null));
// Void Charts déjà corrigés dans les sessions du joueur (le plus récent d'abord), pour préremplir une nouvelle route.
ipcMain.handle('voidChartHistory', () => {
  let files = [];
  try { files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json')); } catch { return []; }
  return files.map((f) => loadJson(path.join(SESSIONS_DIR, f), null))
    .filter((r) => r && r.voidChart && Object.keys(r.voidChart).length)
    .map((r) => ({ id: r.id, title: r.title || '', map: (r.strategy.maps[0] || {}).name || '', startedAt: r.startedAt,
      at: r.voidChartAt || r.voidChartChecked || r.endedAt || r.startedAt, voidChart: r.voidChart }))
    .sort((a, b) => b.at - a.at).slice(0, 40);
});
// Avis du joueur : on ne transmet que ces champs texte, bornés (la version part dans l'en-tête habituel).
ipcMain.handle('sendFeedback', async (_e, f) => {
  if (!f || typeof f !== 'object') return { ok: false, error: 'invalid' };
  const body = {
    type: ['bug', 'idea', 'question', 'other'].includes(f.type) ? f.type : 'other',
    message: String(f.message || '').slice(0, 2000),
    contact: String(f.contact || '').slice(0, 100),
    source: 'app', lang: settings.lang === 'fr' ? 'fr' : 'en',
  };
  try { await community.sendFeedback(body); return { ok: true }; }
  catch (e) { return { ok: false, error: String(e.message || e).slice(0, 200) }; }
});
// « Ton FE/h face à la communauté » sur la carte principale de la session (même région de balise et Timemark).
ipcMain.handle('compareStats', async (_e, id) => {
  const r = loadJson(reportPath(id), null);
  if (!r || !r.strategy.maps[0]) return null;
  const m = /^(.*?)\s*Beacon\s*\(Timemark\s*(\d+)\)/i.exec(r.strategy.maps[0].name || '');
  const region = m ? m[1].trim() : r.strategy.maps[0].name;
  try {
    const c = await community.compareStats({ region, tier: m ? m[2] : '' });
    return { ...c, region, tier: m ? +m[2] : null, mine: r.totals.perHourReal };
  } catch { return null; }
});
// Arbre du Void Chart de la saison (forme : tlidb.com), pour l'éditeur de la fiche de session.
let voidChartCache = null;
ipcMain.handle('voidChartData', () => (voidChartCache = voidChartCache || loadJson(path.join(__dirname, '..', 'data', 'voidchart.json'), { constellations: [] })));
// Nœuds du Void Chart cochés par le joueur : { constellation: [ids] }, bornés.
function cleanVoidChart(v) {
  const out = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [slug, ids] of Object.entries(v).slice(0, 40)) {
    if (!/^[A-Za-z_]{3,60}$/.test(slug) || !Array.isArray(ids)) continue;
    const list = [...new Set(ids.map((x) => Math.trunc(+x)).filter((x) => x > 0 && x < 1e7))].slice(0, 250);
    if (list.length) out[slug] = list;
  }
  return out;
}
ipcMain.handle('updateReport', (_e, id, patch) => {
  const r = loadJson(reportPath(id), null);
  if (!r) return null;
  if (typeof patch.title === 'string') r.title = patch.title.slice(0, 120);
  if (typeof patch.notes === 'string') r.notes = patch.notes.slice(0, 4000);
  // Code du jeu (facultatif) que les autres joueurs pourront copier : texte sur une ligne.
  if (typeof patch.gameCode === 'string') r.gameCode = ((v) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 4000))(patch.gameCode);
  if (patch.voidChart !== undefined) { r.voidChart = cleanVoidChart(patch.voidChart); r.voidChartAt = Date.now(); }
  if (patch.voidChartChecked === true) r.voidChartChecked = Date.now();
  if (typeof patch.strategyTag === 'string' && STRATEGY_TAGS.includes(patch.strategyTag)) r.strategyTag = patch.strategyTag;
  if (typeof patch.strategyTag === 'string' && r.statsSent) { r.statsSent = false; setImmediate(() => sendFarmStats(r)); }
  saveReport(r);
  return r;
});
ipcMain.handle('deleteReport', (_e, id) => { try { fs.unlinkSync(reportPath(id)); } catch { /* déjà supprimé */ } });
// Associe le numéro de héros du jeu à une classe/trait de la liste (ou à un nom libre).
ipcMain.handle('setHeroName', (_e, heroId, value) => {
  meta.data.heroKeys = meta.data.heroKeys || {};
  const h = HEROES.find((x) => x.key === value);
  const name = h ? `${h.hero} — ${h.trait}` : String(value || '').trim().slice(0, 60);
  if (name) meta.data.heroNames[heroId] = name; else delete meta.data.heroNames[heroId];
  if (h) meta.data.heroKeys[heroId] = h.key; else delete meta.data.heroKeys[heroId];
  meta.save(0);
  if (h) community.voteHero(heroId, h.key).catch(() => {}); // aide les autres joueurs à reconnaître ce numéro
  broadcast();
});

// ---------------- Méta (cache Hero Ranking du jeu) ----------------

let serverHeroMap = {};
async function syncHeroMap() {
  try { serverHeroMap = (await community.heroMap()).map || {}; } catch { /* hors ligne */ }
}
// Classe connue pour un numéro de héros : d'abord ce que j'ai choisi, sinon le vote de la communauté.
function heroKeyFor(heroId) {
  const local = (meta.data.heroKeys || {})[heroId];
  if (local) return { key: local, source: 'me' };
  const known = HEROES.find((h) => h.gameId === +heroId); // ids connus (déduits du Hero Ranking)
  if (known) return { key: known.key, source: 'known' };
  const s = serverHeroMap[heroId];
  return s ? { key: s.key, source: 'community', votes: s.total } : { key: null, source: null };
}
// ---- Sources de méta : 'l:<fichier local>' ou 'r:<serveur>|<saison>|<mode>' (serveur = 'global' pour tous) ----

// Serveur de jeu de chaque compte (un compte = une région), appris depuis UserData.
function rememberServer() {
  const cs = Meta.currentServer(status.logPath);
  if (!cs) return;
  const f = Meta.listRankingFiles(status.logPath).find((x) => x.charId === cs.charId);
  let account = f ? f.account : null;
  if (!account) {
    // Pas encore de classement pour ce perso : on cherche son dossier de compte.
    try {
      const root = path.join(status.logPath, '..', '..', '..', '..', 'Local', 'AccountCache');
      account = fs.readdirSync(root).find((a) => fs.existsSync(path.join(root, a, cs.charId))) || null;
    } catch { /* ignoré */ }
  }
  meta.data.accountServers = meta.data.accountServers || {};
  if (account && meta.data.accountServers[account] !== cs.server) { meta.data.accountServers[account] = cs.server; meta.save(0); }
}
const serverOf = (f) => (meta.data.accountServers || {})[f.account] || null;
const localFiles = () => Meta.listRankingFiles(status.logPath).map((f) => ({ ...f, server: serverOf(f) }));

const remoteCache = new Map(); // clé -> { at, snap }
async function remoteSnapshot(server, season, mode) {
  const k = `${server}|${season}|${mode}`;
  const hit = remoteCache.get(k);
  if (hit && Date.now() - hit.at < 5 * 60000) return hit.snap;
  const snap = await community.metaSnapshot(server, season, mode);
  remoteCache.set(k, { at: Date.now(), snap });
  return snap;
}
// Renvoie { info, overview(), detail(heroId, topN) } pour une source.
async function metaSource(key) {
  if (typeof key === 'string' && key.startsWith('r:')) {
    const [server, season, mode] = key.slice(2).split('|');
    const snap = await remoteSnapshot(server, +season, +mode);
    return {
      info: { key, remote: true, server, season: +season, mode: +mode, mtime: snap.capturedAt, uploads: snap.sources || 1 },
      overview: () => Meta.overviewFromSnapshot(snap),
      detail: (heroId) => Meta.detailFromSnapshot(snap, heroId),
      players: (heroId, opts) => community.metaPlayers(server, +season, +mode, heroId, opts),
    };
  }
  const files = localFiles();
  const f = files.find((x) => 'l:' + x.key === key) || files.slice().sort((a, b) => b.size - a.size)[0];
  if (!f) return null;
  return {
    info: { key: 'l:' + f.key, remote: false, server: f.server, season: f.season, mode: f.mode, mtime: f.mtime },
    overview: () => Meta.overview(f),
    detail: (heroId, topN) => Meta.classDetail(f, heroId, topN),
    players: async (heroId, opts) => Meta.classPlayers(f, heroId, opts),
  };
}
const named = (id) => { const it = items.get(id); return { id, name: it.name, img: it.img }; };

ipcMain.handle('metaFiles', async () => {
  rememberServer();
  const local = localFiles().map((f) => ({ key: 'l:' + f.key, remote: false, server: f.server, mode: f.mode, season: f.season, mtime: f.mtime, size: f.size }));
  let remote = [];
  try { remote = (await community.metaIndex()).snapshots.map((r) => ({ key: `r:${r.server}|${r.season}|${r.mode}`, remote: true, ...r, mtime: r.capturedAt })); }
  catch { /* hors ligne : seulement les données locales */ }
  return { local, remote };
});
ipcMain.handle('metaOverview', async (_e, key) => {
  const src = await metaSource(key);
  if (!src) return null;
  const o = src.overview();
  return { file: src.info, myHeroId: tracker.heroId, ...o, classes: Meta.withTiers(o.classes).map((c) => ({ ...c, ...heroKeyFor(c.heroId) })) };
});
ipcMain.handle('metaClass', async (_e, key, heroId, topN) => {
  const src = await metaSource(key);
  const d = src && src.detail(heroId, topN);
  if (!d) return null;
  const skills = readOwnedSkills();
  const enrich = (r) => ({ ...r, ...named(r.id), price: prices.value(r.id), owned: tracker.bagQty(r.id) > 0 || skills.has(r.id) });
  const gn = (cat) => (r) => ({ ...r, ...gameNamed(cat, r.id) });
  return { ...d, ...heroKeyFor(heroId), file: src.info,
    uniques: d.uniques.map(enrich), skills: d.skills.map(enrich), supports: d.supports.map(enrich),
    boards: d.boards.map(gn('boards')), talents: d.talents.map(gn('talents')), servants: (d.servants || []).map(gn('servants')) };
});

// Joueurs d'une classe, avec noms et icônes des compétences / légendaires.
ipcMain.handle('metaPlayers', async (_e, key, heroId, opts) => {
  const src = await metaSource(key);
  if (!src) return null;
  const r = await src.players(heroId, opts || {});
  const nm = (id) => { const it = items.get(id); return { id, name: it.name, img: it.img }; };
  return {
    total: r.total, sort: r.sort || (opts && opts.sort) || 'rank',
    players: r.players.map((p) => ({
      ...p,
      uniques: p.uniques.map(nm),
      active: p.active.map(([m, sup]) => ({ ...nm(m), supports: sup.map(nm) })),
      passive: p.passive.map(([m, sup]) => ({ ...nm(m), supports: sup.map(nm) })),
      boards: (p.boards || []).map((id) => gameNamed('boards', id)),
      talents: (p.talents || []).map((id) => gameNamed('talents', id)),
      servants: (p.servants || []).map((id) => gameNamed('servants', id)),
    })),
  };
});
// Copie le build d'un joueur du classement dans « mes builds ».
ipcMain.handle('metaPlayerBuild', (_e, player, heroId) => {
  const t = tr();
  const k = heroKeyFor(heroId).key;
  const skillItems = (list) => list.flatMap((sk) => [{ id: sk.id, qty: 1, priority: 'core', note: '' },
    ...sk.supports.map((x) => ({ id: x.id, qty: 1, priority: 'core', note: t('m.supportOf', { name: sk.name }) }))]);
  const steps = [
    { title: t('m.stepSkills'), notes: '', items: skillItems([...player.active, ...player.passive]) },
    { title: t('m.stepLegendaries'), notes: '', items: player.uniques.map((u) => ({ id: u.id, qty: 1, priority: 'core', note: '' })) },
  ].filter((st) => st.items.length);
  if (!steps.length) throw new Error('this player has no visible build');
  const slot = (sk) => ({ id: sk.id, supports: sk.supports.map((x) => x.id) });
  return builds.save({
    loadout: { active: player.active.map(slot), passive: player.passive.map(slot) },
    title: t('m.playerBuildTitle', { name: player.name || t('m.hiddenPlayer'), pos: player.pos }),
    heroKey: k || '',
    description: t('m.playerBuildDesc', { name: player.name || t('m.hiddenPlayer'), level: player.level, dps: Math.round(player.dps).toLocaleString('en-US') }),
    steps,
  });
});

// ---------------- Mises à jour automatiques ----------------
// L'installateur publié sur tlicompanion.com/download contient latest.yml : l'app vérifie au démarrage
// puis toutes les 4 h, télécharge en arrière-plan et propose de redémarrer pour installer.
let updateState = { state: 'idle' }; // idle | checking | downloading | ready | error
// Mise à jour obligatoire : le serveur annonce une version minimale (ou refuse cette version, HTTP 426).
let updateRequired = null;
const verNum = (v) => String(v || '0').split('.').map((x) => parseInt(x, 10) || 0).reduce((a, x) => a * 1000 + x, 0);
// Vérification manuelle (bouton des réglages) ou demandée par le serveur (réponse 426).
let lastForcedCheck = 0;
function checkUpdatesNow() {
  if (Date.now() - lastForcedCheck < 60000) return;
  lastForcedCheck = Date.now();
  checkMinVersion();
  if (app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR && updateState.state !== 'downloading' && updateState.state !== 'ready') {
    updateState = { state: 'checking' }; broadcast();
    autoUpdater.checkForUpdates().catch(() => { updateState = { state: 'idle' }; broadcast(); });
  }
}
community.onOutdated = checkUpdatesNow;

async function checkMinVersion() {
  try {
    const v = await community.version();
    updateRequired = v.minVersion && verNum(app.getVersion()) < verNum(v.minVersion) ? { min: v.minVersion, latest: v.version } : null;
    broadcast();
    // Version trop ancienne : on vérifie la mise à jour tout de suite plutôt qu'au prochain passage.
    if (updateRequired && updateState.state === 'ready') startSafeInstall();
    if (updateRequired && (updateState.state === 'idle' || updateState.state === 'uptodate') && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR) autoUpdater.checkForUpdates().catch(() => {});
  } catch { /* hors ligne */ }
}
// ---------------- Installation automatique des mises à jour ----------------
// Une mise à jour téléchargée s'installe toute seule quand c'est sans gêne : pas de session de farm,
// pas dans une carte, et aucune activité dans le log depuis 2 min (ou tout de suite si elle est obligatoire).
// L'app redémarre en arrière-plan et revient dans le même état (fenêtres ouvertes ou non).
let safeInstallTimer = null;
function installUpdateNow() {
  settings.restoreAfterUpdate = {
    dashboard: !!(dashboard && !dashboard.isDestroyed() && dashboard.isVisible()),
    overlay: !!(overlay && !overlay.isDestroyed() && overlay.isVisible()),
  };
  saveSettings();
  saveLiveSession(); // la session de farm en cours reprend après la mise à jour
  autoUpdater.quitAndInstall(true, true);
}
function safeToInstall() {
  if (tracker.session.recording || tracker.session.currentRun) return false;
  if (updateRequired) return true;
  return Date.now() - (tracker.session.lastActivity || 0) > 2 * 60000;
}
function startSafeInstall() {
  clearInterval(safeInstallTimer);
  safeInstallTimer = setInterval(() => {
    if (updateState.state === 'ready' && safeToInstall()) { clearInterval(safeInstallTimer); installUpdateNow(); }
  }, 30000);
}

function setupUpdates() {
  // Version minimale : vérifiée aussi pour la version portable.
  checkMinVersion();
  setInterval(checkMinVersion, 15 * 60 * 1000);
  // Pas de mise à jour automatique pour la version portable ni en développement.
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableWebInstaller = true;
  // Même canal pour tous : une bêta locale (x.y.z-beta.n) passera à la prochaine version publique x.y.z.
  autoUpdater.channel = 'latest';
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  // Tests : TLI_UPDATE_URL pointe vers un serveur local au lieu de tlicompanion.com.
  if (process.env.TLI_UPDATE_URL) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.TLI_UPDATE_URL });
  autoUpdater.logger = { info: (m) => console.log('[maj]', m), warn: (m) => console.log('[maj]', m), error: (m) => console.log('[maj] erreur', m), debug: () => {} };
  autoUpdater.on('checking-for-update', () => { updateState = { state: 'checking' }; });
  autoUpdater.on('update-available', (i) => { updateState = { state: 'downloading', version: i.version, percent: 0 }; broadcast(); });
  autoUpdater.on('update-not-available', () => { updateState = { state: 'uptodate', at: Date.now() }; broadcast(); });
  autoUpdater.on('download-progress', (p) => { updateState = { ...updateState, state: 'downloading', percent: Math.round(p.percent) }; broadcastThrottled(); });
  autoUpdater.on('update-downloaded', (i) => {
    updateState = { state: 'ready', version: i.version }; broadcast();
    // Installée toute seule au bon moment (voir installWhenSafe), plus vite si elle est obligatoire.
    startSafeInstall();
  });
  autoUpdater.on('error', (e) => { updateState = { state: 'error', message: String(e && e.message || e).slice(0, 200) }; console.error('Mise à jour :', updateState.message); });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 15 * 60 * 1000); // toutes les 15 min : les mises à jour arrivent vite
}

// ---------------- Conseiller (IA, bientôt) ----------------
// Assemble le contexte qui sera envoyé à l'IA : classe, économie, méta de la classe, top joueurs.
async function advisorContextData() {
  const snap = tracker.snapshot();
  let meta = null, topPlayers = [];
  try {
    const { local } = { local: localFiles() };
    const myServer = (local.find((f) => f.server) || {}).server;
    let key = null;
    try {
      const idx = (await community.metaIndex()).snapshots;
      const r = idx.find((x) => x.server === myServer) || idx.find((x) => x.server === 'global');
      if (r) key = `r:${r.server}|${r.season}|${r.mode}`;
    } catch { /* hors ligne */ }
    if (!key && local.length) key = 'l:' + local.slice().sort((a, b) => b.size - a.size)[0].key;
    if (key && tracker.heroId) {
      const src = await metaSource(key);
      const ov = Meta.withTiers(src.overview().classes);
      const mine = ov.find((c) => c.heroId === tracker.heroId);
      const d = src.detail(tracker.heroId, 100);
      const nm = (r) => ({ ...r, name: items.get(r.id).name, price: prices.value(r.id) });
      if (mine && d) meta = { tier: mine.tier, rank: ov.slice().sort((a, b) => b.score - a.score).indexOf(mine) + 1, players: mine.players,
        uniques: d.uniques.map(nm), skills: d.skills.map(nm), supports: d.supports.map(nm) };
      const pl = await src.players(tracker.heroId, { sort: 'dps', limit: 10 });
      const named = (id) => ({ id, name: items.get(id).name });
      topPlayers = pl.players.map((p) => ({ ...p, uniques: p.uniques.map(named),
        active: p.active.map(([m, s]) => ({ name: items.get(m).name, supports: s.map(named) })),
        passive: p.passive.map(([m, s]) => ({ name: items.get(m).name, supports: s.map(named) })),
        talents: (p.talents || []).map((id) => gameNamed('talents', id)), servants: (p.servants || []).map((id) => gameNamed('servants', id)) }));
    }
  } catch (e) { console.error('Contexte conseiller :', e.message); }
  return buildAdvisorContext({
    lang: settings.lang,
    hero: snap.hero ? { id: snap.hero.id, key: snap.hero.key, name: snap.hero.name } : null,
    skillsOwned: [...readOwnedSkills()].map((id) => items.get(id).name),
    feInBag: tracker.bagQty(FE_ID), bagValue: snap.netWorth, farmRate: farmRate(snap),
    sessions: listReports(), meta, topPlayers, priceOf: (id) => prices.value(id),
  });
}
ipcMain.handle('advisorContext', () => advisorContextData());

// Bêta privée de l'agent IA : débloquée en cliquant 7 fois sur le numéro de version.
// Clé API du joueur stockée à part (jamais dans settings.json ni envoyée à notre serveur).
const aiKey = AI.keyStore(path.join(userDir, 'ai-key.json'), safeStorage);
// Build bêta (version « x.y.z-beta.n ») : l'agent IA est activé d'office.
const IS_BETA_BUILD = /-beta/i.test(app.getVersion());
// Version publique : l'IA reste « bientôt disponible » (pas de déblocage caché).
const aiEnabled = () => IS_BETA_BUILD;
ipcMain.handle('aiStatus', async () => {
  const local = await AI.ollamaModels();
  let server = { enabled: false };
  try { server = await community.aiStatus(); } catch { /* hors ligne */ }
  return { beta: aiEnabled(), provider: settings.aiProvider || 'server', server, hasKey: aiKey.has(), model: settings.aiModel || AI.MODELS[0], models: AI.MODELS,
    ollama: { ...local, model: local.models.includes(settings.aiLocalModel) ? settings.aiLocalModel : (local.models.find((m) => m.startsWith('qwen2.5')) || local.models[0] || null), recommended: AI.OLLAMA_RECOMMENDED } };
});
ipcMain.handle('aiSetProvider', (_e, p) => { if (p === 'server' || p === 'ollama' || p === 'anthropic') { settings.aiProvider = p; saveSettings(); } });
ipcMain.handle('aiSetLocalModel', (_e, m) => { if (typeof m === 'string' && /^[\w.:/-]{1,80}$/.test(m)) { settings.aiLocalModel = m; saveSettings(); } });
ipcMain.handle('aiSetKey', (_e, key) => {
  key = typeof key === 'string' ? key.trim() : '';
  if (key && !/^sk-ant-[\w-]{20,}$/.test(key)) return { ok: false };
  aiKey.set(key);
  return { ok: true };
});
ipcMain.handle('aiSetModel', (_e, m) => { if (AI.MODELS.includes(m)) { settings.aiModel = m; saveSettings(); } });
ipcMain.handle('aiChat', async (_e, messages) => {
  if (!aiEnabled()) return { error: 'disabled' };
  const provider = settings.aiProvider || 'server';
  const local = provider === 'ollama';
  const key = provider === 'anthropic' ? aiKey.get() : null;
  if (provider === 'anthropic' && !key) return { error: 'nokey' };
  const clean = (Array.isArray(messages) ? messages : []).slice(-20)
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!clean.length || clean[clean.length - 1].role !== 'user') return { error: 'empty' };
  try {
    const context = await advisorContextData();
    const searchPrices = (q) => items.search(q, 10).map((id) => { const it = items.get(id); return { name: it.name, category: it.type || it.category || null, priceFE: prices.value(id) || null }; });
    if (provider === 'server') {
      try { return await community.aiChat({ lang: settings.lang, context, messages: clean }); }
      catch (e) { return { error: 'api', message: String(e.message || e).slice(0, 300) }; }
    }
    if (local) {
      const { up, models } = await AI.ollamaModels();
      if (!up) return { error: 'noollama' };
      const model = models.includes(settings.aiLocalModel) ? settings.aiLocalModel : (models.find((m) => m.startsWith('qwen2.5')) || models[0]);
      if (!model) return { error: 'nomodel' };
      return await AI.chatOllama({ model, lang: settings.lang, context, messages: clean, searchPrices });
    }
    return await AI.chat({ key, model: settings.aiModel, lang: settings.lang, context, messages: clean, searchPrices });
  } catch (e) { return { error: 'api', status: e.status || 0, message: String(e.message || e).slice(0, 300) }; }
});

// Envoi automatique : chaque classement nouveau ou mis à jour (avec serveur connu) est résumé et partagé.
let uploading = false;
async function uploadRankings() {
  if (uploading || !settings.shareMeta) return;
  uploading = true;
  try {
    rememberServer();
    meta.data.uploadedRankings = meta.data.uploadedRankings || {};
    for (const f of localFiles()) {
      if (!f.server || meta.data.uploadedRankings['v2:' + f.key] === f.mtime) continue;
      const snap = Meta.snapshot(f);
      const ids = new Set();
      for (const c of snap.classes) for (const k of ['uniques', 'skills', 'supports']) for (const [id] of c[k]) ids.add(id);
      const names = {};
      for (const id of ids) { const it = items.get(id); if (it.img || !it.name.startsWith('Item #')) names[id] = [it.name, it.img]; }
      await community.uploadMeta({ server: f.server, snapshot: snap, names });
      meta.data.uploadedRankings['v2:' + f.key] = f.mtime;
      meta.save();
      status.msgKey = 'msg.metaShared'; status.msgVars = { server: f.server };
    }
  } catch (e) { console.error('Envoi méta :', e.message); }
  uploading = false;
}

// Associe un numéro de classe à une classe de la liste (depuis l'onglet Méta).
ipcMain.handle('metaAssign', (_e, heroId, key) => {
  const h = HEROES.find((x) => x.key === key);
  meta.data.heroKeys = meta.data.heroKeys || {};
  if (h) { meta.data.heroKeys[heroId] = key; community.voteHero(heroId, key).catch(() => {}); }
  else delete meta.data.heroKeys[heroId];
  if (h && heroId === tracker.heroId) meta.data.heroNames[heroId] = `${h.hero} — ${h.trait}`;
  meta.save(0);
  broadcast();
});
// Crée un build à partir de ce que joue le top de la classe.
ipcMain.handle('metaBuild', async (_e, key, heroId, topN, threshold) => {
  const src = await metaSource(key);
  const d = src && src.detail(heroId, topN);
  if (!d) throw new Error('no ranking data');
  const f = src.info;
  const thr = Math.min(0.9, Math.max(0.05, +threshold || 0.3));
  const pick = (rows, max, minPct) => rows.filter((r) => r.pct >= minPct).slice(0, max);
  const t = tr();
  const item = (r, priority) => ({ id: r.id, qty: 1, priority, note: t('m.itemNote', { pct: Math.round(r.pct * 100), n: d.sample }) });
  const k = heroKeyFor(heroId).key;
  const h = HEROES.find((x) => x.key === k);
  const label = h ? h.trait : `#${heroId}`;
  const steps = [
    { title: t('m.stepSkills'), notes: '', items: [
      ...pick(d.skills, 3, thr).map((r) => item(r, 'core')),
      ...pick(d.supports, 12, thr).map((r) => item(r, 'core')),
    ] },
    { title: t('m.stepLegendaries'), notes: '', items: [
      ...pick(d.uniques, 10, thr).map((r) => item(r, 'core')),
      ...d.uniques.filter((r) => r.pct < thr && r.pct >= thr / 2).slice(0, 8).map((r) => item(r, 'optional')),
    ] },
  ].filter((s) => s.items.length);
  if (!steps.length) throw new Error('not enough data for this class');
  // Emplacements : les compétences principales les plus jouées, chacune avec les soutiens les plus fréquents.
  const mainSkills = pick(d.skills, 3, thr);
  const sups = pick(d.supports, 15, thr).map((r) => r.id);
  const loadout = { active: mainSkills.map((r, i) => ({ id: r.id, supports: i === 0 ? sups.slice(0, 5) : sups.slice(5 * i, 5 * i + 5) })), passive: [] };
  return builds.save({
    loadout,
    title: t('m.buildTitle', { name: label, n: d.sample }),
    heroKey: k || '',
    description: t('m.buildDesc', { n: d.sample, season: String(f.season).slice(0, 2), mode: f.mode,
      thr: Math.round(thr * 100), half: Math.round(thr * 50) }),
    steps,
  });
});
ipcMain.handle('action', async (_e, name, arg) => {
  switch (name) {
    case 'collapse': setCollapsed(arg ?? !settings.overlay.collapsed); break;
    case 'dashboard': openDashboard(typeof arg === 'string' ? arg : null); break;
    // Bouton du widget : ouvre la fenêtre principale, ou la cache si elle est déjà affichée.
    case 'dashboardToggle': toggleDashboard(); break;
    // Masquer le widget alors que la fenêtre principale est fermée : on la rouvre (sinon plus rien de visible).
    case 'hideOverlay': if (overlay) overlay.hide(); if (!dashboard) openDashboard('home'); break;
    case 'toggleOverlay': toggleOverlay(); break;

    case 'openOllama': shell.openExternal('https://ollama.com/download/windows'); break;
    case 'downloadUpdate': shell.openExternal(community.siteUrl('/download')); break;
    case 'checkUpdates': lastForcedCheck = 0; checkUpdatesNow(); break;
    case 'installUpdate': if (updateState.state === 'ready') setImmediate(installUpdateNow); break;
    case 'onboarded': settings.onboarded = true; saveSettings(); break;
    case 'seenVersion': settings.lastSeenVersion = app.getVersion(); saveSettings(); break;
    case 'shareFarmStats': settings.shareFarmStats = !!arg; saveSettings(); break;
    case 'farmStatsNotice': settings.farmStatsNotice = true; saveSettings(); break;
    case 'tipsSeen': settings.tipsSeen = Math.max(settings.tipsSeen || 0, +arg || 1); saveSettings(); break;
    case 'newSession': tracker.newSession(); break;
    case 'startFarm': beginFarm(); break;
    case 'stopFarm': { const id = stopFarm(arg || ''); broadcast(); return id; }
    // Widget : enregistrer la session et en relancer une tout de suite, ou l'effacer et repartir de zéro.
    case 'restartFarm': if (tracker.session.recording) { stopFarm('', false); beginFarm(); broadcast(); } break;
    case 'resetFarm': if (tracker.session.recording) { tracker.stopFarm(); saveLiveSession(); beginFarm(); broadcast(); } break;
    case 'mode': settings.mode = arg; saveSettings(); break;
    case 'timeMode': settings.timeMode = arg; saveSettings(); break;
    case 'shareMeta': settings.shareMeta = !!arg; saveSettings(); if (arg) uploadRankings(); break;
    case 'stockAlerts': settings.stockAlerts = !!arg; saveSettings(); break;
    case 'starAlerts': settings.starAlerts = !!arg; saveSettings(); break;
    case 'tartarusAlerts': settings.tartarusAlerts = !!arg; saveSettings(); break;
    case 'soundVolume': if (arg && SOUND_KEYS.includes(arg.key)) { settings.volumes[arg.key] = Math.min(100, Math.max(0, Math.round(+arg.v || 0))); saveSettings(); } break;
    case 'resetSound': if (SOUND_KEYS.includes(arg)) { settings.sounds[arg] = 'builtin'; saveSettings(); } break;
    case 'pickSound': {
      if (!SOUND_KEYS.includes(arg)) break;
      const r = await dialog.showOpenDialog(dashboard || overlay, { title: tr()('snd.pick'), properties: ['openFile'], filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'm4a'] }] });
      if (!r.canceled && r.filePaths[0]) { settings.sounds[arg] = 'file:' + r.filePaths[0]; saveSettings(); }
      break;
    }
    case 'testTartarus': { const kind = arg === 'full' ? 'full' : 'ready'; const n = kind === 'full' ? TARTARUS_MAX : TARTARUS_ENTRY;
      sendAlert({ kind: 'tartarus-' + kind, text: tr()('tart.' + kind, { n, max: TARTARUS_MAX }), level: kind === 'full' ? 1 : 5, qty: kind === 'full' ? 1 : 5 }); break; }
    case 'afterTax': settings.afterTax = !!arg; saveSettings(); broadcast(); break;
    case 'taxRate': settings.taxRate = Math.max(0, Math.min(50, +String(arg).replace(',', '.') || 0)); saveSettings(); broadcast(); break;
    case 'minLootValue': settings.minLootValue = Math.max(0, Math.min(1000, +String(arg).replace(',', '.') || 0)); saveSettings(); break;
    case 'testStockAlert': { const ids = Object.keys((meta.data.mapConsumables) || {}); const id = +(ids[0] || 0);
      const it = items.get(id); const a = { id, name: id ? it.name : 'Beacon', img: id ? it.img : null, qty: 5, level: 5 };
      const ovShown = overlay && !overlay.isDestroyed() && overlay.isVisible();
      if (ovShown) overlay.webContents.send('stockAlert', { ...a, sound: true });
      if (dashboard && !dashboard.isDestroyed()) dashboard.webContents.send('stockAlert', { ...a, sound: !ovShown }); break; }
    case 'opacity': settings.overlay.opacity = arg; saveSettings(); applyOpacity(); break;
    case 'lang':
      settings.lang = I18N.LANGS[arg] ? arg : 'en'; saveSettings(); buildTrayMenu();
      if (dashboard && !dashboard.isDestroyed()) dashboard.setTitle(tr()('dash.windowTitle'));
      break;
    case 'scale': settings.overlay.scale = Math.min(SCALE_MAX, Math.max(SCALE_MIN, +arg || 1)); saveSettings(); setCollapsed(settings.overlay.collapsed); break;
    case 'resizeStart': startResize(); break;
    case 'resizeEnd': endResize(); break;
    case 'solid': settings.overlay.solid = !!arg; saveSettings(); applyOpacity(); break;
    case 'keepItem': {
      const id = Math.trunc(+(arg && arg.id));
      if (!(id > 0)) break;
      const set = new Set(settings.keepItems || []);
      if (arg.keep) set.add(id); else set.delete(id);
      settings.keepItems = [...set].slice(0, 2000);
      saveSettings();
      break;
    }
    case 'unitPrice': case 'noFlash': case 'compact': settings.overlay[name] = !!arg; saveSettings(); broadcast(); break;
    case 'ultra': settings.overlay.ultra = !!arg; setCollapsed(settings.overlay.collapsed); break;
    case 'pause': tracker.togglePause(); broadcast(); break;
    case 'autoPause': settings.autoPause = !!arg; saveSettings(); break;
    // Contenu du widget : arg = { key, show }.
    case 'widgetShow': {
      const KEYS = ['barPerHour', 'now', 'session', 'perHour', 'maps', 'avg', 'avgTime', 'cost', 'total', 'tartarus', 'drops'];
      if (!arg || !KEYS.includes(arg.key)) break;
      const hide = new Set(settings.overlay.hide || []);
      if (arg.show) hide.delete(arg.key); else hide.add(arg.key);
      settings.overlay.hide = [...hide]; saveSettings(); broadcast();
      break;
    }
    case 'widgetShowAll': settings.overlay.hide = []; saveSettings(); broadcast(); break;
    // Liste de drops du widget : 'recent' (derniers) ou 'value' (plus rentables de la session).
    case 'dropsSort': settings.overlay.dropsSort = ['value', 'map'].includes(arg) ? arg : 'recent'; saveSettings(); broadcast(); break;
    case 'lock': setLocked(arg === undefined ? !settings.overlay.locked : arg); break;
    case 'community':
      settings.communityPrices = !!arg; saveSettings();
      if (arg) await refreshCommunity();
      break;
    case 'refreshCommunity': await refreshCommunity(); break;
    case 'hubPatterns':
      settings.hubPatterns = String(arg).split(',').map((s) => s.trim()).filter(Boolean); saveSettings();
      break;
    case 'openLogDir': {
      // Ouvre le dossier où le jeu écrit (ou écrira) son log, pour aider le joueur.
      const dir = status.logPath ? path.dirname(status.logPath) : status.gameDir ? expectedLogDir(status.gameDir) : null;
      if (dir) shell.openPath(fs.existsSync(dir) ? dir : status.gameDir);
      break;
    }
    case 'pickLog': {
      const r = await dialog.showOpenDialog(dashboard || overlay, {
        title: tr()('dlg.pickLog'),
        properties: ['openFile'], filters: [{ name: 'Log', extensions: ['log'] }],
      });
      if (!r.canceled && r.filePaths[0]) { settings.logPath = r.filePaths[0]; saveSettings(); await startWatching(); }
      break;
    }
  }
  broadcast();
});

// Captures d'écran de contrôle (développement) : TLI_SHOT=<dossier> npm start
async function debugScreenshots(dir) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  fs.mkdirSync(dir, { recursive: true });
  await wait(1500);
  // TLI_OVERLAY_EVAL : expression évaluée dans le widget avant sa capture (test d'un menu ouvert…).
  if (process.env.TLI_OVERLAY_EVAL) { console.log('OVERLAY_EVAL', JSON.stringify(await overlay.webContents.executeJavaScript(process.env.TLI_OVERLAY_EVAL))); await wait(400); }
  fs.writeFileSync(path.join(dir, 'overlay-expanded.png'), (await overlay.webContents.capturePage()).toPNG());
  setCollapsed(true); await wait(800);
  fs.writeFileSync(path.join(dir, 'overlay-collapsed.png'), (await overlay.webContents.capturePage()).toPNG());
  setCollapsed(false);
  openDashboard(); await wait(2500);
  fs.writeFileSync(path.join(dir, 'dashboard-live.png'), (await dashboard.webContents.capturePage()).toPNG());
  await dashboard.webContents.executeJavaScript("showTab('runs')"); await wait(1200);
  fs.writeFileSync(path.join(dir, 'dashboard-runs.png'), (await dashboard.webContents.capturePage()).toPNG());
  if (tracker.session.recording) {
    stopFarm('Test simulation'); await wait(2000);
    fs.writeFileSync(path.join(dir, 'session-detail.png'), (await dashboard.webContents.capturePage()).toPNG());
    await dashboard.webContents.executeJavaScript("window.scrollTo(0,0); document.querySelector('main').scrollTop = 700");
    await wait(500);
    fs.writeFileSync(path.join(dir, 'session-detail-2.png'), (await dashboard.webContents.capturePage()).toPNG());
    if (process.env.TLI_SHARE_TEST) {
      await dashboard.webContents.executeJavaScript(`document.querySelector('main').scrollTop = 0;
        const n = document.getElementById('shName'); if (n) n.value = 'Testeur'; document.getElementById('shGo').click();`);
      await wait(3000);
      fs.writeFileSync(path.join(dir, 'session-shared.png'), (await dashboard.webContents.capturePage()).toPNG());
    }
    await dashboard.webContents.executeJavaScript("document.getElementById('dBack').click()"); await wait(800);
    fs.writeFileSync(path.join(dir, 'session-list.png'), (await dashboard.webContents.capturePage()).toPNG());
  }
  if (process.env.TLI_BUILD_TEST) {
    const shot = async (name) => fs.writeFileSync(path.join(dir, name), (await dashboard.webContents.capturePage()).toPNG());
    const b = builds.save({
      title: 'Frostbitten Heart — Forking Thunder', heroKey: 'frostbitten_heart',
      description: 'Demo build: lightning projectiles, cheap start then T7 farming.',
      steps: [
        { title: 'Starter', notes: 'Get the core skills first.', items: [
          { id: 7350, qty: 1 }, { id: 7136, qty: 1 }, { id: 5210, qty: 300, note: 'for crafting' }] },
        { title: 'T7 farming', notes: '', items: [
          { id: 210000, qty: 60 }, { id: 7136, qty: 3 }, { id: 5230, qty: 200, priority: 'optional' }] },
      ],
    });
    settings.activeBuild = b.id;
    broadcast();
    await dashboard.webContents.executeJavaScript("showTab('build')"); await wait(1200);
    await shot('build-list.png');
    await dashboard.webContents.executeJavaScript(`document.querySelector('#buildView tr.click').click()`); await wait(1500);
    await shot('build-detail.png');
    fs.writeFileSync(path.join(dir, 'overlay-advice.png'), (await overlay.webContents.capturePage()).toPNG());
    await dashboard.webContents.executeJavaScript("document.getElementById('bShare').click()"); await wait(800);
    await dashboard.webContents.executeJavaScript(`const n = document.getElementById('bName'); if (n) { n.value = 'Testeur'; document.getElementById('bNameGo').click(); }`); await wait(2500);
    await shot('build-shared.png');
    await dashboard.webContents.executeJavaScript("document.getElementById('bEdit').click()"); await wait(1000);
    await dashboard.webContents.executeJavaScript(`const i = document.querySelector('[data-search]'); i.value = 'thunder'; i.dispatchEvent(new Event('input'));`); await wait(1200);
    await shot('build-edit.png');
  }
  if (process.env.TLI_UPD_TEST) {
    // Simulation : mise à jour prête, installation remplacée par un message.
    autoUpdater.quitAndInstall = () => console.log('UPD installation lancée, état sauvé =', JSON.stringify(settings.restoreAfterUpdate));
    updateState = { state: 'ready', version: '9.9.9' }; broadcast(); await wait(1000);
    fs.writeFileSync(path.join(dir, 'overlay-update.png'), (await overlay.webContents.capturePage()).toPNG());
    tracker.session.lastActivity = Date.now();
    console.log('UPD actif il y a 0 s -> sûr ?', safeToInstall());
    tracker.session.lastActivity = Date.now() - 3 * 60000;
    console.log('UPD inactif 3 min au repaire -> sûr ?', safeToInstall());
    tracker.session.recording = true;
    console.log('UPD pendant une session de farm -> sûr ?', safeToInstall());
    tracker.session.recording = false;
    if (safeToInstall()) installUpdateNow();
  }
  if (process.env.TLI_AUTO_TEST) {
    // 4 cartes simulées sans « Démarrer » (2 min chacune) : le lot doit partir vers le serveur.
    const t0 = Date.now() - 12 * 60000;
    for (let i = 0; i < 4; i++) autoStatsAdd({ name: 'Thunder Wastes Beacon (Timemark 7)', startedAt: t0 + i * 180000, endedAt: t0 + i * 180000 + 120000, loot: { 100300: 40 }, cost: { 5001: -1 }, heroId: 8003 });
    const r = await autoStatsFlush();
    console.log('AUTO', JSON.stringify(r));
  }
  if (process.env.TLI_LOCK_TEST) {
    setLocked(true); await wait(900);
    fs.writeFileSync(path.join(dir, 'overlay-locked.png'), (await overlay.webContents.capturePage()).toPNG());
    console.log('LOCK verrouillé, déplaçable =', overlay.isMovable(), '| menu =', tray ? 'ok' : 'absent');
    setLocked(false); await wait(300);
    console.log('LOCK déverrouillé, déplaçable =', overlay.isMovable());
  }
  if (process.env.TLI_WIDGET_TEST) {
    // Simule des glisser du coin : plus large et plus haut, puis plus petit (le contenu ne doit pas changer d'échelle).
    const real = screen.getCursorScreenPoint.bind(screen);
    const drag = async (tx, ty, name) => {
      const start = real(); let dx = 0, dy = 0;
      screen.getCursorScreenPoint = () => ({ x: start.x + dx, y: start.y + dy });
      startResize();
      for (let i = 1; i <= 10; i++) { dx = (tx * i) / 10; dy = (ty * i) / 10; await wait(40); }
      endResize(); screen.getCursorScreenPoint = real; await wait(600);
      console.log('WIDGET', name, widgetSize(), overlay.getSize(), 'scale', settings.overlay.scale);
      fs.writeFileSync(path.join(dir, `widget-${name}.png`), (await overlay.webContents.capturePage()).toPNG());
    };
    await drag(120, 260, 'bigger');
    await drag(-200, -560, 'smaller');
    setCollapsed(true); await wait(500);
    fs.writeFileSync(path.join(dir, 'widget-collapsed.png'), (await overlay.webContents.capturePage()).toPNG());
    console.log('WIDGET collapsed', widgetSize(), overlay.getSize());
    setCollapsed(false);
    delete settings.overlay.w; delete settings.overlay.h; delete settings.overlay.cw; applyScale(settings.overlay.scale); saveSettings();
  }
  if (process.env.TLI_STOCK_TEST) {
    // Simule 3 ouvertures de carte : 10, 5 puis 1 balise restante.
    const id = 210000;
    for (const q of [10, 5, 1]) {
      tracker.bagQty = () => q;
      checkStock(id); await wait(900);
      fs.writeFileSync(path.join(dir, `stock-${q}.png`), (await overlay.webContents.capturePage()).toPNG());
    }
    fs.writeFileSync(path.join(dir, 'stock-dash.png'), (await dashboard.webContents.capturePage()).toPNG());
  }
  if (process.env.TLI_NOLOG) {
    settings.onboarded = true; broadcast();
    await dashboard.webContents.executeJavaScript("showTab('home')"); await wait(1500);
    fs.writeFileSync(path.join(dir, 'home-nolog.png'), (await dashboard.webContents.capturePage()).toPNG());
  }
  // Captures de contrôle : un onglet précis (TLI_TAB) et une expression à évaluer (TLI_EVAL), avec ou sans log.
  if (process.env.TLI_TAB || process.env.TLI_EVAL) {
    settings.onboarded = true; broadcast();
    if (process.env.TLI_TAB) {
      await dashboard.webContents.executeJavaScript(`showTab('${process.env.TLI_TAB}')`); await wait(1200);
      fs.writeFileSync(path.join(dir, `tab-${process.env.TLI_TAB}.png`), (await dashboard.webContents.capturePage()).toPNG());
    }
    if (process.env.TLI_EVAL) console.log('EVAL', JSON.stringify(await dashboard.webContents.executeJavaScript(process.env.TLI_EVAL)));
    if (process.env.TLI_EVAL) fs.writeFileSync(path.join(dir, 'after-eval.png'), (await dashboard.webContents.capturePage()).toPNG());
  }
  if (process.env.TLI_FARM_TEST) {
    const shot = async (name) => fs.writeFileSync(path.join(dir, name), (await dashboard.webContents.capturePage()).toPNG());
    settings.onboarded = true; beginFarm(); broadcast(); await wait(1200);
    await shot('farm-consent.png');
    fs.writeFileSync(path.join(dir, 'farm-consent-overlay.png'), (await overlay.webContents.capturePage()).toPNG());
    tracker.stopFarm(); broadcast();
    const id = require('crypto').randomUUID();
    saveReport({ version: 1, id, appVersion: app.getVersion(), title: '', startedAt: Date.now() - 3600000, endedAt: Date.now(), hero: null,
      totals: { profit: 1234, loot: 1500, cost: -266, other: 0, realMs: 3600000, mapMs: 3000000, runs: 18, perHourReal: 1234, perHourMap: 1480, avgPerMap: 68, avgMapMs: 160000 },
      strategy: { maps: [{ name: 'Thunder Wastes Beacon (Timemark 7)', runs: 18, profit: 1234, durationMs: 3000000, areaIds: {} }], consumables: [], modifiers: [] },
      loot: [], runs: [], prices: {}, context: farmContext() });
    openDashboard(`endsession:${id}`); await wait(1800);
    await shot('farm-end.png');
    await dashboard.webContents.executeJavaScript(`modal(''); openSession('${id}')`); await wait(2000);
    await shot('farm-compare.png');
    fs.unlinkSync(reportPath(id));
  }
  if (process.env.TLI_AI_TEST) {
    const shot = async (name) => fs.writeFileSync(path.join(dir, name), (await dashboard.webContents.capturePage()).toPNG());
    settings.betaAi = true; aiKey.set('');
    settings.onboarded = true; broadcast();
    await dashboard.webContents.executeJavaScript("showTab('advisor')"); await wait(1200);
    await shot('ai-key.png');
    aiKey.set('sk-ant-api03-fausse-cle-de-test-0000000000');
    await dashboard.webContents.executeJavaScript('showAdvisor()'); await wait(1000);
    const demo = '## Priorité\n- **Sceptre X** : 1 200 FE, utilisé par 64 % du top 100\n- Puis le *pacte* Y\n\n1. Farm 2 h\n2. Achète';
    await dashboard.webContents.executeJavaScript(`AIChat.messages = [{ role: 'user', content: 'What should I upgrade first?' }, { role: 'assistant', content: ${JSON.stringify(demo)}, meta: '512 tokens in / 120 out' }]; renderAiLog();`);
    await wait(400); await shot('ai-chat.png');
    await dashboard.webContents.executeJavaScript("aiSend('test')"); await wait(5000);
    await shot('ai-error.png');
    aiKey.set(''); settings.betaAi = false;
  }
  if (process.env.TLI_META_TEST) {
    const shot = async (name) => fs.writeFileSync(path.join(dir, name), (await dashboard.webContents.capturePage()).toPNG());
    await dashboard.webContents.executeJavaScript("showTab('meta')"); await wait(1500);
    await shot('meta-overview.png');
    // Vote de test : le numéro de la première classe -> une classe de la liste.
    await dashboard.webContents.executeJavaScript(`(document.querySelector('#metaView tr[data-hero="1001"]') || document.querySelector('#metaView tr[data-hero]')).click()`); await wait(1500);
    await shot('meta-class.png');
    await dashboard.webContents.executeJavaScript("document.querySelector('[data-view=players]').click()"); await wait(2500);
    await shot('meta-players.png');
    await dashboard.webContents.executeJavaScript("document.querySelector('#mPlayers tr[data-pl]').click()"); await wait(800);
    await shot('meta-player-open.png');
    await dashboard.webContents.executeJavaScript("showTab('home')"); await wait(2500);
    await shot('home-carousel.png');
    await dashboard.webContents.executeJavaScript("const b = document.getElementById('cDetails'); if (b) b.click()"); await wait(800);
    await shot('home-profile.png');
    await dashboard.webContents.executeJavaScript("const c = document.getElementById('pmClose'); if (c) c.click(); showTab('advisor')"); await wait(600);
    await shot('advisor.png');
    await dashboard.webContents.executeJavaScript("showTab('build')"); await wait(600);
    await shot('build-soon.png');
  }
  app.quit();
}

// ---------------- Démarrage ----------------

// Même identifiant que les raccourcis de l'installateur : icône correcte dans la barre des tâches et les notifications.
if (process.platform === 'win32') app.setAppUserModelId('local.tli.profit');

// Répare les raccourcis Bureau / menu Démarrer des anciennes versions : leur description mal encodée
// débordait sur l'emplacement de l'icône (raccourci blanc).
function repairShortcuts() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  const exe = process.execPath;
  const links = [
    path.join(app.getPath('desktop'), 'TLI Companion.lnk'),
    path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'TLI Companion.lnk'),
  ];
  for (const lnk of links) {
    try {
      if (!fs.existsSync(lnk)) continue;
      const cur = shell.readShortcutLink(lnk);
      if (path.resolve(cur.target).toLowerCase() !== path.resolve(exe).toLowerCase()) continue;
      if (cur.icon && path.resolve(cur.icon).toLowerCase() === exe.toLowerCase() && (cur.description || '').length < 200) continue;
      shell.writeShortcutLink(lnk, 'update', { target: exe, cwd: path.dirname(exe), icon: exe, iconIndex: 0,
        description: 'TLI Companion', appUserModelId: 'local.tli.profit' });
    } catch (e) { console.error('Raccourci :', e.message); }
  }
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', openDashboard);
  app.whenReady().then(async () => {
    repairShortcuts();
    renameStoredZones();
    // Nouvelle installation : pas de fenêtre « Nouveautés » (le guide de démarrage s'affiche à la place).
    if (!settings.lastSeenVersion && !settings.onboarded) { settings.lastSeenVersion = app.getVersion(); saveSettings(); }
    // La grande fenêtre s'ouvre au démarrage ; le widget (overlay) seulement à la demande.
    if (process.env.TLI_SHOT) createOverlay(); // captures de test
    createTray();
    // Redémarrage après une mise à jour automatique : on revient dans le même état, sans ouvrir de fenêtre en plus.
    const restore = settings.restoreAfterUpdate;
    if (restore) {
      delete settings.restoreAfterUpdate; saveSettings();
      if (restore.overlay) createOverlay();
      if (restore.dashboard || !restore.overlay) openDashboard('home');
    } else openDashboard('home');
    setupUpdates();
    globalShortcut.register('CommandOrControl+Shift+F', () => { if (overlay) setCollapsed(!settings.overlay.collapsed); });
    globalShortcut.register('CommandOrControl+Shift+D', toggleDashboard);
    globalShortcut.register('CommandOrControl+Shift+P', () => { if (tracker.session.recording) { tracker.togglePause(); broadcast(); } });
    globalShortcut.register('CommandOrControl+Shift+H', toggleOverlay);
    globalShortcut.register('CommandOrControl+Shift+L', () => setLocked(!settings.overlay.locked));
    if (settings.communityPrices && Date.now() - prices.communityFetchedAt > 15 * 60000) refreshCommunity();
    setInterval(refreshCommunity, 15 * 60000);
    syncServerPrices();
    syncHeroMap();
    setInterval(syncHeroMap, 30 * 60000);
    setInterval(syncServerPrices, 5 * 60000);
    refreshFarmRate();
    await startWatching();
    uploadRankings();
    setInterval(uploadRankings, 60000);
    // Log pas encore trouvé (jeu pas lancé, « Enable Log » activé après coup…) : on réessaie toutes les 10 s.
    setInterval(() => { if (status.state === 'nolog') startWatching(); }, 10000);
    if (process.env.TLI_SHOT) debugScreenshots(process.env.TLI_SHOT);
  });
  app.on('window-all-closed', (e) => e.preventDefault()); // reste dans la barre des tâches
  app.on('will-quit', () => { globalShortcut.unregisterAll(); prices.save(); meta.flush(); });
}
