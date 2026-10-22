// Onglet Build : mes builds, builds de la communauté, conseiller d'achat et éditeur.
const Build = (() => {
  let heroes = [];
  let view = 'community'; // 'community' | 'list' | 'remote' | 'detail' | 'edit'
  let currentId = null;
  let draft = null;       // build en cours d'édition
  const root = () => $('buildView');

  const heroOf = (key) => heroes.find((h) => h.key === key) || null;
  const heroLabel = (key) => { const h = heroOf(key); return h ? `${h.hero} — ${h.trait}` : t('b.noClass'); };
  const portrait = (key, size = 36) => {
    const h = heroOf(key);
    return h ? `<img class="portrait" style="width:${size}px;height:${size}px" src="${esc(h.portrait)}" alt="">` : `<span class="portrait" style="width:${size}px;height:${size}px"></span>`;
  };
  const heroOptions = (selected) => `<option value="">${esc(t('b.pickClass'))}</option>` + heroes.map((h) =>
    `<option value="${esc(h.key)}" ${h.key === selected ? 'selected' : ''}>${esc(h.hero)} — ${esc(h.trait)}</option>`).join('');
  const hoursTxt = (h) => (h == null ? t('b.hoursUnknown') : h < 1 ? t('b.minutes', { n: Math.max(1, Math.round(h * 60)) }) : t('b.hours', { n: nf1.format(h) }));

  async function init() {
    heroes = await tli.getHeroes();
    // Liste des classes dans les réglages
    $('sHeroClass').innerHTML = heroOptions('');
  }

  // Trois pages dans le menu Builds : « build » (trouver un build publié), « bfollow » (builds suivis :
  // importés ou suivis par le conseiller), « bmine » (builds que j'ai faits). Revenir sur la même page
  // garde la fiche ouverte ; changer de page revient à sa liste.
  let curSub = null;
  function show(sub) {
    sub = sub || curSub || 'build';
    if (sub !== curSub) { curSub = sub; view = null; currentId = null; }
    if (view === 'detail' && currentId) return openDetail(currentId);
    if (view === 'edit') return renderEdit();
    if (view === 'remote' && currentId) return openRemote(currentId);
    return backToList();
  }
  const backToList = () => (curSub === 'bfollow' ? openList('followed') : curSub === 'bmine' ? openList('mine') : openCommunity());
  const treeChips = (names) => names.map((n) => `<span class="chip tchip">${esc(n)}</span>`).join(' ');
  const newBuild = () => {
    draft = { title: '', heroKey: (last && last.hero && last.hero.key) || '', description: '',
      steps: ['adv.s1', 'adv.s2', 'adv.s3'].map((k) => ({ title: t(k), notes: '', items: [] })), talents: { trees: [], nodes: {}, core: {} }, traits: [] };
    currentId = null; renderEdit();
  };

  // ---------- Mes builds / builds suivis ----------
  async function openList(kind = 'mine') {
    view = 'list'; currentId = null;
    const all = await tli.listBuilds();
    // Suivis : importés d'un autre joueur, ou suivi par le conseiller. Mes builds : ceux que j'ai faits.
    const list = all.filter((b) => (kind === 'followed' ? b.source || b.active : !b.source));
    const names = await Promise.all(list.map((b) => Talents.treeNames(b.trees)));
    root().innerHTML = `<div class="tools">
        ${kind === 'followed' ? `<button class="btn primary" id="bFind">${esc(t('b.findOne'))}</button><span class="muted">${esc(t('b.followHelp'))}</span>`
          : `<button class="btn primary" id="bNew">${esc(t('b.new'))}</button><button class="btn" id="bCode">${esc(t('code.import'))}</button><span class="muted">${esc(t('b.help'))}</span>`}
      </div>
      <table><thead><tr><th>${esc(t('b.colBuild'))}</th><th>${esc(t('col.class'))}</th><th>${esc(t('b.colTrees'))}</th><th class="r">${esc(t('b.colPoints'))}</th><th>${esc(t('b.colStatus'))}</th></tr></thead><tbody>
      ${list.map((b, i) => `<tr class="click" data-id="${b.id}">
          <td><b>${esc(b.title)}</b>${b.source ? `<br><span class="muted">${esc(t('b.from', { author: b.source.author || '?' }))}</span>` : ''}</td>
          <td>${portrait(b.heroKey, 28)} ${esc(heroLabel(b.heroKey))}</td>
          <td>${treeChips(names[i]) || '<span class="muted">–</span>'}</td>
          <td class="r">${b.points || '–'}</td>
          <td>${b.active ? `<span class="tag loot">${esc(t('b.followed'))}</span> ` : ''}${b.shared ? `<span class="tag">${esc(t('b.sharedTag'))}</span>` : ''}</td></tr>`).join('')
        || `<tr><td colspan="5" class="muted">${esc(t(kind === 'followed' ? 'b.followEmpty' : 'b.empty'))}</td></tr>`}
      </tbody></table>`;
    if ($('bNew')) $('bNew').onclick = newBuild;
    if ($('bCode')) $('bCode').onclick = importCode;
    if (kind === 'mine') onlineBuilds(all);
    if ($('bFind')) $('bFind').onclick = () => showTab('build');
    root().querySelectorAll('tr.click').forEach((tr) => (tr.onclick = () => openDetail(tr.dataset.id)));
  }

  // Builds de mon compte (faits sur le site ou sur un autre PC) qui ne sont pas encore dans cette app.
  async function onlineBuilds(local) {
    let list = [];
    try { list = await tli.myOnlineBuilds(); } catch { return; }
    const have = new Set(local.map((b) => b.id));
    const missing = list.filter((b) => !have.has(b.id));
    if (!missing.length || view !== 'list') return;
    root().insertAdjacentHTML('beforeend', `<div class="card" style="margin-top:14px"><h2>${esc(t('acc.onlineTitle'))} <span class="tag beta">BETA</span></h2>
      <p class="muted" style="margin-bottom:8px">${esc(t('acc.onlineHelp'))}</p>
      <table><tbody>${missing.map((b) => `<tr><td>${portrait(b.hero_key, 26)} <b>${esc(b.title)}</b></td><td class="muted">${esc(dayLabel(b.updated_at))}</td>
        <td class="r"><button class="btn" data-pull="${esc(b.id)}">${esc(t('acc.pull'))}</button></td></tr>`).join('')}</tbody></table></div>`);
    root().querySelectorAll('[data-pull]').forEach((btn) => (btn.onclick = async () => {
      btn.disabled = true;
      try { const b = await tli.importBuild(btn.dataset.pull); openDetail(b.id); } catch (e) { btn.textContent = errMsg(e); }
    }));
  }

  // Importer un build depuis un code (fait sur tlicompanion.com ou donné par un joueur) : il s'ouvre dans l'éditeur.
  function importCode() {
    modal(`<h1>${esc(t('code.import'))}</h1><p class="muted">${esc(t('code.importHelp'))}</p>
      <div class="body" style="min-height:0"><textarea id="cdIn" rows="5" placeholder="TLIC1.…"></textarea><p class="neg" id="cdErr" style="margin-top:6px"></p></div>
      <div class="foot"><button class="btn" id="cdCancel">${esc(t('b.cancel'))}</button><button class="btn primary big" id="cdGo">${esc(t('code.open'))}</button></div>`);
    $('cdCancel').onclick = () => modal('');
    $('cdGo').onclick = async () => {
      try {
        const b = await Planner.decode($('cdIn').value);
        draft = { title: '', heroKey: '', description: '', steps: [], talents: { trees: [], nodes: {}, core: {} }, traits: [], loadout: { active: [], passive: [] }, gear: {}, ...b, id: undefined };
        if (!draft.steps.length) draft.steps = ['adv.s1', 'adv.s2', 'adv.s3'].map((k) => ({ title: t(k), notes: '', items: [] }));
        modal('');
        currentId = null;
        renderEdit();
      } catch (e) { $('cdErr').textContent = errMsg(e); }
    };
  }

  // ---------- Builds publiés (communauté) : filtres et tri ----------
  let filters = { hero: '', tree: '', q: '', sort: 'recent' };
  async function openCommunity(f) {
    view = 'community'; currentId = null;
    if (f) filters = { ...filters, ...f };
    await Talents.load();
    const trees = Talents.trees();
    root().innerHTML = `<div class="tools bfilters">
        <input id="bQ" placeholder="${esc(t('b.searchPh'))}" value="${esc(filters.q)}">
        <select id="bHero">${heroOptions(filters.hero).replace(esc(t('b.pickClass')), esc(t('b.allClasses')))}</select>
        <select id="bTree"><option value="">${esc(t('b.allTrees'))}</option>${trees.map((x) => `<option value="${x.slug}" ${x.slug === filters.tree ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
        <div class="fchips">${['recent', 'likes', 'name'].map((k) => `<button class="fchip${filters.sort === k ? ' on' : ''}" data-sort="${k}">${esc(t('b.sort_' + k))}</button>`).join('')}</div>
        <button class="btn primary" id="bNew">${esc(t('b.new'))}</button>
      </div>
      <table><thead><tr><th>${esc(t('b.colBuild'))}</th><th>${esc(t('col.class'))}</th><th>${esc(t('b.colTrees'))}</th><th class="r">${esc(t('b.colPoints'))}</th><th>${esc(t('b.colAuthor'))}</th><th class="r">♥</th><th class="r">${esc(t('b.colUpdated'))}</th></tr></thead>
      <tbody id="bComm"><tr><td colspan="7" class="muted">${esc(t('b.loading'))}</td></tr></tbody></table>
      <p class="muted small">${esc(t('b.communityHelp'))}</p>`;
    $('bNew').onclick = newBuild;
    let timer;
    $('bQ').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { filters.q = e.target.value.trim(); loadCommunity(); }, 300); };
    $('bHero').onchange = (e) => { filters.hero = e.target.value; loadCommunity(); };
    $('bTree').onchange = (e) => { filters.tree = e.target.value; loadCommunity(); };
    root().querySelectorAll('.bfilters [data-sort]').forEach((x) => (x.onclick = () => {
      filters.sort = x.dataset.sort;
      root().querySelectorAll('.bfilters [data-sort]').forEach((y) => y.classList.toggle('on', y === x));
      loadCommunity();
    }));
    loadCommunity();
  }
  async function loadCommunity() {
    if (!$('bComm')) return;
    try {
      const { builds } = await tli.browseBuilds(filters);
      const names = await Promise.all(builds.map((b) => Talents.treeNames(b.trees)));
      if (!$('bComm')) return;
      $('bComm').innerHTML = builds.map((b, i) => `<tr class="click" data-remote="${esc(b.id)}">
          <td><b>${esc(b.title)}</b>${b.mainSkill ? `<br><span class="muted">${b.mainSkill.img ? `<img class="ico" src="${esc(b.mainSkill.img)}" alt="">` : ''}${esc(b.mainSkill.name)}</span>` : ''}</td>
          <td>${portrait(b.hero_key, 28)} ${esc(heroLabel(b.hero_key))}</td>
          <td>${treeChips(names[i]) || '<span class="muted">–</span>'}</td>
          <td class="r">${b.points || '–'}</td>
          <td class="muted">${esc(b.author)}</td>
          <td class="r">${b.likes || 0}</td>
          <td class="r muted" data-sort="${b.updated_at}">${esc(dayLabel(b.updated_at))}</td></tr>`).join('')
        || `<tr><td colspan="7" class="muted">${esc(t('b.communityEmpty'))}</td></tr>`;
      $('bComm').querySelectorAll('[data-remote]').forEach((tr) => (tr.onclick = () => openRemote(tr.dataset.remote)));
    } catch (e) {
      if ($('bComm')) $('bComm').innerHTML = `<tr><td colspan="7" class="muted">${esc(t('share.error', { msg: errMsg(e) }))}</td></tr>`;
    }
  }

  // ---------- Aperçu d'un build publié ----------
  async function openRemote(id) {
    view = 'remote'; currentId = id;
    root().innerHTML = `<p class="muted">${esc(t('b.loading'))}</p>`;
    let res;
    try { res = await tli.remoteBuild(id); } catch (e) {
      root().innerHTML = `<div class="tools"><button class="btn" id="bBack">${esc(t('btn.back'))}</button></div><p class="muted">${esc(t('share.error', { msg: errMsg(e) }))}</p>`;
      $('bBack').onclick = () => openCommunity();
      return;
    }
    const { build: b, author, likes } = res;
    const items = (b.steps || []).flatMap((s) => s.items || []);
    root().innerHTML = `
      <div class="detail-head">
        <button class="btn" id="bBack">${esc(t('btn.back'))}</button>
        ${portrait(b.heroKey, 40)}
        <div style="flex:1;min-width:200px"><div style="font-size:16px;font-weight:600">${esc(b.title)}</div>
          <div class="muted">${esc(heroLabel(b.heroKey))} · ${esc(t('b.by', { author: author || '?' }))}</div></div>
        <button class="btn" id="bLike">♥ <span id="bLikes">${likes || 0}</span></button>
        <button class="btn primary" id="bImport">${esc(t('b.import'))}</button>
      </div>
      <div class="muted" id="bMsg" style="margin:-6px 0 12px"></div>
      ${b.description ? `<div class="card notes">${esc(b.description)}</div>` : ''}
      ${plannerHtml('r', b, true)}
      ${items.length ? `<div class="card"><h2>${esc(t('b.gearList'))}</h2><div class="gear">
        ${items.map((it) => `<div class="gearslot" title="${esc(it.note || it.name || '')}">${it.img ? `<img src="${esc(it.img)}" alt="">` : ''}<span>${esc(it.name || '#' + it.id)}${it.qty > 1 ? ' ×' + it.qty : ''}</span></div>`).join('')}</div></div>` : ''}`;
    $('bBack').onclick = () => openCommunity();
    mountPlanner('r', b, { readOnly: true });
    $('bImport').onclick = async () => {
      $('bImport').disabled = true;
      try { const copy = await tli.importBuild(id); openDetail(copy.id); } catch (e) { $('bMsg').textContent = t('share.error', { msg: errMsg(e) }); $('bImport').disabled = false; }
    };
    $('bLike').onclick = async () => {
      const srv = last ? last.settings.server : { registered: false };
      if (!srv.registered) { $('bMsg').textContent = t('b.likeNeedsName'); return; }
      $('bLike').disabled = true;
      try { const r = await tli.likeBuild(id); $('bLikes').textContent = r.likes; $('bLike').classList.add('on'); } catch (e) { $('bMsg').textContent = t('share.error', { msg: errMsg(e) }); }
    };
  }

  // ---------- Détail + conseiller ----------
  async function openDetail(id) {
    view = 'detail'; currentId = id;
    const res = await tli.getBuild(id);
    if (!res) return backToList();
    const { build: b, advice: a, loadout: lo } = res;
    const active = last && last.settings.activeBuild === id;
    const stepLabel = a.currentIndex == null ? t('b.allDone') : t('b.stepOf', { n: a.currentIndex + 1, total: b.steps.length, title: b.steps[a.currentIndex].title || '' });
    root().innerHTML = `
      <div class="detail-head">
        <button class="btn" id="bBack">${esc(t('btn.back'))}</button>
        ${portrait(b.heroKey, 40)}
        <div style="flex:1;min-width:200px"><div style="font-size:16px;font-weight:600">${esc(b.title)}</div>
          <div class="muted">${esc(heroLabel(b.heroKey))}${b.source ? ' · ' + esc(t('b.from', { author: b.source.author || '?' })) : ''}</div></div>
        <button class="btn ${active ? '' : 'primary'}" id="bFollow">${esc(active ? t('b.unfollow') : t('b.follow'))}</button>
        <button class="btn" id="bEdit">${esc(t('b.edit'))}</button>
        <button class="btn" id="bCopyCode" title="${esc(t('code.copyHelp'))}">${esc(t('code.copy'))}</button>
        <button class="btn" id="bShare">${esc(b.shared ? t('b.updateShare') : t('b.share'))}</button>
        <button class="btn" id="bDelete">${esc(t('btn.delete'))}</button>
      </div>
      <div class="muted" id="bShareMsg" style="margin:-6px 0 12px">${b.shared ? `${esc(t('share.visible'))} <a href="#" id="bOpen">${esc(b.shared.url)}</a> · <a href="#" id="bUnshare">${esc(t('share.remove'))}</a>` : ''}</div>
      ${b.description ? `<div class="card notes">${esc(b.description)}</div>` : ''}
      ${plannerHtml('d', b, true)}
      <div class="card adv"><h2>${esc(t('b.advisor'))} <span class="tag">${esc(t('adv.beta'))}</span></h2>
        ${b.steps.length > 1 ? `<div class="adv-stage"><span class="muted">${esc(t('adv.where'))}</span><div class="fchips">
          <button class="fchip${a.chosenIndex == null ? ' on' : ''}" data-stage="">${esc(t('adv.auto'))}</button>
          ${b.steps.map((st, i) => `<button class="fchip${a.chosenIndex === i ? ' on' : ''}" data-stage="${i}">${i + 1}. ${esc(st.title || t('b.step', { n: i + 1 }))}</button>`).join('')}</div></div>
          <p class="adv-msg">${esc(advMsg(b, a))}</p>` : ''}
        <p class="muted small" style="margin:-4px 0 12px">${esc(t('adv.owned'))}</p>
        <div class="bigstats" style="margin-bottom:14px">
          <div><div class="k">${esc(t('b.currentStep'))}</div><div class="v" style="font-size:15px">${esc(stepLabel)}</div></div>
          <div><div class="k">${esc(t('b.stepMissing'))}</div><div class="v">${fe(a.currentMissing)} FE</div></div>
          <div><div class="k">${esc(t('b.farmTime'))}</div><div class="v">${esc(hoursTxt(a.currentHours))}</div></div>
          <div><div class="k">${esc(t('b.feInBag'))}</div><div class="v">${fe(a.feInBag)}</div></div>
          <div><div class="k">${esc(t('b.yourRate'))}</div><div class="v">${a.perHour ? fe(a.perHour) : '–'}</div></div>
          <div><div class="k">${esc(t('b.remainingAll'))}</div><div class="v">${fe(a.remainingAll)} FE</div></div>
        </div>
        ${a.perHour ? '' : `<p class="muted" style="margin-bottom:10px">${esc(t('b.noRate'))}</p>`}
        <h3 class="sub-h">${esc(t('b.nextBuys'))}</h3>
        <table><thead><tr><th>${esc(t('col.item'))}</th><th class="r">${esc(t('b.toBuy'))}</th><th class="r">${esc(t('col.unit'))}</th><th class="r">${esc(t('col.cost'))}</th><th class="r">${esc(t('b.farmTime'))}</th><th></th></tr></thead><tbody>
          ${a.next.map((i) => `<tr><td>${icon(i.img)}${esc(i.name)}${i.equipped ? ` <span class="tag loot">${esc(t('adv.equipped'))}</span>` : ''} ${i.priority === 'optional' ? `<span class="tag">${esc(t('b.optional'))}</span>` : ''}${i.note ? `<br><span class="muted">${esc(i.note)}</span>` : ''}</td>
            <td class="r">${i.missing}</td><td class="r muted">${unit(i.unit)}</td><td class="r">${i.unit ? fe(i.cost) : `<span class="muted">${esc(t('b.noPrice'))}</span>`}</td>
            <td class="r muted">${i.unit ? esc(hoursTxt(i.hours)) : ''}</td>
            <td class="r">${i.affordable ? `<span class="tag loot">${esc(t('b.affordable'))}</span>` : ''}</td></tr>`).join('')
          || `<tr><td colspan="6" class="muted">${esc(a.currentIndex == null ? t('b.allDone') : t('b.nothingNext'))}</td></tr>`}
        </tbody></table>
      </div>
      ${a.steps.map((s) => `
        <div class="card step ${s.index === a.currentIndex ? 'current' : ''}">
          <h2>${esc(t('b.step', { n: s.index + 1 }))} · ${esc(s.title || '')} <span class="muted" style="font-weight:400">— ${s.pct}% · ${esc(t('b.missingFe', { fe: fe(s.missingCost) }))}</span></h2>
          <div class="progress"><div style="width:${s.pct}%"></div></div>
          ${s.notes ? `<p class="notes muted" style="margin:8px 0">${esc(s.notes)}</p>` : ''}
          <table><thead><tr><th style="width:34px" title="${esc(t('b.haveIt'))}">✓</th><th>${esc(t('col.item'))}</th><th>${esc(t('b.category'))}</th><th class="r">${esc(t('b.needed'))}</th><th class="r">${esc(t('b.inBag'))}</th><th class="r">${esc(t('col.unit'))}</th><th class="r">${esc(t('b.missingCost'))}</th></tr></thead><tbody>
          ${s.items.map((i) => `<tr class="${i.done ? 'done' : ''}">
            <td><input type="checkbox" data-own="${i.id}" ${i.manual ? 'checked' : ''} title="${esc(t('b.haveIt'))}"></td>
            <td>${icon(i.img)}${esc(i.name)}${i.equipped ? ` <span class="tag loot">${esc(t('adv.equipped'))}</span>` : ''} ${i.priority === 'optional' ? `<span class="tag">${esc(t('b.optional'))}</span>` : ''}${i.note ? `<br><span class="muted">${esc(i.note)}</span>` : ''}</td>
            <td class="muted">${esc(t(i.category))}</td><td class="r">${i.qty}</td><td class="r">${i.inBag}</td>
            <td class="r muted">${unit(i.unit)}</td><td class="r ${i.done ? 'pos' : ''}">${i.done ? '✓' : fe(i.cost)}</td></tr>`).join('')
          || `<tr><td colspan="7" class="muted">${esc(t('b.stepEmpty'))}</td></tr>`}
          </tbody></table>
        </div>`).join('')}`;
    $('bBack').onclick = backToList;
    root().querySelectorAll('[data-stage]').forEach((x) => (x.onclick = async () => {
      await tli.setBuildStage(id, x.dataset.stage === '' ? null : +x.dataset.stage);
      openDetail(id);
    }));
    mountPlanner('d', { ...b, loadout: lo, gear: res.gear || {} }, { readOnly: true });
    $('bFollow').onclick = async () => { await tli.setActiveBuild(active ? null : id); setTimeout(() => openDetail(id), 150); };
    $('bEdit').onclick = () => {
      draft = JSON.parse(JSON.stringify(b));
      draft.loadout = JSON.parse(JSON.stringify(lo)); // avec noms et icônes
      draft.gear = JSON.parse(JSON.stringify(res.gear || {}));
      // Le build enregistré ne garde que les ids : on remet noms et icônes pour l'éditeur.
      draft.steps.forEach((s, si) => s.items.forEach((it, ii) => {
        const info = a.steps[si] && a.steps[si].items[ii];
        if (info) { it.name = info.name; it.img = info.img; }
      }));
      renderEdit();
    };
    $('bDelete').onclick = async () => { if (confirm(t('b.confirmDelete'))) { await tli.deleteBuild(id); backToList(); } };
    $('bShare').onclick = () => shareBuild(id);
    $('bCopyCode').onclick = async () => {
      try { await navigator.clipboard.writeText(await Planner.encode({ ...b, loadout: lo, gear: res.gear || {} })); $('bShareMsg').textContent = t('code.copied'); }
      catch (e) { $('bShareMsg').textContent = t('share.error', { msg: errMsg(e) }); }
    };
    if (b.shared) {
      $('bOpen').onclick = (e) => { e.preventDefault(); tli.openSite(new URL(b.shared.url).pathname); };
      $('bUnshare').onclick = async (e) => {
        e.preventDefault();
        if (!confirm(t('b.confirmUnshare'))) return;
        try { await tli.unshareBuild(id); openDetail(id); } catch (err) { $('bShareMsg').textContent = t('share.error', { msg: errMsg(err) }); }
      };
    }
    root().querySelectorAll('[data-own]').forEach((cb) => (cb.onchange = async () => {
      await tli.setOwned(id, +cb.dataset.own, cb.checked); openDetail(id);
    }));
  }

  async function shareBuild(id) {
    const msg = $('bShareMsg');
    const srv = last ? last.settings.server : { registered: false };
    try {
      if (!srv.registered) {
        // Pas encore de pseudo : on le demande dans la zone de message.
        msg.innerHTML = `<input id="bName" placeholder="${esc(t('share.namePh'))}" style="width:240px"> <button class="btn primary" id="bNameGo">${esc(t('share.create'))}</button> <span id="bNameErr"></span>`;
        $('bNameGo').onclick = async () => {
          const name = $('bName').value.trim();
          if (name.length < 2) { $('bNameErr').textContent = t('share.nameShort'); return; }
          try { await tli.register(name); await tli.shareBuild(id); openDetail(id); }
          catch (e) { $('bNameErr').textContent = t('share.error', { msg: errMsg(e) }); }
        };
        return;
      }
      msg.textContent = t('share.sending');
      await tli.shareBuild(id);
      openDetail(id);
    } catch (e) { msg.textContent = t('share.error', { msg: errMsg(e) }); }
  }

  function advMsg(b, a) {
    if (a.chosenIndex == null) return t('adv.autoMsg');
    const title = (i) => b.steps[i].title || t('b.step', { n: i + 1 });
    const last = a.chosenIndex >= b.steps.length - 1;
    const base = last ? t('adv.lastStage', { title: title(a.chosenIndex) }) : t('adv.nextFrom', { from: title(a.chosenIndex), to: title(a.chosenIndex + 1) });
    return a.chosenMissing && !last ? `${base} ${t('adv.chosenMissing', { n: a.chosenMissing })}` : base;
  }

  // ---------- Planificateur façon jeu : héros, arbres, compétences, équipement ----------
  function plannerHtml(p, b, ro) {
    const hero = heroOf(b.heroKey);
    return `<div class="pl">
      ${Planner.section('hero', t('pl.hero'), `<div class="pl-herow">${Planner.heroCard(hero, ro)}${hero ? `<a href="#" id="${p}HeroLink" class="small">${esc(t('b.seeTlidb'))}</a>` : ''}</div><div id="${p}Traits"></div>`)}
      ${Planner.section('trees', t('tal.title'), `<div id="${p}Trees"></div>`)}
      <div class="pl-2">${Planner.section('skills', t('pl.skillsTitle'), `<div id="${p}Skills"></div>`)}${Planner.section('gear', t('pl.gear'), `<div id="${p}Gear"></div>`)}</div>
    </div>`;
  }
  async function mountPlanner(p, b, opts = {}) {
    await Planner.load();
    Planner.bindSections(root());
    const hero = heroOf(b.heroKey);
    Talents.mountTraits($(p + 'Traits'), b, { ...opts, hero });
    Talents.mountTrees($(p + 'Trees'), b, opts);
    Planner.mountSkills($(p + 'Skills'), b, opts);
    Planner.mountGear($(p + 'Gear'), b, opts);
    if ($(p + 'HeroLink')) $(p + 'HeroLink').onclick = (e) => { e.preventDefault(); tli.openExternal(hero.url); };
    if (!opts.readOnly) $('plHeroBtn').onclick = async () => {
      const k = await Planner.pickHero(heroes, b.heroKey);
      if (k && k !== b.heroKey) { b.heroKey = k; b.traits = []; if (opts.onHero) opts.onHero(); }
    };
  }

  // Ajoute à une étape les objets du planificateur qui se vendent (légendaires, compétences), sans doublon.
  function fillFromPlanner(d, s) {
    const have = new Set(s.items.map((x) => x.id));
    const add = (id, name, img) => { if (id && !have.has(id)) { have.add(id); s.items.push({ id, name, img, qty: 1, priority: 'core', note: '' }); } };
    for (const g of Object.values(d.gear || {})) if (g && g.rarity !== 'rare') add(g.id, g.name, g.img);
    const lo = d.loadout || { active: [], passive: [] };
    for (const sl of [...lo.active, ...lo.passive]) for (const x of [sl, ...(sl.supports || [])]) { const info = Planner.info(x) || {}; add(x.id, info.name || x.name, info.icon || x.img); }
  }

  // ---------- Éditeur ----------
  function renderEdit() {
    view = 'edit';
    const d = draft;
    root().innerHTML = `
      <div class="detail-head">
        <button class="btn" id="eCancel">${esc(t('b.cancel'))}</button>
        <span class="tag beta">BETA</span>
        <input class="title" id="eTitle" placeholder="${esc(t('b.titlePh'))}" value="${esc(d.title)}">
        <button class="btn primary" id="eSave">${esc(t('btn.save'))}</button>
      </div>
      ${plannerHtml('e', d, false)}
      ${Planner.section('notes', t('b.description'), `<textarea id="eDesc" placeholder="${esc(t('b.descPh'))}">${esc(d.description)}</textarea>`)}
      ${Planner.section('items', t('pl.items'), `<p class="muted" style="margin-bottom:10px">${esc(t('adv.stagesHelp'))}</p>${d.steps.map((s, si) => `
        <div class="card step" data-step="${si}">
          <div class="detail-head" style="margin-bottom:8px">
            <b>${esc(t('b.step', { n: si + 1 }))}</b>
            <input class="title" data-f="title" placeholder="${esc(t('b.stepTitlePh'))}" value="${esc(s.title)}">
            <button class="btn" data-act="up" ${si === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn" data-act="down" ${si === d.steps.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn" data-act="fill" title="${esc(t('adv.fillHelp'))}">${esc(t('adv.fill'))}</button>
            <button class="btn" data-act="del">✕</button>
          </div>
          <textarea data-f="notes" placeholder="${esc(t('b.stepNotesPh'))}" style="min-height:44px;margin-bottom:8px">${esc(s.notes)}</textarea>
          <table><thead><tr><th>${esc(t('col.item'))}</th><th class="r" style="width:80px">${esc(t('b.needed'))}</th><th style="width:130px">${esc(t('b.priority'))}</th><th>${esc(t('b.itemNote'))}</th><th style="width:40px"></th></tr></thead><tbody>
          ${s.items.map((it, ii) => `<tr data-item="${ii}">
              <td>${icon(it.img)}${esc(it.name || ('#' + it.id))}</td>
              <td class="r"><input class="price" type="number" min="1" data-if="qty" value="${it.qty}"></td>
              <td><select data-if="priority"><option value="core" ${it.priority !== 'optional' ? 'selected' : ''}>${esc(t('b.core'))}</option><option value="optional" ${it.priority === 'optional' ? 'selected' : ''}>${esc(t('b.optional'))}</option></select></td>
              <td><input data-if="note" value="${esc(it.note || '')}" placeholder="${esc(t('b.itemNotePh'))}" style="width:100%"></td>
              <td><button class="btn" data-act="rmItem">✕</button></td></tr>`).join('')}
          </tbody></table>
          <div class="search-wrap"><input data-search placeholder="${esc(t('b.addItemPh'))}" style="width:100%;margin-top:8px"><div class="results" hidden></div></div>
        </div>`).join('')}
      <button class="btn" id="eAddStep">${esc(t('b.addStep'))}</button>`)}`;

    // Champs généraux
    $('eTitle').oninput = (e) => { d.title = e.target.value; };
    $('eDesc').oninput = (e) => { d.description = e.target.value; };
    mountPlanner('e', d, { onHero: renderEdit });
    $('eAddStep').onclick = () => { d.steps.push({ title: '', notes: '', items: [] }); renderEdit(); };
    $('eCancel').onclick = () => (currentId ? openDetail(currentId) : backToList());
    $('eSave').onclick = async () => {
      if (!d.title.trim()) { $('eTitle').focus(); $('eTitle').placeholder = t('b.titleRequired'); return; }
      const saved = await tli.saveBuild(d);
      draft = null;
      openDetail(saved.id);
    };

    // Étapes
    root().querySelectorAll('[data-step]').forEach((card) => {
      const si = +card.dataset.step;
      const s = d.steps[si];
      card.querySelector('[data-f="title"]').oninput = (e) => { s.title = e.target.value; };
      card.querySelector('[data-f="notes"]').oninput = (e) => { s.notes = e.target.value; };
      card.querySelectorAll('[data-act]').forEach((btn) => {
        if (btn.dataset.act === 'rmItem') return;
        btn.onclick = () => {
          if (btn.dataset.act === 'up') [d.steps[si - 1], d.steps[si]] = [d.steps[si], d.steps[si - 1]];
          if (btn.dataset.act === 'down') [d.steps[si + 1], d.steps[si]] = [d.steps[si], d.steps[si + 1]];
          if (btn.dataset.act === 'del' && (s.items.length === 0 || confirm(t('b.confirmDelStep')))) d.steps.splice(si, 1);
          if (btn.dataset.act === 'fill') fillFromPlanner(d, s);
          renderEdit();
        };
      });
      card.querySelectorAll('[data-item]').forEach((row) => {
        const it = s.items[+row.dataset.item];
        row.querySelector('[data-if="qty"]').oninput = (e) => { it.qty = Math.max(1, +e.target.value || 1); };
        row.querySelector('[data-if="priority"]').onchange = (e) => { it.priority = e.target.value; };
        row.querySelector('[data-if="note"]').oninput = (e) => { it.note = e.target.value; };
        row.querySelector('[data-act="rmItem"]').onclick = () => { s.items.splice(+row.dataset.item, 1); renderEdit(); };
      });
      // Recherche d'objet à ajouter
      const input = card.querySelector('[data-search]');
      const results = card.querySelector('.results');
      let timer;
      input.oninput = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const q = input.value.trim();
          if (q.length < 2) { results.hidden = true; return; }
          const list = await tli.searchItems(q);
          results.innerHTML = list.map((r) => `<div class="res" data-id="${r.id}">${icon(r.img)}${esc(r.name)} <span class="muted">${r.price ? fe(r.price) + ' FE' : ''}</span></div>`).join('')
            || `<div class="res muted">${esc(t('b.noResult'))}</div>`;
          results.hidden = false;
          results.querySelectorAll('.res[data-id]').forEach((el) => (el.onclick = () => {
            const r = list.find((x) => x.id === +el.dataset.id);
            s.items.push({ id: r.id, name: r.name, img: r.img, qty: 1, priority: 'core', note: '' });
            renderEdit();
            const again = root().querySelector(`[data-step="${si}"] [data-search]`);
            if (again) again.focus();
          }));
        }, 200);
      };
    });
  }

  // Ouvre la fiche d'un build dans « Suivis » (depuis l'accueil).
  function focus(id) { curSub = 'bfollow'; view = 'detail'; currentId = id; }
  return { init, show, openList, openDetail, focus };
})();

Build.init();
