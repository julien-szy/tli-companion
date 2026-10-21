// Tri des tableaux : un clic sur l'en-tête d'une colonne trie (du plus grand au plus petit), un 2e clic
// inverse, un 3e revient à l'ordre d'origine. Le tri est gardé quand le tableau se met à jour en direct.
(() => {
  const state = new Map(); // clé du tableau -> { col, dir }
  let busy = false;

  // Clé stable d'un tableau, même quand la page le redessine : section + position + texte des en-têtes.
  const keyOf = (table) => {
    const section = table.closest('section');
    const all = section ? [...section.querySelectorAll('table')] : [];
    const heads = [...table.querySelectorAll('thead th')].map((th) => th.dataset.label || th.textContent.trim()).join('|');
    return `${section ? section.id : '?'}#${all.indexOf(table)}#${heads}`;
  };

  // Valeur triable d'une cellule : durée (1:23 / 1h18), nombre (+28,1 / 1 364 / 0.415), date, sinon texte.
  const valueOf = (td) => {
    if (!td) return { n: null, s: '' };
    if (td.dataset.sort != null) { const v = +td.dataset.sort; return Number.isFinite(v) ? { n: v, s: '' } : { n: null, s: td.dataset.sort }; }
    const s = td.textContent.replace(/[  ]/g, ' ').trim();
    if (!s || s === '–' || s === '-') return { n: null, s: '' };
    let m = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (m) return { n: m[3] != null ? (+m[1] * 3600 + +m[2] * 60 + +m[3]) : (+m[1] * 60 + +m[2]), s };
    m = /^(\d+)h(\d{2})$/.exec(s);
    if (m) return { n: +m[1] * 3600 + +m[2] * 60, s };
    // Nombre : espaces de milliers retirés, virgule décimale en français, suffixes FE / % / × / k / M.
    const fr = (typeof LANG !== 'undefined' && LANG === 'fr');
    let x = s.replace(/[\s  ]/g, '').replace('−', '-').replace(/(FE|%|×)$/, '');
    let mult = 1;
    if (/[0-9]M$/.test(x)) { mult = 1e6; x = x.slice(0, -1); } else if (/[0-9]k$/.test(x)) { mult = 1e3; x = x.slice(0, -1); }
    x = fr ? x.replace(',', '.') : x.replace(/,/g, '');
    if (/^[+-]?\d+(\.\d+)?$/.test(x)) return { n: parseFloat(x) * mult, s };
    const d = Date.parse(s);
    if (!Number.isNaN(d) && /\d{4}/.test(s)) return { n: d, s };
    return { n: null, s: s.toLowerCase() };
  };

  function sortTable(table) {
    const st = state.get(keyOf(table));
    const body = table.tBodies[0];
    if (!body) return;
    const rows = [...body.rows];
    // Ordre d'origine mémorisé pour pouvoir y revenir.
    rows.forEach((r, i) => { if (r.dataset.orig == null) r.dataset.orig = i; });
    const data = rows.filter((r) => !r.classList.contains('day') && r.cells.length > 1);
    const groups = rows.filter((r) => r.classList.contains('day'));
    busy = true;
    if (!st) {
      rows.sort((a, b) => a.dataset.orig - b.dataset.orig).forEach((r) => body.appendChild(r));
      groups.forEach((r) => { r.hidden = false; });
    } else {
      const k = st.dir === 'asc' ? 1 : -1;
      data.sort((a, b) => {
        const va = valueOf(a.cells[st.col]), vb = valueOf(b.cells[st.col]);
        if (va.n == null && vb.n == null) return k * va.s.localeCompare(vb.s);
        if (va.n == null) return 1; // vides toujours en bas
        if (vb.n == null) return -1;
        return k * (va.n - vb.n);
      }).forEach((r) => body.appendChild(r));
      // Lignes de regroupement par jour masquées pendant un tri (elles n'ont plus de sens).
      groups.forEach((r) => { r.hidden = true; });
    }
    table.querySelectorAll('thead th').forEach((th, i) => {
      th.classList.toggle('sort-asc', !!st && st.col === i && st.dir === 'asc');
      th.classList.toggle('sort-desc', !!st && st.col === i && st.dir === 'desc');
    });
    observer.takeRecords();
    busy = false;
  }

  document.addEventListener('click', (e) => {
    const th = e.target.closest('main table thead th');
    if (!th || !th.textContent.trim() || th.querySelector('input')) return;
    const table = th.closest('table');
    const col = [...th.parentNode.children].indexOf(th);
    const key = keyOf(table);
    const cur = state.get(key);
    // 1er clic : du plus grand au plus petit (texte : A → Z), 2e : inverse, 3e : ordre d'origine.
    const firstDir = valueOf(table.tBodies[0] && [...table.tBodies[0].rows].find((r) => !r.classList.contains('day') && r.cells.length > 1)?.cells[col]).n == null ? 'asc' : 'desc';
    if (!cur || cur.col !== col) state.set(key, { col, dir: firstDir });
    else if (cur.dir === firstDir) state.set(key, { col, dir: firstDir === 'desc' ? 'asc' : 'desc' });
    else state.delete(key);
    sortTable(table);
  });

  // Les tableaux se redessinent souvent (direct, sac, méta) : on réapplique le tri choisi.
  const observer = new MutationObserver(() => {
    if (busy) return;
    document.querySelectorAll('main table').forEach((table) => { if (state.has(keyOf(table))) sortTable(table); });
  });
  observer.observe(document.querySelector('main') || document.body, { childList: true, subtree: true });
})();
