const id = location.pathname.split('/').pop();
$('content').innerHTML = `<div class="empty">${esc(t('loading'))}</div>`;

function stat(k, v, c = '') { return `<div><div class="k">${esc(t(k))}</div><div class="v ${c}">${v}</div></div>`; }

api('/api/reports/' + encodeURIComponent(id)).then(({ report: r, author, likes, dislikes, myVote }) => {
  const tot = r.totals;
  const heroName = r.hero ? (r.hero.display || r.hero.name) : '–';
  const title = r.title || (r.strategy.maps[0] && r.strategy.maps[0].name) || t('farmSession');
  document.title = `${title} — TLI Companion`;
  const mods = r.strategy.modifiers.filter((m) => m.desc);
  $('content').innerHTML = `
    <div class="card">
      <div class="title">${esc(title)}</div>
      <div class="muted" style="margin-bottom:14px">${esc(t('by'))} <b>${esc(author)}</b> · ${esc(heroName)} · ${new Date(r.startedAt).toLocaleDateString(LOCALE)}</div>
      <div class="stats">
        ${stat('perHourReal', fe(tot.perHourReal))}
        ${stat('perHourMap', fe(tot.perHourMap))}
        ${stat('profit', fe(tot.profit, true), cls(tot.profit))}
        ${stat('maps', tot.runs)}
        ${stat('duration', dur(tot.realMs))}
        ${stat('avgMap', fe(tot.avgPerMap, true), cls(tot.avgPerMap))}
        ${stat('durMap', dur(tot.avgMapMs))}
        ${stat('totalCost', fe(tot.cost), 'neg')}
      </div>
    </div>
    ${(r.lootPacts || []).length ? `<div class="card"><h2>${esc(t('lootPacts'))}</h2><div class="lp-chips" id="lpChips">${r.lootPacts.map((p) => `<span class="lp-chip" data-pact="${esc(p.name)}"><span>${esc(p.name)}${p.level ? ` <span class="muted">${esc(t('lpLevel', { n: p.level }))}</span>` : ''}</span></span>`).join('')}</div></div>` : ''}
    ${r.notes ? `<div class="card"><h2>${esc(t('explained'))}</h2><div class="notes">${esc(r.notes)}</div></div>` : ''}
    ${r.gameCode ? `<div class="card gcode"><h2>${esc(t('gcTitle'))}</h2><p class="muted">${esc(t('gcHelp'))}</p>
      <div class="gcode-row"><input id="gCode" readonly value="${esc(r.gameCode)}"><button class="btn primary" id="gCopy">${esc(t('gcCopy'))}</button></div></div>` : ''}
    <div class="cards">
      <div class="card"><h2>${esc(t('mapsPlayed'))}</h2><table><thead><tr><th>${esc(t('map'))}</th><th class="r">${esc(t('count'))}</th><th class="r">${esc(t('avgProfit'))}</th><th class="r">${esc(t('avgDuration'))}</th></tr></thead><tbody>
        ${r.strategy.maps.map((m) => `<tr><td>${esc(m.name)}${m.zones && Object.keys(m.zones).length ? `<br><span class="muted">${Object.entries(m.zones).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([z, n]) => esc(z) + (n > 1 ? ' ×' + n : '')).join(' · ')}</span>` : ''}</td><td class="r">${m.runs}</td><td class="r ${cls(m.profit)}">${fe(m.profit / m.runs, true)}</td><td class="r">${dur(m.durationMs / m.runs)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="card"><h2>${esc(t('toBuy'))}</h2><table><thead><tr><th>${esc(t('item'))}</th><th class="r">${esc(t('perMap'))}</th><th class="r">${esc(t('unit'))}</th><th class="r">${esc(t('cost'))}</th></tr></thead><tbody>
        ${r.strategy.consumables.map((c) => `<tr><td>${icon(c.img)}${esc(c.name)}</td><td class="r">${nf3.format(c.perMap)}</td><td class="r muted">${unit(c.unit)}</td><td class="r neg">${fe(-c.perMap * c.unit)}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">${esc(t('nothingToBuy'))}</td></tr>`}
      </tbody></table></div>
    </div>
    <div class="cards">
      <div class="card"><h2>${esc(t('modifiers'))}</h2>
        ${voidChartBlock(mods, r.voidChart)}${modGroupsHtml(mods.slice(0, 40), t('none'))}
      </tbody></table></div>
      <div class="card"><h2>${esc(t('bestDrops'))}</h2><table><thead><tr><th>${esc(t('item'))}</th><th class="r">${esc(t('qty'))}</th><th class="r">${esc(t('value'))}</th></tr></thead><tbody>
        ${r.loot.slice(0, 30).map((i) => `<tr><td>${icon(i.img)}${esc(i.name)}</td><td class="r">${qty(i.qty)}</td><td class="r ${cls(i.value)}">${fe(i.value, true)}</td></tr>`).join('')}
      </tbody></table></div>
    </div>`;
  hydrateVoidCharts($('content'));
  if ($('gCopy')) $('gCopy').onclick = async () => {
    try { await navigator.clipboard.writeText(r.gameCode); } catch { $('gCode').select(); document.execCommand('copy'); }
    $('gCopy').textContent = t('gcCopied');
  };
  // Votes et commentaires (bêta).
  const signIn = () => { location.href = `/auth/google?next=${encodeURIComponent(location.pathname)}`; };
  $('content').insertAdjacentHTML('afterbegin', '<div id="sVotes" style="float:right"></div>');
  Social.mountVotes($('sVotes'), 'report', id, { likes, dislikes, myVote }, { signIn });
  $('content').insertAdjacentHTML('beforeend', '<div class="card soc-card" id="sComments"></div>');
  Social.mountComments($('sComments'), 'report', id, { signIn });
}).catch((e) => { $('content').innerHTML = `<div class="empty">${esc(t('error', { msg: e.message }))}</div>`; });

// Icônes des pactes de loot (ajoutées après coup, la page s'affiche sans attendre).
(function pactIconsOnRoute() {
  const tryAdd = () => {
    const chips = document.querySelectorAll('#lpChips [data-pact]');
    if (!chips.length) return false;
    api('/extra_icons.json').then((j) => {
      const icons = j.icons || j;
      chips.forEach((c) => {
        const url = icons[c.dataset.pact];
        if (url && !c.querySelector('img')) c.insertAdjacentHTML('afterbegin', `<img src="${esc(url.replace(/^https:\/\/tlicompanion\.com/, ''))}" alt="" loading="lazy">`);
      });
    }).catch(() => {});
    return true;
  };
  if (!tryAdd()) { const mo = new MutationObserver(() => { if (tryAdd()) mo.disconnect(); }); mo.observe(document.body, { childList: true, subtree: true }); }
})();
