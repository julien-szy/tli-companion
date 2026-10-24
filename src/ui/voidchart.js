// Éditeur du Void Chart dans la fiche d'une session : le joueur coche les nœuds qu'il a pris.
// Point de départ : ce que le log permet de deviner (talents lus, reliés au départ). Comme dans le jeu,
// un nœud n'est pris que relié au départ : cliquer un nœud éloigné prend aussi le chemin, en retirer un
// retire ce qui n'est plus relié. Enregistré dans la session (voidChart) et envoyé avec la route publiée.
const VoidChart = (() => {
  let data = null;
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const tpl = (s) => String(s || '').toLowerCase().replace(/\d+(\.\d+)?/g, '#').replace(/[^a-z#]+/g, '');
  const num = (s) => { const m = /(\d+(?:\.\d+)?)/.exec(String(s || '')); return m ? +m[1] : null; };

  async function load() {
    if (data) return data;
    data = await tli.voidChartData();
    for (const c of data.constellations) {
      c.adj = new Map(c.nodes.map((n) => [n.id, []]));
      for (const [a, b] of c.links) if (c.adj.has(a) && c.adj.has(b)) { c.adj.get(a).push(b); c.adj.get(b).push(a); }
      const start = c.nodes.find((n) => /initial node/i.test(n.name)) || c.nodes.reduce((a, n) => (n.r > a.r ? n : a), c.nodes[0]);
      c.start = start.id;
      c.byId = new Map(c.nodes.map((n) => [n.id, n]));
    }
    return data;
  }
  const bySlug = (slug) => data.constellations.find((c) => c.slug === slug);

  // Chemin le plus court depuis l'ensemble pris jusqu'à un nœud (nœuds à ajouter, sans ceux déjà pris).
  function pathTo(c, taken, target) {
    const prev = new Map([...taken].map((id) => [id, null]));
    const q = [...taken];
    while (q.length) {
      const id = q.shift();
      if (id === target) break;
      for (const nb of c.adj.get(id) || []) if (!prev.has(nb)) { prev.set(nb, id); q.push(nb); }
    }
    if (!prev.has(target)) return [];
    const out = [];
    for (let id = target; id != null && !taken.has(id); id = prev.get(id)) out.push(id);
    return out;
  }
  // Ce qui reste relié au départ.
  function connected(c, taken) {
    const seen = new Set([c.start]);
    const q = [c.start];
    while (q.length) { const id = q.shift(); for (const nb of c.adj.get(id) || []) if (taken.has(nb) && !seen.has(nb)) { seen.add(nb); q.push(nb); } }
    return seen;
  }

  // Devine les nœuds pris à partir des modificateurs lus dans le log (même règle que le site).
  function guess(mods) {
    const picks = {};
    const jobs = [];
    for (const m of mods.filter((x) => x.desc)) {
      const exact = norm(m.desc), key = tpl(m.desc), want = num(m.desc), times = Math.max(1, Math.round(m.perMap || 1));
      const anyExact = data.constellations.some((c) => c.nodes.some((n) => n.effects.some((e) => norm(e) === exact)));
      const loose = !anyExact && /netherrealm|trial|malice/i.test(m.desc);
      for (const c of data.constellations) {
        const vals = new Map();
        for (const n of c.nodes) {
          const e = n.effects.find((x) => norm(x) === exact) || (loose ? n.effects.find((x) => tpl(x) === key) : null);
          if (!e) continue;
          const v = num(e);
          if (want != null && v != null && v > want + 1e-9) continue;
          vals.set(n.id, v);
        }
        if (!vals.size) continue;
        jobs.push({ c, vals, target: want != null && want > 0 ? want * times : times, numeric: want != null && want > 0 });
        break;
      }
    }
    jobs.sort((a, b) => a.vals.size - b.vals.size);
    for (const { c, vals, target, numeric } of jobs) {
      const taken = new Set(picks[c.slug] || [c.start]);
      const cands = new Set(vals.keys());
      let left = target;
      for (let g = 0; left > 1e-6 && g < 60; g++) {
        // Candidat libre le plus proche de ce qui est pris.
        const prev = new Map([...taken].map((id) => [id, null]));
        const q = [...taken];
        let found = null;
        while (q.length && !found) {
          const id = q.shift();
          for (const nb of c.adj.get(id) || []) { if (prev.has(nb)) continue; prev.set(nb, id); q.push(nb); if (cands.has(nb)) { found = nb; break; } }
        }
        if (!found) break;
        for (let id = found; id != null && !taken.has(id); id = prev.get(id)) taken.add(id);
        cands.delete(found);
        left -= numeric ? (vals.get(found) || left) : 1;
      }
      picks[c.slug] = [...taken];
    }
    return picks;
  }

  // Monte l'éditeur dans `box` pour la session `r`. opts.readOnly : affichage seul (route d'un autre joueur).
  async function mount(box, r, opts = {}) {
    await load();
    const ro = !!opts.readOnly;
    let picks = r.voidChart && Object.keys(r.voidChart).length ? JSON.parse(JSON.stringify(r.voidChart)) : guess(r.strategy.modifiers || []);
    const fromLog = !(r.voidChart && Object.keys(r.voidChart).length);
    const sets = () => Object.fromEntries(data.constellations.map((c) => [c.slug, new Set(picks[c.slug] || [])]));
    let cur = (Object.entries(picks).sort((a, b) => b[1].length - a[1].length)[0] || [data.constellations[0].slug])[0];
    const points = () => Object.entries(picks).reduce((n, [slug, ids]) => { const c = bySlug(slug); return n + ids.filter((id) => !c || id !== c.start).length; }, 0);
    const save = () => {
      if (ro) return;
      const clean = {};
      for (const [slug, ids] of Object.entries(picks)) if (ids.some((id) => id !== bySlug(slug).start)) clean[slug] = ids;
      picks = clean;
      tli.updateReport(r.id, { voidChart: clean });
      r.voidChart = clean;
    };
    const render = () => {
      const s = sets();
      const c = bySlug(cur);
      const on = s[cur];
      const xs = c.nodes.map((n) => n.x), ys = c.nodes.map((n) => n.y), pad = 80;
      const vb = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + 2 * pad, Math.max(...ys) - Math.min(...ys) + 2 * pad];
      const lines = c.links.map(([a, b]) => { const A = c.byId.get(a), B = c.byId.get(b); if (!A || !B) return '';
        return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" class="${on.has(a) && on.has(b) ? 'hot' : ''}"/>`; }).join('');
      const nodes = c.nodes.map((n) => { const big = n.r >= 45, mid = n.r >= 38;
        return `<g class="vce-n${on.has(n.id) ? ' on' : ''}${n.id === c.start ? ' start' : ''}${big ? ' big' : mid ? ' mid' : ''}" data-node="${n.id}"><title>${esc([n.name, ...n.effects].join('\n'))}</title>
          <circle class="hit" cx="${n.x}" cy="${n.y}" r="${n.r + 16}"/><circle class="dot" cx="${n.x}" cy="${n.y}" r="${Math.max(16, n.r * 0.7)}"/></g>`; }).join('');
      box.innerHTML = `<div class="vce-head"><h2>${esc(t('vce.title'))}</h2><span class="muted${points() > 92 ? " neg" : ""}">${esc(t("vce.points", { n: points() }))}</span>
          ${ro ? '' : `<button class="btn" id="vceAuto">${esc(t('vce.auto'))}</button><button class="btn" id="vceClear">${esc(t('vce.clear'))}</button>`}</div>
        <p class="muted vce-help">${esc(ro ? t(fromLog ? 'vce.roGuess' : 'vce.roExact') : t(fromLog && !r.voidChart ? 'vce.helpGuess' : 'vce.help'))}${!ro && r.shared ? ' ' + esc(t('vce.helpShared')) : ''}</p>
        <div class="vce-tabs">${data.constellations.filter((k) => !ro || (s[k.slug] && s[k.slug].size > 1)).map((k) => { const n = (s[k.slug] || new Set()).size; const cnt = n ? n - (s[k.slug].has(k.start) ? 1 : 0) : 0;
          return `<button class="vce-tab${k.slug === cur ? ' on' : ''}${cnt ? ' used' : ''}" data-slug="${esc(k.slug)}">${esc(k.name)}${cnt ? ` <b>${cnt}</b>` : ''}</button>`; }).join('')}</div>
        <svg class="vce-svg" viewBox="${vb.join(' ')}"><g class="vce-links">${lines}</g>${nodes}</svg>`;
      box.querySelectorAll('.vce-tab').forEach((b) => (b.onclick = () => { cur = b.dataset.slug; render(); }));
      if (ro) return;
      box.querySelectorAll('.vce-n').forEach((g) => (g.onclick = () => {
        const id = +g.dataset.node;
        const taken = new Set(picks[cur] || []);
        if (!taken.size) taken.add(c.start);
        if (id === c.start) { if (taken.size <= 1) return; taken.clear(); }
        else if (taken.has(id)) { taken.delete(id); const keep = connected(c, taken); for (const x of [...taken]) if (!keep.has(x)) taken.delete(x); }
        else for (const x of pathTo(c, taken, id)) taken.add(x);
        picks[cur] = [...taken];
        save();
        render();
      }));
      $('vceAuto').onclick = () => { picks = guess(r.strategy.modifiers || []); save(); render(); };
      $('vceClear').onclick = async () => { if (!(await askConfirm(t('vce.confirmClear'), { danger: true }))) return; picks = {}; save(); render(); };
    };
    render();
    return { save };
  }
  return { mount };
})();
