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
  char: ['build', 'meta', 'advisor'],
  market: ['prices'],
  settings: ['settings', 'widget'],
};
const groupOf = (name) => Object.keys(GROUPS).find((g) => GROUPS[g].includes(name)) || 'home';
const lastSub = {};
function renderSubTabs(g, name) {
  const bar = $('subTabs');
  const tabs = GROUPS[g];
  bar.hidden = tabs.length < 2;
  bar.innerHTML = tabs.length < 2 ? '' : tabs.map((x) => `<button data-tab="${x}" class="${x === name ? 'on' : ''}">${esc(t('tab.' + x))}${x === 'bag' ? ' <span class="tag beta">NEW</span>' : ''}</button>`).join('');
  bar.querySelectorAll('button').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
}
function showTab(name) {
  if (GROUPS[name]) name = lastSub[name] || GROUPS[name][0];
  tab = name;
  const g = groupOf(name);
  lastSub[g] = name;
  document.querySelectorAll('aside.side button[data-grp]').forEach((x) => x.classList.toggle('on', x.dataset.grp === g));
  renderSubTabs(g, name);
  document.querySelectorAll('section').forEach((s) => s.classList.toggle('on', s.id === name));
  // Les compteurs de session ne s'affichent que sur les pages de jeu.
  $('kpiBar').classList.toggle('hidden', !['live', 'runs', 'items', 'history'].includes(name));
  if (name === 'home' && last) Home.update(last);
  if (name === 'sessions') { closeSession(); loadSessions(); }
  if (name === 'prices') loadPrices();
  if (name === 'build') Build.show();
  if (name === 'meta') MetaTab.show();
  if (name === 'advisor') showAdvisor();
  if (name === 'bag') Bag.show();
  refresh(true);
}
document.querySelectorAll('aside.side button[data-grp]').forEach((b) => (b.onclick = () => showTab(b.dataset.grp)));
$('supportBtn').onclick = () => tli.openSupport();
// « Donner mon avis » : texte brut seulement (type, message, contact facultatif), envoyé à tlicompanion.com.
$('feedbackBtn').onclick = () => {
  modal(`<h1>${esc(t('fb.title'))}</h1>
    <p class="muted">${esc(t('fb.intro'))}</p>
    <div class="body end-form">
      <label>${esc(t('fb.type'))}<select id="fbType">${['bug', 'idea', 'question', 'other'].map((k) => `<option value="${k}">${esc(t('fb.t.' + k))}</option>`).join('')}</select></label>
      <label>${esc(t('fb.message'))}<textarea id="fbMsg" rows="6" maxlength="2000" placeholder="${esc(t('fb.messagePh'))}"></textarea></label>
      <span class="muted" id="fbCount" style="font-size:11px;text-align:right">0 / 2000</span>
      <label>${esc(t('fb.contact'))}<input id="fbContact" maxlength="100" placeholder="${esc(t('fb.contactPh'))}"></label>
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
    $('fbSend').disabled = true;
    const r = await tli.sendFeedback({ type: $('fbType').value, message, contact: $('fbContact').value.trim() });
    out.hidden = false;
    if (r && r.ok) { out.className = 'pos'; out.textContent = t('fb.thanks'); setTimeout(() => modal(''), 1800); }
    else { $('fbSend').disabled = false; out.className = 'neg'; out.textContent = t('fb.error', { msg: (r && r.error) || '?' }); }
  };
};
tli.onNavigate((nav) => {
  if (nav.startsWith('session:')) { showTab('sessions'); openSession(nav.slice(8)); }
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
// Fin de session : enregistrer (titre, type de stratégie, notes) et publier si le joueur l'accepte.
async function endSessionModal(id) {
  const r = await tli.getReport(id);
  if (!r) return;
  const srv = last.settings.server;
  const share = false;
  modal(`<h1>${esc(t('end.title'))}</h1>
    <p class="muted">${esc(t('end.summary', { maps: r.totals.runs, profit: fe(r.totals.profit, true), hour: fe(r.totals.perHourReal), time: dur(r.totals.realMs) }))}</p>
    <div class="body end-form">
      <label>${esc(t('end.name'))}<input id="eTitle" value="${esc(r.title || (r.strategy.maps[0] ? r.strategy.maps[0].name : ''))}"></label>
      <label>${esc(t('end.tag'))}<select id="eTag">${tagOptions(r.strategyTag)}</select></label>
      <label>${esc(t('end.notes'))}<textarea id="eNotes" rows="3" placeholder="${esc(t('end.notesPh'))}">${esc(r.notes || '')}</textarea></label>
      <p class="muted" style="font-size:12px">${esc(t(last.settings.shareFarmStats !== false ? 'end.statsOn' : 'end.statsOff'))}</p>
      <label class="check"><input type="checkbox" id="ePub"> ${esc(t('end.publishSheet'))}</label>
      ${srv.registered ? '' : `<label id="eNameRow" hidden>${esc(t('share.namePh'))}<input id="eName" maxlength="24"></label>`}
      <p class="muted" id="eMsg" style="font-size:12px" hidden>${esc(t('share.what'))}</p>
    </div>
    <div class="foot"><button class="btn" id="eDrop">${esc(t('end.discard'))}</button>
      <button class="btn primary big" id="eSave">${esc(t('end.save'))}</button></div>`);
  $('ePub').onchange = () => {
    $('eSave').textContent = t($('ePub').checked ? 'end.savePublish' : 'end.save');
    if ($('eNameRow')) $('eNameRow').hidden = !$('ePub').checked;
    $('eMsg').hidden = !$('ePub').checked;
  };
  $('eDrop').onclick = async () => {
    if (!confirm(t('sess.confirmDelete'))) return;
    await tli.deleteReport(id); modal(''); closeSession(); loadSessions();
  };
  $('eSave').onclick = async () => {
    const patch = { title: $('eTitle').value, notes: $('eNotes').value, strategyTag: $('eTag').value };
    await tli.updateReport(id, patch);
    if ($('ePub').checked) {
      try {
        if (!srv.registered) {
          const name = $('eName').value.trim();
          if (name.length < 2) { $('eMsg').hidden = false; $('eMsg').textContent = t('share.nameShort'); return; }
          await tli.register(name);
        }
        $('eMsg').hidden = false; $('eMsg').textContent = t('share.sending');
        await tli.shareReport(id);
      } catch (e) { $('eMsg').textContent = t('share.error', { msg: errMsg(e) }); return; }
    }
    modal('');
    openSession(id);
  };
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
  $('sessRows').innerHTML = list.map((r) => {
    const tot = r.totals;
    return `<tr class="click" data-id="${r.id}"><td class="muted">${dateTime(r.startedAt)}</td>
      <td>${r.title ? `<b>${esc(r.title)}</b><br>` : ''}<span class="muted">${esc(r.maps.join(' · '))}</span>${r.strategyTag ? ` <span class="tag">${esc(t('tag.' + r.strategyTag))}</span>` : ''}</td>
      <td>${esc(r.hero ? r.hero.name : '–')}</td><td class="r">${dur(tot.realMs)}</td><td class="r">${tot.runs}</td>
      <td class="r ${cls(tot.profit)}"><b>${fe(tot.profit, true)}</b></td><td class="r">${fe(tot.perHourReal)}</td></tr>`;
  }).join('') || `<tr><td colspan="7" class="muted">${esc(t('sess.empty'))}</td></tr>`;
  $('sessRows').querySelectorAll('tr.click').forEach((tr) => (tr.onclick = () => openSession(tr.dataset.id)));
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
      ${tot.realMs > 60000 ? stat('d.eff', `${Math.round((tot.mapMs / tot.realMs) * 100)} %`) : ''}
      ${stat('d.avgMap', fe(tot.avgPerMap, true), cls(tot.avgPerMap))}
      ${stat('d.durMap', dur(tot.avgMapMs))}
      ${stat('d.totalCost', fe(tot.cost), 'neg')}
      ${stat('d.bagValue', tot.netWorthStart != null ? `${fe(tot.netWorthStart)} → ${fe(tot.netWorthEnd)}` : '–')}
      ${stat('d.class', esc(r.hero ? r.hero.name : '–'), 'txt')}
    </div></div>
    <div class="card"><h2>${esc(t('d.notes'))}</h2>
      <textarea id="dNotes" placeholder="${esc(t('d.notesPh'))}">${esc(r.notes || '')}</textarea></div>
    <div class="cards">
      <div class="card"><h2>${esc(t('d.mapsPlayed'))}</h2><table><thead><tr><th>${esc(t('col.map'))}</th><th class="r">${esc(t('col.count'))}</th><th class="r">${esc(t('col.avgProfit'))}</th><th class="r">${esc(t('col.avgDuration'))}</th></tr></thead><tbody>
        ${r.strategy.maps.map((m) => `<tr><td>${esc(m.name)}<br><span class="muted">${Object.keys(m.areaIds).map((a) => esc(t('d.zone', { id: a }))).join(', ')}</span></td><td class="r">${m.runs}</td><td class="r ${cls(m.profit)}">${fe(m.profit / m.runs, true)}</td><td class="r">${dur(m.durationMs / m.runs)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="card"><h2>${esc(t('d.consumables'))}</h2><table><thead><tr><th>${esc(t('col.item'))}</th><th class="r">${esc(t('col.perMap'))}</th><th class="r">${esc(t('col.unit'))}</th><th class="r">${esc(t('col.costPerMap'))}</th></tr></thead><tbody>
        ${r.strategy.consumables.map((c) => `<tr><td>${icon(c.img)}${esc(c.name)}</td><td class="r">${nf3.format(c.perMap)}</td><td class="r muted">${unit(c.unit)}</td><td class="r neg">${fe(-c.perMap * c.unit)}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">${esc(t('d.none'))}</td></tr>`}
      </tbody></table></div>
    </div>
    <div class="cards">
      <div class="card"><h2>${esc(t('d.modifiers'))}</h2><table><thead><tr><th class="r">${esc(t('col.perMap'))}</th><th>${esc(t('col.effect'))}</th></tr></thead><tbody>
        ${mods.slice(0, 40).map((m) => `<tr><td class="r">${nf1.format(m.perMap)}×</td><td class="bar-cell"><div class="bar" style="width:${(m.perMap / maxMod) * 100}%"></div><span>${esc(m.desc)}</span></td></tr>`).join('') || `<tr><td colspan="2" class="muted">${esc(t('d.noModifiers'))}</td></tr>`}
      </tbody></table>${hiddenMods ? `<p class="muted" style="margin-top:8px">${esc(t('d.hiddenMods', { n: hiddenMods }))}</p>` : ''}</div>
      <div class="card"><h2>${esc(t('d.bestDrops'))}</h2><table><thead><tr><th>${esc(t('col.item'))}</th><th class="r">${esc(t('col.qty'))}</th><th class="r">${esc(t('col.value'))}</th></tr></thead><tbody>
        ${r.loot.slice(0, 25).map((i) => `<tr class="${i.ignored ? 'ignored' : ''}"><td>${icon(i.img)}${esc(i.name)}</td><td class="r">${qty(i.qty)}</td><td class="r ${cls(i.value)}">${fe(i.value, true)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;
  $('sessList').hidden = true;
  $('sessDetail').hidden = false;
  $('dBack').onclick = () => { closeSession(); loadSessions(); };
  $('dTitle').onchange = () => tli.updateReport(id, { title: $('dTitle').value });
  $('dNotes').onchange = () => tli.updateReport(id, { notes: $('dNotes').value });
  $('dTag').onchange = () => tli.updateReport(id, { strategyTag: $('dTag').value });
  $('dDelete').onclick = async () => {
    if (!confirm(t('sess.confirmDelete') + (r.shared ? '\n' + t('sess.confirmDeleteShared') : ''))) return;
    await tli.deleteReport(id); closeSession(); loadSessions();
  };
  renderShare(r);
  loadCompare(id);
}

// Comparaison avec la communauté (stats anonymes, même carte et même Timemark).
async function loadCompare(id) {
  const c = await tli.compareStats(id);
  const box = $('cmpBox');
  if (!box || openReportId !== id || !c) return;
  box.hidden = false;
  const where = `${c.region}${c.tier ? ' · T' + c.tier : ''}`;
  if (!c.enough) {
    box.innerHTML = `<h2>${esc(t('cmp.title', { map: where }))}</h2><p class="muted">${esc(t('cmp.notEnough', { n: c.players, needed: c.needed }))}</p>`;
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
      if (!confirm(t('share.confirmRemove'))) return;
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

async function doShare(id) {
  if ($('shMsg')) $('shMsg').textContent = t('share.sending');
  try {
    await tli.updateReport(id, { title: $('dTitle').value, notes: $('dNotes').value, strategyTag: $('dTag').value });
    await tli.shareReport(id);
    openSession(id);
  } catch (e) { if ($('shMsg')) $('shMsg').textContent = t('share.error', { msg: errMsg(e) }); }
}

['fLoot', 'fCost', 'fOther', 'fText'].forEach((id) => ($(id).oninput = () => refresh(true)));
$('newSession').onclick = () => tli.action('newSession');
$('pickLog').onclick = () => tli.action('pickLog');
$('sMode').onchange = (e) => tli.action('mode', e.target.value);
$('sTime').onchange = (e) => tli.action('timeMode', e.target.value);
$('sCommunity').onchange = (e) => tli.action('community', e.target.checked);
$('sShareMeta').onchange = (e) => tli.action('shareMeta', e.target.checked);
$('sStock').onchange = (e) => tli.action('stockAlerts', e.target.checked);
$('sFarmStats').onchange = (e) => tli.action('shareFarmStats', e.target.checked);
$('sCheckUpd').onclick = () => tli.action('checkUpdates');
$('sTartarus').onchange = (e) => tli.action('tartarusAlerts', e.target.checked);
$('sMinLoot').onchange = (e) => tli.action('minLootValue', e.target.value);
$('sStockTest').onclick = () => tli.action('testStockAlert');
tli.onStockAlert((a) => { flash(stockText(a)); if (a.sound) alertSound(a); });
// Son de chaque alerte : son intégré ou fichier du joueur (bouton ▶ pour écouter).
function renderSounds(s) {
  document.querySelectorAll('[data-sndname]').forEach((el) => {
    const v = s.settings.sounds[el.dataset.sndname] || 'builtin';
    el.textContent = v.startsWith('file:') ? t('snd.myFile', { name: v.split(/[\\/]/).pop() }) : t(el.dataset.sndname === 'stock' ? 'snd.builtinBeeps' : 'snd.builtin');
    document.querySelector(`[data-sndreset="${el.dataset.sndname}"]`).hidden = !v.startsWith('file:');
  });
}
document.querySelectorAll('[data-sndfile]').forEach((b) => (b.onclick = () => tli.action('pickSound', b.dataset.sndfile)));
document.querySelectorAll('[data-sndreset]').forEach((b) => (b.onclick = () => tli.action('resetSound', b.dataset.sndreset)));
let testLevel = 10;
document.querySelectorAll('[data-sndtest]').forEach((b) => (b.onclick = async () => {
  const k = b.dataset.sndtest;
  // Stock : chaque clic fait entendre le palier suivant (1, 2 puis 3 bips).
  if (k === 'stock') testLevel = testLevel === 10 ? 5 : testLevel === 5 ? 1 : 10;
  alertSound({ soundSpec: await tli.soundSpec(k), kind: k === 'stock' ? 'stock' : k === 'tartarusFull' ? 'tartarus-full' : 'tartarus-ready', level: k === 'stock' ? testLevel : 5 });
}));
$('refreshCommunity').onclick = () => tli.action('refreshCommunity');
$('saveHub').onclick = () => tli.action('hubPatterns', $('sHub').value);
$('sOpacity').onchange = (e) => tli.action('opacity', +e.target.value);
$('sScale').onchange = (e) => tli.action('scale', +e.target.value);
$('sSolid').onchange = (e) => tli.action('solid', e.target.checked);
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

tli.onState((s) => {
  last = s;
  // Après ce passage (la langue choisie est appliquée plus bas) : sinon les fenêtres s'affichent en anglais.
  if (!whatsNewChecked && s.settings.onboarded) { whatsNewChecked = true; setTimeout(whatsNewModal, 0); }
  // Session de farm qui démarre sans réponse : on demande (la question disparaît si le widget a répondu).
  // Information unique : dès que l'app est prête (toutes les cartes jouées comptent, pas seulement les sessions).
  if (s.settings.onboarded && whatsNewDone && !s.settings.farmStatsNotice && !$('wnOk')) setTimeout(farmStatsNotice, 0);
  if (setLang(s.settings.lang)) {
    // Langue changée : on redessine ce qui est généré en JS.
    $('feed').dataset.h = '';
    if (tab === 'sessions') { if (openReportId) openSession(openReportId); else loadSessions(); }
    if (tab === 'prices') loadPrices();
    if (tab === 'build') Build.show();
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

  const st = s.status;
  const stateTxt = t('st.' + st.state, { pct: Math.round(st.progress * 100) });
  const msg = st.msgKey ? t(st.msgKey, st.msgVars) : '';
  $('statusLine').innerHTML = `<b>${esc(stateTxt)}</b> · ${esc(s.zone.hub ? t('zone.hideout') : t('zone.inMap'))} · ${s.snapshotReady ? esc(t('st.bagOk')) : `<span class="neg">${esc(t('st.bagUnknown'))}</span>`}${msg ? ' · ' + esc(msg) : ''}`;

  if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
    $('logPath').textContent = st.logPath || t('set.logNotFound');
    $('sMode').value = s.mode;
    $('sTime').value = s.timeMode;
    $('sLang').value = LANG;
    $('sCommunity').checked = s.settings.communityPrices;
    $('sShareMeta').checked = s.settings.shareMeta !== false;
    $('sStock').checked = s.settings.stockAlerts !== false;
    $('sFarmStats').checked = s.settings.shareFarmStats !== false;
    $('sTartarus').checked = s.settings.tartarusAlerts !== false;
    renderSounds(s);
    if (document.activeElement !== $('sMinLoot')) $('sMinLoot').value = s.settings.minLootValue || 0;
    $('sHub').value = s.settings.hubPatterns.join(', ');
    $('sOpacity').value = s.settings.overlay.opacity;
    $('sScale').value = s.settings.overlay.scale;
    $('sSolid').checked = !!s.settings.overlay.solid;
    $('sAutoPause').checked = s.settings.autoPause !== false;
    $('sLock').checked = !!s.settings.overlay.locked;
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
    <td><details class="run"><summary>${mapLabel(r.name)} <span class="muted">${r.zones.length > 1 ? esc(t('runs.zones', { n: r.zones.length - 1 })) : ''}</span></summary><div class="runitems">${itemsTxt || esc(t('runs.noItems'))}</div></details></td>
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
  $('itemList').innerHTML = list.map((i) => `<tr class="${i.ignored ? 'ignored' : ''}" title="${i.ignored ? esc(t('items.ignored')) : ''}"><td>${icon(i.img)}${esc(i.name)}</td><td class="r">${qty(i.qty)}</td><td class="r muted">${unit(i.unit)}</td><td><span class="tag">${esc(srcLabel(i.source))}</span></td><td class="r ${cls(i.value)}">${fe(i.value, true)}</td></tr>`).join('')
    || `<tr><td colspan="5" class="muted">${esc(t('items.empty'))}</td></tr>`;
}

let histCache = [];
function renderHistory(hist) {
  if (hist) {
    histCache = hist;
    const maps = hist.filter((r) => /Beacon\s*\(Timemark/i.test(r.name || '') || r.name === 'Tartarus').map((r) => parseMap(r.name));
    fillFilter($('hfTier'), uniq(maps.map((m) => m.tier)).sort((a, b) => b - a), 'qf.allTiers', (v) => `Timemark ${v}`);
    fillFilter($('hfMap'), uniq(maps.map((m) => m.region)).sort(), 'qf.allMaps');
  }
  const tier = $('hfTier').value, map = $('hfMap').value;
  // Anciennes zones de leveling (sans balise) : gardées dans le fichier mais plus affichées.
  const isMap = (r) => /Beacon\s*\(Timemark/i.test(r.name || '') || r.name === 'Tartarus';
  const list = histCache.filter((r) => { const m = parseMap(r.name); return isMap(r) && (!tier || m.tier === tier) && (!map || m.region === map); });
  $('hfCount').textContent = list.length === histCache.length ? '' : t('qf.count', { n: list.length, total: histCache.length });
  // Groupé par jour : une ligne d'en-tête (jour, nombre de cartes, total) puis l'heure seule.
  const days = new Map();
  for (const r of list.slice().reverse().slice(0, 1000)) { const k = new Date(r.startedAt).toDateString(); if (!days.has(k)) days.set(k, []); days.get(k).push(r); }
  $('histList').innerHTML = [...days.values()].map((rs) => {
    const total = rs.reduce((n, r) => n + r.profit, 0);
    return `<tr class="day"><td colspan="5"><b>${esc(dayLabel(rs[0].startedAt))}</b> · ${esc(t(rs.length === 1 ? 'day.map1' : 'day.maps', { n: rs.length }))} · <span class="${cls(total)}">${fe(total, true)} FE</span></td></tr>`
      + rs.map((r) => {
        const perH = r.durationMs > 30000 ? r.profit / (r.durationMs / 3600000) : 0;
        return `<tr><td class="muted">${timeOnly(r.startedAt)}</td><td>${mapLabel(r.name)}</td><td class="r muted">${dur(r.durationMs)}</td><td class="r ${cls(r.profit)}">${fe(r.profit, true)}</td><td class="r">${fe(perH)}</td></tr>`;
      }).join('');
  }).join('') || `<tr><td colspan="5" class="muted">${esc(t('history.empty'))}</td></tr>`;
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
  $('priceList').innerHTML = list.map((p) => `<tr><td>${nameCell(p)}</td><td class="muted">${p.id}</td><td class="r">${unit(p.price)}</td><td>${srcTag(p)}</td><td class="muted">${p.ts ? dateTime(p.ts) : ''}</td>
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
  const VERDICT = { sell: 'loot', low: '', noprice: 'cost', variable: 'var', bound: '' };
  async function render() {
    const v = $('bagView');
    if (!v || tab !== 'bag') return;
    const d = await tli.bagScan({ min });
    if (!d.ready && !d.rows.length) {
      v.innerHTML = `<div class="card bag-empty"><h2>${esc(t('bag.notReady'))}</h2><p class="muted">${esc(t('bag.notReadyHelp'))}</p></div>`;
      return;
    }
    const rows = filter === 'all' ? d.rows : d.rows.filter((r) => r.verdict === filter);
    const chip = (k, n) => `<button class="fchip ${filter === k ? 'on' : ''}" data-f="${k}">${esc(t('bag.f.' + k))} <b>${n}</b></button>`;
    const focus = document.activeElement && document.activeElement.id === 'bagMin';
    v.innerHTML = `
      <div class="bag-head">
        <div><h2>${esc(t('bag.title'))}</h2><p class="muted">${esc(t('bag.intro'))}</p></div>
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
        ${chip('all', d.counts.all)}${chip('sell', d.counts.sell)}${chip('low', d.counts.low)}${chip('noprice', d.counts.noprice)}${d.counts.variable ? chip('variable', d.counts.variable) : ''}${d.counts.bound ? chip('bound', d.counts.bound) : ''}
        <label class="muted bag-min">${esc(t('bag.minLabel'))} <input id="bagMin" type="number" min="0" step="0.5" value="${min}" style="width:76px"> FE</label>
      </div>
      <table><thead><tr><th>${esc(t('col.item'))}</th><th class="r">${esc(t('col.quantity'))}</th><th class="r">${esc(t('col.unit'))}</th><th class="r">${esc(t('bag.col.stack'))}</th><th>${esc(t('bag.col.price'))}</th><th>${esc(t('bag.col.verdict'))}</th></tr></thead><tbody>
      ${rows.map((r) => `<tr class="${r.verdict === 'low' || r.verdict === 'bound' ? 'dim' : ''}">
          <td>${icon(r.img)}${esc(r.name)}</td><td class="r">${nf0.format(r.qty)}</td><td class="r muted" title="${r.verdict === 'variable' ? esc(t('bag.varTip')) : ''}">${r.verdict === 'variable' ? (r.unit ? esc(t('bag.upTo', { p: unit(r.unit) })) : '–') : unit(r.unit)}</td>
          <td class="r"><b class="${r.verdict === 'sell' ? 'pos' : ''}">${r.unit && r.verdict !== 'variable' ? fe(r.value) : '–'}</b></td>
          <td class="muted" style="font-size:12px">${r.unit ? `${esc(srcLabel(r.source))}${r.players ? ' · ' + esc(t('prices.players', { n: r.players })) : ''}${r.ts ? ` · <span class="${r.stale ? 'neg' : ''}">${esc(ago(r.ts))}</span>` : ''}` : ''}</td>
          <td><span class="tag ${VERDICT[r.verdict]}">${esc(t('bag.v.' + r.verdict))}</span></td></tr>`).join('')
        || `<tr><td colspan="6" class="muted">${esc(t('bag.none'))}</td></tr>`}
      </tbody></table>
      ${d.counts.variable ? `<p class="muted" style="margin-top:10px;font-size:12px">${esc(t('bag.varNote', { n: d.counts.variable }))}</p>` : ''}
      ${d.hidden ? `<p class="muted" style="margin-top:6px;font-size:12px">${esc(t('bag.hidden', { n: d.hidden }))}</p>` : ''}`;
    v.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { filter = b.dataset.f; render(); }));
    $('bagRefresh').onclick = () => render();
    $('bagMin').onchange = () => { min = Math.max(0, +$('bagMin').value || 0); try { localStorage.setItem('bagMin', String(min)); } catch {} render(); };
    if (focus) $('bagMin').focus();
  }
  function show() {
    render();
    clearInterval(timer);
    timer = setInterval(() => { if (tab === 'bag') render(); else clearInterval(timer); }, 5000);
  }
  return { show };
})();
