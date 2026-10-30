const $ = (id) => document.getElementById(id);
let tab = 'home';
let last = null;
let seenFeed = null;
let refreshing = false;
let openReportId = null; // fiche de session affichée, pour la retraduire si la langue change

// Menu : un rail de familles à gauche, et les pages de la famille en sous-onglets en haut.
// Ajouter une page = l'ajouter à une famille ici, sans toucher au rail.
const GROUPS = {
  home: ['home'],
  farm: ['live', 'bag', 'sessions', 'runs', 'items', 'history'],
  strat: ['stratBest', 'stratRoutes'],
  builds: ['build', 'bfollow', 'bmine'],
  char: ['meta'],
  stats: ['stats'],
  market: ['prices'],
  settings: ['settings', 'scalc', 'salerts', 'sshare', 'widget', 'wlook', 'spopup', 'skeys'],
};
const groupOf = (name) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(name)) || 'home';
const lastSub = {};
function renderSubTabs(g, name) {
  const bar = $('subTabs');
  const tabs = GROUPS[g];
  bar.hidden = tabs.length < 2;
  bar.innerHTML = tabs.length < 2 ? '' : tabs.map((x) => `<button data-tab="${x}" class="${x === name ? 'on' : ''}">${esc(t('tab.' + x))}${x === 'bag' ? ' <span class="tag beta">NEW</span>' : ''}${GROUPS.builds.includes(x) ? ' <span class="tag beta">BETA</span>' : ''}</button>`).join('');
  bar.querySelectorAll('button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
}
// Un nom de page passe avant un nom de famille : « settings » est les deux, et le sous-onglet Réglages
// doit ouvrir Réglages même après un passage sur Widget. Le rail, lui, passe par showGroup.
const ALL_TABS = new Set(Object.values(GROUPS).flat());
function showGroup(g) { showTab(lastSub[g] || GROUPS[g][0]); }
function showTab(name) {
  if (!ALL_TABS.has(name) && GROUPS[name]) name = lastSub[name] || GROUPS[name][0];
  tab = name;
  const g = groupOf(name);
  lastSub[g] = name;
  document.querySelectorAll('aside.side button[data-grp]').forEach((x) => x.classList.toggle('on', x.dataset.grp === g));
  renderSubTabs(g, name);
  // Les trois pages Builds partagent la même section.
  const sectionId = GROUPS.builds.includes(name) ? 'build' : name;
  document.querySelectorAll('section').forEach((s) => s.classList.toggle('on', s.id === sectionId));
  // Les compteurs de session ne s'affichent que sur les pages de jeu.
  $('kpiBar').classList.toggle('hidden', !['live', 'runs', 'items', 'history'].includes(name));
  if (name === 'home' && last) Home.update(last);
  if (name === 'sessions') { closeSession(); loadSessions(); }
  if (name === 'prices') loadPrices();
  if (GROUPS.builds.includes(name)) Build.show(name);
  if (name === 'meta') MetaTab.show();
  if (name === 'advisor') showAdvisor();
  if (name === 'bag') Bag.show();
  if (name === 'stats') Stats.show();
  if (name === 'stratBest' || name === 'stratRoutes') Strategies.show(name);
  refresh(true);
}
document.querySelectorAll('aside.side button[data-grp]').forEach((b) => (b.onclick = () => showGroup(b.dataset.grp)));
$('supportBtn').onclick = () => tli.openSupport();
$('discordBtn').onclick = () => tli.openDiscord();
// « Donner mon avis » : texte brut seulement (type, message, contact obligatoire pour pouvoir répondre), envoyé à tlicompanion.com.
$('feedbackBtn').onclick = () => {
  modal(`<h1>${esc(t('fb.title'))}</h1>
    <p class="muted">${esc(t('fb.intro'))}</p>
    <div class="body end-form">
      <label>${esc(t('fb.type'))}<select id="fbType">${['bug', 'idea', 'question', 'other'].map((k) => `<option value="${k}">${esc(t('fb.t.' + k))}</option>`).join('')}</select></label>
      <label>${esc(t('fb.message'))}<textarea id="fbMsg" rows="6" maxlength="2000" placeholder="${esc(t('fb.messagePh'))}"></textarea></label>
      <span class="muted" id="fbCount" style="font-size:11px;text-align:right">0 / 2000</span>
      <label>${esc(t('fb.contact'))}<input id="fbContact" maxlength="100" required placeholder="${esc(t('fb.contactPh'))}"></label>
      <p class="muted" style="font-size:12px">${esc(t('fb.privacy'))}</p>
      <p id="fbMsgOut" style="font-size:13px" hidden></p>
    </div>
    <div class="foot"><button class="btn" id="fbCancel">${esc(t('fb.cancel'))}</button><button class="btn primary big" id="fbSend">${esc(t('fb.send'))}</button></div>`);
  $('fbMsg').oninput = () => { $('fbCount').textContent = `${$('fbMsg').value.length} / 2000`; };
  $('fbCancel').onclick = () => modal('');
  $('fbSend').onclick = async () => {
    const out = $('fbMsgOut');
    const message = $('fbMsg').value.trim();
    if (message.length < 10) { out.hidden = false; out.className = 'neg'; out.textContent = t('fb.tooShort'); return; }
    if ($('fbContact').value.trim().length < 3) { out.hidden = false; out.className = 'neg'; out.textContent = t('fb.needContact'); $('fbContact').focus(); return; }
    $('fbSend').disabled = true;
    const r = await tli.sendFeedback({ type: $('fbType').value, message, contact: $('fbContact').value.trim() });
    out.hidden = false;
    if (r && r.ok) { out.className = 'pos'; out.textContent = t('fb.thanks'); setTimeout(() => modal(''), 1800); }
    else { $('fbSend').disabled = false; out.className = 'neg'; out.textContent = t('fb.error', { msg: (r && r.error) || '?' }); }
  };
};
tli.onNavigate((nav) => {
  if (nav.startsWith('session:')) { showTab('sessions'); openSession(nav.slice(8)); }
  else if (nav === 'unpriced') { showTab('items'); unpricedModal(); }
  else if (nav.startsWith('endsession:')) { const id = nav.slice(11); showTab('sessions'); openSession(id).then(() => endSessionModal(id)); }
  else showTab(nav);
});

// ---------- Partage des sessions : question au démarrage + fin de session ----------
const STRATEGY_TAGS = ['mapping', 'boss', 'netherrealm', 'dream', 'vorax', 'overrealm', 'sandlord', 'clockwork', 'blacksail', 'deepspace', 'leveling', 'other'];
const tagOptions = (cur) => `<option value="">${esc(t('end.tagNone'))}</option>` +
  STRATEGY_TAGS.map((k) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(t('tag.' + k))}</option>`).join('');
function modal(html) {
  let box = $('appModal');
  if (!box) { box = document.createElement('div'); box.id = 'appModal'; document.body.appendChild(box); }
  box.innerHTML = html ? `<div class="modal-bg"><div class="modal">${html}</div></div>` : '';
  return box;
}
// Information unique (première session de farm) : les stats anonymes sont partagées, désactivable.
function farmStatsNotice() {
  if ($('fnOk')) return;
  modal(`<h1>${esc(t('fstat.title'))}</h1>
    <div class="body" style="min-height:0"><p>${esc(t('fstat.text'))}</p>
      <ul style="margin:10px 0 0 20px;line-height:1.9"><li>${esc(t('fstat.li1'))}</li><li>${esc(t('fstat.li2'))}</li><li>${esc(t('fstat.li3'))}</li></ul></div>
    <div class="foot"><button class="btn" id="fnOff">${esc(t('fstat.off'))}</button><button class="btn primary big" id="fnOk">${esc(t('fstat.ok'))}</button></div>`);
  $('fnOk').onclick = () => { modal(''); tli.action('farmStatsNotice'); };
  $('fnOff').onclick = () => { modal(''); tli.action('shareFarmStats', false); tli.action('farmStatsNotice'); };
}
// Fin de session : version simple (résumé, type de stratégie facultatif, Supprimer / Enregistrer / Partager).
// « Partager à la communauté » ouvre le formulaire complet (nom, notes, code du jeu, pseudo), puis le Void Chart.
async function endSessionModal(id) {
  const r = await tli.getReport(id);
  if (!r) return;
  const srv = last.settings.server;
  const summary = `<p class="muted">${esc(t('end.summary', { maps: r.totals.runs, profit: fe(r.totals.profit, true), hour: fe(r.totals.perHourReal), time: dur(r.totals.realMs) }))}</p>`;
  let tag = r.strategyTag || '';
  // Loot sans prix : le joueur peut leur en donner un (prix de cette session seulement).
  const unpriced = (r.loot || []).filter((i) => i.qty > 0 && !i.added && !(i.unit > 0) && i.source !== 'fe');
  const unpricedBox = () => (unpriced.length ? `<div class="end-unpriced"><p>${esc(t('end.unpriced', { n: unpriced.length }))}</p>
    ${unpriced.slice(0, 12).map((i) => `<label class="eu-row">${icon(i.img)}<span>${esc(i.name)} <em class="muted">×${qty(i.qty)}</em></span><input type="number" min="0" step="any" data-eu="${i.id}" placeholder="${esc(t('pe.ph'))}"></label>`).join('')}</div>` : '');
  const saveUnpriced = async () => {
    for (const inp of document.querySelectorAll('[data-eu]')) {
      const v = inp.value.trim().replace(',', '.');
      if (v !== '' && +v >= 0) await tli.reportPrice(id, +inp.dataset.eu, +v);
    }
  };
  const simple = () => {
    modal(`<h1>${esc(t('end.title'))}</h1>${summary}
      <div class="body end-form" style="min-height:0">${unpricedBox()}
        <label>${esc(t('end.tagOpt'))}<select id="endTag">${tagOptions(tag)}</select></label>
        <p class="muted" style="font-size:12px">${esc(t('end.tagHelp'))}</p>
      </div>
      <div class="foot"><button class="btn" id="endDrop">${esc(t('end.discard'))}</button>
        <span style="display:flex;gap:8px"><button class="btn" id="endShare">${esc(t('end.share'))}</button>
        <button class="btn primary big" id="endSave">${esc(t('end.save'))}</button></span></div>`);
    $('endTag').onchange = (e) => { tag = e.target.value; };
    $('endDrop').onclick = async () => {
      if (!(await askConfirm(t('sess.confirmDelete'), { ok: t('cf.delete'), danger: true }))) return;
      await tli.deleteReport(id); modal(''); closeSession(); loadSessions();
    };
    $('endSave').onclick = async () => {
      await saveUnpriced();
      if (tag !== (r.strategyTag || '')) await tli.updateReport(id, { strategyTag: tag });
      modal('');
      openSession(id);
    };
    $('endShare').onclick = async () => { await saveUnpriced(); full(); };
  };
  const full = () => {
    modal(`<h1>${esc(t('end.shareTitle'))}</h1>${summary}
      <div class="body end-form">
        <label>${esc(t('end.name'))}<input id="endTitle" value="${esc(r.title || (r.strategy.maps[0] ? r.strategy.maps[0].name : ''))}"></label>
        <label>${esc(t('end.tag'))}<select id="endTag">${tagOptions(tag)}</select></label>
        <label>${esc(t('end.notes'))}<textarea id="endNotes" rows="3" placeholder="${esc(t('end.notesPh'))}">${esc(r.notes || '')}</textarea></label>
        <label>${esc(t('gc.label'))}<input id="endCode" maxlength="4000" placeholder="${esc(t('gc.ph'))}" value="${esc(r.gameCode || '')}"></label>
        ${srv.registered ? '' : `<label>${esc(t('share.namePh'))}<input id="endName" maxlength="24"></label>`}
        <p class="muted" id="endMsg" style="font-size:12px">${esc(t('share.what'))}</p>
      </div>
      <div class="foot"><button class="btn" id="endBack">${esc(t('end.back'))}</button>
        <button class="btn primary big" id="endPublish">${esc(t('end.shareGo'))}</button></div>`);
    $('endTag').onchange = (e) => { tag = e.target.value; };
    $('endBack').onclick = simple;
    $('endPublish').onclick = async () => {
      const patch = { title: $('endTitle').value, notes: $('endNotes').value, strategyTag: $('endTag').value, gameCode: $('endCode').value };
      Object.assign(r, patch);
      await tli.updateReport(id, patch);
      try {
        if (!srv.registered) {
          const name = $('endName').value.trim();
          if (name.length < 2) { $('endMsg').textContent = t('share.nameShort'); return; }
          await tli.register(name);
        }
        if (!(await checkVoidChart(id))) { openSession(id); return; }
        if (!(await pickLootPacts(id))) { openSession(id); return; }
        await tli.shareReport(id);
      } catch (e) { if ($('endMsg')) $('endMsg').textContent = t('share.error', { msg: errMsg(e) }); return; }
      modal('');
      openSession(id);
    };
  };
  simple();
}

// ---------- Sessions de farm ----------
let recording = false;
$('farmToggle').onclick = async () => {
  await tli.action(recording ? 'stopFarm' : 'startFarm');
  loadSessions();
};
$('openCommunity').onclick = () => tli.openSite('/');
$('savePseudo').onclick = async () => {
  try { const r = await tli.register($('sPseudo').value.trim()); $('pseudoMsg').textContent = `✓ ${r.name}`; }
  catch (e) { $('pseudoMsg').textContent = t('share.error', { msg: errMsg(e) }); }
};
$('saveHero').onclick = async () => {
  if (!last || !last.hero) return;
  await tli.setHeroName(last.hero.id, $('sHeroClass').value);
  $('heroMsg').textContent = '✓';
};
$('sLang').onchange = (e) => tli.action('lang', e.target.value);
$('sTheme').onchange = (e) => tli.action('theme', e.target.value);

// Filtre rapide : Timemark, carte (région de la balise) et type de stratégie.
const parseMap = (name) => {
  const m = /^(.*?)\s*Beacon\s*\(Timemark\s*(\d+)\)/i.exec(name || '');
  return m ? { region: m[1].trim(), tier: m[2] } : { region: name || '', tier: '' };
};
function fillFilter(sel, values, allKey, label = (v) => v) {
  const cur = sel.value;
  sel.innerHTML = `<option value="">${esc(t(allKey))}</option>` + values.map((v) => `<option value="${esc(v)}">${esc(label(v))}</option>`).join('');
  sel.value = values.includes(cur) ? cur : '';
}
const uniq = (arr) => [...new Set(arr.filter(Boolean))];
let sessCache = [];
async function loadSessions() {
  sessCache = await tli.listReports();
  const mains = sessCache.map((r) => parseMap(r.maps[0]));
  fillFilter($('sfTier'), uniq(mains.map((m) => m.tier)).sort((a, b) => b - a), 'qf.allTiers', (v) => `Timemark ${v}`);
  fillFilter($('sfMap'), uniq(mains.map((m) => m.region)).sort(), 'qf.allMaps');
  fillFilter($('sfTag'), uniq(sessCache.map((r) => r.strategyTag)), 'qf.allTags', (v) => t('tag.' + v));
  renderSessions();
}
function renderSessions() {
  const tier = $('sfTier').value, map = $('sfMap').value, tag = $('sfTag').value;
  const list = sessCache.filter((r) => {
    const m = parseMap(r.maps[0]);
    return (!tier || m.tier === tier) && (!map || m.region === map) && (!tag || r.strategyTag === tag);
  });
  const sorts = { perHour: (a, b) => b.totals.perHourReal - a.totals.perHourReal, profit: (a, b) => b.totals.profit - a.totals.profit };
  if (sorts[$('sfSort').value]) list.sort(sorts[$('sfSort').value]);
  $('sfCount').textContent = list.length === sessCache.length ? '' : t('qf.count', { n: list.length, total: sessCache.length });
  renderLootCats(list);
  $('sessRows').innerHTML = list.map((r) => {
    const tot = r.totals;
    return `<tr class="click" data-id="${r.id}"><td class="muted">${dateTime(r.startedAt)}</td>
      <td>${r.title ? `<b>${esc(r.title)}</b><br>` : ''}<span class="muted">${esc(r.maps.join(' · '))}</span>${r.strategyTag ? ` <span class="tag">${esc(t('tag.' + r.strategyTag))}</span>` : ''}</td>
      <td>${esc(r.hero ? r.hero.name : '–')}</td><td class="r">${dur(tot.realMs)}</td><td class="r">${tot.runs}</td>
      <td class="r ${cls(tot.profit)}"><b>${fe(tot.profit, true)}</b></td><td class="r">${fe(tot.perHourReal)}</td></tr>`;
  }).join('') || `<tr><td colspan="7" class="muted">${esc(t('sess.empty'))}</td></tr>`;
  $('sessRows').querySelectorAll('tr.click').forEach((tr) => (tr.onclick = () => openSession(tr.dataset.id)));
}

// Loot par catégorie des sessions affichées (suit les filtres : carte, Timemark, type de stratégie).
// Ex. : filtre « Might » -> combien de FE viennent des braises, et en FE/h.
function renderLootCats(list) {
  const box = $('sessCats');
  const tot = {};
  let hours = 0, all = 0;
  for (const r of list) {
    hours += (r.totals.realMs || 0) / 3600000;
    for (const [c, o] of Object.entries(r.cats || {})) {
      const x = (tot[c] = tot[c] || { value: 0, items: {} });
      x.value += o.value; all += o.value;
      for (const [n, v] of Object.entries(o.items)) x.items[n] = (x.items[n] || 0) + v;
    }
  }
  const rows = Object.entries(tot).sort((a, b) => b[1].value - a[1].value);
  box.hidden = !rows.length;
  if (!rows.length) return;
  const max = rows[0][1].value;
  box.innerHTML = `<h2>${esc(t('lc.title'))} <span class="muted">${esc(t('lc.sub', { n: list.length }))}</span></h2>
    <div class="lc-list">${rows.map(([c, o]) => {
      const top = Object.entries(o.items).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n).join(', ');
      return `<div class="lc-row" title="${esc(top)}"><span class="lc-name">${esc(t('lcat.' + c))}</span>
        <span class="lc-bar"><i style="width:${Math.max(2, (o.value / max) * 100).toFixed(1)}%"></i></span>
        <b>${fe(o.value)} FE</b><span class="muted">${Math.round((o.value / (all || 1)) * 100)} %</span>
        <span class="muted">${hours > 0.02 ? fe(o.value / hours) : '–'} FE/h</span></div>`;
    }).join('')}</div>
    <p class="muted small">${esc(t('lc.help'))}</p>`;
}

function closeSession() { openReportId = null; $('sessDetail').hidden = true; $('sessList').hidden = false; }

async function openSession(id) {
  const r = await tli.getReport(id);
  if (!r) return;
  openReportId = id;
  const tot = r.totals;
  const mods = r.strategy.modifiers.filter((m) => m.desc);
  const hiddenMods = r.strategy.modifiers.length - mods.length;
  const maxMod = Math.max(1, ...mods.map((m) => m.perMap));
  const stat = (k, v, c = '') => `<div><div class="k">${esc(t(k))}</div><div class="v ${c}">${v}</div></div>`;
  $('sessDetail').innerHTML = `
    <div class="detail-head">
      <button class="btn" id="dBack">${esc(t('btn.back'))}</button>
      <input class="title" id="dTitle" placeholder="${esc(t('sess.titlePh'))}" value="${esc(r.title || '')}">
      <select id="dTag" title="${esc(t('end.tag'))}">${tagOptions(r.strategyTag)}</select>
      <button class="btn" id="dDelete">${esc(t('btn.delete'))}</button>
    </div>
    <div class="card" id="shareBox"></div>
    <div class="card cmp" id="cmpBox" hidden></div>
    <div class="card"><div class="bigstats">
      ${stat('d.profit', fe(tot.profit, true), cls(tot.profit))}
      ${stat('d.perHourReal', fe(tot.perHourReal))}
      ${stat('d.perHourMap', fe(tot.perHourMap))}
      ${stat('d.maps', tot.runs)}
      ${stat('d.duration', dur(tot.realMs))}
      ${tot.afkMs != null ? stat('d.timeSplit', `${dur(tot.mapMs)} · ${dur(tot.hubMs)} · ${dur(tot.afkMs)}`, 'txt') : ''}
      ${(tot.modes || []).length ? stat('d.modes', tot.modes.map((m) => `${m.name} ${dur(m.ms)}`).join(' · '), 'txt') : ''}
      ${tot.realMs > 60000 ? stat('d.eff', `${Math.round((tot.mapMs / tot.realMs) * 100)} %`) : ''}
      ${stat('d.avgMap', fe(tot.avgPerMap, true), cls(tot.avgPerMap))}
      ${stat('d.durMap', dur(tot.avgMapMs))}
      ${stat('d.totalCost', fe(tot.cost), 'neg')}
      ${stat('d.bagValue', tot.netWorthStart != null ? `${fe(tot.netWorthStart)} → ${fe(tot.netWorthEnd)}` : '–')}
      ${stat('d.class', esc(r.hero ? r.hero.name : '–'), 'txt')}
    </div></div>
    ${lootSection(r)}
    <div class="card"><h2>${esc(t('d.notes'))}</h2>
      <textarea id="dNotes" placeholder="${esc(t('d.notesPh'))}">${esc(r.notes || '')}</textarea>
      <label class="gc-row">${esc(t('gc.label'))}<input id="dCode" maxlength="4000" placeholder="${esc(t('gc.ph'))}" value="${esc(r.gameCode || '')}"></label>
      <p class="muted" style="font-size:12px;margin-top:4px">${esc(t('gc.help'))}</p></div>
    <div class="cards">
      <div class="card"><h2>${esc(t('d.mapsPlayed'))}</h2><table><thead><tr><th>${esc(t('col.map'))}</th><th class="r">${esc(t('col.count'))}</th><th class="r">${esc(t('col.avgProfit'))}</th><th class="r">${esc(t('col.avgDuration'))}</th></tr></thead><tbody>
        ${r.strategy.maps.map((m) => `<tr><td>${esc(m.name)}${m.zones ? `<br><span class="muted">${Object.entries(m.zones).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([z, n]) => esc(z) + (n > 1 ? ' ×' + n : '')).join(' · ')}</span>` : ''}</td><td class="r">${m.runs}</td><td class="r ${cls(m.profit)}">${fe(m.profit / m.runs, true)}</td><td class="r">${dur(m.durationMs / m.runs)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="card"><h2>${esc(t('d.consumables'))}</h2><table><thead><tr><th>${esc(t('col.item'))}</th><th class="r">${esc(t('col.perMap'))}</th><th class="r">${esc(t('col.unit'))}</th><th class="r">${esc(t('col.costPerMap'))}</th></tr></thead><tbody>
        ${r.strategy.consumables.map((c) => `<tr><td>${icon(c.img)}${esc(c.name)}</td><td class="r">${nf3.format(c.perMap)}</td><td class="r muted">${unit(c.unit)}</td><td class="r neg">${fe(-c.perMap * c.unit)}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">${esc(t('d.none'))}</td></tr>`}
      </tbody></table></div>
    </div>
    <div class="cards">
      <div class="card"><h2>${esc(t('d.modifiers'))}</h2><table><thead><tr><th class="r">${esc(t('col.perMap'))}</th><th>${esc(t('col.effect'))}</th></tr></thead><tbody>
        ${mods.slice(0, 40).map((m) => `<tr><td class="r">${nf1.format(m.perMap)}×</td><td class="bar-cell"><div class="bar" style="width:${(m.perMap / maxMod) * 100}%"></div><span>${esc(m.desc)}</span></td></tr>`).join('') || `<tr><td colspan="2" class="muted">${esc(t('d.noModifiers'))}</td></tr>`}
      </tbody></table>${hiddenMods ? `<p class="muted" style="margin-top:8px">${esc(t('d.hiddenMods', { n: hiddenMods }))}</p>` : ''}</div>
    </div>`;
  bindLootSection(r);
  $('sessDetail').insertAdjacentHTML('beforeend', '<div class="card vce" id="vceBox"></div>');
  VoidChart.mount($('vceBox'), r).catch(() => $('vceBox').remove());
  $('sessList').hidden = true;
  $('sessDetail').hidden = false;
  $('dBack').onclick = () => { closeSession(); loadSessions(); };
  $('dTitle').onchange = () => tli.updateReport(id, { title: $('dTitle').value });
  $('dNotes').onchange = () => tli.updateReport(id, { notes: $('dNotes').value });
  $('dCode').onchange = () => tli.updateReport(id, { gameCode: $('dCode').value });
  $('dTag').onchange = () => tli.updateReport(id, { strategyTag: $('dTag').value });
  $('dDelete').onclick = async () => {
    if (!(await askConfirm(t('sess.confirmDelete') + (r.shared ? '\n' + t('sess.confirmDeleteShared') : ''), { ok: t('cf.delete'), danger: true }))) return;
    await tli.deleteReport(id); closeSession(); loadSessions();
  };
  renderShare(r);
  loadCompare(id);
}

// ---------- Loot de la session : anneau (part de chaque objet dans la valeur), liste complète, export CSV ----------
// Couleurs : palette catégorielle validée (daltonisme), une version par thème ; « Autres » en gris.
const LOOT_COLORS = { dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'], light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'] };
const LOOT_SLICES = 7;
function lootRows(r) { return (r.loot || []).filter((i) => i.qty > 0); }
function lootSection(r) {
  const rows = lootRows(r);
  if (!rows.length) return `<div class="card loot-card"><div class="loot-head"><h2>${esc(t('loot.title'))}</h2><button class="btn" id="lootAdd">${esc(t('loot.add'))}</button></div></div>`;
  const total = rows.reduce((a, i) => a + Math.max(0, i.value), 0);
  const byVal = rows.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const top = byVal.slice(0, LOOT_SLICES);
  const rest = total - top.reduce((a, i) => a + i.value, 0);
  const pal = LOOT_COLORS[$('lightCss') && !$('lightCss').disabled ? 'light' : 'dark'];
  const parts = top.map((i, k) => ({ name: i.name, value: i.value, color: pal[k] }))
    .concat(rest > total * 0.001 ? [{ name: t('loot.others', { n: byVal.length - top.length }), value: rest, color: 'var(--muted)' }] : []);
  // Anneau en SVG : chaque part est un arc, avec 2 px de vide entre deux parts.
  const R = 70, W = 26, C = 2 * Math.PI * R;
  let off = 0;
  const arcs = total > 0 ? parts.map((p, k) => {
    const len = (p.value / total) * C;
    const gap = parts.length > 1 ? Math.min(2, len / 2) : 0;
    const a = `<circle class="ld-arc" data-k="${k}" r="${R}" cx="90" cy="90" fill="none" stroke="${p.color}" stroke-width="${W}" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"><title>${esc(p.name)} · ${fe(p.value)} FE · ${Math.round((p.value / total) * 100)} %</title></circle>`;
    off += len;
    return a;
  }).join('') : '';
  const pct = (v) => (total > 0 ? `${nf1.format((Math.max(0, v) / total) * 100)} %` : '–');
  const old = r.loot.length === 80;
  return `<div class="card loot-card"><div class="loot-head"><h2>${esc(t('loot.title'))}</h2>
      <span class="muted">${esc(t('loot.count', { n: rows.length }))}</span>
      <button class="btn" id="lootAdd">${esc(t('loot.add'))}</button>
      <button class="btn" id="lootCsv">${esc(t('loot.csv'))}</button></div>
    <div class="loot-top">
      <svg class="loot-donut" viewBox="0 0 180 180" role="img" aria-label="${esc(t('loot.title'))}">${arcs}
        <text x="90" y="88" text-anchor="middle" class="ld-v">${fe(total)}</text><text x="90" y="106" text-anchor="middle" class="ld-k">${esc(t('loot.totalFe'))}</text></svg>
      <ul class="loot-legend">${parts.map((p, k) => `<li data-k="${k}"><i style="background:${p.color}"></i><span>${esc(p.name)}</span><b>${fe(p.value)}</b><em>${pct(p.value)}</em></li>`).join('')}</ul>
    </div>
    <table class="loot-table"><thead><tr><th>${esc(t('col.item'))}</th><th class="r">${esc(t('col.qty'))}</th><th class="r">${esc(t('col.unit'))}</th><th class="r">${esc(t('col.value'))}</th><th class="r">%</th></tr></thead><tbody>
      ${rows.map((i) => `<tr ${i.added ? '' : `data-item="${i.id}" data-report="${r.id}"${i.edited ? ` data-sp="${i.price}"` : ''}`} class="${i.ignored ? 'ignored' : ''}${i.added ? '' : ' editable'}" title="${esc(i.ignored ? t('items.ignored') : i.added ? '' : t('loot.editTip'))}"><td>${icon(i.img)}${esc(i.name)}${i.added ? ` <span class="tag">${esc(t('loot.added'))}</span> <button class="btn mini" data-unloot="${esc(i.key)}">${esc(t('loot.remove'))}</button>` : i.edited ? ` <span class="tag">${esc(t('loot.edited'))}</span>` : ''}</td><td class="r">${qty(i.qty)}</td><td class="r muted">${unit(i.unit)}</td><td class="r ${cls(i.value)}">${fe(i.value, true)}</td><td class="r muted">${pct(i.value)}</td></tr>`).join('')}
    </tbody></table>
    ${old ? `<p class="muted" style="margin-top:8px">${esc(t('loot.old'))}</p>` : ''}</div>`;
}
function bindLootSection(r) {
  const box = document.querySelector('.loot-card');
  if (!box) return;
  $('lootAdd').onclick = () => addLootModal(r.id);
  box.querySelectorAll('[data-unloot]').forEach((b) => (b.onclick = async () => { await tli.reportRemoveLoot(r.id, b.dataset.unloot); openSession(r.id); }));
  if (!$('lootCsv')) return;
  // Survol d'une part ou d'une ligne de la légende : les deux s'allument ensemble.
  const hl = (k) => box.querySelectorAll('[data-k]').forEach((el) => el.classList.toggle('dim', k != null && el.dataset.k !== k));
  box.querySelectorAll('[data-k]').forEach((el) => { el.onmouseenter = () => hl(el.dataset.k); el.onmouseleave = () => hl(null); });
  $('lootCsv').onclick = async () => {
    // Séparateurs selon la langue : « ; » et virgule décimale en français (Excel FR), « , » et point sinon.
    const fr = LANG === 'fr';
    const sep = fr ? ';' : ',';
    const num = (v, d = 2) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', fr ? ',' : '.');
    const cell = (s) => (/[";,\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
    const rows = lootRows(r);
    const total = rows.reduce((a, i) => a + Math.max(0, i.value), 0);
    const lines = [[t('col.item'), t('col.qty'), t('loot.csvUnit'), t('loot.csvValue'), '%', t('loot.csvCounted')].map(cell).join(sep)]
      .concat(rows.map((i) => [cell(i.name), num(i.qty, 0), num(i.unit, 3), num(i.value), num(total > 0 ? (Math.max(0, i.value) / total) * 100 : 0), cell(i.ignored ? t('loot.no') : t('loot.yes'))].join(sep)));
    const name = `${r.title || (r.strategy.maps[0] ? r.strategy.maps[0].name : 'session')} ${new Date(r.startedAt).toISOString().slice(0, 10)}`;
    const saved = await tli.saveCsv(name, lines.join('\r\n'));
    if (saved) $('lootCsv').textContent = t('loot.saved');
  };
}

// Comparaison avec la communauté (stats anonymes, même carte et même Timemark).
async function loadCompare(id) {
  const c = await tli.compareStats(id);
  const box = $('cmpBox');
  if (!box || openReportId !== id || !c) return;
  box.hidden = false;
  const where = `${c.region}${c.tier ? ' · T' + c.tier : ''}`;
  // Ce qui bouge : prix qui montent ou baissent sur 3 jours, et ce que ça change par carte sur cette route (site).
  const movers = () => {
    const q = new URLSearchParams({ view: 'movers', ...(c.region ? { region: c.region } : {}), ...(c.tier ? { tier: c.tier } : {}) });
    const b = document.createElement('p');
    b.style.marginTop = '8px';
    b.innerHTML = `<a href="#" id="cmpMovers">📈 ${esc(t('cmp.movers'))}</a>`;
    box.appendChild(b);
    $('cmpMovers').onclick = (e) => { e.preventDefault(); tli.openSite('/prices?' + q.toString()); };
  };
  if (!c.enough) {
    box.innerHTML = `<h2>${esc(t('cmp.title', { map: where }))}</h2><p class="muted">${esc(t('cmp.notEnough', { n: c.players, needed: c.needed }))}</p>`;
    movers();
    return;
  }
  const pct = Math.round(((c.mine - c.median) / Math.max(1, Math.abs(c.median))) * 100);
  const bar = (v) => Math.max(2, Math.min(100, (v / Math.max(c.p90, c.mine, 1)) * 100));
  box.innerHTML = `<h2>${esc(t('cmp.title', { map: where }))}</h2>
    <div class="cmp-rows">
      <div><span>${esc(t('cmp.you'))}</span><i class="cmp-bar you" style="width:${bar(c.mine)}%"></i><b>${fe(c.mine)} FE/h</b></div>
      <div><span>${esc(t('cmp.median'))}</span><i class="cmp-bar" style="width:${bar(c.median)}%"></i><b>${fe(c.median)} FE/h</b></div>
      <div><span>${esc(t('cmp.top'))}</span><i class="cmp-bar top" style="width:${bar(c.p90)}%"></i><b>${fe(c.p90)} FE/h</b></div>
    </div>
    <p class="muted" style="margin-top:8px">${esc(t(pct >= 0 ? 'cmp.above' : 'cmp.below', { pct: Math.abs(pct), n: c.sessions, players: c.players }))}</p>
    ${c.topItems.length ? `<p style="margin-top:6px">${esc(t('cmp.topItems'))} ${c.topItems.map((i) => `<span class="chip">${icon(i.img)}${esc(i.name)}</span>`).join(' ')}</p>` : ''}`;
  movers();
}

// Zone de partage : pseudo -> confirmation -> lien public.
function renderShare(r) {
  const box = $('shareBox');
  const srv = last ? last.settings.server : { registered: false };
  if (r.shared) {
    box.innerHTML = `<h2>${esc(t('share.done'))}</h2>
      <p class="muted" style="margin-bottom:10px">${esc(t('share.visible'))} <a href="#" id="shOpen">${esc(r.shared.url)}</a></p>
      <button class="btn" id="shUpdate">${esc(t('share.update'))}</button> <button class="btn" id="shRemove">${esc(t('share.remove'))}</button> <span class="muted" id="shMsg"></span>`;
    $('shOpen').onclick = (e) => { e.preventDefault(); tli.openSite(new URL(r.shared.url).pathname); };
    $('shUpdate').onclick = () => doShare(r.id);
    $('shRemove').onclick = async () => {
      if (!(await askConfirm(t('share.confirmRemove'), { ok: t('share.remove'), danger: true }))) return;
      try { await tli.unshareReport(r.id); openSession(r.id); } catch (e) { $('shMsg').textContent = t('share.error', { msg: errMsg(e) }); }
    };
    return;
  }
  box.innerHTML = `<h2>${esc(t('share.title'))}</h2>
    <p class="muted" style="margin-bottom:10px">${esc(t('share.what'))}</p>
    ${srv.registered ? '' : `<input id="shName" placeholder="${esc(t('share.namePh'))}" style="width:260px"> `}
    <button class="btn primary" id="shGo">${esc(srv.registered ? t('share.as', { name: srv.name }) : t('share.create'))}</button>
    <span class="muted" id="shMsg"></span>`;
  $('shGo').onclick = async () => {
    try {
      if (!srv.registered) {
        const name = $('shName').value.trim();
        if (name.length < 2) { $('shMsg').textContent = t('share.nameShort'); return; }
        await tli.register(name);
      }
      await doShare(r.id);
    } catch (e) { $('shMsg').textContent = t('share.error', { msg: errMsg(e) }); }
  };
}

// Avant de publier : le Void Chart est deviné depuis le log, donc souvent incomplet. Le joueur le voit,
// le corrige et doit le valider (avec un avertissement) avant l'envoi. Une seule fois par session.
async function checkVoidChart(id) {
  const r = await tli.getReport(id);
  if (!r || r.voidChartChecked) return true;
  return new Promise((resolve) => {
    modal(`<div class="vcm"><h1>${esc(t('vcm.title'))}</h1>
      <p class="vcm-warn">${esc(t('vcm.warn'))}</p>
      <div class="vce" id="vcmBox"></div>
      <div class="foot"><button class="btn" id="vcmCancel">${esc(t('vcm.cancel'))}</button><button class="btn primary big" id="vcmOk">${esc(t('vcm.ok'))}</button></div></div>`);
    let ed = null;
    VoidChart.mount($('vcmBox'), r).then((x) => { ed = x; }).catch(() => { if ($('vcmBox')) $('vcmBox').textContent = ''; });
    $('vcmCancel').onclick = () => { modal(''); resolve(false); };
    $('vcmOk').onclick = async () => {
      if (!(await askConfirm(t('vcm.confirm'), { title: t('vcm.confirmTitle'), ok: t('vcm.confirmOk'), cancel: t('vcm.confirmBack') }))) return;
      if (ed) ed.save(); // l'arbre affiché (deviné ou corrigé) devient celui de la route
      await tli.updateReport(id, { voidChartChecked: true });
      modal('');
      resolve(true);
    };
  });
}

// Juste après le Void Chart : le joueur indique ses pactspirits de loot (le jeu ne les écrit pas pendant la
// session). Pré-rempli avec ceux de la route, sinon ceux de la dernière route partagée. Facultatif.
async function pickLootPacts(id) {
  const r = await tli.getReport(id);
  if (!r) return true;
  const { list, last: prev, owned = [], signedIn, accounts } = await tli.lootPacts();
  // Pactes de loot de ma collection (compte), les plus hauts niveaux d'abord.
  const RANK = { Legendary: 0, Rare: 1, Magic: 2 };
  const rarity = Object.fromEntries(list.map((p) => [p.name, p.rarity]));
  const mineDrop = owned.filter((p) => rarity[p.name]).sort((a, b) => (b.level || 0) - (a.level || 0) || RANK[rarity[a.name]] - RANK[rarity[b.name]]);
  const ownedLv = Object.fromEntries(owned.map((p) => [p.name, p.level]));
  const fromAccount = !(r.lootPacts && r.lootPacts.length) && !(prev && prev.length) && mineDrop.length > 0;
  const cur = (r.lootPacts && r.lootPacts.length ? r.lootPacts : null) || (prev && prev.length ? prev : null) || mineDrop.slice(0, 3);
  const RAR = ['Legendary', 'Rare', 'Magic'];
  const opts = (sel) => `<option value="">${esc(t('lp.none'))}</option>`
    + (mineDrop.length ? `<optgroup label="${esc(t('lp.mine'))}">${mineDrop.map((p) => `<option value="${esc(p.name)}"${p.name === sel ? ' selected' : ''}>${esc(p.name)}${p.level ? ' · ' + esc(t('lp.lv', { n: p.level })) : ''}</option>`).join('')}</optgroup>` : '')
    + RAR.map((rar) => `<optgroup label="${esc(t('lp.r.' + rar))}">${list.filter((p) => p.rarity === rar && !(p.name in ownedLv && rarity[p.name]))
      .map((p) => `<option${p.name === sel ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
  const lv = (sel) => `<option value="">${esc(t('lp.level'))}</option>` + [1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}"${n === sel ? ' selected' : ''}>${esc(t('lp.lv', { n }))}</option>`).join('');
  return new Promise((resolve) => {
    modal(`<h1>${esc(t('lp.title'))}</h1>
      <div class="body end-form" style="min-height:0"><p class="muted">${esc(t('lp.help'))}</p>
        ${fromAccount ? `<p class="lp-note">${esc(t('lp.fromAccount'))}</p>` : ''}
        ${[0, 1, 2].map((i) => `<div class="lp-row"><select data-lp="${i}">${opts(cur[i] && cur[i].name)}</select><select data-lpl="${i}">${lv(cur[i] && cur[i].level)}</select></div>`).join('')}
        ${accounts && !signedIn ? `<div class="lp-login"><span>${esc(t('lp.loginHint'))}</span><button class="btn" id="lpLogin">${esc(t('lp.login'))}</button></div>`
          : signedIn ? `<p class="muted small">${esc(t('lp.collection'))} <a href="#" id="lpSite">${esc(t('lp.collectionLink'))}</a></p>` : ''}
      </div>
      <div class="foot"><button class="btn" id="lpCancel">${esc(t('vcm.cancel'))}</button>
        <span style="display:flex;gap:8px"><button class="btn" id="lpSkip">${esc(t('lp.skip'))}</button><button class="btn primary big" id="lpOk">${esc(t('lp.ok'))}</button></span></div>`);
    // Choisir un pacte de ma collection remplit aussi son niveau.
    document.querySelectorAll('[data-lp]').forEach((s) => (s.onchange = () => {
      const lvSel = document.querySelector(`[data-lpl="${s.dataset.lp}"]`);
      if (ownedLv[s.value]) lvSel.value = String(ownedLv[s.value]);
    }));
    if ($('lpSite')) $('lpSite').onclick = (e) => { e.preventDefault(); tli.openSite('/pacts'); };
    if ($('lpLogin')) $('lpLogin').onclick = async () => {
      $('lpLogin').disabled = true;
      $('lpLogin').textContent = t('lp.loginWait');
      try { await tli.googleLogin(); modal(''); resolve(await pickLootPacts(id)); }
      catch { $('lpLogin').disabled = false; $('lpLogin').textContent = t('lp.login'); }
    };
    $('lpCancel').onclick = () => { modal(''); resolve(false); };
    $('lpSkip').onclick = async () => { await tli.updateReport(id, { lootPacts: [] }); modal(''); resolve(true); };
    $('lpOk').onclick = async () => {
      const picked = [0, 1, 2].map((i) => ({ name: document.querySelector(`[data-lp="${i}"]`).value, level: +document.querySelector(`[data-lpl="${i}"]`).value || null })).filter((p) => p.name);
      await tli.updateReport(id, { lootPacts: picked });
      if (signedIn && picked.length) tli.addMyPacts(picked).catch(() => {});
      modal('');
      resolve(true);
    };
  });
}

async function doShare(id) {
  if ($('shMsg')) $('shMsg').textContent = t('share.sending');
  try {
    await tli.updateReport(id, { title: $('dTitle').value, notes: $('dNotes').value, strategyTag: $('dTag').value, gameCode: $('dCode').value });
    if (!(await checkVoidChart(id))) { openSession(id); return; }
    if (!(await pickLootPacts(id))) { openSession(id); return; }
    await tli.shareReport(id);
    openSession(id);
  } catch (e) { if ($('shMsg')) $('shMsg').textContent = t('share.error', { msg: errMsg(e) }); }
}

['fLoot', 'fCost', 'fOther', 'fText'].forEach((id) => ($(id).oninput = () => refresh(true)));
$('newSession').onclick = () => tli.action('newSession');
$('pickLog').onclick = () => tli.action('pickLog');
$('pickGame').onclick = () => tli.action('pickGame');
$('sMode').onchange = (e) => tli.action('mode', e.target.value);
$('sTime').onchange = (e) => tli.action('timeMode', e.target.value);
$('sModeTime').onchange = (e) => tli.action('countModeTime', e.target.checked);
$('sCommunity').onchange = (e) => tli.action('community', e.target.checked);
$('sShareMeta').onchange = (e) => tli.action('shareMeta', e.target.checked);
$('sStock').onchange = (e) => tli.action('stockAlerts', e.target.checked);
$('sFarmStats').onchange = (e) => tli.action('shareFarmStats', e.target.checked);
$('sCheckUpd').onclick = () => tli.action('checkUpdates');
$('sTartarus').onchange = (e) => tli.action('tartarusAlerts', e.target.checked);
$('sStar').onchange = (e) => tli.action('starAlerts', e.target.checked);
$('sMinLoot').onchange = (e) => tli.action('minLootValue', e.target.value);
$('sAfterTax').onchange = (e) => tli.action('afterTax', e.target.checked);
$('sTaxRate').onchange = (e) => tli.action('taxRate', e.target.value);
$('sStockTest').onclick = () => tli.action('testStockAlert');
tli.onStockAlert((a) => { flash(stockText(a)); if (a.sound) alertSound(a); });
// Son de chaque alerte : son intégré ou fichier du joueur (bouton ▶ pour écouter).
function renderSounds(s) {
  document.querySelectorAll('[data-sndname]').forEach((el) => {
    const v = s.settings.sounds[el.dataset.sndname] || 'builtin';
    el.textContent = v.startsWith('file:') ? t('snd.myFile', { name: v.split(/[\\/]/).pop() }) : t(el.dataset.sndname === 'stock' || el.dataset.sndname === 'beacon' ? 'snd.builtinBeeps' : 'snd.builtin');
    document.querySelector(`[data-sndreset="${el.dataset.sndname}"]`).hidden = !v.startsWith('file:');
  });
  document.querySelectorAll('[data-sndvol]').forEach((r) => {
    const v = (s.settings.volumes || {})[r.dataset.sndvol] ?? 100;
    if (document.activeElement !== r) r.value = v;
    document.querySelector(`[data-sndvolv="${r.dataset.sndvol}"]`).textContent = `${r.value} %`;
  });
}
document.querySelectorAll('[data-sndfile]').forEach((b) => (b.onclick = () => tli.action('pickSound', b.dataset.sndfile)));
document.querySelectorAll('[data-sndreset]').forEach((b) => (b.onclick = () => tli.action('resetSound', b.dataset.sndreset)));
// Volume de chaque son : enregistré en lâchant le curseur, et on fait entendre le résultat.
document.querySelectorAll('[data-sndvol]').forEach((r) => {
  r.oninput = () => { document.querySelector(`[data-sndvolv="${r.dataset.sndvol}"]`).textContent = `${r.value} %`; };
  r.onchange = () => { tli.action('soundVolume', { key: r.dataset.sndvol, v: +r.value }); document.querySelector(`[data-sndtest="${r.dataset.sndvol}"]`).click(); };
});
let testLevel = 10;
document.querySelectorAll('[data-sndtest]').forEach((b) => (b.onclick = async () => {
  const k = b.dataset.sndtest;
  // Stock : chaque clic fait entendre le palier suivant (1, 2 puis 3 bips).
  if (k === 'stock' || k === 'beacon') testLevel = testLevel === 10 ? 5 : testLevel === 5 ? 1 : 10;
  const volEl = document.querySelector(`[data-sndvol="${k}"]`);
  alertSound({ volume: volEl ? +volEl.value / 100 : 1, soundSpec: await tli.soundSpec(k), kind: k === 'starFull' ? 'star-full' : ['stock', 'beacon', 'beaconEmpty'].includes(k) ? 'stock' : k === 'tartarusFull' ? 'tartarus-full' : 'tartarus-ready', level: k === 'beaconEmpty' ? 0 : ['stock', 'beacon'].includes(k) ? testLevel : 5 });
}));
$('refreshCommunity').onclick = () => tli.action('refreshCommunity');
$('saveHub').onclick = () => tli.action('hubPatterns', $('sHub').value);
$('sOpacity').onchange = (e) => tli.action('opacity', +e.target.value);
$('sScale').onchange = (e) => tli.action('scale', +e.target.value);
$('sSolid').onchange = (e) => tli.action('solid', e.target.checked);
$('sUltra').onchange = (e) => tli.action('ultra', e.target.checked);
// Lignes du mode ultra minimal (au moins une reste cochée).
document.querySelectorAll('#ultraLines [data-ul]').forEach((cb) => (cb.onchange = () => {
  const on = [...document.querySelectorAll('#ultraLines [data-ul]')].filter((x) => x.checked).map((x) => x.dataset.ul);
  if (!on.length) { cb.checked = true; return; }
  tli.action('ultraLines', on);
}));
$('sRate').onchange = (e) => tli.action('rateUnit', e.target.value);
for (const [id, act] of [['sUnitPrice', 'unitPrice'], ['sNoFlash', 'noFlash'], ['sCompact', 'compact']]) $(id).onchange = (e) => tli.action(act, e.target.checked);
$('sPopup').onchange = (e) => tli.action('popup', e.target.checked);
$('popPlace').onclick = () => tli.action(last && last.popupPlacing ? 'popupPlaced' : 'popupPlace');
$('popTest').onclick = () => tli.action('popupTest');
// Taille et couleur du popup (les effets suivent la couleur). Couleurs prêtes + n'importe quelle couleur.
const POP_COLORS = ['#ffd447', '#ff9a3d', '#5fe38d', '#4fd8ff', '#ff6fb5', '#ffffff'];
$('popColors').innerHTML = POP_COLORS.map((c) => `<button class="pop-sw" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('');
$('popColors').querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => tli.action('popupColor', b.dataset.c)));
$('popColor').oninput = (e) => tli.action('popupColor', e.target.value);
// Taille affichée en pixels (46 px à 100 %).
const popPx = (k) => Math.round(46 * k) + ' px';
$('popSize').oninput = (e) => { $('popSizeV').textContent = popPx(+e.target.value); tli.action('popupSize', +e.target.value); };
$('popGlow').oninput = (e) => { $('popGlowV').textContent = Math.round(e.target.value * 100) + ' %'; tli.action('popupGlow', +e.target.value); };
$('popRainbow').onchange = (e) => tli.action('popupRainbow', e.target.checked);
$('popHold').oninput = (e) => { $('popHoldV').textContent = e.target.value + ' s'; tli.action('popupHold', +e.target.value); };
$('popFly').onchange = (e) => tli.action('popupFly', e.target.checked);
$('sAutoPause').onchange = (e) => tli.action('autoPause', e.target.checked);
// Réglages > Contenu du widget : une case par info, regroupées comme dans le widget.
const WIDGET_GROUPS = [
  ['wc.g.top', ['barPerHour']],
  ['wc.g.map', ['now']],
  ['wc.g.stats', ['session', 'perHour', 'maps']],
  ['wc.g.line', ['avg', 'avgTime', 'cost', 'total']],
  ['wc.g.other', ['tartarus', 'drops']],
];
function renderWidgetCfg(s) {
  const box = $('wCfg');
  if (!box) return;
  const off = new Set(s.settings.overlay.hide || []);
  const sig = [...off].sort().join(',') + '|' + (window.LANG || '');
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = WIDGET_GROUPS.map(([g, keys]) => `<div class="wc-group"><span class="wc-g">${esc(t(g))}</span>${keys.map((k) =>
    `<label class="wc-item ${off.has(k) ? '' : 'on'}"><input type="checkbox" data-wk="${k}" ${off.has(k) ? '' : 'checked'}> ${esc(t('wc.k.' + k))}</label>`).join('')}</div>`).join('')
    + `<button class="btn ghost" id="wcAll" style="margin-top:6px">${esc(t('wc.all'))}</button>`;
  box.querySelectorAll('input[data-wk]').forEach((c) => (c.onchange = () => tli.action('widgetShow', { key: c.dataset.wk, show: c.checked })));
  $('wcAll').onclick = () => tli.action('widgetShowAll');
}
$('sLock').onchange = (e) => tli.action('lock', e.target.checked);
// Compte (bêta) : connexion avec Google pour retrouver ses builds et routes partout.
let accBusy = false;
function renderAccount(srv) {
  const box = $('accBox');
  if (!box) return;
  const key = `${srv.google}|${srv.registered}|${srv.name}|${accBusy}|${LANG}`;
  if (box.dataset.k === key) return;
  box.dataset.k = key;
  box.innerHTML = srv.google
    ? `<span class="chip ok">${esc(t('acc.connected', { name: srv.name || '?' }))}</span> <a href="#" id="accSite">${esc(t('acc.openSite'))}</a> · <a href="#" id="accOut">${esc(t('acc.logout'))}</a>`
    : `<button class="btn primary" id="accIn" ${accBusy ? 'disabled' : ''}>${esc(t(accBusy ? 'acc.waiting' : 'acc.signIn'))}</button> <span class="muted">${esc(t(srv.registered ? 'acc.helpLink' : 'acc.help'))}</span> <span id="accMsg"></span>`;
  if ($('accSite')) $('accSite').onclick = (e) => { e.preventDefault(); tli.openSite('/account'); };
  if ($('accOut')) $('accOut').onclick = async (e) => { e.preventDefault(); if (await askConfirm(t('acc.confirmLogout'), { ok: t('cf.logout') })) await tli.accountLogout(); };
  if ($('accIn')) $('accIn').onclick = async () => {
    accBusy = true; renderAccount(srv);
    try { const r = await tli.googleLogin(); if (!r.named) $('sPseudo').focus(); }
    catch (e) { accBusy = false; renderAccount(srv); if ($('accMsg')) $('accMsg').textContent = t('share.error', { msg: errMsg(e) }); return; }
    accBusy = false;
  };
}
$('sDropsSort').onchange = (e) => tli.action('dropsSort', e.target.value);

let searchTimer;
$('pSearch').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadPrices, 200); };

function setVal(el, v, signed = true) { el.textContent = fe(v, signed); el.className = 'v ' + cls(v); }

// Fenêtre « Nouveautés » une fois après chaque mise à jour.
let whatsNewChecked = false;
let whatsNewDone = false; // la fenêtre « Nouveautés » passe avant l'information sur les stats anonymes
async function whatsNewModal() {
  const w = await tli.whatsNew();
  if (!w) { whatsNewDone = true; return; }
  modal(`<h1>${esc(t('wn.title', { v: w.version }))}</h1>
    <div class="body wn">${w.releases.map((r) => `<h3>v${esc(r.version)} <span class="muted">· ${esc(new Date(r.date + 'T12:00:00').toLocaleDateString(LOCALE))}</span></h3>
      <ul>${(r[LANG] || r.en).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}</div>
    <div class="foot"><span></span><button class="btn primary big" id="wnOk">${esc(t('wn.ok'))}</button></div>`);
  $('wnOk').onclick = () => { modal(''); whatsNewDone = true; tli.action('seenVersion'); };
}

// Tutoriel « astuces » : 5 écrans courts sur ce qu'on ne trouve pas seul. Une fois pour tout le monde
// (après « Nouveautés »), puis depuis Réglages › Revoir les astuces. TIPS_V : à augmenter pour le remontrer.
const TIPS_V = 1;
let tipsOpen = false;
const TIPS = [
  { icon: '👋', k: 1 }, { icon: '🧩', k: 2 }, { icon: '⚙️', k: 3 }, { icon: '⌨️', k: 4 }, { icon: '🌍', k: 5 },
];
function tipsModal(step = 0) {
  tipsOpen = true;
  const s = TIPS[step];
  const lines = t('tour.b' + s.k).split('\n');
  modal(`<div class="tour"><div class="steps">${TIPS.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="tour-ico">${s.icon}</div><h1>${esc(t('tour.t' + s.k))}</h1>
    <ul class="tour-list">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
    <div class="foot"><button class="btn" id="tourSkip">${esc(t(step ? 'tour.back' : 'tour.skip'))}</button>
      <span class="muted">${step + 1} / ${TIPS.length}</span>
      <button class="btn primary big" id="tourNext">${esc(t(step === TIPS.length - 1 ? 'tour.done' : 'tour.next'))}</button></div></div>`);
  const close = () => { modal(''); tipsOpen = false; tli.action('tipsSeen', TIPS_V); };
  $('tourNext').onclick = () => (step === TIPS.length - 1 ? close() : tipsModal(step + 1));
  $('tourSkip').onclick = () => (step ? tipsModal(step - 1) : close());
}
if ($('sTips')) $('sTips').onclick = () => tipsModal(0);

// ---------- Raccourcis modifiables (Réglages) ----------
// Clic sur un raccourci, puis la nouvelle combinaison. Échap annule, Suppr / Retour arrière le retire.
let scState = null, scCapture = null, scSig = '';
function scErr(msg) { $('scErr').hidden = !msg; $('scErr').textContent = msg || ''; }
function renderShortcuts(s, force) {
  scState = s.settings.shortcuts || {};
  const sig = LANG + JSON.stringify(scState);
  if (scCapture || (!force && sig === scSig)) return;
  scSig = sig;
  $('scList').innerHTML = I18N.SC_KEYS.map((k) => `<span>${esc(t('sc.' + k))}</span><button class="btn" data-sc="${k}">${esc(I18N.scLabel(scState[k], LANG))}</button>`).join('');
  $('scList').querySelectorAll('[data-sc]').forEach((b) => (b.onclick = () => startCapture(b)));
}
function startCapture(btn) {
  if (scCapture) return;
  scErr('');
  scCapture = btn.dataset.sc;
  btn.classList.add('cap');
  btn.textContent = t('sc.press');
  const stop = () => { document.removeEventListener('keydown', onKey, true); scCapture = null; renderShortcuts({ settings: { shortcuts: scState } }, true); };
  const onKey = (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(ev.key)) return;
    if (ev.key === 'Escape') return stop();
    const key = scCapture;
    let acc;
    if (ev.key === 'Delete' || ev.key === 'Backspace') acc = '';
    else {
      const m = /^Key([A-Z])$|^Digit([0-9])$|^(F(?:[1-9]|1[0-9]|2[0-4]))$/.exec(ev.code);
      if (!m) return;
      const main = m[1] || m[2] || m[3];
      if (!ev.ctrlKey && !ev.altKey && !m[3]) { scErr(t('sc.needMod')); return; }
      acc = [ev.ctrlKey && 'CommandOrControl', ev.altKey && 'Alt', ev.shiftKey && 'Shift', main].filter(Boolean).join('+');
    }
    stop();
    tli.action('shortcut', { key, acc }).then((r) => {
      if (r && r.error === 'dup') scErr(t('sc.dup', { what: t('sc.' + r.key) }));
      else if (r && r.error === 'busy') scErr(t('sc.busy'));
    });
  };
  document.addEventListener('keydown', onKey, true);
}
$('scReset').onclick = () => { scErr(''); tli.action('resetShortcuts'); };

tli.onState((s) => {
  last = s;
  // Thème clair (Réglages) : feuille de style claire générée à partir de app.css.
  const light = s.settings.theme === 'light';
  if ($('lightCss').disabled === light) $('lightCss').disabled = !light;
  // Après ce passage (la langue choisie est appliquée plus bas) : sinon les fenêtres s'affichent en anglais.
  if (!whatsNewChecked && s.settings.onboarded) { whatsNewChecked = true; setTimeout(whatsNewModal, 0); }
  // Session de farm qui démarre sans réponse : on demande (la question disparaît si le widget a répondu).
  // Information unique : dès que l'app est prête (toutes les cartes jouées comptent, pas seulement les sessions).
  if (s.settings.onboarded && whatsNewDone && !tipsOpen && (s.settings.tipsSeen || 0) < TIPS_V && !$('wnOk') && !$('fnOk')) setTimeout(() => { if (!tipsOpen && !$('wnOk')) tipsModal(0); }, 0);
  if (s.settings.onboarded && whatsNewDone && !tipsOpen && (s.settings.tipsSeen || 0) >= TIPS_V && !s.settings.farmStatsNotice && !$('wnOk')) setTimeout(farmStatsNotice, 0);
  if (setLang(s.settings.lang, s.settings.shortcuts)) {
    // Langue changée : on redessine ce qui est généré en JS.
    $('feed').dataset.h = '';
    if (tab === 'sessions') { if (openReportId) openSession(openReportId); else loadSessions(); }
    if (tab === 'prices') loadPrices();
    if (GROUPS.builds.includes(tab)) Build.show(tab);
    if (tab === 'meta') MetaTab.show();
    refresh(true);
  }
  const ss = s.session;
  setVal($('kProfit'), ss.profit);
  setVal($('kHour'), ss.perHour, false);
  $('kRuns').textContent = ss.runs;
  setVal($('kAvg'), ss.avgPerRun);
  setVal($('kLoot'), ss.loot);
  setVal($('kCost'), ss.cost);
  setVal($('kOther'), ss.other);
  $('kCost').parentElement.title = costTip(ss.costBreakdown);
  $('kOther').parentElement.style.opacity = s.mode === 'all' ? 1 : 0.45;
  $('kTime').textContent = dur(s.timeMode === 'map' ? ss.mapTimeMs : ss.realTimeMs);
  // Efficacité = part du temps passée en carte ; le détail est dans l'infobulle.
  $('kEff').textContent = ss.efficiency == null ? '–' : `${Math.round(ss.efficiency * 100)} %`;
  $('kEffBox').title = t('k.effTip', { map: dur(ss.mapTimeMs), hub: dur(ss.hubTimeMs || 0), afk: dur(ss.afkTimeMs || 0) });
  // Chronos des modes à part (Tartarus, Vorax, Arcana, Aeterna…) de la session.
  const modes = ss.modes || [];
  $('kModes').hidden = !modes.length;
  if (modes.length) {
    $('kModes').innerHTML = `<span class="muted">${esc(t('k.modes'))}</span> ${modes.map((m) => `<span class="kmode${ss.modeNow && ss.modeNow.name === m.name ? ' now' : ''}">${esc(m.name)} <b>${dur(m.ms)}</b></span>`).join('')}`
      + (ss.countModes ? '' : ` <span class="muted small">${esc(t('k.modesOut'))}</span>`);
  }

  const st = s.status;
  const stateTxt = t('st.' + st.state, { pct: Math.round(st.progress * 100) });
  const msg = st.msgKey ? t(st.msgKey, st.msgVars) : '';
  $('statusLine').innerHTML = `<b>${esc(stateTxt)}</b> · ${esc(s.zone.hub ? t('zone.hideout') : t('zone.inMap'))} · ${s.snapshotReady ? esc(t('st.bagOk')) : `<span class="neg">${esc(t('st.bagUnknown'))}</span>`}${msg ? ' · ' + esc(msg) : ''}`;

  if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
    $('logPath').textContent = st.logPath || t('set.logNotFound');
    $('sMode').value = s.mode;
    $('sTime').value = s.timeMode;
    $('sModeTime').checked = s.settings.countModeTime !== false;
    renderShortcuts(s);
    $('sLang').value = LANG;
    $('sTheme').value = s.settings.theme === 'light' ? 'light' : 'dark';
    $('sCommunity').checked = s.settings.communityPrices;
    $('sShareMeta').checked = s.settings.shareMeta !== false;
    $('sStock').checked = s.settings.stockAlerts !== false;
    $('sFarmStats').checked = s.settings.shareFarmStats !== false;
    $('sTartarus').checked = s.settings.tartarusAlerts !== false;
    renderSounds(s);
    if (document.activeElement !== $('sMinLoot')) $('sMinLoot').value = s.settings.minLootValue || 0;
    $('sAfterTax').checked = !!s.settings.afterTax;
    if (document.activeElement !== $('sTaxRate')) $('sTaxRate').value = s.settings.taxRate ?? 12.5;
    $('sTaxRate').disabled = !s.settings.afterTax;
    $('sHub').value = s.settings.hubPatterns.join(', ');
    $('sOpacity').value = s.settings.overlay.opacity;
    $('sScale').value = s.settings.overlay.scale;
    $('sSolid').checked = !!s.settings.overlay.solid;
    $('sUltra').checked = !!s.settings.overlay.ultra;
    const ul = s.settings.overlay.ultraLines || ['rec', 'map', 'ph', 'sess'];
    $('ultraLines').hidden = !s.settings.overlay.ultra;
    document.querySelectorAll('#ultraLines [data-ul]').forEach((cb) => (cb.checked = ul.includes(cb.dataset.ul)));
    $('sUnitPrice').checked = !!s.settings.overlay.unitPrice;
    $('sNoFlash').checked = !!s.settings.overlay.noFlash;
    $('sCompact').checked = !!s.settings.overlay.compact;
    $('sRate').value = ['min', 'day'].includes(s.settings.overlay.rateUnit) ? s.settings.overlay.rateUnit : 'hour';
    $('sPopup').checked = !!(s.settings.popup && s.settings.popup.enabled);
    $('popPlace').textContent = t(s.popupPlacing ? 'pop.placeDone' : 'pop.place');
    $('popPlace').classList.toggle('primary', !!s.popupPlacing);
    const pp = s.settings.popup || {};
    if (document.activeElement !== $('popSize')) { $('popSize').value = pp.size || 1; $('popSizeV').textContent = popPx(pp.size || 1); }
    const gl = pp.glow != null ? pp.glow : 1;
    if (document.activeElement !== $('popGlow')) { $('popGlow').value = gl; $('popGlowV').textContent = Math.round(gl * 100) + ' %'; }
    $('popRainbow').checked = pp.rainbow !== false;
    $('popFly').checked = pp.fly !== false;
    if (document.activeElement !== $('popHold')) { $('popHold').value = pp.hold || 5; $('popHoldV').textContent = (pp.hold || 5) + ' s'; }
    if (document.activeElement !== $('popColor')) $('popColor').value = pp.color || '#ffd447';
    $('popColors').querySelectorAll('[data-c]').forEach((b) => b.classList.toggle('on', b.dataset.c === (pp.color || '#ffd447')));
    $('sStar').checked = s.settings.starAlerts !== false;
    $('sAutoPause').checked = s.settings.autoPause !== false;
    $('sLock').checked = !!s.settings.overlay.locked;
    // Comptes (bêta) : visibles seulement quand ils sont activés.
    document.querySelectorAll('.acc-row').forEach((el) => (el.hidden = !(s.features && s.features.accounts)));
    if (s.features && s.features.accounts) renderAccount(s.settings.server);
    $('sDropsSort').value = ['value', 'map'].includes(s.settings.overlay.dropsSort) ? s.settings.overlay.dropsSort : 'recent';
    $('sOpacity').disabled = !!s.settings.overlay.solid;
  }
  $('zoneNow').textContent = s.zone.name;
  recording = s.recording;
  renderWidgetCfg(s);
  document.querySelector('aside.side button[data-grp="farm"]').classList.toggle('rec', !!recording);
  $('farmToggle').textContent = recording ? t('sess.stop', { time: dur(ss.realTimeMs) }) : t('sess.start');
  $('farmToggle').style.background = recording ? 'var(--neg)' : '';
  $('heroHelp').textContent = t('set.heroHelp', { id: s.hero ? s.hero.id : t('set.heroNotSeen') });
  if (document.activeElement !== $('sPseudo')) $('sPseudo').value = s.settings.server.name || '';
  // Liste remplie avant que la langue soit connue : on traduit la ligne « choisis une classe ».
  const pick = $('sHeroClass').options[0];
  if (pick && !pick.value) pick.textContent = t('b.pickClass');
  if (document.activeElement !== $('sHeroClass') && s.hero && s.hero.key) $('sHeroClass').value = s.hero.key;
  // Profil en bas du menu
  $('meName').textContent = s.settings.server.name || t('h.guest');
  $('meSub').textContent = s.hero ? s.hero.name.split(' — ').pop() : '';
  const hk = s.hero && s.hero.key;
  if ($('meAvatar').dataset.k !== String(hk)) {
    $('meAvatar').dataset.k = String(hk);
    tli.getHeroes().then((hs) => { const h = hs.find((x) => x.key === hk); $('meAvatar').innerHTML = h ? `<img class="portrait" src="${esc(h.portrait)}">` : esc((s.settings.server.name || '?').slice(0, 1).toUpperCase()); });
  }
  if (tab === 'home') Home.update(s);
  Home.onboarding(s);
  renderUpdateBar(s);
  refresh();
});

async function refresh(force) {
  if (refreshing) return;
  if (!['live', 'runs', 'items', 'history'].includes(tab)) return;
  if (tab === 'history' && !force) return;
  refreshing = true;
  try {
    if (tab === 'history') renderHistory(await tli.getHistory());
    else {
      const d = await tli.getFull();
      if (tab === 'live') renderFeed(d.feed);
      if (tab === 'runs') renderRuns(d.current, d.runs);
      if (tab === 'items') renderItems(d.items);
    }
  } finally { refreshing = false; }
}

function renderFeed(feed) {
  const show = { loot: $('fLoot').checked, cost: $('fCost').checked, other: $('fOther').checked };
  const q = $('fText').value.trim().toLowerCase();
  const rows = feed.filter((e) => show[e.cat] && (!q || e.name.toLowerCase().includes(q))).slice(0, 400);
  const now = new Set(rows.map((e) => `${e.ts}|${e.id}|${e.delta}`));
  const html = rows.map((e) => {
    const k = `${e.ts}|${e.id}|${e.delta}`;
    const isNew = seenFeed && !seenFeed.has(k);
    return `<tr class="${isNew ? 'new' : ''}"><td class="muted">${clock(e.ts)}</td><td>${icon(e.img)}${esc(e.name)}</td><td class="r">${qty(e.delta)}</td><td class="r muted">${unit(e.unit)}</td><td class="r ${cls(e.value)}">${fe(e.value, true)}</td><td><span class="tag ${e.cat}">${esc(t('type.' + e.cat))}</span></td><td class="muted">${esc(e.proto)}</td><td class="muted">${esc(zoneLabel(e.zone))}</td></tr>`;
  }).join('') || `<tr><td colspan="8" class="muted">${esc(t('live.empty'))}</td></tr>`;
  if ($('feed').dataset.h !== html) { $('feed').innerHTML = html; $('feed').dataset.h = html; }
  seenFeed = now;
}

function runRow(r, current) {
  const perH = r.durationMs > 30000 ? r.profit / (r.durationMs / 3600000) : 0;
  const itemsTxt = r.items.slice(0, 12).map((i) => `${esc(i.name)} <b>${qty(i.qty)}</b> <span class="${cls(i.value)}">${fe(i.value, true)}</span>`).join('<span>·</span>');
  return `<tr><td class="muted">${current ? `<span class="pos">${esc(t('runs.current'))}</span>` : clock(r.startedAt)}</td>
    <td><details class="run"><summary>${mapLabel(r.name)}${mapPlace(r.name, r.zones) ? ` <span class="place">${esc(mapPlace(r.name, r.zones))}</span>` : ''} <span class="muted">${r.zones.length > 1 ? esc(t('runs.zones', { n: r.zones.length - 1 })) : ''}</span></summary><div class="runitems">${itemsTxt || esc(t('runs.noItems'))}</div></details></td>
    <td class="r">${dur(r.durationMs)}</td><td class="r pos">${fe(r.loot)}</td><td class="r neg">${fe(r.cost)}</td>
    <td class="r ${cls(r.profit)}"><b>${fe(r.profit, true)}</b></td><td class="r muted">${fe(perH)}</td></tr>`;
}

const openRuns = new Set();
function renderRuns(current, runs) {
  // Conserve les lignes dépliées entre deux rafraîchissements.
  $('runList').querySelectorAll('details').forEach((d) => { const k = d.dataset.k; if (k) d.open ? openRuns.add(k) : openRuns.delete(k); });
  const all = (current ? [[current, true]] : []).concat(runs.map((r) => [r, false]));
  $('runList').innerHTML = all.map(([r, c]) => runRow(r, c)).join('') || `<tr><td colspan="7" class="muted">${esc(t('runs.empty'))}</td></tr>`;
  $('runList').querySelectorAll('details').forEach((d, i) => { const k = String(all[i][0].startedAt); d.dataset.k = k; if (openRuns.has(k)) d.open = true; });
}

function renderItems(list) {
  $('itemList').innerHTML = list.map((i) => `<tr data-item="${i.id}"${i.sp != null ? ` data-sp="${i.sp}"` : ''} class="${i.ignored ? 'ignored' : ''}" title="${i.ignored ? esc(t('items.ignored')) : ''}"><td>${icon(i.img)}${esc(i.name)}</td><td class="r">${qty(i.qty)}</td><td class="r muted">${unit(i.unit)}</td><td><span class="tag">${esc(srcLabel(i.source))}</span></td><td class="r ${cls(i.value)}">${fe(i.value, true)}</td></tr>`).join('')
    || `<tr><td colspan="5" class="muted">${esc(t('items.empty'))}</td></tr>`;
}

let histCache = [];
// Carte ouverte dans l'historique (clic sur la ligne) : objets les plus rentables et coût.
let histOpen = null;
function histDetail(r) {
  const gains = (r.items || []).filter((i) => i.qty > 0 && i.value > 0).sort((a, b) => b.value - a.value);
  const costs = (r.items || []).filter((i) => i.qty < 0);
  const item = (i) => `<span class="hd-item">${icon(i.img)}<span>${esc(i.name)}</span><em>${qty(i.qty)}</em>${i.unit ? `<small class="muted">@${fe(i.unit)}</small>` : ''}<b class="${cls(i.value)}">${fe(i.value, true)}</b></span>`;
  // Carte avec sous-cartes (Arcana, Vorax…) : loot séparé par zone.
  const parts = (r.parts || []).length > 1
    ? r.parts.map((p, i) => `<div class="hd-part"><div class="hd-ph">${i ? '→ ' : ''}<b>${esc(p.zone)}</b> <span class="${cls(p.loot)}">${fe(p.loot, true)}</span></div>
        ${p.items.length ? p.items.map(item).join('') : `<span class="muted">${esc(t('hist.noLoot'))}</span>`}</div>`).join('')
    : null;
  return `<tr class="hdet"><td colspan="5"><div class="hd">
    ${parts || (gains.length ? gains.slice(0, 16).map(item).join('') : `<span class="muted">${esc(t('hist.noLoot'))}</span>`)}
    ${!parts && gains.length > 16 ? `<span class="muted">${esc(t('hist.more', { n: gains.length - 16 }))}</span>` : ''}
    ${costs.length ? `<div class="hd-cost"><span class="muted">${esc(t('hist.cost'))}</span> ${costs.map(item).join('')}</div>` : ''}
  </div></td></tr>`;
}
function renderHistory(hist) {
  if (hist) {
    histCache = hist;
    const maps = hist.map((r) => parseMap(r.name));
    fillFilter($('hfTier'), uniq(maps.map((m) => m.tier)).sort((a, b) => b - a), 'qf.allTiers', (v) => `Timemark ${v}`);
    fillFilter($('hfMap'), uniq(maps.map((m) => m.region)).sort(), 'qf.allMaps');
  }
  const tier = $('hfTier').value, map = $('hfMap').value;
  const list = histCache.filter((r) => { const m = parseMap(r.name); return (!tier || m.tier === tier) && (!map || m.region === map); });
  $('hfCount').textContent = list.length === histCache.length ? '' : t('qf.count', { n: list.length, total: histCache.length });
  // Groupé par jour : une ligne d'en-tête (jour, nombre de cartes, total) puis l'heure seule.
  const days = new Map();
  for (const r of list.slice().reverse().slice(0, 1000)) { const k = new Date(r.startedAt).toDateString(); if (!days.has(k)) days.set(k, []); days.get(k).push(r); }
  $('histList').innerHTML = [...days.values()].map((rs) => {
    const total = rs.reduce((n, r) => n + r.profit, 0);
    return `<tr class="day"><td colspan="5"><b>${esc(dayLabel(rs[0].startedAt))}</b> · ${esc(t(rs.length === 1 ? 'day.map1' : 'day.maps', { n: rs.length }))} · <span class="${cls(total)}">${fe(total, true)} FE</span></td></tr>`
      + rs.map((r) => {
        const perH = r.durationMs > 30000 ? r.profit / (r.durationMs / 3600000) : 0;
        const k = String(r.startedAt), open = histOpen === k;
        return `<tr class="click${open ? ' open' : ''}" data-hk="${k}"><td class="muted">${timeOnly(r.startedAt)}</td><td>${mapLabel(r.name)}${mapPlace(r.name, r.zones) ? ` <span class="place">${esc(mapPlace(r.name, r.zones))}</span>` : ''}</td><td class="r muted">${dur(r.durationMs)}</td><td class="r ${cls(r.profit)}">${fe(r.profit, true)}</td><td class="r">${fe(perH)}</td></tr>${open ? histDetail(r) : ''}`;
      }).join('');
  }).join('') || `<tr><td colspan="5" class="muted">${esc(t('history.empty'))}</td></tr>`;
  $('histList').querySelectorAll('tr[data-hk]').forEach((tr) => (tr.onclick = () => { histOpen = histOpen === tr.dataset.hk ? null : tr.dataset.hk; renderHistory(); }));
}

// Source du prix + fiabilité : nombre de joueurs derrière un prix communautaire, prix ignoré s'il n'est pas confirmé.
const srcTag = (p) => {
  if (p.source === 'nonconfirme') return `<span class="tag cost" title="${esc(t('prices.unconfirmedTip', { fe: fe(p.ignoredPrice) }))}">${esc(srcLabel(p.source))}</span>`;
  const n = p.players ? ` · ${t('prices.players', { n: p.players })}` : '';
  return `<span class="tag" title="${esc(p.players === 1 ? t('prices.onePlayerTip') : '')}">${esc(srcLabel(p.source))}${esc(n)}</span>`;
};
// Prix à vérifier : à chercher à l'hôtel des ventes en jeu (leur prix est alors capté et partagé).
async function loadPriceTodo() {
  const list = await tli.priceTodo();
  $('pTodo').hidden = !list.length;
  $('pTodoN').textContent = list.length ? `(${list.length})` : '';
  $('pTodoList').innerHTML = list.map((i) => `<span class="todo-item" title="${esc(i.missing ? t('todo.missing') : t('todo.stale', { date: dateTime(i.ts), fe: fe(i.price) }))}">${icon(i.img)}${esc(i.name)}<em class="${i.missing ? 'neg' : 'muted'}">${esc(i.missing ? t('todo.noPrice') : t('todo.old'))}</em></span>`).join('');
}
let priceLimit = 200;
async function loadPrices(more = false) {
  if (!more) loadPriceTodo();
  priceLimit = more ? priceLimit + 200 : 200;
  const r = await tli.searchPrices({ q: $('pSearch').value.trim(), source: $('pSource').value, sort: $('pSort').value, showUnknown: $('pUnknown').checked, limit: priceLimit });
  $('pCount').textContent = t('prices.count', { n: nf0.format(r.total) });
  $('pUnknownLbl').textContent = t('prices.showUnknown', { n: nf0.format(r.unknownCount) });
  $('pMore').hidden = r.rows.length >= r.total;
  const list = r.rows;
  // Objet non identifié : le joueur peut lui donner un nom (gardé sur son PC).
  const nameCell = (p) => (p.unknown || p.custom
    ? `${icon(null)}<input class="iname" data-id="${p.id}" value="${esc(p.custom ? p.name : '')}" placeholder="${esc(t('prices.unknownItem', { id: p.id }))}">`
    : `${icon(p.img)}${esc(p.name)}`);
  $('priceList').innerHTML = list.map((p) => `<tr data-item="${p.id}"><td>${nameCell(p)}</td><td class="muted">${p.id}</td><td class="r">${unit(p.price)}</td><td>${srcTag(p)}</td><td class="muted">${p.ts ? dateTime(p.ts) : ''}</td>
    <td class="r"><input class="price" data-id="${p.id}" value="${p.manual ?? ''}" placeholder="${esc(t('prices.auto'))}"></td></tr>`).join('');
  $('priceList').querySelectorAll('input.price').forEach((inp) => (inp.onchange = () => tli.setManualPrice(+inp.dataset.id, inp.value === '' ? null : +inp.value.replace(',', '.'))));
  $('priceList').querySelectorAll('input.iname').forEach((inp) => (inp.onchange = () => tli.setItemName(+inp.dataset.id, inp.value)));
}
['pSource', 'pSort', 'pUnknown'].forEach((id) => ($(id).onchange = () => loadPrices()));
$('pMore').onclick = () => loadPrices(true);

// ---------- Conseiller (IA) : bientôt disponible (bêta privée débloquée en cliquant 7 fois sur la version) ----------
const AIChat = { messages: [], busy: false };
const modelName = (m) => m.replace('claude-', 'Claude ').replace(/-(\d+)-(\d+)$/, ' $1.$2').replace(/(opus|sonnet|haiku)/, (x) => x[0].toUpperCase() + x.slice(1));
async function showAdvisor() {
  const st = await tli.aiStatus();
  if (!st.beta) {
    $('advisorView').innerHTML = comingSoon(t('soon.advisorTitle'), t('soon.advisorText')) + `
      <div class="card" style="margin-top:16px"><h2>${esc(t('soon.advisorWhat'))}</h2>
        <ul style="margin:6px 0 0 20px;line-height:1.9">
          <li>${esc(t('soon.adv1'))}</li><li>${esc(t('soon.adv2'))}</li><li>${esc(t('soon.adv3'))}</li><li>${esc(t('soon.adv4'))}</li>
        </ul></div>`;
    return;
  }
  const providerSel = `<select id="aiProvider" title="${esc(t('ai.provider'))}">
      <option value="server" ${st.provider === 'server' ? 'selected' : ''}>${esc(t('ai.provServer'))}</option>
      <option value="anthropic" ${st.provider === 'anthropic' ? 'selected' : ''}>${esc(t('ai.provClaude'))}</option>
      ${st.provider === 'ollama' ? `<option value="ollama" selected>${esc(t('ai.provLocal'))}</option>` : ''}</select>`;
  const bindProvider = () => { $('aiProvider').onchange = async (e) => { await tli.aiSetProvider(e.target.value); showAdvisor(); }; };
  const local = st.provider === 'ollama';
  // Local : Ollama pas lancé / pas installé, ou aucun modèle téléchargé -> mode d'emploi.
  if (local && (!st.ollama.up || !st.ollama.models.length)) {
    $('advisorView').innerHTML = `<div class="card ai-setup"><div style="display:flex;gap:10px;align-items:center"><h2 style="margin:0;flex:1">${esc(t('ai.title'))} <span class="tag beta">BETA</span></h2>${providerSel}</div>
      <p class="muted" style="margin-top:10px">${esc(t('ai.localHelp'))}</p>
      <ol style="margin:10px 0 0 20px;line-height:1.9">
        <li class="${st.ollama.up ? 'pos' : ''}">${esc(t('ai.local1'))}${st.ollama.up ? ' ✓' : ''}</li>
        <li>${esc(t('ai.local2'))}<br><code class="path">ollama pull ${esc(st.ollama.recommended)}</code></li>
        <li>${esc(t('ai.local3'))}</li></ol>
      <div style="display:flex;gap:8px;margin-top:12px"><button class="btn primary" id="aiOllamaSite">${esc(t('ai.localGet'))}</button><button class="btn" id="aiRetry">${esc(t('ai.localRetry'))}</button></div></div>`;
    bindProvider();
    $('aiOllamaSite').onclick = () => tli.action('openOllama');
    $('aiRetry').onclick = () => showAdvisor();
    return;
  }
  if (!local && !st.hasKey) {
    $('advisorView').innerHTML = `<div class="card ai-setup"><div style="display:flex;gap:10px;align-items:center"><h2 style="margin:0;flex:1">${esc(t('ai.title'))} <span class="tag beta">BETA</span></h2>${providerSel}</div>
      <p class="muted">${esc(t('ai.keyHelp'))}</p>
      <div style="display:flex;gap:8px;margin-top:12px"><input id="aiKey" type="password" placeholder="sk-ant-..." style="flex:1" autocomplete="off">
        <button class="btn primary" id="aiKeySave">${esc(t('ai.keySave'))}</button></div>
      <p class="muted" id="aiKeyMsg" style="margin-top:8px;font-size:12px">${esc(t('ai.keyPrivacy'))}</p></div>`;
    bindProvider();
    $('aiKeySave').onclick = async () => {
      const r = await tli.aiSetKey($('aiKey').value);
      if (r.ok) showAdvisor(); else $('aiKeyMsg').textContent = t('ai.keyBad');
    };
    return;
  }
  $('advisorView').innerHTML = `<div class="ai-wrap">
    <div class="tools"><h2 style="margin:0">${esc(t('ai.title'))} <span class="tag beta">BETA</span></h2><span style="flex:1"></span>
      ${providerSel}
      ${st.provider === 'server' ? `<span class="muted" style="font-size:12px">${esc(t(st.server.enabled ? 'ai.serverQuota' : 'ai.serverOff', { n: st.server.dailyLimit || 25 }))}</span>` : local ? `<select id="aiLocalModel">${st.ollama.models.map((m) => `<option value="${esc(m)}" ${m === st.ollama.model ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select>`
        : `<select id="aiModel">${st.models.map((m) => `<option value="${m}" ${m === st.model ? 'selected' : ''}>${esc(modelName(m))}</option>`).join('')}</select>`}
      <button class="btn" id="aiCtx">${esc(t('ai.context'))}</button>
      <button class="btn" id="aiClear">${esc(t('ai.clear'))}</button>
      ${local ? '' : `<button class="btn" id="aiForget">${esc(t('ai.forgetKey'))}</button>`}</div>
    <pre id="aiCtxBox" class="ai-ctx" hidden></pre>
    <div id="aiLog" class="ai-log"></div>
    <div class="chips ai-chips">${['ai.q1', 'ai.q2', 'ai.q3', 'ai.q4'].map((k) => `<button class="chip" data-q="${esc(t(k))}">${esc(t(k))}</button>`).join('')}</div>
    <form id="aiForm" class="ai-form"><textarea id="aiInput" rows="2" placeholder="${esc(t('ai.placeholder'))}"></textarea>
      <button class="btn primary" id="aiSend">${esc(t('ai.send'))}</button></form>
  </div>`;
  bindProvider();
  if ($('aiModel')) $('aiModel').onchange = (e) => tli.aiSetModel(e.target.value);
  if ($('aiLocalModel')) $('aiLocalModel').onchange = (e) => tli.aiSetLocalModel(e.target.value);
  $('aiClear').onclick = () => { AIChat.messages = []; renderAiLog(); };
  if ($('aiForget')) $('aiForget').onclick = async () => { await tli.aiSetKey(''); showAdvisor(); };
  $('aiCtx').onclick = async () => {
    const box = $('aiCtxBox');
    if (box.hidden) box.textContent = JSON.stringify(await tli.advisorContext(), null, 2);
    box.hidden = !box.hidden;
  };
  document.querySelectorAll('.ai-chips .chip').forEach((c) => (c.onclick = () => aiSend(c.dataset.q)));
  $('aiForm').onsubmit = (e) => { e.preventDefault(); aiSend($('aiInput').value); };
  $('aiInput').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); aiSend($('aiInput').value); } };
  renderAiLog();
}
// Markdown minimal (titres, gras, italique, listes, code), chaque morceau est échappé.
function miniMd(text) {
  const inline = (x) => esc(x).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  let html = '', list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const line of String(text).split('\n')) {
    let m;
    if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = line.match(/^#{1,4}\s+(.*)/))) { close(); html += `<h4>${inline(m[1])}</h4>`; }
    else if (!line.trim()) close();
    else { close(); html += `<p>${inline(line)}</p>`; }
  }
  close();
  return html;
}
function renderAiLog() {
  const log = $('aiLog');
  if (!log) return;
  log.innerHTML = AIChat.messages.length ? AIChat.messages.map((m) => `<div class="ai-msg ${m.role}${m.error ? ' err' : ''}">${m.role === 'user' ? esc(m.content) : miniMd(m.content)}${m.meta ? `<div class="ai-meta">${esc(m.meta)}</div>` : ''}</div>`).join('')
    : `<div class="ai-empty muted">${esc(t('ai.empty'))}</div>`;
  if (AIChat.busy) log.innerHTML += '<div class="ai-msg assistant typing"><span></span><span></span><span></span></div>';
  log.scrollTop = log.scrollHeight;
  if ($('aiSend')) $('aiSend').disabled = AIChat.busy;
}
async function aiSend(text) {
  text = (text || '').trim();
  if (!text || AIChat.busy) return;
  $('aiInput').value = '';
  AIChat.messages.push({ role: 'user', content: text });
  AIChat.busy = true; renderAiLog();
  const r = await tli.aiChat(AIChat.messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content })));
  AIChat.busy = false;
  if (r.error) {
    const msg = r.error === 'nokey' ? t('ai.keyBad') : r.error === 'noollama' ? t('ai.errNoOllama') : r.error === 'nomodel' ? t('ai.errNoModel')
      : r.status === 401 ? t('ai.err401') : t('ai.errApi', { msg: r.message || r.error });
    AIChat.messages.push({ role: 'assistant', content: msg, error: true });
  } else {
    const meta = [r.tools.length ? t('ai.searched', { q: r.tools.join(', ') }) : '', r.model || '', t('ai.tokens', { i: nf0.format(r.usage.input), o: nf0.format(r.usage.output) })].filter(Boolean).join(' · ');
    AIChat.messages.push({ role: 'assistant', content: r.text || '…', meta });
  }
  renderAiLog();
}
function flash(msg) {
  const d = document.createElement('div');
  d.className = 'flash'; d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2500);
}

// ---------- Bandeau de mise à jour ----------
// Version trop ancienne : écran bloquant (installer la mise à jour téléchargée, ou la télécharger sur le site).
function renderUpdateRequired(s) {
  let box = $('updRequired');
  if (!s.updateRequired) { if (box) box.remove(); return; }
  if (!box) { box = document.createElement('div'); box.id = 'updRequired'; document.body.appendChild(box); }
  const ready = s.update && s.update.state === 'ready';
  const dl = s.update && s.update.state === 'downloading';
  const html = `<div class="modal-bg" style="z-index:200"><div class="modal">
    <h1>${esc(t('updReq.title'))}</h1>
    <div class="body" style="min-height:0"><p>${esc(t('updReq.text', { v: s.appVersion, min: s.updateRequired.min }))}</p>
      ${dl ? `<p class="muted" style="margin-top:10px">${esc(t('upd.downloading', { v: s.update.version || '', pct: s.update.percent || 0 }))}</p>` : ''}</div>
    <div class="foot"><span></span>${ready ? `<button class="btn primary big" id="urInstall">${esc(t('upd.restart'))}</button>`
      : `<button class="btn primary big" id="urDl">${esc(t('updReq.download'))}</button>`}</div></div></div>`;
  if (box.dataset.h === html) return;
  box.innerHTML = html; box.dataset.h = html;
  if ($('urInstall')) $('urInstall').onclick = () => tli.action('installUpdate');
  if ($('urDl')) $('urDl').onclick = () => tli.action('downloadUpdate');
}

function renderUpdateBar(s) {
  renderUpdateRequired(s);
  const u = s.update || { state: 'idle' };
  const bar = $('updateBar');
  let html = '';
  if (u.state === 'downloading') html = `<span>${esc(t('upd.downloading', { v: u.version || '', pct: u.percent || 0 }))}</span>`;
  if (u.state === 'ready') html = `<span>${esc(t('upd.ready', { v: u.version }))}</span><button class="btn primary" id="updBtn">${esc(t('upd.restart'))}</button>`;
  bar.hidden = !html;
  bar.classList.toggle('ready', u.state === 'ready');
  if (bar.dataset.h !== html) {
    bar.innerHTML = html; bar.dataset.h = html;
    if ($('updBtn')) $('updBtn').onclick = () => tli.action('installUpdate');
  }
  if ($('appVersion') && s.appVersion) $('appVersion').textContent = 'v' + s.appVersion;
  // État dans les réglages : recherche en cours, à jour, téléchargement, prête.
  if ($('sUpdMsg')) $('sUpdMsg').textContent = u.state === 'checking' ? t('upd.checking') : u.state === 'uptodate' ? t('upd.upToDate', { v: s.appVersion })
    : u.state === 'downloading' ? t('upd.downloading', { v: u.version || '', pct: u.percent || 0 }) : u.state === 'ready' ? t('upd.ready', { v: u.version }) : u.state === 'error' ? t('upd.error') : '';
}

['sfTier', 'sfMap', 'sfTag', 'sfSort'].forEach((id) => ($(id).onchange = renderSessions));
['hfTier', 'hfMap'].forEach((id) => ($(id).onchange = () => renderHistory()));

// ---------- Analyser mon sac (bêta) ----------
// Ce qui vaut le coup d'être vendu dans le sac, avec le prix utilisé et sa fraîcheur.
const Bag = (() => {
  let filter = 'all';
  let min = 1;
  try { min = +localStorage.getItem('bagMin') || 1; } catch {}
  let timer = null;
  const ago = (ts) => {
    if (!ts) return '';
    const h = (Date.now() - ts) / 3600000;
    return h < 1 ? t('bag.agoMin', { n: Math.max(1, Math.round(h * 60)) }) : h < 48 ? t('bag.agoH', { n: Math.round(h) }) : t('bag.agoD', { n: Math.round(h / 24) });
  };
  const VERDICT = { sell: 'loot', low: '', noprice: 'cost', variable: 'var', bound: '', keep: 'keep' };
  async function render() {
    const v = $('bagView');
    if (!v || tab !== 'bag') return;
    const d = await tli.bagScan({ min });
    if (!d.ready && !d.rows.length) {
      // Diagnostic : le bon fichier ? le jeu y écrit-il ses infos (Enable Log) ? des lignes du sac ?
      const g = d.log;
      let why = '';
      if (g && g.path) {
        const age = g.writtenAt ? Date.now() - g.writtenAt : null;
        const key = !g.game ? 'bag.diagNoGame' : age != null && age > 10 * 60000 ? 'bag.diagStale' : !g.bag ? 'bag.diagNoBag' : 'bag.diagSort';
        why = `<p class="bag-diag"><b>${esc(t(key, { ago: age != null ? dur(age) : '?' }))}</b></p>
          <p class="muted small">${esc(t('bag.diagFile'))} <code>${esc(g.path)}</code><br>${esc(t('bag.diagCounts', { lines: g.lines, game: g.game, bag: g.bag }))}</p>`;
      }
      v.innerHTML = `<div class="card bag-empty"><h2>${esc(t('bag.notReady'))}</h2><p class="muted">${esc(t('bag.notReadyHelp'))}</p>${why}</div>`;
      return;
    }
    const rows = filter === 'all' ? d.rows : d.rows.filter((r) => r.verdict === filter);
    const chip = (k, n) => `<button class="fchip ${filter === k ? 'on' : ''}" data-f="${k}">${esc(t('bag.f.' + k))} <b>${n}</b></button>`;
    const focus = document.activeElement && document.activeElement.id === 'bagMin';
    v.innerHTML = `
      <div class="bag-head">
        <div><h2>${esc(t('bag.title'))}</h2><p class="muted">${esc(t('bag.intro'))}</p><p class="muted" style="font-size:12px;margin-top:2px">${esc(t('bag.tip'))}</p></div>
        <button class="btn ghost" id="bagRefresh">${esc(t('btn.refresh'))}</button>
      </div>
      <div class="bag-warn"><span class="bw-ico">!</span><div><b>${esc(t('bag.warnTitle'))}</b><p>${esc(d.staleSell ? t(d.staleSell === 1 ? 'bag.warnStale1' : 'bag.warnStale', { n: d.staleSell }) : t('bag.warnText'))}</p></div></div>
      <div class="bag-kpis">
        <div class="kpi"><div class="k">${esc(t('bag.k.total'))}</div><div class="v">${fe(d.totals.all)} FE</div></div>
        <div class="kpi"><div class="k">${esc(t('bag.k.sell'))}</div><div class="v pos">${fe(d.totals.sell)} FE</div><div class="s muted">${esc(t('bag.nItems', { n: d.counts.sell }))}</div></div>
        <div class="kpi"><div class="k">${esc(t('bag.k.low'))}</div><div class="v">${fe(d.totals.low)} FE</div><div class="s muted">${esc(t('bag.nItems', { n: d.counts.low }))}</div></div>
        <div class="kpi"><div class="k">${esc(t('bag.k.noprice'))}</div><div class="v ${d.counts.noprice ? 'neg' : ''}">${d.counts.noprice}</div><div class="s muted">${esc(t('bag.checkAh'))}</div></div>
      </div>
      <div class="tools">
        ${chip('all', d.counts.all)}${chip('sell', d.counts.sell)}${chip('low', d.counts.low)}${chip('noprice', d.counts.noprice)}${d.counts.variable ? chip('variable', d.counts.variable) : ''}${d.counts.bound ? chip('bound', d.counts.bound) : ''}${d.counts.keep ? chip('keep', d.counts.keep) : ''}
        <label class="muted bag-min">${esc(t('bag.minLabel'))} <input id="bagMin" type="number" min="0" step="0.5" value="${min}" style="width:76px"> FE</label>
      </div>
      <table><thead><tr><th>${esc(t('col.item'))}</th><th class="r">${esc(t('col.quantity'))}</th><th class="r">${esc(t('col.unit'))}</th><th class="r">${esc(t('bag.col.stack'))}</th><th>${esc(t('bag.col.price'))}</th><th>${esc(t('bag.col.verdict'))}</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr data-item="${r.id}" class="${r.verdict === 'low' || r.verdict === 'bound' || r.verdict === 'keep' ? 'dim' : ''}">
          <td>${icon(r.img)}${esc(r.name)}</td><td class="r">${nf0.format(r.qty)}</td><td class="r muted" title="${r.verdict === 'variable' ? esc(t('bag.varTip')) : ''}">${r.verdict === 'variable' ? (r.unit ? esc(t('bag.upTo', { p: unit(r.unit) })) : '–') : unit(r.unit)}</td>
          <td class="r"><b class="${r.verdict === 'sell' ? 'pos' : ''}">${r.unit && r.verdict !== 'variable' ? fe(r.value) : '–'}</b></td>
          <td class="muted" style="font-size:12px">${r.unit ? `${esc(srcLabel(r.source))}${r.players ? ' · ' + esc(t('prices.players', { n: r.players })) : ''}${r.ts ? ` · <span class="${r.stale ? 'neg' : ''}">${esc(ago(r.ts))}</span>` : ''}` : ''}</td>
          <td><span class="tag ${VERDICT[r.verdict]}">${esc(t('bag.v.' + r.verdict))}</span></td>
          <td class="r nowrap">${r.where.length ? `<button class="btn sm" data-where="${r.id}" title="${esc(t('bag.whereTip'))}">📍 ${esc(t('bag.where'))}</button> ` : ''}<button class="btn sm bag-keep${r.kept ? ' on' : ''}" data-keep="${r.id}" title="${esc(t(r.kept ? 'bag.unkeepTip' : 'bag.keepTip'))}">${esc(t(r.kept ? 'bag.unkeep' : 'bag.keep'))}</button></td></tr>`).join('')
        || `<tr><td colspan="7" class="muted">${esc(t('bag.none'))}</td></tr>`}
      </tbody></table>
      ${d.counts.variable ? `<p class="muted" style="margin-top:10px;font-size:12px">${esc(t('bag.varNote', { n: d.counts.variable }))}</p>` : ''}
      ${d.hidden ? `<p class="muted" style="margin-top:6px;font-size:12px">${esc(t('bag.hidden', { n: d.hidden }))}</p>` : ''}`;
    v.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { filter = b.dataset.f; render(); }));
    // « Où ? » : schéma de l'onglet du sac avec la ou les cases de l'objet en surbrillance.
    v.querySelectorAll('[data-where]').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const r = d.rows.find((x) => x.id === +b.dataset.where);
      if (r) bagWhere(r, d.pages);
    }));
    // « Garder » : l'objet n'est plus suggéré à la vente (sans ouvrir la courbe de prix de la ligne).
    v.querySelectorAll('[data-keep]').forEach((b) => (b.onclick = async (e) => {
      e.stopPropagation();
      await tli.action('keepItem', { id: +b.dataset.keep, keep: !b.classList.contains('on') });
      render();
    }));
    $('bagRefresh').onclick = () => render();
    $('bagMin').onchange = () => { min = Math.max(0, +$('bagMin').value || 0); try { localStorage.setItem('bagMin', String(min)); } catch {} render(); };
    if (focus) $('bagMin').focus();
  }
  // Nom court pour une case sans icône (« Memory Thread - Epic » -> « Memory Thread »).
  const shortName = (n) => {
    if (/^Item #\d+$/.test(n || '')) return '?';
    const w = String(n || '').replace(/^(Organ|Kismet|Dual Kismet|Tartarus|Origin Tartarus):\s*/i, '').split(/[\s:()-]+/)
      .filter((x) => x && !/^(of|the|a|an|de|du|la|le)$/i.test(x));
    const roman = /^[IVX]+$/.test(w[w.length - 1] || '') ? ' ' + w.pop() : ''; // garde « I », « V »… (niveaux)
    return w.slice(0, 2).join(' ') + roman;
  };
  // Schéma de l'inventaire : l'onglet (2 à 4) en 9 colonnes, toutes ses lignes, les cases de l'objet surlignées.
  // Vue « Sac » (9 colonnes) ou « Hôtel des ventes » (15 colonnes, mêmes positions, mêmes cases vides).
  // Le nombre de colonnes dépend du « scaling » de l'écran choisi en jeu : réglable pour chaque vue, mémorisé.
  let bagView = 'bag';
  const cols = { bag: 9, ah: 15 };
  try {
    bagView = localStorage.getItem('bagView') === 'ah' ? 'ah' : 'bag';
    for (const v of ['bag', 'ah']) { const n = +localStorage.getItem('bagCols_' + v); if (n >= 4 && n <= 30) cols[v] = n; }
  } catch {}
  function bagWhere(r, pages) {
    let COLS = cols[bagView];
    const VISIBLE_ROWS = 3;
    const byPage = {};
    for (const w of r.where) (byPage[w.page] = byPage[w.page] || []).push(w);
    const tabs = Object.keys(byPage).map(Number).sort();
    let cur = tabs[0];
    const draw = () => {
      COLS = cols[bagView];
      const list = pages[cur] || [], hit = new Set(byPage[cur].map((w) => w.slot));
      const rows = Math.max(VISIBLE_ROWS, Math.ceil((Math.max(...list.map((x) => x.slot), ...hit) + 1) / COLS));
      const cells = [];
      for (let s = 0; s < rows * COLS; s++) {
        const it = list.find((x) => x.slot === s);
        cells.push(`<div class="bw-cell${hit.has(s) ? ' hit' : ''}" title="${it ? esc(it.name) : ''}">${it ? `${it.img ? `<img src="${esc(it.img)}" alt="" data-short="${esc(shortName(it.name))}">` : `<i>${esc(shortName(it.name))}</i>`}<b>${it.n}</b>` : ''}</div>`);
      }
      const where = byPage[cur].map((w) => {
        const row = Math.floor(w.slot / COLS) + 1, col = (w.slot % COLS) + 1;
        return `<li>${esc(t('bag.whereAt', { row, col, n: w.n }))}${bagView === 'bag' && row > VISIBLE_ROWS ? ` <span class="muted">${esc(t('bag.whereScroll'))}</span>` : ''}</li>`;
      }).join('');
      modal(`<div class="bw"><h1>${icon(r.img)} ${esc(r.name)}</h1>
        <div class="bw-bar"><div class="bw-tabs">${[101, 102, 103].map((p) => `<button class="${p === cur ? 'on' : ''}${byPage[p] ? ' has' : ''}" data-tab="${p}" ${byPage[p] ? '' : 'disabled'}>${esc(t('bag.whereTab', { n: p - 99 }))}</button>`).join('')}</div>
          <div class="bw-view">${['bag', 'ah'].map((v) => `<button class="${bagView === v ? 'on' : ''}" data-view="${v}">${esc(t('bag.view_' + v))}</button>`).join('')}</div>
          <label class="bw-cols">${esc(t('bag.cols'))} <input type="number" id="bwCols" min="4" max="30" value="${COLS}" title="${esc(t('bag.colsTip'))}"></label></div>
        <ul class="bw-list">${where}</ul>
        <div class="bw-grid" style="grid-template-columns:repeat(${COLS},1fr)">${cells.join('')}</div>
        <p class="muted small">${esc(t('bag.whereHelp'))}</p>
        <div class="foot"><span></span><button class="btn primary" id="bwOk">${esc(t('pc.close'))}</button></div></div>`);
      document.querySelectorAll('.bw-tabs [data-tab]').forEach((b) => (b.onclick = () => { cur = +b.dataset.tab; draw(); }));
      document.querySelectorAll('.bw-view [data-view]').forEach((b) => (b.onclick = () => {
        bagView = b.dataset.view; try { localStorage.setItem('bagView', bagView); } catch {}
        draw();
      }));
      $('bwCols').onchange = (e) => {
        const n = Math.min(30, Math.max(4, Math.round(+e.target.value) || cols[bagView]));
        cols[bagView] = n; try { localStorage.setItem('bagCols_' + bagView, String(n)); } catch {}
        draw();
      };
      $('bwOk').onclick = () => modal('');
      const first = document.querySelector('.bw-cell.hit');
      if (first) first.scrollIntoView({ block: 'center' });
    };
    draw();
  }
  function show() {
    render();
    clearInterval(timer);
    timer = setInterval(() => { if (tab === 'bag') render(); else clearInterval(timer); }, 5000);
  }
  return { show };
})();

// ---------- Courbe de prix d'un objet (clic sur une ligne d'objet) ----------
// Prix médian du jour vu par les joueurs TLI Companion (ligne) et tes propres vérifications à l'HdV (points).
let chartDays = 30;
// ctx : d'où vient le clic. live = session en cours, report = session enregistrée (prix de ce drop seulement).
async function openPriceChart(id, ctx = null) {
  const h = await tli.priceHistory(id, chartDays);
  const W = 640, H = 240, P = { l: 48, r: 14, t: 14, b: 26 };
  const now = Date.now(), from = now - h.days * 86400000;
  const sv = h.server.map((p) => ({ ts: Date.parse(p.day + 'T12:00:00Z'), v: p.median, n: p.n, players: p.players }));
  const own = h.own.map((p) => ({ ts: p.ts, v: p.price }));
  const all = sv.map((p) => p.v).concat(own.map((p) => p.v)).concat(h.now && h.now.price ? [h.now.price] : []);
  const max = Math.max(...all, 0) * 1.12 || 1;
  const X = (ts) => P.l + ((ts - from) / (now - from)) * (W - P.l - P.r);
  const Y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(max * f)}" y2="${Y(max * f)}" class="pc-grid"/><text x="${P.l - 6}" y="${Y(max * f) + 4}" class="pc-axis" text-anchor="end">${f ? esc(unit(max * f)) : '0'}</text>`).join('');
  const ticks = [0, 0.5, 1].map((f) => { const ts = from + f * (now - from); return `<text x="${X(ts)}" y="${H - 6}" class="pc-axis" text-anchor="${f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}">${esc(new Date(ts).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }))}</text>`; }).join('');
  const line = sv.length > 1 ? `<polyline class="pc-line" points="${sv.map((p) => `${X(p.ts)},${Y(p.v)}`).join(' ')}"/>` : '';
  const svDots = sv.map((p) => `<circle class="pc-sv" cx="${X(p.ts)}" cy="${Y(p.v)}" r="3.5"><title>${esc(new Date(p.ts).toLocaleDateString(LOCALE))} · ${esc(unit(p.v))} FE · ${esc(t('pc.obs', { n: p.n, players: p.players }))}</title></circle>`).join('');
  const ownDots = own.map((p) => `<circle class="pc-own" cx="${X(p.ts)}" cy="${Y(p.v)}" r="4"><title>${esc(dateTime(p.ts))} · ${esc(unit(p.v))} FE · ${esc(t('pc.mine'))}</title></circle>`).join('');
  const empty = !sv.length && !own.length;
  const vals = sv.map((p) => p.v).concat(own.map((p) => p.v));
  modal(`<div class="pc-head">${icon(h.img)}<h1>${esc(h.name)}</h1></div>
    <div class="pc-kpis">
      <div><span class="muted">${esc(t('pc.now'))}</span><b>${h.now && h.now.price ? esc(unit(h.now.price)) + ' FE' : '–'}</b><small class="muted">${h.now && h.now.source ? esc(srcLabel(h.now.source)) : ''}</small></div>
      <div><span class="muted">${esc(t('pc.low'))}</span><b>${vals.length ? esc(unit(Math.min(...vals))) + ' FE' : '–'}</b></div>
      <div><span class="muted">${esc(t('pc.high'))}</span><b>${vals.length ? esc(unit(Math.max(...vals))) + ' FE' : '–'}</b></div>
      <div class="pc-days">${[7, 30, 90].map((dd) => `<button class="fchip ${dd === chartDays ? 'on' : ''}" data-days="${dd}">${esc(t('pc.days', { n: dd }))}</button>`).join('')}</div>
    </div>
    ${empty ? `<p class="muted pc-empty">${esc(t('pc.empty'))}</p>` : `<svg class="pc-svg" viewBox="0 0 ${W} ${H}">${grid}${ticks}${line}${svDots}${ownDots}</svg>
    <div class="pc-legend"><span><i class="pc-k sv"></i>${esc(t('pc.legendServer'))}</span><span><i class="pc-k own"></i>${esc(t('pc.legendMine'))}</span></div>`}
    <p class="muted" style="font-size:12px;margin-top:8px">${esc(t('pc.help'))}</p>
    ${priceEditBox(h, ctx)}
    <div class="foot"><button class="btn" id="pcClose">${esc(t('pc.close'))}</button></div>`);
  document.querySelectorAll('[data-days]').forEach((b) => (b.onclick = () => { chartDays = +b.dataset.days; openPriceChart(id, ctx); }));
  $('pcClose').onclick = () => modal('');
  bindPriceEdit(id, h, ctx);
}
// Ton prix : pour cette session (en cours ou enregistrée) ou partout (prix manuel, comme l'onglet Prix).
function priceEditBox(h, ctx) {
  const manual = h.now && h.now.source === 'manuel' ? h.now.price : null;
  const cur = ctx && ctx.sp != null ? ctx.sp : manual;
  const sess = ctx && (ctx.kind === 'report' || ctx.kind === 'live');
  const report = ctx && ctx.kind === 'report';
  return `<div class="pe-box"><b>${esc(t('pe.title'))}</b>
    <div class="pe-row"><input id="peVal" type="number" min="0" step="any" placeholder="${esc(t('pe.ph'))}" value="${cur != null ? cur : ''}">
      ${sess ? `<button class="btn primary" id="peSess">${esc(t('pe.session'))}</button>` : ''}
      ${report ? '' : `<button class="btn" id="peAll">${esc(t('pe.everywhere'))}</button>`}
      ${(ctx && ctx.sp != null) || (manual != null && !report) ? `<button class="btn" id="peAuto">${esc(t('pe.auto'))}</button>` : ''}</div>
    <p class="muted" id="peMsg">${esc(report ? t('pe.reportNote') + ' ' + t('pe.help') : t('pe.help'))}</p></div>`;
}
function bindPriceEdit(id, h, ctx) {
  const val = () => { const v = $('peVal').value.trim().replace(',', '.'); return v === '' || !(+v >= 0) ? null : +v; };
  const done = () => { modal(''); if (ctx && ctx.kind === 'report') openSession(ctx.report); else refresh(true); };
  const bad = () => { $('peMsg').textContent = t('pe.bad'); };
  const setSess = (p) => (ctx.kind === 'report' ? tli.reportPrice(ctx.report, id, p) : tli.sessionPrice(id, p));
  if ($('peSess')) $('peSess').onclick = async () => { const v = val(); if (v == null) return bad(); await setSess(v); done(); };
  if ($('peAll')) $('peAll').onclick = async () => {
    const v = val(); if (v == null) return bad();
    if (ctx && ctx.kind === 'live' && ctx.sp != null) await tli.sessionPrice(id, null); // le prix manuel prend le relais
    await tli.setManualPrice(id, v); done();
  };
  if ($('peAuto')) $('peAuto').onclick = async () => {
    if (ctx && ctx.sp != null) await setSess(null);
    else await tli.setManualPrice(id, null);
    done();
  };
}
// Drops de la session en cours sans prix connu (bouton du widget) : un prix pour cette session seulement.
async function unpricedModal() {
  const list = await tli.unpricedLoot();
  if (!list.length) return;
  modal(`<h1>${esc(t('ov.unpricedTip'))}</h1>
    <div class="body end-form" style="min-height:0"><div class="end-unpriced"><p>${esc(t('end.unpriced', { n: list.length }))}</p>
    ${list.slice(0, 30).map((i) => `<label class="eu-row">${icon(i.img)}<span>${esc(i.name)} <em class="muted">×${qty(i.qty)}</em></span><input type="number" min="0" step="any" data-eu="${i.id}" placeholder="${esc(t('pe.ph'))}"></label>`).join('')}</div>
    <p class="muted" style="font-size:12px">${esc(t('pe.help'))}</p></div>
    <div class="foot"><button class="btn" id="euClose">${esc(t('pc.close'))}</button><button class="btn primary" id="euSave">${esc(t('pe.session'))}</button></div>`);
  $('euClose').onclick = () => modal('');
  $('euSave').onclick = async () => {
    for (const inp of document.querySelectorAll('[data-eu]')) {
      const v = inp.value.trim().replace(',', '.');
      if (v !== '' && +v >= 0) await tli.sessionPrice(+inp.dataset.eu, +v);
    }
    modal(''); refresh(true);
  };
}
// Ajouter un loot à la main dans une session enregistrée (légendaire, objet que le log n'a pas vu).
function addLootModal(reportId) {
  let picked = null;
  modal(`<h1>${esc(t('loot.addTitle'))}</h1><p class="muted">${esc(t('loot.addHelp'))}</p>
    <div class="body end-form" style="min-height:0">
      <input id="alQ" placeholder="${esc(t('loot.search'))}" autocomplete="off">
      <div id="alRes" class="al-res"></div>
      <div class="al-row"><label>${esc(t('loot.qty'))}<input id="alQty" type="number" min="1" step="1" value="1"></label>
        <label>${esc(t('loot.price'))}<input id="alPrice" type="number" min="0" step="any"></label></div>
      <p class="muted" id="alMsg"></p>
    </div>
    <div class="foot"><button class="btn" id="alCancel">${esc(t('pc.close'))}</button><button class="btn primary" id="alOk">${esc(t('loot.addBtn'))}</button></div>`);
  let timer = null;
  $('alQ').oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const q = $('alQ').value.trim();
      const res = q.length < 2 ? [] : await tli.searchItems(q);
      $('alRes').innerHTML = res.slice(0, 20).map((it) => `<button class="al-it${picked && picked.id === it.id ? ' on' : ''}" data-id="${it.id}" data-price="${it.price || ''}">${icon(it.img)}<span>${esc(it.name)}</span>${it.price ? `<em class="muted">${unit(it.price)} FE</em>` : ''}</button>`).join('');
      $('alRes').querySelectorAll('.al-it').forEach((b) => (b.onclick = () => {
        picked = { id: +b.dataset.id };
        $('alRes').querySelectorAll('.al-it').forEach((x) => x.classList.toggle('on', x === b));
        if (!$('alPrice').value && b.dataset.price) $('alPrice').value = Math.round(+b.dataset.price * 100) / 100;
        $('alPrice').focus();
      }));
    }, 200);
  };
  $('alQ').focus();
  $('alCancel').onclick = () => modal('');
  $('alOk').onclick = async () => {
    if (!picked) { $('alMsg').textContent = t('loot.pick'); return; }
    const price = +String($('alPrice').value).replace(',', '.');
    if ($('alPrice').value === '' || !(price >= 0)) { $('alMsg').textContent = t('pe.bad'); return; }
    await tli.reportAddLoot(reportId, { id: picked.id, qty: +$('alQty').value || 1, price });
    modal(''); openSession(reportId);
  };
}
document.addEventListener('click', (e) => {
  const tr = e.target.closest('main tr[data-item]');
  if (!tr || e.target.closest('input, button, select, a, summary')) return;
  const sp = tr.dataset.sp != null ? +tr.dataset.sp : null;
  const ctx = tr.dataset.report ? { kind: 'report', report: tr.dataset.report, sp }
    : tr.closest('#itemList') && last && last.recording ? { kind: 'live', sp } : null;
  openPriceChart(+tr.dataset.item, ctx);
});

// Icône introuvable (certaines images n'existent plus chez tlidb) : dans le schéma du sac, le nom court la remplace ;
// ailleurs, l'image est masquée au lieu de laisser un cadre cassé.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || img.dataset.broken) return;
  img.dataset.broken = '1';
  if (img.dataset.short != null) { const i = document.createElement('i'); i.textContent = img.dataset.short; img.replaceWith(i); }
  else img.style.visibility = 'hidden';
}, true);
