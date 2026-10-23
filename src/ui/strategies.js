// Stratégies de farm (données de tlicompanion.com, dans l'app) : deux onglets.
// - « Meilleur FE/h » : la stratégie globale (sessions anonymes regroupées par carte + Timemark + type), au cours actuel.
// - « Routes partagées » : les sessions publiées par les joueurs, et la fiche de chacune (votes, commentaires, code du jeu).
// Filtres communs aux deux onglets, dont « Gros drops » (retire les jackpots rares du FE/h).
const Strategies = (() => {
  const FKEYS = ['hero', 'region', 'tier', 'tag', 'item', 'server', 'big'];
  const BIGS = [50, 100, 250, 500, 1000];
  const f = { hero: '', region: '', tier: '', tag: '', item: '', server: '', big: '', sort: 'perhour' };
  let stats = null;
  let heroes = [];
  let routeId = null; // fiche ouverte dans l'onglet Routes

  async function init() {
    if (stats) return;
    [stats, heroes] = await Promise.all([tli.siteGet('/api/stats'), tli.getHeroes()]);
  }
  const heroOfGame = (id) => heroes.find((h) => h.gameId === +id) || null;
  const portrait = (key, size = 28) => {
    const h = heroes.find((x) => x.key === key);
    return h ? `<img class="portrait" style="width:${size}px;height:${size}px" src="${esc(h.portrait)}" alt="">` : '';
  };
  const heroName = (id, fallback) => { const h = heroOfGame(id); return h ? `${h.hero} — ${h.trait}` : fallback || t('st.unknownClass', { id }); };
  const place = (region, tier) => `${region || '?'}${tier ? ` · T${tier}` : ''}`;
  const tagName = (k) => (k ? t('tag.' + k) : '');
  const qs = (withSort) => {
    const p = new URLSearchParams();
    for (const k of FKEYS) if (f[k]) p.set(k, f[k]);
    if (withSort) p.set('sort', f.sort);
    return p.toString();
  };

  // ---------- Filtres (communs aux deux onglets) ----------
  function filtersHtml(withSort) {
    const opt = (v, label, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`;
    const sel = (k, first, list) => `<select data-f="${k}">${opt('', first, f[k])}${list}</select>`;
    return `<div class="tools st-filters">
      ${sel('hero', t('st.allClasses'), stats.heroes.map((h) => opt(h.hero_id, `${heroName(h.hero_id, h.name)} (${h.n})`, f.hero)).join(''))}
      ${sel('region', t('st.allMaps'), stats.regions.map((r) => opt(r.region, `${r.region} (${r.n})`, f.region)).join(''))}
      ${sel('tier', t('st.allTiers'), stats.tiers.map((r) => opt(r.timemark, `T${r.timemark} (${r.n})`, f.tier)).join(''))}
      ${sel('tag', t('st.allTypes'), STRATEGY_TAGS.map((k) => opt(k, tagName(k), f.tag)).join(''))}
      ${sel('item', t('st.allItems'), stats.items.map((i) => opt(i.id, `${i.name} (${i.n})`, f.item)).join(''))}
      ${sel('server', t('st.allServers'), stats.servers.map((x) => opt(x.server, `${x.server} (${x.n})`, f.server)).join(''))}
      <select data-f="big" title="${esc(t('st.bigHelp'))}">${opt('', t('st.bigKeep'), f.big)}${BIGS.map((v) => opt(v, t('st.bigCut', { n: v }), f.big)).join('')}</select>
      ${withSort ? `<select data-f="sort">${['perhour', 'perhourmap', 'profit', 'likes', 'recent', 'oldest'].map((k) => opt(k, t('st.sort_' + k), f.sort)).join('')}</select>` : ''}
      ${FKEYS.some((k) => f[k]) ? `<button class="btn" data-reset>${esc(t('st.reset'))}</button>` : ''}
    </div>`;
  }
  function bindFilters(root, again) {
    root.querySelectorAll('[data-f]').forEach((s) => (s.onchange = () => { f[s.dataset.f] = s.value; again(); }));
    const r = root.querySelector('[data-reset]');
    if (r) r.onclick = () => { for (const k of FKEYS) f[k] = ''; again(); };
  }

  // ---------- Meilleur FE/h (stratégie globale) ----------
  async function showBest() {
    const root = $('stratBestView');
    root.innerHTML = `<p class="muted">${esc(t('b.loading'))}</p>`;
    let res;
    try { await init(); res = await tli.siteGet('/api/strategies/best?' + qs(false)); } catch (e) { root.innerHTML = errBox(e); return; }
    const best = res.best.slice(0, 20);
    root.innerHTML = `${filtersHtml(false)}
      <p class="muted" style="margin:0 0 10px">${esc(t('st.bestHelp', { sessions: res.sessions, players: res.players }))}</p>
      <table><thead><tr><th class="r">#</th><th>${esc(t('st.colStrategy'))}</th><th>${esc(t('st.colItems'))}</th><th class="r">${esc(t('st.colSessions'))}</th><th class="r">${esc(t('st.colHours'))}</th>
        <th class="r">${esc(t('st.colNow'))}</th><th class="r">${esc(t('st.colThen'))}</th></tr></thead><tbody>
      ${best.map((b, i) => `<tr class="click" data-i="${i}">
          <td class="r muted">${i + 1}</td>
          <td><b>${esc(place(b.region, b.timemark))}</b>${b.tag ? ` <span class="tag">${esc(tagName(b.tag))}</span>` : ''} <span class="muted st-chev">▾</span></td>
          <td>${b.items.map((it) => `<span title="${esc(it.name)}">${icon(it.img)}</span>`).join('') || '<span class="muted">–</span>'}</td>
          <td class="r">${b.sessions} <span class="muted">/ ${b.players}</span></td>
          <td class="r muted">${nf1.format(b.hours)} h</td>
          <td class="r"><b class="pos">${fe(b.perHourNow)}</b>${b.cutPerHour > 0 ? `<br><span class="muted small">−${fe(b.cutPerHour)} ${esc(t('st.bigShort'))}</span>` : ''}</td>
          <td class="r muted">${fe(b.perHourThen)}</td></tr>
        <tr class="st-drow" data-d="${i}" hidden><td colspan="7"></td></tr>`).join('')
        || `<tr><td colspan="7" class="muted">${esc(res.pending ? t('st.pending', { n: res.pending, min: res.minPlayers }) : t('st.empty'))}</td></tr>`}
      </tbody></table>`;
    bindFilters(root, showBest);
    root.querySelectorAll('tr.click[data-i]').forEach((tr) => (tr.onclick = () => {
      const d = root.querySelector(`tr[data-d="${tr.dataset.i}"]`);
      d.hidden = !d.hidden;
      tr.classList.toggle('open', !d.hidden);
      if (!d.hidden && !d.dataset.done) { d.dataset.done = '1'; bestDetail(d.firstElementChild, best[+tr.dataset.i]); }
    }));
  }
  function bestDetail(cell, b) {
    const pct = (x) => `${Math.round(x * 100)} %`;
    cell.innerHTML = `<div class="st-detail">
      <div class="bigstats">
        <div><div class="k">${esc(t('st.mapsH'))}</div><div class="v">${nf1.format(b.mapsPerHour)}</div></div>
        <div><div class="k">${esc(t('st.mapTime'))}</div><div class="v">${b.avgMapMin != null ? nf1.format(b.avgMapMin) + ' min' : '–'}</div></div>
        <div><div class="k">${esc(t('st.eff'))}</div><div class="v">${b.efficiency != null ? pct(b.efficiency) : '–'}</div></div>
        <div><div class="k">${esc(t('st.classes'))}</div><div class="v st-classes">${esc(b.heroes.map((h) => heroName(h.id, h.name)).join(', ') || '–')}</div></div>
      </div>
      <div class="cards">
        <div class="card"><h2>${esc(t('st.loot'))}</h2><table><tbody>${b.topLoot.map((l) => `<tr><td>${icon(l.img)}${esc(l.name || '#' + l.id)}</td>
            <td class="r muted">${esc(t('st.perMap', { n: (l.perMap < 1 ? nf3 : nf1).format(l.perMap) }))}</td><td class="r muted">${pct(l.share)}</td><td class="r">${fe(l.fePerHour)} FE/h</td></tr>`).join('')
            || `<tr><td class="muted">${esc(t('d.none'))}</td></tr>`}</tbody></table></div>
        <div class="card"><h2>${esc(t('st.items'))}</h2><table><tbody>${b.items.map((c) => `<tr><td>${icon(c.img)}${esc(c.name)}</td>
            <td class="r muted">${esc(t('st.perMap', { n: (c.perMap < 1 ? nf3 : nf1).format(c.perMap) }))}</td><td class="r neg">−${fe(c.costPerMap)} / ${esc(t('st.map'))}</td></tr>`).join('')
            || `<tr><td class="muted">${esc(t('d.none'))}</td></tr>`}</tbody></table></div>
      </div>
      ${b.mechanics.length ? `<div class="card"><h2>${esc(t('st.mechanics'))}</h2>
        <div class="st-mods">${b.mechanics.map((m) => `<span class="chip" title="${esc(t('st.modShare', { p: pct(m.share) }))}">${esc(m.desc)} <b>${nf1.format(m.perMap)}×</b></span>`).join('')}</div>
        ${b.mechanicsKnown < b.sessions ? `<p class="muted small" style="margin-top:6px">${esc(t('st.modPartial', { n: b.mechanicsKnown, total: b.sessions }))}</p>` : ''}</div>
        <div class="card vce" data-vc></div>` : ''}
      <div class="st-acts"><button class="btn primary" data-routes>${esc(t('st.seeRoutes'))}</button><button class="btn" data-fold>▲ ${esc(t('st.hide'))}</button></div>
    </div>`;
    const vc = cell.querySelector('[data-vc]');
    if (vc) VoidChart.mount(vc, { strategy: { modifiers: b.mechanics.map((m) => ({ desc: m.desc, perMap: m.perMap })) }, voidChart: null }, { readOnly: true }).catch(() => vc.remove());
    cell.querySelector('[data-fold]').onclick = () => {
      const row = cell.parentElement;
      row.hidden = true;
      const head = row.previousElementSibling;
      if (head) { head.classList.remove('open'); head.scrollIntoView({ block: 'nearest' }); }
    };
    cell.querySelector('[data-routes]').onclick = () => {
      f.region = b.region || ''; f.tier = b.timemark != null ? String(b.timemark) : ''; f.tag = b.tag || '';
      routeId = null;
      showTab('stratRoutes');
    };
  }

  // ---------- Routes partagées ----------
  async function showRoutes() {
    if (routeId) return openRoute(routeId);
    const root = $('stratRoutesView');
    root.innerHTML = `<p class="muted">${esc(t('b.loading'))}</p>`;
    let res;
    try { await init(); res = await tli.siteGet('/api/reports?' + qs(true)); } catch (e) { root.innerHTML = errBox(e); return; }
    root.innerHTML = `${filtersHtml(true)}
      <table><thead><tr><th>${esc(t('st.colStrategy'))}</th><th>${esc(t('col.class'))}</th><th>${esc(t('st.colPlayer'))}</th><th class="r">${esc(t('k.maps'))}</th>
        <th class="r">${esc(t('st.colDuration'))}</th><th class="r">${esc(t('st.colProfit'))}</th><th class="r">FE/h</th><th class="r">${esc(t('st.colVotes'))}</th><th class="r">${esc(t('st.colPublished'))}</th></tr></thead><tbody>
      ${res.reports.map((r) => `<tr class="click" data-id="${esc(r.id)}">
          <td><b>${esc(r.title || r.main_map || t('st.session'))}</b><br><span class="muted">${esc(place(r.region, r.timemark))}${r.strategy_tag ? ' · ' + esc(tagName(r.strategy_tag)) : ''}</span></td>
          <td>${heroOfGame(r.hero_id) ? portrait(heroOfGame(r.hero_id).key, 24) + ' ' : ''}${esc(r.hero_id != null ? heroName(r.hero_id, r.hero_display) : '–')}</td>
          <td class="muted">${esc(r.author)}${Social.badge(r.author_supporter)}${r.server_region ? `<br><span class="small">${esc(r.server_region)}</span>` : ''}</td>
          <td class="r">${r.runs}</td><td class="r">${dur(r.real_ms)}</td>
          <td class="r ${cls(r.profit)}">${fe(r.profit, true)}${r.big_removed > 0 ? `<br><span class="muted small">−${fe(r.big_removed)} ${esc(t('st.bigShort'))}</span>` : ''}</td>
          <td class="r"><b>${fe(r.per_hour_real)}</b></td><td class="r nowrap" data-sort="${(r.likes || 0) - (r.dislikes || 0)}">${voteCell(r)}</td>
          <td class="r muted nowrap" data-sort="${r.created_at}" title="${esc(new Date(r.created_at).toLocaleString(LOCALE))}">${esc(new Date(r.created_at).toLocaleDateString(LOCALE))}</td></tr>`).join('')
        || `<tr><td colspan="9" class="muted">${esc(t('st.emptyRoutes'))}</td></tr>`}
      </tbody></table>`;
    bindFilters(root, showRoutes);
    root.querySelectorAll('tr.click[data-id]').forEach((tr) => (tr.onclick = () => openRoute(tr.dataset.id)));
    bindVotes(root, res.reports);
  }

  // Votes directement dans la liste : un vote par compte, re-cliquer retire le vote, pas sur ses propres routes.
  const UP = '<svg viewBox="0 0 24 24"><path d="M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9h5.2a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.5 20H7"/></svg>';
  const DOWN = '<svg viewBox="0 0 24 24"><path d="M17 13V4h3v9zM17 13l-4 8c-1.5 0-2.5-1-2.5-2.5V15H5.3a2 2 0 0 1-2-2.3l1.2-7A2 2 0 0 1 6.5 4H17"/></svg>';
  function voteCell(r) {
    const off = r.mine ? `disabled title="${esc(t('soc.ownContent'))}"` : '';
    return `<span class="st-votes" data-vote="${esc(r.id)}">
      <button class="st-v up${r.my_vote === 1 ? ' on' : ''}" data-v="1" ${off}>${UP}<b>${r.likes || 0}</b></button>
      <button class="st-v down${r.my_vote === -1 ? ' on' : ''}" data-v="-1" ${off}>${DOWN}<b>${r.dislikes || 0}</b></button></span>`;
  }
  function bindVotes(root, reports) {
    root.querySelectorAll('[data-vote]').forEach((box) => {
      const r = reports.find((x) => x.id === box.dataset.vote);
      box.onclick = (e) => e.stopPropagation(); // voter n'ouvre pas la fiche
      box.querySelectorAll('[data-v]').forEach((b) => (b.onclick = async (e) => {
        e.stopPropagation();
        const v = +b.dataset.v;
        try {
          const out = await tli.vote('report', r.id, r.my_vote === v ? 0 : v);
          Object.assign(r, { likes: out.likes, dislikes: out.dislikes, my_vote: out.mine });
          box.outerHTML = voteCell(r);
          bindVotes(root, reports);
        } catch (err) {
          const m = errMsg(err);
          const msg = /login required|unknown token|no username/i.test(m) ? t('st.voteSignIn') : /own content/.test(m) ? t('soc.ownContent') : m;
          box.title = msg;
          box.classList.add('st-err');
          setTimeout(() => box.classList.remove('st-err'), 1500);
          if (/login required|unknown token|no username/i.test(m) && confirm(msg)) showTab('settings');
        }
      }));
    });
  }

  // Fiche d'une route : chiffres, code du jeu, notes, cartes, achats, Void Chart, butin, votes et commentaires.
  async function openRoute(id) {
    routeId = id;
    const root = $('stratRoutesView');
    root.innerHTML = `<p class="muted">${esc(t('b.loading'))}</p>`;
    let res;
    try { res = await tli.siteGet('/api/reports/' + id); } catch (e) { root.innerHTML = `<div class="tools"><button class="btn" id="stBack">${esc(t('btn.back'))}</button></div>${errBox(e)}`; $('stBack').onclick = back; return; }
    const { report: r, author, likes, dislikes, myVote, authorSupporter } = res;
    const tot = r.totals;
    const title = r.title || (r.strategy.maps[0] && r.strategy.maps[0].name) || t('st.session');
    const h = r.hero ? heroOfGame(r.hero.id) : null;
    const stat = (k, v, c = '') => `<div><div class="k">${esc(t(k))}</div><div class="v ${c}">${v}</div></div>`;
    root.innerHTML = `
      <div class="detail-head">
        <button class="btn" id="stBack">${esc(t('btn.back'))}</button>
        ${h ? portrait(h.key, 40) : ''}
        <div style="flex:1;min-width:200px"><div style="font-size:16px;font-weight:600">${esc(title)}</div>
          <div class="muted">${esc(t('b.by', { author: author || '?' }))}${Social.badge(authorSupporter)} · ${esc(h ? `${h.hero} — ${h.trait}` : (r.hero && (r.hero.display || r.hero.name)) || '–')} · ${esc(dayLabel(r.startedAt))}${r.strategyTag ? ' · ' + esc(tagName(r.strategyTag)) : ''}</div></div>
        <span id="stVotes"></span>
      </div>
      <div class="card"><div class="bigstats">
        ${stat('st.perHourReal', fe(tot.perHourReal))}${stat('st.perHourMap', fe(tot.perHourMap))}${stat('st.colProfit', fe(tot.profit, true), cls(tot.profit))}
        ${stat('k.maps', tot.runs)}${stat('st.colDuration', dur(tot.realMs))}${stat('k.avg', fe(tot.avgPerMap, true), cls(tot.avgPerMap))}${stat('st.durMap', dur(tot.avgMapMs))}${stat('st.cost', fe(tot.cost), 'neg')}
      </div></div>
      ${r.gameCode ? `<div class="card"><h2>${esc(t('st.gameCode'))}</h2><p class="muted" style="margin-bottom:8px">${esc(t('st.gameCodeHelp'))}</p>
        <div class="st-code"><input id="stCode" readonly value="${esc(r.gameCode)}"><button class="btn primary" id="stCopy">${esc(t('st.copy'))}</button></div></div>` : ''}
      ${r.notes ? `<div class="card"><h2>${esc(t('d.notes'))}</h2><div class="notes" style="white-space:pre-wrap">${esc(r.notes)}</div></div>` : ''}
      <div class="cards">
        <div class="card"><h2>${esc(t('d.mapsPlayed'))}</h2><table><thead><tr><th>${esc(t('col.map'))}</th><th class="r">${esc(t('col.count'))}</th><th class="r">${esc(t('col.avgProfit'))}</th><th class="r">${esc(t('col.avgDuration'))}</th></tr></thead><tbody>
          ${r.strategy.maps.map((m) => `<tr><td>${esc(m.name)}${m.zones && Object.keys(m.zones).length ? `<br><span class="muted">${Object.entries(m.zones).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([z, n]) => esc(z) + (n > 1 ? ' ×' + n : '')).join(' · ')}</span>` : ''}</td>
            <td class="r">${m.runs}</td><td class="r ${cls(m.profit)}">${fe(m.profit / m.runs, true)}</td><td class="r">${dur(m.durationMs / m.runs)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="card"><h2>${esc(t('d.consumables'))}</h2><table><thead><tr><th>${esc(t('col.item'))}</th><th class="r">${esc(t('col.perMap'))}</th><th class="r">${esc(t('col.unit'))}</th><th class="r">${esc(t('st.costMap'))}</th></tr></thead><tbody>
          ${r.strategy.consumables.map((c) => `<tr><td>${icon(c.img)}${esc(c.name)}</td><td class="r">${(c.perMap < 1 ? nf3 : nf1).format(c.perMap)}</td><td class="r muted">${unit(c.unit)}</td><td class="r neg">${fe(-c.perMap * c.unit)}</td></tr>`).join('')
            || `<tr><td colspan="4" class="muted">${esc(t('d.none'))}</td></tr>`}
        </tbody></table></div>
      </div>
      <div class="card vce" id="stVc"></div>
      <div class="card"><h2>${esc(t('d.bestDrops'))}</h2><table><thead><tr><th>${esc(t('col.item'))}</th><th class="r">${esc(t('col.qty'))}</th><th class="r">${esc(t('col.value'))}</th></tr></thead><tbody>
        ${r.loot.slice(0, 30).map((i) => `<tr><td>${icon(i.img)}${esc(i.name)}</td><td class="r">${qty(i.qty)}</td><td class="r ${cls(i.value)}">${fe(i.value, true)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="card" id="stComments"></div>`;
    $('stBack').onclick = back;
    const signIn = () => showTab('settings');
    Social.mountVotes($('stVotes'), 'report', id, { likes, dislikes, myVote }, { signIn });
    Social.mountComments($('stComments'), 'report', id, { signIn, avatar: (k) => (k ? portrait(k, 22) : '') });
    VoidChart.mount($('stVc'), r, { readOnly: true }).catch(() => $('stVc').remove());
    if ($('stCopy')) $('stCopy').onclick = async () => {
      try { await navigator.clipboard.writeText(r.gameCode); } catch { $('stCode').select(); document.execCommand('copy'); }
      $('stCopy').textContent = t('st.copied');
    };
  }
  const back = () => { routeId = null; showRoutes(); };
  const errBox = (e) => `<div class="card"><p class="muted">${esc(t('st.offline'))}</p><p class="muted small">${esc(errMsg(e))}</p></div>`;

  function show(name) { if (name === 'stratBest') showBest(); else showRoutes(); }
  return { show };
})();
