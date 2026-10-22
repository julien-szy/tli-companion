// Pages légales : affiche la version dans la langue du site.
document.querySelectorAll('[data-l]').forEach((el) => { el.style.display = el.dataset.l === (LANG === 'fr' ? 'fr' : 'en') ? 'block' : 'none'; });
