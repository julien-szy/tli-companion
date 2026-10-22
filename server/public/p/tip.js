/* Copié depuis src/ui/tip.js par scripts/sync-site.js : ne pas modifier ici. */
// Infobulles façon jeu, pour tout le planificateur : un élément porte data-tt (JSON) et la fiche suit la souris.
// { t: titre, s: sous-titre, i: icône, l: [lignes de stats], g: [tags], k: 'leg' | 'rare' | 'skill' | 'trait' | 'talent' | 'core' }
// Tip.show(html) sert aussi aux fiches complètes (équipement).
const Tip = (() => {
  let el = null;
  const box = () => {
    if (!el) { el = document.createElement('div'); el.className = 'gtip'; el.hidden = true; document.body.appendChild(el); }
    return el;
  };
  const attr = (o) => `data-tt="${esc(JSON.stringify(o))}"`;
  function card(o) {
    return `<div class="gt k-${esc(o.k || 'talent')}"><div class="gt-h">${o.i ? `<img class="gt-ic" src="${esc(o.i)}" alt="" onerror="this.remove()">` : ''}<div><b>${esc(o.t || '')}</b>${o.s ? `<small>${esc(o.s)}</small>` : ''}</div></div>
      ${o.g && o.g.length ? `<div class="gt-tags">${o.g.map((x) => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
      ${o.l && o.l.length ? `<div class="gt-aff">${o.l.map((x) => `<div>${esc(x)}</div>`).join('')}</div>` : ''}</div>`;
  }
  function move(e) {
    if (!el || el.hidden) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = (e.clientX + 16 + w > window.innerWidth ? Math.max(8, e.clientX - w - 12) : e.clientX + 16) + 'px';
    el.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, e.clientY + 12)) + 'px';
  }
  function show(html, e) { const b = box(); b.innerHTML = html; b.hidden = false; if (e) move(e); }
  function hide() { if (el) el.hidden = true; }
  document.addEventListener('mouseover', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[data-tt]') : null;
    if (!t) return;
    try { show(card(JSON.parse(t.dataset.tt)), e); } catch { /* infobulle illisible : rien */ }
  });
  document.addEventListener('mouseout', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('[data-tt]') : null;
    if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) hide();
  });
  document.addEventListener('mousemove', move);
  document.addEventListener('mousedown', hide);
  return { attr, card, show, move, hide };
})();
