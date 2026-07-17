// Détoure une jaquette de cassette : fond crème/blanc uni → transparent, puis
// crop serré sur la cassette. Même principe que space-items-slice.mjs :
// remplissage par DIFFUSION (flood fill 4-connexe) depuis les bords → seuls les
// pixels de fond CONNECTÉS au bord disparaissent (l'étiquette crème INTÉRIEURE,
// enclose par la coque sombre, est préservée). Puis anti-halo (gomme le liseré
// clair d'anti-aliasing) et crop sur la bbox alpha.
//
//   node scripts/cassette-detour.mjs <clé_de_thème> [tolérance]
// ex. node scripts/cassette-detour.mjs world_of_warcraft
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const key = process.argv[2];
if (!key) { console.error('Usage: node scripts/cassette-detour.mjs <clé> [tolérance]'); process.exit(1); }
const TOL = parseInt(process.argv[3], 10) || 52;        // distance de fond pour le flood fill
const HALO = TOL + 34;                                   // seuil (plus large) pour l'anti-halo
const PAD = 6;                                           // marge autour de la bbox alpha

const file = path.join(process.cwd(), 'src', 'assets', 'cassettes', `${key}.png`);
const png = PNG.sync.read(fs.readFileSync(file));
const { width: w, height: h, data: d } = png;
const idx = (x, y) => (y * w + x) * 4;

// Couleur de fond = moyenne des 4 coins.
const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]];
const bg = [0, 0, 0];
for (const [x, y] of corners) { const i = idx(x, y); bg[0] += d[i]; bg[1] += d[i + 1]; bg[2] += d[i + 2]; }
bg.forEach((_, k) => (bg[k] = Math.round(bg[k] / corners.length)));
const dist = (i) => Math.hypot(d[i] - bg[0], d[i + 1] - bg[1], d[i + 2] - bg[2]);

// 1) Flood fill 4-connexe depuis tous les pixels de bord proches du fond.
const seen = new Uint8Array(w * h);
const stack = [];
const pushIfBg = (x, y) => {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const p = y * w + x;
  if (seen[p]) return;
  if (dist(p * 4) <= TOL) { seen[p] = 1; stack.push(p); }
};
for (let x = 0; x < w; x++) { pushIfBg(x, 0); pushIfBg(x, h - 1); }
for (let y = 0; y < h; y++) { pushIfBg(0, y); pushIfBg(w - 1, y); }
while (stack.length) {
  const p = stack.pop();
  const x = p % w, y = (p / w) | 0;
  d[p * 4 + 3] = 0; // transparent
  pushIfBg(x + 1, y); pushIfBg(x - 1, y); pushIfBg(x, y + 1); pushIfBg(x, y - 1);
}

// 2) Anti-halo : gomme le liseré clair d'anti-aliasing au bord de la découpe.
// Un pixel opaque VOISIN d'un transparent et encore « proche du fond » (mais
// au-delà de TOL) est effacé — plusieurs passes pour manger tout le halo.
const isTransparent = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? true : d[idx(x, y) + 3] === 0;
for (let pass = 0; pass < 3; pass++) {
  const kill = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = idx(x, y);
    if (d[i + 3] === 0) continue;
    if (dist(i) > HALO) continue;
    if (isTransparent(x + 1, y) || isTransparent(x - 1, y) || isTransparent(x, y + 1) || isTransparent(x, y - 1)) kill.push(i);
  }
  if (!kill.length) break;
  for (const i of kill) d[i + 3] = 0;
}

// 3) Crop sur la bbox des pixels opaques (+ marge PAD).
let minX = w, minY = h, maxX = -1, maxY = -1;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (d[idx(x, y) + 3] !== 0) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
}
if (maxX < 0) { console.error('Aucun pixel opaque — tolérance trop haute ?'); process.exit(1); }
minX = Math.max(0, minX - PAD); minY = Math.max(0, minY - PAD);
maxX = Math.min(w - 1, maxX + PAD); maxY = Math.min(h - 1, maxY + PAD);
const cw = maxX - minX + 1, ch = maxY - minY + 1;
const out = new PNG({ width: cw, height: ch });
for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
  const s = idx(minX + x, minY + y), t = (y * cw + x) * 4;
  out.data[t] = d[s]; out.data[t + 1] = d[s + 1]; out.data[t + 2] = d[s + 2]; out.data[t + 3] = d[s + 3];
}
fs.writeFileSync(file, PNG.sync.write(out));
console.log(`✓ ${key} détouré : ${w}×${h} → ${cw}×${ch} (fond ${bg.join(',')}, tol ${TOL}).`);
