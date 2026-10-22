// Récupère depuis tlidb.com ce qu'il faut au planificateur de builds : héros (traits par niveau),
// arbres de talents (dieux + professions : grille, nœuds, talents principaux) et listes de compétences.
// Écrit data/builddata.json (app) et server/public/builddata.json (site). Données : tlidb.com (crédité).
// À relancer à chaque nouvelle saison :  node scripts/buildsdata.js
const fs = require('fs');
const path = require('path');

const BASE = 'https://tlidb.com/en/';
const UA = { 'User-Agent': 'TLI Companion (tlicompanion.com) - build planner sync' };
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
const text = (h) => decode(String(h || '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\s+([%,.)])/g, '$1').replace(/([(+])\s+/g, '$1').trim();
const lines = (h) => decode(String(h || '')).split(/<br\s*\/?>|<\/div>\s*<div[^>]*>/).map(text).filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(slug) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(BASE + slug, { headers: UA, signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`${slug} : HTTP ${res.status}`);
      const html = await res.text();
      await sleep(400); // pas de rafale sur tlidb
      return html;
    } catch (e) {
      if (i >= 4) throw e;
      await sleep(2000 * i);
    }
  }
}

// Arbre de talents : grille de 7 colonnes (0, 3, 6… 18 points investis dans l'arbre) sur 5 lignes,
// plus les talents principaux (en haut, un choix par palier de points).
function parseTree(slug, html) {
  const i = html.indexOf('<svg');
  const svg = html.slice(i, html.indexOf('</svg>', i));
  const texts = [...svg.matchAll(/<text x="(-?\d+)" y="(-?\d+)"[^>]*class="(\w+)">([^<]*)/g)].map((m) => ({ x: +m[1], y: +m[2], cls: m[3], v: m[4].trim() }));
  const colPts = texts.filter((t) => t.cls === 'points').map((t) => ({ x: t.x, pts: +t.v })).sort((a, b) => a.x - b.x);
  const coreGates = texts.filter((t) => t.cls === 'level_up_time' && t.y < 0).map((t) => ({ x: t.x, pts: +t.v })).sort((a, b) => a.x - b.x);
  const maxAt = new Map(texts.filter((t) => t.cls === 'level_up_time' && t.y > 0).map((t) => [`${t.x},${t.y}`, +t.v]));
  const core = [];
  const nodes = [];
  for (const m of svg.matchAll(/<image x="(-?\d+)" y="(-?\d+)" width="(\d+)"[^>]*xlink:href="([^"]+)"[^>]*data-bs-title="([^"]*)"/g)) {
    const x = +m[1], y = +m[2], tip = decode(m[5]);
    const name = text((/sp-node-name[^>]*>([\s\S]*?)<\/div>/.exec(tip) || [])[1]);
    const body = tip.replace(/^[\s\S]*?sp-node-name[^>]*>[\s\S]*?<\/div>/, '');
    const effects = lines(body.replace(/\(Max Active Divinity[^)]*\)/, ''));
    if (y < 0) {
      // Talent principal : rattaché au palier dont le libellé est à sa gauche.
      const gate = [...coreGates].reverse().find((g) => g.x <= x + 40) || coreGates[0] || { pts: 0 };
      core.push({ id: `c${core.length}`, name, icon: m[4], effects, pts: gate.pts });
    } else {
      const cx = x + 32, cy = y + 32;
      const col = colPts.findIndex((c) => Math.abs(c.x - cx) < 40);
      const row = Math.round((y - 48) / 96);
      nodes.push({ id: `${col}-${row}`, col, row, pts: col >= 0 ? colPts[col].pts : 0, max: maxAt.get(`${cx + 22},${cy + 26}`) || 1,
        name, icon: m[4], effects, kind: /legendary/i.test(name) ? 'legendary' : /medium/i.test(name) ? 'medium' : 'micro', ix: x, iy: y });
    }
  }
  // Liens : un trait va du bord gauche d'un nœud au bord droit du précédent (le nœud de droite demande celui de gauche).
  for (const m of svg.matchAll(/<line x1="(\d+)" y1="(\d+)" x2="(\d+)" y2="(\d+)"/g)) {
    const to = nodes.find((n) => n.ix === +m[1] && Math.abs(n.iy + 32 - +m[2]) < 8);
    const from = nodes.find((n) => n.ix + 64 === +m[3] && Math.abs(n.iy + 32 - +m[2]) < 8);
    if (from && to) to.req = from.id;
  }
  for (const n of nodes) { delete n.ix; delete n.iy; }
  return { core, nodes };
}

function parseTraits(html) {
  const out = [];
  const parts = html.split(/<div class="fw-bold" data-id="/).slice(1);
  for (const p of parts) {
    const id = +p.slice(0, p.indexOf('"'));
    const name = text(p.slice(p.indexOf('>') + 1, p.indexOf('</div>')));
    const lv = +((/Require lv (\d+)/.exec(p) || [])[1] || 1);
    const icon = (/src="([^"]+)"/.exec(html.slice(Math.max(0, html.indexOf(`data-id="${id}"`) - 600), html.indexOf(`data-id="${id}"`))) || [])[1] || '';
    // Effet au palier le plus haut quand le trait a des paliers, sinon le texte sous le trait.
    const end = p.search(/<div class="col">|<\/main>|<footer/);
    let body = p.slice(0, end > 0 ? end : 4000);
    const tiers = [...body.matchAll(/data-tier-content="(\d+)"[^>]*>([\s\S]*?)(?=<div[^>]*data-tier-content=|$)/g)];
    if (tiers.length) body = tiers[tiers.length - 1][2];
    else body = body.slice(body.indexOf('<hr'));
    const eff = lines(body.replace(/<hr[^>]*>/g, '<br>').replace(/Level \d+/g, '')).filter((l) => !/^Require lv/.test(l)).slice(0, 12);
    out.push({ id, name, lv, icon, effects: eff });
  }
  return out;
}

function parseSkills(html, kind) {
  const out = [];
  for (const m of html.matchAll(/<div class="flex-shrink-0"><a [^>]*href="([^"]+)"><img src="([^"]+)"[^>]*><\/a><\/div><div class="flex-grow-1 mx-2 my-1"><a [^>]*>([^<]+)<\/a><div>([\s\S]*?)<\/div><\/div>/g)) {
    const tags = [...m[4].matchAll(/data-filter="([^"]+)"/g)].map((x) => decode(x[1]));
    out.push({ slug: m[1], name: decode(m[3]).trim(), icon: m[2], tags, kind });
  }
  return out;
}

if (process.argv[2] === '--test') {
  const t = parseTree('x', fs.readFileSync(process.argv[3], 'utf8'));
  console.log(JSON.stringify(t, null, 1).slice(0, 3000), t.nodes.filter((n) => n.req).length);
  process.exit(0);
}
// Relie chaque compétence à l'objet de notre base (même nom) : prix et « possédée » dans l'app.
function linkItems(out) {
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'items_seed_en.json'), 'utf8'));
  const list = Array.isArray(seed) ? seed : Object.entries(seed.items || seed).map(([id, v]) => ({ id, ...v }));
  const byName = new Map(list.map((x) => [String(x.name_en || x.name || '').toLowerCase(), +x.id]));
  for (const s of out.skills) { const id = byName.get(s.name.toLowerCase()); if (id) s.itemId = id; }
}
if (process.argv[2] === '--link') {
  const out = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'builddata.json'), 'utf8'));
  linkItems(out);
  const json = JSON.stringify(out);
  for (const f of [path.join(__dirname, '..', 'data', 'builddata.json'), path.join(__dirname, '..', 'server', 'public', 'builddata.json')]) fs.writeFileSync(f, json);
  console.log('relié', out.skills.filter((x) => x.itemId).length, '/', out.skills.length);
  process.exit(0);
}
(async () => {
  const out = { source: 'tlidb.com', fetchedAt: new Date().toISOString(), heroes: [], trees: [], skills: [] };

  // Arbres : 6 dieux puis les professions.
  const talent = await get('Talent');
  // La liste des professions suit le champ de recherche (le haut de page répète les onglets).
  const from = talent.indexOf('filterClick', talent.indexOf('rightside_banner'));
  const blk = talent.slice(from, talent.indexOf('Core Talent Node /', from));
  for (const m of blk.matchAll(/<img src="([^"]+)"[^>]*\/><\/div><div class="flex-grow-1 mx-2 my-1"><a href="([A-Za-z_]+)">([^<]+)<\/a><br\/>([\s\S]*?)<\/div><\/div><\/div>/g)) {
    const info = text(m[4].replace(/<br\/>/g, ' | '));
    const god = /Main Stats/.test(info);
    const tags = ((/Tags:\s*([^|]+)/.exec(info) || [])[1] || '').split(',').map((x) => x.trim()).filter(Boolean);
    const parent = god ? null : ((/(?:Servant of|^)\s*((?:God|Goddess) of \w+)/.exec(info) || [])[1] || null);
    const tree = { slug: m[2], name: decode(m[3]).trim(), god, parent, tags, icon: m[1], ...parseTree(m[2], await get(m[2])) };
    out.trees.push(tree);
    console.log(`${tree.name.padEnd(22)} ${tree.nodes.length} nœuds, ${tree.core.length} principaux${parent ? ' (' + parent + ')' : ''}`);
  }

  // Héros : un trait au choix par niveau requis.
  const hero = await get('Hero');
  const hb = hero.slice(hero.indexOf('Hero /'));
  for (const m of hb.matchAll(/<a href="([A-Za-z_\-']+)"[^>]*>([^<]*\|[^<]*)<\/a>/g)) {
    const [who, trait] = decode(m[2]).split('|').map((x) => x.trim());
    const h = { slug: m[1], name: trait, hero: who.replace(/:$/, ''), traits: parseTraits(await get(m[1])) };
    out.heroes.push(h);
    console.log(`${(h.hero + ' | ' + h.name).padEnd(40)} ${h.traits.length} traits`);
  }

  // Compétences.
  for (const [page, kind] of [['Active_Skill', 'active'], ['Support_Skill', 'support'], ['Passive_Skill', 'passive']]) {
    const list = parseSkills(await get(page), kind);
    out.skills.push(...list);
    console.log(`${page.padEnd(22)} ${list.length}`);
  }

  linkItems(out);
  const json = JSON.stringify(out);
  for (const f of [path.join(__dirname, '..', 'data', 'builddata.json'), path.join(__dirname, '..', 'server', 'public', 'builddata.json')]) fs.writeFileSync(f, json);
  console.log('écrit builddata.json', Math.round(json.length / 1024), 'Ko');
})().catch((e) => { console.error(e.message); process.exit(1); });
