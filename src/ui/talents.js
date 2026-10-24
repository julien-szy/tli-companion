// Traits de héros et arbres de talents d'un build, comme en jeu (données : tlidb.com).
// - Traits : un choix par niveau requis (1, 45, 60, 75).
// - Talents : 4 emplacements, le 1er est un dieu, les autres des professions (chacun s'ouvre une fois le
//   précédent choisi). Chaque arbre est une grille de 7 colonnes : une colonne s'ouvre avec 0, 3, 6… 18
//   points investis dans les colonnes précédentes, et un nœud relié à gauche demande que ce nœud soit au
//   maximum. Les talents principaux (en haut) s'ouvrent à 12 / 24 points dans l'arbre : un seul par palier.
// Clic : +1 point, clic droit : −1. En lecture seule, seuls les arbres utilisés sont affichés.
const Talents = (() => {
  let data = null;
  const MAX_POINTS = 115; // points de talent d'un personnage niveau 100
  const GOD_COLORS = {
    'God of Might': '#d4a03a', 'Goddess of Hunting': '#4fb35a', 'Goddess of Knowledge': '#4a86dc',
    'God of War': '#d0473b', 'Goddess of Deception': '#a356d6', 'God of Machines': '#24a8a0',
  };
  const treeOf = (slug) => data.trees.find((t) => t.slug === slug) || null;
  const colorOf = (tree) => GOD_COLORS[tree.god ? tree.name : tree.parent] || '#ff8a3d';
  async function load() {
    if (!data) data = await tli.buildData();
    return data;
  }
  // Héros du build : la clé de classe de l'app pointe vers la page tlidb du trait (…/en/Anger).
  const heroFor = (hero) => (hero && hero.url ? data.heroes.find((h) => h.slug === hero.url.split('/').pop()) : null) || null;

  const ptsOf = (b, slug) => (b.talents.nodes[slug] = b.talents.nodes[slug] || {});
  const treePts = (b, slug) => Object.values(b.talents.nodes[slug] || {}).reduce((a, v) => a + v, 0);
  const totalPts = (b) => (b.talents.trees || []).filter(Boolean).reduce((n, s) => n + treePts(b, s), 0);
  const below = (tree, pts, col) => tree.nodes.reduce((a, n) => a + (n.col < col ? pts[n.id] || 0 : 0), 0);
  // Tous les nœuds investis respectent-ils les règles (colonnes, liens) ?
  function valid(tree, pts) {
    for (const n of tree.nodes) {
      const v = pts[n.id] || 0;
      if (!v) continue;
      if (v > n.max || below(tree, pts, n.col) < n.pts) return false;
      if (n.req) { const r = tree.nodes.find((x) => x.id === n.req); if (r && (pts[r.id] || 0) < r.max) return false; }
    }
    return true;
  }
  const canAdd = (b, tree, pts, n) => totalPts(b) < MAX_POINTS && (pts[n.id] || 0) < n.max && valid(tree, { ...pts, [n.id]: (pts[n.id] || 0) + 1 });
  const canRemove = (tree, pts, n) => (pts[n.id] || 0) > 0 && valid(tree, { ...pts, [n.id]: pts[n.id] - 1 });
  // Les talents principaux dont le palier n'est plus atteint sont retirés.
  function dropCores(b, slug) {
    const tree = treeOf(slug);
    const have = treePts(b, slug);
    if (!tree || !b.talents.core[slug]) return;
    b.talents.core[slug] = b.talents.core[slug].filter((id) => { const c = tree.core.find((x) => x.id === id); return c && c.pts <= have; });
    if (!b.talents.core[slug].length) delete b.talents.core[slug];
  }
  function prep(b) {
    b.talents = b.talents || { trees: [], nodes: {}, core: {} };
    b.talents.nodes = b.talents.nodes || {}; b.talents.core = b.talents.core || {}; b.talents.trees = b.talents.trees || [];
    b.traits = b.traits || [];
  }

  const img = (src, cls) => (src ? `<img class="${cls}" src="${esc(src)}" alt="" onerror="this.style.visibility='hidden'">` : '');
  const shortEffect = (s) => (s.length > 34 ? s.slice(0, 32) + '…' : s);
  // « +9% damage » × 3 points -> « +27% damage » (premier nombre de la ligne multiplié).
  const scale = (e, n) => (n > 1 ? e.replace(/(\d+(?:\.\d+)?)/, (m) => String(Math.round(+m * n * 100) / 100)) : e);

  // ---------- Traits de héros ----------
  async function mountTraits(box, b, opts = {}) {
    await load();
    prep(b);
    const ro = !!opts.readOnly;
    const h = heroFor(opts.hero);
    const render = () => {
      if (!h) { box.innerHTML = ro ? '' : `<p class="muted">${esc(t('tal.pickHeroFirst'))}</p>`; return; }
      const levels = [...new Set(h.traits.map((x) => x.lv))].sort((a, c) => a - c);
      const chosen = new Set(b.traits);
      box.innerHTML = `<div class="trt">${levels.map((lv) => {
        const opts2 = h.traits.filter((x) => x.lv === lv);
        const pick = opts2.find((x) => chosen.has(x.id)) || (opts2.length === 1 ? opts2[0] : null);
        if (ro && !pick) return '';
        return `<div class="trt-lv"><span class="trt-k">${esc(t('tal.lv', { n: lv }))}</span><div class="trt-opts">
          ${(ro ? [pick] : opts2).map((x) => `<button class="trt-o${pick && pick.id === x.id ? ' on' : ''}${opts2.length === 1 ? ' fixed' : ''}" data-trait="${x.id}" data-lv="${lv}" ${Tip.attr({ t: x.name, s: `${h.hero} · ${t('tal.lv', { n: lv })}`, l: x.effects, k: 'trait', i: x.icon })} ${ro ? 'aria-disabled="true"' : ''}>
            ${img(x.icon, 'trt-ic')}<span>${esc(x.name)}</span></button>`).join('')}</div></div>`;
      }).join('')}</div>`;
      if (ro) return;
      box.querySelectorAll('[data-trait]').forEach((x) => (x.onclick = () => {
        const lv = +x.dataset.lv;
        const same = new Set(h.traits.filter((y) => y.lv === lv).map((y) => y.id));
        b.traits = b.traits.filter((id) => !same.has(id)).concat(+x.dataset.trait);
        if (opts.onChange) opts.onChange(b);
        render();
      }));
    };
    render();
  }

  // ---------- Arbres ----------
  const SLOT_LABEL = ['tal.slotGod', 'tal.slotClass', 'tal.slot3', 'tal.slot4'];
  async function mountTrees(box, b, opts = {}) {
    await load();
    prep(b);
    const ro = !!opts.readOnly;
    const slots = ro ? b.talents.trees.map((s, i) => (s ? i : null)).filter((i) => i != null) : [0, 1, 2, 3];
    if (ro && !slots.length) { const sec = box.closest('.pl-sec'); if (sec) sec.remove(); else box.remove(); return; }
    let slot = slots[0] ?? 0;
    let choosing = false; // « Changer » : on remontre les bannières
    let showBonus = false;
    const changed = () => { if (opts.onChange) opts.onChange(b); };

    const slotCards = () => slots.map((i) => {
      const s = b.talents.trees[i];
      const tree = s && treeOf(s);
      const locked = !ro && i > 0 && !b.talents.trees[i - 1];
      return `<button class="tt-slot${i === slot ? ' on' : ''}${locked ? ' locked' : ''}" data-tab="${i}" ${locked ? 'disabled' : ''} ${tree ? `style="--god:${colorOf(tree)}"` : ''}>
        <span class="tt-ic">${tree ? img(tree.icon, '') : '<span class="pl-plus">+</span>'}</span>
        <span class="tt-sl"><small>${esc(t(SLOT_LABEL[i]))}</small><b>${esc(tree ? tree.name : t(locked ? 'tal.selectPrev' : 'tal.clickSelect'))}</b></span>
        ${tree ? `<span class="tt-p">${treePts(b, s)}</span>` : ''}</button>`;
    }).join('');

    // Bannières de choix : les 6 dieux (emplacement 1) ou les professions rangées sous leur dieu.
    const banners = () => {
      const used = new Set(b.talents.trees.filter((s, i) => s && i !== slot));
      if (slot === 0) {
        return `<div class="tb-gods">${data.trees.filter((x) => x.god).map((x) => `<button class="tb-god${used.has(x.slug) ? ' used' : ''}" data-pick="${x.slug}" style="--god:${colorOf(x)}" ${used.has(x.slug) ? 'disabled' : ''}>
          <span class="tb-pic">${img(x.icon, '')}</span><b>${esc(x.name)}</b><small>${esc(x.tags.join(' · '))}</small></button>`).join('')}</div>`;
      }
      return `<div class="tb-cols">${data.trees.filter((x) => x.god).map((g) => `<div class="tb-col" style="--god:${colorOf(g)}"><div class="tb-colh">${img(g.icon, '')}<b>${esc(g.name)}</b></div>
        ${data.trees.filter((x) => !x.god && x.parent === g.name).map((x) => `<button class="tb-prof${used.has(x.slug) ? ' used' : ''}" data-pick="${x.slug}" ${used.has(x.slug) ? 'disabled' : ''}>
          ${img(x.icon, 'tb-pi')}<span><b>${esc(x.name)}</b><small>${esc(x.tags.join(' · '))}</small></span></button>`).join('')}</div>`).join('')}</div>`;
    };

    const treeView = (tree) => {
      const slug = tree.slug;
      const pts = b.talents.nodes[slug] || {};
      const have = treePts(b, slug);
      const cores = new Set(b.talents.core[slug] || []);
      const gates = [...new Set(tree.core.map((c) => c.pts))].sort((a, c) => a - c);
      const coreHtml = gates.map((g) => `<div class="tal-gate${have >= g ? ' open' : ''}"><span class="trt-k">${esc(t('tal.gate', { n: g }))}</span>
        ${tree.core.filter((c) => c.pts === g && (!ro || cores.has(c.id))).map((c) => `<button class="tal-core${cores.has(c.id) ? ' on' : ''}" data-core="${c.id}" ${Tip.attr({ t: c.name, s: `${tree.name} · ${t('tal.gate', { n: c.pts })}`, l: c.effects, k: 'core', i: c.icon })} ${ro || have < g ? 'aria-disabled="true"' : ''}>${img(c.icon, 'trt-ic')}<span>${esc(c.name)}</span></button>`).join('')
        || '<span class="muted">–</span>'}</div>`).join('');
      const colPts = (c) => (tree.nodes.find((n) => n.col === c) || { pts: c * 3 }).pts;
      const grid = `<div class="tal-grid">${[0, 1, 2, 3, 4, 5, 6].map((c) => `<div class="tal-colh${below(tree, pts, c) >= colPts(c) ? ' open' : ''}" style="grid-column:${c + 1};grid-row:1">${colPts(c)}</div>`).join('')}
        ${tree.nodes.map((n) => { const v = pts[n.id] || 0; const add = !ro && canAdd(b, tree, pts, n);
          return `<button class="tal-n ${n.kind}${v ? ' on' : ''}${v >= n.max ? ' max' : ''}${add ? ' can' : ''}${n.req ? ' linked' + ((pts[n.req] || 0) > 0 ? ' hot' : '') : ''}" style="grid-column:${n.col + 1};grid-row:${n.row + 2}" data-node="${n.id}" ${Tip.attr({ t: n.name, s: `${tree.name} · ${v}/${n.max}`, l: v > 1 ? n.effects.map((e) => `${e}  (×${v} : ${scale(e, v)})`) : n.effects, k: n.kind === 'legendary' ? 'core' : 'talent' })} ${ro ? 'tabindex="-1"' : ''}>
            <span class="tal-ef">${esc(shortEffect(n.effects[0] || n.name))}</span><b class="tal-v">${v}/${n.max}</b></button>`; }).join('')}</div>`;
      const bonus = [];
      for (const c of tree.core) if (cores.has(c.id)) bonus.push(`<li class="core"><b>${esc(c.name)}</b></li>`, ...c.effects.map((e) => `<li>${esc(e)}</li>`));
      for (const n of tree.nodes) if (pts[n.id]) for (const e of n.effects) bonus.push(`<li>${esc(scale(e, pts[n.id]))}</li>`);
      return `<div class="tt-th" style="--god:${colorOf(tree)}">${img(tree.icon, 'tt-thi')}<div><b>${esc(tree.name)}</b><small class="muted">${esc(tree.god ? t('tal.god') : tree.parent || '')} · ${esc(tree.tags.join(' · '))}</small></div>
          <span class="tal-sum">${esc(t('tal.points', { n: have }))}</span>
          ${ro ? '' : `<button class="btn" data-change>${esc(t('tal.change'))}</button><button class="btn" data-reset>${esc(t('tal.reset'))}</button>`}</div>
        ${coreHtml ? `<div class="tal-cores">${coreHtml}</div>` : ''}
        ${grid}
        <div class="tal-info muted" data-info>${esc(t(ro ? 'tal.helpRo' : 'tal.help'))}</div>
        <button class="tal-btog" data-bonus>${showBonus ? '▾' : '▸'} ${esc(t('tal.bonus'))} <small class="muted">(${bonus.length})</small></button>
        ${showBonus ? (bonus.length ? `<ul class="tal-list">${bonus.join('')}</ul>` : `<p class="muted">${esc(t('tal.none'))}</p>`) : ''}`;
    };

    const render = () => {
      const s = b.talents.trees[slot];
      const tree = s && treeOf(s);
      const total = totalPts(b);
      box.innerHTML = `<div class="tt">
        <div class="tt-side">${slotCards()}
          <div class="tt-total"><small>${esc(t('tal.totalPts'))}</small><b class="${total >= MAX_POINTS ? 'full' : ''}">${total}</b><span> / ${MAX_POINTS}</span></div></div>
        <div class="tt-main">${tree && !choosing ? treeView(tree) : ro ? '' : banners()}</div></div>
        <p class="muted small tal-credit">${esc(t('tal.credit'))}</p>`;
      box.querySelectorAll('[data-tab]').forEach((x) => (x.onclick = () => { slot = +x.dataset.tab; choosing = false; render(); }));
      const bt = box.querySelector('[data-bonus]');
      if (bt) bt.onclick = () => { showBonus = !showBonus; render(); };
      if (ro) return;
      box.querySelectorAll('[data-pick]').forEach((x) => (x.onclick = async () => {
        const old = b.talents.trees[slot];
        if (old && old !== x.dataset.pick) {
          if (treePts(b, old) && !(await (typeof askConfirm === 'function' ? askConfirm : (m) => Promise.resolve(confirm(m)))(t('tal.confirmSwap')))) return;
          delete b.talents.nodes[old]; delete b.talents.core[old];
        }
        b.talents.trees[slot] = x.dataset.pick;
        choosing = false;
        changed(); render();
      }));
      const ch = box.querySelector('[data-change]');
      if (ch) ch.onclick = () => { choosing = true; render(); };
      const rs = box.querySelector('[data-reset]');
      if (rs) rs.onclick = () => { delete b.talents.nodes[s]; delete b.talents.core[s]; changed(); render(); };
      if (!tree || choosing) return;
      box.querySelectorAll('[data-node]').forEach((el) => {
        const n = tree.nodes.find((x) => x.id === el.dataset.node);
        const step = (d) => {
          const pts = ptsOf(b, s);
          if (d > 0 ? !canAdd(b, tree, pts, n) : !canRemove(tree, pts, n)) { el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny'); return; }
          pts[n.id] = (pts[n.id] || 0) + d;
          if (!pts[n.id]) delete pts[n.id];
          dropCores(b, s);
          changed(); render();
        };
        el.onclick = (e) => step(e.shiftKey ? -1 : 1);
        el.oncontextmenu = (e) => { e.preventDefault(); step(-1); };
      });
      box.querySelectorAll('[data-core]').forEach((el) => (el.onclick = () => {
        if (el.getAttribute('aria-disabled')) return;
        const c = tree.core.find((x) => x.id === el.dataset.core);
        const cur = (b.talents.core[s] || []).filter((id) => { const o = tree.core.find((x) => x.id === id); return o && o.pts !== c.pts; });
        if (!(b.talents.core[s] || []).includes(c.id)) cur.push(c.id);
        if (cur.length) b.talents.core[s] = cur; else delete b.talents.core[s];
        changed(); render();
      }));
    };
    render();
  }

  // Résumé court d'un build pour les listes : noms des arbres.
  async function treeNames(slugs) { await load(); return (slugs || []).map((s) => (treeOf(s) || { name: s }).name); }
  return { load, mountTraits, mountTrees, treeNames, heroFor: (h) => (data ? heroFor(h) : null), trees: () => (data ? data.trees : []), MAX_POINTS };
})();
