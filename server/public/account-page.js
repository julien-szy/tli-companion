// Page Compte (bêta) : connexion avec Google, profil (pseudo, avatar de héros, bio), raccourcis vers son
// contenu (builds, routes, ce qu'on a aimé), déconnexion et suppression du compte.
const A = {
  en: {
    title: 'My account', intro: 'An account lets you find your builds and farm routes on any computer, on this website and in the app, and like the builds and routes of other players.',
    li1: 'Sign in with Google: we only keep your Google identifier, never your email or your real name.',
    li2: 'Same account on the website and in TLI Companion (Settings › Account).',
    li3: 'Already shared from the app? Sign in from the app first: your pseudo and everything you shared move to your account.',
    signIn: 'Sign in with Google', unavailable: 'Google sign-in is not available yet.', expired: 'The sign-in took too long, please try again.',
    cancelled: 'Sign-in cancelled.', google: 'Google sign-in failed, please try again.', linkedApp: 'TLI Companion is now connected to your account: you can go back to the app.',
    welcome: 'Welcome! Choose the pseudo other players will see.', profile: 'Profile', pseudo: 'Pseudo', bio: 'About me', bioPh: 'Main class, favourite farm, server…',
    avatar: 'Avatar', avatarNone: 'No avatar', save: 'Save', saved: 'Saved.', myBuilds: 'My builds', myRoutes: 'My farm routes',
    likedBuilds: 'Builds I liked', likedRoutes: 'Routes I liked', none: 'Nothing yet.', create: 'Create a build', logout: 'Sign out',
    del: 'Delete my account', delConfirm: 'This deletes your account and everything you shared (builds, routes, likes). Type DELETE to confirm.',
    deleted: 'Your account has been deleted.', since: 'Member since {d}', google2: 'Signed in with Google', privacy: 'Privacy policy',
  },
  fr: {
    title: 'Mon compte', intro: 'Un compte te permet de retrouver tes builds et tes routes de farm sur n\'importe quel ordinateur, sur ce site et dans l\'app, et d\'aimer les builds et routes des autres joueurs.',
    li1: 'Connexion avec Google : on ne garde que ton identifiant Google, jamais ton email ni ton vrai nom.',
    li2: 'Le même compte sur le site et dans TLI Companion (Réglages › Compte).',
    li3: 'Tu as déjà partagé depuis l\'app ? Connecte-toi d\'abord depuis l\'app : ton pseudo et tout ce que tu as partagé passent sur ton compte.',
    signIn: 'Se connecter avec Google', unavailable: 'La connexion Google n\'est pas encore disponible.', expired: 'La connexion a pris trop de temps, réessaie.',
    cancelled: 'Connexion annulée.', google: 'La connexion Google a échoué, réessaie.', linkedApp: 'TLI Companion est maintenant connecté à ton compte : tu peux retourner dans l\'app.',
    welcome: 'Bienvenue ! Choisis le pseudo que verront les autres joueurs.', profile: 'Profil', pseudo: 'Pseudo', bio: 'À propos de moi', bioPh: 'Classe principale, farm préféré, serveur…',
    avatar: 'Avatar', avatarNone: 'Pas d\'avatar', save: 'Enregistrer', saved: 'Enregistré.', myBuilds: 'Mes builds', myRoutes: 'Mes routes de farm',
    likedBuilds: 'Builds aimés', likedRoutes: 'Routes aimées', none: 'Rien pour l\'instant.', create: 'Créer un build', logout: 'Se déconnecter',
    del: 'Supprimer mon compte', delConfirm: 'Cela supprime ton compte et tout ce que tu as partagé (builds, routes, likes). Tape DELETE pour confirmer.',
    deleted: 'Ton compte a été supprimé.', since: 'Membre depuis le {d}', google2: 'Connecté avec Google', privacy: 'Règles de confidentialité',
  },
};
const tt = (k, v) => String((A[LANG] || A.en)[k] || A.en[k] || k).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] != null ? v[n] : m));
const call = async (method, url, body) => {
  const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status });
  return j;
};
document.title = `TLI Companion — ${tt('title')}`;

function signedOut(msg) {
  $('content').innerHTML = `<div class="pagehead"><h1>${esc(tt('title'))} <span class="soon">BETA</span></h1></div>
    ${msg ? `<div class="card acc-msg">${esc(msg)}</div>` : ''}
    <div class="card acc-in"><p>${esc(tt('intro'))}</p>
      <ul><li>${esc(tt('li1'))}</li><li>${esc(tt('li2'))}</li><li>${esc(tt('li3'))}</li></ul>
      <a class="btn primary big gbtn" href="/auth/google?next=/account"><span class="g">G</span>${esc(tt('signIn'))}</a>
      <p class="muted small" style="margin-top:12px"><a href="/privacy">${esc(tt('privacy'))}</a></p></div>`;
}

function list(rows, href, sub) {
  return rows.length ? `<div class="acc-list">${rows.map((r) => `<a href="${href(r)}"><b>${esc(r.title || '—')}</b><span class="muted">${esc(sub(r))}</span><span class="muted">♥ ${r.likes || 0}</span></a>`).join('')}</div>`
    : `<p class="muted">${esc(tt('none'))}</p>`;
}

async function signedIn(me, msg) {
  const [content, hs] = await Promise.all([call('GET', '/api/me/content'), heroes()]);
  const hero = hs.find((h) => h.key === me.avatar);
  const date = (ts) => new Date(ts).toLocaleDateString(LOCALE);
  $('content').innerHTML = `<div class="pagehead"><h1>${esc(tt('title'))} <span class="soon">BETA</span></h1></div>
    ${msg ? `<div class="card acc-msg">${esc(msg)}</div>` : ''}
    ${!me.named ? `<div class="card acc-msg">${esc(tt('welcome'))}</div>` : ''}
    <div class="card acc-prof">
      <div class="acc-top">${hero ? portrait(hero, 64) : '<span class="acc-noav">?</span>'}<div><div class="title">${esc(me.name)}</div>
        <div class="muted">${esc(tt('since', { d: date(me.createdAt) }))}${me.google ? ' · ' + esc(tt('google2')) : ''}</div></div></div>
      <h2>${esc(tt('profile'))}</h2>
      <label>${esc(tt('pseudo'))}<input id="aName" maxlength="24" value="${esc(me.name)}"></label>
      <label>${esc(tt('avatar'))}<select id="aAvatar"><option value="">${esc(tt('avatarNone'))}</option>${hs.map((h) => `<option value="${esc(h.key)}" ${h.key === me.avatar ? 'selected' : ''}>${esc(heroLabel(h))}</option>`).join('')}</select></label>
      <label>${esc(tt('bio'))}<textarea id="aBio" maxlength="300" placeholder="${esc(tt('bioPh'))}">${esc(me.bio)}</textarea></label>
      <div class="acc-row"><button class="btn primary" id="aSave">${esc(tt('save'))}</button><span id="aMsg" class="muted"></span></div>
    </div>
    <div class="cards">
      <div class="card"><h2>${esc(tt('myBuilds'))} <a class="btn" href="/planner" style="float:right;padding:4px 10px">${esc(tt('create'))}</a></h2>${list(content.builds, (r) => '/b/' + r.id, (r) => date(r.updated_at))}</div>
      <div class="card"><h2>${esc(tt('myRoutes'))}</h2>${list(content.reports, (r) => '/s/' + r.id, (r) => r.main_map || '')}</div>
      <div class="card"><h2>${esc(tt('likedBuilds'))}</h2>${list(content.likedBuilds, (r) => '/b/' + r.id, (r) => r.author)}</div>
      <div class="card"><h2>${esc(tt('likedRoutes'))}</h2>${list(content.likedReports, (r) => '/s/' + r.id, (r) => r.author)}</div>
    </div>
    <div class="acc-row" style="margin-top:8px"><button class="btn" id="aOut">${esc(tt('logout'))}</button><button class="btn danger" id="aDel">${esc(tt('del'))}</button></div>`;
  $('aSave').onclick = async () => {
    try { await call('PATCH', '/api/me', { name: $('aName').value, bio: $('aBio').value, avatar: $('aAvatar').value }); $('aMsg').textContent = tt('saved'); setTimeout(load, 600); }
    catch (e) { $('aMsg').textContent = e.message; }
  };
  $('aOut').onclick = async () => { await call('POST', '/api/auth/logout').catch(() => {}); location.href = '/account'; };
  $('aDel').onclick = async () => {
    if (prompt(tt('delConfirm')) !== 'DELETE') return;
    await call('DELETE', '/api/me', { confirm: 'DELETE' });
    signedOut(tt('deleted'));
  };
}

async function load() {
  const qs = new URLSearchParams(location.search);
  const err = qs.get('error');
  const msg = err ? tt(['unavailable', 'expired', 'cancelled', 'google'].includes(err) ? err : 'google') : qs.get('linked') === 'app' ? tt('linkedApp') : '';
  try { await signedIn(await call('GET', '/api/me'), msg); } catch (e) { if (e.status === 401 || e.status === 403) signedOut(msg); else $('content').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
load();
