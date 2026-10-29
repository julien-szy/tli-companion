// Notes de version au format Discord (salon #changelog), à copier-coller : une version = un message
// (anglais puis français), coupé en plusieurs messages si besoin (limite Discord : 2000 caractères).
//   node scripts/discord-changelog.js            -> dernière version
//   node scripts/discord-changelog.js 1.1.4      -> une version
//   node scripts/discord-changelog.js --all      -> toutes, de la plus ancienne à la plus récente
// Écrit aussi dist/discord-changelog.md (messages séparés par une ligne ─────).
const fs = require('fs');
const path = require('path');

const MAX = 1900; // marge sous la limite de 2000
const root = path.join(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'changelog.json'), 'utf8'));
const releases = data.releases || data.versions || [];

const arg = process.argv[2];
let list;
if (!arg) list = releases.slice(0, 1);
else if (arg === '--all') list = releases.slice().reverse();
else list = releases.filter((r) => r.version === arg);
if (!list.length) {
  console.error(`Version inconnue : ${arg}`);
  process.exit(1);
}

const bullets = (xs) => (xs || []).map((x) => `• ${x}`);
// Une version -> un ou plusieurs messages de moins de MAX caractères.
function posts(r) {
  const head = `## 🔥 TLI Companion ${r.version}${r.date ? ` · ${r.date}` : ''}`;
  const parts = [head, '**🇬🇧 English**', ...bullets(r.en), '', '**🇫🇷 Français**', ...bullets(r.fr), '',
    '⬇️ <https://tlicompanion.com/download> (the app updates by itself / l’app se met à jour toute seule)'];
  const out = [];
  let cur = '';
  for (const line of parts) {
    if (cur && (cur + '\n' + line).length > MAX) {
      out.push(cur);
      cur = `${head} (suite)\n${line}`;
    } else cur = cur ? `${cur}\n${line}` : line;
  }
  if (cur) out.push(cur);
  return out;
}

const all = list.flatMap(posts);
const SEP = '\n\n─────────────\n\n';
const outFile = path.join(root, 'dist', 'discord-changelog.md');
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, all.join(SEP) + '\n');
console.log(all.join(SEP));
console.error(`\n${list.length} version(s), ${all.length} message(s) -> ${path.relative(root, outFile)}`);
