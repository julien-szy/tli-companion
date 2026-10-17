const id = location.pathname.split('/').pop();
$('content').innerHTML = `<div class="empty">${esc(t('loading'))}</div>`;

Promise.all([api('/api/builds/' + encodeURIComponent(id)), heroes()]).then(([{ build: b, author, updatedAt }, list]) => {
  const h = list.find((x) => x.key === b.heroKey);
  document.title = `${b.title} — TLI Companion`;
  $('content').innerHTML = `
    <div class="card">
      <div style="display:flex;gap:12px;align-items:center">
        ${portrait(h, 56)}
        <div><div class="title">${esc(b.title)}</div>
          <div class="muted">${esc(heroLabel(h))} · ${esc(t('by'))} <b>${esc(author)}</b> · ${new Date(updatedAt).toLocaleDateString(LOCALE)}
          ${h ? ` · <a href="${esc(h.url)}" rel="noopener" target="_blank">${esc(t('seeTlidb'))}</a>` : ''}</div></div>
      </div>
      ${b.description ? `<div class="notes" style="margin-top:14px">${esc(b.description)}</div>` : ''}
      <p class="muted" style="margin-top:14px">${esc(t('getApp'))}</p>
    </div>
    ${b.steps.map((s, i) => `
      <div class="card">
        <h2>${esc(t('step', { n: i + 1 }))} · ${esc(s.title)}</h2>
        ${s.notes ? `<div class="notes muted" style="margin-bottom:10px">${esc(s.notes)}</div>` : ''}
        <table><thead><tr><th>${esc(t('item'))}</th><th class="r">${esc(t('needed'))}</th><th></th></tr></thead><tbody>
          ${s.items.map((it) => `<tr><td>${icon(it.img)}${esc(it.name || '#' + it.id)}${it.note ? `<br><span class="muted">${esc(it.note)}</span>` : ''}</td>
            <td class="r">${it.qty}</td><td class="r">${it.priority === 'optional' ? `<span class="tagx">${esc(t('optional'))}</span>` : ''}</td></tr>`).join('')}
        </tbody></table>
      </div>`).join('')}`;
}).catch((e) => { $('content').innerHTML = `<div class="empty">${esc(t('error', { msg: e.message }))}</div>`; });
