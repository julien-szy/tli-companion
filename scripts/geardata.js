// Récupère depuis tlidb.com l'équipement pour le planificateur de builds : pour chaque type d'objet
// (Casque FOR, Anneau, Arme…) les bases et leur stat implicite, les légendaires et leurs stats, et les
// affixes craftables (préfixes / suffixes, par palier). Écrit data/geardata.json (app) et
// server/public/geardata.json (site). Données : tlidb.com (crédité). À relancer à chaque saison :
//   node scripts/geardata.js
const fs = require('fs');
const path = require('path');

const BASE = 'https://tlidb.com/en/';
const UA = { 'User-Agent': 'TLI Companion (tlicompanion.com) - build planner sync' };
const decode = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&ndash;/g, '–').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
const text = (h) => decode(String(h || '')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\s+([%,.)])/g, '$1').replace(/([(+])\s+/g, '$1').trim();
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

// Emplacements du planificateur -> types d'objets tlidb.
const ONE_HANDED = ['Claw', 'Dagger', 'One-Handed_Sword', 'One-Handed_Hammer', 'One-Handed_Axe', 'Wand', 'Rod', 'Scepter', 'Cane', 'Pistol'];
const TWO_HANDED = ['Two-Handed_Sword', 'Two-Handed_Hammer', 'Two-Handed_Axe', 'Tin_Staff', 'Cudgel', 'Bow', 'Crossbow', 'Musket', 'Fire_Cannon'];
const SHIELDS = ['STR_Shield', 'DEX_Shield', 'INT_Shield'];
const SLOTS = {
  helmet: ['STR_Helmet', 'DEX_Helmet', 'INT_Helmet', 'Vorax_Limb_Head'],
  chest: ['STR_Chest_Armor', 'DEX_Chest_Armor', 'INT_Chest_Armor', 'Vorax_Limb_Chest'],
  necklace: ['Necklace', 'Vorax_Limb_Neck'],
  gloves: ['STR_Gloves', 'DEX_Gloves', 'INT_Gloves', 'Vorax_Limb_Hands'],
  belt: ['Belt', 'Vorax_Limb_Waist', 'Vorax_Aberrant_Limb_Waist'],
  boots: ['STR_Boots', 'DEX_Boots', 'INT_Boots', 'Vorax_Limb_Legs', 'Vorax_Aberrant_Limb_Legs'],
  ring1: ['Ring', 'Spirit_Ring', 'Vorax_Limb_Digits', 'Vorax_Aberrant_Limb_Digits'],
  ring2: ['Ring', 'Spirit_Ring', 'Vorax_Limb_Digits', 'Vorax_Aberrant_Limb_Digits'],
  weapon1: [...ONE_HANDED, ...TWO_HANDED],
  weapon2: [...ONE_HANDED, ...SHIELDS],
};

// Bloc d'un onglet de la page : de son id jusqu'à l'onglet suivant.
function tab(html, id) {
  const i = html.indexOf(`id="${id}"`);
  if (i < 0) return '';
  const j = html.indexOf('class="tab-pane', html.indexOf('>', i)); // l'onglet suivant, pas le sien
  return html.slice(i, j > 0 ? j : undefined);
}
// Fiches d'objets d'un onglet (bases ou légendaires) : icône, nom, niveau requis, lignes de stats.
function cards(block) {
  const out = [];
  const parts = block.split('<div class="col"><div class="d-flex border-top rounded">').slice(1);
  for (const p of parts) {
    const icon = (/<img src="([^"]+)"/.exec(p) || [])[1] || '';
    const name = text((/<a [^>]*href="[^"]+"[^>]*>([^<]+)<\/a>/.exec(p.slice(p.indexOf('flex-grow-1'))) || [])[1]);
    const lv = +((/Require lv (\d+)/.exec(p) || [])[1] || 1);
    // Une ligne par modificateur (span data-modifier-id), sinon par <div> de stats.
    const lines = [...p.matchAll(/<span data-modifier-id="\d+">([\s\S]*?)<\/span><\/div>/g)].map((m) => text(m[1])).filter(Boolean);
    if (name) out.push({ name, icon, lv, stats: lines });
  }
  return out;
}
// Affixes craftables : familles de modificateurs (id sans les 2 derniers chiffres) avec un palier par ligne.
function craft(block) {
  const out = { prefix: [], suffix: [] };
  for (const [kind, cap] of [['prefix', 'Pre-fix'], ['suffix', 'Suffix']]) {
    const i = block.indexOf(`caption-side: top">${cap}`);
    if (i < 0) continue;
    const tbl = block.slice(i, block.indexOf('</table>', i));
    const fam = new Map();
    for (const m of tbl.matchAll(/<tr data-tier="([^"]+)">[\s\S]*?<span data-modifier-id="(\d+)">([\s\S]*?)<\/span>\s*<td>(\d+)/g)) {
      const id = Math.floor(+m[2] / 100);
      const html = m[3];
      // Gabarit : les valeurs (text-mod) deviennent {0}, {1}… ; chaque palier garde ses valeurs.
      const vals = [...html.matchAll(/<span class="text-mod">([\s\S]*?)<\/span>/g)].map((x) => text(x[1]));
      let k = 0;
      const tpl = text(html.replace(/<span class="text-mod">[\s\S]*?<\/span>/g, () => `{${k++}}`));
      if (!fam.has(id)) fam.set(id, { id, tpl, tiers: [] });
      fam.get(id).tiers.push([m[1], vals, +m[4]]);
    }
    out[kind] = [...fam.values()];
  }
  return out;
}

if (process.argv[2] === '--test') {
  const html = fs.readFileSync(process.argv[3], 'utf8');
  const tabs = [...html.matchAll(/href="#([A-Za-z-]+)"[^>]*>([^<]+)</g)].map((m) => m[1]);
  const c = craft(tab(html, tabs.find((x) => /Craft$/.test(x))));
  console.log(tabs, JSON.stringify(cards(tab(html, tabs[0])).slice(0, 2)), JSON.stringify(cards(tab(html, 'LegendaryGear')).slice(6, 7)), c.prefix.length, c.suffix.length, JSON.stringify(c.prefix[0]), JSON.stringify(c.suffix[3]));
  process.exit(0);
}
(async () => {
  const types = [...new Set(Object.values(SLOTS).flat())];
  const out = { source: 'tlidb.com', fetchedAt: new Date().toISOString(), slots: SLOTS, types: {} };
  for (const slug of types) {
    const html = await get(slug);
    const tabs = [...html.matchAll(/href="#([A-Za-z-]+)"[^>]*>([^<]+)</g)].map((m) => m[1]);
    // Onglets par nom : la base porte le nom du type (Belt, STRHelmet, VoraxLimbHead…), les légendaires « LegendaryGear » ou « Legendary ».
    const baseTab = tabs.find((x) => x === slug.replace(/_/g, '')) || tabs[0];
    const legTab = tabs.includes('LegendaryGear') ? 'LegendaryGear' : 'Legendary';
    const craftTab = tabs.find((x) => /Craft$/.test(x));
    const t = {
      name: slug.replace(/_/g, ' ').replace('Vorax Limb ', 'Vorax Limb: ').replace('Vorax Aberrant Limb ', 'Vorax Aberrant Limb: '),
      bases: cards(tab(html, baseTab)),
      legendaries: cards(tab(html, legTab)),
      craft: craftTab ? craft(tab(html, craftTab)) : { prefix: [], suffix: [] },
    };
    out.types[slug] = t;
    console.log(`${slug.padEnd(28)} ${t.bases.length} bases, ${t.legendaries.length} légendaires, ${t.craft.prefix.length}+${t.craft.suffix.length} affixes`);
  }
  // Prix : les légendaires sont reliés aux objets de notre base par leur nom.
  const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'items_seed_en.json'), 'utf8'));
  const list = Array.isArray(seed) ? seed : Object.entries(seed.items || seed).map(([id, v]) => ({ id, ...v }));
  const byName = new Map(list.map((x) => [String(x.name_en || x.name || '').toLowerCase(), +x.id]));
  let linked = 0;
  for (const t of Object.values(out.types)) for (const l of t.legendaries) { const id = byName.get(l.name.toLowerCase()); if (id) { l.itemId = id; linked++; } }
  const json = JSON.stringify(out);
  for (const f of [path.join(__dirname, '..', 'data', 'geardata.json'), path.join(__dirname, '..', 'server', 'public', 'geardata.json')]) fs.writeFileSync(f, json);
  console.log('écrit geardata.json', Math.round(json.length / 1024), 'Ko,', linked, 'légendaires reliés à nos objets');
})().catch((e) => { console.error(e.message); process.exit(1); });
