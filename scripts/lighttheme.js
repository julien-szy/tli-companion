// Thème clair : génère une version claire de chaque feuille de style à partir de la version sombre.
// Les fonds sombres deviennent clairs (en gardant la hiérarchie fond / panneau / bordure), les textes clairs
// deviennent foncés, les couleurs vives (orange, vert, rouge) restent, les textes pastel sont foncés pour rester
// lisibles. Les ombres (box-shadow, text-shadow) ne changent pas. Lancé par scripts/sync-site.js.
// Usage : node scripts/lighttheme.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const FILES = [
  ['src/ui/app.css', 'src/ui/app.light.css'],
  ['server/public/style.css', 'server/public/style.light.css'],
  ['server/public/p/planner.css', 'server/public/p/planner.light.css'],
];

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb(h, s, l) {
  if (!s) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255));
}
// Nouvelle luminosité selon le rôle probable de la couleur.
function remap([h, s, l]) {
  // Fonds sombres -> fond gris clair et panneaux blancs ; bordures et survols -> gris moyens.
  if (l <= 0.14) return [h, Math.min(s, 0.3), Math.min(1, 0.945 + (l - 0.04) * 0.55)];
  if (l < 0.36) return [h, Math.min(s, 0.3), 0.93 - (l - 0.14) * 0.75];
  if (s < 0.28) return [h, s, Math.max(0.08, 1 - l)];                       // gris : textes clairs -> foncés
  if (l > 0.74) return [h, s, Math.max(0.3, l - 0.38)];                     // textes pastel -> foncés lisibles
  return [h, s, l];                                                        // couleurs vives : inchangées
}
const hex2 = (n) => n.toString(16).padStart(2, '0');
// Textes foncés posés sur un bouton coloré (orange, jaune, vert) : ils restent foncés.
const KEEP = new Set(['#1a1006', '#1a1406', '#1a1208', '#06140b', '#08170e', '#06101a', '#5a2a00']);
function convert(r, g, b) { return hslToRgb(...remap(rgbToHsl(r, g, b))); }

function transformValue(v) {
  v = v.replace(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g, (m, hx) => {
    if (KEEP.has(m.toLowerCase())) return m; // texte foncé sur bouton coloré : reste foncé
    const full = hx.length === 3 ? hx.split('').map((c) => c + c).join('') : hx;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    return '#' + convert(r, g, b).map(hex2).join('');
  });
  v = v.replace(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)/g, (m, r, g, b, a) => {
    const [h, s, l] = rgbToHsl(+r, +g, +b);
    // Voiles blancs (survol, séparateurs) -> voiles noirs ; voiles sombres (fonds translucides) -> clairs.
    let out;
    if (l > 0.9 && s < 0.2) out = [0, 0, 0];
    else out = convert(+r, +g, +b);
    return a ? `rgba(${out.join(',')}${a})` : `rgb(${out.join(',')})`;
  });
  return v;
}

function transformCss(css) {
  // Déclaration par déclaration : on garde les ombres telles quelles.
  return css.replace(/([\w-]+)\s*:\s*([^;{}]+)(;|(?=}))/g, (m, prop, val, end) => {
    if (/^(box-shadow|text-shadow|filter|backdrop-filter)$/i.test(prop)) return m;
    if (!/#[0-9a-fA-F]{3}|rgba?\(/.test(val)) return m;
    return `${prop}: ${transformValue(val)}${end}`;
  });
}

for (const [src, dst] of FILES) {
  const css = fs.readFileSync(path.join(root, src), 'utf8');
  const out = `/* Généré par scripts/lighttheme.js à partir de ${path.basename(src)} : ne pas modifier à la main. */\n` + transformCss(css)
    // Fonds avec dégradé sombre en haut de page : plus discret en clair.
    + '\nhtml { color-scheme: light; }\n';
  fs.writeFileSync(path.join(root, dst), out);
  console.log('thème clair :', dst);
}
