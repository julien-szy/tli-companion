// Partie Build en travaux : encart « Bientôt disponible » à la place de la page.
document.title = `TLI Companion — ${t('navBuilds')}`;
$('content').innerHTML = `<div class="soon-box">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20M5 20l3-12h8l3 12"/><path d="M6.5 14h11M7.6 10h8.8"/><path d="M12 2v3M9 4l1 2M15 4l-1 2"/></svg>
  <span class="soon-badge">${esc(t('soonBadge'))}</span>
  <h2>${esc(t('buildsSoonTitle'))}</h2>
  <p>${esc(t('buildsSoonText'))}</p>
  <a class="btn primary" href="/meta">${esc(t('seeMeta'))}</a>
</div>`;
