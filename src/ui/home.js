// Page d'accueil (résumé de tout) et guide du premier lancement.
const Home = (() => {
  // Mini-graphique de la session (profit cumulé, un point par carte : vert si elle a rapporté, rouge sinon).
  function curveSvg(pts) {
    if (!pts || pts.length < 2) return '';
    const W = 520, H = 70, P = 6;
    // Axe horizontal : numéro de carte (0 = début de la session).
    const n = pts.length - 1;
    const vs = pts.map((p) => p.v), lo = Math.min(0, ...vs), hi = Math.max(0, ...vs), span = hi - lo || 1;
    const x = (i) => P + (i / n) * (W - 2 * P), y = (v) => H - P - ((v - lo) / span) * (H - 2 * P);
    const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
    const area = `${x(0).toFixed(1)},${y(0).toFixed(1)} ${line} ${x(n).toFixed(1)},${y(0).toFixed(1)}`;
    const dots = pts.slice(1).map((p, i) => `<circle cx="${x(i + 1).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${p.live ? 3.5 : 2.6}" class="${p.p >= 0 ? 'up' : 'down'}${p.live ? ' live' : ''}"><title>${esc(`${p.live ? t('ov.currentMap') : '#' + (i + 1)} · ${p.name || ''} · ${fe(p.p, true)} FE (${t('h.curveTotal')} ${fe(p.v, true)})`)}</title></circle>`).join('');
    return `<svg class="sess-curve" viewBox="0 0 ${W} ${H}"><line x1="${P}" x2="${W - P}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}" class="zero"/>
      <polygon points="${area}" class="area"/><polyline points="${line}" class="ln"/>${dots}</svg>`;
  }
  let heroes = [];
  let metaCard = { at: 0, html: '' };
  let lastState = null;
  let top = [];          // top 10 de ma classe
  let slide = 0;
  let heroLabel = '';
  const root = () => $('homeView');
  const heroOf = (key) => heroes.find((h) => h.key === key) || null;
  const portrait = (key, size = 40) => {
    const h = heroOf(key);
    return h ? `<img class="portrait" style="width:${size}px;height:${size}px" src="${esc(h.portrait)}" alt="">` : `<span class="portrait unknown" style="width:${size}px;height:${size}px">?</span>`;
  };
  const hoursTxt = (h) => (h == null ? '' : h < 1 ? t('b.minutes', { n: Math.max(1, Math.round(h * 60)) }) : t('b.hours', { n: nf1.format(h) }));

  async function init() { heroes = await tli.getHeroes(); }

  // Carte « méta de ma classe » : rafraîchie au plus toutes les 5 minutes (lecture de fichiers / réseau).
  async function refreshMetaCard(s) {
    if (!s.hero || Date.now() - metaCard.at < 5 * 60000) return;
    metaCard.at = Date.now();
    try {
      const { local, remote } = await tli.metaFiles();
      const myServer = (local.find((f) => f.server) || {}).server;
      // Sources par ordre de préférence : mon serveur, le global, puis mes classements locaux (les plus complets d'abord).
      const sources = [
        ...remote.filter((f) => f.server === myServer), ...remote.filter((f) => f.server === 'global'),
        ...local.slice().sort((a, b) => b.season - a.season || b.size - a.size),
      ];
      if (!sources.length) { metaCard.html = `<p class="empty-cta">${esc(t('h.metaNone'))}</p>`; return render(); }
      // On garde la première source où ma classe apparaît.
      let src = null, o = null, mine = null;
      for (const cand of sources) {
        const ov = await tli.metaOverview(cand.key);
        const m = ov && ov.classes.find((c) => c.heroId === s.hero.id);
        if (m) { src = cand; o = ov; mine = m; break; }
      }
      if (!mine) { metaCard.html = `<p class="empty-cta">${esc(t('h.metaNotRanked'))}</p>`; top = []; return render(); }
      const rank = o.classes.slice().sort((a, b) => b.score - a.score).findIndex((c) => c.heroId === mine.heroId) + 1;
      const d = await tli.metaClass(src.key, s.hero.id, 100);
      metaCard.html = `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><span class="tier t${mine.tier}" style="width:40px;height:34px;font-size:18px">${mine.tier}</span>
          <div><b>${esc(t('h.metaRank', { rank, total: o.classes.length }))}</b><div class="muted">${esc(t('h.metaPlayers', { n: nf0.format(mine.players) }))}</div></div></div>`;
      // Les 10 meilleurs joueurs de ma classe (par DPS) et leur build.
      const pl = await tli.metaPlayers(src.key, s.hero.id, { sort: 'dps', limit: 10 });
      top = pl.players.filter((p) => p.active.length || p.uniques.length);
      slide = 0;
      heroLabel = s.hero.name;
    } catch (e) { metaCard.html = `<p class="empty-cta">${esc(errMsg(e))}</p>`; }
    render();
  }

  // ---------- Carrousel : les 10 meilleurs builds de ma classe ----------
  function carouselHtml() {
    if (!top.length) return `<p class="empty-cta">${esc(t('h.noTop'))}</p>`;
    const p = top[slide];
    const main = p.active[0];
    return `<div class="chead"><span class="muted">${slide + 1} / ${top.length}</span>
        <button class="btn round" id="cPrev" ${slide === 0 ? 'disabled' : ''} aria-label="‹">‹</button>
        <button class="btn round" id="cNext" ${slide >= top.length - 1 ? 'disabled' : ''} aria-label="›">›</button></div>
      <div class="carousel">
        <div class="cslide card" style="margin:0;background:var(--panel2)">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div><span class="muted">#${slide + 1}</span> <span class="cname">${p.name ? esc(p.name) : esc(t('m.hiddenPlayer'))}</span>
              <div class="muted">${esc(t('m.level'))} ${p.level} · <b style="color:var(--text)">${p.dps >= 1e6 ? nf1.format(p.dps / 1e6) + "M" : p.dps >= 1e3 ? nf1.format(p.dps / 1e3) + "k" : nf0.format(p.dps)} DPS</b>${p.server ? ' · ' + esc(p.server) : ''}</div></div>
            <button class="btn ghost" id="cDetails">${esc(t('h.details'))}</button>
          </div>
          ${main ? `<div class="cline"><span class="muted" style="min-width:90px">${esc(t('h.mainSkill'))}</span>${main.img ? `<img src="${esc(main.img)}" alt="">` : ''}<b>${esc(main.name)}</b>
            ${main.supports.map((x) => (x.img ? `<img src="${esc(x.img)}" title="${esc(x.name)}" alt="">` : '')).join('')}</div>` : ''}
          <div class="cline"><span class="muted" style="min-width:90px">${esc(t('m.legendaries'))}</span>${p.uniques.map((u) => (u.img ? `<img src="${esc(u.img)}" title="${esc(u.name)}" alt="">` : `<span class="chip">${esc(u.name)}</span>`)).join('')}</div>
          <div class="cline"><span class="muted" style="min-width:90px">${esc(t('m.talents'))}</span>${(p.talents || []).filter((x) => x.name).map((x) => (x.img ? `<img src="${esc(x.img)}" title="${esc(x.name)}" alt="">` : '')).join('')}</div>
        </div>
      </div>
      <div class="cdots">${top.map((_, i) => `<i class="${i === slide ? 'on' : ''}"></i>`).join('')}</div>`;
  }
  function bindCarousel() {
    if ($('cPrev')) $('cPrev').onclick = () => { slide = Math.max(0, slide - 1); render(); };
    if ($('cNext')) $('cNext').onclick = () => { slide = Math.min(top.length - 1, slide + 1); render(); };
    if ($('cDetails')) $('cDetails').onclick = () => openProfile(top[slide]);
  }
  // Fiche complète du joueur dans une fenêtre par-dessus l'accueil.
  function openProfile(p) {
    let box = document.getElementById('profileModal');
    if (!box) { box = document.createElement('div'); box.id = 'profileModal'; document.body.appendChild(box); }
    const key = lastState && lastState.hero && lastState.hero.key;
    box.innerHTML = `<div class="modal-bg"><div class="modal" style="width:min(900px,94vw);max-height:88vh;overflow:auto">
      <div style="display:flex;justify-content:flex-end"><button class="btn" id="pmClose">✕</button></div>
      ${Profile.html(p, heroLabel, portrait(key, 64))}</div></div>`;
    $('pmClose').onclick = () => { box.innerHTML = ''; };
    box.querySelector('.modal-bg').onclick = (e) => { if (e.target.classList.contains('modal-bg')) box.innerHTML = ''; };
  }

  function update(s) { lastState = s; render(); refreshMetaCard(s); }

  // Barre « mon build suivi » : où j'en suis, ce qu'il me faut ensuite, et mes FE (le FE seul, pas les objets à vendre).
  function recapHtml(r) {
    if (!r) return `<div class="card hcard brecap empty"><h2><span>${esc(t('hb.title'))} <span class="tag beta">BETA</span></span> <a data-go="build">${esc(t('hb.find'))} →</a></h2>
      <p class="muted">${esc(t('hb.none'))}</p></div>`;
    const done = r.stepIndex == null;
    const afford = r.missing > 0 ? Math.min(100, Math.round((r.feInBag / r.missing) * 100)) : 100;
    const time = r.hours == null ? t('b.hoursUnknown') : r.hours < 1 ? t('b.minutes', { n: Math.max(1, Math.round(r.hours * 60)) }) : t('b.hours', { n: nf1.format(r.hours) });
    return `<div class="card hcard brecap"><h2><span>${esc(t('hb.title'))} <span class="tag beta">BETA</span></span> <a data-build="${esc(r.id)}">${esc(t('hb.open'))} →</a></h2>
      <div class="br-top">${portrait(r.heroKey, 40)}<div class="br-name"><b>${esc(r.title)}</b>
        <small class="muted">${esc(done ? t('b.allDone') : t('hb.stage', { n: r.stepIndex + 1, total: r.stepCount, title: r.stepTitle }))}</small></div>
        <div class="br-kpis"><div><span>${esc(t('hb.feBag'))}</span><b>${fe(r.feInBag)} FE</b></div>
          <div><span>${esc(t('hb.missing'))}</span><b>${done ? '–' : fe(r.missing) + ' FE'}</b></div>
          <div><span>${esc(t('b.farmTime'))}</span><b>${done ? '–' : esc(time)}</b></div></div></div>
      <div class="br-bars"><div><span>${esc(t('hb.stagePct', { pct: r.stepPct }))}</span><div class="progress"><div style="width:${r.stepPct}%"></div></div></div>
        <div><span>${esc(t('hb.afford', { pct: afford }))}</span><div class="progress fe"><div style="width:${afford}%"></div></div></div>
        <div><span>${esc(t('hb.overall', { pct: r.overallPct }))}</span><div class="progress all"><div style="width:${r.overallPct}%"></div></div></div></div>
      ${r.next.length ? `<div class="br-next"><span class="muted">${esc(t('hb.next'))}</span>${r.next.map((n) => `<span class="chip${n.affordable ? ' ok' : ''}">${icon(n.img)}${esc(n.name)} <b>${n.cost ? fe(n.cost) + ' FE' : '?'}</b></span>`).join('')}</div>` : ''}</div>`;
  }

  function render() {
    const s = lastState;
    if (!s || !root()) return;
    const ss = s.session;
    const ok = s.status.state === 'live';
    const name = s.settings.server.name;
    const key = s.hero && s.hero.key;
    const st = s.status;
    const setup = st.state === 'nolog' ? `
      <div class="card setup"><h2>${esc(t('h.setupTitle'))}</h2>
        <p class="muted" style="margin-bottom:8px">${esc(t(st.gameDir ? 'h.gameFound' : 'h.gameNotFound'))}</p>
        <ol><li>${esc(t('h.setup1'))}</li><li>${esc(t('h.setup2'))}</li><li>${esc(t('h.setup3'))}</li></ol>
        <p class="muted" style="margin-top:10px">${esc(t('h.logWhere'))}<br><code class="path">${esc(st.expectedLog || t('h.logExample'))}</code></p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button class="btn primary" id="hPickLog">${esc(t('h.pickLog'))}</button>
          ${st.gameDir ? `<button class="btn" id="hOpenLog">${esc(t('h.openLogDir'))}</button>` : ''}
          <span class="muted" style="align-self:center;font-size:12px">${esc(t('h.autoRetry'))}</span></div></div>` : '';
    const timeMs = s.timeMode === 'map' ? ss.mapTimeMs : ss.realTimeMs;
    const last = s.current || s.lastRun;
    const tt = s.tartarus;
    const I = {
      play: '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>',
      stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
      widget: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/></svg>',
      list: '<svg viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
      pause: '<svg viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>',
    };
    root().innerHTML = `
      <div class="hello">
        ${portrait(key, 46)}
        <div><h1>${esc(name ? t('h.helloName', { name }) : t('h.hello'))}</h1>
          <div class="muted">${esc(s.hero ? s.hero.name : t('h.noClassYet'))}</div></div>
        <div class="chips" style="margin-left:auto">
          <span class="chip ${ok ? 'ok' : 'ko'}">${esc(ok ? t('h.chipLog') : t('h.chipNoLog'))}</span>
          <span class="chip ${s.snapshotReady ? 'ok' : 'ko'}">${esc(s.snapshotReady ? t('h.chipBag') : t('h.chipNoBag'))}</span>
          <span class="chip">${esc(s.zone.hub ? t('zone.hideout') : t('zone.inMap'))}</span>
        </div>
      </div>
      ${setup}
      <section class="sess-hero ${s.recording ? (ss.paused ? 'rec paused' : 'rec') : ''}">
        <div class="sess-main">
          <div class="sess-label"><span class="dot"></span>${esc(!s.recording ? t('h.session') : ss.paused ? t(ss.pauseAuto ? 'h.pausedAuto' : 'h.paused', { time: dur(ss.pauseNowMs) }) : t('h.recording', { time: dur(ss.realTimeMs) }))}</div>
          <div class="sess-profit ${cls(ss.profit)}">${fe(ss.profit, true)}<small>FE</small></div>
          <div class="sess-kpis">
            <div><span>${esc(t('k.perHour'))}</span><b>${fe(ss.perHour)}</b></div>
            <div><span>${esc(t('k.maps'))}</span><b>${ss.runs}</b></div>
            <div><span>${esc(t('k.time'))}</span><b>${dur(timeMs)}</b></div>
            <div><span>${esc(t('k.avg'))}</span><b class="${cls(ss.avgPerRun)}">${ss.runs ? fe(ss.avgPerRun, true) : '–'}</b></div>
          </div>
          ${curveSvg(s.curve)}
          <div class="sess-foot muted">
            <span>${esc(t('ov.bagValue'))} <b>${s.netWorth != null ? fe(s.netWorth) + ' FE' : '–'}</b></span>
            ${ss.efficiency != null ? `<span>${esc(t('k.eff'))} <b>${Math.round(ss.efficiency * 100)} %</b></span>` : ''}
            ${tt ? `<span>Tartarus <b class="${tt.value >= tt.max ? 'neg' : tt.value >= tt.entry ? 'pos' : ''}">${tt.value}/${tt.max}</b></span>` : ''}
          </div>
        </div>
        <div class="sess-side">
          <button class="btn hero-cta ${s.recording ? 'stop' : 'primary'}" id="hFarm">${s.recording ? I.stop : I.play}<span>${esc(s.recording ? t('h.stopShort') : t('sess.start'))}</span></button>
          ${s.recording ? `<button class="btn ghost" id="hPause">${ss.paused ? I.play : I.pause}<span>${esc(t(ss.paused ? 'h.resume' : 'h.pause'))}</span></button>` : ''}
          <button class="btn ghost" id="hWidget">${I.widget}<span>${esc(s.overlayVisible ? t('h.hideOverlay') : t('h.showOverlay'))}</span></button>
          <button class="btn ghost" data-go="live">${I.list}<span>${esc(t('h.liveDetails'))}</span></button>
        </div>
      </section>
      <div class="home-row">
        <div class="card hcard">
          <h2>${esc(t(s.current ? 'ov.currentMap' : 'ov.lastMap'))} <a data-go="history">${esc(t('h.history'))} →</a></h2>
          ${last ? `<div class="lastmap"><b>${esc(mapPlace(last.name, last.zones) || last.name)}${mapPlace(last.name, last.zones) ? `<small class="muted lm-beacon">${esc(last.name)}</small>` : ''}</b><span class="${cls(last.profit)} lm-profit">${fe(last.profit, true)} FE</span></div>
            <div class="lm-sub muted"><span>${dur(last.durationMs)}</span><span>${esc(t('ov.costOf', { fe: fe(last.cost, true) }))}</span></div>`
            : `<p class="muted">${esc(t(s.recording ? 'ov.waiting' : 'ov.pressStart'))}</p>`}
        </div>
        <div class="card hcard">
          <h2>${esc(t('ov.recentDrops'))} <a data-go="live">${esc(t('h.details'))} →</a></h2>
          <div class="drops">${s.recent.slice(0, 5).map((e) => `<div class="drop">${icon(e.img)}<span class="dn">${esc(e.name)}</span><span class="muted">${qty(e.delta)}</span><b class="${cls(e.value)}">${fe(e.value, true)}</b></div>`).join('')
            || `<p class="muted">${esc(t('h.noDrops'))}</p>`}</div>
        </div>
      </div>
      ${recapHtml(s.buildRecap)}
      <div class="card hcard"><h2>${esc(t('h.myClassMeta'))} <a data-go="meta">${esc(t('h.seeMeta'))} →</a></h2>
        ${s.hero ? (metaCard.html ? metaCard.html + carouselHtml() : `<p class="muted">${esc(t('b.loading'))}</p>`) : `<p class="empty-cta">${esc(t('h.noClassYet'))}</p>`}</div>
      <div class="support-strip"><span>☕ ${esc(t('sup.text'))}</span><button class="btn coffee" id="hSupport">${esc(t('sup.cta'))}</button></div>`;
    root().querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => showTab(b.dataset.go)));
    root().querySelectorAll('[data-build]').forEach((b) => (b.onclick = () => { Build.focus(b.dataset.build); showTab('bfollow'); }));
    if ($('hPickLog')) $('hPickLog').onclick = () => tli.action('pickLog');
    if ($('hOpenLog')) $('hOpenLog').onclick = () => tli.action('openLogDir');
    bindCarousel();
    $('hFarm').onclick = () => tli.action(s.recording ? 'stopFarm' : 'startFarm');
    $('hWidget').onclick = () => tli.action('toggleOverlay');
    if ($('hPause')) $('hPause').onclick = () => tli.action('pause');
    $('hSupport').onclick = () => tli.openSupport();
  }

  // ---------- Guide du premier lancement ----------
  let step = 0;
  function onboarding(s) {
    const box = $('onboarding');
    if (s.settings.onboarded) { box.innerHTML = ''; return; }
    if (box.dataset.open === '1' && box.dataset.step === String(step) && box.dataset.lang === LANG) return refreshLive(s);
    box.dataset.open = '1'; box.dataset.step = String(step); box.dataset.lang = LANG;
    const steps = [
      () => `<h1>${esc(t('o.welcome'))}</h1><p class="muted">${esc(t('o.welcomeText'))}</p>
        <div class="langpick"><button class="btn ${LANG === 'en' ? 'on' : ''}" data-lang="en">English</button><button class="btn ${LANG === 'fr' ? 'on' : ''}" data-lang="fr">Français</button></div>`,
      () => `<h1>${esc(t('o.logTitle'))}</h1><p>${esc(t('o.logText'))}</p>
        <ol><li>${esc(t('h.setup1'))}</li><li>${esc(t('h.setup2'))}</li><li>${esc(t('h.setup3'))}</li></ol>
        <p style="margin-top:12px" id="oLive"></p>`,
      () => `<h1>${esc(t('o.classTitle'))}</h1><p>${esc(t('o.classText'))}</p><p style="margin-top:12px" id="oClass"></p>`,
      () => `<h1>${esc(t('o.readyTitle'))}</h1><p>${esc(t('o.readyText'))}</p>
        <ul style="margin:10px 0 0 20px;line-height:1.9"><li>${esc(t('o.ready1'))}</li><li>${esc(t('o.ready2'))}</li><li>${esc(t('o.ready3'))}</li><li>${esc(t('o.ready4'))}</li></ul>`,
    ];
    box.innerHTML = `<div class="modal-bg"><div class="modal">
      <div class="steps">${steps.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
      <div class="body">${steps[step]()}</div>
      <div class="foot"><button class="btn" id="oSkip">${esc(step ? t('o.back') : t('o.skip'))}</button>
        <button class="btn primary big" id="oNext">${esc(step === steps.length - 1 ? t('o.finish') : t('o.next'))}</button></div>
    </div></div>`;
    box.querySelectorAll('[data-lang]').forEach((b) => (b.onclick = () => tli.action('lang', b.dataset.lang)));
    $('oSkip').onclick = () => { if (step) { step--; onboarding(s); } else tli.action('onboarded'); };
    $('oNext').onclick = () => { if (step < steps.length - 1) { step++; onboarding(lastState || s); } else tli.action('onboarded'); };
    refreshLive(s);
  }
  function refreshLive(s) {
    if ($('oLive')) {
      const ok = s.status.state === 'live';
      $('oLive').innerHTML = `<span class="chip ${ok ? 'ok' : 'ko'}">${esc(ok ? t('o.logOk') : t('o.logKo'))}</span>`;
    }
    if ($('oClass')) {
      $('oClass').innerHTML = s.hero && s.hero.key
        ? `<span style="display:inline-flex;align-items:center;gap:10px">${portrait(s.hero.key, 44)}<b>${esc(s.hero.name)}</b></span>`
        : `<span class="muted">${esc(t('o.classUnknown'))}</span>`;
    }
  }

  return { init, update, onboarding };
})();
Home.init();
