// Stratégies de farm : les plus rentables au cours actuel + toutes les sessions partagées, avec filtres.
const FILTERS = ['hero', 'region', 'tier', 'tag', 'item', 'server', 'sort'];
const TAGS = ['mapping', 'boss', 'netherrealm', 'dream', 'vorax', 'overrealm', 'sandlord', 'clockwork', 'blacksail', 'deepspace', 'leveling', 'other'];
const params = new URLSearchParams(location.search);
FILTERS.forEach((k) => { if (params.get(k)) $(k).dataset.want = params.get(k); });
document.title = `TLI Companion — ${t('pageTitle')}`;
$('rows').innerHTML = `<tr><td colspan="9" class="empty">${esc(t('loading'))}</td></tr>`;
const tagName = (k) => (k ? t('tag_' + k) : '');
const mapLabel = (region, tier) => `${region || '?'}${tier ? ` · T${tier}` : ''}`;

async function loadFilters() {
  const [s, list] = await Promise.all([api('/api/stats'), heroes().catch(() => [])]);
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
  const [{ reports }, { best }] = await Promise.all([api('/api/reports?' + q), api('/api/strategies/best?' + q)]);

  // Les plus rentables en ce moment (regroupées par carte + Timemark + type).
  $('best').innerHTML = best.length ? best.slice(0, 12).map((b, i) => `<tr class="click" data-region="${esc(b.region || '')}" data-tier="${b.timemark ?? ''}" data-tag="${esc(b.tag || '')}">
      <td class="r muted">${i + 1}</td>
      <td><b>${esc(mapLabel(b.region, b.timemark))}</b>${b.tag ? ` <span class="tag">${esc(tagName(b.tag))}</span>` : ''}</td>
      <td class="hide-sm">${b.items.map((it) => `<span title="${esc(it.name)}">${icon(it.img)}</span>`).join('') || '<span class="muted">–</span>'}</td>
      <td class="r hide-sm">${b.sessions} <span class="muted">/ ${b.players}</span></td>
      <td class="r hide-sm muted">${nf1.format(b.hours)} h</td>
      <td class="r"><b class="pos">${fe(b.perHourNow)}</b></td>
      <td class="r hide-sm muted">${fe(b.perHourThen)}</td></tr>`).join('')
    : `<tr><td colspan="7" class="empty">${esc(t('bestEmpty'))}</td></tr>`;
  document.querySelectorAll('#best tr.click').forEach((tr) => (tr.onclick = () => {
    $('region').value = tr.dataset.region; $('tier').value = tr.dataset.tier; $('tag').value = tr.dataset.tag;
    load().then(() => $('allTitle').scrollIntoView({ behavior: 'smooth' }));
  }));

  $('rows').innerHTML = reports.map((r) => `<tr class="click" data-id="${esc(r.id)}">
      <td><b>${esc(r.title || r.main_map || t('farmSession'))}</b><br><span class="muted">${esc(mapLabel(r.region, r.timemark))}${r.strategy_tag ? ' · ' + esc(tagName(r.strategy_tag)) : ''}</span></td>
      <td>${esc(r.hero_display || '–')}</td><td class="hide-sm muted">${esc(r.author)}${r.server_region ? `<br><span style="font-size:12px">${esc(r.server_region)}</span>` : ''}</td>
      <td class="r">${r.runs}</td><td class="r hide-sm">${dur(r.real_ms)}</td>
      <td class="r ${cls(r.profit)}">${fe(r.profit, true)}</td><td class="r"><b>${fe(r.per_hour_real)}</b></td>
      <td class="r hide-sm muted">${r.likes || ''}</td></tr>`).join('')
    || `<tr><td colspan="8" class="empty">${esc(t('empty'))}</td></tr>`;
  document.querySelectorAll('#rows tr.click').forEach((tr) => (tr.onclick = () => (location.href = '/s/' + tr.dataset.id)));
}

FILTERS.forEach((k) => ($(k).onchange = load));
$('reset').onclick = () => { FILTERS.forEach((k) => { if (k !== 'sort') $(k).value = ''; }); load(); };
loadFilters().then(load).catch((e) => { $('rows').innerHTML = `<tr><td colspan="8" class="empty">${esc(t('error', { msg: e.message }))}</td></tr>`; });
