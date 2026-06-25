// Re-découpe la planche de potions en détectant les VRAIES gouttières (lignes/
// colonnes vides) au lieu d'une grille régulière. Corrige le défaut « bas de fiole
// coupé + bout de la fiole du dessus visible » : les fioles débordaient leur ligne
// de grille idéale (H/5), la découpe régulière tranchait donc leur bas.
// Détourage + nettoyage des bavures identiques à slice-alchemy.mjs.
//   node scripts/reslice-potions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const FILE = 'art/alchemy-sheets/potions.png';
const OUT = 'src/assets/items';
const PREFIX = 'alc-pot';
const COLS = 8, ROWS = 5;

const png = PNG.sync.read(fs.readFileSync(FILE));
const { width: W, height: H, data } = png;

const SAT_MAX = 30, SOFT = 202, HARD = 241, ALPHA_MIN = 16, PAD = 8;
const isBgPix = (i, d) => {
  const r = d[i], g = d[i + 1], b = d[i + 2];
  const sat = Math.max(r, g, b) - Math.min(r, g, b);
  return sat <= SAT_MAX && Math.min(r, g, b) >= SOFT;
};

// --- Détection des gouttières (bandes quasi vides) sur un axe ---
function gutters(fill, len, max) {
  const thresh = max * 0.02;
  const out = [];
  let inG = false, start = 0;
  for (let i = 0; i < len; i++) {
    const empty = fill[i] <= thresh;
    if (empty && !inG) { inG = true; start = i; }
    if (!empty && inG) { inG = false; out.push(Math.round((start + i - 1) / 2)); }
  }
  if (inG) out.push(Math.round((start + len - 1) / 2));
  return out;
}
const rowFill = new Array(H).fill(0), colFill = new Array(W).fill(0);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!isBgPix((y * W + x) * 4, data)) { rowFill[y]++; colFill[x]++; }
}
// Bords (cut lines) : centres des gouttières. On attend ROWS+1 / COLS+1 lignes.
const yCuts = gutters(rowFill, H, W);
const xCuts = gutters(colFill, W, H);
if (yCuts.length < ROWS + 1 || xCuts.length < COLS + 1) {
  console.error('Gouttières insuffisantes', { y: yCuts.length, x: xCuts.length });
  process.exit(1);
}
console.log('Lignes de coupe Y:', yCuts.join(', '));
console.log('Lignes de coupe X:', xCuts.join(', '));

function sliceCell(r, c) {
  const x0 = xCuts[c], x1 = xCuts[c + 1], y0 = yCuts[r], y1 = yCuts[r + 1];
  const w = x1 - x0, h = y1 - y0;
  const cell = new PNG({ width: w, height: h });
  PNG.bitblt(png, cell, x0, y0, w, h, 0, 0);
  const d = cell.data;
  const minc = (i) => Math.min(d[i], d[i + 1], d[i + 2]);
  const alphaFor = (i) => { const m = minc(i); if (m >= HARD) return 0; return Math.round(255 * (HARD - m) / (HARD - SOFT)); };
  const seen = new Uint8Array(w * h); const st = [];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const p = y * w + x; if (seen[p]) return; seen[p] = 1; const i = p * 4; if (isBgPix(i, d)) { d[i + 3] = alphaFor(i); st.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) { const p = st.pop(); const x = p % w, y = (p / w) | 0; push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1); }

  // Suppression des bavures (composantes connexes opaques < 10 % de la plus grosse).
  const op = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (d[p * 4 + 3] >= ALPHA_MIN) op[p] = 1;
  const comp = new Int32Array(w * h).fill(-1);
  const areas = [];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!op[p0] || comp[p0] !== -1) continue;
    const id = areas.length; let area = 0; const stk = [p0]; comp[p0] = id;
    while (stk.length) {
      const p = stk.pop(); area++; const x = p % w, y = (p / w) | 0;
      if (x > 0 && op[p - 1] && comp[p - 1] === -1) { comp[p - 1] = id; stk.push(p - 1); }
      if (x < w - 1 && op[p + 1] && comp[p + 1] === -1) { comp[p + 1] = id; stk.push(p + 1); }
      if (y > 0 && op[p - w] && comp[p - w] === -1) { comp[p - w] = id; stk.push(p - w); }
      if (y < h - 1 && op[p + w] && comp[p + w] === -1) { comp[p + w] = id; stk.push(p + w); }
    }
    areas.push(area);
  }
  if (areas.length) {
    const maxA = Math.max(...areas);
    const keep = areas.map((a) => a >= maxA * 0.10);
    for (let p = 0; p < w * h; p++) { const cid = comp[p]; if (cid !== -1 && !keep[cid]) d[p * 4 + 3] = 0; }
  }

  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if (d[(y * w + x) * 4 + 3] >= ALPHA_MIN) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; } }
  if (bx1 < 0) return null;
  bx0 = Math.max(0, bx0 - PAD); by0 = Math.max(0, by0 - PAD); bx1 = Math.min(w - 1, bx1 + PAD); by1 = Math.min(h - 1, by1 + PAD);
  const ow = bx1 - bx0 + 1, oh = by1 - by0 + 1;
  const crop = new PNG({ width: ow, height: oh });
  PNG.bitblt(cell, crop, bx0, by0, ow, oh, 0, 0);
  const name = `${PREFIX}-r${r + 1}c${c + 1}`;
  fs.writeFileSync(path.join(OUT, name + '.png'), PNG.sync.write(crop));
  return { name, w: ow, h: oh };
}

let n = 0;
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { if (sliceCell(r, c)) n++; }
console.log(`${n} fioles re-découpées → ${OUT}`);
