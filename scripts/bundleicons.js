// Intègre dans l'app toutes les images qu'elle affiche (objets, équipements, compétences, talents, héros…),
// réduites en WebP : plus aucun téléchargement d'image une fois l'app installée, même hors ligne.
// Rangées dans src/ui/icons/cache/<sha1 de l'adresse>.webp ; main.js sert ces fichiers à la place des adresses
// d'origine (cdn.tlidb.com, tlicompanion.com/icons). À relancer à chaque saison :
//   npx electron scripts/bundleicons.js
const { app, BrowserWindow, net } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'ui', 'icons', 'cache');
const RE = /https:\/\/(?:cdn\.tlidb\.com|tlicompanion\.com\/icons)\/[^"\\ ]+?\.(?:webp|png|jpg)/g;
const BIG = /hero_characters|talent_boards|TalentV2/; // affichés en grand : 128 px, le reste en 64 px

function collect() {
  const urls = new Set();
  for (const e of JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'items_seed_en.json'))).items) if (e.img) urls.add(e.img);
  for (const v of Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'extra_icons.json'))).icons)) urls.add(v);
  for (const f of fs.readdirSync(path.join(ROOT, 'data')).filter((x) => x.endsWith('.json'))) {
    for (const m of fs.readFileSync(path.join(ROOT, 'data', f), 'utf8').matchAll(RE)) urls.add(m[0]);
  }
  return [...urls];
}
const sha = (u) => crypto.createHash('sha1').update(u).digest('hex');

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await w.loadURL('data:text/html,<canvas id=c></canvas>');
  const urls = collect();
  let done = 0, kept = 0, skipped = 0, missing = 0, i = 0;
  const one = async (u) => {
    const file = path.join(OUT, sha(u) + '.webp');
    if (fs.existsSync(file)) { skipped++; return; }
    // Icône copiée sur le serveur et déjà présente dans src/ui/icons/items : on la reprend sans la télécharger.
    const local = /tlicompanion\.com\/icons\/items\/(\d+\.webp)$/.exec(u);
    let buf = local && fs.existsSync(path.join(ROOT, 'src', 'ui', 'icons', 'items', local[1])) ? fs.readFileSync(path.join(ROOT, 'src', 'ui', 'icons', 'items', local[1])) : null;
    if (!buf) {
      try { const r = await net.fetch(u); if (!r.ok) { missing++; return; } buf = Buffer.from(await r.arrayBuffer()); } catch { missing++; return; }
    }
    const size = BIG.test(u) ? 128 : 64;
    const mime = /\.png$/.test(u) ? 'image/png' : /\.jpg$/.test(u) ? 'image/jpeg' : 'image/webp';
    const data = await w.webContents.executeJavaScript(`new Promise((ok) => { const i = new Image(); i.onload = () => {
      const k = Math.min(1, ${size} / Math.max(i.width, i.height)), W = Math.round(i.width * k), H = Math.round(i.height * k);
      const c = document.getElementById('c'); c.width = W; c.height = H; const x = c.getContext('2d'); x.clearRect(0, 0, W, H); x.drawImage(i, 0, 0, W, H);
      ok(c.toDataURL('image/webp', 0.82)); }; i.onerror = () => ok(null); i.src = 'data:${mime};base64,${buf.toString('base64')}'; })`);
    if (data) { fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64')); kept++; } else missing++;
  };
  const worker = async () => { while (i < urls.length) { await one(urls[i++]); if (++done % 250 === 0) console.log(`${done} / ${urls.length}`); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  console.log(`images : ${urls.length} adresses, ${kept} ajoutées, ${skipped} déjà là, ${missing} introuvables`);
  app.quit();
});
