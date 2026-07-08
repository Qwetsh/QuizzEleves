// Génère un BLOCKOUT (schéma grossier) de chunk de carte pour guider Midjourney
// en image prompt (img2img). Formes franches, palette calée sur l'univers teal.
// Layout : île large, muraille + tours, portails OUEST/EST, 3 voies horizontales
// de pierres lumineuses qui divergent après le portail gauche et convergent
// avant le portail droit, jardins entre les voies, placettes réservées (slots).
//   node scripts/gen-blockout.mjs
// → map-design/chateau/blockout-section-3v.png (2000×1200, ratio 5:3)
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const W = 2000, H = 1200;
const png = new PNG({ width: W, height: H });
const D = png.data;

const C = {
  water:  [0x0c, 0x1a, 0x20],
  cliff:  [0x18, 0x27, 0x2c],
  grass:  [0x2e, 0x44, 0x36],
  hedge:  [0x22, 0x36, 0x2a],
  wall:   [0x5f, 0x70, 0x7a],
  tower:  [0x76, 0x87, 0x90],
  gate:   [0xe8, 0xd9, 0xa8],
  plaza:  [0x7c, 0x8b, 0x90],
  halo:   [0xb0, 0x8f, 0x5a],
  stone:  [0xff, 0xed, 0xb8],
  tree:   [0x1c, 0x35, 0x26],
};

function px(x, y, [r, g, b]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) << 2;
  D[i] = r; D[i + 1] = g; D[i + 2] = b; D[i + 3] = 255;
}
function rect(x0, y0, x1, y1, c) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) px(x, y, c);
}
function circle(cx, cy, r, c) {
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
    if (x * x + y * y <= r * r) px(Math.round(cx + x), Math.round(cy + y), c);
}
// Pierres régulièrement espacées le long d'une polyligne (halo + pierre).
function stones(pts, spacing = 90, r = 20) {
  let carry = 0;
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, y0] = pts[s], [x1, y1] = pts[s + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    for (let d = carry; d <= len; d += spacing) {
      const t = d / len;
      circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r + 7, C.halo);
      circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, C.stone);
    }
    carry = (len - carry) % spacing ? spacing - ((len - carry) % spacing) : 0;
  }
}

// ---- composition ----
rect(0, 0, W, H, C.water);
rect(100, 90, 1900, 1110, C.cliff);          // falaise / socle de l'île
rect(130, 120, 1870, 1080, C.grass);          // plateau d'herbe
rect(150, 140, 1850, 1060, C.wall);           // muraille (anneau plein…)
rect(184, 174, 1816, 1026, C.grass);          // …évidé
// tours aux coins
for (const [tx, ty] of [[150, 140], [1760, 140], [150, 970], [1760, 970]])
  rect(tx, ty, tx + 90, ty + 90, C.tower);
// portails OUEST et EST : percer la muraille + arche claire
rect(150, 530, 184, 670, C.grass);
rect(1816, 530, 1850, 670, C.grass);
rect(136, 522, 200, 678, C.gate);
rect(1800, 522, 1864, 678, C.gate);
// jardins/haies entre les voies
rect(560, 450, 1440, 540, C.hedge);
rect(560, 660, 1440, 750, C.hedge);
// placettes réservées (slots bannières/props)
rect(620, 240, 820, 340, C.plaza);
rect(1180, 240, 1380, 340, C.plaza);
rect(620, 860, 820, 960, C.plaza);
rect(1180, 860, 1380, 960, C.plaza);
// arbres le long des murs (hors chemins)
for (const [tx, ty] of [
  [300, 230], [520, 210], [980, 215], [1500, 210], [1700, 240],
  [300, 970], [520, 990], [980, 985], [1500, 990], [1700, 960],
  [250, 400], [250, 800], [1750, 400], [1750, 800],
]) circle(tx, ty, 36, C.tree);
// 3 voies : divergence après portail ouest (jonction ~x=310), convergence x=1690
stones([[170, 600], [1830, 600]]);                                   // voie centrale
stones([[310, 600], [520, 380], [1480, 380], [1690, 600]]);          // voie haute
stones([[310, 600], [520, 820], [1480, 820], [1690, 600]]);          // voie basse

const out = path.resolve('map-design/chateau/blockout-section-3v.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, PNG.sync.write(png));
console.log('écrit :', out);
