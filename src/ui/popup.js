// Popup des gains : additionne les gains ramassés pendant quelques secondes (réglable, 5 s par défaut) et les
// affiche en « +X FE ». Chaque ramassage relance le délai et fait « rebondir » le chiffre ; ensuite il monte et s'efface.
// Option « arrivée des gains » : chaque objet apparaît en petit (« +3 ») à un endroit au hasard, vole jusqu'au
// chiffre principal, et le total monte en défilant à son arrivée.
const BIG_FE = 50; // un seul objet à 50 FE ou plus : affichage plus gros et plus brillant
const RAINBOW_FE = 100; // total affiché à partir duquel le texte passe en arc-en-ciel (option)
const FLY_MS = 650; // durée du vol d'un petit gain jusqu'au total
const MAX_FLYING = 30; // au-delà (gros ramassage d'un coup), les gains arrivent directement
let holdMs = 5000, flyOn = true;
let total = 0, shown = 0, timer = null, outTimer = null, big = false, rainbowOn = true, countRaf = null, flying = 0;
const el = document.getElementById('gain');
const fx = document.getElementById('fx');

function render() {
  el.innerHTML = `+${fe(shown)}<small>FE</small>`;
  el.className = 'gain show' + (big ? ' big' : '') + (rainbowOn && shown >= RAINBOW_FE ? ' rainbow' : '');
  void el.offsetWidth; // relance l'animation de rebond
  el.classList.add('bump');
}
// Le total affiché rejoint le vrai total en défilant (≈ 250 ms).
function countTo() {
  cancelAnimationFrame(countRaf);
  const from = shown, to = total, t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 250);
    shown = from + (to - from) * k;
    render();
    if (k < 1) countRaf = requestAnimationFrame(step);
  };
  countRaf = requestAnimationFrame(step);
}
function holdThenFade() {
  clearTimeout(timer); clearTimeout(outTimer);
  timer = setTimeout(() => {
    if (flying) return holdThenFade(); // des gains sont encore en vol
    el.classList.add('out');
    outTimer = setTimeout(() => { total = 0; shown = 0; big = false; el.className = 'gain'; }, 1000);
  }, holdMs);
}
function add(value, isBig) {
  if (el.classList.contains('out')) { clearTimeout(outTimer); total = 0; shown = 0; big = false; }
  total += value;
  big = big || isBig;
  if (flyOn) countTo(); else { shown = total; render(); }
  holdThenFade();
}
// Petit « +X » qui part d'un point au hasard autour du total et vole jusqu'à lui.
function fly(value, isBig) {
  const p = document.createElement('div');
  p.className = 'part' + (isBig ? ' big' : '');
  p.textContent = `+${fe(value)}`;
  const W = innerWidth, H = innerHeight, a = Math.random() * Math.PI * 2;
  const rx = W * (0.32 + Math.random() * 0.14), ry = H * (0.3 + Math.random() * 0.15);
  p.style.left = `${W / 2 + Math.cos(a) * rx}px`; p.style.top = `${H / 2 + Math.sin(a) * ry}px`;
  fx.appendChild(p);
  flying++;
  holdThenFade(); // le total reste affiché pendant le vol
  requestAnimationFrame(() => requestAnimationFrame(() => { p.style.left = `${W / 2}px`; p.style.top = `${H / 2}px`; p.classList.add('go'); }));
  setTimeout(() => { p.remove(); flying--; add(value, isBig); }, FLY_MS);
}
function show(value, isBig) {
  if (!el.classList.contains('show') || el.classList.contains('out')) { if (!flying) { total = 0; shown = 0; big = false; } }
  if (flyOn && flying < MAX_FLYING) {
    fly(value, isBig);
  } else add(value, isBig);
}

tli.onGain((g) => { if (g && g.value > 0) show(g.value, g.value >= BIG_FE); });
// Couleur choisie -> variantes claire, sombre, contour et halo (mêmes effets quelle que soit la couleur).
function mix(hex, to, k) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255]; return '#' + c.map((v) => Math.round(v + (to - v) * k).toString(16).padStart(2, '0')).join(''); }
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
let lastStyle = '';
function applyStyle(p) {
  const c = /^#[0-9a-f]{6}$/i.test((p && p.color) || '') ? p.color : '#ffd447';
  const sz = Math.min(2, Math.max(0.3, +(p && p.size) || 1));
  const g = Math.min(1, Math.max(0, p && p.glow != null ? +p.glow : 1));
  rainbowOn = !(p && p.rainbow === false);
  holdMs = Math.min(15, Math.max(1, +(p && p.hold) || 5)) * 1000;
  flyOn = !(p && p.fly === false);
  const key = c + sz + '|' + g;
  if (key === lastStyle) return;
  lastStyle = key;
  const r = document.documentElement.style;
  r.setProperty('--c', c); r.setProperty('--c2', mix(c, 255, 0.55)); r.setProperty('--dk', mix(c, 0, 0.6)); r.setProperty('--ol', mix(c, 0, 0.88));
  // Halo réglable : 0 = seulement le contour, 1 = lueur complète.
  r.setProperty('--halo', rgba(c, 0.55 * g)); r.setProperty('--halo2', rgba(mix(c, 255, 0.3), 0.9 * g)); r.setProperty('--s', String(sz)); r.setProperty('--g', String(g));
}
tli.onState((s) => {
  setLang(s.settings.lang);
  applyStyle(s.settings.popup);
  const placing = !!(s.popupPlacing);
  const was = document.body.classList.contains('placing');
  document.body.classList.toggle('placing', placing);
  // Pendant le placement : un exemple fixe pour voir la taille ; ensuite on revient à l'affichage normal.
  if (placing && !was) { clearTimeout(timer); clearTimeout(outTimer); total = 0; big = false; el.innerHTML = `+${fe(12.3)}<small>FE</small>`; el.className = 'gain show'; }
  if (!placing && was) { total = 0; big = false; el.className = 'gain'; }
  document.getElementById('placeTxt').textContent = t('pop.placeHelp');
});
document.getElementById('placeOk').onclick = () => tli.action('popupPlaced');
// Entrée ou Échap : valide la position (la fenêtre a le focus pendant le placement).
document.addEventListener('keydown', (e) => { if (document.body.classList.contains('placing') && (e.key === 'Enter' || e.key === 'Escape')) tli.action('popupPlaced'); });
