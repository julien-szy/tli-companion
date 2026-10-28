// Page Prix, vue « Ce qui bouge » (/prices?view=movers) : les objets dont le prix a le plus monté ou baissé
// sur 3 jours (moyenne des 3 derniers jours, variation en %), et ce que ça change par carte selon le loot réel
// des routes de farm (toutes, ou une stratégie : région, Timemark, type). L'app ouvre cette page avec la
// stratégie du joueur (?region=…&tier=…&tag=…).
const M = {
  en: {
    tabAll: 'All prices', tabMovers: 'What moves (3 days)',
    intro: 'Items whose price changed the most over the last 3 days, and what it changes per map with the loot of real farm routes.',
    route: 'Route', allRoutes: 'All routes', region: 'Region', tier: 'Timemark', tag: 'Type', any: 'Any',
    sortImpact: 'Effect per map', sortPct: 'Change in %', up: 'Rising', down: 'Falling',
    item: 'Item', price: 'Price', avg3: '3-day average', ch3: '3 days', perMap: 'Per map', impact: 'Effect per map',
    sum: 'Over 3 days, the price changes make this route earn {v} FE per map ({p}).', sumNone: 'Not enough farm sessions for this route yet.',
    base: 'Loot of {s} farm sessions ({r} maps, {p} players, last 30 days).', none: 'Nothing for now.',
    how: '3 days = current price compared with the median price 3 days ago. Per map = average quantity dropped per map on this route. Effect per map = per map × price change. Items seen by at least 2 players only.',
    loading: 'Loading…', mine: 'Open with my route from the app: Sessions › a session › “What moves”.',
  },
  fr: {
    tabAll: 'Tous les prix', tabMovers: 'Ce qui bouge (3 jours)',
    intro: "Les objets dont le prix a le plus changé ces 3 derniers jours, et ce que ça change par carte avec le loot de vraies routes de farm.",
    route: 'Route', allRoutes: 'Toutes les routes', region: 'Région', tier: 'Timemark', tag: 'Type', any: 'Tous',
    sortImpact: 'Effet par carte', sortPct: 'Variation en %', up: 'En hausse', down: 'En baisse',
    item: 'Objet', price: 'Prix', avg3: 'Moyenne 3 jours', ch3: '3 jours', perMap: 'Par carte', impact: 'Effet par carte',
    sum: 'Sur 3 jours, les changements de prix font gagner {v} FE par carte à cette route ({p}).', sumNone: "Pas encore assez de sessions de farm pour cette route.",
    base: 'Loot de {s} sessions de farm ({r} cartes, {p} joueurs, 30 derniers jours).', none: "Rien pour l'instant.",
    how: "3 jours = prix actuel comparé au prix médian d'il y a 3 jours. Par carte = quantité moyenne lootée par carte sur cette route. Effet par carte = par carte × variation du prix. Seulement les objets vus par au moins 2 joueurs.",
    loading: 'Chargement…', mine: "Ouvre-la avec ta route depuis l'app : Sessions › une session › « Ce qui bouge ».",
  },
};
const mt = (k, v) => String((M[LANG] || M.en)[k] ?? M.en[k] ?? k).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] != null ? v[n] : m));
(function movers() {
  const qs = new URLSearchParams(location.search);
  const isMovers = qs.get('view') === 'movers';
  $('prViews').innerHTML = `<a class="btn${isMovers ? '' : ' on'}" href="/prices">${esc(mt('tabAll'))}</a><a class="btn${isMovers ? ' on' : ''}" href="/prices?view=movers">${esc(mt('tabMovers'))}</a>`;
  if (!isMovers) return;
  document.querySelector('.pr-layout').hidden = true;
  const box = $('moversBox');
  box.hidden = false;
  const TAGS = ['mapping', 'boss', 'netherrealm', 'dream', 'vorax', 'overrealm', 'sandlord', 'clockwork', 'blacksail', 'deepspace', 'leveling', 'other'];
  let sort = 'impact';
  let data = null;
  const f = { region: qs.get('region') || '', tier: qs.get('tier') || '', tag: qs.get('tag') || '' };
  box.innerHTML = `<p class="muted">${esc(mt('intro'))}</p>
    <div class="mv-tools">
      <label class="flt">${esc(mt('region'))}<select id="mvRegion"><option value="">${esc(mt('any'))}</option></select></label>
      <label class="flt">${esc(mt('tier'))}<select id="mvTier"><option value="">${esc(mt('any'))}</option></select></label>
      <label class="flt">${esc(mt('tag'))}<select id="mvTag"><option value="">${esc(mt('any'))}</option>${TAGS.map((k) => `<option value="${k}">${esc(t('tag_' + k))}</option>`).join('')}</select></label>
      <div class="mv-sort"><button class="btn" data-sort="impact">${esc(mt('sortImpact'))}</button><button class="btn" data-sort="pct">${esc(mt('sortPct'))}</button></div>
    </div>
    <div class="card mv-sum" id="mvSum"><span class="muted">${esc(mt('loading'))}</span></div>
    <div class="mv-cols"><div class="card"><h2 class="pos">▲ ${esc(mt('up'))}</h2><div id="mvUp"></div></div>
      <div class="card"><h2 class="neg">▼ ${esc(mt('down'))}</h2><div id="mvDown"></div></div></div>
    <p class="muted small">${esc(mt('how'))}</p><p class="muted small">${esc(mt('mine'))}</p>`;
  api('/api/stats').catch(() => ({})).then((s) => {
    $('mvRegion').insertAdjacentHTML('beforeend', (s.regions || []).map((r) => `<option value="${esc(r.region)}">${esc(r.region)}</option>`).join(''));
    $('mvTier').insertAdjacentHTML('beforeend', (s.tiers || []).map((r) => `<option value="${r.timemark}">${esc(t('timemarkN', { n: r.timemark }))}</option>`).join(''));
    // Région ou Timemark venus du lien (app) mais absents de la liste : on les ajoute.
    for (const [id, v, label] of [['mvRegion', f.region, f.region], ['mvTier', f.tier, f.tier && t('timemarkN', { n: f.tier })]]) {
      if (v && ![...$(id).options].some((o) => o.value === v)) $(id).insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(label)}</option>`);
      $(id).value = v;
    }
  });
  $('mvTag').value = f.tag;
  for (const [id, k] of [['mvRegion', 'region'], ['mvTier', 'tier'], ['mvTag', 'tag']]) $(id).onchange = (e) => { f[k] = e.target.value; load(); };
  box.querySelectorAll('[data-sort]').forEach((b) => (b.onclick = () => { sort = b.dataset.sort; draw(); }));

  const pc = (v) => `<span class="${v > 0.005 ? 'pos' : v < -0.005 ? 'neg' : 'muted'}">${v > 0 ? '+' : ''}${(v * 100).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} %</span>`;
  const feS = (v) => `<span class="${v > 0 ? 'pos' : v < 0 ? 'neg' : 'muted'}">${v > 0 ? '+' : ''}${Math.abs(v) >= 100 ? nf0.format(v) : v.toLocaleString(LOCALE, { maximumFractionDigits: 2 })}</span>`;
  const table = (rows) => (rows.length ? `<table class="mv-table"><thead><tr><th>${esc(mt('item'))}</th><th class="r">${esc(mt('price'))}</th><th class="r hide-sm">${esc(mt('avg3'))}</th>
      <th class="r">${esc(mt('ch3'))}</th><th class="r hide-sm">${esc(mt('perMap'))}</th><th class="r">${esc(mt('impact'))}</th></tr></thead><tbody>
      ${rows.map((i) => `<tr data-id="${i.id}"><td><span class="pr-name">${i.img ? `<img src="${esc(i.img)}" alt="" loading="lazy">` : '<span class="pr-noimg"></span>'}<span>${esc(i.name)}</span></span></td>
        <td class="r"><b>${esc(nfP(i.price))}</b></td><td class="r hide-sm muted">${i.avg3 != null ? esc(nfP(i.avg3)) : '–'}</td>
        <td class="r">${pc(i.ch3)}</td><td class="r hide-sm muted">${i.perMap ? i.perMap.toLocaleString(LOCALE, { maximumFractionDigits: 3 }) : '–'}</td>
        <td class="r">${i.perMap ? feS(i.impact) : '<span class="muted">–</span>'}</td></tr>`).join('')}</tbody></table>`
    : `<p class="muted">${esc(mt('none'))}</p>`);
  function draw() {
    box.querySelectorAll('[data-sort]').forEach((b) => b.classList.toggle('on', b.dataset.sort === sort));
    if (!data) return;
    const key = sort === 'impact' && data.runs ? (i) => i.impact : (i) => i.ch3;
    const list = data.items.filter((i) => (sort === 'impact' && data.runs ? i.perMap > 0 : true));
    const up = list.filter((i) => key(i) > 0).sort((a, b) => key(b) - key(a)).slice(0, 15);
    const down = list.filter((i) => key(i) < 0).sort((a, b) => key(a) - key(b)).slice(0, 15);
    $('mvUp').innerHTML = table(up);
    $('mvDown').innerHTML = table(down);
    box.querySelectorAll('tr[data-id]').forEach((tr) => (tr.onclick = () => { location.href = `/prices/${tr.dataset.id}`; }));
    if (!data.runs) { $('mvSum').innerHTML = `<span class="muted">${esc(mt('sumNone'))}</span>`; return; }
    const total = data.items.reduce((s, i) => s + i.impact, 0);
    const before = data.items.reduce((s, i) => s + i.perMap * i.old3, 0);
    $('mvSum').innerHTML = `<b>${mt('sum', { v: feS(total), p: before ? pc(total / before) : '–' })}</b>
      <div class="muted small">${esc(mt('base', { s: data.sessions, r: nf0.format(data.runs), p: data.players }))}</div>`;
  }
  async function load() {
    const p = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
    history.replaceState(null, '', `/prices?view=movers${p.toString() ? '&' + p : ''}`);
    $('mvSum').innerHTML = `<span class="muted">${esc(mt('loading'))}</span>`;
    try { data = await api('/api/prices/movers?' + p); } catch (e) { $('mvSum').textContent = e.message; return; }
    draw();
  }
  load();
})();
