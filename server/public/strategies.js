// Stratégies de farm : les plus rentables au cours actuel + toutes les sessions partagées, avec filtres.
const FILTERS = ['hero', 'region', 'tier', 'tag', 'item', 'server', 'big', 'sort'];
const TAGS = ['mapping', 'boss', 'netherrealm', 'dream', 'vorax', 'overrealm', 'sandlord', 'clockwork', 'blacksail', 'deepspace', 'leveling', 'other'];
const params = new URLSearchParams(location.search);
FILTERS.forEach((k) => { if (params.get(k)) $(k).dataset.want = params.get(k); });
document.title = `TLI Companion — ${t('pageTitle')}`;
$('rows').innerHTML = `<tr><td colspan="9" class="empty">${esc(t('loading'))}</td></tr>`;
const tagName = (k) => (k ? t('tag_' + k) : '');
const mapLabel = (region, tier) => `${region || '?'}${tier ? ` · T${tier}` : ''}`;

// Classes : numéro du jeu -> « Héros — Trait » (même correspondance que la page Méta).
let HERO_LIST = [], HERO_MAP = {};
const heroName = (id, fallback) => {
  const h = HERO_LIST.find((x) => x.gameId === +id) || (HERO_MAP[id] ? HERO_LIST.find((x) => x.key === HERO_MAP[id].key) : null);
  return h ? heroLabel(h) : fallback || t('unknownClass', { id });
};
async function loadFilters() {
  const [s, list, hm] = await Promise.all([api('/api/stats'), heroes().catch(() => []), api('/api/heromap').catch(() => ({ map: {} }))]);
  HERO_LIST = list || []; HERO_MAP = hm.map || {};
  const heroName = (h) => { const x = list.find((y) => y.gameId === h.hero_id); return x ? heroLabel(x) : h.name; };
  $('totals').textContent = t('totals', { reports: s.totals.reports, players: s.totals.players });
  const add = (id, html) => $(id).insertAdjacentHTML('beforeend', html);
  add('hero', s.heroes.map((h) => `<option value="${h.hero_id}">${esc(heroName(h))} (${h.n})</option>`).join(''));
  add('region', s.regions.map((r) => `<option value="${esc(r.region)}">${esc(r.region)} (${r.n})</option>`).join(''));
  add('tier', s.tiers.map((r) => `<option value="${r.timemark}">${esc(t('timemarkN', { n: r.timemark }))} (${r.n})</option>`).join(''));
  const tagCount = Object.fromEntries(s.tags.map((x) => [x.tag, x.n]));
  add('tag', TAGS.map((k) => `<option value="${k}">${esc(tagName(k))}${tagCount[k] ? ` (${tagCount[k]})` : ''}</option>`).join(''));
  add('item', s.items.map((i) => `<option value="${i.id}">${esc(i.name)} (${i.n})</option>`).join(''));
  add('server', s.servers.map((x) => `<option value="${esc(x.server)}">${esc(x.server)} (${x.n})</option>`).join(''));
  FILTERS.forEach((k) => { if ($(k).dataset.want) $(k).value = $(k).dataset.want; });
}

function query() {
  const q = new URLSearchParams();
  FILTERS.forEach((k) => { if ($(k).value) q.set(k, $(k).value); });
  return q;
}

async function load() {
  const q = query();
  history.replaceState(null, '', q.toString() ? '/strategies?' + q : '/strategies');
  $('reset').hidden = ![...q.keys()].some((k) => k !== 'sort');
  const [{ reports }, bestRes] = await Promise.all([api('/api/reports?' + q), api('/api/strategies/best?' + q)]);
  const best = bestRes.best;

  // Les plus rentables en ce moment (regroupées par carte + Timemark + type). Clic = détail qui se déplie.
  const pctf = (x) => `${Math.round(x * 100)} %`;
  const detail = (b) => {
    const loot = b.topLoot.length ? b.topLoot.map((l) => `<li>${icon(l.img)}<b>${esc(l.name || '#' + l.id)}</b>
        <span class="muted">${esc(t('dLootLine', { perMap: nf1.format(l.perMap), share: pctf(l.share), feh: fe(l.fePerHour) }))}</span></li>`).join('')
      : `<li class="muted">${esc(t('dNone'))}</li>`;
    const items = b.items.length ? b.items.map((c) => `<li>${icon(c.img)}<b>${esc(c.name)}</b>
        <span class="muted">${esc(t('dItemLine', { perMap: nf1.format(c.perMap), cost: fe(c.costPerMap) }))}</span></li>`).join('')
      : `<li class="muted">${esc(t('dNone'))}</li>`;
    const mech = voidChartBlock(b.mechanics) + modGroupsHtml(b.mechanics, t('dNoMech'));
    return `<div class="sdetail">
      <div class="sstats">
        <div><span>${esc(t('dMapsH'))}</span><b>${nf1.format(b.mapsPerHour)}</b></div>
        <div><span>${esc(t('dMapTime'))}</span><b>${b.avgMapMin != null ? nf1.format(b.avgMapMin) + ' min' : '–'}</b></div>
        <div><span>${esc(t('dEff'))}</span><b>${b.efficiency != null ? pctf(b.efficiency) : '–'}</b></div>
        <div><span>${esc(t('dClasses'))}</span><b>${esc(b.heroes.map((h) => heroName(h.id, h.name)).join(', ') || '–')}</b></div>
      </div>
      <div class="scols">
        <div><h4>${esc(t('dMech'))}</h4>${mech}
          ${b.mechanicsKnown < b.sessions ? `<p class="muted small">${esc(t('dMechPartial', { n: b.mechanicsKnown, total: b.sessions }))}</p>` : ''}</div>
        <div><h4>${esc(t('dLoot'))}</h4><ul class="lootl">${loot}</ul>
          <h4 style="margin-top:12px">${esc(t('dItems'))}</h4><ul class="lootl">${items}</ul></div>
      </div>
      <button class="btn" data-routes="${esc(b.region || '')}|${b.timemark ?? ''}|${esc(b.tag || '')}">${esc(t('dRoutes'))}</button>
    </div>`;
  };
  $('best').innerHTML = best.length ? best.slice(0, 12).map((b, i) => `<tr class="click" data-i="${i}">
      <td class="r muted">${i + 1}</td>
      <td><b>${esc(mapLabel(b.region, b.timemark))}</b>${b.tag ? ` <span class="tag">${esc(tagName(b.tag))}</span>` : ''} <span class="muted chev">▾</span></td>
      <td class="hide-sm">${b.items.map((it) => `<span title="${esc(it.name)}">${icon(it.img)}</span>`).join('') || '<span class="muted">–</span>'}</td>
      <td class="r hide-sm">${b.sessions} <span class="muted">/ ${b.players}</span></td>
      <td class="r hide-sm muted">${nf1.format(b.hours)} h</td>
      <td class="r"><b class="pos">${fe(b.perHourNow)}</b></td>
      <td class="r hide-sm muted">${fe(b.perHourThen)}</td></tr>
    <tr class="drow" data-d="${i}" hidden><td colspan="7">${detail(b)}</td></tr>`).join('')
    : `<tr><td colspan="7" class="empty">${esc(bestRes.pending ? t('bestPending', { n: bestRes.pending }) : t('bestEmpty'))}</td></tr>`;
  document.querySelectorAll('#best tr.click').forEach((tr) => (tr.onclick = () => {
    const d = document.querySelector(`#best tr[data-d="${tr.dataset.i}"]`);
    d.hidden = !d.hidden;
    tr.classList.toggle('open', !d.hidden);
    if (!d.hidden) hydrateVoidCharts(d);
  }));
  document.querySelectorAll('#best [data-routes]').forEach((btn) => (btn.onclick = (e) => {
    e.stopPropagation();
    const [region, tier, tag] = btn.dataset.routes.split('|');
    $('region').value = region; $('tier').value = tier; $('tag').value = tag;
    load().then(() => $('allTitle').scrollIntoView({ behavior: 'smooth' }));
  }));

  $('rows').innerHTML = reports.map((r) => `<tr class="click" data-id="${esc(r.id)}">
      <td><b>${esc(r.title || r.main_map || t('farmSession'))}</b><br><span class="muted">${esc(mapLabel(r.region, r.timemark))}${r.strategy_tag ? ' · ' + esc(tagName(r.strategy_tag)) : ''}</span></td>
      <td>${esc(r.hero_id != null ? heroName(r.hero_id, r.hero_display) : '–')}</td><td class="hide-sm muted">${esc(r.author)}${r.server_region ? `<br><span style="font-size:12px">${esc(r.server_region)}</span>` : ''}</td>
      <td class="r">${r.runs}</td><td class="r hide-sm">${dur(r.real_ms)}</td>
      <td class="r ${cls(r.profit)}">${fe(r.profit, true)}${r.big_removed > 0 ? `<br><span class="muted small" title="${esc(t('bigRemovedTip'))}">−${fe(r.big_removed)} ${esc(t('bigRemoved'))}</span>` : ''}</td><td class="r"><b>${fe(r.per_hour_real)}</b></td>
      <td class="r hide-sm muted">${r.likes || ''}</td>
      <td class="r muted nowrap" title="${esc(new Date(r.created_at).toLocaleString(LOCALE))}">${esc(new Date(r.created_at).toLocaleDateString(LOCALE))}</td></tr>`).join('')
    || `<tr><td colspan="9" class="empty">${esc(t('empty'))}</td></tr>`;
  document.querySelectorAll('#rows tr.click').forEach((tr) => (tr.onclick = () => (location.href = '/s/' + tr.dataset.id)));
}

FILTERS.forEach((k) => ($(k).onchange = load));
$('reset').onclick = () => { FILTERS.forEach((k) => { if (k !== 'sort') $(k).value = ''; }); load(); };
loadFilters().then(load).catch((e) => { $('rows').innerHTML = `<tr><td colspan="8" class="empty">${esc(t('error', { msg: e.message }))}</td></tr>`; });
