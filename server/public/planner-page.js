// « Créer un build » (/planner) et fiche d'un build publié (/b/:id), avec le même planificateur que l'app
// (fichiers copiés dans /p/ par scripts/sync-site.js). Sur le site, le build en cours est gardé dans le
// navigateur ; un code de build (TLIC1.…) le passe dans l'app : Builds › Mes builds › Importer un code.
const DRAFT_KEY = 'tlic.draft';
const emptyBuild = () => ({
  title: '', heroKey: '', description: '', traits: [], talents: { trees: [], nodes: {}, core: {} },
  loadout: { active: [], passive: [] }, gear: {}, steps: ['adv.s1', 'adv.s2', 'adv.s3'].map((k) => ({ title: t(k), notes: '', items: [] })),
});
const readDraft = () => { try { return { ...emptyBuild(), ...(JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || {}) }; } catch { return emptyBuild(); } };
const writeDraft = (b) => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(b)); } catch { /* navigateur sans stockage : le build vit le temps de la page */ } };

const heroOf = (key) => (HEROES || []).find((h) => h.key === key) || null;

function plannerHtml(b, ro) {
  const hero = heroOf(b.heroKey);
  return `<div class="pl">
    ${Planner.section('hero', t('pl.hero'), `<div class="pl-herow">${Planner.heroCard(hero, ro)}${hero ? `<a href="${esc(hero.url)}" target="_blank" rel="noopener" class="small">${esc(t('b.seeTlidb'))}</a>` : ''}</div><div id="pTraits"></div>`)}
    ${Planner.section('trees', t('tal.title'), `<div id="pTrees"></div>`)}
    <div class="pl-2">${Planner.section('skills', t('pl.skillsTitle'), `<div id="pSkills"></div>`)}${Planner.section('gear', t('pl.gear'), `<div id="pGear"></div>`)}</div>
  </div>`;
}
async function mountPlanner(b, opts) {
  await Planner.load();
  Planner.bindSections($('content'));
  const hero = heroOf(b.heroKey);
  Talents.mountTraits($('pTraits'), b, { ...opts, hero });
  Talents.mountTrees($('pTrees'), b, opts);
  Planner.mountSkills($('pSkills'), b, opts);
  Planner.mountGear($('pGear'), b, opts);
  if (!opts.readOnly) $('plHeroBtn').onclick = async () => {
    const k = await Planner.pickHero(HEROES, b.heroKey);
    if (k && k !== b.heroKey) { b.heroKey = k; b.traits = []; if (opts.onHero) opts.onHero(); }
  };
}

// Code de build dans une fenêtre : sélectionné, avec un bouton Copier.
async function showCode(b) {
  const code = await Planner.encode(b);
  modal(`<h1>${esc(t('code.title'))}</h1><p class="muted">${esc(t('code.siteHelp'))}</p>
    <div class="body"><textarea id="cdOut" rows="5" readonly>${esc(code)}</textarea><p class="pos" id="cdMsg"></p></div>
    <div class="foot"><button class="btn" id="cdClose">${esc(t('b.cancel'))}</button><button class="btn primary" id="cdCopy">${esc(t('code.copy'))}</button></div>`);
  $('cdOut').select();
  $('cdClose').onclick = () => modal('');
  $('cdCopy').onclick = async () => { try { await navigator.clipboard.writeText(code); $('cdMsg').textContent = t('code.copied'); } catch { $('cdOut').select(); document.execCommand('copy'); $('cdMsg').textContent = t('code.copied'); } };
}

// Build au format du serveur (comme l'app l'envoie) : noms et icônes joints pour l'affichage sur le site.
function publishable(b, id) {
  const ref = (x) => { const i = Planner.info(x) || {}; return { id: x.id || null, skill: x.skill || null, name: i.name || x.name || '', img: i.icon || x.img || null }; };
  const lo = b.loadout || { active: [], passive: [] };
  return {
    version: 1, id, title: b.title.trim(), heroKey: b.heroKey || '', description: b.description || '', createdAt: Date.now(), updatedAt: Date.now(),
    steps: (b.steps || []).map((s) => ({ title: s.title || '', notes: s.notes || '', items: (s.items || []).filter((i) => i.id).map((i) => ({ id: i.id, name: i.name || '', img: i.img || null, qty: i.qty || 1, priority: i.priority, note: i.note || '' })) })),
    loadout: { active: lo.active.map((x) => ({ ...ref(x), supports: (x.supports || []).map(ref) })), passive: lo.passive.map((x) => ({ ...ref(x), supports: (x.supports || []).map(ref) })) },
    talents: b.talents, traits: b.traits, gear: b.gear,
  };
}

// ---------- Éditeur ----------
async function editor() {
  document.title = `TLI Companion — ${t('code.createTitle')}`;
  await heroes();
  const b = readDraft();
  const changed = () => writeDraft(b);
  const render = () => {
    $('content').innerHTML = `
      <div class="pagehead"><h1>${esc(t('code.createTitle'))} <span class="tag beta">BETA</span></h1></div>
      <div class="pl-bar">
        <input class="pl-title" id="pTitle" maxlength="100" placeholder="${esc(t('b.titlePh'))}" value="${esc(b.title)}">
        <button class="btn primary" id="pCode">${esc(t('code.get'))}</button>
        <button class="btn" id="pImport">${esc(t('code.import'))}</button>
        <button class="btn" id="pNew">${esc(t('code.newBuild'))}</button>
        <button class="btn" id="pPub" hidden>${esc(t('acc.publish'))}</button>
      </div>
      <p class="muted small" id="pPubMsg"></p>
      <p class="muted small pl-help">${esc(t('code.editorHelp'))}</p>
      ${plannerHtml(b, false)}
      ${Planner.section('notes', t('b.description'), `<textarea id="pDesc" maxlength="4000" placeholder="${esc(t('b.descPh'))}">${esc(b.description)}</textarea>`)}`;
    $('pTitle').oninput = (e) => { b.title = e.target.value; changed(); };
    $('pDesc').oninput = (e) => { b.description = e.target.value; changed(); };
    $('pCode').onclick = () => showCode(b);
    // Publier sur son compte (bêta) : visible quand on est connecté.
    const showPub = () => { if (window.ME && $('pPub')) { $('pPub').hidden = false; $('pPub').textContent = t(b.publishedId ? 'acc.update' : 'acc.publish'); } };
    showPub(); document.addEventListener('me', showPub, { once: true });
    $('pPub').onclick = async () => {
      if (!b.title.trim()) { $('pTitle').focus(); $('pPubMsg').textContent = t('b.titleRequired'); return; }
      $('pPub').disabled = true;
      try {
        const id = b.publishedId || crypto.randomUUID();
        const r = await fetch('/api/builds', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(publishable(b, id)) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || r.status);
        b.publishedId = id; changed();
        $('pPubMsg').innerHTML = `${esc(t('acc.published'))} <a href="/b/${esc(id)}">tlicompanion.com/b/${esc(id.slice(0, 8))}…</a>`;
        showPub();
      } catch (e) { $('pPubMsg').textContent = t('share.error', { msg: errMsg(e) }); }
      $('pPub').disabled = false;
    };
    $('pNew').onclick = () => { if (!confirm(t('code.confirmNew'))) return; Object.assign(b, emptyBuild()); changed(); render(); };
    $('pImport').onclick = () => {
      modal(`<h1>${esc(t('code.import'))}</h1><p class="muted">${esc(t('code.importHelpSite'))}</p>
        <div class="body"><textarea id="cdIn" rows="5" placeholder="TLIC1.…"></textarea><p class="neg" id="cdErr"></p></div>
        <div class="foot"><button class="btn" id="cdCancel">${esc(t('b.cancel'))}</button><button class="btn primary" id="cdGo">${esc(t('code.open'))}</button></div>`);
      $('cdCancel').onclick = () => modal('');
      $('cdGo').onclick = async () => {
        try { const nb = await Planner.decode($('cdIn').value); Object.assign(b, emptyBuild(), nb); changed(); modal(''); render(); } catch (e) { $('cdErr').textContent = errMsg(e); }
      };
    };
    mountPlanner(b, { onChange: changed, onHero: () => { changed(); render(); } });
  };
  render();
}

// ---------- Fiche d'un build publié ----------
async function viewer(id) {
  $('content').innerHTML = `<div class="empty">${esc(t('loading'))}</div>`;
  const [{ build: b, author, likes, dislikes, myVote, updatedAt }] = await Promise.all([api('/api/builds/' + encodeURIComponent(id)), heroes()]);
  const hero = heroOf(b.heroKey);
  document.title = `${b.title} — TLI Companion`;
  const steps = (b.steps || []).filter((s) => s.items && s.items.length);
  $('content').innerHTML = `
    <div class="pl-head">${portrait(hero, 56)}<div class="grow"><div class="title">${esc(b.title)} <span class="tag beta">BETA</span></div>
      <div class="muted">${esc(heroLabel(hero))} · ${esc(t('by'))} <b>${esc(author)}</b> · ${new Date(updatedAt).toLocaleDateString(LOCALE)}</div></div>
      <span id="pVotes"></span><button class="btn primary" id="pCode">${esc(t('code.get'))}</button><button class="btn" id="pCopyEdit">${esc(t('code.editCopy'))}</button></div>
    ${b.description ? `<div class="card notes">${esc(b.description)}</div>` : ''}
    ${plannerHtml(b, true)}
    ${steps.length ? Planner.section('items', t('pl.items'), `<div class="pl-steps">${steps.map((s, i) => `<div class="pl-step"><h3>${i + 1}. ${esc(s.title || '')}</h3>
      <div class="fchips">${s.items.map((it) => `<span class="chip">${icon(it.img)}${esc(it.name || '#' + it.id)}${it.qty > 1 ? ' ×' + it.qty : ''}</span>`).join('')}</div></div>`).join('')}</div>`) : ''}
    <p class="muted small" style="margin-top:12px">${esc(t('code.viewHelp'))}</p>`;
  $('pCode').onclick = () => showCode(b);
  const signIn = () => { location.href = `/auth/google?next=${encodeURIComponent(location.pathname)}`; };
  Social.mountVotes($('pVotes'), 'build', id, { likes, dislikes, myVote }, { signIn });
  $('content').insertAdjacentHTML('beforeend', '<div class="card soc-card" id="pComments"></div>');
  Social.mountComments($('pComments'), 'build', id, { signIn, avatar: (k) => (k ? portrait(heroOf(k), 22) : '') });

  $('pCopyEdit').onclick = () => {
    if (localStorage.getItem(DRAFT_KEY) && !confirm(t('code.confirmReplace'))) return;
    writeDraft({ ...emptyBuild(), ...b, id: undefined, title: b.title });
    location.href = '/planner';
  };
  mountPlanner(b, { readOnly: true });
}

const m = /^\/b\/([0-9a-f-]{36})$/.exec(location.pathname);
(m ? viewer(m[1]) : editor()).catch((e) => { $('content').innerHTML = `<div class="empty">${esc(t('error', { msg: e.message }))}</div>`; });
