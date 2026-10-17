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
    heroLead: 'Live profit overlay, farm sessions you can share, builds with a purchase advisor, and the meta of every class — in one free app that simply reads the game log.',
    downloadWin: 'Download for Windows', seeMeta: 'See the meta', versionInfo: 'Version {v} · {size} · Windows 10/11 · free',
    versionSoon: 'Windows 10/11 · free',
    nSessions: 'farm sessions shared', nBuilds: 'builds shared', nPlayers: 'ranked players analysed', nClasses: 'classes in the meta',
    featuresTitle: 'Everything in one place', featuresSub: 'Small tools you used to juggle between sites and spreadsheets, finally together.',
    f1t: 'Live profit overlay', f1p: 'A small widget stays on top of the game: FE per hour, profit of the current map, every drop with its value. Collapse it to a thin bar.',
    f2t: 'Farm sessions', f2p: 'Start / stop a session and get a full strategy sheet: maps, Void Chart zones, Netherrealm talents, consumables, best drops, FE/h.',
    f3t: 'Builds & purchase advisor', f3p: 'Follow a build: the advisor knows your bag, your skills and the market, and tells you what to buy next and how long to farm for it.',
    f4t: 'Class meta & leaderboards', f4p: 'Tier list of the classes, what the best players of each class use, per server or worldwide, with the full profile of every top player.',
    f5t: 'Real market prices', f5p: 'Prices from your own auction house searches, shared anonymously between players, plus a community price base for everything else.',
    f6t: 'Safe by design', f6p: 'No injection, no memory reading: the app only reads files the game writes on your PC. Nothing that could get you banned.',
    howTitle: 'Up and running in 2 minutes', howSub: 'No account needed.',
    s1t: 'Install', s1p: 'Download the installer and launch it. Windows may show a SmartScreen warning: More info → Run anyway.',
    s2t: 'Enable the game log', s2p: 'In game: Settings → Other → Enable Log. Relog your character once — the app connects by itself.',
    s3t: 'Play', s3p: 'The widget tracks everything live. Start a farm session, follow a build, open the Hero Ranking to feed the meta.',
    showcase1t: 'Know exactly what each map is worth', showcase1p: 'The overlay counts every item you pick up and values it at market price, minus the beacons and compasses you used.',
    showcase1l: ['FE per hour, per map and for the session', 'Every drop with its value, live', 'Strategy sheet to share at the end of a session'],
    showcase2t: 'Copy what the best players do', showcase2p: 'The meta is built from the in-game Hero Ranking, browsed by app users on every server.',
    showcase2l: ['Tier list of all 28 classes, per server or worldwide', 'Skills with their supports, legendaries, core talents, talent trees, pactspirits', 'The top 10 of your class right on the app home page'],
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
    heroLead: "Profit en direct au-dessus du jeu, sessions de farm à partager, builds avec conseiller d'achat et méta de chaque classe — dans une seule app gratuite qui lit simplement le log du jeu.",
    downloadWin: 'Télécharger pour Windows', seeMeta: 'Voir la méta', versionInfo: 'Version {v} · {size} · Windows 10/11 · gratuit',
    versionSoon: 'Windows 10/11 · gratuit',
    nSessions: 'sessions de farm partagées', nBuilds: 'builds partagés', nPlayers: 'joueurs classés analysés', nClasses: 'classes dans la méta',
    featuresTitle: 'Tout au même endroit', featuresSub: 'Les petits outils que tu jonglais entre sites et tableurs, enfin réunis.',
    f1t: 'Profit en direct', f1p: 'Un petit widget reste au-dessus du jeu : FE par heure, profit de la carte en cours, chaque drop avec sa valeur. Réductible en une fine barre.',
    f2t: 'Sessions de farm', f2p: 'Démarre / termine une session et obtiens la fiche complète de ta strat : cartes, zones du Void Chart, talents Netherrealm, consommables, meilleurs drops, FE/h.',
    f3t: "Builds & conseiller d'achat", f3p: 'Suis un build : le conseiller connaît ton sac, tes compétences et le marché, et te dit quoi acheter ensuite et combien de temps farmer pour ça.',
    f4t: 'Méta & classements', f4p: 'Tier list des classes, ce que jouent les meilleurs de chaque classe, par serveur ou au global, avec la fiche complète de chaque top joueur.',
    f5t: 'Vrais prix du marché', f5p: "Les prix de tes propres recherches à l'hôtel des ventes, partagés anonymement entre joueurs, plus une base de prix communautaire pour le reste.",
    f6t: 'Sûr par conception', f6p: "Aucune injection, aucune lecture de mémoire : l'app lit seulement les fichiers que le jeu écrit sur ton PC. Rien qui puisse te faire bannir.",
    howTitle: 'Prêt en 2 minutes', howSub: 'Aucun compte nécessaire.',
    s1t: 'Installe', s1p: "Télécharge l'installateur et lance-le. Windows peut afficher un avertissement SmartScreen : Informations complémentaires → Exécuter quand même.",
    s2t: 'Active le log du jeu', s2p: "En jeu : Paramètres → Autres → Enable Log. Reconnecte ton perso une fois — l'app se connecte toute seule.",
    s3t: 'Joue', s3p: 'Le widget suit tout en direct. Lance une session de farm, suis un build, ouvre le Hero Ranking pour alimenter la méta.',
    showcase1t: 'Sache exactement ce que rapporte chaque carte', showcase1p: "Le widget compte chaque objet ramassé et le valorise au prix du marché, moins les balises et compas utilisés.",
    showcase1l: ['FE par heure, par carte et pour la session', 'Chaque drop avec sa valeur, en direct', 'Fiche de strat à partager en fin de session'],
    showcase2t: 'Copie ce que font les meilleurs', showcase2p: "La méta est construite à partir du Hero Ranking du jeu, consulté par les utilisateurs de l'app sur tous les serveurs.",
    showcase2l: ['Tier list des 28 classes, par serveur ou au global', 'Compétences avec leurs soutiens, légendaires, talents principaux, arbres, pactes', "Le top 10 de ta classe directement sur l'accueil de l'app"],
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

// Construit l'en-tête (menu commun) et le pied de page. data-page sur <header class="site"> = page active.
function renderLayout() {
  const header = document.querySelector('header.site');
  if (header) {
    const page = header.dataset.page || '';
    const link = (href, key, id) => `<a href="${href}" class="${page === id ? 'on' : ''}">${esc(t(key))}</a>`;
    header.innerHTML = `
      <a class="brand" href="/"><img class="logo" src="/logo.svg" alt="">TLI Companion</a>
      <nav>${link('/', 'navHome', 'home')}${link('/meta', 'navMeta', 'meta')}${link('/builds', 'navBuilds', 'builds')}${link('/strategies', 'navStrategies', 'strategies')}${link('/download', 'navDownload', 'download')}</nav>
      <div class="right"><a class="btn coffee" href="${SUPPORT_URL}" target="_blank" rel="noopener">☕ ${esc(t('supButton'))}</a><button class="lang" id="langSwitch"></button><a class="btn" href="/account">${esc(t('navAccount'))}</a></div>`;
  }
  const footer = document.querySelector('footer.site');
  if (footer) footer.innerHTML = `<div style="margin-bottom:8px"><a href="${SUPPORT_URL}" target="_blank" rel="noopener" style="color:#ffdd00">☕ ${esc(t('supFooter'))}</a></div><div>${esc(t('footerLine'))} · <a href="https://github.com/julien-szy/tli-companion" target="_blank" rel="noopener">${esc(t('openSource'))}</a></div><div>${esc(t('footerCredits'))}</div><div id="appVer" style="margin-top:8px"></div>`;
  // Version actuelle de l'app (pied de page + bouton Télécharger).
  fetch('/api/version').then((r) => r.json()).then((v) => {
    if (!v || !v.version) return;
    const f = document.getElementById('appVer');
    if (f) f.innerHTML = `<a href="/download">TLI Companion v${v.version.replace(/[^\d.]/g, '')}</a>`;
    const dl = document.querySelector('header.site nav a[href="/download"]');
    if (dl && !dl.querySelector('.ver')) dl.insertAdjacentHTML('beforeend', ` <span class="ver">v${v.version.replace(/[^\d.]/g, '')}</span>`);
  }).catch(() => {});
}
