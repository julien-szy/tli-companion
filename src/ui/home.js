// Page d'accueil (résumé de tout) et guide du premier lancement.
const Home = (() => {
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
    return `<div class="carousel">
        <button class="btn cnav" id="cPrev" ${slide === 0 ? 'disabled' : ''}>‹</button>
        <div class="cslide card" style="margin:0;background:var(--panel2)">
          <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
            <div><span class="muted">#${slide + 1}</span> <span class="cname">${p.name ? esc(p.name) : esc(t('m.hiddenPlayer'))}</span>
              <div class="muted">${esc(t('m.level'))} ${p.level} · <b style="color:var(--text)">${p.dps >= 1e6 ? nf1.format(p.dps / 1e6) + "M" : p.dps >= 1e3 ? nf1.format(p.dps / 1e3) + "k" : nf0.format(p.dps)} DPS</b>${p.server ? ' · ' + esc(p.server) : ''}</div></div>
            <button class="btn primary" id="cDetails">${esc(t('h.details'))}</button>
          </div>
          ${main ? `<div class="cline"><span class="muted" style="min-width:90px">${esc(t('h.mainSkill'))}</span>${main.img ? `<img src="${esc(main.img)}" alt="">` : ''}<b>${esc(main.name)}</b>
            ${main.supports.map((x) => (x.img ? `<img src="${esc(x.img)}" title="${esc(x.name)}" alt="">` : '')).join('')}</div>` : ''}
          <div class="cline"><span class="muted" style="min-width:90px">${esc(t('m.legendaries'))}</span>${p.uniques.map((u) => (u.img ? `<img src="${esc(u.img)}" title="${esc(u.name)}" alt="">` : `<span class="chip">${esc(u.name)}</span>`)).join('')}</div>
          <div class="cline"><span class="muted" style="min-width:90px">${esc(t('m.talents'))}</span>${(p.talents || []).filter((x) => x.name).map((x) => (x.img ? `<img src="${esc(x.img)}" title="${esc(x.name)}" alt="">` : '')).join('')}</div>
        </div>
        <button class="btn cnav" id="cNext" ${slide >= top.length - 1 ? 'disabled' : ''}>›</button>
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
    const adv = s.advice;
    root().innerHTML = `
      <div class="hello">
        ${portrait(key, 52)}
        <div><h1>${esc(name ? t('h.helloName', { name }) : t('h.hello'))}</h1>
          <div class="muted">${esc(s.hero ? s.hero.name : t('h.noClassYet'))}</div></div>
        <div class="chips" style="margin-left:auto">
          <span class="chip ${ok ? 'ok' : 'ko'}">${esc(ok ? t('h.chipLog') : t('h.chipNoLog'))}</span>
          <span class="chip ${s.snapshotReady ? 'ok' : 'ko'}">${esc(s.snapshotReady ? t('h.chipBag') : t('h.chipNoBag'))}</span>
          <span class="chip">${esc(s.zone.hub ? t('zone.hideout') : t('zone.inMap'))}</span>
        </div>
      </div>
      ${setup}
      <div class="actions">
        <button class="btn primary big" id="hFarm">${esc(s.recording ? t('sess.stop', { time: dur(ss.realTimeMs) }) : t('sess.start'))}</button>
        <button class="btn big" id="hWidget">${esc(s.overlayVisible ? t('h.hideOverlay') : t('h.showOverlay'))}</button>
        <button class="btn big" data-go="meta">${esc(t('h.seeMeta'))}</button>
        <button class="btn big" data-go="build">${esc(t('h.myBuilds'))}</button>
      </div>
      <div class="homegrid">
        <div class="card hcard"><h2>${esc(t('h.session'))} <a data-go="live">${esc(t('h.details'))} →</a></h2>
          <div class="bignum ${cls(ss.profit)}">${fe(ss.profit, true)} <span class="muted" style="font-size:14px">FE</span></div>
          <div class="kv">
            <div><div class="k">${esc(t('k.perHour'))}</div><div class="v">${fe(ss.perHour)}</div></div>
            <div><div class="k">${esc(t('k.maps'))}</div><div class="v">${ss.runs}</div></div>
            <div><div class="k">${esc(t('k.time'))}</div><div class="v">${dur(s.timeMode === 'map' ? ss.mapTimeMs : ss.realTimeMs)}</div></div>
            <div><div class="k">${esc(t('ov.bagValue'))}</div><div class="v">${s.netWorth != null ? fe(s.netWorth) + ' FE' : '–'}</div></div>
          </div></div>
        <div class="card hcard"><h2>${esc(t('h.nextBuy'))}</h2>${comingSoon(t('soon.purchaseTitle'), t('soon.purchaseText'), true)}</div>
        <div class="card hcard" style="grid-column:1/-1"><h2>${esc(t('h.myClassMeta'))} <a data-go="meta">${esc(t('h.seeMeta'))} →</a></h2>
          ${s.hero ? (metaCard.html ? metaCard.html + carouselHtml() : `<p class="muted">${esc(t('b.loading'))}</p>`) : `<p class="empty-cta">${esc(t('h.noClassYet'))}</p>`}</div>
        <div class="card hcard supportcard"><h2>${esc(t('sup.title'))}</h2>
          <p class="muted" style="line-height:1.7">${esc(t('sup.text'))}</p>
          <button class="btn coffee" id="hSupport" style="margin-top:12px">☕ ${esc(t('sup.cta'))}</button></div>
        <div class="card hcard"><h2>${esc(t('h.tips'))}</h2>
          <p class="muted" style="line-height:1.8">${esc(t('h.tip1'))}<br>${esc(t('h.tip2'))}<br>${esc(t('h.tip3'))}</p></div>
      </div>`;
    root().querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => showTab(b.dataset.go)));
    if ($('hPickLog')) $('hPickLog').onclick = () => tli.action('pickLog');
    if ($('hOpenLog')) $('hOpenLog').onclick = () => tli.action('openLogDir');
    bindCarousel();
    $('hFarm').onclick = () => tli.action(s.recording ? 'stopFarm' : 'startFarm');
    $('hWidget').onclick = () => tli.action('toggleOverlay');
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
