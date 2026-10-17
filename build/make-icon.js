// Génère build/icon.png (256x256) : une flamme orange sur fond sombre arrondi.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const S = 256;
const px = Buffer.alloc(S * S * 4);
const mix = (a, b, t) => Math.round(a + (b - a) * t);

for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    // Fond carré arrondi
    const r = 48, cx = Math.min(Math.max(x, r), S - 1 - r), cy = Math.min(Math.max(y, r), S - 1 - r);
    const inBg = (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    if (!inBg) continue;
    let c = [22, 25, 32];
    // Flamme : goutte (cercle en bas + pointe en haut) avec ondulation
    const fx = x - 128, fy = y - 150;
    const wobble = 10 * Math.sin(y / 18);
    const radius = fy > 0 ? 70 : 70 * (1 + fy / 120);
    const d = Math.hypot(fx - (fy < 0 ? wobble * (-fy / 120) : 0), Math.max(fy, 0) * 1.0);
    if (fy > -120 && d < radius) {
      const t = Math.min(1, d / Math.max(radius, 1));
      const inner = Math.hypot(fx, (fy - 25) * 1.2) < 34 * (1 + Math.min(0, fy) / 90);
      c = inner ? [255, 230, 140] : [mix(255, 230, t), mix(170, 70, t), mix(60, 30, t)];
    }
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(td) >>> 0 : crc32(td));
  return Buffer.concat([len, td, crc]);
}
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const raw = Buffer.alloc((S * 4 + 1) * S);
for (let y = 0; y < S; y++) px.copy(raw, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4); ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]);
fs.writeFileSync(path.join(__dirname, 'icon.png'), png);
console.log('icon.png écrit');
