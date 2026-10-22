// Planificateur de builds façon jeu : sections repliables, choix du héros, emplacements de compétences
// (principale + 5 soutiens), équipement. Utilisé par l'éditeur (modifiable) et par les fiches (lecture seule).
// Données des compétences : tlidb.com (data/builddata.json), reliées à nos objets pour les prix.
const Planner = (() => {
  const closed = new Set(); // sections repliées (gardé tant que l'app est ouverte)
  let skills = [];
  const bySlug = new Map();
  const byItem = new Map();
  async function load() {
    if (skills.length) return;
    const d = await Talents.load();
    skills = d.skills;
    for (const s of skills) { bySlug.set(s.slug, s); if (s.itemId) byItem.set(s.itemId, s); }
  }
  // Compétence d'un emplacement : { id, skill } -> fiche tlidb (nom, icône, tags), sinon ce que l'emplacement porte.
  const info = (x) => (x && ((x.skill && bySlug.get(x.skill)) || (x.id && byItem.get(x.id)))) || (x && (x.name || x.img) ? { name: x.name, icon: x.img, tags: [] } : null);
  // Initiales sous l'icône : visibles si tlidb refuse l'image.
  const ini = (n) => '<span class="sk-ini">' + esc(String(n || '?').split(/s+/).map((w) => w[0]).join('').slice(0, 2)) + '</span>';
  const ico = (src, cls = '') => (src ? `<img class="${cls}" src="${esc(src)}" alt="" onerror="this.style.visibility='hidden'">` : '');

  // ---------- Sections ----------
  function section(key, title, body, head = '') {
    return `<div class="pl-sec${closed.has(key) ? ' shut' : ''}" data-sec="${key}">
      <header class="pl-h"><button class="pl-tog" data-tog="${key}"><span class="pl-chev">▾</span>${esc(title)}</button>${head}</header>
      <div class="pl-b">${body}</div></div>`;
  }
  function bindSections(root) {
    root.querySelectorAll('[data-tog]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.tog;
      if (closed.has(k)) closed.delete(k); else closed.add(k);
      b.closest('.pl-sec').classList.toggle('shut', closed.has(k));
    }));
  }

  // ---------- Fenêtre de choix (compétence, objet, héros) ----------
  function pickerShell(title, wide) {
    modal(`<div class="pk${wide ? ' wide' : ''}"><div class="pk-h"><h1>${esc(title)}</h1><button class="pk-x" id="pkX">✕</button></div><div class="pk-body" id="pkBody"></div></div>`);
    return $('pkBody');
  }
  const KIND_TITLE = { active: 'pl.pickActive', passive: 'pl.pickPassive', support: 'pl.pickSupport' };
  // Choisir une compétence. Résout { skill, id } ; 'clear' pour vider ; null si annulé.
  function pickSkill(kind, current) {
    return new Promise((resolve) => {
      const body = pickerShell(t(KIND_TITLE[kind]), true);
      const list = skills.filter((s) => s.kind === kind);
      let sel = current ? info(current) : null;
      let q = '';
      body.innerHTML = `<div class="pk-left"><input class="pk-q" id="pkQ" placeholder="${esc(t('pl.searchSkill'))}"><div class="pk-list" id="pkList"></div></div>
        <div class="pk-right"><div class="pk-detail" id="pkDet"></div>
          <div class="pk-foot"><button class="btn" id="pkClear" ${current ? '' : 'disabled'}>${esc(t('pl.clearSlot'))}</button><span style="flex:1"></span>
            <button class="btn" id="pkCancel">${esc(t('b.cancel'))}</button><button class="btn primary" id="pkOk" disabled>${esc(t('pl.confirm'))}</button></div></div>`;
      const done = (v) => { modal(''); resolve(v); };
      const detail = () => {
        $('pkOk').disabled = !sel;
        $('pkDet').innerHTML = sel ? `<div class="pk-big">${ico(sel.icon, 'pk-bigico')}<div><h2>${esc(sel.name)}</h2>
            <div class="pk-tags">${(sel.tags || []).map((x) => `<span class="pk-tag">${esc(x)}</span>`).join('')}</div></div></div>
            <p class="muted" id="pkPrice">${sel.itemId ? esc(t('pl.priceLoading')) : esc(t('pl.noItem'))}</p>`
          : `<p class="muted pk-empty">${esc(t('pl.selectSkill'))}</p>`;
        if (sel && sel.itemId) tli.searchItems(sel.name).then((r) => {
          const it = r.find((x) => x.id === sel.itemId);
          if ($('pkPrice')) $('pkPrice').textContent = it && it.price ? t('pl.price', { fe: fe(it.price) }) : t('pl.noPrice');
        }).catch(() => {});
      };
      const draw = () => {
        const n = q.toLowerCase();
        const rows = list.filter((s) => !n || s.name.toLowerCase().includes(n) || s.tags.some((x) => x.toLowerCase().includes(n)));
        $('pkList').innerHTML = rows.map((s) => `<button class="pk-row${sel && sel.slug === s.slug ? ' on' : ''}" data-slug="${esc(s.slug)}">${ico(s.icon, 'pk-ico')}
          <span class="pk-name">${esc(s.name)}<span class="pk-tags">${s.tags.slice(0, 4).map((x) => `<span class="pk-tag">${esc(x)}</span>`).join('')}</span></span></button>`).join('')
          || `<p class="muted pk-empty">${esc(t('b.noResult'))}</p>`;
        $('pkList').querySelectorAll('[data-slug]').forEach((b) => {
          b.onclick = () => { sel = bySlug.get(b.dataset.slug); $('pkList').querySelectorAll('.pk-row').forEach((x) => x.classList.toggle('on', x === b)); detail(); };
          b.ondblclick = () => { sel = bySlug.get(b.dataset.slug); $('pkOk').click(); };
        });
      };
      $('pkQ').oninput = (e) => { q = e.target.value.trim(); draw(); };
      $('pkX').onclick = $('pkCancel').onclick = () => done(null);
      $('pkClear').onclick = () => done('clear');
      $('pkOk').onclick = () => sel && done({ skill: sel.slug, id: sel.itemId || null });
      draw(); detail(); $('pkQ').focus();
    });
  }
  // Choisir le héros (trait de départ) : portraits groupés par héros.
  function pickHero(heroes, currentKey) {
    return new Promise((resolve) => {
      const body = pickerShell(t('pl.pickHero'), true);
      const groups = [...new Set(heroes.map((h) => h.hero))];
      body.innerHTML = `<div class="hp">${groups.map((g) => `<div class="hp-g"><div class="hp-name">${esc(g)}</div><div class="hp-opts">
        ${heroes.filter((h) => h.hero === g).map((h) => `<button class="hp-o${h.key === currentKey ? ' on' : ''}" data-key="${esc(h.key)}">${ico(h.portrait, 'hp-pic')}<span>${esc(h.trait)}</span></button>`).join('')}</div></div>`).join('')}</div>`;
      $('pkX').onclick = () => { modal(''); resolve(null); };
      body.querySelectorAll('[data-key]').forEach((b) => (b.onclick = () => { modal(''); resolve(b.dataset.key); }));
    });
  }

  // Infobulle d'une compétence : nom, genre (active / soutien / aura) et tags.
  const KIND_LABEL = { active: 'cat.active', support: 'cat.support', passive: 'cat.passive' };
  const skillTip = (s) => Tip.attr({ t: s.name, s: s.kind ? t(KIND_LABEL[s.kind]) : '', g: s.tags || [], k: 'skill', i: s.icon });

  // ---------- Héros ----------
  function heroCard(hero, ro) {
    return `<button class="pl-hero${hero ? '' : ' empty'}" id="plHeroBtn" ${ro ? 'aria-disabled="true"' : ''}>
      ${hero ? ico(hero.portrait, 'pl-hero-pic') : '<span class="pl-plus">+</span>'}
      <span>${hero ? `<b>${esc(hero.hero)}</b><small>${esc(hero.trait)}</small>` : `<b>${esc(t('pl.selectHero'))}</b>`}</span></button>`;
  }

  // ---------- Compétences : 5 actives / 4 auras, chacune avec 5 soutiens ----------
  function mountSkills(box, b, opts = {}) {
    const ro = !!opts.readOnly;
    b.loadout = b.loadout || { active: [], passive: [] };
    let tab = 'active';
    b.loadout.active = b.loadout.active || []; b.loadout.passive = b.loadout.passive || [];
    const MAX = { active: 5, passive: 4 };
    if (ro && !b.loadout.active.length && !b.loadout.passive.length) { const sec = box.closest('.pl-sec'); if (sec) sec.remove(); return; }
    if (ro && !b.loadout.active.length) tab = 'passive';
    const render = () => {
      const lo = b.loadout;
      const rows = ro ? lo[tab].length : MAX[tab];
      const row = (i) => {
        const sl = lo[tab][i];
        const s = info(sl);
        const sups = (sl && sl.supports) || [];
        return `<div class="sk-row${s ? '' : ' empty'}">
          <button class="sk-main${tab === 'passive' ? ' aura' : ''}" data-main="${i}" ${s ? skillTip(s) : ''} ${ro ? 'aria-disabled="true"' : ''}>${s ? ico(s.icon) + ini(s.name) : '<span class="pl-plus">+</span>'}</button>
          <div class="sk-label">${s ? `<b>${esc(s.name)}</b>${sl.owned ? ` <span class="tag loot">${esc(t('m.owned'))}</span>` : ''}<small>${(s.tags || []).slice(0, 3).map(esc).join(' · ')}</small>`
            : `<span class="muted">${esc(t(tab === 'active' ? 'pl.activeN' : 'pl.auraN', { n: i + 1 }))}</span>`}</div>
          <div class="sk-sups">${[0, 1, 2, 3, 4].map((j) => { const x = info(sups[j]);
            return `<button class="sk-sup${x ? ' on' : ''}" data-sup="${i}:${j}" ${x ? skillTip(x) : ''} ${ro ? 'aria-disabled="true"' : !s || (!x && j > sups.length) ? 'disabled' : ''}>${x ? ico(x.icon) + ini(x.name) : ''}</button>`; }).join('')}</div>
          <div class="sk-count muted">${sups.length}/5</div>
        </div>`;
      };
      box.innerHTML = `<div class="sk-tabs">
          <button class="sk-tab${tab === 'active' ? ' on' : ''}" data-tab="active">${esc(t('pl.skills'))} <small>${lo.active.length}/5</small></button>
          <button class="sk-tab${tab === 'passive' ? ' on' : ''}" data-tab="passive">${esc(t('pl.auras'))} <small>${lo.passive.length}/4</small></button></div>
        <div class="sk-head muted"><span></span><span></span><span class="sk-sh">${esc(t('pl.supports'))}</span><span></span></div>
        <div class="sk-rows">${rows ? Array.from({ length: rows }, (_, i) => row(i)).join('') : `<p class="muted">${esc(t('pl.noSkill'))}</p>`}</div>`;
      box.querySelectorAll('[data-tab]').forEach((x) => (x.onclick = () => { tab = x.dataset.tab; render(); }));
      if (ro) return;
      box.querySelectorAll('[data-main]').forEach((x) => (x.onclick = async () => {
        const i = +x.dataset.main;
        const cur = lo[tab][i];
        const r = await pickSkill(tab, cur);
        if (!r) return;
        if (r === 'clear') lo[tab].splice(i, 1);
        else if (cur) Object.assign(cur, r);
        else lo[tab].push({ ...r, supports: [] });
        if (opts.onChange) opts.onChange(b);
        render();
      }));
      box.querySelectorAll('[data-sup]').forEach((x) => (x.onclick = async () => {
        const [i, j] = x.dataset.sup.split(':').map(Number);
        const sl = lo[tab][i];
        if (!sl) return;
        const r = await pickSkill('support', sl.supports[j]);
        if (!r) return;
        if (r === 'clear') sl.supports.splice(j, 1);
        else if (sl.supports[j]) sl.supports[j] = r;
        else sl.supports.push(r);
        if (opts.onChange) opts.onChange(b);
        render();
      }));
    };
    render();
  }

  // ---------- Équipement ----------
  // Données (tlidb.com) : pour chaque emplacement les types d'objets possibles ; pour chaque type, bases,
  // légendaires et affixes craftables. Un objet choisi garde son nom, son icône et ses lignes de stats.
  const GEAR = ['helmet', 'chest', 'necklace', 'gloves', 'belt', 'boots', 'ring1', 'ring2', 'weapon1', 'weapon2'];
  let gear = null;
  async function loadGear() { if (!gear) gear = await tli.gearData(); return gear; }
  const typeName = (slug) => (gear && gear.types[slug] ? gear.types[slug].name : (slug || '').replace(/_/g, ' '));
  const fill = (tpl, vals) => tpl.replace(/\{(\d+)\}/g, (m, i) => vals[+i] ?? '');
  // Stats d'un ancien emplacement sans lignes : on retrouve le légendaire par son nom.
  function statsOf(it) {
    if (!it) return { implicit: [], lines: [] };
    if (it.rarity === 'rare') return { implicit: it.implicit || [], lines: [...(it.prefixes || []), ...(it.suffixes || [])] };
    let lines = it.stats || [];
    if (!lines.length && gear) for (const t of Object.values(gear.types)) { const l = t.legendaries.find((x) => x.name === it.name); if (l) { lines = l.stats; break; } }
    return { implicit: [], lines };
  }

  // Fiche façon jeu (survol et aperçu).
  function gearCard(it, price) {
    const st = statsOf(it);
    const rare = it.rarity === 'rare';
    return `<div class="gt ${rare ? 'rare' : 'leg'}"><div class="gt-h">${ico(it.img, 'gt-ic')}<div><b>${esc(it.name || it.base || t(it.rarity === 'rare' ? 'gear.rare' : 'gear.legendary'))}</b>
        <small>${esc([typeName(it.type), rare && it.base && it.base !== it.name ? it.base : '', t(rare ? 'gear.rare' : 'gear.legendary')].filter(Boolean).join(' · '))}</small></div></div>
      ${st.implicit.length ? `<div class="gt-imp">${st.implicit.map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : ''}
      ${st.lines.length ? `<div class="gt-aff">${st.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div>` : `<p class="muted small">${esc(t('gear.noStats'))}</p>`}
      ${price ? `<div class="gt-price">${esc(t('pl.price', { fe: fe(price) }))}</div>` : ''}</div>`;
  }
  // Infobulle qui suit la souris.
  function bindTip(el, html) {
    el.onmouseenter = (e) => Tip.show(html(), e);
    el.onmouseleave = () => Tip.hide();
  }
  const hideTip = () => Tip.hide();

  // Choisir un objet pour un emplacement : légendaire (liste filtrée) ou rare fabriqué (base + affixes).
  function pickGear(slot, current) {
    return new Promise((resolve) => {
      hideTip();
      const types = (gear.slots[slot] || []).filter((x) => gear.types[x]);
      const body = pickerShell(t('pl.pickGear', { slot: t('gear.' + slot) }), true);
      let mode = current && current.rarity === 'rare' ? 'rare' : 'legendary';
      let typeF = '';
      let q = '';
      let sel = current && current.rarity !== 'rare' ? current : null;
      // Objet rare en cours de fabrication.
      const firstType = types.find((x) => gear.types[x].bases.length) || types[0];
      let rare = current && current.rarity === 'rare' ? JSON.parse(JSON.stringify(current))
        : { rarity: 'rare', type: firstType, base: '', name: '', img: null, implicit: [], prefixes: [], suffixes: [] };
      const done = (v) => { hideTip(); modal(''); resolve(v); };
      const legs = () => types.flatMap((ty) => gear.types[ty].legendaries.map((l) => ({ ...l, type: ty })))
        .filter((l, i, a) => a.findIndex((x) => x.name === l.name) === i);

      const legendaryHtml = () => `<div class="pk-left"><input class="pk-q" id="pkQ" placeholder="${esc(t('pl.searchItem'))}" value="${esc(q)}">
          <div class="pk-chips"><button class="fchip${typeF ? '' : ' on'}" data-tf="">${esc(t('gear.allTypes'))}</button>${types.map((ty) => `<button class="fchip${typeF === ty ? ' on' : ''}" data-tf="${ty}">${esc(typeName(ty))}</button>`).join('')}</div>
          <div class="pk-list" id="pkList"></div></div>
        <div class="pk-right"><div class="pk-detail" id="pkDet"></div>
          <div class="pk-foot"><button class="btn" id="pkClear" ${current ? '' : 'disabled'}>${esc(t('pl.clearSlot'))}</button><span style="flex:1"></span>
            <button class="btn" id="pkCancel">${esc(t('b.cancel'))}</button><button class="btn primary" id="pkOk" ${sel ? '' : 'disabled'}>${esc(t('pl.confirm'))}</button></div></div>`;

      const affixOptions = (kind) => {
        const fams = new Map();
        for (const f of (gear.types[rare.type] || { craft: { prefix: [], suffix: [] } }).craft[kind]) if (!fams.has(f.tpl)) fams.set(f.tpl, f);
        return [...fams.values()];
      };
      const rareHtml = () => {
        const ty = gear.types[rare.type] || { bases: [] };
        const affRows = (kind) => rare[kind === 'prefix' ? 'prefixes' : 'suffixes'].map((l, i) => `<div class="cr-aff"><input value="${esc(l)}" data-aedit="${kind}:${i}"><button class="btn" data-arm="${kind}:${i}">✕</button></div>`).join('');
        const adder = (kind) => {
          const opts = affixOptions(kind);
          const full = rare[kind === 'prefix' ? 'prefixes' : 'suffixes'].length >= 3;
          if (full) return '';
          return `<div class="cr-add"><select data-afam="${kind}" ${full ? 'disabled' : ''}><option value="">${esc(t(full ? 'gear.full' : kind === 'prefix' ? 'gear.addPrefix' : 'gear.addSuffix'))}</option>
            ${opts.map((f, i) => `<option value="${i}">${esc(fill(f.tpl, f.tiers.find((x) => x[0] === '1') ? f.tiers.find((x) => x[0] === '1')[1] : f.tiers[0][1]))}</option>`).join('')}</select>
            <select data-atier="${kind}" ${full ? 'disabled' : ''}></select><button class="btn" data-aadd="${kind}" ${full ? 'disabled' : ''}>+</button></div>`;
        };
        return `<div class="pk-left cr">
          <label>${esc(t('gear.type'))}<select id="crType">${types.map((x) => `<option value="${x}" ${x === rare.type ? 'selected' : ''}>${esc(typeName(x))}</option>`).join('')}</select></label>
          ${ty.bases.length ? `<label>${esc(t('gear.base'))}<select id="crBase"><option value="">${esc(t('gear.pickBase'))}</option>${ty.bases.map((x, i) => `<option value="${i}" ${x.name === rare.base ? 'selected' : ''}>${esc(x.name)} · ${esc(t('gear.lv', { n: x.lv }))} · ${esc(x.stats.join(', '))}</option>`).join('')}</select></label>` : ''}
          <label>${esc(t('gear.name'))}<input id="crName" value="${esc(rare.name)}" placeholder="${esc(rare.base || t('gear.namePh'))}"></label>
          <div class="cr-k">${esc(t('gear.prefixes'))} <small class="muted">${rare.prefixes.length}/3</small></div>${affRows('prefix')}${adder('prefix')}
          <div class="cr-k">${esc(t('gear.suffixes'))} <small class="muted">${rare.suffixes.length}/3</small></div>${affRows('suffix')}${adder('suffix')}
          <p class="muted small">${esc(t('gear.rareHelp'))}</p></div>
        <div class="pk-right"><div class="pk-detail">${gearCard({ ...rare, name: rare.name || rare.base })}</div>
          <div class="pk-foot"><button class="btn" id="pkClear" ${current ? '' : 'disabled'}>${esc(t('pl.clearSlot'))}</button><span style="flex:1"></span>
            <button class="btn" id="pkCancel">${esc(t('b.cancel'))}</button><button class="btn primary" id="pkOk" ${rare.base || rare.prefixes.length || rare.suffixes.length ? '' : 'disabled'}>${esc(t('pl.confirm'))}</button></div></div>`;
      };

      const render = () => {
        body.innerHTML = `<div class="pk-modes"><button class="sk-tab${mode === 'legendary' ? ' on' : ''}" data-mode="legendary">${esc(t('gear.legendary'))}</button><button class="sk-tab${mode === 'rare' ? ' on' : ''}" data-mode="rare">${esc(t('gear.custom'))}</button></div>
          ${mode === 'legendary' ? legendaryHtml() : rareHtml()}`;
        body.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => { mode = b.dataset.mode; render(); }));
        $('pkX').onclick = $('pkCancel').onclick = () => done(null);
        $('pkClear').onclick = () => done('clear');
        if (mode === 'legendary') bindLegendary(); else bindRare();
      };
      const detail = async () => {
        $('pkOk').disabled = !sel;
        if (!sel) { $('pkDet').innerHTML = `<p class="muted pk-empty">${esc(t('gear.selectItem'))}</p>`; return; }
        $('pkDet').innerHTML = gearCard(sel);
        if (sel.itemId || sel.id) { const p = await tli.itemPrice(sel.itemId || sel.id); if (p && $('pkDet')) $('pkDet').innerHTML = gearCard(sel, p); }
      };
      const bindLegendary = () => {
        const draw = () => {
          const n = q.toLowerCase();
          const rows = legs().filter((l) => (!typeF || l.type === typeF) && (!n || l.name.toLowerCase().includes(n) || l.stats.some((x) => x.toLowerCase().includes(n))));
          $('pkList').innerHTML = rows.slice(0, 200).map((l) => `<button class="pk-row${sel && sel.name === l.name ? ' on' : ''}" data-leg="${esc(l.name)}">${ico(l.icon, 'pk-ico sq')}
            <span class="pk-name">${esc(l.name)}<span class="pk-tags"><span class="pk-tag">${esc(typeName(l.type))}</span><span class="pk-tag">${esc(t('gear.lv', { n: l.lv }))}</span></span></span></button>`).join('')
            || `<p class="muted pk-empty">${esc(t('b.noResult'))}</p>`;
          const pick = (b) => { const l = rows.find((x) => x.name === b.dataset.leg); sel = { rarity: 'legendary', id: l.itemId || null, itemId: l.itemId, name: l.name, img: l.icon, type: l.type, stats: l.stats }; };
          $('pkList').querySelectorAll('[data-leg]').forEach((b) => {
            b.onclick = () => { pick(b); $('pkList').querySelectorAll('.pk-row').forEach((x) => x.classList.toggle('on', x === b)); detail(); };
            b.ondblclick = () => { pick(b); $('pkOk').click(); };
          });
        };
        $('pkQ').oninput = (e) => { q = e.target.value.trim(); draw(); };
        body.querySelectorAll('[data-tf]').forEach((b) => (b.onclick = () => { typeF = b.dataset.tf; body.querySelectorAll('[data-tf]').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
        $('pkOk').onclick = () => { if (sel) { const { itemId, ...it } = sel; done(it); } };
        draw(); detail(); $('pkQ').focus();
      };
      const bindRare = () => {
        $('crType').onchange = (e) => { rare = { ...rare, type: e.target.value, base: '', img: null, implicit: [], prefixes: [], suffixes: [] }; render(); };
        if ($('crBase')) $('crBase').onchange = (e) => {
          const b = gear.types[rare.type].bases[+e.target.value];
          Object.assign(rare, b ? { base: b.name, img: b.icon, implicit: b.stats.slice(0, 4) } : { base: '', img: null, implicit: [] });
          render();
        };
        $('crName').oninput = (e) => { rare.name = e.target.value; };
        $('crName').onchange = () => render();
        for (const kind of ['prefix', 'suffix']) {
          const famSel = body.querySelector(`[data-afam="${kind}"]`);
          if (!famSel) continue; // 3 affixes déjà pris
          const tierSel = body.querySelector(`[data-atier="${kind}"]`);
          const opts = affixOptions(kind);
          const tiers = () => { const f = opts[+famSel.value]; tierSel.innerHTML = f ? f.tiers.map((x, i) => `<option value="${i}" ${x[0] === '1' ? 'selected' : ''}>T${esc(x[0])} · ${esc(fill(f.tpl, x[1]))}</option>`).join('') : ''; };
          famSel.onchange = tiers;
          body.querySelector(`[data-aadd="${kind}"]`).onclick = () => {
            const f = opts[+famSel.value];
            if (!f || famSel.value === '') return;
            const tier = f.tiers[+tierSel.value] || f.tiers[0];
            rare[kind === 'prefix' ? 'prefixes' : 'suffixes'].push(fill(f.tpl, tier[1]));
            render();
          };
        }
        body.querySelectorAll('[data-aedit]').forEach((inp) => (inp.onchange = () => { const [k, i] = inp.dataset.aedit.split(':'); rare[k === 'prefix' ? 'prefixes' : 'suffixes'][+i] = inp.value.trim(); render(); }));
        body.querySelectorAll('[data-arm]').forEach((b) => (b.onclick = () => { const [k, i] = b.dataset.arm.split(':'); rare[k === 'prefix' ? 'prefixes' : 'suffixes'].splice(+i, 1); render(); }));
        $('pkOk').onclick = () => done({ ...rare, name: rare.name.trim() || rare.base || t('gear.rare'), prefixes: rare.prefixes.filter(Boolean), suffixes: rare.suffixes.filter(Boolean) });
      };
      render();
    });
  }

  async function mountGear(box, b, opts = {}) {
    const ro = !!opts.readOnly;
    b.gear = b.gear || {};
    await loadGear();
    const render = () => {
      const filled = GEAR.filter((k) => b.gear[k]);
      if (ro && !filled.length) { const sec = box.closest('.pl-sec'); if (sec) sec.remove(); return; }
      box.innerHTML = `<div class="gr">
        <div class="gr-slots">${GEAR.map((k) => { const g = b.gear[k];
          return `<div class="gr-cell"><button class="gr-slot${g ? ' on ' + (g.rarity === 'rare' ? 'rare' : 'leg') : ''}" data-gear="${k}" ${ro ? 'aria-disabled="true"' : ''}>${g ? ico(g.img) + ini(g.name) : '<span class="pl-plus">+</span>'}</button><small>${esc(t('gear.' + k))}</small></div>`; }).join('')}
          <div class="gr-count muted">${esc(t('pl.gearCount', { n: filled.length }))}</div></div>
        <div class="gr-list">${filled.length ? filled.map((k) => { const g = b.gear[k]; const st = statsOf(g);
          return `<div class="gr-item ${g.rarity === 'rare' ? 'rare' : 'leg'}" data-gi="${k}">${ico(g.img, 'pk-ico sq')}<span><b>${esc(g.name)}</b><small class="muted">${esc(t('gear.' + k))} · ${esc(t(g.rarity === 'rare' ? 'gear.rare' : 'gear.legendary'))}${g.price ? ' · ' + fe(g.price) + ' FE' : ''}</small>
            <small class="gr-first">${esc(st.lines.slice(0, 2).join(' · '))}</small></span></div>`; }).join('')
          : `<p class="muted">${esc(t(ro ? 'pl.noGear' : 'pl.noGear'))}</p>`}</div></div>`;
      box.querySelectorAll('[data-gear]').forEach((x) => { const g = b.gear[x.dataset.gear]; if (g) bindTip(x, () => gearCard(g, g.price)); });
      box.querySelectorAll('[data-gi]').forEach((x) => { const g = b.gear[x.dataset.gi]; bindTip(x, () => gearCard(g, g.price)); });
      if (ro) return;
      box.querySelectorAll('[data-gear]').forEach((x) => (x.onclick = async () => {
        const k = x.dataset.gear;
        const r = await pickGear(k, b.gear[k]);
        if (!r) return;
        if (r === 'clear') delete b.gear[k]; else b.gear[k] = r;
        if (opts.onChange) opts.onChange(b);
        render();
      }));
    };
    render();
  }

  return { load, section, bindSections, heroCard, pickHero, mountSkills, mountGear, info };
})();
