// En-tête et pied de page communs à toutes les pages du site, + textes des pages vitrine.
// Chargé AVANT common.js : il complète le dictionnaire STR défini dans common.js via SITE_STR.
window.SITE_STR = {
  en: {
    navHome: 'Home', navDownload: 'Download', navAccount: 'Account',
    supButton: 'Support', supTitle: 'Support TLI Companion', supCta: 'Buy me a coffee', supFooter: 'Like the tool? Support it on Buy Me a Coffee',
    supText: 'TLI Companion is free, without ads, and made by one player in their spare time. If it helps you farm, a coffee helps pay for the server and keeps new features coming (build planner, AI advisor…).',
    footerLine: 'TLI Companion is a fan-made tool, not affiliated with XD Inc. Torchlight: Infinite and its assets belong to XD Inc.',
    footerCredits: 'Item data and icons: tlidb.com · Shared prices: TITrack community · Class IDs cross-checked with tliherorank.com',
    // Accueil
    homeTitle: 'TLI Companion — your Torchlight: Infinite companion',
    heroTitle: 'Farm smarter in <em>Torchlight: Infinite</em>',
    heroLead: 'Live profit widget, every map, boss and oasis tracked, bag scan, voice alerts and the meta of every class — in one free app that simply reads the game log.',
    downloadWin: 'Download for Windows', seeMeta: 'See the meta', versionInfo: 'Version {v} · {size} · Windows 10/11 · free',
    versionSoon: 'Windows 10/11 · free',
    nSessions: 'farm sessions shared', nBuilds: 'builds shared', nMaps: 'maps analysed (anonymous farm stats)', nPrices: 'item prices checked by players', nPlayers: 'ranked players analysed', nClasses: 'classes in the meta',
    featuresTitle: 'Everything in one place', featuresSub: 'Small tools you used to juggle between sites and spreadsheets, finally together.',
    f1t: 'Live profit overlay', f1p: 'A small widget stays on top of the game: FE per hour, profit of the current map, every drop with its value. Collapse it to a thin bar.',
    f2t: 'Farm sessions', f2p: 'Start / stop a session and get a full strategy sheet: maps, Void Chart zones, Netherrealm talents, consumables, best drops, FE/h.',
    f3t: 'Builds & purchase advisor', f3p: 'Follow a build: the advisor knows your bag, your skills and the market, and tells you what to buy next and how long to farm for it.',
    f4t: 'Class meta & leaderboards', f4p: 'Tier list of the classes, what the best players of each class use, per server or worldwide, with the full profile of every top player.',
    f5t: 'Real market prices', f5p: 'Prices from your own auction house searches, shared anonymously between players, plus a community price base for everything else.',
    f6t: 'Safe by design', f6p: 'No injection, no memory reading: the app only reads files the game writes on your PC. Nothing that could get you banned.',
    howTitle: 'Up and running in 2 minutes', howSub: 'No account needed.',
    s1t: 'Install', s1p: 'Download the installer and launch it. Windows may show a SmartScreen warning: More info → Run anyway.',
    s2t: 'Enable the game log', s2p: 'In game: Settings → Other → Enable Log, then pick your character. The game forgets this option when it closes: turn it on again each time you launch TLI.',
    faqTitle: 'FAQ', faq1q: 'Do I have to enable the log every time?', faq1a: 'Yes. Torchlight: Infinite does not remember the "Enable Log" option: every time you launch the game, go to Settings → Other → Enable Log before picking your character. Every log-based tracker has the same limitation.',
    faq2q: 'The app says "Bag unknown"', faq2a: 'The game only writes your full bag to the log when your character loads, or when you sort the bag. Enable the log, then open your bag in game and click Sort once (or relog your character): it switches to "Bag synced" within a second. If the bag is still wrong or empty, go back to character selection and enter the game again.',
    faq3q: 'The right order when you start playing', faq3a: '1. Launch the game. 2. Settings → Other → Enable Log. 3. Pick your character and enter the game. 4. TLI Companion connects by itself (keep it open).',
    faq4q: 'Is it safe? Can I get banned?', faq4a: 'TLI Companion only reads the log file the game writes itself. No injection, no memory reading, nothing touches the game.',
    s3t: 'Play', s3p: 'Press ▶ to start a farm session: the widget tracks everything live. Open the Hero Ranking in game to feed the meta.',
    showcase1t: 'Know exactly what each map is worth', showcase1p: 'The in-game widget counts every item you pick up and values it at market price, minus the beacons and compasses you used.',
    showcase1l: ['FE per hour, per map and for the session', 'Every zone tracked: maps, bosses, oases, Tartarus', 'Resizable widget: you choose what it shows', 'Pause and auto-pause when you are AFK'],
    showcase3t: 'Scan your bag', showcase3p: 'Everything in your bag with its price: see at a glance what is worth selling and what is not.',
    showcase3l: ['Bag value and what is worth selling', 'Price source and age for every item', 'Voice alerts: Tartarus, Star Shards 80/80, last beacon'],
    buildsDev: 'Build planner: in development.',
    showcase2t: 'Copy what the best players do', showcase2p: 'The meta is built from the in-game Hero Ranking, browsed by app users on every server.',
    showcase2l: ['Tier list of all 28 classes, per server or worldwide', 'Skills with their supports, legendaries and core talents', 'The top 10 of your class right on the app home page'],
    faqTitle: 'Questions',
    q1: 'Is it allowed? Can I get banned?', a1: 'The app never touches the game: no injection, no memory reading, no automation. It reads the log file the game itself writes when you enable "Enable Log", plus a few cache files. It works like other popular community trackers.',
    q2: 'What data is shared?', a2: 'Only if you choose to: farm sessions you click "Share" on, builds you publish, prices you see at the auction house (anonymously), and the Hero Ranking you browse (public in game; profiles hidden in game are never shown). Your game account and passwords are never read or sent.',
    q3: 'Does it cost anything?', a3: 'No, it is free.',
    q4: 'Which platforms?', a4: 'Windows 10 and 11, Steam or standalone version of the game.',
    ctaTitle: 'Ready to farm smarter?', ctaText: 'Free, safe, and it takes two minutes to set up.',
    // Téléchargement
    dlTitle: 'Download TLI Companion', dlSub: 'The latest version for Windows.',
    dlButton: 'Download the installer', dlPortable: 'No release published yet — check back soon.',
    reqTitle: 'Requirements', req1t: 'Windows 10 / 11', req1p: '64-bit', req2t: 'Torchlight: Infinite', req2p: 'Steam or standalone, "Enable Log" turned on',
    req3t: 'About 300 MB', req3p: 'disk space once installed',
    pnTitle: 'Patch notes',
    fbLink: 'Give feedback', fbTitle: 'Give feedback', fbIntro: 'A bug, an idea, a question? Tell me here: every message is read.',
    fbType: 'Type', fbBug: 'Bug', fbIdea: 'Idea / improvement', fbQuestion: 'Question', fbOther: 'Other',
    fbMessage: 'Message', fbMessagePh: 'Describe the bug or your idea (at least 10 characters)…',
    fbContact: 'Contact (optional)', fbContactPh: 'Discord name or email, only if you want an answer',
    fbPrivacy: 'Only this text is sent, nothing else. No attachments.', fbSend: 'Send', fbCancel: 'Cancel',
    fbThanks: 'Thanks! Your message has been sent.', fbTooShort: 'Please write at least 10 characters.', fbError: 'Could not send: {msg}',
    openSource: 'Source code on GitHub',
    logHelpTitle: 'The app says "Game log not found"?',
    logHelp1: 'Launch Torchlight: Infinite and open Settings → Other → click "Enable Log".',
    logHelp2: 'Relog your character (or switch character): the game only creates the log file after that.',
    logHelp3: 'Keep TLI Companion open: it checks again every 10 seconds and connects by itself.',
    logHelp4: 'Still not found? On the Home screen click "Choose UE_game.log" and pick the file by hand.',
    logHelpPath: 'With Steam, the file is here (change the drive or folder if your game is installed elsewhere):',
    logHelpOther: 'Official launcher or Epic: open your game folder, then UE_game → TorchLight → Saved → Logs → UE_game.log.',
    smartTitle: 'Windows SmartScreen', smartText: 'The app is not signed with a paid certificate yet, so Windows may warn you on first launch. Click "More info" then "Run anyway". The installer is published only on tlicompanion.com.',
    sha: 'SHA-256 checksum',
    // Compte
    accTitle: 'Your account', accSub: 'Coming soon.',
    accText: 'Today, you share sessions and builds with a username created in the app — no email, no password. Soon an account will let you:',
    acc1: 'Sign in with Discord and find your sessions and builds on any PC',
    acc2: 'Follow other players and get notified of their new strategies',
    acc3: 'Like and comment on builds and farm sessions',
    acc4: 'Sync your settings and followed build between devices',
    accCta: 'In the meantime, everything works without an account.',
  },
  fr: {
    navHome: 'Accueil', navDownload: 'Télécharger', navAccount: 'Compte',
    supButton: 'Soutenir', supTitle: 'Soutenir TLI Companion', supCta: 'Offrir un café', supFooter: "L'outil te plaît ? Soutiens-le sur Buy Me a Coffee",
    supText: "TLI Companion est gratuit, sans pub, et fait par un joueur sur son temps libre. S'il t'aide à farmer, un café aide à payer le serveur et à sortir les prochaines fonctionnalités (planificateur de build, conseiller IA…).",
    footerLine: "TLI Companion est un outil de fan, non affilié à XD Inc. Torchlight: Infinite et ses ressources appartiennent à XD Inc.",
    footerCredits: 'Données et icônes des objets : tlidb.com · Prix partagés : communauté TITrack · Numéros de classes recoupés avec tliherorank.com',
    homeTitle: 'TLI Companion — ton compagnon Torchlight: Infinite',
    heroTitle: 'Farme plus malin sur <em>Torchlight: Infinite</em>',
    heroLead: "Profit en direct dans un widget, chaque carte, boss et oasis suivis, analyse du sac, alertes vocales et méta de chaque classe — dans une seule app gratuite qui lit simplement le log du jeu.",
    downloadWin: 'Télécharger pour Windows', seeMeta: 'Voir la méta', versionInfo: 'Version {v} · {size} · Windows 10/11 · gratuit',
    versionSoon: 'Windows 10/11 · gratuit',
    nSessions: 'sessions de farm partagées', nBuilds: 'builds partagés', nMaps: 'cartes analysées (stats de farm anonymes)', nPrices: 'prix d’objets vérifiés par les joueurs', nPlayers: 'joueurs classés analysés', nClasses: 'classes dans la méta',
    featuresTitle: 'Tout au même endroit', featuresSub: 'Les petits outils que tu jonglais entre sites et tableurs, enfin réunis.',
    f1t: 'Profit en direct', f1p: 'Un petit widget reste au-dessus du jeu : FE par heure, profit de la carte en cours, chaque drop avec sa valeur. Réductible en une fine barre.',
    f2t: 'Sessions de farm', f2p: 'Démarre / termine une session et obtiens la fiche complète de ta strat : cartes, zones du Void Chart, talents Netherrealm, consommables, meilleurs drops, FE/h.',
    f3t: "Builds & conseiller d'achat", f3p: 'Suis un build : le conseiller connaît ton sac, tes compétences et le marché, et te dit quoi acheter ensuite et combien de temps farmer pour ça.',
    f4t: 'Méta & classements', f4p: 'Tier list des classes, ce que jouent les meilleurs de chaque classe, par serveur ou au global, avec la fiche complète de chaque top joueur.',
    f5t: 'Vrais prix du marché', f5p: "Les prix de tes propres recherches à l'hôtel des ventes, partagés anonymement entre joueurs, plus une base de prix communautaire pour le reste.",
    f6t: 'Sûr par conception', f6p: "Aucune injection, aucune lecture de mémoire : l'app lit seulement les fichiers que le jeu écrit sur ton PC. Rien qui puisse te faire bannir.",
    howTitle: 'Prêt en 2 minutes', howSub: 'Aucun compte nécessaire.',
    s1t: 'Installe', s1p: "Télécharge l'installateur et lance-le. Windows peut afficher un avertissement SmartScreen : Informations complémentaires → Exécuter quand même.",
    s2t: 'Active le log du jeu', s2p: "En jeu : Paramètres → Autres → Enable Log, puis choisis ton perso. Le jeu oublie cette option à la fermeture : réactive-la à chaque lancement de TLI.",
    faqTitle: 'Questions fréquentes', faq1q: 'Faut-il activer le log à chaque fois ?', faq1a: "Oui. Torchlight: Infinite ne retient pas l'option « Enable Log » : à chaque lancement du jeu, va dans Paramètres → Autres → Enable Log avant de choisir ton perso. Tous les trackers basés sur le log ont la même limite.",
    faq2q: "L'app affiche « Sac inconnu »", faq2a: "Le jeu n'écrit ton sac complet dans le log qu'au chargement de ton perso, ou quand tu tries ton sac. Active le log, puis ouvre ton sac en jeu et clique une fois sur Trier (ou reconnecte ton perso) : ça passe à « Sac synchronisé » en une seconde. Si le sac est toujours faux ou vide, retourne à la sélection des personnages et reviens en jeu.",
    faq3q: 'Le bon ordre quand tu commences à jouer', faq3a: "1. Lance le jeu. 2. Paramètres → Autres → Enable Log. 3. Choisis ton perso et entre en jeu. 4. TLI Companion se connecte tout seul (laisse-le ouvert).",
    faq4q: 'Est-ce sans risque ? Je peux être banni ?', faq4a: "TLI Companion lit uniquement le fichier log que le jeu écrit lui-même. Aucune injection, aucune lecture mémoire, rien ne touche au jeu.",
    s3t: 'Joue', s3p: 'Appuie sur ▶ pour lancer une session de farm : le widget suit tout en direct. Ouvre le Hero Ranking en jeu pour alimenter la méta.',
    showcase1t: 'Sache exactement ce que rapporte chaque carte', showcase1p: "Le widget en jeu compte chaque objet ramassé et le valorise au prix du marché, moins les balises et compas utilisés.",
    showcase1l: ['FE par heure, par carte et pour la session', 'Toutes les zones suivies : cartes, boss, oasis, Tartarus', 'Widget redimensionnable : tu choisis ce qu’il affiche', 'Pause et pause auto quand tu es AFK'],
    showcase3t: 'Analyse ton sac', showcase3p: 'Tout ton sac avec son prix : vois d’un coup d’œil ce qui vaut le coup d’être vendu et ce qui ne vaut rien.',
    showcase3l: ['Valeur du sac et ce qui vaut le coup d’être vendu', 'Source et âge du prix de chaque objet', 'Alertes vocales : Tartarus, Star Shards 80/80, dernière balise'],
    buildsDev: 'Planificateur de build : en développement.',
    showcase2t: 'Copie ce que font les meilleurs', showcase2p: "La méta est construite à partir du Hero Ranking du jeu, consulté par les utilisateurs de l'app sur tous les serveurs.",
    showcase2l: ['Tier list des 28 classes, par serveur ou au global', 'Compétences avec leurs soutiens, légendaires et talents principaux', "Le top 10 de ta classe directement sur l'accueil de l'app"],
    faqTitle: 'Questions',
    q1: 'Est-ce autorisé ? Je risque un ban ?', a1: "L'app ne touche jamais au jeu : aucune injection, aucune lecture de mémoire, aucune automatisation. Elle lit le fichier log que le jeu écrit lui-même quand tu actives « Enable Log », plus quelques fichiers de cache. Elle fonctionne comme les autres trackers communautaires populaires.",
    q2: 'Quelles données sont partagées ?', a2: "Seulement si tu le choisis : les sessions de farm sur lesquelles tu cliques « Partager », les builds que tu publies, les prix vus à l'hôtel des ventes (anonymement) et le Hero Ranking que tu consultes (public en jeu ; les profils masqués en jeu ne sont jamais affichés). Ton compte de jeu et tes mots de passe ne sont jamais lus ni envoyés.",
    q3: 'Est-ce payant ?', a3: "Non, c'est gratuit.",
    q4: 'Sur quelles plateformes ?', a4: 'Windows 10 et 11, version Steam ou autonome du jeu.',
    ctaTitle: 'Prêt à farmer plus malin ?', ctaText: 'Gratuit, sûr, et deux minutes pour démarrer.',
    dlTitle: 'Télécharger TLI Companion', dlSub: 'La dernière version pour Windows.',
    dlButton: "Télécharger l'installateur", dlPortable: "Aucune version publiée pour l'instant — reviens bientôt.",
    reqTitle: 'Configuration', req1t: 'Windows 10 / 11', req1p: '64 bits', req2t: 'Torchlight: Infinite', req2p: 'Steam ou autonome, « Enable Log » activé',
    req3t: 'Environ 300 Mo', req3p: "d'espace disque une fois installé",
    pnTitle: 'Notes de version',
    fbLink: 'Donner mon avis', fbTitle: 'Donner mon avis', fbIntro: 'Un bug, une idée, une question ? Dis-le ici : chaque message est lu.',
    fbType: 'Type', fbBug: 'Bug', fbIdea: 'Idée / amélioration', fbQuestion: 'Question', fbOther: 'Autre',
    fbMessage: 'Message', fbMessagePh: 'Décris le bug ou ton idée (10 caractères minimum)…',
    fbContact: 'Contact (facultatif)', fbContactPh: 'Pseudo Discord ou email, seulement si tu veux une réponse',
    fbPrivacy: 'Seul ce texte est envoyé, rien d’autre. Pas de pièce jointe.', fbSend: 'Envoyer', fbCancel: 'Annuler',
    fbThanks: 'Merci ! Ton message a bien été envoyé.', fbTooShort: 'Écris au moins 10 caractères.', fbError: 'Envoi impossible : {msg}',
    openSource: 'Code source sur GitHub',
    logHelpTitle: "L'app affiche « Log du jeu introuvable » ?",
    logHelp1: 'Lance Torchlight: Infinite et ouvre Paramètres → Autres → clique sur « Enable Log ».',
    logHelp2: 'Reconnecte ton personnage (ou change de perso) : le jeu ne crée le fichier log qu’après.',
    logHelp3: 'Laisse TLI Companion ouvert : il revérifie toutes les 10 secondes et se connecte tout seul.',
    logHelp4: 'Toujours rien ? Sur l’accueil de l’app, clique sur « Choisir UE_game.log » et choisis le fichier à la main.',
    logHelpPath: 'Avec Steam, le fichier est ici (change le disque ou le dossier si ton jeu est installé ailleurs) :',
    logHelpOther: 'Launcher officiel ou Epic : ouvre le dossier du jeu, puis UE_game → TorchLight → Saved → Logs → UE_game.log.',
    smartTitle: 'Windows SmartScreen', smartText: "L'app n'est pas encore signée avec un certificat payant : Windows peut afficher un avertissement au premier lancement. Clique sur « Informations complémentaires » puis « Exécuter quand même ». L'installateur n'est publié que sur tlicompanion.com.",
    sha: 'Empreinte SHA-256',
    accTitle: 'Ton compte', accSub: 'Bientôt disponible.',
    accText: "Aujourd'hui, tu partages sessions et builds avec un pseudo créé dans l'app — sans e-mail ni mot de passe. Bientôt, un compte te permettra de :",
    acc1: 'Te connecter avec Discord et retrouver tes sessions et builds sur n\'importe quel PC',
    acc2: "Suivre d'autres joueurs et être prévenu de leurs nouvelles strats",
    acc3: 'Aimer et commenter les builds et sessions de farm',
    acc4: 'Synchroniser tes réglages et ton build suivi entre appareils',
    accCta: 'En attendant, tout fonctionne sans compte.',
  },
};

const SUPPORT_URL = 'https://buymeacoffee.com/snoopiisz';

// Thème clair (bouton ☀/🌙 de l'en-tête, gardé dans ce navigateur) : feuilles de style claires générées
// par scripts/lighttheme.js, ajoutées après les sombres.
function setTheme(light) {
  document.querySelectorAll('link[data-light]').forEach((l) => l.remove());
  if (light) {
    const add = (href) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.dataset.light = '1'; document.head.appendChild(l); };
    add('/style.light.css');
    if (document.querySelector('link[href="/p/planner.css"]')) add('/p/planner.light.css');
  }
  try { localStorage.setItem('tlicTheme', light ? 'light' : 'dark'); } catch { /* navigation privée */ }
  const b = document.getElementById('themeSwitch');
  if (b) { b.textContent = light ? '🌙' : '☀️'; b.title = light ? (LANG === 'fr' ? 'Thème sombre' : 'Dark theme') : (LANG === 'fr' ? 'Thème clair' : 'Light theme'); }
}
const isLight = () => { try { return localStorage.getItem('tlicTheme') === 'light'; } catch { return false; } };
if (isLight()) setTheme(true);

// Construit l'en-tête (menu commun) et le pied de page. data-page sur <header class="site"> = page active.
function renderLayout() {
  const header = document.querySelector('header.site');
  if (header) {
    const page = header.dataset.page || '';
    const link = (href, key, id) => `<a href="${href}" class="${page === id ? 'on' : ''}">${esc(t(key))}</a>`;
    header.innerHTML = `
      <a class="brand" href="/"><img class="logo" src="/logo.svg" alt="">TLI Companion</a>
      <nav>${link('/', 'navHome', 'home')}${link('/meta', 'navMeta', 'meta')}${link('/builds/', 'navBuilds', 'builds')}${link('/strategies', 'navStrategies', 'strategies')}${link('/prices', 'navPrices', 'prices')}${link('/download', 'navDownload', 'download')}</nav>
      <div class="right"><a class="btn coffee" href="${SUPPORT_URL}" target="_blank" rel="noopener">☕ ${esc(t('supButton'))}</a><button class="lang" id="themeSwitch"></button><button class="lang" id="langSwitch"></button><a class="btn" id="accBtn" href="/account">${esc(t('navAccount'))}</a></div>`;
    document.getElementById('themeSwitch').onclick = () => setTheme(!isLight());
    setTheme(isLight());
    // Connecté (bêta) : le bouton Compte affiche le pseudo.
    fetch('/api/me', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((me) => {
      const b = document.getElementById('accBtn');
      if (me && me.name && b) { b.textContent = me.name; window.ME = me; document.dispatchEvent(new Event('me')); }
    }).catch(() => {});
  }
  const footer = document.querySelector('footer.site');
  if (footer) footer.innerHTML = `<div style="margin-bottom:8px"><a href="${SUPPORT_URL}" target="_blank" rel="noopener" style="color:#ffdd00">☕ ${esc(t('supFooter'))}</a></div><div>${esc(t('footerLine'))} · <a href="https://github.com/julien-szy/tli-companion" target="_blank" rel="noopener">${esc(t('openSource'))}</a></div><div>${esc(t('footerCredits'))}</div><div style="margin-top:6px"><a href="/privacy">${LANG === 'fr' ? 'Confidentialité' : 'Privacy'}</a> · <a href="/terms">${LANG === 'fr' ? "Conditions d'utilisation" : 'Terms of use'}</a></div><div id="appVer" style="margin-top:8px"></div>`;
  // Lien « Donner mon avis » (formulaire texte seul, voir openFeedback).
  const fbl = document.createElement('div');
  fbl.style.marginTop = '6px';
  fbl.innerHTML = `<a href="#" id="fbOpen">💬 ${esc(t('fbLink'))}</a>`;
  if (footer) { footer.prepend(fbl); document.getElementById('fbOpen').onclick = (e) => { e.preventDefault(); openFeedback(); }; }
  // Version actuelle de l'app (pied de page + bouton Télécharger).
  fetch('/api/version').then((r) => r.json()).then((v) => {
    if (!v || !v.version) return;
    const f = document.getElementById('appVer');
    if (f) f.innerHTML = `<a href="/download">TLI Companion v${v.version.replace(/[^\d.]/g, '')}</a>`;
    const dl = document.querySelector('header.site nav a[href="/download"]');
    if (dl && !dl.querySelector('.ver')) dl.insertAdjacentHTML('beforeend', ` <span class="ver">v${v.version.replace(/[^\d.]/g, '')}</span>`);
  }).catch(() => {});
}

// Formulaire d'avis : texte brut seulement, envoyé à /api/feedback. Le champ « website » est un piège à robots (invisible).
function openFeedback() {
  let box = document.getElementById('fbModal');
  if (box) box.remove();
  box = document.createElement('div');
  box.id = 'fbModal';
  box.className = 'fb-bg';
  box.innerHTML = `<div class="fb-modal" role="dialog" aria-modal="true">
    <h2>${esc(t('fbTitle'))}</h2><p class="muted">${esc(t('fbIntro'))}</p>
    <label>${esc(t('fbType'))}<select id="fbType"><option value="bug">${esc(t('fbBug'))}</option><option value="idea">${esc(t('fbIdea'))}</option><option value="question">${esc(t('fbQuestion'))}</option><option value="other">${esc(t('fbOther'))}</option></select></label>
    <label>${esc(t('fbMessage'))}<textarea id="fbMsg" rows="6" maxlength="2000" placeholder="${esc(t('fbMessagePh'))}"></textarea></label>
    <label>${esc(t('fbContact'))}<input id="fbContact" maxlength="100" placeholder="${esc(t('fbContactPh'))}"></label>
    <input id="fbWebsite" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;width:1px;height:1px" aria-hidden="true">
    <p class="muted" style="font-size:12px">${esc(t('fbPrivacy'))}</p>
    <p id="fbOut" hidden></p>
    <div class="fb-foot"><button class="btn" id="fbCancel">${esc(t('fbCancel'))}</button><button class="btn primary" id="fbSend">${esc(t('fbSend'))}</button></div>
  </div>`;
  document.body.appendChild(box);
  const close = () => box.remove();
  box.onclick = (e) => { if (e.target === box) close(); };
  document.getElementById('fbCancel').onclick = close;
  document.getElementById('fbSend').onclick = async () => {
    const out = document.getElementById('fbOut');
    const message = document.getElementById('fbMsg').value.trim();
    if (message.length < 10) { out.hidden = false; out.className = 'neg'; out.textContent = t('fbTooShort'); return; }
    document.getElementById('fbSend').disabled = true;
    try {
      const res = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: document.getElementById('fbType').value, message, contact: document.getElementById('fbContact').value.trim(),
          website: document.getElementById('fbWebsite').value, source: 'site', lang: LANG }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'HTTP ' + res.status);
      out.hidden = false; out.className = 'pos'; out.textContent = t('fbThanks');
      setTimeout(close, 1800);
    } catch (e) {
      document.getElementById('fbSend').disabled = false;
      out.hidden = false; out.className = 'neg'; out.textContent = t('fbError', { msg: e.message });
    }
  };
}
