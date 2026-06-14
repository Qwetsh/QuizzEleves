// One-shot : enlève le damier « transparence » CUIT (opaque) d'une planche
// d'icônes ChatGPT, puis découpe en grille cols×rows. Sortie PNG avec alpha.
//   node scripts/dechecker-slice.mjs <in.png> <prefix> <cols> <rows> --out <dir>
//
// Stratégie : remplissage par DIFFUSION depuis les bords (et non color-key
// global). On efface uniquement les pixels « gris damier » CONNECTÉS au bord de
// l'image — l'intérieur clair des objets (couvertures blanches, argent…) reste
// intact car il est isolé du fond par les contours/ombres de l'objet.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const [file, prefix, colsS, rowsS] = process.argv.slice(2);
const outIdx = process.argv.indexOf('--out');
const outDir = outIdx !== -1 ? process.argv[outIdx + 1] : 'art/new-sheets/cut2';
const cols = Number(colsS), rows = Number(rowsS);
fs.mkdirSync(outDir, { recursive: true });

const png = PNG.sync.read(fs.readFileSync(file));
const { width: w, height: h, data } = png;

// 1) Couleurs du damier : histogramme des pixels de bordure (3 px) → 2 dominantes.
const hist = new Map();
const sample = (x, y) => {
  const i = (y * w + x) * 4;
  const key = (data[i] >> 3) + ',' + (data[i + 1] >> 3) + ',' + (data[i + 2] >> 3); // quantifié
  hist.set(key, (hist.get(key) || 0) + 1);
};
for (let x = 0; x < w; x++) { for (let b = 0; b < 3; b++) { sample(x, b); sample(x, h - 1 - b); } }
for (let y = 0; y < h; y++) { for (let b = 0; b < 3; b++) { sample(b, y); sample(w - 1 - b, y); } }
const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
  .map(([k]) => k.split(',').map((n) => Number(n) << 3));

// 2) Un pixel est « fond damier » s'il est proche d'une des 2 teintes ET peu
// saturé (gris) — l'anti-alias entre deux carrés reste capté. TOL généreux :
// sans risque car la diffusion ne franchit pas les contours de l'objet.
const TOL = 22;
const isBg = (i) => {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (Math.max(r, g, b) - Math.min(r, g, b) > 24) return false; // couleur saturée = objet
  return top.some((c) => Math.abs(r - c[0]) <= TOL && Math.abs(g - c[1]) <= TOL && Math.abs(b - c[2]) <= TOL);
};

// 3) Diffusion (flood fill 4-connexe) depuis tous les pixels de bord qui sont du
// fond. Pile explicite (évite la récursion sur ~1.5 M pixels).
const seen = new Uint8Array(w * h);
const stack = [];
const pushIf = (x, y) => {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const p = y * w + x;
  if (seen[p]) return;
  seen[p] = 1;
  if (isBg(p * 4)) { data[p * 4 + 3] = 0; stack.push(p); }
};
for (let x = 0; x < w; x++) { pushIf(x, 0); pushIf(x, h - 1); }
for (let y = 0; y < h; y++) { pushIf(0, y); pushIf(w - 1, y); }
while (stack.length) {
  const p = stack.pop();
  const x = p % w, y = (p / w) | 0;
  pushIf(x - 1, y); pushIf(x + 1, y); pushIf(x, y - 1); pushIf(x, y + 1);
}

// 4) Découpe en grille cols×rows ; pour chaque cellule, crop sur la bbox alpha + marge.
const cw = w / cols, ch = h / rows, PAD = 6, ALPHA_MIN = 20;
let n = 0;
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const cx0 = Math.round(c * cw), cy0 = Math.round(r * ch);
    const cx1 = Math.round((c + 1) * cw), cy1 = Math.round((r + 1) * ch);
    let bx0 = cx1, by0 = cy1, bx1 = cx0, by1 = cy0;
    for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
      if (data[(y * w + x) * 4 + 3] >= ALPHA_MIN) {
        if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
      }
    }
    if (bx1 < bx0) continue; // cellule vide
    bx0 = Math.max(cx0, bx0 - PAD); by0 = Math.max(cy0, by0 - PAD);
    bx1 = Math.min(cx1 - 1, bx1 + PAD); by1 = Math.min(cy1 - 1, by1 + PAD);
    const ow = bx1 - bx0 + 1, oh = by1 - by0 + 1;
    const out = new PNG({ width: ow, height: oh });
    PNG.bitblt(png, out, bx0, by0, ow, oh, 0, 0);
    n++;
    const name = `${prefix}${String(n).padStart(2, '0')}`;
    fs.writeFileSync(path.join(outDir, name + '.png'), PNG.sync.write(out));
  }
}
console.log(`${prefix} : ${n} icônes (damier ~ ${top.map((c) => c.join(':')).join(' / ')})`);
