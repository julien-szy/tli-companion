// Formatage et traduction partagés entre le widget et le tableau de bord.
let LANG = null;
let LOCALE = 'en-US';
let t = I18N.make('en');
let nf0, nf1, nf3;

// Change la langue (et le format des nombres). Renvoie true si elle a changé.
function setLang(lang) {
  lang = I18N.LANGS[lang] ? lang : 'en';
  if (lang === LANG) return false;
  LANG = lang;
  LOCALE = I18N.LOCALES[lang];
  t = I18N.make(lang);
  nf0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
  nf1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 });
  nf3 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 3 });
  document.documentElement.lang = lang;
  I18N.apply(document, t);
  return true;
}
setLang('en');

function fe(v, signed = false) {
  if (v == null || isNaN(v)) return '–';
  const s = Math.abs(v) >= 100 ? nf0.format(v) : nf1.format(v);
  return signed && v > 0 ? '+' + s : s;
}
function unit(v) { return v ? nf3.format(v) : '–'; }
function qty(q) { return (q > 0 ? '+' : '') + nf0.format(q); }
function dur(ms) {
  if (!ms || ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
function clock(ts) { return new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
// Nom de carte compact : « Thunder Wastes Beacon (Timemark 8) » devient « Thunder Wastes » + pastille T8.
function mapLabel(name) {
  const m = /^(.*?)\s*Beacon\s*\(Timemark\s*(\d+)\)(.*)$/i.exec(name || '');
  if (m) return `${esc(m[1])}<span class="tm">T${m[2]}</span>${esc(m[3])}`;
  if (/tartarus/i.test(name || '')) return `${esc(name)}<span class="tm boss">Boss</span>`;
  return esc(name || '');
}
function dayLabel(ts) {
  const d = new Date(ts), today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (diff === 0) return t('day.today');
  if (diff === 1) return t('day.yesterday');
  return d.toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
}
function timeOnly(ts) { return new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }); }
function dateTime(ts) { return new Date(ts).toLocaleString(LOCALE); }
function cls(v) { return v > 0.05 ? 'pos' : v < -0.05 ? 'neg' : 'zero'; }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function icon(img) { return img ? `<img class="ico" src="${esc(img)}" loading="lazy">` : '<span class="ico"></span>'; }
function srcLabel(s) { return t('src.' + s); }
// « hideout » est la zone hors carte ; le reste est un nom de carte.
function zoneLabel(z) { return z === 'hideout' ? t('zone.hideout') : z; }
// Message d'erreur IPC lisible.
function errMsg(e) { return String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); }
// Icône introuvable : on la masque (les attributs onerror inline sont bloqués par la CSP).
document.addEventListener('error', (e) => { if (e.target.tagName === 'IMG') e.target.style.visibility = 'hidden'; }, true);

// Encart « Bientôt disponible » (fonction en travaux), avec une icône de chantier.
function comingSoon(title, text, small = false) {
  return `<div class="soon-box${small ? ' small' : ''}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20M5 20l3-12h8l3 12"/><path d="M6.5 14h11M7.6 10h8.8"/><path d="M12 2v3M9 4l1 2M15 4l-1 2"/></svg>
    <span class="soon-badge">${esc(t('soon.badge'))}</span>
    <h2>${esc(title)}</h2>
    ${text ? `<p>${esc(text)}</p>` : ''}
  </div>`;
}

// ---------- Alerte de stock : petit son (1 bip à 10, 2 à 5, 3 plus aigus pour le dernier) ----------
function stockBeep(level, vol = 1) {
  if (vol <= 0) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const n = level <= 1 ? 3 : level <= 5 ? 2 : 1;
    const freq = level <= 1 ? 1046 : 880;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.22;
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.25 * vol), t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + 0.2);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch { /* pas de son disponible */ }
}
const stockText = (a) => a.text || (a.qty <= 0 ? t('stock.empty', { name: a.name }) : a.qty <= 1 ? t('stock.last', { name: a.name }) : t('stock.left', { n: a.qty, name: a.name }));

// Infobulle du coût des cartes : « 12 × Balise = 240 FE » par ligne.
function costTip(list) {
  if (!list || !list.length) return t('cost.tipNone');
  return [t('cost.tipTitle'), ...list.map((i) => `${nf0.format(i.qty)} × ${i.name} = ${fe(i.value)} FE`)].join('\n');
}

// ---------- Sons Tartarus, bien distincts des bips de stock ----------
// 36 : carillon montant (do-mi-sol-do), « c'est prêt ».
// 48 : sirène à deux tons répétée, « c'est plein, vas-y ».
function tartarusSound(kind, vol = 1) {
  if (vol <= 0) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const level = vol;
    const note = (freq, start, len, type, v) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const t0 = ctx.currentTime + start;
      o.type = type; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * level), t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
      o.connect(g).connect(ctx.destination);
      o.start(t0); o.stop(t0 + len + 0.02);
    };
    let end;
    if (kind === 'tartarus-full') {
      for (let i = 0; i < 4; i++) {
        note(988, i * 0.36, 0.16, 'square', 0.07);
        note(740, i * 0.36 + 0.18, 0.16, 'square', 0.07);
      }
      end = 1.6;
    } else {
      [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.11, i === 3 ? 0.7 : 0.25, 'triangle', 0.22));
      end = 1.2;
    }
    setTimeout(() => ctx.close(), end * 1000 + 300);
  } catch { /* pas de son disponible */ }
}
// Son d'une alerte : Tartarus ou stock.
// Son d'une alerte : vrai son (Windows ou fichier du joueur), sinon les sons synthétiques.
let playing = null;
async function alertSound(a) {
  const spec = a.soundSpec || 'synth';
  // Volume réglé pour ce son dans les Réglages (0 = muet).
  const vol = a.volume == null ? 1 : Math.min(1, Math.max(0, +a.volume));
  if (vol <= 0) return;
  if (spec !== 'synth') {
    const url = await tli.soundData(spec);
    if (url) {
      try {
        if (playing) playing.pause();
        const au = new Audio(url);
        au.volume = 0.9 * vol;
        playing = au;
        await au.play();
        // Les alarmes de Windows sont longues : on coupe en douceur après 5 s.
        setTimeout(() => { const fade = setInterval(() => { au.volume = Math.max(0, au.volume - 0.1); if (au.volume <= 0) { au.pause(); clearInterval(fade); } }, 60); }, 5000);
        return;
      } catch { /* lecture impossible : son synthétique */ }
    }
  }
  if (a.kind === 'star-full') tartarusSound('tartarus-ready', vol); // son de secours si la voix ne se lit pas
  else if (a.kind && a.kind.startsWith('tartarus')) tartarusSound(a.kind, vol);
  else stockBeep(a.level, vol);
}
