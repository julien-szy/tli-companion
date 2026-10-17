document.title = t('homeTitle');
for (const [id, key] of [['sc1', 'showcase1l'], ['sc2', 'showcase2l']]) {
  $(id).innerHTML = t(key).map((x) => `<li>${esc(x)}</li>`).join('');
}
const mb = (b) => `${Math.round(b / 1048576)} MB`;

// Version publiée : bouton de téléchargement direct.
api('/api/version').then((v) => {
  if (v && v.version) {
    $('verInfo').textContent = t('versionInfo', { v: v.version, size: mb(v.size) });
    $('dlBtn').href = '/download/latest';
  } else $('verInfo').textContent = t('versionSoon');
}).catch(() => { $('verInfo').textContent = t('versionSoon'); });

// Chiffres de la communauté
api('/api/stats').then((s) => { $('nSessions').textContent = nf0.format(s.totals.reports); }).catch(() => {});
api('/api/builds?limit=100').then((b) => { $('nBuilds').textContent = nf0.format(b.builds.length) + (b.builds.length >= 100 ? '+' : ''); }).catch(() => {});
api('/api/meta/index').then(({ snapshots }) => {
  const total = snapshots.filter((x) => x.server !== 'global').reduce((a, x) => a + x.total, 0);
  $('nPlayers').textContent = total ? nf0.format(total) : '–';
}).catch(() => {});
