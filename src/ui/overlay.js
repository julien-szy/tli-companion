const $ = (id) => document.getElementById(id);
let seen = new Set();
let firstRender = true;

$('btnCollapse').onclick = () => tli.action('collapse');
$('btnDash').onclick = () => tli.action('dashboardToggle');
$('btnPause').onclick = () => tli.action('pause');
$('btnHide').onclick = () => tli.action('hideOverlay');
$('updBtn').onclick = () => tli.action('installUpdate');
// Menu ⋯ (pendant une session) : arrêter et relancer, ou réinitialiser avec un 2e clic dans les 3 secondes.
let resetTimer = null;
const disarm = () => {
  clearTimeout(resetTimer); resetTimer = null;
  $('btnReset').classList.remove('armed');
  $('resetLbl').textContent = t('ov.reset'); $('resetHelp').textContent = t('ov.resetHelp');
};
const closeMenu = () => { $('sMenu').hidden = true; disarm(); };
$('btnMore').onclick = (e) => { e.stopPropagation(); if ($('sMenu').hidden) $('sMenu').hidden = false; else closeMenu(); };
$('btnRestart').onclick = () => { closeMenu(); tli.action('restartFarm'); };
$('btnReset').onclick = () => {
  if (!resetTimer) {
    $('btnReset').classList.add('armed');
    $('resetLbl').textContent = t('ov.resetConfirm'); $('resetHelp').textContent = t('ov.resetConfirmHelp');
    resetTimer = setTimeout(disarm, 3000);
    return;
  }
  closeMenu(); tli.action('resetFarm');
};
document.addEventListener('click', (e) => { if (!$('sMenu').hidden && !e.target.closest('#sMenu') && !e.target.closest('#btnMore')) closeMenu(); });
// Bouton du bas : derniers drops → plus rentables de la session → plus rentables de la carte.
const DROP_MODES = ['recent', 'value', 'map'];
let dropsSort = 'recent';
$('dropsSwitch').onclick = () => tli.action('dropsSort', DROP_MODES[(DROP_MODES.indexOf(dropsSort) + 1) % DROP_MODES.length]);
$('btnLock').onclick = () => tli.action('lock', true);
let recording = false;
$('btnRec').onclick = () => tli.action(recording ? 'stopFarm' : 'startFarm');
// Double-clic sur la barre = réduire / agrandir
document.querySelector('.mini').ondblclick = () => tli.action('collapse');
// Mode ultra minimal : double-clic = ouvrir le tableau de bord.
$('ultra').ondblclick = () => tli.action('dashboardToggle');
const uVal = (el, v, signed = true) => { el.textContent = fe(v, signed); el.className = v > 0 ? 'up' : v < 0 ? 'un' : 'uz'; };

// Icônes « agrandir » / « réduire » (coins vers l'extérieur ou vers l'intérieur).
const IC_EXPAND = '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>';
const IC_COLLAPSE = '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>';

function setVal(el, v, signed = true) {
  el.textContent = fe(v, signed);
  el.className = el.className.replace(/\b(pos|neg|zero)\b/g, '').trim() + ' ' + cls(v);
}

tli.onState((s) => {
  if (setLang(s.settings.lang)) { firstRender = true; $('recent').dataset.html = ''; }
  const collapsed = s.settings.overlay.collapsed;
  // Infos choisies dans Réglages > Contenu du widget : les autres sont masquées.
  const off = new Set(s.settings.overlay.hide || []);
  document.querySelectorAll('[data-w]').forEach((el) => el.classList.toggle('woff', off.has(el.dataset.w)));
  const nStats = ['session', 'perHour', 'maps'].filter((k) => !off.has(k)).length;
  $('statGrid').classList.toggle('woff', !nStats);
  $('statGrid').style.gridTemplateColumns = `repeat(${Math.max(1, nStats)}, 1fr)`;
  $('infoLine').classList.toggle('woff', ['avg', 'avgTime', 'cost', 'total'].every((k) => off.has(k)));
  document.body.classList.toggle('collapsed', collapsed);
  $('icCollapse').innerHTML = collapsed ? IC_EXPAND : IC_COLLAPSE;
  $('btnCollapse').title = t(collapsed ? 'ov.expand' : 'ov.collapse.title');
  document.body.classList.toggle('solid', !!s.settings.overlay.solid);
  document.body.classList.toggle('unitp', !!s.settings.overlay.unitPrice);
  document.body.classList.toggle('noflash', !!s.settings.overlay.noFlash);
  document.body.classList.toggle('compact', !!s.settings.overlay.compact);
  // Mode ultra minimal (Réglages > Widget) : enregistrement, carte en cours, FE/h, session.
  const ultra = !!s.settings.overlay.ultra;
  document.body.classList.toggle('ultra', ultra);
  if (ultra) {
    const lines = s.settings.overlay.ultraLines || ['rec', 'map', 'ph', 'sess'];
    document.querySelectorAll('[data-ul]').forEach((el) => (el.hidden = !lines.includes(el.dataset.ul)));
    const ss = s.session, c = s.current || s.lastRun;
    const st = !s.recording ? 'off' : ss.paused ? 'pause' : 'rec';
    $('uRec').className = 'u' + st;
    $('uRec').innerHTML = st === 'rec' ? '<i></i>REC' : esc(t(st === 'pause' ? 'ov.u.pause' : 'ov.u.off'));
    $('uTime').textContent = s.recording ? dur(ss.realTimeMs) : '';
    if (c) { uVal($('uMap'), c.profit); $('uMapLbl').textContent = `${t(s.current ? 'ov.u.map' : 'ov.u.last')} · ${dur(c.durationMs)}`; }
    else { $('uMap').textContent = '–'; $('uMap').className = 'uz'; $('uMapLbl').textContent = t('ov.u.map'); }
    $('uPh').textContent = fe(ss.perHour);
    uVal($('uSess'), ss.profit);
    $('uRuns').textContent = t('ov.u.session', { n: ss.runs });
  }
  // Verrouillé : rappel du raccourci quelques secondes juste après le verrouillage.
  const locked = !!s.settings.overlay.locked;
  if (locked && !document.body.classList.contains('locked')) {
    $('lockHint').textContent = t('ov.lockedHint');
    $('lockHint').hidden = false;
    clearTimeout(window.lockHintTimer);
    window.lockHintTimer = setTimeout(() => ($('lockHint').hidden = true), 6000);
  }
  if (!locked) $('lockHint').hidden = true;
  document.body.classList.toggle('locked', locked);
  $('btnLock').title = t('ov.lock');
  $('lockMark').title = t('ov.lockedHint');

  // Bouton d'enregistrement : orange « Démarrer », vert « REC 12:34 » pendant une session.
  recording = s.recording;
  $('btnRec').classList.toggle('on', recording);
  // Bouton compact : ▶ seul à l'arrêt, ● + chrono pendant une session, ⏸ orange en pause.
  const paused = recording && s.session.paused;
  $('btnRec').classList.toggle('paused', paused);
  $('recLbl').textContent = recording ? dur(s.session.realTimeMs) : '';
  $('btnPause').hidden = !recording;
  $('btnMore').hidden = !recording;
  if (!recording && !$('sMenu').hidden) closeMenu();
  $('btnPause').innerHTML = paused ? '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>' : '<svg viewBox="0 0 24 24"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></svg>';
  $('btnPause').title = paused ? t(s.session.pauseAuto ? 'ov.resumeAuto' : 'ov.resume') : t('ov.pause');
  $('btnRec').title = t(recording ? 'ov.recStop' : 'ov.recStart');

  // Mise à jour téléchargée : bouton pour redémarrer tout de suite (sinon elle s'installe toute seule au repaire).
  const ready = s.update && s.update.state === 'ready';
  $('updReady').hidden = !ready;
  if (ready) { $('updText').textContent = t('ov.updReady', { v: s.update.version }); $('updBtn').textContent = t('ov.updRestart'); }

  // Avertissements
  let warn = '';
  if (s.status.state === 'nolog') warn = t('warn.nolog');
  else if (s.status.state === 'loading') warn = t('warn.loading', { pct: Math.round(s.status.progress * 100) });
  else if (s.status.state === 'error') warn = t('warn.error', { msg: s.status.error || '' });
  else if (!s.snapshotReady) warn = t('warn.nobag');
  $('warn').hidden = !warn;
  $('warn').textContent = warn;

  const ss = s.session;
  setVal($('perHour'), ss.perHour, false);
  setVal($('sPerHour'), ss.perHour, false);
  setVal($('sProfit'), ss.profit);
  $('sRuns').textContent = ss.runs;
  setVal($('sAvg'), ss.avgPerRun);
  $('sAvgT').textContent = ss.runs ? dur(ss.avgRunMs) : '–';
  $('sTime').textContent = dur(s.timeMode === 'map' ? ss.mapTimeMs : ss.realTimeMs);
  setVal($('sCost'), ss.cost);
  $('sCostBox').title = costTip(ss.costBreakdown);

  // Compteur Tartarus (x/48), avec le repère d'entrée à 36.
  const tt = s.tartarus;
  $('tart').hidden = !tt;
  if (tt) {
    $('tartVal').textContent = `${tt.value}/${tt.max}`;
    $('tartFill').style.width = `${Math.min(100, (tt.value / tt.max) * 100)}%`;
    $('tartMark').style.left = `${(tt.entry / tt.max) * 100}%`;
    $('tart').classList.toggle('full', tt.value >= tt.max);
    $('tart').classList.toggle('ready', tt.value < tt.max && tt.value >= tt.entry);
    $('tart').title = t('tart.tip', { entry: tt.entry, max: tt.max });
  }

  // Carte en cours (ou dernière carte quand on est au repaire)
  const c = s.current || s.lastRun;
  $('curLabel').textContent = t(s.current ? 'ov.currentMap' : s.lastRun ? 'ov.lastMap' : 'ov.inHideout');
  if (c) {
    setVal($('curProfit'), c.profit);
    const place = mapPlace(c.name, c.zones);
    $('curName').textContent = place ? `${place} · ${c.name}` : c.name;
    $('curTime').textContent = dur(c.durationMs);
    $('curCost').textContent = c.cost ? t('ov.costOf', { fe: fe(c.cost, true) }) : '';
    // Sous-carte (Arcana, Vorax…) : son loot à part, le total de la carte reste au-dessus.
    $('curSub').hidden = !c.sub;
    if (c.sub) $('curSub').innerHTML = `<span>→ ${esc(c.sub.zone)}</span><b class="${cls(c.sub.loot)}">${fe(c.sub.loot, true)}</b>`;
    setVal($('miniMap'), c.profit);
    $('miniMapLbl').textContent = s.current ? dur(c.durationMs) : t('ov.last');
  } else {
    $('curProfit').textContent = '–'; $('curProfit').className = '';
    $('curName').textContent = t(recording ? 'ov.waiting' : 'ov.pressStart');
    $('curTime').textContent = ''; $('curCost').textContent = ''; $('curSub').hidden = true;
    $('miniMap').textContent = '–'; $('miniMapLbl').textContent = t('ov.map');
  }

  // Derniers drops, ou drops les plus rentables de la session (Réglages > Widget).
  // Les nouveaux (ou ceux dont la quantité a changé) clignotent.
  const sort = DROP_MODES.includes(s.settings.overlay.dropsSort) ? s.settings.overlay.dropsSort : 'recent';
  dropsSort = sort;
  $('dropsMode').textContent = t('ov.dm.' + sort);
  const byValue = sort === 'value' || sort === 'map';
  const titleKey = sort === 'map' ? 'ov.mapDrops' : byValue ? 'ov.topDrops' : 'ov.recentDrops';
  if ($('dropsTitle').dataset.i18n !== titleKey) {
    $('dropsTitle').dataset.i18n = titleKey;
    $('dropsTitle').textContent = t(titleKey);
    firstRender = true;
  }
  // Liste « Carte » dans une sous-carte : son nom à la place du titre.
  const subZone = sort === 'map' && s.current && s.current.sub ? s.current.sub.zone : null;
  const want = subZone ? `→ ${subZone}` : t(titleKey);
  if ($('dropsTitle').textContent !== want) { $('dropsTitle').textContent = want; firstRender = true; }
  const list = byValue
    ? ((sort === 'map' ? s.mapDrops : s.topDrops) || []).map((e) => ({ key: `${e.id}|${e.qty}`, img: e.img, name: e.name, tip: e.name, delta: e.qty, value: e.value, unit: e.unit }))
    : s.recent.slice(0, 40).map((e) => ({ key: `${e.ts}|${e.id}|${e.delta}`, img: e.img, name: e.name, tip: `${e.name} — ${zoneLabel(e.zone)}`, delta: e.delta, value: e.value, unit: e.unit }));
  const html = list.map((e) => {
    const isNew = !firstRender && !seen.has(e.key);
    return `<div class="row${isNew ? ' new' : ''}" data-k="${esc(e.key)}">${icon(e.img)}<span class="n" title="${esc(e.tip)}">${esc(e.name)}</span><span class="q">${qty(e.delta)}</span><span class="up1" title="${esc(t('ov.unitTip'))}">${e.unit ? '@' + fe(e.unit) : ''}</span><span class="val ${cls(e.value)}">${fe(e.value, true)}</span></div>`;
  }).join('');
  const box = $('recent');
  if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
  seen = new Set(list.map((e) => e.key));
  firstRender = false;
});


// Alerte de stock (balises, compas, sondes…) : bandeau quelques secondes + son.
let stockTimer = null;
tli.onStockAlert((a) => {
  const box = $('stockAlert');
  box.innerHTML = `${a.img ? `<img src="${esc(a.img)}" alt="">` : ''}<span>${esc(stockText(a))}</span>`;
  box.classList.toggle('last', a.qty <= 1);
  box.hidden = false;
  if (a.sound) alertSound(a);
  clearTimeout(stockTimer);
  stockTimer = setTimeout(() => (box.hidden = true), a.qty <= 1 ? 15000 : 8000);
});

// Coin de redimensionnement : tirer pour agrandir / réduire le widget.
$('grip').addEventListener('pointerdown', (e) => {
  e.preventDefault();
  $('grip').setPointerCapture(e.pointerId);
  tli.action('resizeStart');
});
const stopResize = () => tli.action('resizeEnd');
$('grip').addEventListener('pointerup', stopResize);
$('grip').addEventListener('lostpointercapture', stopResize);
window.addEventListener('blur', stopResize);
