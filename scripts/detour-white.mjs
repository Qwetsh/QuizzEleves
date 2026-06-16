// One-shot : détoure une image sur fond BLANC par DIFFUSION depuis les bords
// (même stratégie que dechecker-slice.mjs : on n'efface que le blanc CONNECTÉ
// au bord, l'intérieur clair de l'objet reste intact). Léger feather des bords
// (alpha progressif) + recadrage sur la bbox alpha + marge.
//   node scripts/detour-white.mjs <in.png> <out.png>
import fs from 'node:fs';
import { PNG } from 'pngjs';

const [file, out] = process.argv.slice(2);
if (!file || !out) { console.error('usage: detour-white.mjs <in.png> <out.png>'); process.exit(1); }

const png = PNG.sync.read(fs.readFileSync(file));
const { width: w, height: h, data } = png;

const sat = (i) => { const r = data[i], g = data[i + 1], b = data[i + 2]; return Math.max(r, g, b) - Math.min(r, g, b); };
const minc = (i) => Math.min(data[i], data[i + 1], data[i + 2]);

// Fond = blanc franc (clair + peu saturé). Bande douce 215..245 → feather.
const HARD = 244, SOFT = 212, SAT_MAX = 26;
const isBgFollow = (i) => sat(i) <= SAT_MAX && minc(i) >= SOFT; // pixel à suivre par la diffusion
const alphaFor = (i) => {
  const m = minc(i);
  if (m >= HARD) return 0;                                  // blanc franc → transparent
  return Math.round(255 * (HARD - m) / (HARD - SOFT));      // bord anti-aliasé → alpha partiel
};

// Diffusion 4-connexe depuis tous les pixels de bord qui sont du fond blanc.
const seen = new Uint8Array(w * h);
const stack = [];
const pushIf = (x, y) => {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const p = y * w + x;
  if (seen[p]) return;
  seen[p] = 1;
  const i = p * 4;
  if (isBgFollow(i)) { data[i + 3] = alphaFor(i); stack.push(p); }
};
for (let x = 0; x < w; x++) { pushIf(x, 0); pushIf(x, h - 1); }
for (let y = 0; y < h; y++) { pushIf(0, y); pushIf(w - 1, y); }
while (stack.length) {
  const p = stack.pop();
  const x = p % w, y = (p / w) | 0;
  pushIf(x - 1, y); pushIf(x + 1, y); pushIf(x, y - 1); pushIf(x, y + 1);
}

// Recadrage sur la bbox alpha + marge.
const ALPHA_MIN = 12, PAD = 12;
let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (data[(y * w + x) * 4 + 3] >= ALPHA_MIN) {
    if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
  }
}
bx0 = Math.max(0, bx0 - PAD); by0 = Math.max(0, by0 - PAD);
bx1 = Math.min(w - 1, bx1 + PAD); by1 = Math.min(h - 1, by1 + PAD);
const ow = bx1 - bx0 + 1, oh = by1 - by0 + 1;
const crop = new PNG({ width: ow, height: oh });
PNG.bitblt(png, crop, bx0, by0, ow, oh, 0, 0);
fs.writeFileSync(out, PNG.sync.write(crop));
console.log(`ok → ${out} (${ow}×${oh}, source ${w}×${h})`);
