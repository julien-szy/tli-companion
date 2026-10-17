document.title = `TLI Companion — ${t('buildsTitle')}`;
$('rows').innerHTML = `<tr><td colspan="5" class="empty">${esc(t('loading'))}</td></tr>`;

async function load() {
  const list = await heroes();
  const hero = $('hero').value;
  history.replaceState(null, '', hero ? `?hero=${encodeURIComponent(hero)}` : '/builds');
  const { builds } = await api('/api/builds' + (hero ? `?hero=${encodeURIComponent(hero)}` : ''));
  const byKey = Object.fromEntries(list.map((h) => [h.key, h]));
  $('rows').innerHTML = builds.map((b) => `<tr class="click" data-id="${esc(b.id)}">
      <td><b>${esc(b.title)}</b></td>
      <td>${portrait(byKey[b.hero_key])}${esc(heroLabel(byKey[b.hero_key]))}</td>
      <td class="hide-sm muted">${esc(b.author)}</td><td class="r">${b.steps}</td>
      <td class="r hide-sm muted">${new Date(b.updated_at).toLocaleDateString(LOCALE)}</td></tr>`).join('')
    || `<tr><td colspan="5" class="empty">${esc(t('buildsEmpty'))}</td></tr>`;
  document.querySelectorAll('tr.click').forEach((tr) => (tr.onclick = () => (location.href = '/b/' + tr.dataset.id)));
}

heroes().then((list) => {
  const want = new URLSearchParams(location.search).get('hero') || '';
  $('hero').innerHTML = `<option value="">${esc(t('allClasses'))}</option>` +
    list.map((h) => `<option value="${esc(h.key)}" ${h.key === want ? 'selected' : ''}>${esc(heroLabel(h))}</option>`).join('');
  $('hero').onchange = load;
  return load();
}).catch((e) => { $('rows').innerHTML = `<tr><td colspan="5" class="empty">${esc(t('error', { msg: e.message }))}</td></tr>`; });
