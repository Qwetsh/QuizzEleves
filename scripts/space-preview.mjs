// Aperçu offline du plateau « espace » composé (sans navigateur) :
// compose un plateau via mapComposer puis rend un PNG downscalé
// (fond, continents, socles/îlots, traits entre cases, points par type).
//
//   node scripts/space-preview.mjs [nbSections] [nbVoies] [casesParVoie]
//
// Sortie : map-design/espace/check-board.png

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { composeSpaceBoard } from '../src/logic/mapComposer.js';
import { SPACE_ASSET_DIMS, SOCLE_W, ILOT_W, SOCLE_TOP_DY, ILOT_TOP_DY, SPECIAL_CASE_ASSET, CASE_W_CONTINENT, CASE_W_SPACE, CASE_TOP_DY, PIEGE_W } from '../src/data/maps/espace.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'src', 'assets', 'space');

const [nbSections = 2, nbVoies = 3, casesParVoie = 5, scaleArg] = process.argv.slice(2).map(Number);
const SCALE = scaleArg || 0.22;

const { nodes, viewBox, space } = composeSpaceBoard({
  nbSections, nbVoies, casesParVoie,
  voieFinale: 'court-long', couloirsMix: 2, eventEveryX: 3,
  subjects: ['cinema', 'animaux', 'moyen_age', 'jeux_video', 'astronomie_espace', 'cyclisme'],
});
console.log(`plateau ${viewBox.w}×${viewBox.h}, ${Object.keys(nodes).length} cases, ${space.layers.length} continents`);

const W = Math.round(viewBox.w * SCALE), H = Math.round(viewBox.h * SCALE);
const out = new PNG({ width: W, height: H });

// fond
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (W * y + x) << 2;
    const t = y / H;
    out.data[i] = Math.round(36 + 10 * (1 - t));
    out.data[i + 1] = Math.round(18 + 8 * (1 - t));
    out.data[i + 2] = Math.round(69 + 16 * (1 - t));
    out.data[i + 3] = 255;
  }
}
// étoiles
for (const s of space.stars) {
  const x = Math.round(s.x * SCALE), y = Math.round(s.y * SCALE);
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const i = (W * y + x) << 2;
  out.data[i] = out.data[i + 1] = out.data[i + 2] = 210;
}
// constellations (lignes)
function line(x0, y0, x1, y1, cr, cg, cb) {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
  for (let k = 0; k <= n; k++) {
    const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const i = (W * y + x) << 2;
    out.data[i] = cr; out.data[i + 1] = cg; out.data[i + 2] = cb;
  }
}
for (const c of space.constellations) {
  for (const [a, b] of c.links) {
    line(c.pts[a].x * SCALE, c.pts[a].y * SCALE, c.pts[b].x * SCALE, c.pts[b].y * SCALE, 120, 100, 165);
  }
}

// blit alpha d'une image redimensionnée (nearest, suffisant pour l'aperçu)
// Socles/îlots : PNG dans src/assets/space ; continents : les WebP du jeu ne
// sont pas lisibles par pngjs → on lit les PNG archivés (map-design/espace/detoures).
const DETOURES = path.join(ROOT, 'map-design', 'espace', 'detoures');
const cache = {};
const load = (name) => (cache[name] ??= PNG.sync.read(fs.readFileSync(
  fs.existsSync(path.join(ASSETS, `${name}.png`))
    ? path.join(ASSETS, `${name}.png`)
    : path.join(DETOURES, `${name}.png`)
)));
function blit(name, cx, cy, targetW) {
  const src = load(name);
  const w = Math.round(targetW), h = Math.round((targetW * src.height) / src.width);
  const ox = Math.round(cx - w / 2), oy = Math.round(cy - h / 2);
  for (let y = 0; y < h; y++) {
    const dy = oy + y;
    if (dy < 0 || dy >= H) continue;
    for (let x = 0; x < w; x++) {
      const dx = ox + x;
      if (dx < 0 || dx >= W) continue;
      const si = ((Math.floor((y * src.height) / h) * src.width) + Math.floor((x * src.width) / w)) << 2;
      const a = src.data[si + 3] / 255;
      if (a < 0.04) continue;
      const di = (W * dy + dx) << 2;
      for (let c = 0; c < 3; c++) out.data[di + c] = Math.round(src.data[si + c] * a + out.data[di + c] * (1 - a));
    }
  }
}

// continents
for (const l of space.layers) {
  blit(l.img, (l.x + l.w / 2) * SCALE, (l.y + l.h / 2) * SCALE, l.w * SCALE);
}
// traînées entre cases de l'espace
const isIlot = (id) => (space.socles[id] || '').startsWith('ilot');
for (const [id, n] of Object.entries(nodes)) {
  for (const to of n.next) {
    if (!isIlot(id) && !isIlot(to)) continue;
    line(n.x * SCALE, n.y * SCALE, nodes[to].x * SCALE, nodes[to].y * SCALE, 150, 135, 200);
  }
}
// socles/îlots (ou plateforme spéciale départ/arrivée/événement)
for (const [id, n] of Object.entries(nodes)) {
  const key = space.socles[id];
  const onContinent = (key || '').startsWith('socle');
  const specialKey = SPECIAL_CASE_ASSET[n.type];
  if (specialKey) {
    const w = (onContinent ? CASE_W_CONTINENT : CASE_W_SPACE) * SCALE;
    const dims = SPACE_ASSET_DIMS[specialKey];
    const h = (w * dims.h) / dims.w;
    blit(specialKey, n.x * SCALE, n.y * SCALE - CASE_TOP_DY * h, w);
  } else if (key) {
    const ilot = key.startsWith('ilot');
    const w = (ilot ? ILOT_W : SOCLE_W) * SCALE;
    const dims = SPACE_ASSET_DIMS[key];
    const h = (w * dims.h) / dims.w;
    const topDy = (ilot ? ILOT_TOP_DY : SOCLE_TOP_DY) * h;
    blit(key, n.x * SCALE, n.y * SCALE - topDy, w);
  }
}
// marqueur de piège sur quelques cases (aperçu) : 1 case subject sur 7
let ti = 0;
for (const [, n] of Object.entries(nodes)) {
  if (n.type !== 'subject') continue;
  if (ti++ % 7 !== 0) continue;
  blit('piege', n.x * SCALE, (n.y - 46 * 0.9) * SCALE, PIEGE_W * SCALE);
}

const outPath = path.join(ROOT, 'map-design', 'espace', 'check-board.png');
fs.writeFileSync(outPath, PNG.sync.write(out));
console.log('→', outPath);
