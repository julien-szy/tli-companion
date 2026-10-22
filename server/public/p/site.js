// Ce qu'attend le planificateur de l'app (tli.*, modal, traductions), en version site.
// Chargé après /common.js et /p/i18n.js, avant /p/tip.js, /p/talents.js et /p/planner.js.
(() => {
  // Traductions : celles du site d'abord, sinon celles de l'app (planificateur, conseiller…).
  const appT = I18N.make(LANG);
  const siteT = t;
  window.t = (k, v) => (STR.en[k] != null ? siteT(k, v) : appT(k, v));

  let prices = null;
  const allPrices = () => prices || (prices = fetch('/api/prices').then((r) => r.json()).then((j) => j.prices || {}).catch(() => ({})));
  const json = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
  let bd = null;
  let gd = null;
  window.tli = {
    buildData: () => bd || (bd = json('/builddata.json')),
    gearData: () => gd || (gd = json('/geardata.json')),
    itemPrice: async (id) => { const p = (await allPrices())[id]; return p ? p.price : null; },
    searchItems: async () => [],
    openExternal: (url) => { if (/^https:\/\/tlidb\.com\//.test(url)) window.open(url, '_blank', 'noopener'); },
  };

  // Fenêtre par-dessus la page (même balisage que l'app).
  window.modal = (html) => {
    let box = document.getElementById('appModal');
    if (!box) { box = document.createElement('div'); box.id = 'appModal'; document.body.appendChild(box); }
    box.innerHTML = html ? `<div class="modal-bg"><div class="modal">${html}</div></div>` : '';
    document.body.style.overflow = html ? 'hidden' : '';
    return box;
  };
  window.errMsg = (e) => String((e && e.message) || e || '');
})();
