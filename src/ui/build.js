// Onglet Build : mes builds, builds de la communauté, conseiller d'achat et éditeur.
const Build = (() => {
  let heroes = [];
  let view = 'list';      // 'list' | 'community' | 'detail' | 'edit'
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

  // Partie Build en travaux : désactivée dans la version publiée (le code reste prêt pour la suite).
  const ENABLED = false;
  function show() {
    if (!ENABLED) { root().innerHTML = comingSoon(t('soon.buildTitle'), t('soon.buildText')); return; }
    if (view === 'detail' && currentId) openDetail(currentId); else if (view === 'edit') renderEdit(); else if (view === 'community') openCommunity(); else openList(); }

  // ---------- Mes builds ----------
  async function openList() {
    view = 'list'; currentId = null;
    const list = await tli.listBuilds();
    root().innerHTML = `
      <div class="tools">
        <button class="btn primary" id="bNew">${esc(t('b.new'))}</button>
        <button class="btn" id="bBrowse">${esc(t('b.browse'))}</button>
        <span class="muted">${esc(t('b.help'))}</span>
      </div>
      <table><thead><tr><th>${esc(t('b.colBuild'))}</th><th>${esc(t('col.class'))}</th><th class="r">${esc(t('b.colSteps'))}</th><th>${esc(t('b.colStatus'))}</th></tr></thead><tbody>
      ${list.map((b) => `<tr class="click" data-id="${b.id}">
          <td><b>${esc(b.title)}</b>${b.source ? `<br><span class="muted">${esc(t('b.from', { author: b.source.author || '?' }))}</span>` : ''}</td>
          <td>${portrait(b.heroKey, 28)} ${esc(heroLabel(b.heroKey))}</td>
          <td class="r">${b.steps}</td>
          <td>${b.active ? `<span class="tag loot">${esc(t('b.followed'))}</span> ` : ''}${b.shared ? `<span class="tag">${esc(t('b.sharedTag'))}</span>` : ''}</td></tr>`).join('')
        || `<tr><td colspan="4" class="muted">${esc(t('b.empty'))}</td></tr>`}
      </tbody></table>`;
    $('bNew').onclick = () => {
      draft = { title: '', heroKey: (last && last.hero && last.hero.key) || '', description: '',
        steps: [{ title: t('b.defaultStep'), notes: '', items: [] }] };
      currentId = null; renderEdit();
    };
    $('bBrowse').onclick = openCommunity;
    root().querySelectorAll('tr.click').forEach((tr) => (tr.onclick = () => openDetail(tr.dataset.id)));
  }

  // ---------- Builds de la communauté ----------
  async function openCommunity(heroKey) {
    view = 'community';
    if (typeof heroKey !== 'string') heroKey = (last && last.hero && last.hero.key) || '';
    root().innerHTML = `
      <div class="tools">
        <button class="btn" id="bBack">${esc(t('btn.back'))}</button>
        <select id="bHero">${heroOptions(heroKey).replace(esc(t('b.pickClass')), esc(t('b.allClasses')))}</select>
        <span class="muted">${esc(t('b.communityHelp'))}</span>
      </div>
      <table><thead><tr><th>${esc(t('b.colBuild'))}</th><th>${esc(t('col.class'))}</th><th>${esc(t('b.colAuthor'))}</th><th class="r">${esc(t('b.colSteps'))}</th><th></th></tr></thead>
      <tbody id="bComm"><tr><td colspan="5" class="muted">${esc(t('b.loading'))}</td></tr></tbody></table>`;
    $('bBack').onclick = openList;
    $('bHero').onchange = (e) => openCommunity(e.target.value);
    try {
      const { builds } = await tli.browseBuilds(heroKey);
      $('bComm').innerHTML = builds.map((b) => `<tr>
          <td><b>${esc(b.title)}</b></td><td>${portrait(b.hero_key, 28)} ${esc(heroLabel(b.hero_key))}</td>
          <td class="muted">${esc(b.author)}</td><td class="r">${b.steps}</td>
          <td class="r"><button class="btn" data-import="${esc(b.id)}">${esc(t('b.import'))}</button></td></tr>`).join('')
        || `<tr><td colspan="5" class="muted">${esc(t('b.communityEmpty'))}</td></tr>`;
      $('bComm').querySelectorAll('[data-import]').forEach((btn) => (btn.onclick = async () => {
        btn.disabled = true;
        try { const b = await tli.importBuild(btn.dataset.import); openDetail(b.id); }
        catch (e) { btn.textContent = errMsg(e); }
      }));
    } catch (e) {
      $('bComm').innerHTML = `<tr><td colspan="5" class="muted">${esc(t('share.error', { msg: errMsg(e) }))}</td></tr>`;
    }
  }

  // ---------- Détail + conseiller ----------
  async function openDetail(id) {
    view = 'detail'; currentId = id;
    const res = await tli.getBuild(id);
    if (!res) return openList();
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
        <button class="btn" id="bShare">${esc(b.shared ? t('b.updateShare') : t('b.share'))}</button>
        <button class="btn" id="bDelete">${esc(t('btn.delete'))}</button>
      </div>
      <div class="muted" id="bShareMsg" style="margin:-6px 0 12px">${b.shared ? `${esc(t('share.visible'))} <a href="#" id="bOpen">${esc(b.shared.url)}</a> · <a href="#" id="bUnshare">${esc(t('share.remove'))}</a>` : ''}</div>
      ${b.description ? `<div class="card notes">${esc(b.description)}</div>` : ''}
      ${renderLoadout(lo, a)}
      <div class="card"><h2>${esc(t('b.advisor'))}</h2>
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
          ${a.next.map((i) => `<tr><td>${icon(i.img)}${esc(i.name)} ${i.priority === 'optional' ? `<span class="tag">${esc(t('b.optional'))}</span>` : ''}${i.note ? `<br><span class="muted">${esc(i.note)}</span>` : ''}</td>
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
            <td>${icon(i.img)}${esc(i.name)} ${i.priority === 'optional' ? `<span class="tag">${esc(t('b.optional'))}</span>` : ''}${i.note ? `<br><span class="muted">${esc(i.note)}</span>` : ''}</td>
            <td class="muted">${esc(t(i.category))}</td><td class="r">${i.qty}</td><td class="r">${i.inBag}</td>
            <td class="r muted">${unit(i.unit)}</td><td class="r ${i.done ? 'pos' : ''}">${i.done ? '✓' : fe(i.cost)}</td></tr>`).join('')
          || `<tr><td colspan="7" class="muted">${esc(t('b.stepEmpty'))}</td></tr>`}
          </tbody></table>
        </div>`).join('')}`;
    $('bBack').onclick = openList;
    $('bFollow').onclick = async () => { await tli.setActiveBuild(active ? null : id); setTimeout(() => openDetail(id), 150); };
    $('bEdit').onclick = () => {
      draft = JSON.parse(JSON.stringify(b));
      draft.loadout = JSON.parse(JSON.stringify(lo)); // avec noms et icônes
      // Le build enregistré ne garde que les ids : on remet noms et icônes pour l'éditeur.
      draft.steps.forEach((s, si) => s.items.forEach((it, ii) => {
        const info = a.steps[si] && a.steps[si].items[ii];
        if (info) { it.name = info.name; it.img = info.img; }
      }));
      renderEdit();
    };
    $('bDelete').onclick = async () => { if (confirm(t('b.confirmDelete'))) { await tli.deleteBuild(id); openList(); } };
    $('bShare').onclick = () => shareBuild(id);
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

  // ---------- Emplacements de compétences et équipement, façon jeu ----------
  const slotIcon = (x, cls) => `<div class="${cls} ${x ? '' : 'empty'}" title="${esc(x ? x.name : '')}">${x && x.img ? `<img src="${esc(x.img)}" alt="">` : ''}</div>`;
  function slotRow(sl, passive) {
    const sups = [...sl.supports, ...Array(Math.max(0, 5 - sl.supports.length)).fill(null)];
    return `<div class="slotrow">
      ${slotIcon(sl, 'slot-main' + (passive ? ' passive' : ''))}
      <div class="slot-name">${esc(sl.name)}${sl.owned ? ` <span class="tag loot">${esc(t('m.owned'))}</span>` : ''}<small>${esc(t(passive ? 'cat.passive' : 'cat.active'))}</small></div>
      <div class="slot-sups">${sups.map((x) => slotIcon(x, 'slot-sup')).join('')}</div>
      <div class="muted" style="font-size:12px;flex:1;min-width:200px">${sl.supports.map((x) => esc(x.name)).join(' · ')}</div>
    </div>`;
  }
  function renderLoadout(lo, a) {
    const legendaries = [];
    for (const st of a.steps) for (const it of st.items) if (it.category === 'cat.legendary') legendaries.push(it);
    if (!lo.active.length && !lo.passive.length && !legendaries.length) return '';
    return `<div class="cards">
      ${lo.active.length || lo.passive.length ? `<div class="card"><h2>${esc(t('b.skillSlots'))}</h2><div class="loadout">
        ${lo.active.map((sl) => slotRow(sl, false)).join('')}${lo.passive.map((sl) => slotRow(sl, true)).join('')}</div></div>` : ''}
      ${legendaries.length ? `<div class="card"><h2>${esc(t('m.legendaries'))}</h2><div class="gear">
        ${legendaries.map((it) => `<div class="gearslot" title="${esc(it.name)}">${it.img ? `<img src="${esc(it.img)}" alt="">` : ''}<span>${esc(it.name)}${it.done ? ' ✓' : ''}</span></div>`).join('')}</div></div>` : ''}
    </div>`;
  }

  // Éditeur des emplacements : choisir la compétence principale et ses soutiens (5 max).
  function editLoadoutHtml(d) {
    const lo = d.loadout || (d.loadout = { active: [], passive: [] });
    const row = (sl, kind, i) => `<div class="slotrow" data-slot="${kind}:${i}">
        ${slotIcon(sl.id ? sl : null, 'slot-main' + (kind === 'passive' ? ' passive' : ''))}
        <div class="slot-name">${esc(sl.name || t('b.pickSkill'))}<small>${esc(t(kind === 'passive' ? 'cat.passive' : 'cat.active'))}</small></div>
        <div class="slot-sups">${sl.supports.map((x, j) => `<span class="chip" data-rmsup="${j}" style="cursor:pointer" title="${esc(t('b.remove'))}">${x.img ? `<img class="ico" src="${esc(x.img)}">` : ''}${esc(x.name)} ✕</span>`).join('')}</div>
        <div class="search-wrap" style="flex:1;min-width:220px"><input data-slotsearch placeholder="${esc(sl.id ? (sl.supports.length < 5 ? t('b.addSupportPh') : t('b.slotFull')) : t('b.pickSkillPh'))}" ${sl.id && sl.supports.length >= 5 ? 'disabled' : ''} style="width:100%"><div class="results" hidden></div></div>
        <button class="btn" data-rmslot>✕</button>
      </div>`;
    return `<div class="card"><h2>${esc(t('b.skillSlots'))}</h2><div class="loadout">
        ${lo.active.map((sl, i) => row(sl, 'active', i)).join('')}${lo.passive.map((sl, i) => row(sl, 'passive', i)).join('')}</div>
        <div class="tools" style="margin-top:10px">
          <button class="btn" id="eAddActive" ${lo.active.length >= 5 ? 'disabled' : ''}>${esc(t('b.addActive'))}</button>
          <button class="btn" id="eAddPassive" ${lo.passive.length >= 4 ? 'disabled' : ''}>${esc(t('b.addPassive'))}</button>
        </div></div>`;
  }
  function bindLoadoutEditor(d) {
    const lo = d.loadout;
    $('eAddActive').onclick = () => { lo.active.push({ id: null, supports: [] }); renderEdit(); };
    $('eAddPassive').onclick = () => { lo.passive.push({ id: null, supports: [] }); renderEdit(); };
    root().querySelectorAll('[data-slot]').forEach((rowEl) => {
      const [kind, i] = rowEl.dataset.slot.split(':');
      const sl = lo[kind][+i];
      rowEl.querySelector('[data-rmslot]').onclick = () => { lo[kind].splice(+i, 1); renderEdit(); };
      rowEl.querySelectorAll('[data-rmsup]').forEach((c) => (c.onclick = () => { sl.supports.splice(+c.dataset.rmsup, 1); renderEdit(); }));
      const input = rowEl.querySelector('[data-slotsearch]');
      const results = rowEl.querySelector('.results');
      let timer;
      input.oninput = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const q = input.value.trim();
          if (q.length < 2) { results.hidden = true; return; }
          const list = await tli.searchItems(q);
          results.innerHTML = list.map((r) => `<div class="res" data-id="${r.id}">${icon(r.img)}${esc(r.name)}</div>`).join('') || `<div class="res muted">${esc(t('b.noResult'))}</div>`;
          results.hidden = false;
          results.querySelectorAll('.res[data-id]').forEach((el) => (el.onclick = () => {
            const r = list.find((x) => x.id === +el.dataset.id);
            if (!sl.id) Object.assign(sl, { id: r.id, name: r.name, img: r.img });
            else if (sl.supports.length < 5) sl.supports.push({ id: r.id, name: r.name, img: r.img });
            renderEdit();
          }));
        }, 200);
      };
    });
  }

  // ---------- Éditeur ----------
  function renderEdit() {
    view = 'edit';
    const d = draft;
    root().innerHTML = `
      <div class="detail-head">
        <button class="btn" id="eCancel">${esc(t('b.cancel'))}</button>
        <input class="title" id="eTitle" placeholder="${esc(t('b.titlePh'))}" value="${esc(d.title)}">
        <button class="btn primary" id="eSave">${esc(t('btn.save'))}</button>
      </div>
      <div class="card">
        <div class="settings" style="grid-template-columns:160px 1fr">
          <div>${esc(t('col.class'))}</div>
          <div style="display:flex;gap:8px;align-items:center">${portrait(d.heroKey, 32)}<select id="eHero">${heroOptions(d.heroKey)}</select>
            ${heroOf(d.heroKey) ? `<a href="#" id="eHeroLink">${esc(t('b.seeTlidb'))}</a>` : ''}</div>
          <div>${esc(t('b.description'))}</div>
          <div><textarea id="eDesc" placeholder="${esc(t('b.descPh'))}">${esc(d.description)}</textarea></div>
        </div>
      </div>
      ${editLoadoutHtml(d)}
      ${d.steps.map((s, si) => `
        <div class="card step" data-step="${si}">
          <div class="detail-head" style="margin-bottom:8px">
            <b>${esc(t('b.step', { n: si + 1 }))}</b>
            <input class="title" data-f="title" placeholder="${esc(t('b.stepTitlePh'))}" value="${esc(s.title)}">
            <button class="btn" data-act="up" ${si === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn" data-act="down" ${si === d.steps.length - 1 ? 'disabled' : ''}>↓</button>
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
      <button class="btn" id="eAddStep">${esc(t('b.addStep'))}</button>
      <p class="muted" style="margin-top:10px">${esc(t('b.editHelp'))}</p>`;

    // Champs généraux
    $('eTitle').oninput = (e) => { d.title = e.target.value; };
    $('eDesc').oninput = (e) => { d.description = e.target.value; };
    $('eHero').onchange = (e) => { d.heroKey = e.target.value; renderEdit(); };
    if ($('eHeroLink')) $('eHeroLink').onclick = (e) => { e.preventDefault(); tli.openExternal(heroOf(d.heroKey).url); };
    $('eAddStep').onclick = () => { d.steps.push({ title: '', notes: '', items: [] }); renderEdit(); };
    bindLoadoutEditor(d);
    $('eCancel').onclick = () => (currentId ? openDetail(currentId) : openList());
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

  return { init, show, openList, openDetail };
})();

Build.init();
