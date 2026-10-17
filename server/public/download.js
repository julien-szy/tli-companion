document.title = `TLI Companion — ${t('navDownload')}`;
api('/api/version').then((v) => {
  if (!v || !v.version) {
    $('dl').classList.remove('primary');
    $('dl').removeAttribute('href');
    $('ver').textContent = t('dlPortable');
    return;
  }
  $('ver').textContent = t('versionInfo', { v: v.version, size: `${Math.round(v.size / 1048576)} MB` }) + (v.date ? ` · ${new Date(v.date).toLocaleDateString(LOCALE)}` : '');
  if (v.sha256) $('sha').textContent = `${t('sha')} : ${v.sha256}`;
}).catch(() => { $('ver').textContent = t('dlPortable'); });

// Notes de version (seulement les versions publiées).
api('/changelog.json').then((log) => {
  $('pnList').innerHTML = log.releases.slice(0, 10).map((r) => `<div class="card"><h3>v${esc(r.version)} <span class="muted">· ${esc(new Date(r.date + 'T12:00:00').toLocaleDateString(LOCALE))}</span></h3>
    <ul>${(r[LANG] || r.en).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('');
}).catch(() => { $('patch-notes').hidden = true; });
