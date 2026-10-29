// Guide : le « Path of Progression » du jeu (Journey, Skill, Gear, Hero Memories, Loot, Divinity Slate, Challenge),
// palier par palier, avec ses tâches à cocher. Les données viennent de progression.js (généré depuis tlidb).
// Cases gardées dans ce navigateur et, connecté, sur le compte. La clé d'une case = l'identifiant de la tâche
// dans le jeu : elle reste valable quand on régénère les données.
const G = {
  en: {
    title: 'Path of Progression', sub: 'The in-game Progress goals, track by track and stage by stage. Tick what is done: the guide shows what comes next.',
    next: 'Next task', allDone: 'Every stage of this track is done. Well played!', done: 'Done',
    stage: 'Stage {n}', stagesDone: '{d} / {n} stages', tasks: '{d} / {n}', chest: 'Stage reward', doStage: 'Tick the whole stage', undoStage: 'Untick the stage',
    reset: 'Untick this track', resetQ: 'Untick every task of {t}?', open: 'Open',
    saved: 'Saved to your account', local: 'Saved in this browser. Sign in to find it on another computer.', signIn: 'Sign in',
    hideDone: 'Hide finished stages', note: 'Task texts are the game’s English texts.', source: 'Data: tlidb.com',
    rTalent: '+1 talent point', rStar: 'Star Talent', rBuff: 'Path of Progression buff',
  },
  fr: {
    title: 'Path of Progression', sub: 'Les objectifs « Progress » du jeu, parcours par parcours et palier par palier. Coche ce qui est fait : le guide te montre la suite.',
    next: 'Prochaine tâche', allDone: 'Tous les paliers de ce parcours sont faits. Bien joué !', done: "C'est fait",
    stage: 'Palier {n}', stagesDone: '{d} / {n} paliers', tasks: '{d} / {n}', chest: 'Récompense du palier', doStage: 'Cocher tout le palier', undoStage: 'Décocher le palier',
    reset: 'Décocher ce parcours', resetQ: 'Décocher toutes les tâches de {t} ?', open: 'Ouvrir',
    saved: 'Enregistré sur ton compte', local: 'Enregistré dans ce navigateur. Connecte-toi pour le retrouver sur un autre ordinateur.', signIn: 'Se connecter',
    hideDone: 'Cacher les paliers finis', note: 'Les tâches sont écrites comme dans le jeu (en anglais).', source: 'Données : tlidb.com',
    rTalent: '+1 point de talent', rStar: 'Star Talent', rBuff: 'Bonus Path of Progression',
  },
};
const gt = (k, v) => String((G[LANG] || G.en)[k] ?? G.en[k] ?? k).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] != null ? v[n] : m));

const LOCAL = 'tlicGuide';
const TAB = 'tlicGuideTab';
const KNOWN = new Set(PROGRESSION.flatMap((tr) => tr.stages.flatMap((s) => s.tasks.map((x) => x.id))));
let done = {};
let signed = false;
let hideDone = false;
let tab = PROGRESSION[0].key;
const open = {}; // paliers finis ouverts à la main
try {
  hideDone = localStorage.getItem('tlicGuideHide') === '1';
  const t = (location.hash || '').slice(1) || localStorage.getItem(TAB);
  if (PROGRESSION.some((x) => x.key === t)) tab = t;
} catch { /* rien */ }

const call = async (method, url, body) => {
  const r = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || r.status), { status: r.status });
  return j;
};
// Seules les tâches connues sont gardées (les cases de l'ancien guide disparaissent).
const clean = (o) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => KNOWN.has(k)));
let timer = null;
function save() {
  done = clean(done);
  try { localStorage.setItem(LOCAL, JSON.stringify(done)); } catch { /* navigation privée */ }
  if (!signed) return;
  clearTimeout(timer);
  timer = setTimeout(() => call('PUT', '/api/me/progress', { progress: done }).catch(() => {}), 500);
}

const stageDone = (s) => s.tasks.every((x) => done[x.id]);
const reward = (r) => {
  if (!r) return '';
  const k = { talent: ['rTalent', 'talent'], star: ['rStar', 'star'], buff: ['rBuff', 'buff'] }[r];
  return k ? `<span class="gd-rew ${k[1]}">${esc(gt(k[0]))}</span>` : `<span class="gd-rew">${esc(r)}</span>`;
};

function render() {
  const track = PROGRESSION.find((x) => x.key === tab);
  const tasks = track.stages.flatMap((s) => s.tasks.map((x) => ({ ...x, stage: s.n })));
  const next = tasks.find((x) => !done[x.id]);
  const sd = track.stages.filter(stageDone).length;
  const nTasks = tasks.length, dTasks = tasks.filter((x) => done[x.id]).length;

  $('content').innerHTML = `<div class="pagehead"><h1>${esc(gt('title'))}</h1><p>${esc(gt('sub'))}</p></div>
    <nav class="gd-tracks">${PROGRESSION.map((x) => {
      const n = x.stages.length, d = x.stages.filter(stageDone).length;
      return `<button class="gd-track${x.key === tab ? ' on' : ''}${d === n ? ' full' : ''}" data-tab="${x.key}"><span>${esc(x.name)}</span><b>${d}/${n}</b></button>`;
    }).join('')}</nav>
    <div class="card gd-next">
      ${next ? `<span class="gd-next-k">${esc(gt('next'))} · ${esc(track.name)} · ${esc(gt('stage', { n: next.stage }))}</span><b>${esc(next.t)}</b> ${reward(next.r)}
        <div class="gd-next-a" style="margin-top:10px"><button class="btn primary" data-check="${next.id}">✓ ${esc(gt('done'))}</button>${next.l ? `<a class="btn" href="${esc(next.l)}">${esc(gt('open'))} →</a>` : ''}</div>`
        : `<b>🎉 ${esc(gt('allDone'))}</b>`}
      <div class="gd-bar"><span style="width:${(dTasks / nTasks) * 100}%"></span></div>
      <div class="gd-meta"><span class="muted small">${esc(track.name)} : ${esc(gt('stagesDone', { d: sd, n: track.stages.length }))} · ${esc(gt('note'))}</span>
        <span class="muted small">${signed ? esc(gt('saved')) : `${esc(gt('local'))} <a href="/auth/google?next=/guide">${esc(gt('signIn'))}</a>`}</span></div>
    </div>
    <div class="gd-tools"><label class="muted small"><input type="checkbox" id="gdHide"${hideDone ? ' checked' : ''}> ${esc(gt('hideDone'))}</label>
      <button class="btn" id="gdReset">${esc(gt('reset'))}</button></div>
    ${track.stages.map((s) => {
      const d = s.tasks.filter((x) => done[x.id]).length;
      const full = d === s.tasks.length;
      if (full && hideDone) return '';
      const isOpen = !full || open[`${tab}-${s.n}`];
      return `<div class="card gd-phase${full ? ' full' : ''}">
        <h2 data-toggle="${s.n}"${full ? ' style="cursor:pointer"' : ''}>${full ? '✓ ' : ''}${esc(gt('stage', { n: s.n }))} <span class="muted small">${esc(gt('tasks', { d, n: s.tasks.length }))}</span></h2>
        ${isOpen ? `${s.chest.length ? `<p class="muted small gd-chest">${esc(gt('chest'))} : ${s.chest.map(esc).join(' · ')}</p>` : ''}
        ${s.tasks.map((x) => `<label class="gd-step${done[x.id] ? ' done' : ''}${next && next.id === x.id ? ' is-next' : ''}">
          <input type="checkbox" data-step="${x.id}"${done[x.id] ? ' checked' : ''}>
          <span><b>${esc(x.t)}</b>${x.r ? `<span>${reward(x.r)}</span>` : ''}</span>
          ${x.l ? `<a href="${esc(x.l)}" class="gd-link" onclick="event.stopPropagation()">${esc(gt('open'))} →</a>` : ''}</label>`).join('')}
        <div class="gd-stage-a"><button class="btn" data-stage="${s.n}">${esc(gt(full ? 'undoStage' : 'doStage'))}</button></div>` : ''}
      </div>`;
    }).join('')}
    <p class="muted small">${esc(gt('source'))}</p>`;

  document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => {
    tab = b.dataset.tab;
    try { localStorage.setItem(TAB, tab); history.replaceState(null, '', '#' + tab); } catch { /* rien */ }
    render();
  }));
  document.querySelectorAll('[data-step]').forEach((c) => (c.onchange = () => { if (c.checked) done[c.dataset.step] = Date.now(); else delete done[c.dataset.step]; save(); render(); }));
  document.querySelectorAll('[data-check]').forEach((b) => (b.onclick = () => { done[b.dataset.check] = Date.now(); save(); render(); }));
  document.querySelectorAll('[data-stage]').forEach((b) => (b.onclick = () => {
    const s = track.stages.find((x) => x.n === +b.dataset.stage);
    const full = stageDone(s);
    for (const x of s.tasks) { if (full) delete done[x.id]; else done[x.id] ??= Date.now(); }
    save(); render();
  }));
  document.querySelectorAll('[data-toggle]').forEach((h) => (h.onclick = () => {
    const k = `${tab}-${h.dataset.toggle}`;
    const s = track.stages.find((x) => x.n === +h.dataset.toggle);
    if (!stageDone(s)) return;
    open[k] = !open[k]; render();
  }));
  $('gdHide').onchange = (e) => { hideDone = e.target.checked; try { localStorage.setItem('tlicGuideHide', hideDone ? '1' : '0'); } catch { /* rien */ } render(); };
  $('gdReset').onclick = () => {
    if (!confirm(gt('resetQ', { t: track.name }))) return;
    for (const x of tasks) delete done[x.id];
    save(); render();
  };
}

(async () => {
  document.title = `TLI Companion — ${gt('title')}`;
  try { done = clean(JSON.parse(localStorage.getItem(LOCAL) || '{}')); } catch { done = {}; }
  try {
    const r = await call('GET', '/api/me/progress');
    signed = true;
    const mine = clean(r.progress);
    const before = Object.keys(done).length;
    done = { ...done, ...mine };
    if (Object.keys(done).length > Object.keys(mine).length || before) save();
  } catch { signed = false; }
  render();
})();
