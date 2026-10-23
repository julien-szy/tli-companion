// Comptes (bêta) : connexion avec Google sur le site et dans l'app, profil modifiable, raccourcis vers son
// contenu, suppression du compte. Seul l'identifiant Google (« sub ») est gardé : ni email ni vrai nom
// (on ne demande que le niveau d'accès « openid »). Les clés Google sont lues dans DATA_DIR/auth.local.json :
//   { "googleClientId": "…", "googleClientSecret": "…" }
// Sans ce fichier, la connexion Google est simplement indisponible ; le reste du serveur marche pareil.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const COOKIE = 'tlic_s';
const WEB_DAYS = 60;
const APP_DAYS = 365;
const ORIGINS = new Set(['https://tlicompanion.com', 'http://127.0.0.1:8099', 'http://localhost:8099']);

module.exports = function setupAccounts({ db, route, HttpError, sha256, clientIp, rateLimit, readJson, DATA_DIR }) {
  const cfg = (() => { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'auth.local.json'), 'utf8')); } catch { return {}; } })();
  const googleOn = !!(cfg.googleClientId && cfg.googleClientSecret);
  const newToken = () => crypto.randomBytes(32).toString('base64url');

  // ---------- Qui fait la requête : jeton de l'app (Bearer) ou cookie du site ----------
  function cookies(req) {
    const out = {};
    for (const part of String(req.headers.cookie || '').split(';')) {
      const i = part.indexOf('=');
      if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    return out;
  }
  function userFromSession(token, kinds) {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(token || '')) return null;
    const s = db.prepare('SELECT user_id, kind, expires_at FROM sessions WHERE token_hash = ?').get(sha256(token));
    if (!s || !kinds.includes(s.kind) || s.expires_at < Date.now()) return null;
    return db.prepare('SELECT id, name, banned FROM users WHERE id = ?').get(s.user_id) || null;
  }
  function auth(req) {
    const h = req.headers.authorization || '';
    const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(h);
    let user = null;
    if (m) {
      user = db.prepare('SELECT id, name, banned FROM users WHERE token_hash = ?').get(sha256(m[1])) || userFromSession(m[1], ['app']);
      if (!user) throw new HttpError(401, 'unknown token');
    } else {
      user = userFromSession(cookies(req)[COOKIE], ['web']);
      if (!user) throw new HttpError(401, 'login required');
      // Cookie : une requête qui modifie quelque chose doit venir du site lui-même.
      if (req.method !== 'GET' && !ORIGINS.has(String(req.headers.origin || ''))) throw new HttpError(403, 'bad origin');
    }
    if (user.banned) throw new HttpError(403, 'account suspended');
    return user;
  }
  const authOptional = (req) => { try { return auth(req); } catch { return null; } };

  function newSession(userId, kind) {
    const token = newToken();
    const days = kind === 'web' ? WEB_DAYS : APP_DAYS;
    db.prepare('INSERT INTO sessions (token_hash, user_id, kind, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(sha256(token), userId, kind, Date.now(), Date.now() + days * 86400000);
    return token;
  }
  setInterval(() => db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now()), 3600000).unref();

  // ---------- Comptes : création, rattachement, fusion ----------
  function createGoogleUser(sub) {
    const id = crypto.randomUUID();
    const name = 'Player-' + id.slice(0, 4).toUpperCase();
    db.prepare('INSERT INTO users (id, name, token_hash, created_at, google_sub, named) VALUES (?, ?, ?, ?, ?, 0)')
      .run(id, name, sha256(newToken()), Date.now(), sub); // jeton inutilisable : ce compte se connecte par Google
    return id;
  }
  // Déplace tout le contenu d'un ancien pseudo (app) vers le compte Google, puis supprime l'ancien pseudo.
  // Compteurs de likes recalculés après une fusion ou une suppression (rare).
  function recountLikes() {
    db.prepare('UPDATE reports SET likes = (SELECT COUNT(*) FROM likes WHERE likes.report_id = reports.id AND value = 1), dislikes = (SELECT COUNT(*) FROM likes WHERE likes.report_id = reports.id AND value = -1)').run();
    db.prepare('UPDATE builds SET likes = (SELECT COUNT(*) FROM build_likes WHERE build_likes.build_id = builds.id AND value = 1), dislikes = (SELECT COUNT(*) FROM build_likes WHERE build_likes.build_id = builds.id AND value = -1)').run();
  }
  function mergeUsers(fromId, toId) {
    if (fromId === toId) return;
    db.exec('BEGIN');
    try {
      for (const t of ['reports', 'builds', 'sessions', 'comments']) db.prepare(`UPDATE ${t} SET user_id = ? WHERE user_id = ?`).run(toId, fromId);
      db.prepare('UPDATE OR IGNORE likes SET user_id = ? WHERE user_id = ?').run(toId, fromId);
      db.prepare('UPDATE OR IGNORE build_likes SET user_id = ? WHERE user_id = ?').run(toId, fromId);
      db.prepare('UPDATE OR IGNORE hero_names SET user_id = ? WHERE user_id = ?').run(toId, fromId);
      for (const t of ['likes', 'build_likes', 'hero_names']) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(fromId);
      db.prepare('DELETE FROM users WHERE id = ?').run(fromId);
      recountLikes();
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }
  // Compte Google pour ce « sub » : l'ancien pseudo de l'app est rattaché (ou fusionné) s'il y en a un.
  function userForGoogle(sub, appUserId) {
    const existing = db.prepare('SELECT id FROM users WHERE google_sub = ?').get(sub);
    if (existing) { if (appUserId) mergeUsers(appUserId, existing.id); return existing.id; }
    if (appUserId) {
      const u = db.prepare('SELECT id, google_sub FROM users WHERE id = ?').get(appUserId);
      if (u && !u.google_sub) { db.prepare('UPDATE users SET google_sub = ? WHERE id = ?').run(sub, u.id); return u.id; }
    }
    return createGoogleUser(sub);
  }

  // ---------- Connexion Google (OAuth « code », niveau d'accès openid seulement) ----------
  const states = new Map();   // state -> { kind, appCode, next, at }
  const appCodes = new Map(); // code -> { userId (ancien pseudo de l'app), token, at }
  setInterval(() => {
    const old = Date.now() - 15 * 60000;
    for (const [k, v] of states) if (v.at < old) states.delete(k);
    for (const [k, v] of appCodes) if (v.at < old) appCodes.delete(k);
  }, 60000).unref();
  const baseUrl = (req) => {
    const host = String(req.headers.host || '');
    if (/^(127\.0\.0\.1|localhost):8099$/.test(host)) return `http://${host}`;
    return 'https://tlicompanion.com';
  };
  const safeNext = (n) => (typeof n === 'string' && /^\/[\w\-/?=&.%]*$/.test(n) && !n.startsWith('//') ? n : '/account');

  // Pages /auth/… (redirections, pas de JSON). Renvoie true si la requête a été traitée.
  async function handlePage(req, res, url) {
    const redirect = (to, headers = {}) => { res.writeHead(302, { Location: to, 'Cache-Control': 'no-store', ...headers }); res.end(); return true; };
    if (url.pathname === '/auth/google') {
      if (!googleOn) return redirect('/account?error=unavailable');
      const kind = url.searchParams.get('app') ? 'app' : 'web';
      const appCode = url.searchParams.get('app');
      if (kind === 'app' && !appCodes.has(appCode)) return redirect('/account?error=expired');
      const state = newToken();
      states.set(state, { kind, appCode, next: safeNext(url.searchParams.get('next')), at: Date.now() });
      const q = new URLSearchParams({
        client_id: cfg.googleClientId, redirect_uri: baseUrl(req) + '/auth/google/callback', response_type: 'code',
        scope: 'openid', state, prompt: 'select_account',
      });
      return redirect('https://accounts.google.com/o/oauth2/v2/auth?' + q);
    }
    if (url.pathname === '/auth/google/callback') {
      const st = states.get(url.searchParams.get('state') || '');
      states.delete(url.searchParams.get('state') || '');
      if (!st) return redirect('/account?error=expired');
      if (url.searchParams.get('error') || !url.searchParams.get('code')) return redirect('/account?error=cancelled');
      let sub;
      try {
        const r = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15000),
          body: new URLSearchParams({ code: url.searchParams.get('code'), client_id: cfg.googleClientId, client_secret: cfg.googleClientSecret,
            redirect_uri: baseUrl(req) + '/auth/google/callback', grant_type: 'authorization_code' }),
        });
        const j = await r.json();
        if (!r.ok || !j.id_token) throw new Error('token');
        // Jeton reçu directement de Google (HTTPS) : on vérifie l'émetteur, le destinataire et l'expiration.
        const p = JSON.parse(Buffer.from(j.id_token.split('.')[1], 'base64url').toString('utf8'));
        if (!['https://accounts.google.com', 'accounts.google.com'].includes(p.iss) || p.aud !== cfg.googleClientId || p.exp * 1000 < Date.now() || !p.sub) throw new Error('claims');
        sub = String(p.sub);
      } catch { return redirect('/account?error=google'); }
      if (st.kind === 'app') {
        const ac = appCodes.get(st.appCode);
        if (!ac) return redirect('/account?error=expired');
        const userId = userForGoogle(sub, ac.userId);
        ac.token = newSession(userId, 'app');
        ac.userId = userId;
        // Connecté aussi sur le site, pour retrouver tout de suite son compte.
        const web = newSession(userId, 'web');
        return redirect('/account?linked=app', { 'Set-Cookie': cookie(req, web, WEB_DAYS) });
      }
      const userId = userForGoogle(sub, null);
      const web = newSession(userId, 'web');
      return redirect(st.next, { 'Set-Cookie': cookie(req, web, WEB_DAYS) });
    }
    return false;
  }
  const cookie = (req, token, days) => `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}${baseUrl(req).startsWith('https') ? '; Secure' : ''}`;

  // ---------- API ----------
  route('GET', /^\/api\/auth\/status$/, () => ({ google: googleOn }));

  // L'app demande un code de connexion, ouvre le navigateur, puis interroge jusqu'à recevoir son jeton.
  route('POST', /^\/api\/auth\/app\/start$/, (req) => {
    rateLimit('applogin:' + clientIp(req), 20, 3600000);
    if (!googleOn) throw new HttpError(503, 'Google sign-in is not available yet');
    const old = (() => { try { return auth(req); } catch { return null; } })();
    const code = newToken();
    appCodes.set(code, { userId: old ? old.id : null, token: null, at: Date.now() });
    return { code, url: `/auth/google?app=${encodeURIComponent(code)}` };
  });
  route('GET', /^\/api\/auth\/app\/poll$/, (req, url) => {
    const code = url.searchParams.get('code') || '';
    const ac = appCodes.get(code);
    if (!ac) throw new HttpError(410, 'expired');
    if (!ac.token) return { pending: true };
    appCodes.delete(code);
    const u = db.prepare('SELECT id, name, named FROM users WHERE id = ?').get(ac.userId);
    return { token: ac.token, userId: u.id, name: u.name, named: !!u.named };
  });
  route('POST', /^\/api\/auth\/logout$/, (req) => {
    const h = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(req.headers.authorization || '');
    const token = h ? h[1] : cookies(req)[COOKIE];
    if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ? AND kind IN ('web', 'app')").run(sha256(token));
    return { ok: true, __cookie: `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` };
  });

  function profile(id) {
    const u = db.prepare('SELECT id, name, avatar, bio, google_sub, named, supporter, created_at FROM users WHERE id = ?').get(id);
    return { userId: u.id, name: u.name, avatar: u.avatar || null, bio: u.bio || '', google: !!u.google_sub, named: !!u.named, supporter: !!u.supporter, createdAt: u.created_at };
  }
  route('GET', /^\/api\/me$/, (req) => profile(auth(req).id));
  route('PATCH', /^\/api\/me$/, async (req) => {
    const u = auth(req);
    const b = await readJson(req);
    if (b.name !== undefined) {
      const name = String(b.name || '').normalize('NFKC').replace(/[\u0000-\u001f<>]/g, '').trim();
      if (name.length < 2 || name.length > 24) throw new HttpError(400, 'username: 2 to 24 characters');
      db.prepare('UPDATE users SET name = ?, named = 1 WHERE id = ?').run(name, u.id);
    }
    if (b.bio !== undefined) db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(String(b.bio || '').replace(/[\u0000-\u0008\u000b-\u001f<>]/g, '').slice(0, 300), u.id);
    if (b.avatar !== undefined) db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(/^[a-z0-9_-]{1,40}$/.test(b.avatar || '') ? b.avatar : null, u.id);
    return profile(u.id);
  });
  // Raccourcis du compte : mes builds, mes routes, ce que j'ai aimé.
  route('GET', /^\/api\/me\/content$/, (req) => {
    const u = auth(req);
    return {
      builds: db.prepare('SELECT id, title, hero_key, likes, updated_at FROM builds WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200').all(u.id),
      reports: db.prepare('SELECT id, title, main_map, region, timemark, likes, created_at FROM reports WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').all(u.id),
      likedBuilds: db.prepare(`SELECT b.id, b.title, b.hero_key, b.likes, b.updated_at, w.name AS author FROM build_likes l JOIN builds b ON b.id = l.build_id
        JOIN users w ON w.id = b.user_id WHERE l.user_id = ? AND l.value = 1 ORDER BY b.updated_at DESC LIMIT 200`).all(u.id),
      likedReports: db.prepare(`SELECT r.id, r.title, r.main_map, r.likes, r.created_at, w.name AS author FROM likes l JOIN reports r ON r.id = l.report_id
        JOIN users w ON w.id = r.user_id WHERE l.user_id = ? AND l.value = 1 ORDER BY r.created_at DESC LIMIT 200`).all(u.id),
    };
  });
  // Supprimer son compte et tout ce qu'il a partagé.
  route('DELETE', /^\/api\/me$/, async (req) => {
    const u = auth(req);
    const b = await readJson(req);
    if (b.confirm !== 'DELETE') throw new HttpError(400, 'confirmation missing');
    db.exec('BEGIN');
    try {
      // Ses commentaires : ceux qui ont des réponses restent en « supprimé », les autres partent.
      db.prepare("UPDATE comments SET deleted = 1, body = '' WHERE user_id = ? AND id IN (SELECT parent_id FROM comments WHERE parent_id IS NOT NULL)").run(u.id);
      db.prepare('DELETE FROM comments WHERE user_id = ? AND deleted = 0').run(u.id);
      for (const t of ['likes', 'build_likes', 'hero_names', 'reports', 'builds', 'sessions']) db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).run(u.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(u.id);
      recountLikes();
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    return { deleted: true, __cookie: `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` };
  });

  return { auth, authOptional, handlePage, googleOn, userForGoogle };
};
