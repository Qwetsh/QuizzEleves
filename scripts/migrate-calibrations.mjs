// MIGRATION ONE-OFF des calibrations utilisateur (2026-07-06).
//
// Contexte : les 24 calibrations de src/data/maps/calibrations.js ont été faites
// sur les assets du pipeline « v5 » (érosion 10, dropSpecks taille seule). Le
// pipeline « v6 » (érosion 5 + suppression des fragments de nébuleuse) change le
// recadrage (trim) → les coordonnées seraient décalées. Le pipeline étant
// DÉTERMINISTE, on rejoue la v5 pour retrouver l'ancienne origine de trim, et on
// translate : pt_v6 = pt_v5 + origine_v5 − origine_v6.
//
//   node scripts/migrate-calibrations.mjs
//
// Réécrit src/data/maps/calibrations.js. À jeter après usage (les origines de
// trim sont désormais stockées dans continentsGen.js pour les prochaines fois).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { CALIBRATIONS } from '../src/data/maps/calibrations.js';
import { CONTINENT_DIMS } from '../src/data/maps/continentsGen.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'map-design', 'espace', 'src', 'continents');

// theme → fichier source (extrait de THEME_MAP de space-continents.mjs)
const SOURCE_OF = {
  harrypotter: ['c01', 'bottom'],
  tele_celebrites: ['c02'], bd_comics_manga: ['c03'], jeux_de_societe: ['c04'],
  jeux_video: ['c05'], musique_populaire: ['c06'], series_tv: ['c07'], cinema: ['c08'],
  cyclisme: ['c09'], sports_mecaniques: ['c10'], athletisme_jo: ['c11'],
  tennis_raquettes: ['c12'], sports_collectifs: ['c13'],
  monde_contemporain: ['c14'], xxe_siecle: ['c15'], revolutions_xixe: ['c16'],
  epoque_moderne: ['c17'], prehistoire_antiquite: ['c18'],
  animaux: ['c19'], plantes_botanique: ['c20'], corps_humain_sante: ['c21'],
  ecologie_environnement: ['c22'], geologie_mineraux: ['c23'],
  maths_logique: ['c24'], physique: ['c25'], chimie: ['c26'], astronomie_espace: ['c27'],
  informatique_numerique: ['c28'], inventions_technologies: ['c29'],
  geographie_physique: ['c30'], villes_monuments: ['c31'], pays_capitales: ['c32'],
  drapeaux_symboles: ['c33'], mers_deserts_reperes: ['c34'], moyen_age: ['c35'],
};

// ---- reproduction EXACTE du pipeline v5 (voir space-continents.mjs historique) ----

function buildBgTest(png) {
  const { width: w, height: h, data } = png;
  const counts = new Map();
  const sample = (x, y) => {
    const i = (w * y + x) << 2;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (let x = 0; x < w; x += 2) for (const y of [0, 1, 2, 3, h - 4, h - 3, h - 2, h - 1]) sample(x, y);
  for (let y = 0; y < h; y += 2) for (const x of [0, 1, 2, 3, w - 4, w - 3, w - 2, w - 1]) sample(x, y);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const allowed = new Set();
  for (const [key, c] of counts) if (c >= total * 0.001) allowed.add(key);
  return (r, g, b) => {
    if (r > 205 && g > 200 && b > 200) return true;
    return allowed.has(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
  };
}

function floodFromBorders(png) {
  const { width: w, height: h, data } = png;
  const pred = buildBgTest(png);
  const mask = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const p = w * y + x;
    if (mask[p]) return;
    const i = p << 2;
    if (!pred(data[i], data[i + 1], data[i + 2])) return;
    mask[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  return mask;
}

function buildLoosePalette(png, bgMask) {
  const { width: w, height: h, data } = png;
  const counts = new Map();
  let total = 0;
  for (let p = 0; p < w * h; p += 3) {
    if (!bgMask[p]) continue;
    const i = p << 2;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    counts.set(key, (counts.get(key) || 0) + 1);
    total++;
  }
  const loose = new Set();
  for (const [key, c] of counts) {
    if (c < total * 0.001) continue;
    const r = (key >> 8) & 15, g = (key >> 4) & 15, b = key & 15;
    for (let dr = -1; dr <= 1; dr++) for (let dg = -1; dg <= 1; dg++) for (let db = -1; db <= 1; db++) {
      const nr = r + dr, ng = g + dg, nb = b + db;
      if (nr < 0 || ng < 0 || nb < 0 || nr > 15 || ng > 15 || nb > 15) continue;
      loose.add((nr << 8) | (ng << 4) | nb);
    }
  }
  return (p) => {
    const i = p << 2;
    return loose.has(((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4));
  };
}

// v5 : profondeur 10
function erodeFringeV5(png, bgMask, inLoose, depth = 10) {
  const { width: w, height: h } = png;
  let frontier = [];
  for (let p = 0; p < w * h; p++) if (bgMask[p]) frontier.push(p);
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const p of frontier) {
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q < 0 || bgMask[q] || !inLoose(q)) continue;
        bgMask[q] = 1;
        next.push(q);
      }
    }
    frontier = next;
  }
}

// v5 : taille seule, pas de règle couleur/sombre
function dropSpecksV5(png, bgMask, minKeep = 260) {
  const { width: w, height: h } = png;
  const seen = new Uint8Array(w * h);
  for (let p0 = 0; p0 < w * h; p0++) {
    if (seen[p0] || bgMask[p0]) continue;
    const comp = [];
    const stack = [p0];
    seen[p0] = 1;
    while (stack.length) {
      const q = stack.pop();
      comp.push(q);
      const x = q % w, y = (q / w) | 0;
      for (const n of [x > 0 ? q - 1 : -1, x < w - 1 ? q + 1 : -1, y > 0 ? q - w : -1, y < h - 1 ? q + w : -1]) {
        if (n < 0 || seen[n] || bgMask[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
    if (comp.length < minKeep) comp.forEach((q) => { bgMask[q] = 1; });
  }
}

function applyMaskAlpha(png, bgMask) {
  const { width: w, height: h, data } = png;
  for (let p = 0; p < w * h; p++) if (bgMask[p]) data[(p << 2) + 3] = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = w * y + x;
      if (bgMask[p]) continue;
      const touches =
        (x > 0 && bgMask[p - 1]) || (x < w - 1 && bgMask[p + 1]) ||
        (y > 0 && bgMask[p - w]) || (y < h - 1 && bgMask[p + w]);
      if (touches) data[(p << 2) + 3] = 210;
    }
  }
}

function trimBounds(png, pad = 2) {
  const { width: w, height: h, data } = png;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[((w * y + x) << 2) + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { ox: Math.max(0, minX - pad), oy: Math.max(0, minY - pad) };
}

function crop(png, x0, y0, w, h) {
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, x0, y0, w, h, 0, 0);
  return out;
}

// ------------------------------------------------------------------- marche ---

const migrated = {};
for (const [img, cal] of Object.entries(CALIBRATIONS)) {
  const theme = img.slice(5);
  const [srcId, half] = SOURCE_OF[theme];
  let png = PNG.sync.read(fs.readFileSync(path.join(SRC, `${srcId}.png`)));
  if (half === 'bottom') {
    const mid = Math.round(png.height / 2);
    png = crop(png, 0, mid, png.width, png.height - mid);
  }
  // origine v5
  const bg = floodFromBorders(png);
  const inLoose = buildLoosePalette(png, bg);
  erodeFringeV5(png, bg, inLoose);
  dropSpecksV5(png, bg);
  applyMaskAlpha(png, bg);
  const v5 = trimBounds(png);
  // origine v6 (stockée dans continentsGen)
  const v6 = CONTINENT_DIMS[theme];
  const dx = v5.ox - v6.ox, dy = v5.oy - v6.oy;
  const pt = (p) => ({ x: p.x + dx, y: p.y + dy });
  migrated[img] = {
    img, w: v6.w, h: v6.h,
    in: pt(cal.in), out: pt(cal.out), jin: pt(cal.jin), jout: pt(cal.jout),
    route: cal.route.map(pt),
  };
  console.log(`${img}: v5(${v5.ox},${v5.oy}) v6(${v6.ox},${v6.oy}) → décalage (${dx >= 0 ? '+' : ''}${dx}, ${dy >= 0 ? '+' : ''}${dy}), ${cal.w}x${cal.h} → ${v6.w}x${v6.h}`);
}

// réécrit calibrations.js
const fmt = (p) => `{ x: ${p.x}, y: ${p.y} }`;
const body = Object.entries(migrated).map(([img, c]) => `  '${img}': {
    img: '${img}', w: ${c.w}, h: ${c.h},
    in: ${fmt(c.in)}, out: ${fmt(c.out)},
    jin: ${fmt(c.jin)}, jout: ${fmt(c.jout)},
    route: [
${c.route.map((p) => `      ${fmt(p)},`).join('\n')}
    ],
  },`).join('\n');

const content = `// Calibrations FINES des continents thématiques — exports du MapCalibrator
// (?calibrate), collés tels quels (clé = nom d'asset). Prioritaires sur la
// projection proportionnelle du générique (cf. espace.js).
//
// Lot utilisateur du 2026-07-06 (24 continents), MIGRÉ par
// scripts/migrate-calibrations.mjs après le re-détourage v6 (le trim a changé ;
// les origines sont désormais suivies dans continentsGen.js).
// Restent en projection dérivée : tele_celebrites, series_tv,
// prehistoire_antiquite, revolutions_xixe, xxe_siecle, plantes_botanique,
// physique, sports_collectifs, sports_mecaniques, tennis_raquettes,
// villes_monuments, religions_mythologies.

export const CALIBRATIONS = {
${body}
};
`;
fs.writeFileSync(path.join(ROOT, 'src', 'data', 'maps', 'calibrations.js'), content);
console.log('→ src/data/maps/calibrations.js réécrit');
