// Détoure les jaquettes de cassettes générées (fond CRÈME uniforme) par
// DIFFUSION 4-connexe depuis les bords : on n'efface que le crème CONNECTÉ au
// bord → l'étiquette crème INTÉRIEURE (enfermée dans la coque) reste intacte.
// Seuils calés sur le fond réel (min-channel ~232..243, saturation ≤ 22).
// Feather des bords + recadrage bbox alpha + marge. Écrit EN PLACE.
//   node scripts/detour-cassettes.mjs <f1.png> [f2.png ...]
import fs from 'node:fs';
import { PNG } from 'pngjs';

// Fond crème = clair + peu saturé. HARD → transparent franc ; bande SOFT..HARD → feather.
const HARD = 224, SOFT = 198, SAT_MAX = 30;
const ALPHA_MIN = 12, PAD = 14;

function detour(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: w, height: h, data } = png;
  const sat = (i) => Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]);
  const minc = (i) => Math.min(data[i], data[i + 1], data[i + 2]);
  const isBgFollow = (i) => sat(i) <= SAT_MAX && minc(i) >= SOFT;
  const alphaFor = (i) => {
    const m = minc(i);
    if (m >= HARD) return 0;
    return Math.round(255 * (HARD - m) / (HARD - SOFT));
  };

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
  fs.writeFileSync(file, PNG.sync.write(crop));

  let transp = 0;
  for (let i = 3; i < crop.data.length; i += 4) if (crop.data[i] < 128) transp++;
  const pct = (transp / (ow * oh) * 100).toFixed(1);
  console.log(`ok ${file.split(/[\\/]/).pop().padEnd(26)} ${w}×${h} → ${ow}×${oh}  transparent=${pct}%`);
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: detour-cassettes.mjs <f1.png> [f2.png ...]'); process.exit(1); }
for (const f of files) detour(f);
