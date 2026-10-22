// Récupère le Void Chart de la saison depuis tlidb.com (une page par constellation) et écrit
// server/public/voidchart.json : constellations, nœuds (position, taille, icône, effets) et liens.
// Données et icônes : tlidb.com (crédité sur le site). À relancer à chaque nouvelle saison :
//   node scripts/voidchart.js
const fs = require('fs');
const path = require('path');

const BASE = 'https://tlidb.com/en/';
const UA = { 'User-Agent': 'TLI Companion (tlicompanion.com) - Void Chart sync' };
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
const text = (h) => decode(h).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function get(url) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (i >= 4) throw e;
      await new Promise((r) => setTimeout(r, 2000 * i)); // réseau capricieux : on réessaie doucement
    }
  }
}

function parseConstellation(slug, html) {
  const svg = html.slice(html.indexOf('<svg id="passive_skill_tree"'), html.indexOf('</svg>', html.indexOf('<svg id="passive_skill_tree"')));
  const links = [...svg.matchAll(/data-link-id="(\d+)-(\d+)"/g)].map((m) => [+m[1], +m[2]]);
  const nodes = [];
  for (const m of svg.matchAll(/<image data-node-id="(\d+)" x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="\d+" xlink:href="([^"]+)"[^>]*data-bs-title="([^"]*)"/g)) {
    const tip = decode(m[6]);
    const name = text((/sp-node-name[^>]*>([\s\S]*?)<\/div>/.exec(tip) || [])[1] || '');
    // Effets du nœud : modificateurs de carte et de fonction (une ligne chacun).
    const effects = [...tip.matchAll(/data-src="(?:map|function)_modifier"><div>([\s\S]*?)<\/div><\/div>/g)]
      .flatMap((x) => x[1].split(/<\/div>\s*<div>|<br\s*\/?>/)).map(text).filter(Boolean);
    const size = +m[4];
    nodes.push({ id: +m[1], x: +m[2] + size / 2, y: +m[3] + size / 2, r: size / 2, icon: m[5], name, effects });
  }
  const title = text((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html) || [])[1] || slug.replace(/_Talent_Constellation$/, '').replace(/_/g, ' '));
  return { slug, name: title.replace(/\s*Talent Constellation$/i, ''), nodes, links };
}

(async () => {
  const index = await get(BASE + 'Void_Chart');
  const slugs = [...new Set([...index.matchAll(/href="([A-Za-z_]+_Talent_Constellation)"/g)].map((m) => m[1]))];
  const out = { source: 'tlidb.com', fetchedAt: new Date().toISOString(), constellations: [] };
  for (const slug of slugs) {
    const c = parseConstellation(slug, await get(BASE + slug));
    out.constellations.push(c);
    console.log(`${c.name.padEnd(22)} ${c.nodes.length} nœuds, ${c.links.length} liens`);
    await new Promise((r) => setTimeout(r, 400)); // pas de rafale sur tlidb
  }
  const file = path.join(__dirname, '..', 'server', 'public', 'voidchart.json');
  fs.writeFileSync(file, JSON.stringify(out));
  console.log('écrit', file, Math.round(fs.statSync(file).size / 1024), 'Ko');
})().catch((e) => { console.error(e.message); process.exit(1); });
