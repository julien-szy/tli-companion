// Page Pactes : tous les pactes du jeu, ceux que les routes partagées utilisent le plus (petite flamme sur les
// plus utilisés), et ma collection. Connecté, la collection est gardée sur le compte : l'app s'en sert pour
// pré-remplir les pactes de loot quand on partage une route. Sans compte, elle reste dans ce navigateur et passe
// sur le compte à la première connexion.
const P = {
  en: {
    title: 'Pactspirits', sub: 'Every pactspirit, the ones farm routes use the most, and your collection.',
    loginT: 'Save your collection to your account', loginP: 'Signed in, TLI Companion fills in your loot pactspirits for you when you share a farm route. Without an account, your collection stays in this browser.',
    signIn: 'Sign in with Google', saved: 'Saved to your account', savedLocal: 'Saved in this browser', saving: 'Saving…',
    search: 'Search a pactspirit', all: 'All', drop: 'Drop pacts', mine: 'My collection', used: 'Used in routes',
    sortUse: 'Most used', sortName: 'Name', sortFe: 'Best FE/h',
    have: 'I have it', level: 'Level', lv: 'Lv. {n}', lvAny: 'Level ?',
    routes: '{n} routes', players: '{n} players', feh: '{v} FE/h on average', topLv: 'often level {n}',
    flame: 'Among the most used loot pactspirits in shared routes', flameTop: 'The most used loot pactspirit',
    none: 'No pactspirit found.', count: '{n} pactspirits · {m} in your collection',
    how: 'Usage: loot pactspirits picked by players when they share a route (last 120 days, {n} routes). FE/h on average is that of these routes, not the pactspirit alone.',
    dropTag: 'Drop', r: { Legendary: 'Legendary', Rare: 'Rare', Magic: 'Magic' },
  },
  fr: {
    title: 'Pactes', sub: 'Tous les pactes, ceux que les routes de farm utilisent le plus, et ta collection.',
    loginT: 'Garde ta collection sur ton compte', loginP: 'Connecté, TLI Companion remplit tes pactes de loot à ta place quand tu partages une route de farm. Sans compte, ta collection reste dans ce navigateur.',
    signIn: 'Se connecter avec Google', saved: 'Enregistré sur ton compte', savedLocal: 'Enregistré dans ce navigateur', saving: 'Enregistrement…',
    search: 'Chercher un pacte', all: 'Tous', drop: 'Pactes de loot', mine: 'Ma collection', used: 'Utilisés dans des routes',
    sortUse: 'Les plus utilisés', sortName: 'Nom', sortFe: 'Meilleur FE/h',
    have: "Je l'ai", level: 'Niveau', lv: 'Niv. {n}', lvAny: 'Niveau ?',
    routes: '{n} routes', players: '{n} joueurs', feh: '{v} FE/h en moyenne', topLv: 'souvent niveau {n}',
    flame: 'Parmi les pactes de loot les plus utilisés dans les routes partagées', flameTop: 'Le pacte de loot le plus utilisé',
    none: 'Aucun pacte trouvé.', count: '{n} pactes · {m} dans ta collection',
    how: "Utilisation : pactes de loot choisis par les joueurs quand ils partagent une route (120 derniers jours, {n} routes). Le FE/h moyen est celui de ces routes, pas celui du pacte seul.",
    dropTag: 'Loot', r: { Legendary: 'Légendaire', Rare: 'Rare', Magic: 'Magique' },
  },
};
const L = P[LANG] || P.en;
const pt = (k, v) => String(L[k] ?? P.en[k] ?? k).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] != null ? v[n] : m));
document.title = `TLI Companion — ${pt('title')}`;

const LOCAL = 'tlicPacts';
let ALL = [];        // { name, img, rarity|null, drop }
let USE = {};        // nom -> usage
let routes = 0;
let mine = {};       // nom -> niveau (null = inconnu)
let signed = false;
let view = 'all', sort = 'use', q = '';
let flames = new Map(); // nom -> 2 (le plus utilisé) ou 1

const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL) || '{}') || {}; } catch { return {}; } };
const writeLocal = () => { try { localStorage.setItem(LOCAL, JSON.stringify(mine)); } catch { /* navigation privée */ } };
const call = async (method, url, body) => {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status });
  return j;
};

let saveTimer = null;
function save() {
  writeLocal();
  const st = $('pkSave');
  if (!signed) { if (st) st.textContent = pt('savedLocal'); return; }
  if (st) st.textContent = pt('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await call('PUT', '/api/me/pacts', { pacts: Object.entries(mine).map(([name, level]) => ({ name, level })) });
      if ($('pkSave')) $('pkSave').textContent = pt('saved');
    } catch (e) { if ($('pkSave')) $('pkSave').textContent = e.message; }
  }, 600);
}

function card(p) {
  const u = USE[p.name];
  const have = p.name in mine;
  const f = flames.get(p.name);
  const lvSel = `<select data-lv="${esc(p.name)}" aria-label="${esc(pt('level'))}"><option value="">${esc(pt('lvAny'))}</option>${[1, 2, 3, 4, 5, 6]
    .map((n) => `<option value="${n}"${mine[p.name] === n ? ' selected' : ''}>${esc(pt('lv', { n }))}</option>`).join('')}</select>`;
  return `<div class="pk-card${have ? ' have' : ''}">
    ${f ? `<span class="pk-flame${f === 2 ? ' top' : ''}" title="${esc(pt(f === 2 ? 'flameTop' : 'flame'))}">🔥</span>` : ''}
    <div class="pk-img">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ''}</div>
    <b class="pk-name">${esc(p.name)}</b>
    <div class="pk-tags">${p.drop ? `<span class="tag pk-drop">${esc(pt('dropTag'))}</span>` : ''}${p.rarity ? `<span class="tag pk-r ${p.rarity.toLowerCase()}">${esc(L.r[p.rarity] || p.rarity)}</span>` : ''}</div>
    ${u ? `<div class="pk-use"><span>${esc(pt('routes', { n: u.routes }))} · ${esc(pt('players', { n: u.players }))}</span>
      <span class="muted">${esc(pt('feh', { v: nf0.format(u.avgFeH) }))}${u.topLevel ? ' · ' + esc(pt('topLv', { n: u.topLevel })) : ''}</span></div>` : '<div class="pk-use muted">–</div>'}
    <div class="pk-own"><label><input type="checkbox" data-have="${esc(p.name)}"${have ? ' checked' : ''}> ${esc(pt('have'))}</label>${have ? lvSel : ''}</div>
  </div>`;
}

function render() {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let list = ALL.filter((p) => words.every((w) => p.name.toLowerCase().includes(w))
    && (view === 'all' || (view === 'drop' && p.drop) || (view === 'mine' && p.name in mine) || (view === 'used' && USE[p.name])));
  const use = (p) => (USE[p.name] ? USE[p.name].routes : 0);
  const fe = (p) => (USE[p.name] ? USE[p.name].avgFeH : -1);
  list = list.slice().sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name)
    : sort === 'fe' ? (a, b) => fe(b) - fe(a) || a.name.localeCompare(b.name)
      : (a, b) => use(b) - use(a) || (b.drop - a.drop) || a.name.localeCompare(b.name));
  $('pkCount').textContent = pt('count', { n: list.length, m: Object.keys(mine).length });
  $('pkGrid').innerHTML = list.map(card).join('') || `<p class="empty">${esc(pt('none'))}</p>`;
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === view));
  document.querySelectorAll('[data-have]').forEach((c) => (c.onchange = () => {
    if (c.checked) mine[c.dataset.have] = mine[c.dataset.have] ?? null; else delete mine[c.dataset.have];
    save(); render();
  }));
  document.querySelectorAll('[data-lv]').forEach((s) => (s.onchange = () => { mine[s.dataset.lv] = +s.value || null; save(); }));
}

function frame() {
  $('content').innerHTML = `<div class="pagehead"><h1>${esc(pt('title'))}</h1><p>${esc(pt('sub'))}</p></div>
    ${signed ? '' : `<div class="card pk-login"><div><b>${esc(pt('loginT'))}</b><p class="muted">${esc(pt('loginP'))}</p></div>
      <a class="btn primary gbtn" href="/auth/google?next=/pacts"><span class="g">G</span>${esc(pt('signIn'))}</a></div>`}
    <div class="pk-tools">
      <input id="pkQ" type="search" autocomplete="off" placeholder="${esc(pt('search'))}">
      <div class="pk-views">${['all', 'drop', 'used', 'mine'].map((v) => `<button class="btn" data-view="${v}">${esc(pt(v))}</button>`).join('')}</div>
      <select id="pkSort"><option value="use">${esc(pt('sortUse'))}</option><option value="fe">${esc(pt('sortFe'))}</option><option value="name">${esc(pt('sortName'))}</option></select>
      <span class="muted small" id="pkCount"></span><span class="muted small" id="pkSave"></span>
    </div>
    <div class="pk-grid" id="pkGrid"><p class="empty">…</p></div>
    <p class="muted small" id="pkHow"></p>`;
  $('pkQ').oninput = (e) => { q = e.target.value; render(); };
  $('pkSort').onchange = (e) => { sort = e.target.value; render(); };
  document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => { view = b.dataset.view; render(); }));
}

async function load() {
  mine = readLocal();
  try {
    const me = await call('GET', '/api/me/pacts');
    signed = true;
    const remote = Object.fromEntries((me.pacts || []).map((p) => [p.name, p.level ?? null]));
    // Première connexion : ce qui avait été coché dans ce navigateur rejoint le compte.
    const extra = Object.keys(mine).some((k) => !(k in remote));
    mine = { ...mine, ...remote };
    if (extra) save();
  } catch { signed = false; }
  frame();
  const [icons, usage] = await Promise.all([api('/extra_icons.json'), api('/api/pacts/usage').catch(() => ({ routes: 0, pacts: [], drop: [] }))]);
  const drop = new Map((usage.drop || []).map((d) => [d.name, d.rarity]));
  ALL = Object.entries(icons.icons || icons).filter(([, url]) => /\/icons\/servants\//.test(url))
    .map(([name, url]) => ({ name, img: url.replace(/^https:\/\/tlicompanion\.com/, ''), rarity: drop.get(name) || null, drop: drop.has(name) }));
  USE = Object.fromEntries((usage.pacts || []).map((p) => [p.name, p]));
  routes = usage.routes || 0;
  // Flamme : les 5 pactes de loot les plus utilisés (au moins 2 routes) ; grande flamme pour le premier.
  flames = new Map((usage.pacts || []).filter((p) => p.routes >= 2).slice(0, 5).map((p, i) => [p.name, i === 0 ? 2 : 1]));
  $('pkHow').textContent = pt('how', { n: routes });
  render();
}
load();
