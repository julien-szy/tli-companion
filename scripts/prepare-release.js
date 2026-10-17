// Prépare une version (sans rien publier) : node scripts/prepare-release.js 1.0.0
// - passe les notes « unreleased » de data/changelog.json dans une nouvelle version datée du jour ;
// - met à jour la version de package.json ;
// - copie le changelog pour la page Télécharger du site (server/public/changelog.json).
// Ensuite : npm run dist, puis release.ps1 et deploy.ps1 seulement quand la publication est décidée.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version || '')) { console.error('Usage : node scripts/prepare-release.js <x.y.z>'); process.exit(1); }

const logFile = path.join(root, 'data', 'changelog.json');
const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
if (log.releases.some((r) => r.version === version)) { console.error(`La version ${version} existe déjà dans le changelog.`); process.exit(1); }
const un = log.unreleased || { en: [], fr: [] };
if (!un.en.length) { console.error('Aucune note dans « unreleased » : ajoute la liste des modifications avant.'); process.exit(1); }
if (un.en.length !== un.fr.length) { console.error('Les notes EN et FR n’ont pas le même nombre de lignes.'); process.exit(1); }

const date = new Date().toISOString().slice(0, 10);
log.releases.unshift({ version, date, en: un.en, fr: un.fr });
log.unreleased = { en: [], fr: [] };
fs.writeFileSync(logFile, JSON.stringify(log, null, 2) + '\n');

const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
pkg.version = version;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');

// Copie publique : seulement les versions publiées.
const { unreleased: _u, ...pub } = log;
fs.writeFileSync(path.join(root, 'server', 'public', 'changelog.json'), JSON.stringify(pub, null, 2) + '\n');
console.log(`Version ${version} prête (${un.en.length} modification(s)). Rien n'est publié.`);
