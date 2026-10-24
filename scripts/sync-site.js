// Copie le planificateur de builds de l'app vers le site (server/public/p/) : le même code tourne des deux
// côtés, rien n'est réécrit à la main. À relancer avant chaque déploiement du site :  node scripts/sync-site.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'server', 'public', 'p');
fs.mkdirSync(out, { recursive: true });

const head = (src) => `/* Copié depuis ${src} par scripts/sync-site.js : ne pas modifier ici. */\n`;
for (const [src, dst] of [['src/i18n.js', 'i18n.js'], ['src/ui/tip.js', 'tip.js'], ['src/ui/talents.js', 'talents.js'], ['src/ui/planner.js', 'planner.js'], ['src/ui/social.js', 'social.js']]) {
  fs.writeFileSync(path.join(out, dst), head(src) + fs.readFileSync(path.join(root, src), 'utf8'));
}
// Styles du planificateur : la partie de app.css qui va du planificateur jusqu'au menu de l'app.
const css = fs.readFileSync(path.join(root, 'src', 'ui', 'app.css'), 'utf8');
const a = css.indexOf('/* ---------- Planificateur de builds');
const b = css.indexOf('/* Menu Builds (bêta)');
if (a < 0 || b < 0) throw new Error('repères introuvables dans app.css');
fs.writeFileSync(path.join(out, 'planner.css'), head('src/ui/app.css') + css.slice(a, b));
console.log('site : planificateur copié dans server/public/p/');
// Thème clair de l'app et du site (généré à partir des feuilles de style sombres).
require('./lighttheme');
