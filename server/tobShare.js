// Partage des builds du TOB (planner /builds/) : lien court tlicompanion.com/b/<id> qui ouvre le build dans le
// TOB, et lecture publique du build complet au format ouvert « tlicompanion-build » (API /api/public/v1/builds/<id>,
// utilisée par d'autres outils comme TLI Builder). Sans compte : le navigateur qui partage garde une clé secrète
// (on n'en garde que l'empreinte) pour mettre à jour ou retirer son partage. Seul le build est stocké : pas de
// compte, pas d'identifiant du jeu, pas d'adresse IP.
const crypto = require('crypto');

const ID_RE = /^[A-Za-z0-9]{8}$/;
const MAX_CODE = 60000;
const MAX_JSON = 300 * 1024;

module.exports = function ({ db, route, readJson, rateLimit, clientIp, sha256, HttpError }) {
  db.exec(`CREATE TABLE IF NOT EXISTS tob_shares (
    id          TEXT PRIMARY KEY,
    key_hash    TEXT NOT NULL,
    name        TEXT NOT NULL,
    code        TEXT NOT NULL,
    json        TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  )`);

  const newId = () => {
    const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    for (;;) {
      const b = crypto.randomBytes(8);
      const id = [...b].map((x) => A[x % A.length]).join('');
      if (!db.prepare('SELECT 1 FROM tob_shares WHERE id = ?').get(id)) return id;
    }
  };
  const originOk = (req) => {
    const o = String(req.headers.origin || '');
    return o === 'https://tlicompanion.com' || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o);
  };

  // Garde seulement des données simples (objets, listes, textes courts, nombres) : le JSON est servi tel quel.
  function clean(v, depth = 0) {
    if (depth > 8) return null;
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') return v.slice(0, 600);
    if (Array.isArray(v)) return v.slice(0, 400).map((x) => clean(x, depth + 1));
    if (typeof v === 'object') {
      const out = {};
      for (const [k, x] of Object.entries(v).slice(0, 80)) if (/^[A-Za-z0-9_]{1,40}$/.test(k)) out[k] = clean(x, depth + 1);
      return out;
    }
    return null;
  }
  function checkBody(b) {
    const code = String(b.code || '');
    if (!code || code.length > MAX_CODE || !/^[A-Za-z0-9_-]+$/.test(code)) throw new HttpError(400, 'invalid build code');
    const build = clean(b.build);
    if (!build || build.format !== 'tlicompanion-build' || build.version !== 1) throw new HttpError(400, 'invalid build');
    const json = JSON.stringify(build);
    if (json.length > MAX_JSON) throw new HttpError(413, 'build too large');
    const name = String(b.name || build.name || 'Build').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Build';
    build.name = name;
    return { code, json: JSON.stringify(build), name };
  }

  // Partager (ou mettre à jour son partage avec { id, key }).
  route('POST', /^\/api\/tob\/share$/, async (req) => {
    if (!originOk(req)) throw new HttpError(403, 'bad origin');
    rateLimit('tobshare:' + clientIp(req), 30, 3600000);
    const b = await readJson(req, MAX_JSON + MAX_CODE + 4096);
    const { code, json, name } = checkBody(b);
    const now = Date.now();
    if (b.id || b.key) {
      const row = ID_RE.test(String(b.id)) && db.prepare('SELECT key_hash FROM tob_shares WHERE id = ?').get(b.id);
      if (row && row.key_hash === sha256('tobshare:' + String(b.key || ''))) {
        db.prepare('UPDATE tob_shares SET name = ?, code = ?, json = ?, updated_at = ? WHERE id = ?').run(name, code, json, now, b.id);
        return { id: b.id, key: b.key, url: `/b/${b.id}`, updated: true };
      }
      // Partage introuvable ou clé fausse : on en crée un nouveau.
    }
    const id = newId();
    const key = crypto.randomBytes(18).toString('base64url');
    db.prepare('INSERT INTO tob_shares (id, key_hash, name, code, json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, sha256('tobshare:' + key), name, code, json, now, now);
    return { id, key, url: `/b/${id}`, updated: false };
  });

  // Retirer son partage.
  route('POST', /^\/api\/tob\/share\/([A-Za-z0-9]{8})\/delete$/, async (req, url, m) => {
    if (!originOk(req)) throw new HttpError(403, 'bad origin');
    const b = await readJson(req, 4096);
    const r = db.prepare('DELETE FROM tob_shares WHERE id = ? AND key_hash = ?').run(m[1], sha256('tobshare:' + String(b.key || '')));
    if (!r.changes) throw new HttpError(404, 'share not found');
    return { deleted: true };
  });

  return {
    isShareId: (id) => ID_RE.test(id),
    get(id) {
      if (!ID_RE.test(id)) return null;
      return db.prepare('SELECT id, name, code, json, created_at, updated_at FROM tob_shares WHERE id = ?').get(id) || null;
    },
  };
};
