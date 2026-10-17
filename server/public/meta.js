document.title = `TLI Companion — ${t('navMeta')}`;
let snap = null;
let heroMap = {};
let list = [];
const pct = (p) => `${Math.round(p * 100)}%`;
const bigNum = (n) => (n >= 1e6 ? nf1.format(n / 1e6) + ' M' : n >= 1e3 ? nf1.format(n / 1e3) + ' k' : nf0.format(n));
const heroFor = (id) => list.find((h) => h.gameId === +id) || (heroMap[id] ? list.find((h) => h.key === heroMap[id].key) : null);
const className = (id) => { const h = heroFor(id); return h ? heroLabel(h) : t('unknownClass', { id }); };

// Noms des talents / arbres / pactes (ids du jeu) et icônes hébergées.
let GN = {}, ICONS = {};
async function init() {
  [GN, ICONS] = await Promise.all([api('/game_names.json'), api('/extra_icons.json').then((x) => x.icons)]);
  list = await heroes();
  heroMap = (await api('/api/heromap')).map;
  const { snapshots } = await api('/api/meta/index');
  if (!snapshots.length) { $('content').innerHTML = `<div class="empty">${esc(t('metaEmpty'))}</div>`; return; }
  SNAPS = snapshots;
  const q = new URLSearchParams(location.search);
  const legacy = (q.get('src') || '').split('|');
  const want = { server: q.get('server') || legacy[0], season: q.get('season') || (legacy[1] && String(Math.floor(legacy[1] / 100))), board: q.get('board') || legacy[2], ssf: q.get('mode') || (legacy[1] && (legacy[1] % 100 === 21 ? 'ssf' : 'sc')) };
  for (const k of FILTERS) {
    $('f_' + k).onchange = () => { fillFilters({}); load(); };
  }
  fillFilters(want);
  load();
}

// Filtres séparés : région → saison → classement → mode (chaque liste ne garde que les combinaisons existantes).
let SNAPS = [];
const fmtDate = (ms) => new Date(ms).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' });
const FILTERS = ['server', 'season', 'ssf', 'board'];
const keyOf = {
  server: (s) => s.server,
  season: (s) => String(Math.floor(s.season / 100)),
  board: (s) => String(s.mode),
  ssf: (s) => (s.season % 100 === 21 ? 'ssf' : 'sc'),
};
const labelOf = {
  server: (v) => (v === 'global' ? '🌐 ' + t('globalShort') : v),
  season: (v) => t('seasonN', { n: v }),
  // Le n° de classement ne parle à personne : on affiche la date de capture.
  board: (v, pool) => fmtDate(Math.max(...pool.filter((s) => String(s.mode) === v).map((s) => s.capturedAt))),
  ssf: (v) => (v === 'ssf' ? t('modeSsf') : t('modeSc')),
};
function fillFilters(want) {
  let pool = SNAPS;
  for (const k of FILTERS) {
    const sel = $('f_' + k);
    const vals = [...new Set(pool.map(keyOf[k]))];
    if (k === 'server') vals.sort((a, b) => (a === 'global' ? -1 : b === 'global' ? 1 : a.localeCompare(b)));
    else if (k === 'season') vals.sort((a, b) => b - a);
    else if (k === 'board') { const at = (v) => Math.max(...pool.filter((s) => String(s.mode) === v).map((s) => s.capturedAt)); vals.sort((a, b) => at(b) - at(a)); }
    else vals.sort();
    const prev = want[k] ?? sel.value;
    sel.innerHTML = vals.map((v) => `<option value="${esc(v)}">${esc(labelOf[k](v, pool))}</option>`).join('');
    sel.value = vals.includes(prev) ? prev : vals[0];
    sel.disabled = vals.length < 2;
    pool = pool.filter((s) => keyOf[k](s) === sel.value);
  }
  cur = pool[0];
}
let cur = null;
const curParams = () => `server=${encodeURIComponent(cur.server)}&season=${cur.season}&mode=${cur.mode}`;

async function load() {
  history.replaceState(null, '', '?' + FILTERS.map((k) => `${k === 'ssf' ? 'mode' : k}=${encodeURIComponent($('f_' + k).value)}`).join('&'));
  $('content').innerHTML = `<div class="empty">${esc(t('loading'))}</div>`;
  snap = await api(`/api/meta?${curParams()}&names=1`);
  $('srcInfo').textContent = t('metaInfo2', { total: nf0.format(snap.total), servers: snap.servers.join(', '), date: new Date(cur.capturedAt).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }) });
  // Tier : présence dans le top 100 (60 %) + DPS médian (40 %), comme dans l'app.
  const maxTop = Math.max(1, ...snap.classes.map((c) => c.inTop100));
  const dpsSorted = snap.classes.map((c) => c.medianDps).sort((a, b) => a - b);
  const dpsPct = (v) => (dpsSorted.length > 1 ? dpsSorted.findIndex((x) => x >= v) / (dpsSorted.length - 1) : 1);
  const classes = snap.classes.map((c) => {
    const score = Math.round(100 * (0.6 * (c.inTop100 / maxTop) + 0.4 * dpsPct(c.medianDps)));
    return { ...c, score, tier: score >= 70 ? 'S' : score >= 50 ? 'A' : score >= 30 ? 'B' : score >= 15 ? 'C' : 'D' };
  }).sort((a, b) => b.score - a.score);
  $('content').innerHTML = `<p class="muted" style="margin-bottom:8px">${esc(t('tierHelp'))}</p><table><thead><tr><th>${esc(t('tier'))}</th><th>${esc(t('colClass'))}</th><th class="r">${esc(t('players'))}</th><th>${esc(t('share'))}</th>
      <th class="r hide-sm">${esc(t('inTop100'))}</th><th class="r">${esc(t('medianDps'))}</th></tr></thead><tbody>
    ${classes.map((c) => `<tr class="click" data-hero="${c.heroId}">
      <td><span class="tier t${c.tier}" title="${c.score}/100">${c.tier}</span></td>
      <td>${portrait(heroFor(c.heroId))}<b>${esc(className(c.heroId))}</b></td><td class="r">${nf0.format(c.players)}</td>
      <td class="bar-cell" style="width:24%"><div class="bar" style="width:${Math.min(100, (c.players / snap.total) * 250)}%"></div><span>${pct(c.players / snap.total)}</span></td>
      <td class="r hide-sm">${c.inTop100}</td><td class="r">${bigNum(c.medianDps)}</td></tr>
      <tr class="detail" data-detail="${c.heroId}" hidden><td colspan="6"></td></tr>`).join('')}
    </tbody></table>`;
  document.querySelectorAll('tr[data-hero]').forEach((tr) => (tr.onclick = () => toggle(+tr.dataset.hero)));
}

function toggle(heroId) {
  const row = document.querySelector(`tr[data-detail="${heroId}"]`);
  if (!row.hidden) { row.hidden = true; return; }
  const c = snap.classes.find((x) => x.heroId === heroId);
  const item = ([id, n], denom) => {
    const [name, img] = (snap.names && snap.names[id]) || [`#${id}`, null];
    return `<tr><td>${icon(img)}${esc(name)}</td><td class="bar-cell" style="width:45%"><div class="bar" style="width:${(n / (denom || 1)) * 100}%"></div><span>${pct(n / (denom || 1))}</span></td></tr>`;
  };
  row.querySelector('td').innerHTML = `
    <p class="muted" style="margin:6px 0 10px">${esc(t('sample', { n: c.sample, skills: c.sampleWithSkills }))}</p>
    <div class="cards">
      <div class="card"><h2>${esc(t('legendaries'))}</h2><table><tbody>${c.uniques.slice(0, 15).map((p) => item(p, c.sample)).join('') || `<tr><td class="muted">${esc(t('none'))}</td></tr>`}</tbody></table></div>
      <div class="card"><h2>${esc(t('skillsTitle'))}</h2><table><tbody>${c.skills.slice(0, 8).map((p) => item(p, c.sampleWithSkills)).join('') || `<tr><td class="muted">${esc(t('none'))}</td></tr>`}</tbody></table>
        <h2 style="margin-top:14px">${esc(t('supportsTitle'))}</h2><table><tbody>${c.supports.slice(0, 12).map((p) => item(p, c.sampleWithSkills)).join('')}</tbody></table></div>
    </div>
    <h2 style="margin:6px 0 8px">${esc(t('bestPlayers'))}</h2><div data-players="${heroId}" class="muted">${esc(t('loading'))}</div>
    <p class="muted">${esc(t('getAppMeta'))}</p>`;
  row.hidden = false;
  loadPlayers(heroId);
}

// Meilleurs joueurs de la classe (pseudo sauf profil masqué) et leur build.
async function loadPlayers(heroId) {
  const box = document.querySelector(`[data-players="${heroId}"]`);
  const server = cur.server;
  try {
    const r = await api(`/api/meta/players?${curParams()}&hero=${heroId}&sort=dps&limit=50`);
    const nm = (id) => (r.names[id] || [`#${id}`, null]);
    const ic = (id) => { const [name, img] = nm(id); return `<span title="${esc(name)}">${icon(img)}</span>`; };
    box.classList.remove('muted');
    box.innerHTML = `<table><thead><tr><th class="r">#</th><th>${esc(t('player'))}</th>${server === 'global' ? `<th>${esc(t('serverCol'))}</th>` : ''}<th class="r">${esc(t('level'))}</th><th class="r">DPS</th><th>${esc(t('skillsTitle'))}</th><th>${esc(t('legendaries'))}</th></tr></thead><tbody>
      ${r.players.map((p, i) => `<tr class="click" data-p="${i}"><td class="r muted">${p.pos}</td><td>${p.name ? `<b>${esc(p.name)}</b>` : `<span class="muted">${esc(t('hidden'))}</span>`}</td>
        ${server === 'global' ? `<td class="muted">${esc(p.server)}</td>` : ''}<td class="r">${p.level}</td><td class="r">${bigNum(p.dps)}</td>
        <td>${p.active.map(([m]) => ic(m)).join('')}</td><td>${p.uniques.map(ic).join('')}</td></tr>
        <tr data-pd="${i}" hidden><td colspan="7"></td></tr>`).join('') || `<tr><td class="muted">${esc(t('none'))}</td></tr>`}
      </tbody></table>`;
    box.querySelectorAll('tr[data-p]').forEach((tr) => (tr.onclick = (e) => {
      e.stopPropagation();
      const i = +tr.dataset.p, p = r.players[i], row = box.querySelector(`tr[data-pd="${i}"]`);
      if (!row.hidden) { row.hidden = true; return; }
      const line = ([m, sup]) => `<div style="padding:3px 0">${icon(nm(m)[1])}<b>${esc(nm(m)[0])}</b> <span class="muted">→</span> ${sup.map((x) => `${icon(nm(x)[1])}${esc(nm(x)[0])}`).join(' <span class="muted">·</span> ')}</div>`;
      // Fiche joueur façon tliherorank : compétences + soutiens, talents, arbres, légendaires, pactes.
      const chip = ([name, img]) => `<span class="pchip">${img ? `<img src="${esc(img)}" alt="">` : ''}${esc(name)}</span>`;
      const gname = (cat, id) => { const n = (GN[cat] || {})[id]; return n ? [n, ICONS[n] || null] : null; };
      const prow = (label, list) => (list.length ? `<div class="prow"><div class="plabel">${esc(label)}</div><div class="pitems">${list.map(chip).join('')}</div></div>` : '');
      const skills = [...p.active, ...p.passive];
      row.querySelector('td').innerHTML = skills.length || p.uniques.length ? `<div class="profile">
          <div class="pcard"><h3>${esc(t('skillsTitle'))}</h3>${skills.map(([m, sup]) => `<div class="pskill"><div class="pskmain">${icon(nm(m)[1])}<b>${esc(nm(m)[0])}</b></div><div class="pitems">${sup.map((x) => chip(nm(x))).join('')}</div></div>`).join('')}</div>
          <div class="pcard">
            ${prow(t('coreTalents'), (p.talents || []).map((id) => gname('talents', id)).filter(Boolean))}
            ${prow(t('talentTrees'), (p.boards || []).map((id) => gname('boards', id)).filter(Boolean))}
            ${prow(t('legendaries'), p.uniques.map(nm))}
            ${prow(t('pacts'), (p.servants || []).map((id) => gname('servants', id)).filter(Boolean))}
          </div></div>`
        : `<span class="muted">${esc(t('noBuildVisible'))}</span>`;
      row.hidden = false;
    }));
  } catch (e) { box.textContent = t('error', { msg: e.message }); }
}

init().catch((e) => { $('content').innerHTML = `<div class="empty">${esc(t('error', { msg: e.message }))}</div>`; });
