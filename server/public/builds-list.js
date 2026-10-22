// Builds publiés (bêta) : recherche, classe, arbre de talents, tri ; bouton « Créer un build ».
document.title = `TLI Companion — ${t('navBuilds')}`;
const f = { q: '', hero: '', tree: '', sort: 'recent' };
async function loadList() {
  const p = new URLSearchParams();
  for (const k of ['q', 'hero', 'tree', 'sort']) if (f[k]) p.set(k, f[k]);
  history.replaceState(null, '', '/builds' + (p.toString() ? '?' + p : ''));
  $('rows').innerHTML = `<tr><td colspan="7" class="empty">${esc(t('loading'))}</td></tr>`;
  try {
    const [{ builds }, list] = await Promise.all([api('/api/builds?' + p), heroes()]);
    const byKey = Object.fromEntries(list.map((h) => [h.key, h]));
    const names = await Promise.all(builds.map((b) => Talents.treeNames(b.trees)));
    $('rows').innerHTML = builds.map((b, i) => `<tr class="click" data-id="${esc(b.id)}">
        <td><b>${esc(b.title)}</b>${b.mainSkill ? `<br><span class="muted small">${icon(b.mainSkill.img)}${esc(b.mainSkill.name)}</span>` : ''}</td>
        <td>${portrait(byKey[b.hero_key])}${esc(heroLabel(byKey[b.hero_key]))}</td>
        <td class="hide-sm">${names[i].map((n) => `<span class="chip tchip">${esc(n)}</span>`).join(' ') || '<span class="muted">–</span>'}</td>
        <td class="r hide-sm">${b.points || '–'}</td>
        <td class="hide-sm muted">${esc(b.author)}</td><td class="r">${b.likes || 0}</td>
        <td class="r hide-sm muted">${new Date(b.updated_at).toLocaleDateString(LOCALE)}</td></tr>`).join('')
      || `<tr><td colspan="7" class="empty">${esc(t('b.communityEmpty'))}</td></tr>`;
    document.querySelectorAll('tr.click').forEach((tr) => (tr.onclick = () => (location.href = '/b/' + tr.dataset.id)));
  } catch (e) { $('rows').innerHTML = `<tr><td colspan="7" class="empty">${esc(t('error', { msg: e.message }))}</td></tr>`; }
}

(async () => {
  const qs = new URLSearchParams(location.search);
  for (const k of Object.keys(f)) if (qs.get(k)) f[k] = qs.get(k);
  const [list, data] = await Promise.all([heroes(), Talents.load()]);
  $('content').innerHTML = `
    <div class="pagehead"><h1>${esc(t('navBuilds'))} <span class="tag beta">BETA</span></h1></div>
    <div class="bfil">
      <input id="fQ" placeholder="${esc(t('b.searchPh'))}" value="${esc(f.q)}">
      <select id="fHero"><option value="">${esc(t('b.allClasses'))}</option>${list.map((h) => `<option value="${esc(h.key)}" ${h.key === f.hero ? 'selected' : ''}>${esc(heroLabel(h))}</option>`).join('')}</select>
      <select id="fTree"><option value="">${esc(t('b.allTrees'))}</option>${data.trees.map((x) => `<option value="${esc(x.slug)}" ${x.slug === f.tree ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <div class="fchips">${['recent', 'likes', 'name'].map((k) => `<button class="fchip${f.sort === k ? ' on' : ''}" data-sort="${k}">${esc(t('b.sort_' + k))}</button>`).join('')}</div>
      <a class="btn primary" href="/planner" style="margin-left:auto">${esc(t('code.createTitle'))}</a>
    </div>
    <div class="card" style="padding:0"><table><thead><tr><th>${esc(t('b.colBuild'))}</th><th>${esc(t('col.class'))}</th><th class="hide-sm">${esc(t('b.colTrees'))}</th>
      <th class="r hide-sm">${esc(t('b.colPoints'))}</th><th class="hide-sm">${esc(t('b.colAuthor'))}</th><th class="r">♥</th><th class="r hide-sm">${esc(t('b.colUpdated'))}</th></tr></thead><tbody id="rows"></tbody></table></div>
    <p class="muted small">${esc(t('code.listHelp'))}</p>`;
  let timer;
  $('fQ').oninput = (e) => { clearTimeout(timer); timer = setTimeout(() => { f.q = e.target.value.trim(); loadList(); }, 300); };
  $('fHero').onchange = (e) => { f.hero = e.target.value; loadList(); };
  $('fTree').onchange = (e) => { f.tree = e.target.value; loadList(); };
  document.querySelectorAll('[data-sort]').forEach((b) => (b.onclick = () => { f.sort = b.dataset.sort; document.querySelectorAll('[data-sort]').forEach((x) => x.classList.toggle('on', x === b)); loadList(); }));
  loadList();
})().catch((e) => { $('content').innerHTML = `<div class="empty">${esc(t('error', { msg: e.message }))}</div>`; });
