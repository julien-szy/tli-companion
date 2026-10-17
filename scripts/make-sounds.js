// Génère les sons intégrés des alertes Tartarus (fichiers WAV créés pour l'app, aucun son externe).
// Usage : node scripts/make-sounds.js  ->  data/sounds/tartarus-ready.wav, data/sounds/tartarus-full.wav
const fs = require('fs');
const path = require('path');

const RATE = 44100;
const out = path.join(__dirname, '..', 'data', 'sounds');

function render(seconds, fn) {
  const n = Math.round(seconds * RATE);
  const buf = new Float32Array(n);
  fn(buf);
  return buf;
}

// Petite réverbération (quelques échos qui s'atténuent) pour un rendu plus « réel ».
function reverb(buf, mix = 0.28) {
  const delays = [0.029, 0.037, 0.041, 0.053].map((d) => Math.round(d * RATE));
  const outBuf = Float32Array.from(buf);
  for (const d of delays) {
    const line = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) line[i] = buf[i] + (i >= d ? line[i - d] * 0.72 : 0);
    for (let i = 0; i < buf.length; i++) outBuf[i] += line[i] * (mix / delays.length);
  }
  return outBuf;
}

function normalize(buf, peak = 0.85) {
  let m = 0;
  for (const v of buf) m = Math.max(m, Math.abs(v));
  if (m > 0) for (let i = 0; i < buf.length; i++) buf[i] *= peak / m;
  return buf;
}

function writeWav(file, buf) {
  const data = Buffer.alloc(buf.length * 2);
  for (let i = 0; i < buf.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i])) * 32767), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

// Cloche : partiels inharmoniques qui s'éteignent, comme une vraie cloche ou un carillon.
function bell(buf, start, freq, dur, vol) {
  const partials = [[1, 1, 1], [2.0, 0.5, 0.8], [2.76, 0.35, 0.6], [5.4, 0.18, 0.35], [8.93, 0.08, 0.25]];
  const s0 = Math.round(start * RATE), len = Math.round(dur * RATE);
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const attack = Math.min(1, t / 0.004);
    let v = 0;
    for (const [ratio, amp, decayK] of partials) v += amp * Math.sin(2 * Math.PI * freq * ratio * t) * Math.exp(-t * (3 / dur) / decayK);
    buf[s0 + i] += v * vol * attack;
  }
}

// Cor : harmoniques avec attaque lente et léger vibrato (son « cuivre »).
function horn(buf, start, freq, dur, vol) {
  const s0 = Math.round(start * RATE), len = Math.round(dur * RATE);
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const env = Math.min(1, t / 0.09) * Math.min(1, (dur - t) / 0.18);
    const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.5 * t);
    let v = 0;
    for (let h = 1; h <= 9; h++) v += Math.sin(2 * Math.PI * freq * h * vib * t) / Math.pow(h, 1.15) * (h % 2 ? 1 : 0.7);
    buf[s0 + i] += v * vol * Math.max(0, env);
  }
}

// Gong : partiels graves inharmoniques, longue résonance.
function gong(buf, start, freq, dur, vol) {
  const partials = [[1, 1], [1.48, 0.7], [2.03, 0.5], [2.72, 0.4], [3.6, 0.25], [4.9, 0.15]];
  const s0 = Math.round(start * RATE), len = Math.round(dur * RATE);
  for (let i = 0; i < len && s0 + i < buf.length; i++) {
    const t = i / RATE;
    const swell = Math.min(1, t / 0.01) * Math.exp(-t * 2.2 / dur * 2);
    let v = 0;
    partials.forEach(([r, a], k) => { v += a * Math.sin(2 * Math.PI * freq * r * t + k) * Math.exp(-t * (1 + k * 0.6)); });
    buf[s0 + i] += v * vol * swell;
  }
}

fs.mkdirSync(out, { recursive: true });

// Tartarus 36 : « c'est prêt » — carillon montant lumineux (sol - si - ré - sol) puis accord tenu.
const ready = render(2.4, (b) => {
  [784, 988, 1175, 1568].forEach((f, i) => bell(b, i * 0.13, f, 1.4, 0.55));
  [784, 1175, 1568].forEach((f) => bell(b, 0.62, f, 1.7, 0.3));
});
writeWav(path.join(out, 'tartarus-ready.wav'), normalize(reverb(ready)));

// Tartarus 48 : « c'est plein » — deux appels de cor graves et insistants, puis un coup de gong.
const full = render(3.2, (b) => {
  horn(b, 0.0, 196, 0.55, 0.5);
  horn(b, 0.62, 196, 0.55, 0.5);
  horn(b, 1.24, 262, 0.9, 0.55);
  gong(b, 1.24, 98, 1.9, 0.9);
});
writeWav(path.join(out, 'tartarus-full.wav'), normalize(reverb(full, 0.35)));

console.log('Sons créés dans', out);
