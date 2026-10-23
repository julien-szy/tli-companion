// Votes et commentaires (bêta) sur les builds et les routes de farm.
// - Vote : +1 (j'aime), -1 (je n'aime pas) ou 0 (retirer), un par compte, pas sur son propre contenu.
//   Les likes déjà donnés (tables likes / build_likes) comptent comme des +1.
// - Commentaires : texte seul (affiché échappé), 2 à 1000 caractères, un niveau de réponses.
//   L'auteur modifie ou supprime le sien ; l'auteur du build / de la route peut supprimer ceux de sa page.
const crypto = require('crypto');

const KINDS = {
  build: { table: 'builds', votes: 'build_likes', col: 'build_id' },
  report: { table: 'reports', votes: 'likes', col: 'report_id' },
};

module.exports = function setupSocial({ db, route, HttpError, rateLimit, readJson, Accounts }) {
  const kindOf = (k) => { const x = KINDS[k]; if (!x) throw new HttpError(400, 'invalid kind'); return x; };
  const idOk = (id) => typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id);
  function target(kind, id) {
    const k = kindOf(kind);
    if (!idOk(id)) throw new HttpError(400, 'invalid id');
    const row = db.prepare(`SELECT user_id FROM ${k.table} WHERE id = ?`).get(id);
    if (!row) throw new HttpError(404, 'not found');
    return { ...k, owner: row.user_id };
  }

  // ---------- Votes ----------
  function counts(k, id) {
    const likes = db.prepare(`SELECT COUNT(*) AS n FROM ${k.votes} WHERE ${k.col} = ? AND value = 1`).get(id).n;
    const dislikes = db.prepare(`SELECT COUNT(*) AS n FROM ${k.votes} WHERE ${k.col} = ? AND value = -1`).get(id).n;
    db.prepare(`UPDATE ${k.table} SET likes = ?, dislikes = ? WHERE id = ?`).run(likes, dislikes, id);
    return { likes, dislikes };
  }
  // Vote du visiteur (connecté) sur un contenu, pour l'afficher sur la page.
  function myVote(req, kind, id) {
    const u = Accounts.authOptional(req);
    if (!u) return 0;
    const k = KINDS[kind];
    const r = db.prepare(`SELECT value FROM ${k.votes} WHERE ${k.col} = ? AND user_id = ?`).get(id, u.id);
    return r ? r.value : 0;
  }
  route('POST', /^\/api\/votes$/, async (req) => {
    const u = Accounts.auth(req);
    rateLimit('vote:' + u.id, 200, 3600000);
    const b = await readJson(req);
    const t = target(b.kind, b.id);
    if (t.owner === u.id) throw new HttpError(400, 'you cannot vote on your own content');
    const value = b.value === 1 || b.value === -1 ? b.value : 0;
    if (value) db.prepare(`INSERT INTO ${t.votes} (user_id, ${t.col}, value) VALUES (?, ?, ?) ON CONFLICT DO UPDATE SET value = excluded.value`).run(u.id, b.id, value);
    else db.prepare(`DELETE FROM ${t.votes} WHERE user_id = ? AND ${t.col} = ?`).run(u.id, b.id);
    return { ...counts(t, b.id), mine: value };
  });
  route('GET', /^\/api\/votes$/, (req, url) => {
    const kind = url.searchParams.get('kind');
    const id = url.searchParams.get('id');
    const t = target(kind, id);
    const row = db.prepare(`SELECT likes, dislikes FROM ${t.table} WHERE id = ?`).get(id);
    return { likes: row.likes, dislikes: row.dislikes, mine: myVote(req, kind, id) };
  });

  // ---------- Commentaires ----------
  function cleanBody(s) {
    s = String(s || '').normalize('NFKC').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
    if (s.length < 2) throw new HttpError(400, 'comment too short');
    if (s.length > 1000) throw new HttpError(400, 'comment too long (1000 characters max)');
    return s;
  }
  route('GET', /^\/api\/comments$/, (req, url) => {
    const kind = url.searchParams.get('kind');
    const id = url.searchParams.get('id');
    const t = target(kind, id);
    const me = Accounts.authOptional(req);
    const rows = db.prepare(`SELECT c.id, c.parent_id, c.body, c.created_at, c.edited_at, c.deleted, c.user_id, u.name, u.avatar
      FROM comments c JOIN users u ON u.id = c.user_id WHERE c.kind = ? AND c.target_id = ? AND u.banned = 0 ORDER BY c.created_at ASC LIMIT 500`).all(kind, id);
    return {
      comments: rows.map((c) => ({
        id: c.id, parentId: c.parent_id, createdAt: c.created_at, editedAt: c.edited_at,
        deleted: !!c.deleted, body: c.deleted ? '' : c.body,
        author: c.deleted ? null : { name: c.name, avatar: c.avatar, isOwner: c.user_id === t.owner },
        mine: !!me && me.id === c.user_id, canDelete: !!me && !c.deleted && (me.id === c.user_id || me.id === t.owner),
      })),
      signedIn: !!me,
    };
  });
  route('POST', /^\/api\/comments$/, async (req) => {
    const u = Accounts.auth(req);
    rateLimit('comment-h:' + u.id, 20, 3600000);
    rateLimit('comment-d:' + u.id, 100, 86400000);
    const b = await readJson(req);
    target(b.kind, b.id);
    const body = cleanBody(b.body);
    // Réponse : rattachée au commentaire de premier niveau (un seul niveau de réponses).
    let parent = null;
    if (b.parentId) {
      const p = db.prepare('SELECT id, parent_id FROM comments WHERE id = ? AND kind = ? AND target_id = ?').get(String(b.parentId), b.kind, b.id);
      if (!p) throw new HttpError(404, 'comment not found');
      parent = p.parent_id || p.id;
    }
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO comments (id, kind, target_id, user_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, b.kind, b.id, u.id, parent, body, Date.now());
    return { id };
  });
  route('PATCH', /^\/api\/comments\/([0-9a-f-]{36})$/, async (req, url, m) => {
    const u = Accounts.auth(req);
    rateLimit('comment-e:' + u.id, 60, 3600000);
    const c = db.prepare('SELECT user_id, deleted FROM comments WHERE id = ?').get(m[1]);
    if (!c || c.deleted) throw new HttpError(404, 'comment not found');
    if (c.user_id !== u.id) throw new HttpError(403, 'not your comment');
    const body = cleanBody((await readJson(req)).body);
    db.prepare('UPDATE comments SET body = ?, edited_at = ? WHERE id = ?').run(body, Date.now(), m[1]);
    return { ok: true };
  });
  route('DELETE', /^\/api\/comments\/([0-9a-f-]{36})$/, (req, url, m) => {
    const u = Accounts.auth(req);
    const c = db.prepare('SELECT id, kind, target_id, user_id FROM comments WHERE id = ?').get(m[1]);
    if (!c) throw new HttpError(404, 'comment not found');
    const t = target(c.kind, c.target_id);
    if (c.user_id !== u.id && t.owner !== u.id) throw new HttpError(403, 'not allowed');
    // Avec des réponses : on garde la place (« commentaire supprimé ») pour que le fil reste lisible.
    const replies = db.prepare('SELECT COUNT(*) AS n FROM comments WHERE parent_id = ?').get(c.id).n;
    if (replies) db.prepare("UPDATE comments SET deleted = 1, body = '' WHERE id = ?").run(c.id);
    else db.prepare('DELETE FROM comments WHERE id = ?').run(c.id);
    return { ok: true };
  });

  return { myVote, counts };
};
