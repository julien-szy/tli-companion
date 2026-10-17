// Onglet Méta : ce que jouent les meilleurs joueurs de chaque classe (cache Hero Ranking du jeu).
const MetaTab = (() => {
  let heroes = [];
  let fileKey = null;
  let heroId = null;
  let topN = 100;
  let threshold = 0.3;
  let currentRemote = false;   // méta de la communauté : agrégats sur toute la classe
  let ovSort = 'players';      // tri de la vue d'ensemble : 'players' | 'tier'
  let classView = 'stats';     // vue d'une classe : 'stats' | 'players'
  let plSort = 'rank';         // tri des joueurs : 'rank' | 'dps'
  let plLimit = 50;
  const root = () => $('metaView');

  const heroOf = (key) => heroes.find((h) => h.key === key) || null;
  const nameOf = (c) => { const h = heroOf(c.key); return h ? `${h.hero} — ${h.trait}` : t('m.unknownClass', { id: c.heroId }); };
  const portrait = (key, size = 28) => {
    const h = heroOf(key);
    return h ? `<img class="portrait" style="width:${size}px;height:${size}px" src="${esc(h.portrait)}" alt="">` : `<span class="portrait unknown" style="width:${size}px;height:${size}px">?</span>`;
  };
  const pct = (p) => `${Math.round(p * 100)}%`;
  const bigNum = (n) => (n >= 1e6 ? nf1.format(n / 1e6) + ' M' : n >= 1e3 ? nf1.format(n / 1e3) + ' k' : nf0.format(n));
  const sourceTag = (c) => (c.source === 'community' ? `<span class="tag" title="${esc(t('m.communityVotes', { n: c.votes }))}">${esc(t('m.byCommunity'))}</span>` : '');
  const assignSelect = (c) => `<select data-assign="${c.heroId}"><option value="">${esc(t('m.assign'))}</option>${heroes.map((h) =>
    `<option value="${esc(h.key)}" ${h.key === c.key ? 'selected' : ''}>${esc(h.hero)} — ${esc(h.trait)}</option>`).join('')}</select>`;

  function bindAssign() {
    root().querySelectorAll('[data-assign]').forEach((sel) => {
      sel.onclick = (e) => e.stopPropagation();
      sel.onchange = async () => { await tli.metaAssign(+sel.dataset.assign, sel.value); show(); };
    });
  }

  async function show() {
    if (!heroes.length) heroes = await tli.getHeroes();
    const { local, remote } = await tli.metaFiles();
    const files = [...remote, ...local];
    if (!files.length) {
      root().innerHTML = `<div class="card"><h2>${esc(t('m.noDataTitle'))}</h2><p class="muted notes">${esc(t('m.noData'))}</p></div>`;
      return;
    }
    // Par défaut : la méta de la communauté (global, sinon mon serveur), sinon mon plus gros classement local.
    if (!fileKey || !files.some((f) => f.key === fileKey)) {
      const myServer = (local.find((f) => f.server) || {}).server;
      const pick = remote.find((f) => f.server === 'global') || remote.find((f) => f.server === myServer) || remote[0]
        || local.slice().sort((a, b) => b.size - a.size)[0];
      fileKey = pick.key;
    }
    currentRemote = (files.find((f) => f.key === fileKey) || {}).remote;
    if (heroId != null) return showClass(files);
    const o = await tli.metaOverview(fileKey);
    const myId = o.myHeroId;
    root().innerHTML = `
      ${toolbar(files)}
      <p class="muted" style="margin-bottom:10px">${esc(t('m.overviewHelp', { total: nf0.format(o.total), skills: nf0.format(o.withSkills) }))}</p>
      <div class="tools"><label class="muted">${esc(t('m.sortBy'))} <select id="mOvSort">
        <option value="players" ${ovSort === 'players' ? 'selected' : ''}>${esc(t('m.sortPlayers'))}</option>
        <option value="tier" ${ovSort === 'tier' ? 'selected' : ''}>${esc(t('m.sortTier'))}</option></select></label>
        <span class="muted">${esc(t('m.tierHelp'))}</span></div>
      <table><thead><tr><th style="width:52px">${esc(t('m.tier'))}</th><th>${esc(t('col.class'))}</th><th class="r">${esc(t('m.players'))}</th><th style="width:22%">${esc(t('m.share'))}</th>
        <th class="r">${esc(t('m.inTop100'))}</th><th class="r">${esc(t('m.medianDps'))}</th><th class="r">${esc(t('m.medianLevel'))}</th></tr></thead><tbody>
      ${o.classes.slice().sort((a, b) => (ovSort === 'tier' ? b.score - a.score : b.players - a.players)).map((c) => `<tr class="click" data-hero="${c.heroId}">
          <td><span class="tier t${c.tier}" title="${c.score}/100">${c.tier}</span></td>
          <td>${portrait(c.key)} ${c.key ? `<b>${esc(nameOf(c))}</b> ${sourceTag(c)}` : `<span class="muted">${esc(nameOf(c))}</span> ${assignSelect(c)}`}
            ${c.heroId === myId ? `<span class="tag loot">${esc(t('m.yourClass'))}</span>` : ''}</td>
          <td class="r">${nf0.format(c.players)}</td>
          <td class="bar-cell"><div class="bar" style="width:${Math.min(100, c.share * 100 * 2.5)}%"></div><span>${pct(c.share)}</span></td>
          <td class="r">${c.inTop100}</td><td class="r">${bigNum(c.medianDps)}</td><td class="r">${nf0.format(c.medianLevel)}</td></tr>`).join('')}
      </tbody></table>`;
    bindToolbar();
    bindAssign();
    $('mOvSort').onchange = (e) => { ovSort = e.target.value; show(); };
    root().querySelectorAll('tr[data-hero]').forEach((tr) => (tr.onclick = () => { heroId = +tr.dataset.hero; classView = 'stats'; plLimit = 50; show(); }));
  }

  // Filtres séparés : source → région → saison → classement → mode (seules les combinaisons existantes).
  const DIMS = ['src', 'server', 'season', 'ssf', 'board'];
  const dimOf = {
    src: (f) => (f.remote ? 'r' : 'l'),
    server: (f) => f.server || '?',
    season: (f) => String(Math.floor(f.season / 100)),
    board: (f) => String(f.mode),
    ssf: (f) => (f.season % 100 === 21 ? 'ssf' : 'sc'),
  };
  const dimLabel = {
    src: (v) => t(v === 'r' ? 'm.groupCommunity' : 'm.groupMine'),
    server: (v) => (v === 'global' ? '🌐 ' + t('m.globalShort') : v === '?' ? t('m.serverUnknown') : v),
    season: (v) => t('m.seasonN', { n: v }),
    // Le n° de classement ne parle à personne : on affiche la date de capture.
    board: (v, pool) => fmtDate(boardAt(v, pool)),
    ssf: (v) => t(v === 'ssf' ? 'm.modeSsf' : 'm.modeSc'),
  };
  const fmtDate = (ms) => new Date(ms).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
  const boardAt = (v, pool) => Math.max(...pool.filter((f) => String(f.mode) === v).map((f) => f.mtime));
  const sortVals = (k, vals, pool) => (k === 'board' ? vals.sort((a, b) => boardAt(b, pool) - boardAt(a, pool)) : k === 'server' ? vals.sort((a, b) => (a === 'global' ? -1 : b === 'global' ? 1 : a.localeCompare(b)))
    : k === 'season' ? vals.sort((a, b) => b - a) : k === 'src' ? vals.sort().reverse() : vals.sort());
  // Choisit le fichier qui respecte au mieux les valeurs voulues, dimension par dimension.
  function pickFile(files, want) {
    let pool = files;
    for (const k of DIMS) {
      const m = pool.filter((f) => dimOf[k](f) === want[k]);
      pool = m.length ? m : pool.filter((f) => dimOf[k](f) === sortVals(k, [...new Set(pool.map(dimOf[k]))], pool)[0]);
    }
    return pool.sort((a, b) => b.mtime - a.mtime)[0];
  }
  let toolbarFiles = [];
  function toolbar(files) {
    toolbarFiles = files;
    const curF = files.find((f) => f.key === fileKey) || files[0];
    let pool = files;
    const sels = DIMS.map((k) => {
      const vals = sortVals(k, [...new Set(pool.map(dimOf[k]))], pool);
      const v = dimOf[k](curF);
      const here = pool;
      pool = pool.filter((f) => dimOf[k](f) === v);
      return `<label class="flt"><span>${esc(t('m.f_' + k))}</span><select data-dim="${k}" ${vals.length < 2 ? 'disabled' : ''}>
        ${vals.map((x) => `<option value="${esc(x)}" ${x === v ? 'selected' : ''}>${esc(dimLabel[k](x, here))}</option>`).join('')}</select></label>`;
    }).join('');
    return `<div class="tools">
      ${heroId != null ? `<button class="btn" id="mBack">${esc(t('btn.back'))}</button>` : ''}
      ${sels}
    </div>
    <div class="muted" style="margin:-4px 0 10px">${esc(t(currentRemote ? 'm.fileHelpRemote' : 'm.fileHelp'))}</div>`;
  }
  function bindToolbar() {
    root().querySelectorAll('select[data-dim]').forEach((sel) => (sel.onchange = () => {
      const cur = toolbarFiles.find((f) => f.key === fileKey) || toolbarFiles[0];
      const want = Object.fromEntries(DIMS.map((k) => [k, dimOf[k](cur)]));
      want[sel.dataset.dim] = sel.value;
      fileKey = pickFile(toolbarFiles, want).key;
      show();
    }));
    if ($('mBack')) $('mBack').onclick = () => { heroId = null; show(); };
  }

  async function showClass(files) {
    const d = await tli.metaClass(fileKey, heroId, topN);
    const c = { heroId, key: d.key, source: d.source, votes: d.votes };
    const table = (rows, withPrice = true) => rows.map((r) => `<tr>
        <td>${icon(r.img)}${esc(r.name)} ${r.owned ? `<span class="tag loot">${esc(t('m.owned'))}</span>` : ''}</td>
        <td class="bar-cell" style="width:38%"><div class="bar" style="width:${r.pct * 100}%"></div><span>${pct(r.pct)}</span></td>
        ${withPrice ? `<td class="r">${r.price ? fe(r.price) : '–'}</td>` : ''}</tr>`).join('') || `<tr><td colspan="3" class="muted">${esc(t('d.none'))}</td></tr>`;
    const idTable = (rows, label) => rows.map((r) => `<tr><td>${icon(r.img)}${esc(r.name || t(label, { id: r.id }))}</td>
        <td class="bar-cell" style="width:50%"><div class="bar" style="width:${r.pct * 100}%"></div><span>${pct(r.pct)}</span></td></tr>`).join('');
    root().innerHTML = `
      ${toolbar(files)}
      <div class="detail-head">
        ${portrait(c.key, 44)}
        <div style="flex:1;min-width:220px"><div style="font-size:16px;font-weight:600">${esc(nameOf(c))} ${sourceTag(c)}</div>
          <div class="muted">${esc(t('m.sample', { n: d.sample, skills: d.sampleWithSkills }))}</div></div>
        ${assignSelect(c)}
        <div class="seg2"><button class="btn ${classView === 'stats' ? 'primary' : ''}" data-view="stats">${esc(t('m.viewStats'))}</button><button class="btn ${classView === 'players' ? 'primary' : ''}" data-view="players">${esc(t('m.viewPlayers'))}</button></div>
        ${classView === 'players' ? '' : currentRemote ? `<span class="tag">${esc(t('m.wholeClass'))}</span>` : `<select id="mTop">${[25, 50, 100, 250, 500, 5000].map((n) => `<option value="${n}" ${n === topN ? 'selected' : ''}>${esc(n === 5000 ? t('m.allPlayers') : t('m.topN', { n }))}</option>`).join('')}</select>`}
      </div>
      ${classView === 'players' ? '<div id="mPlayers"></div>' : `
      <div class="card"><div class="bigstats">
        <div><div class="k">${esc(t('m.medianDps'))}</div><div class="v">${bigNum(d.medianDps)}</div></div>
        <div><div class="k">${esc(t('m.maxDps'))}</div><div class="v">${bigNum(d.maxDps)}</div></div>
        <div><div class="k">${esc(t('m.medianLevel'))}</div><div class="v">${nf0.format(d.medianLevel)}</div></div>
      </div>
      </div>
      <div class="cards">
        <div class="card"><h2>${esc(t('m.legendaries'))}</h2><table><thead><tr><th>${esc(t('col.item'))}</th><th>${esc(t('m.usedBy'))}</th><th class="r">${esc(t('m.priceFe'))}</th></tr></thead><tbody>${table(d.uniques.slice(0, 20))}</tbody></table></div>
        <div class="card"><h2>${esc(t('m.skills'))}</h2><table><thead><tr><th>${esc(t('col.item'))}</th><th>${esc(t('m.usedBy'))}</th><th class="r">${esc(t('m.priceFe'))}</th></tr></thead><tbody>${table(d.skills.slice(0, 10))}</tbody></table>
          <h2 style="margin-top:16px">${esc(t('m.supports'))}</h2><table><tbody>${table(d.supports.slice(0, 15))}</tbody></table></div>
      </div>
      <div class="cards">
        <div class="card"><h2>${esc(t('m.boards'))}</h2><table><tbody>${idTable(d.boards.slice(0, 8), 'm.board')}</tbody></table></div>
        <div class="card"><h2>${esc(t('m.talents'))}</h2><table><tbody>${idTable(d.talents.slice(0, 10), 'm.talent')}</tbody></table></div>
      </div>
      ${d.servants && d.servants.length ? `<div class="card"><h2>${esc(t('m.pacts'))}</h2><table><tbody>${idTable(d.servants.slice(0, 10), 'm.pact')}</tbody></table></div>` : ''}`}`;
    bindToolbar();
    root().querySelectorAll('[data-view]').forEach((btn) => (btn.onclick = () => { classView = btn.dataset.view; show(); }));
    if (classView === 'players') { renderPlayers(c); return; }
    bindAssign();
    if ($('mTop')) $('mTop').onchange = (e) => { topN = +e.target.value; show(); };
    // « Créer un build depuis la méta » reviendra avec la partie Build (bientôt disponible).
  }

  // ---------- Classement des joueurs d'une classe ----------
  const iconRow = (list) => list.map((x) => `<span title="${esc(x.name)}">${icon(x.img)}</span>`).join('');
  async function renderPlayers(c) {
    const box = $('mPlayers');
    box.innerHTML = `<p class="muted">${esc(t('b.loading'))}</p>`;
    const sortable = !(currentRemote && fileKey.startsWith('r:global|'));
    let r;
    try { r = await tli.metaPlayers(fileKey, heroId, { sort: sortable ? plSort : 'dps', limit: plLimit, offset: 0 }); }
    catch (e) { box.innerHTML = `<p class="muted">${esc(t('share.error', { msg: errMsg(e) }))}</p>`; return; }
    const global = currentRemote && fileKey.startsWith('r:global|');
    box.innerHTML = `
      <div class="tools">
        ${sortable ? `<label class="muted">${esc(t('m.sortBy'))} <select id="mPlSort"><option value="rank" ${plSort === 'rank' ? 'selected' : ''}>${esc(t('m.sortRank'))}</option><option value="dps" ${plSort === 'dps' ? 'selected' : ''}>${esc(t('m.sortDps'))}</option></select></label>` : `<span class="muted">${esc(t('m.globalByDps'))}</span>`}
        <span class="muted">${esc(t('m.playersCount', { n: nf0.format(r.total) }))}</span>
      </div>
      <table><thead><tr><th class="r">#</th><th>${esc(t('m.player'))}</th>${global ? `<th>${esc(t('m.server'))}</th>` : ''}<th class="r">${esc(t('m.gameRank'))}</th>
        <th class="r">${esc(t('m.level'))}</th><th class="r">DPS</th><th>${esc(t('m.skills'))}</th><th>${esc(t('m.legendaries'))}</th></tr></thead><tbody>
      ${r.players.map((p, i) => `<tr class="click" data-pl="${i}">
          <td class="r muted">${p.pos}</td><td>${p.name ? `<b>${esc(p.name)}</b>` : `<span class="muted">${esc(t('m.hiddenPlayer'))}</span>`}</td>
          ${global ? `<td class="muted">${esc(p.server || '')}</td>` : ''}<td class="r muted">${p.rank}</td>
          <td class="r">${p.level}</td><td class="r">${bigNum(p.dps)}</td>
          <td>${iconRow(p.active)}</td><td>${iconRow(p.uniques)}</td></tr>
        <tr data-pldetail="${i}" hidden><td colspan="${global ? 8 : 7}"></td></tr>`).join('') || `<tr><td colspan="8" class="muted">${esc(t('d.none'))}</td></tr>`}
      </tbody></table>
      ${r.players.length < r.total ? `<button class="btn" id="mMore" style="margin-top:10px">${esc(t('m.showMore'))}</button>` : ''}`;
    if ($('mPlSort')) $('mPlSort').onchange = (e) => { plSort = e.target.value; plLimit = 50; renderPlayers(c); };
    if ($('mMore')) $('mMore').onclick = () => { plLimit = Math.min(plLimit + 100, 2000); renderPlayers(c); };
    box.querySelectorAll('tr[data-pl]').forEach((tr) => (tr.onclick = () => {
      const i = +tr.dataset.pl;
      const row = box.querySelector(`tr[data-pldetail="${i}"]`);
      if (!row.hidden) { row.hidden = true; return; }
      const p = r.players[i];
      row.querySelector('td').innerHTML = Profile.html(p, nameOf(c), portrait(c.key, 64));
      row.hidden = false;
    }));
  }

  return { show };
})();
