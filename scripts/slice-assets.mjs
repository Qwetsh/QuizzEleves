// Decoupe une planche d'assets (PNG avec alpha) en fichiers individuels.
// Composantes connexes sur le masque alpha (dilate pour rattacher les petits
// fragments : fleurs, pierres detachees), tri en lignes/colonnes, crop avec
// marge, manifest JSON.
//
// Usage : node scripts/slice-assets.mjs <in.png> [...] --out <dir> [--dilate N]

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx !== -1 ? args[outIdx + 1] : 'art/board-sheets/cut';
const dilIdx = args.indexOf('--dilate');
const skip = new Set();
if (outIdx !== -1) { skip.add(outIdx); skip.add(outIdx + 1); }
if (dilIdx !== -1) { skip.add(dilIdx); skip.add(dilIdx + 1); }
const inputs = args.filter((_, i) => !skip.has(i));
fs.mkdirSync(outDir, { recursive: true });

const ALPHA_MIN = 24;   // seuil de presence
// rayon de fusion des fragments proches (px) — baisser si des objets voisins
// aux bases feuillues se touchent et fusionnent en un seul crop
const DILATE = dilIdx !== -1 ? Number(args[dilIdx + 1]) : 9;
const MIN_AREA = 700;   // composantes plus petites = poussiere, ignorees
const PAD = 4;          // marge autour du crop

function slice(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: w, height: h, data } = png;
  const base = path.basename(file, '.png');

  // Masque de presence
  const mask = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (data[p * 4 + 3] >= ALPHA_MIN) mask[p] = 1;

  // Dilatation grossiere (par passes horizontales puis verticales)
  const dil = new Uint8Array(mask);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let d = -DILATE; d <= DILATE; d++) {
        const nx = x + d;
        if (nx >= 0 && nx < w) dil[y * w + nx] = 1;
      }
    }
  }
  const dil2 = new Uint8Array(dil);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (!dil[y * w + x]) continue;
      for (let d = -DILATE; d <= DILATE; d++) {
        const ny = y + d;
        if (ny >= 0 && ny < h) dil2[ny * w + x] = 1;
      }
    }
  }

  // Composantes connexes sur le masque dilate
  const comp = new Int32Array(w * h).fill(-1);
  const boxes = [];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!dil2[p0] || comp[p0] !== -1) continue;
    const id = boxes.length;
    const box = { x0: w, y0: h, x1: 0, y1: 0, area: 0 };
    const stack = [p0];
    comp[p0] = id;
    while (stack.length) {
      const p = stack.pop();
      const x = p % w, y = (p / w) | 0;
      // bbox basee sur le masque REEL (pas dilate)
      if (mask[p]) {
        if (x < box.x0) box.x0 = x;
        if (x > box.x1) box.x1 = x;
        if (y < box.y0) box.y0 = y;
        if (y > box.y1) box.y1 = y;
        box.area++;
      }
      if (x > 0 && dil2[p - 1] && comp[p - 1] === -1) { comp[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && dil2[p + 1] && comp[p + 1] === -1) { comp[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && dil2[p - w] && comp[p - w] === -1) { comp[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && dil2[p + w] && comp[p + w] === -1) { comp[p + w] = id; stack.push(p + w); }
    }
    boxes.push(box);
  }

  const kept = boxes.filter((b) => b.area >= MIN_AREA);

  // Tri en lignes (par centre Y, regroupe a +-60px) puis X
  kept.forEach((b) => { b.cy = (b.y0 + b.y1) / 2; b.cx = (b.x0 + b.x1) / 2; });
  kept.sort((a, b) => a.cy - b.cy);
  const rows = [];
  for (const b of kept) {
    const row = rows.find((r) => Math.abs(r.cy - b.cy) < 60);
    if (row) { row.items.push(b); row.cy = (row.cy + b.cy) / 2; }
    else rows.push({ cy: b.cy, items: [b] });
  }
  rows.forEach((r) => r.items.sort((a, b) => a.cx - b.cx));

  const manifest = [];
  rows.forEach((row, ri) => {
    row.items.forEach((b, ci) => {
      const x0 = Math.max(0, b.x0 - PAD);
      const y0 = Math.max(0, b.y0 - PAD);
      const cw = Math.min(w, b.x1 + PAD + 1) - x0;
      const ch = Math.min(h, b.y1 + PAD + 1) - y0;
      const crop = new PNG({ width: cw, height: ch });
      PNG.bitblt(png, crop, x0, y0, cw, ch, 0, 0);
      const name = `${base}-r${ri + 1}c${ci + 1}`;
      fs.writeFileSync(path.join(outDir, name + '.png'), PNG.sync.write(crop));
      manifest.push({ name, sheet: base, row: ri + 1, col: ci + 1, x: x0, y: y0, w: cw, h: ch });
    });
  });

  console.log(`${base} : ${manifest.length} assets (${rows.map((r) => r.items.length).join('+')})`);
  return manifest;
}

const all = inputs.flatMap(slice);
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(all, null, 2));
console.log(`Total : ${all.length} assets -> ${outDir}`);
