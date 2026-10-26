// Onglet Stats : expérience (XP/h), morts (où, XP perdue) et DPS / défense du perso calculés par le jeu.
const Stats = (() => {
  let timer = null;
  let period = 'session';
  try { period = localStorage.getItem('statsPeriod') || 'session'; } catch { /* sans stockage */ }

  // 420 781 004 -> « 420,8 M »
  const big = (n) => (n == null ? '–' : new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: n >= 1e9 ? 2 : 1 }).format(n));
  const when = (ts) => {
    const d = new Date(ts), today = new Date(); today.setHours(0, 0, 0, 0);
    const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
    return ts >= today.getTime() ? time : `${d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })} ${time}`;
  };

  // Barres d'XP gagnée par heure sur 7 jours.
  function xpChart(hours) {
    if (!hours.length) return `<p class="muted">${esc(t('st.noXp'))}</p>`;
    const now = Date.now(), from = Math.floor((now - 7 * 86400000) / 3600000) * 3600000;
    const map = new Map(hours);
    const W = 700, H = 120, n = Math.ceil((now - from) / 3600000), bw = W / n;
    const max = Math.max(...hours.map((h) => h[1]));
    let bars = '', days = '';
    for (let i = 0; i < n; i++) {
      const h = from + i * 3600000, v = map.get(h) || 0;
      if (v) {
        const bh = Math.max(2, (v / max) * (H - 18));
        bars += `<rect x="${(i * bw).toFixed(1)}" y="${(H - 14 - bh).toFixed(1)}" width="${Math.max(1, bw - 1).toFixed(1)}" height="${bh.toFixed(1)}" rx="1"><title>${esc(when(h))} · ${esc(big(v))} XP</title></rect>`;
      }
      if (new Date(h).getHours() === 0) days += `<line x1="${(i * bw).toFixed(1)}" x2="${(i * bw).toFixed(1)}" y1="0" y2="${H - 14}"/><text x="${(i * bw + 3).toFixed(1)}" y="${H - 2}">${esc(new Date(h).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric' }))}</text>`;
    }
    return `<svg class="st-xp" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${days}${bars}</svg>`;
  }

  // Le DPS lu varie avec les buffs actifs au moment de la comparaison : on garde la médiane de chaque jour.
  function daily(pts) {
    const days = new Map();
    for (const p of pts) {
      const d = new Date(p.ts); d.setHours(0, 0, 0, 0);
      const k = d.getTime();
      if (!days.has(k)) days.set(k, []);
      days.get(k).push(p);
    }
    const med = (a) => { const v = a.slice().sort((x, y) => x - y); const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
    return [...days].sort((a, b) => a[0] - b[0]).map(([day, list]) => ({ day, dps: med(list.map((p) => p.dps)), def: med(list.map((p) => p.def)), n: list.length }));
  }
  // Courbe du DPS médian par jour (la défense en plus discret).
  function powerChart(days) {
    if (days.length < 2) return '';
    const W = 700, H = 110, n = days.length;
    const x = (i) => 20 + (i / (n - 1)) * (W - 40);
    const line = (key) => {
      // Échelle d'au moins ±10 % autour des valeurs : un petit écart reste un petit écart à l'écran.
      const vals = days.map((d) => d[key]), mid = (Math.max(...vals) + Math.min(...vals)) / 2;
      const half = Math.max((Math.max(...vals) - Math.min(...vals)) / 2 * 1.15, mid * 0.1, 1);
      const y = (v) => 10 + (1 - (v - (mid - half)) / (2 * half)) * (H - 34);
      return { d: days.map((dd, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(dd[key]).toFixed(1)}`).join(''), y };
    };
    const dps = line('dps'), def = line('def');
    const pts = days.map((d, i) => `<circle cx="${x(i).toFixed(1)}" cy="${dps.y(d.dps).toFixed(1)}" r="3.5"><title>${esc(d.label)} · DPS ${esc(big(d.dps))} · ${esc(t('st.def'))} ${esc(big(d.def))}</title></circle>
      <text x="${x(i).toFixed(1)}" y="${H - 4}" text-anchor="middle">${esc(d.label)}</text>`).join('');
    return `<svg class="st-pow" viewBox="0 0 ${W} ${H}"><path class="def" d="${def.d}"/><path class="dps" d="${dps.d}"/>${pts}</svg>
      <div class="st-legend"><span class="dps">— ${esc(t('st.dpsMed'))}</span><span class="def">— ${esc(t('st.def'))}</span></div>`;
  }

  // Fiche du perso (onglet Attributs en jeu) : les DPS en tuiles, puis toutes les stats non nulles,
  // avec l'écart par rapport à la fiche précédente.
  const HEAD = [[10100, 'st.atkDps'], [10103, 'st.spellDps'], [140000, 'st.dotDps'], [150000, 'st.minionAtk'], [150001, 'st.minionSpell']];
  let sheetQuery = '';
  const val = (v) => (v.length === 2 && v[0] === v[1] ? [v[0]] : v).map((x) => (Math.abs(x) >= 10000 ? big(x) : new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(x))).join(' – ');
  function delta(cur, prev) {
    if (!prev) return '';
    const a = cur.v[cur.v.length - 1], b = prev.v[prev.v.length - 1];
    if (a === b) return '';
    const k = b ? ((a - b) / Math.abs(b)) * 100 : null;
    const txt = k != null && Math.abs(b) >= 100 ? `${k > 0 ? '+' : ''}${Math.round(k)} %` : `${a > b ? '+' : ''}${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 }).format(a - b)}`;
    return `<span class="st-d ${a > b ? 'pos' : 'neg'}">${esc(txt)}</span>`;
  }
  function sheetCard(d) {
    const sh = d.sheet;
    if (!sh) return `<div class="card hcard"><h2>${esc(t('st.sheet'))}</h2><p class="muted">${esc(t('st.sheetNone'))}</p></div>`;
    const prev = d.sheetPrev ? d.sheetPrev.attrs : null;
    const tiles = HEAD.filter(([id]) => sh.attrs[id] && sh.attrs[id].v.some((x) => x)).map(([id, key]) =>
      `<div class="st-tile"><small>${esc(t(key))}</small><b>${esc(val(sh.attrs[id].v))}</b>${prev && prev[id] ? `<i>${delta(sh.attrs[id], prev[id]) || esc(t('st.same'))}</i>` : ''}</div>`).join('');
    // Toutes les stats non nulles, sans doublon (le jeu répète certaines lignes sous deux numéros).
    const seen = new Set();
    const rows = Object.entries(sh.attrs).filter(([id, a]) => {
      if (HEAD.some(([h]) => +h === +id) || !a.v.some((x) => x)) return false;
      const k = a.n + '|' + a.v.join();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    return `<div class="card hcard"><h2><span>${esc(t('st.sheet'))}</span><span class="muted small">${esc(t('st.sheetAt', { d: when(sh.ts) }))}${d.sheetPrev ? ' · ' + esc(t('st.sheetVs', { d: when(d.sheetPrev.ts) })) : ''}</span></h2>
      <div class="st-tiles small">${tiles}</div>
      <input class="st-q" id="stQ" placeholder="${esc(t('st.sheetSearch'))}" value="${esc(sheetQuery)}">
      <div class="st-sheet" id="stSheet">${rows.map(([id, a]) => `<div data-n="${esc(a.n.toLowerCase())}"><span>${esc(a.n)}</span><b>${esc(val(a.v))}</b>${prev && prev[id] ? delta(a, prev[id]) : ''}</div>`).join('')}</div>
      <p class="muted small">${esc(t('st.sheetHelp'))}</p></div>`;
  }
  // Équipement porté : chaque pièce avec ses affixes en clair (base, préfixes, suffixes, autres).
  function gearCard(d) {
    if (!d.gear || !d.gear.length) return `<div class="card hcard"><h2>${esc(t('st.gear'))}</h2><p class="muted">${esc(t('st.gearNone'))}</p></div>`;
    const line = (a) => `<li class="${a.sec}">${a.text ? esc(a.text) : `<span class="muted">${esc(t('st.gearUnknownAffix', { id: a.id }))}</span>`}${a.tier != null && (a.sec === 'prefix' || a.sec === 'suffix') ? ` <span class="st-tier">T${esc(a.tier)}</span>` : ''}</li>`;
    const piece = (p) => {
      const title = p.name ? `<b class="leg">${esc(p.name)}</b>` : `<b>${esc(t(p.known ? 'st.gearRare' : 'st.gearItem'))}</b>`;
      const tags = [p.level ? `<span class="tag">${esc(t('st.gearLv', { n: p.level }))}</span>` : '', p.corroded ? `<span class="tag corr">${esc(t('st.gearCorroded'))}</span>` : ''].join('');
      const order = ['base', 'prefix', 'suffix', 'other'];
      const body = p.known ? `<ul>${order.flatMap((k) => p.affixes.filter((a) => a.sec === k)).map(line).join('')}</ul>` : `<p class="muted small">${esc(t('st.gearLater'))}</p>`;
      return `<div class="st-gp"><div class="st-gh">${p.img ? icon(p.img) : ''}<div><small>${esc(t('st.slot.' + p.slot))}</small>${title}</div>${tags}</div>${body}</div>`;
    };
    return `<div class="card hcard"><h2>${esc(t('st.gear'))}</h2><div class="st-gear">${d.gear.map(piece).join('')}</div>
      <p class="muted small">${esc(t('st.gearHelp'))}</p></div>`;
  }

  // Chaque sort avec ses soutiens (dans l'ordre des emplacements du jeu).
  function skillsCard(d) {
    if (!d.skills || !d.skills.length) return `<div class="card hcard"><h2>${esc(t('st.skills'))}</h2><p class="muted">${esc(t('st.skillsNone'))}</p></div>`;
    const part = (kind) => d.skills.filter((g) => g.kind === kind).map((g) => `<div class="st-skrow">
        <span class="st-sk main">${icon(g.skill.img)} ${esc(g.skill.name)}</span>
        <span class="st-sups">${g.supports.map((s) => `<span class="st-sk ${s.kind}" title="${esc(t('st.sk.' + s.kind))}">${icon(s.img)} ${esc(s.name)}</span>`).join('') || `<span class="muted small">${esc(t('st.noSupport'))}</span>`}</span></div>`).join('');
    const act = part('active'), pas = part('passive');
    return `<div class="card hcard"><h2>${esc(t('st.skills'))}</h2>
      ${act ? `<h3 class="st-h3">${esc(t('st.sk.active'))}</h3><div class="st-skills">${act}</div>` : ''}
      ${pas ? `<h3 class="st-h3">${esc(t('st.sk.passive'))}</h3><div class="st-skills">${pas}</div>` : ''}</div>`;
  }
  function filterSheet() {
    const q = sheetQuery.trim().toLowerCase();
    document.querySelectorAll('#stSheet > div').forEach((r) => (r.hidden = !!q && !r.dataset.n.includes(q)));
  }

  function render(d) {
    const v = $('statsView');
    if (!v) return;
    const p = d[period] || d.session;
    const perH = period === 'session' && d.session.ms > 60000 ? (d.session.gain / d.session.ms) * 3600000 : null;
    const net = p.gain - p.lost;
    const cur = d.power[d.power.length - 1];
    const days = daily(d.power).map((x) => ({ ...x, label: new Date(x.day).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' }) }));
    const lv = d.level;
    const tile = (label, value, cls = '', sub = '') => `<div class="st-tile"><small>${esc(label)}</small><b class="${cls}">${value}</b>${sub ? `<i>${sub}</i>` : ''}</div>`;
    v.innerHTML = `
      <div class="st-beta"><span class="tag beta">BETA</span> ${esc(t('st.beta'))}</div>
      <div class="st-head">
        <div class="st-periods">${['session', 'today', 'week'].map((k) => `<button class="${k === period ? 'on' : ''}" data-p="${k}">${esc(t('st.p.' + k))}</button>`).join('')}</div>
        ${lv ? `<span class="st-lv">${esc(d.heroName || '')} · ${esc(t('st.level', { n: lv.level }))}${lv.max ? ` · ${Math.floor((lv.xp / lv.max) * 100)} %` : ''}</span>` : ''}
      </div>
      <div class="st-tiles">
        ${tile(t('st.xpGain'), esc(big(p.gain)), 'pos')}
        ${period === 'session' ? tile(t('st.xpH'), perH != null ? esc(big(perH)) : '–', '', esc(t('st.xpHsub', { t: dur(d.session.ms) }))) : ''}
        ${tile(t('st.deaths'), esc(String(p.deaths)), p.deaths ? 'neg' : '')}
        ${tile(t('st.xpLost'), p.lost ? '−' + esc(big(p.lost)) : '0', p.lost ? 'neg' : '')}
        ${tile(t('st.xpNet'), (net < 0 ? '−' : '+') + esc(big(Math.abs(net))), net < 0 ? 'neg' : 'pos', p.lost ? esc(t('st.lostShare', { n: Math.round((p.lost / Math.max(1, p.gain)) * 100) })) : '')}
      </div>

      <div class="card hcard"><h2>${esc(t('st.xpChart'))}</h2>${xpChart(d.hours)}</div>

      <div class="card hcard"><h2>${esc(t('st.power'))}</h2>
        ${cur ? `<div class="st-tiles small">${tile('DPS', esc(big(cur.dps)))}${tile(t('st.def'), esc(big(cur.def)))}${days.length > 1 ? tile(t('st.dpsChange'), (() => { const f = days[0].dps, c = days[days.length - 1].dps; const k = Math.round(((c - f) / f) * 100); return `<span class="${k >= 0 ? 'pos' : 'neg'}">${k >= 0 ? '+' : ''}${k} %</span>`; })(), '', esc(t('st.since', { d: days[0].label }))) : ''}</div>
          ${powerChart(days)}` : `<p class="muted">${esc(t('st.noPower'))}</p>`}
        <p class="muted small">${esc(t('st.powerHelp'))}</p>
      </div>

      ${sheetCard(d)}
      ${gearCard(d)}
      ${skillsCard(d)}

      <div class="st-cols">
        <div class="card hcard"><h2>${esc(t('st.deathsByMap'))}</h2>
          ${d.deathsByMap.length ? `<table class="st-tbl"><tr><th>${esc(t('st.map'))}</th><th class="r">${esc(t('st.deaths'))}</th><th class="r">${esc(t('st.xpLost'))}</th></tr>
            ${d.deathsByMap.map((m) => `<tr><td>${mapLabel(m.name)}</td><td class="r neg">${m.n}</td><td class="r">−${esc(big(m.lost))}</td></tr>`).join('')}</table>` : `<p class="muted">${esc(t('st.noDeath'))}</p>`}
        </div>
        <div class="card hcard"><h2>${esc(t('st.lastDeaths'))}</h2>
          ${d.deathsRecent.length ? `<table class="st-tbl">${d.deathsRecent.slice(0, 12).map((x) => `<tr><td class="muted nowrap">${esc(when(x.ts))}</td><td>${mapLabel(x.map || x.zone || '?')}</td><td class="r">${x.xpLost ? '−' + esc(big(x.xpLost)) : ''}</td></tr>`).join('')}</table>` : `<p class="muted">${esc(t('st.noDeath'))}</p>`}
        </div>
      </div>
      <p class="muted small">${esc(t('st.help'))}</p>`;
    const q = $('stQ');
    if (q) { q.oninput = () => { sheetQuery = q.value; filterSheet(); }; filterSheet(); }
    v.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => {
      period = b.dataset.p;
      try { localStorage.setItem('statsPeriod', period); } catch { /* sans stockage */ }
      render(d);
    }));
  }

  async function load() {
    const d = await tli.getStats();
    if (document.activeElement && document.activeElement.id === 'stQ') return;
    const main = document.querySelector('main'), top = main ? main.scrollTop : 0;
    render(d);
    if (main) main.scrollTop = top;
  }
  function show() {
    load();
    clearInterval(timer);
    timer = setInterval(() => { if (tab === 'stats') load(); else clearInterval(timer); }, 15000);
  }
  return { show };
})();
