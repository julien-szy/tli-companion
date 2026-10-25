// Popup des gains : additionne les gains ramassés pendant 5 secondes et les affiche en « +X FE » doré.
// Chaque nouveau ramassage relance les 5 secondes et fait « rebondir » le chiffre ; ensuite il monte et s'efface.
const HOLD_MS = 5000;
const BIG_FE = 50; // un seul objet à 50 FE ou plus : affichage plus gros et plus brillant
let total = 0, timer = null, outTimer = null, big = false;
const el = document.getElementById('gain');

function show(value, isBig) {
  total += value;
  big = big || isBig;
  clearTimeout(timer); clearTimeout(outTimer);
  el.innerHTML = `+${fe(total)}<small>FE</small>`;
  el.className = 'gain show' + (big ? ' big' : '');
  void el.offsetWidth; // relance l'animation de rebond
  el.classList.add('bump');
  timer = setTimeout(() => {
    el.classList.add('out');
    outTimer = setTimeout(() => { total = 0; big = false; el.className = 'gain'; }, 1000);
  }, HOLD_MS);
}

tli.onGain((g) => { if (g && g.value > 0) show(g.value, g.value >= BIG_FE); });
// Couleur choisie -> variantes claire, sombre, contour et halo (mêmes effets quelle que soit la couleur).
function mix(hex, to, k) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255]; return '#' + c.map((v) => Math.round(v + (to - v) * k).toString(16).padStart(2, '0')).join(''); }
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
let lastStyle = '';
function applyStyle(p) {
  const c = /^#[0-9a-f]{6}$/i.test((p && p.color) || '') ? p.color : '#ffd447';
  const sz = Math.min(2, Math.max(0.6, +(p && p.size) || 1));
  const key = c + sz;
  if (key === lastStyle) return;
  lastStyle = key;
  const r = document.documentElement.style;
  r.setProperty('--c', c); r.setProperty('--c2', mix(c, 255, 0.55)); r.setProperty('--dk', mix(c, 0, 0.6)); r.setProperty('--ol', mix(c, 0, 0.88));
  r.setProperty('--halo', rgba(c, 0.55)); r.setProperty('--halo2', rgba(mix(c, 255, 0.3), 0.9)); r.setProperty('--s', String(sz));
}
tli.onState((s) => {
  setLang(s.settings.lang);
  applyStyle(s.settings.popup);
  const placing = !!(s.popupPlacing);
  document.body.classList.toggle('placing', placing);
  document.getElementById('placeTxt').textContent = t('pop.placeHelp');
});
document.getElementById('placeOk').onclick = () => tli.action('popupPlaced');
