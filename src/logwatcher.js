// Trouve UE_game.log et le lit en continu (comme `tail -f`), en gérant la rotation du log.
const fs = require('fs');
const path = require('path');

const LOG_REL = path.join('UE_game', 'TorchLight', 'Saved', 'Logs', 'UE_game.log');
const BOOTSTRAP_BYTES = 300 * 1024 * 1024; // historique relu au démarrage (état du sac + prix)
const CHUNK = 4 * 1024 * 1024;

// Dossiers Steam : emplacements habituels + celui indiqué dans le registre (Steam installé sur un autre disque).
function steamRoots() {
  const roots = new Set(['C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam']);
  try {
    const out = require('child_process').execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
    const m = /SteamPath\s+REG_SZ\s+(.+)/.exec(out);
    if (m) roots.add(path.normalize(m[1].trim()));
  } catch { /* pas de Steam */ }
  return [...roots];
}
function steamLibraries() {
  const libs = new Set();
  for (const r of steamRoots()) {
    libs.add(r);
    try {
      const vdf = fs.readFileSync(path.join(r, 'steamapps', 'libraryfolders.vdf'), 'utf8');
      for (const m of vdf.matchAll(/"path"\s+"([^"]+)"/g)) libs.add(m[1].replace(/\\\\/g, '\\'));
    } catch { /* pas de bibliothèque ici */ }
  }
  return [...libs];
}

const isDir = (p) => { try { return fs.statSync(p).isDirectory(); } catch { return false; } };
const isFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
const list = (p) => { try { return fs.readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(p, d.name)); } catch { return []; } };

// Dossiers d'installation possibles du jeu (Steam, launcher officiel, Epic, dossiers de jeux sur tous les disques).
let gameDirsCache = null;
function gameDirs() {
  if (gameDirsCache && Date.now() - gameDirsCache.at < 60000) return gameDirsCache.dirs;
  const dirs = new Set();
  for (const lib of steamLibraries()) dirs.add(path.join(lib, 'steamapps', 'common', 'Torchlight Infinite'));
  const drives = 'CDEFGHIJ'.split('').map((d) => d + ':\\').filter(isDir);
  const parents = ['', 'Program Files', 'Program Files (x86)', 'Games', 'Jeux', 'Epic Games', 'XD', 'XDGames', 'SteamLibrary\\steamapps\\common', 'Steam\\steamapps\\common'];
  const torch = /torch\s*light/i;
  for (const d of drives) {
    for (const p of parents) {
      for (const sub of list(path.join(d, p))) {
        if (torch.test(path.basename(sub))) { dirs.add(sub); for (const sub2 of list(sub)) dirs.add(sub2); }
        // Un niveau de plus pour les launchers (ex. « XD\Torchlight Infinite »).
        else if (/^(xd|xdgames|epic games|launcher|games)$/i.test(path.basename(sub))) for (const sub2 of list(sub)) if (torch.test(path.basename(sub2))) dirs.add(sub2);
      }
    }
  }
  const found = [...dirs].filter((x) => isDir(path.join(x, 'UE_game')));
  gameDirsCache = { at: Date.now(), dirs: found };
  return found;
}

// Dossier du jeu choisi à la main : on accepte le dossier du jeu, un dossier au-dessus (launcher : le jeu est
// dans un sous-dossier) ou n'importe quel dossier à l'intérieur (dans UE_game).
function resolveGameDir(p) {
  if (!p) return null;
  if (isDir(path.join(p, 'UE_game'))) return p;
  const parts = path.resolve(p).split(path.sep);
  const i = parts.findIndex((x) => x.toLowerCase() === 'ue_game');
  if (i > 0) return parts.slice(0, i).join(path.sep) || null;
  for (const sub of list(p)) {
    if (isDir(path.join(sub, 'UE_game'))) return sub;
    for (const sub2 of list(sub)) if (isDir(path.join(sub2, 'UE_game'))) return sub2;
  }
  return null;
}

function findLogPath(custom, gameDir) {
  const candidates = [];
  if (custom) candidates.push(custom, path.join(custom, 'UE_game.log'), path.join(custom, LOG_REL));
  if (gameDir) candidates.push(path.join(gameDir, LOG_REL));
  for (const g of gameDirs()) candidates.push(path.join(g, LOG_REL));
  return candidates.find(isFile) || null;
}
// Jeu trouvé mais pas de log : « Enable Log » n'est pas activé (ou le jeu n'a pas encore été relancé).
function findGameDir(chosen) {
  return (chosen && isDir(path.join(chosen, 'UE_game')) ? chosen : null) || gameDirs()[0] || null;
}
function expectedLogDir(gameDir) { return path.join(gameDir, path.dirname(LOG_REL)); }

class LogWatcher {
  constructor(file, onLine) {
    this.file = file;
    this.onLine = onLine;
    this.pos = 0;
    this.leftover = '';
    this.timer = null;
    this.busy = false;
    this.onRotate = null;
  }

  // Relit la fin du fichier sans compter les variations, puis passe en direct.
  // holdBackBytes > 0 (simulation) : les derniers octets seront rejoués comme du direct.
  async bootstrap(onProgress, holdBackBytes = 0) {
    const size = Math.max(0, (await fs.promises.stat(this.file)).size - holdBackBytes);
    const start = Math.max(0, size - BOOTSTRAP_BYTES);
    const fh = await fs.promises.open(this.file, 'r');
    try {
      const buf = Buffer.alloc(CHUNK);
      let pos = start;
      let first = start > 0; // la première ligne est probablement coupée
      while (pos < size) {
        const { bytesRead } = await fh.read(buf, 0, Math.min(CHUNK, size - pos), pos);
        if (!bytesRead) break;
        pos += bytesRead;
        let text = this.leftover + buf.toString('utf8', 0, bytesRead);
        const lines = text.split('\n');
        this.leftover = lines.pop();
        if (first) { lines.shift(); first = false; }
        for (const l of lines) this.onLine(l.replace(/\r$/, ''));
        if (onProgress) onProgress((pos - start) / (size - start));
        await new Promise((r) => setImmediate(r));
      }
      this.pos = pos;
    } finally {
      await fh.close();
    }
  }

  start(intervalMs = 400) {
    this.timer = setInterval(() => this._poll(), intervalMs);
  }
  stop() { clearInterval(this.timer); }

  async _poll() {
    if (this.busy) return;
    this.busy = true;
    try {
      const { size } = await fs.promises.stat(this.file);
      if (size < this.pos) {
        // Le jeu a redémarré et recréé le log.
        this.pos = 0;
        this.leftover = '';
        if (this.onRotate) this.onRotate();
      }
      if (size > this.pos) {
        const fh = await fs.promises.open(this.file, 'r');
        try {
          while (this.pos < size) {
            const len = Math.min(CHUNK, size - this.pos);
            const buf = Buffer.alloc(len);
            const { bytesRead } = await fh.read(buf, 0, len, this.pos);
            if (!bytesRead) break;
            this.pos += bytesRead;
            const lines = (this.leftover + buf.toString('utf8', 0, bytesRead)).split('\n');
            this.leftover = lines.pop();
            for (const l of lines) this.onLine(l.replace(/\r$/, ''));
          }
        } finally {
          await fh.close();
        }
      }
    } catch { /* fichier momentanément verrouillé ou absent */ }
    this.busy = false;
  }
}

module.exports = { findGameDir, expectedLogDir, LogWatcher, findLogPath, resolveGameDir };
