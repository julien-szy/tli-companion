// Fiche d'un joueur du classement (façon tliherorank) : partagée par l'onglet Méta et l'Accueil.
// p = joueur renvoyé par tli.metaPlayers (compétences, talents, arbres, légendaires, pactes avec noms/icônes).
const Profile = (() => {
  const named = (x) => (x && x.name ? x : null);
  const chip = (x) => `<span class="pchip">${x.img ? `<img src="${esc(x.img)}" alt="">` : ''}${esc(x.name)}</span>`;
  const bigN = (n) => (n >= 1e6 ? nf1.format(n / 1e6) + 'M' : n >= 1e3 ? nf1.format(n / 1e3) + 'k' : nf0.format(n));

  function html(p, heroLabel, portraitHtml) {
    const main = p.active[0];
    const row = (label, list) => (list.length ? `<div class="prow"><div class="plabel">${esc(label)}</div><div class="pitems">${list.map(chip).join('')}</div></div>` : '');
    const skills = [...p.active, ...p.passive];
    return `<div class="profile">
      <div class="phead">
        ${portraitHtml || ''}
        <div>
          <div class="pname">${p.name ? esc(p.name) : `<span class="muted">${esc(t('m.hiddenPlayer'))}</span>`}</div>
          ${main ? `<div class="pmain">${main.img ? `<img src="${esc(main.img)}" alt="">` : ''}${esc(main.name)}</div>` : ''}
          <div class="muted">${esc(heroLabel || '')} · ${esc(t('m.level'))} ${p.level} · <b style="color:var(--text)">${bigN(p.dps)} DPS</b>${p.server ? ' · ' + esc(p.server) : ''}</div>
        </div>
      </div>
      ${skills.length ? `<div class="pcard"><h3>${esc(t('m.skills'))}</h3>${skills.map((sk) => `
        <div class="pskill">
          <div class="pskmain">${sk.img ? `<img src="${esc(sk.img)}" alt="">` : ''}<b>${esc(sk.name)}</b></div>
          <div class="pitems">${sk.supports.map(chip).join('') || '<span class="muted">–</span>'}</div>
        </div>`).join('')}</div>` : `<p class="muted">${esc(t('m.noBuildVisible'))}</p>`}
      <div class="pcard">
        ${row(t('m.talents'), (p.talents || []).filter(named))}
        ${row(t('m.boards'), (p.boards || []).filter(named))}
        ${row(t('m.legendaries'), (p.uniques || []).filter(named))}
        ${row(t('m.pacts'), (p.servants || []).filter(named))}
      </div>
    </div>`;
  }
  return { html };
})();
