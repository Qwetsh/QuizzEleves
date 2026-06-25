// Découpe une planche d'alchimie (grille RÉGULIÈRE) en assets individuels.
// Pour chaque cellule : détourage du fond clair par diffusion depuis les bords
// de la cellule (le clair INTÉRIEUR d'un objet reste), puis recadrage alpha + marge.
//   node scripts/slice-alchemy.mjs <in.png> <cols> <rows> <outDir> <prefix>
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const [file, colsS, rowsS, outDir, prefix] = process.argv.slice(2);
if (!file || !colsS || !rowsS || !outDir || !prefix) { console.error('usage: slice-alchemy.mjs <in.png> <cols> <rows> <outDir> <prefix>'); process.exit(1); }
const cols = Number(colsS), rows = Number(rowsS);
const png = PNG.sync.read(fs.readFileSync(file));
const { width: W, height: H, data } = png;
fs.mkdirSync(outDir, { recursive: true });
const cw = W / cols, ch = H / rows;

const HARD = 241, SOFT = 202, SAT_MAX = 30, ALPHA_MIN = 16, PAD = 8;

function sliceCell(r, c) {
  const x0 = Math.round(c * cw), y0 = Math.round(r * ch), x1 = Math.round((c + 1) * cw), y1 = Math.round((r + 1) * ch);
  const w = x1 - x0, h = y1 - y0;
  const cell = new PNG({ width: w, height: h });
  PNG.bitblt(png, cell, x0, y0, w, h, 0, 0);
  const d = cell.data;
  const sat = (i) => { const a = d[i], b = d[i + 1], g = d[i + 2]; return Math.max(a, b, g) - Math.min(a, b, g); };
  const minc = (i) => Math.min(d[i], d[i + 1], d[i + 2]);
  const isBg = (i) => sat(i) <= SAT_MAX && minc(i) >= SOFT;
  const alphaFor = (i) => { const m = minc(i); if (m >= HARD) return 0; return Math.round(255 * (HARD - m) / (HARD - SOFT)); };
  const seen = new Uint8Array(w * h); const st = [];
  const push = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const p = y * w + x; if (seen[p]) return; seen[p] = 1; const i = p * 4; if (isBg(i)) { d[i + 3] = alphaFor(i); st.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) { const p = st.pop(); const x = p % w, y = (p / w) | 0; push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1); }

  // Nettoyage des bavures de bordure (fragments d'un asset voisin captés au bord
  // de la cellule) : composantes connexes des pixels OPAQUES ; on supprime celles
  // qui font < 10 % de la plus grosse (garde les grappes/multi-parties réelles).
  const op = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (d[p * 4 + 3] >= ALPHA_MIN) op[p] = 1;
  const comp = new Int32Array(w * h).fill(-1);
  const areas = [];
  for (let p0 = 0; p0 < w * h; p0++) {
    if (!op[p0] || comp[p0] !== -1) continue;
    const id = areas.length; let area = 0; const stk = [p0]; comp[p0] = id;
    while (stk.length) { const p = stk.pop(); area++; const x = p % w, y = (p / w) | 0;
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
  const name = `${prefix}-r${r + 1}c${c + 1}`;
  fs.writeFileSync(path.join(outDir, name + '.png'), PNG.sync.write(crop));
  return { name, w: ow, h: oh };
}

let n = 0;
for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { if (sliceCell(r, c)) n++; }
console.log(`${n} cellules → ${outDir}`);
