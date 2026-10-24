// Page Prix : tous les prix de l'hôtel des ventes vus par les joueurs de TLI Companion, sans modification.
// Recherche, catégories, tri par colonne, courbe des 7 derniers jours et variations sur 24 h / 7 jours.
const CATS = ['materials', 'embers', 'compass', 'beacon', 'memory', 'organs', 'fate', 'divinity', 'prism', 'spices', 'gear', 'skills', 'other'];
let ITEMS = [], cat = '', sort = { key: 'price', dir: -1 }, q = '';
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
  $('rows').innerHTML = list.slice(0, 600).map((i, n) => `<tr>
      <td class="r muted">${n + 1}</td>
      <td class="pr-name">${i.img ? `<img src="${esc(i.img)}" alt="" loading="lazy">` : '<span class="pr-noimg"></span>'}<span>${esc(i.name)}</span></td>
      <td class="hide-sm muted">${esc(t('cat.' + i.cat))}</td>
      <td class="r"><b>${nfP(i.price)}</b></td>
      <td class="hide-sm">${spark(i.trend)}</td>
      <td class="r">${pctCell(i.d1)}</td><td class="r hide-sm">${pctCell(i.d7)}</td>
      <td class="r hide-sm ${i.players <= 1 ? 'muted' : ''}" ${i.players <= 1 ? `title="${esc(t('prFew'))}"` : ''}>${i.players}</td></tr>`).join('')
    || `<tr><td colspan="8" class="empty">${esc(t('prNone'))}</td></tr>`;
  document.querySelectorAll('th[data-sort]').forEach((th) => th.classList.toggle('sorted', th.dataset.sort === k));
  const counts = {}; for (const i of ITEMS) counts[i.cat] = (counts[i.cat] || 0) + 1;
  const used = CATS.filter((c) => counts[c]);
  $('cats').innerHTML = [`<button class="${!cat ? 'on' : ''}" data-cat=""><span>${esc(t('prAll'))}</span><b>${ITEMS.length}</b></button>`]
    .concat(used.map((c) => `<button class="${cat === c ? 'on' : ''}" data-cat="${c}"><span>${esc(t('cat.' + c))}</span><b>${counts[c]}</b></button>`)).join('');
  $('catSel').innerHTML = `<option value="">${esc(t('prAll'))} (${ITEMS.length})</option>` + used.map((c) => `<option value="${c}" ${cat === c ? 'selected' : ''}>${esc(t('cat.' + c))} (${counts[c]})</option>`).join('');
  document.querySelectorAll('#cats [data-cat]').forEach((b) => (b.onclick = () => { cat = b.dataset.cat; render(); }));
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
