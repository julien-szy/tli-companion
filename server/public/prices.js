// Page Prix : tous les prix de l'hôtel des ventes vus par les joueurs de TLI Companion, sans modification.
// Recherche, catégories, tri par colonne, courbe des 7 derniers jours et variations sur 24 h / 7 jours.
const CATS = ['materials', 'embers', 'compass', 'beacon', 'memory', 'organs', 'fate', 'divinity', 'prism', 'spices', 'gear', 'skills', 'other'];
let ITEMS = [], cat = '', sort = { key: 'price', dir: -1 }, q = '';
let openId = null, openDays = 30; // ligne ouverte (détail sous la ligne, comme poe.ninja)
const histCache = {};
document.title = `TLI Companion — ${t('navPrices')}`;
const nfP = (v) => (v >= 100 ? v.toLocaleString(LOCALE, { maximumFractionDigits: 0 }) : v >= 1 ? v.toLocaleString(LOCALE, { maximumFractionDigits: 2 }) : v.toLocaleString(LOCALE, { maximumSignificantDigits: 3 }));
const pctCell = (v) => (v == null ? '<span class="muted">–</span>'
  : `<span class="${v > 0.005 ? 'pos' : v < -0.005 ? 'neg' : 'muted'}">${v > 0 ? '+' : ''}${(v * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 })}%</span>`);
function spark(tr) {
  const pts = tr.map((v, i) => [i, v]).filter(([, v]) => v != null);
  if (pts.length < 2) return '<span class="muted">–</span>';
  const vs = pts.map(([, v]) => v), lo = Math.min(...vs), hi = Math.max(...vs), W = 84, H = 24;
  const x = (i) => (i / 7) * (W - 4) + 2, y = (v) => (hi === lo ? H / 2 : H - 3 - ((v - lo) / (hi - lo)) * (H - 6));
  const up = vs[vs.length - 1] >= vs[0];
  return `<svg class="pr-spark ${up ? 'up' : 'down'}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${pts.map(([i, v]) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/></svg>`;
}
function render() {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let list = ITEMS.filter((i) => (!cat || i.cat === cat) && words.every((w) => i.name.toLowerCase().includes(w)));
  const k = sort.key;
  list = list.slice().sort((a, b) => {
    const va = k === 'cat' ? t('cat.' + a.cat) : a[k], vb = k === 'cat' ? t('cat.' + b.cat) : b[k];
    if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1;
    return (typeof va === 'string' ? va.localeCompare(vb) : va - vb) * sort.dir;
  });
  $('count').textContent = t('prItems', { n: list.length.toLocaleString(LOCALE) });
  $('rows').innerHTML = list.slice(0, 600).map((i, n) => `<tr class="pr-row${openId === i.id ? ' open' : ''}" data-id="${i.id}">
      <td class="r muted">${n + 1}</td>
      <td><span class="pr-name">${i.img ? `<img src="${esc(i.img)}" alt="" loading="lazy">` : '<span class="pr-noimg"></span>'}<span>${esc(i.name)}</span></span></td>
      <td class="hide-sm muted">${esc(t('cat.' + i.cat))}</td>
      <td class="r"><b>${nfP(i.price)}</b></td>
      <td class="hide-sm">${spark(i.trend)}</td>
      <td class="r">${pctCell(i.d1)}</td><td class="r hide-sm">${pctCell(i.d7)}</td>
      <td class="r hide-sm ${i.players <= 1 ? 'muted' : ''}" ${i.players <= 1 ? `title="${esc(t('prFew'))}"` : ''}>${i.players}</td></tr>
`).join('')
    || `<tr><td colspan="8" class="empty">${esc(t('prNone'))}</td></tr>`;
  document.querySelectorAll('th[data-sort]').forEach((th) => th.classList.toggle('sorted', th.dataset.sort === k));
  const counts = {}; for (const i of ITEMS) counts[i.cat] = (counts[i.cat] || 0) + 1;
  const used = CATS.filter((c) => counts[c]);
  $('cats').innerHTML = [`<button class="${!cat ? 'on' : ''}" data-cat=""><span>${esc(t('prAll'))}</span><b>${ITEMS.length}</b></button>`]
    .concat(used.map((c) => `<button class="${cat === c ? 'on' : ''}" data-cat="${c}"><span>${esc(t('cat.' + c))}</span><b>${counts[c]}</b></button>`)).join('');
  $('catSel').innerHTML = `<option value="">${esc(t('prAll'))} (${ITEMS.length})</option>` + used.map((c) => `<option value="${c}" ${cat === c ? 'selected' : ''}>${esc(t('cat.' + c))} (${counts[c]})</option>`).join('');
  document.querySelectorAll('#cats [data-cat]').forEach((b) => (b.onclick = () => { cat = b.dataset.cat; render(); }));
  document.querySelectorAll('#rows tr.pr-row').forEach((tr) => (tr.onclick = (e) => {
    const url = `/prices/${tr.dataset.id}`;
    if (e.ctrlKey || e.metaKey || e.button === 1) window.open(url, '_blank'); else location.href = url;
  }));
  if (openId != null && $('prDetail')) detail(ITEMS.find((i) => i.id === openId));
}

// Détail d'un objet : prix, plus bas / plus haut, joueurs, et courbe du prix médian par jour (7 / 30 / 90 jours).
async function detail(item) {
  const box = $('prDetail');
  if (!box || !item) return;
  const key = `${item.id}|${openDays}`;
  if (!histCache[key]) {
    box.innerHTML = `<p class="muted">${esc(t('prLoading'))}</p>`;
    try { histCache[key] = await api(`/api/prices/history/${item.id}?days=${openDays}`); } catch (e) { box.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
    if (openId !== item.id || !$('prDetail')) return;
  }
  const pts = (histCache[key].points || []).map((p) => ({ ts: Date.parse(p.day + 'T12:00:00Z'), v: p.median, low: p.low, n: p.n, players: p.players }));
  const vals = pts.map((p) => p.v);
  const lo = vals.length ? Math.min(...vals) : null, hi = vals.length ? Math.max(...vals) : null;
  const ago = (ts) => { const h = (Date.now() - ts) / 3600000; return h < 1 ? t('prAgoMin', { n: Math.max(1, Math.round(h * 60)) }) : h < 48 ? t('prAgoH', { n: Math.round(h) }) : t('prAgoD', { n: Math.round(h / 24) }); };
  const W = 640, H = 200, P = { l: 52, r: 12, t: 12, b: 24 };
  const now = Date.now(), from = now - openDays * 86400000;
  const max = (hi || 1) * 1.1, min = Math.max(0, (lo || 0) * 0.9);
  const X = (ts) => P.l + ((ts - from) / (now - from)) * (W - P.l - P.r);
  const Y = (v) => H - P.b - ((v - min) / (max - min || 1)) * (H - P.t - P.b);
  const grid = [0, 0.5, 1].map((f) => { const v = min + (max - min) * f; return `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${P.l - 6}" y="${Y(v) + 4}" text-anchor="end">${esc(nfP(v))}</text>`; }).join('');
  const dates = [0, 0.5, 1].map((f) => { const ts = from + f * (now - from); return `<text x="${X(ts)}" y="${H - 6}" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}">${esc(new Date(ts).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }))}</text>`; }).join('');
  const line = pts.length > 1 ? `<polyline class="ln" points="${pts.map((p) => `${X(p.ts).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')}"/>` : '';
  const dots = pts.map((p) => `<circle cx="${X(p.ts).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="3.5"><title>${esc(new Date(p.ts).toLocaleDateString(LOCALE))} · ${esc(nfP(p.v))} FE · ${esc(t('prObs', { n: p.n, players: p.players }))}</title></circle>`).join('');
  box.innerHTML = `
    <div class="pr-dstats">
      <div><span>${esc(t('prPrice'))}</span><b>${nfP(item.price)}</b></div>
      <div><span>${esc(t('prLow', { n: openDays }))}</span><b>${lo != null ? nfP(lo) : '–'}</b></div>
      <div><span>${esc(t('prHigh', { n: openDays }))}</span><b>${hi != null ? nfP(hi) : '–'}</b></div>
      <div><span>${esc(t('prD1'))} / ${esc(t('prD7'))}</span><b>${pctCell(item.d1)} · ${pctCell(item.d7)}</b></div>
      <div><span>${esc(t('prPlayers'))}</span><b>${item.players}</b></div>
      <div><span>${esc(t('prLastSeen'))}</span><b>${item.ts ? esc(ago(item.ts)) : '–'}</b></div>
    </div>
    <div class="pr-dchart">
      <div class="pr-drange">${[7, 30, 90].map((d) => `<button class="${openDays === d ? 'on' : ''}" data-days="${d}">${esc(t('prDays', { n: d }))}</button>`).join('')}</div>
      ${pts.length ? `<svg viewBox="0 0 ${W} ${H}" class="pr-chart">${grid}${dates}${line}${dots}</svg>` : `<p class="muted">${esc(t('prNoHist'))}</p>`}
      <p class="muted small">${esc(t('prChartHelp'))}</p>
    </div>`;
  box.querySelectorAll('[data-days]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openDays = +b.dataset.days; detail(item); }));
  box.onclick = (e) => e.stopPropagation();
}
$('q').oninput = (e) => { q = e.target.value; render(); };
$('catSel').onchange = (e) => { cat = e.target.value; render(); };
document.querySelectorAll('th[data-sort]').forEach((th) => (th.onclick = () => {
  const k = th.dataset.sort;
  sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: k === 'name' || k === 'cat' ? 1 : -1 };
  render();
}));
$('rows').innerHTML = `<tr><td colspan="8" class="empty">${esc(t('prLoading'))}</td></tr>`;
$('how').textContent = t('prHow');
$('q').placeholder = t('prSearch');
api('/api/prices/table').then((d) => {
  ITEMS = d.items || [];
  $('how').textContent = `${t('prHow')} ${t('prUpdated', { t: new Date(d.updatedAt).toLocaleString(LOCALE, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) })}`;
  render();
}).catch((e) => { $('rows').innerHTML = `<tr><td colspan="8" class="empty">${esc(e.message)}</td></tr>`; });
