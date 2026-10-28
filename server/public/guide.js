// Guide du nouveau joueur : la progression de la saison en étapes à cocher, avec « que faire ensuite ».
// Cases gardées dans ce navigateur et, connecté, sur le compte (pour les retrouver sur un autre ordinateur).
// Le contenu des étapes est dans STEPS ci-dessous : une étape = id (ne jamais le changer, il sert à retenir la
// case cochée), titre, quoi faire, et éventuellement un lien vers une page du site.
const G = {
  en: {
    title: 'New player guide', sub: 'Everything to do this season, step by step. Tick what is done: the guide tells you what comes next.',
    next: 'Next step', allDone: 'Everything is done. Well played! Keep farming with the best routes.', done: 'Done',
    progress: '{d} / {n} steps', reset: 'Untick everything', resetQ: 'Untick every step?', open: 'Open',
    saved: 'Saved to your account', local: 'Saved in this browser. Sign in to find it on another computer.', signIn: 'Sign in',
    hideDone: 'Hide done steps', note: 'The order is a suggestion: skip what you already know.',
  },
  fr: {
    title: 'Guide du nouveau joueur', sub: "Tout ce qu'il y a à faire cette saison, étape par étape. Coche ce qui est fait : le guide te dit quoi faire ensuite.",
    next: 'Prochaine étape', allDone: 'Tout est fait. Bien joué ! Continue à farmer avec les meilleures routes.', done: "C'est fait",
    progress: '{d} / {n} étapes', reset: 'Tout décocher', resetQ: 'Décocher toutes les étapes ?', open: 'Ouvrir',
    saved: 'Enregistré sur ton compte', local: 'Enregistré dans ce navigateur. Connecte-toi pour le retrouver sur un autre ordinateur.', signIn: 'Se connecter',
    hideDone: 'Cacher les étapes faites', note: "L'ordre est une suggestion : saute ce que tu connais déjà.",
  },
};
const gt = (k, v) => String((G[LANG] || G.en)[k] ?? G.en[k] ?? k).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] != null ? v[n] : m));
const tr = (o) => (o && typeof o === 'object' ? o[LANG] || o.en : o);

// Étapes, par phase. [fr, en] dans chaque texte.
const STEPS = [
  { phase: { fr: 'Récupère tes cadeaux gratuits', en: 'Claim your free rewards' }, steps: [
    { id: 'mail', t: { fr: 'Ouvre ton courrier', en: 'Open your mail' }, d: { fr: 'Les cadeaux de début de saison, les compensations et les récompenses d\'événement arrivent par courrier : tirages, cristaux, matériaux. Récupère tout.', en: 'Season start gifts, compensations and event rewards arrive by mail: draws, crystals, materials. Claim everything.' } },
    { id: 'events', t: { fr: 'Fais le tour des événements', en: 'Go through the events' }, d: { fr: 'Le menu des événements donne des récompenses de connexion et des quêtes faciles (souvent des tirages et des cristaux). Reviens chaque jour.', en: 'The events menu gives login rewards and easy quests (often draws and crystals). Come back every day.' } },
    { id: 'pass', t: { fr: 'Récupère le passe de saison gratuit', en: 'Claim the free season pass' }, d: { fr: 'La partie gratuite du passe de saison se remplit en jouant. Pense à récupérer les paliers atteints.', en: 'The free track of the season pass fills up as you play. Remember to claim the tiers you reach.' } },
    { id: 'achievements', t: { fr: 'Récupère les succès', en: 'Claim achievements' }, d: { fr: 'Beaucoup de succès donnent des cristaux. Ils ne se récupèrent pas tout seuls : ouvre la page des succès de temps en temps.', en: 'Many achievements give crystals. They are not claimed automatically: open the achievements page from time to time.' } },
    { id: 'draws', t: { fr: 'Utilise tes tirages', en: 'Use your draws' }, d: { fr: 'Les tirages servent à obtenir des pactes. Vise d\'abord des pactes de loot (quantité d\'objets), ils comptent le plus pour farmer.', en: 'Draws give pactspirits. Aim for loot pactspirits first (item quantity): they matter most for farming.' }, link: '/pacts' },
  ] },
  { phase: { fr: 'Campagne et premiers niveaux', en: 'Campaign and first levels' }, steps: [
    { id: 'story', t: { fr: 'Termine la campagne', en: 'Finish the campaign' }, d: { fr: "L'histoire débloque le Netherrealm, le cœur du farm. Ne t'attarde pas : avance vite.", en: 'The story unlocks the Netherrealm, the heart of farming. Do not linger: move fast.' } },
    { id: 'build', t: { fr: 'Choisis un build qui farme bien', en: 'Pick a build that farms well' }, d: { fr: 'Regarde ce que jouent les meilleurs joueurs de chaque classe, puis prépare ton build dans le TOB.', en: 'Look at what the best players of each class use, then plan your build in the TOB.' }, link: '/meta' },
    { id: 'talents', t: { fr: 'Place tes talents', en: 'Spend your talent points' }, d: { fr: 'Choisis ton dieu et ta classe dans les talents, en suivant ton build.', en: 'Pick your god and class in the talents, following your build.' }, link: '/builds/' },
    { id: 'traits', t: { fr: 'Prends tes traits de héros (niveaux 45, 60, 75)', en: 'Take your hero traits (levels 45, 60, 75)' }, d: { fr: 'Chaque palier débloque un trait : prends celui de ton build.', en: 'Each tier unlocks a trait: take the one your build uses.' } },
    { id: 'app', t: { fr: 'Installe TLI Companion', en: 'Install TLI Companion' }, d: { fr: "Le widget te montre ton FE/h en direct, chaque objet ramassé et sa valeur. Indispensable pour savoir ce qui rapporte.", en: 'The widget shows your live FE/h, every drop and its value. Essential to know what pays.' }, link: '/download' },
  ] },
  { phase: { fr: 'Netherrealm', en: 'Netherrealm' }, steps: [
    { id: 'tm1', t: { fr: 'Monte les Timemarks un par un', en: 'Climb the Timemarks one by one' }, d: { fr: 'Chaque Timemark est plus dur et rapporte plus. Monte quand ton build tue vite et ne meurt plus.', en: 'Each Timemark is harder and pays more. Move up when your build kills fast and no longer dies.' } },
    { id: 'shards', t: { fr: 'Remplis les Star Shards de chaque région (80)', en: 'Fill the Star Shards of each region (80)' }, d: { fr: "L'app compte tes Star Shards par région et te prévient quand une région est à 80.", en: 'The app counts your Star Shards per region and tells you when a region reaches 80.' } },
    { id: 'voidchart', t: { fr: 'Remplis ton Void Chart', en: 'Fill your Void Chart' }, d: { fr: 'Les talents du Netherrealm changent ce que tes cartes rapportent. Copie ceux des routes qui gagnent le plus.', en: 'Netherrealm talents change what your maps pay. Copy those of the best paying routes.' }, link: '/strategies' },
    { id: 'pacts', t: { fr: 'Équipe tes pactes de loot', en: 'Equip your loot pactspirits' }, d: { fr: 'Note ta collection sur la page Pactes : l\'app les remplira pour toi quand tu partages une route.', en: 'Note your collection on the Pactspirits page: the app fills them in for you when you share a route.' }, link: '/pacts' },
    { id: 'route', t: { fr: 'Choisis une route de farm', en: 'Pick a farm route' }, d: { fr: 'Prends une des routes qui rapportent le plus pour ton Timemark, avec ses consommables.', en: 'Take one of the best paying routes for your Timemark, with its consumables.' }, link: '/strategies' },
  ] },
  { phase: { fr: 'Contenu de saison et extras', en: 'Season content and extras' }, steps: [
    { id: 'season', t: { fr: 'Découvre la mécanique de saison', en: 'Discover the season mechanic' }, d: { fr: 'Chaque saison ajoute son propre contenu, souvent très rentable. Lis les notes de saison du jeu.', en: 'Each season adds its own content, often very profitable. Read the game season notes.' } },
    { id: 'modes', t: { fr: 'Essaie les modes spéciaux', en: 'Try the special modes' }, d: { fr: "Tartarus, Vorax, Arcana, Aeterna, Secret Realm, Sandlord : l'app chronomètre chacun pour voir lequel rapporte le plus.", en: 'Tartarus, Vorax, Arcana, Aeterna, Secret Realm, Sandlord: the app times each one so you see which pays most.' } },
    { id: 'trial', t: { fr: 'Fais la Trial of Divinity', en: 'Do the Trial of Divinity' }, d: { fr: 'Elle rapporte gros quand ton build est assez solide.', en: 'It pays well once your build is solid enough.' } },
    { id: 'boss', t: { fr: 'Bats les Watchers des régions', en: 'Beat the region Watchers' }, d: { fr: 'Les boss de fin de région donnent des objets recherchés.', en: 'End-of-region bosses drop sought-after items.' } },
  ] },
  { phase: { fr: 'Économie', en: 'Economy' }, steps: [
    { id: 'ah', t: { fr: "Vends à l'hôtel des ventes", en: 'Sell at the auction house' }, d: { fr: 'Vérifie les prix avant de vendre : certains objets valent bien plus qu\'on ne croit.', en: 'Check prices before selling: some items are worth far more than you think.' }, link: '/prices' },
    { id: 'movers', t: { fr: 'Surveille ce qui bouge', en: 'Watch what moves' }, d: { fr: 'Les objets qui montent ou baissent le plus sur 3 jours, et ce que ça change par carte pour ta route.', en: 'Items rising or falling the most over 3 days, and what it changes per map for your route.' }, link: '/prices?view=movers' },
    { id: 'share', t: { fr: 'Partage ta route', en: 'Share your route' }, d: { fr: 'Partage tes sessions depuis l\'app : tu aides les autres joueurs et tu compares ton FE/h au leur.', en: 'Share your sessions from the app: you help other players and compare your FE/h with theirs.' } },
  ] },
];
const ALL = STEPS.flatMap((p) => p.steps);
const LOCAL = 'tlicGuide';
let done = {};
let signed = false;
let hideDone = false;
try { hideDone = localStorage.getItem('tlicGuideHide') === '1'; } catch { /* rien */ }

const call = async (method, url, body) => {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status });
  return j;
};
let timer = null;
function save() {
  try { localStorage.setItem(LOCAL, JSON.stringify(done)); } catch { /* navigation privée */ }
  if (!signed) return;
  clearTimeout(timer);
  timer = setTimeout(() => call('PUT', '/api/me/progress', { progress: done }).catch(() => {}), 500);
}

function render() {
  const n = ALL.length, d = ALL.filter((s) => done[s.id]).length;
  const next = ALL.find((s) => !done[s.id]);
  $('content').innerHTML = `<div class="pagehead"><h1>${esc(gt('title'))}</h1><p>${esc(gt('sub'))}</p></div>
    <div class="card gd-next">
      ${next ? `<span class="gd-next-k">${esc(gt('next'))}</span><b>${esc(tr(next.t))}</b><p>${esc(tr(next.d))}</p>
        <div class="gd-next-a"><button class="btn primary" data-check="${next.id}">✓ ${esc(gt('done'))}</button>${next.link ? `<a class="btn" href="${esc(next.link)}">${esc(gt('open'))} →</a>` : ''}</div>`
        : `<b>🎉 ${esc(gt('allDone'))}</b>`}
      <div class="gd-bar"><span style="width:${(d / n) * 100}%"></span></div>
      <div class="gd-meta"><span class="muted small">${esc(gt('progress', { d, n }))} · ${esc(gt('note'))}</span>
        <span class="muted small">${signed ? esc(gt('saved')) : `${esc(gt('local'))} <a href="/auth/google?next=/guide">${esc(gt('signIn'))}</a>`}</span></div>
    </div>
    <div class="gd-tools"><label class="muted small"><input type="checkbox" id="gdHide"${hideDone ? ' checked' : ''}> ${esc(gt('hideDone'))}</label>
      <button class="btn" id="gdReset">${esc(gt('reset'))}</button></div>
    ${STEPS.map((p) => {
      const pd = p.steps.filter((s) => done[s.id]).length;
      const rows = p.steps.filter((s) => !hideDone || !done[s.id]);
      return `<div class="card gd-phase"><h2>${esc(tr(p.phase))} <span class="muted small">${pd} / ${p.steps.length}</span></h2>
        ${rows.map((s) => `<label class="gd-step${done[s.id] ? ' done' : ''}${next && next.id === s.id ? ' is-next' : ''}">
          <input type="checkbox" data-step="${s.id}"${done[s.id] ? ' checked' : ''}>
          <span><b>${esc(tr(s.t))}</b><span class="muted">${esc(tr(s.d))}</span></span>
          ${s.link ? `<a href="${esc(s.link)}" class="gd-link" onclick="event.stopPropagation()">${esc(gt('open'))} →</a>` : ''}</label>`).join('')}
      </div>`;
    }).join('')}`;
  document.querySelectorAll('[data-step]').forEach((c) => (c.onchange = () => { if (c.checked) done[c.dataset.step] = Date.now(); else delete done[c.dataset.step]; save(); render(); }));
  document.querySelectorAll('[data-check]').forEach((b) => (b.onclick = () => { done[b.dataset.check] = Date.now(); save(); render(); }));
  $('gdHide').onchange = (e) => { hideDone = e.target.checked; try { localStorage.setItem('tlicGuideHide', hideDone ? '1' : '0'); } catch { /* rien */ } render(); };
  $('gdReset').onclick = () => { if (confirm(gt('resetQ'))) { done = {}; save(); render(); } };
}

(async () => {
  document.title = `TLI Companion — ${gt('title')}`;
  try { done = JSON.parse(localStorage.getItem(LOCAL) || '{}') || {}; } catch { done = {}; }
  try {
    const r = await call('GET', '/api/me/progress');
    signed = true;
    const before = Object.keys(done).length;
    done = { ...done, ...(r.progress || {}) };
    if (Object.keys(done).length > Object.keys(r.progress || {}).length || before) save();
  } catch { signed = false; }
  render();
})();
