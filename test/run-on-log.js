// Test hors ligne : relit le log, puis « joue » les N derniers Mo comme s'ils arrivaient en direct.
// Usage : node test/run-on-log.js [cheminDuLog] [MoEnDirect]
const fs = require('fs');
const os = require('os');
const path = require('path');
const { LogParser } = require('../src/parser');
const { Tracker } = require('../src/tracker');
const { ItemDb, PriceBook } = require('../src/prices');
const { findLogPath } = require('../src/logwatcher');
const { buildReport } = require('../src/report');

const file = process.argv[2] || findLogPath();
const liveMb = +(process.argv[3] || 60);
const items = new ItemDb(path.join(__dirname, '..', 'data', 'items_seed_en.json'));
const prices = new PriceBook(path.join(os.tmpdir(), 'tli-test-prices.json'));
const settings = { mode: 'farm', timeMode: 'map', hubPatterns: ['/XZ_'] };
const tracker = new Tracker({ prices, items, settings });
const parser = new LogParser((ev) => tracker.handle(ev));

const size = fs.statSync(file).size;
const liveStart = Math.max(0, size - liveMb * 1024 * 1024);
const replayStart = Math.max(0, liveStart - 300 * 1024 * 1024);

function readRange(from, to, cb) {
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(4 * 1024 * 1024);
  let pos = from, left = '', first = from > 0;
  while (pos < to) {
    const n = fs.readSync(fd, buf, 0, Math.min(buf.length, to - pos), pos);
    pos += n;
    const lines = (left + buf.toString('utf8', 0, n)).split('\n');
    left = lines.pop();
    if (first) { lines.shift(); first = false; }
    lines.forEach((l) => cb(l.replace(/\r$/, '')));
  }
  fs.closeSync(fd);
  return left;
}

(async () => {
if (process.env.COMMUNITY) console.log('Prix communautaires :', await prices.fetchCommunity(), 'objets');
let t0 = Date.now();
tracker.replay = true;
const left = readRange(replayStart, liveStart, (l) => parser.feed(l));
tracker.endReplay(parser.lastTs);
tracker.startFarm();
tracker.session.startedAt = parser.lastTs;
console.log(`Relecture : ${((liveStart - replayStart) / 1048576).toFixed(0)} Mo en ${Date.now() - t0} ms, sac prêt=${tracker.snapshotReady}, emplacements=${tracker.slots.size}, prix HdV=${Object.keys(prices.exchange).length}`);

t0 = Date.now();
let firstLive = true;
readRange(liveStart, size, (l) => { if (firstLive) { parser.feed(left + l); firstLive = false; } else parser.feed(l); });
console.log(`Direct simulé : ${liveMb} Mo en ${Date.now() - t0} ms\n`);

const fmt = (v) => (v >= 0 ? '+' : '') + v.toFixed(1);
const data = tracker.fullData();
for (const r of data.runs.slice().reverse()) {
  const top = r.items.slice(0, 3).map((i) => `${i.name} x${i.qty}`).join(', ');
  console.log(`${new Date(r.startedAt).toISOString().slice(11, 19)}  ${r.name.padEnd(40).slice(0, 40)} ${(r.durationMs / 60000).toFixed(1).padStart(5)} min  gain ${fmt(r.loot).padStart(8)}  coût ${fmt(r.cost).padStart(7)}  net ${fmt(r.profit).padStart(8)} FE | ${top}`);
}
const s = data.session;
console.log(`\nCartes: ${s.runs} | Profit farm: ${fmt(s.profit)} FE | Hors-carte (mode tout): ${fmt(s.other)} FE | FE/h (temps en carte): ${s.perHour.toFixed(0)}`);
console.log('Objets sans prix :', data.items.filter((i) => i.source === 'inconnu').map((i) => `${i.name} x${i.qty}`).join(', ') || 'aucun');

// Fiche stratégie de la session simulée
const ended = tracker.stopFarm();
ended.endedAt = parser.lastTs;
const report = buildReport(ended, tracker, { appVersion: 'test' });
const t = report.totals;
console.log(`\n=== Fiche stratégie ===`);
console.log(`Héros: ${report.hero ? report.hero.name : '?'} | Cartes: ${t.runs} | Profit: ${fmt(t.profit)} | FE/h carte: ${t.perHourMap.toFixed(0)} | Valeur sac: ${t.netWorthStart?.toFixed(0)} -> ${t.netWorthEnd?.toFixed(0)}`);
console.log('Cartes :', report.strategy.maps.map((m) => `${m.name} x${m.runs} (zones ${Object.keys(m.areaIds).join('/') || '?'})`).join(' | '));
console.log('Consommables / carte :', report.strategy.consumables.map((c) => `${c.name} ${c.perMap.toFixed(2)}`).join(', '));
console.log('Modificateurs (moy./carte) :');
for (const m of report.strategy.modifiers.slice(0, 12)) console.log(`  ${m.perMap.toFixed(1).padStart(5)} x  ${m.desc || '#' + m.id}`);
console.log(`Descriptions connues : ${Object.keys(tracker.meta.data.affixDesc).length} | taille fiche : ${(JSON.stringify(report).length / 1024).toFixed(0)} Ko`);
})();
