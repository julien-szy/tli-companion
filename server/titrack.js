// Copie de la base de prix communautaire TITrack, rafraîchie toutes les 15 min sur notre serveur.
// L'app la télécharge chez nous en priorité : ça marche même quand TITrack (Supabase) est bloqué
// chez un joueur, et ça évite que chaque joueur interroge TITrack séparément.
const fs = require('fs');
const path = require('path');

const URL_BASE = 'https://qhjulyngunwiculnharg.supabase.co/rest/v1/aggregated_prices';
const KEY = 'sb_publishable_YgqYSMUarrM_IKvcNpJlBw_KwTpp7ho'; // clé publique en lecture seule (la même que dans l'app)
const MAX_AGE_MS = 45 * 24 * 3600 * 1000;
const EVERY_MS = 15 * 60 * 1000;

let cache = { fetchedAt: 0, prices: {} };
let cacheFile = null;

async function fetchAll() {
  const result = {};
  const pageSize = 1000;
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const url = `${URL_BASE}?select=config_base_id,price_fe_median,unique_devices,updated_at&order=updated_at.desc&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url, { headers: { apikey: KEY }, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`TITrack HTTP ${res.status}`);
    const rows = await res.json();
    for (const r of rows) {
      const ts = Date.parse(r.updated_at);
      if (Date.now() - ts > MAX_AGE_MS || result[r.config_base_id]) continue;
      result[r.config_base_id] = { price: r.price_fe_median, ts, devices: r.unique_devices };
    }
    if (rows.length < pageSize || Date.now() - Date.parse(rows[rows.length - 1].updated_at) > MAX_AGE_MS) break;
  }
  return result;
}

async function refresh() {
  try {
    const prices = await fetchAll();
    if (Object.keys(prices).length < 100) throw new Error('too few prices, keeping the previous copy');
    cache = { fetchedAt: Date.now(), prices };
    if (cacheFile) fs.writeFile(cacheFile, JSON.stringify(cache), () => {});
  } catch (e) {
    console.error(new Date().toISOString(), 'Copie TITrack :', e.message);
  }
}

function start(dataDir) {
  cacheFile = path.join(dataDir, 'titrack_prices.json');
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch { /* première fois */ }
  refresh();
  setInterval(refresh, EVERY_MS).unref();
}

const get = () => cache;

module.exports = { start, get };
