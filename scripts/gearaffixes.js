// Table des affixes d'équipement (numéro du jeu -> texte), tirée des pages de tlidb.com. Les numéros sont ceux
// que le jeu écrit dans son log à la connexion (Prefix / Suffix / BaseAttrAffix… de chaque pièce portée).
// Résultat : data/gear_affixes.json, embarqué dans l'app (aucun accès à tlidb pendant que l'app tourne).
// À relancer à chaque saison : node scripts/gearaffixes.js
const fs = require('fs');
const path = require('path');

const BASE = 'https://tlidb.com/en/';
const OUT = path.join(__dirname, '..', 'data', 'gear_affixes.json');
const UA = { 'User-Agent': 'Mozilla/5.0 (TLI Companion data build)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(page) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + page, { headers: UA });
      if (r.ok) return await r.text();
      if (r.status === 404) return '';
    } catch { /* nouvel essai */ }
    await sleep(1500);
  }
  return '';
}
const links = (html) => [...new Set([...html.matchAll(/href="([^"#?:/][^"#?]*)"/g)].map((m) => m[1]))];

const ENT = { '&ndash;': '–', '&mdash;': '—', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };
const clean = (h) => h.replace(/<br\s*\/?>/gi, ' / ').replace(/<[^>]+>/g, ' ')
  .replace(/&[a-z#0-9]+;/gi, (e) => ENT[e] || e).replace(/\s+/g, ' ').replace(/\s+([%,.)])/g, '$1').replace(/\(\s+/g, '(').trim();

// Contenu d'un <span data-modifier-id="…"> jusqu'à sa balise fermante (les span imbriqués comptés).
function extract(html, table) {
  let n = 0;
  for (const m of html.matchAll(/<span data-modifier-id="(\d+)">/g)) {
    let i = m.index + m[0].length, depth = 1;
    const start = i;
    while (depth && i < html.length) {
      const o = html.indexOf('<span', i), c = html.indexOf('</span>', i);
      if (c < 0) break;
      if (o >= 0 && o < c) { depth++; i = o + 5; } else { depth--; i = c + 7; }
    }
    const text = clean(html.slice(start, i - 7));
    if (!text || text.length > 400) continue;
    // Palier (tier) : la ligne de tableau qui contient l'affixe, s'il y en a une juste avant.
    const before = html.slice(Math.max(0, m.index - 400), m.index);
    const tr = before.lastIndexOf('<tr');
    const tier = tr >= 0 && before.indexOf('</tr>', tr) < 0 ? /^<tr[^>]*data-tier="([^"]+)"/.exec(before.slice(tr)) : null;
    const id = m[1];
    if (!table[id] || text.length > table[id].t.length) { table[id] = { t: text }; if (tier) table[id].tier = tier[1]; n++; }
  }
  return n;
}

(async () => {
  const table = {};
  const done = new Set();
  const queue = [];
  // Types d'équipement (page Inventaire) et légendaires (page Legendary Gear).
  for (const root of ['Inventory', 'Legendary_Gear']) {
    const html = await get(root);
    extract(html, table);
    done.add(root);
    for (const l of links(html)) if (!done.has(l)) { done.add(l); queue.push(l); }
  }
  console.log(`${queue.length} pages à lire`);
  let i = 0, read = 0;
  const worker = async () => {
    while (i < queue.length) {
      const page = queue[i++];
      const html = await get(page);
      if (html) { extract(html, table); read++; }
      if (read % 50 === 0) console.log(`${read} / ${queue.length} pages, ${Object.keys(table).length} affixes`);
      await sleep(150);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  const sorted = Object.fromEntries(Object.keys(table).sort((a, b) => a - b).map((k) => [k, table[k]]));
  fs.writeFileSync(OUT, JSON.stringify({ source: 'tlidb.com', builtAt: new Date().toISOString().slice(0, 10), affixes: sorted }));
  console.log(`${Object.keys(sorted).length} affixes -> ${OUT}`);
})();
