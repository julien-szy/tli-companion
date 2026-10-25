// Page d'un objet : prix actuel, variations, courbe (médiane + bande plus bas / plus haut) sur 24 h, 7 j, 30 j ou tout,
// et les chiffres clés. Données : prix de l'hôtel des ventes vus par les joueurs de TLI Companion, sans modification.
const ITEM_ID = +location.pathname.split('/').pop();
let range = new URLSearchParams(location.search).get('range') || '7d';
$('back').textContent = '← ' + t('prBack');
$('loading').textContent = t('prLoading');
const nfP = (v) => (v == null ? '–' : v >= 100 ? v.toLocaleString(LOCALE, { maximumFractionDigits: 0 }) : v >= 1 ? v.toLocaleString(LOCALE, { maximumFractionDigits: 2 }) : v.toLocaleString(LOCALE, { maximumSignificantDigits: 3 }));
const pct = (v) => (v == null ? '<span class="muted">–</span>'
  : `<span class="${v > 0.005 ? 'pos' : v < -0.005 ? 'neg' : 'muted'}">${v > 0 ? '+' : ''}${(v * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%</span>`);
const RANGES = [['24h', 'pr24h'], ['7d', 'pr7d'], ['30d', 'pr30d'], ['all', 'prAll2']];

function chart(d) {
  const pts = d.points;
  if (!pts.length) return `<div class="empty">${esc(t('prNoHist'))}</div>`;
  const W = 900, H = 320, P = { l: 64, r: 16, t: 16, b: 30 };
  const spans = { '24h': 86400000, '7d': 7 * 86400000, '30d': 30 * 86400000, all: 120 * 86400000 };
  const now = Date.now();
  const from = d.range === 'all' ? Math.min(pts[0].t, now - 7 * 86400000) : now - spans[d.range];
  const lo = Math.min(...pts.map((p) => p.low)), hi = Math.max(...pts.map((p) => p.high));
  const pad = (hi - lo) * 0.08 || hi * 0.1 || 1, min = Math.max(0, lo - pad), max = hi + pad;
  const X = (ts) => P.l + ((ts - from) / (now - from)) * (W - P.l - P.r);
  const Y = (v) => H - P.b - ((v - min) / (max - min)) * (H - P.t - P.b);
  const grid = [0, 0.5, 1].map((f) => { const v = min + (max - min) * f;
    return `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="g"/><text x="${P.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${esc(nfP(v))}</text>`; }).join('');
  const fmt = d.range === '24h' ? { hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' };
  const ticks = [0, 0.5, 1].map((f) => { const ts = from + f * (now - from);
    return `<text x="${X(ts).toFixed(1)}" y="${H - 8}" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}">${esc(new Date(ts).toLocaleString(LOCALE, fmt))}</text>`; }).join('');
  const area = pts.length > 1 ? `<polygon class="area" points="${X(pts[0].t).toFixed(1)},${H - P.b} ${pts.map((p) => `${X(p.t).toFixed(1)},${Y(p.median).toFixed(1)}`).join(' ')} ${X(pts[pts.length - 1].t).toFixed(1)},${H - P.b}"/>` : '';
  const band = pts.length > 1 ? `<polygon class="band" points="${pts.map((p) => `${X(p.t).toFixed(1)},${Y(p.high).toFixed(1)}`).join(' ')} ${pts.slice().reverse().map((p) => `${X(p.t).toFixed(1)},${Y(p.low).toFixed(1)}`).join(' ')}"/>` : '';
  const line = pts.length > 1 ? `<polyline class="ln" points="${pts.map((p) => `${X(p.t).toFixed(1)},${Y(p.median).toFixed(1)}`).join(' ')}"/>` : '';
  const dots = pts.map((p) => `<g class="pt"><circle class="hit" cx="${X(p.t).toFixed(1)}" cy="${Y(p.median).toFixed(1)}" r="12"/><circle class="dot" cx="${X(p.t).toFixed(1)}" cy="${Y(p.median).toFixed(1)}" r="4"/><title>${esc(new Date(p.t).toLocaleString(LOCALE, d.range === '24h' || d.range === '7d' ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short' }))}
${esc(t('prMedian'))} ${esc(nfP(p.median))} FE · ${esc(t('prRangeLH', { lo: nfP(p.low), hi: nfP(p.high) }))}
${esc(t('prObs', { n: p.n, players: p.players }))}</title></g>`).join('');
  return `<svg class="pi-svg" viewBox="0 0 ${W} ${H}">${grid}${ticks}${band}${area}${line}${dots}</svg>
    <div class="pi-legend muted small"><span><i class="lg-ln"></i>${esc(t('prMedian'))}</span><span><i class="lg-band"></i>${esc(t('prBand'))}</span></div>`;
}

async function load() {
  let d;
  try { d = await api(`/api/prices/item/${ITEM_ID}?range=${range}`); } catch (e) { $('content').innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  if (!d.name) { $('content').innerHTML = `<div class="empty">${esc(t('prUnknown'))}</div>`; return; }
  document.title = `${d.name} — ${t('navPrices')} — TLI Companion`;
  const s = d.stats;
  const span = (k, x) => `<div><span>${esc(t(k))}</span><b>${x.low != null ? `${nfP(x.low)} <i>→</i> ${nfP(x.high)}` : '–'}</b></div>`;
  $('content').innerHTML = `
    <div class="card pi-card">
      <div class="pi-top">
        <div class="pi-id">${d.img ? `<img src="${esc(d.img)}" alt="">` : '<span class="pr-noimg"></span>'}
          <div><h1>${esc(d.name)}</h1><span class="muted">${esc(t('cat.' + d.cat))}</span></div></div>
        <div class="pi-price"><b>${nfP(d.price)}<small> FE</small></b><div>${esc(t('prD1'))} ${pct(d.d1)} <span class="sep">·</span> ${esc(t('prD7'))} ${pct(d.d7)}</div></div>
      </div>
      <div class="pi-range">${RANGES.map(([k, l]) => `<button class="${range === k ? 'on' : ''}" data-r="${k}">${esc(t(l))}</button>`).join('')}</div>
      ${chart(d)}
    </div>
    <div class="card pi-strip">
      ${span('prSpan24', s.h24)}${span('prSpan7', s.d7)}${span('prSpanAll', s.all)}
      <div><span>${esc(t('prAvgPlayers'))}</span><b>${s.avgPlayers || '–'}</b></div>
      <div><span>${esc(t('prLastUpdate'))}</span><b>${d.updatedAt ? esc(new Date(d.updatedAt).toLocaleString(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : '–'}</b></div>
    </div>
    <p class="muted small">${esc(t('prChartHelp'))}</p>`;
  document.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => {
    range = b.dataset.r;
    history.replaceState(null, '', `?range=${range}`);
    load();
  }));
}
load();
