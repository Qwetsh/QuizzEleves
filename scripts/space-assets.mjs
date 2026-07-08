// Pipeline de détourage des assets de l'univers « espace » (maps v2).
// Entrées : map-design/espace/src/*.png (bruts, fonds magenta ou étoilé)
// Sorties : src/assets/space/*.png (détourés, trimés)
//
//   node scripts/space-assets.mjs
//
// - socles-continent-brut.png (fond magenta) → socle-1..3.png
// - ilots-espace-brut.png     (fond magenta) → ilot-1..5.png (débris rattachés)
// - continent-generique-brut.png (fond étoilé violet) → continent-generique.png
//   (flood fill depuis les bords : les étangs/cascades intérieurs sont préservés)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'map-design', 'espace', 'src');
const OUT = path.join(ROOT, 'src', 'assets', 'space');
fs.mkdirSync(OUT, { recursive: true });

const read = (f) => PNG.sync.read(fs.readFileSync(path.join(SRC, f)));
const write = (png, f) => {
  fs.writeFileSync(path.join(OUT, f), PNG.sync.write(png));
  console.log('  →', f, `${png.width}x${png.height}`);
};

// ---------------------------------------------------------------- helpers ---

// Magenta chroma key : min(r,b) domine nettement le vert
const isMagenta = (r, g, b) => Math.min(r, b) - g > 70;

// Pixel « espace » du fond étoilé : violet/bleu nuit (b domine le vert et
// n'est pas écrasé par le rouge), étoile blanche, ou quasi-noir bleuté.
const isSpace = (r, g, b) =>
  (b + 12 >= r && b > g + 8) ||
  (r > 205 && g > 195 && b > 205) ||
  (r + g + b < 80 && b >= r);

function idx(png, x, y) {
  return (png.width * y + x) << 2;
}

// Flood fill (4-connexité) depuis tous les bords, sur un prédicat.
function floodFromBorders(png, pred) {
  const { width: w, height: h, data } = png;
  const mask = new Uint8Array(w * h); // 1 = fond
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

// NOTE : pas de passe « poches enfermées » — testée puis retirée : elle mangeait
// les cascades/feuillages bleutés proches du bord, alors que d'éventuelles poches
// violettes résiduelles sont invisibles sur le fond spatial violet du jeu.

function applyMask(png, bgMask) {
  const { width: w, height: h, data } = png;
  for (let p = 0; p < w * h; p++) if (bgMask[p]) data[(p << 2) + 3] = 0;
  // Anti-frange : les pixels opaques qui touchent le fond sont légèrement
  // adoucis (alpha 210) pour casser l'escalier sans halo.
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

// Neutralise la frange magenta résiduelle sur les bords détourés.
function despillMagenta(png) {
  const { data } = png;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const spill = Math.min(r, b) - g;
    if (spill > 20) {
      data[i] = Math.min(r, g + 40);
      data[i + 2] = Math.min(b, g + 40);
    }
  }
}

function trim(png, pad = 2) {
  const { width: w, height: h, data } = png;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(idx(png, x, y)) + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('image vide après détourage');
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const out = new PNG({ width: maxX - minX + 1, height: maxY - minY + 1 });
  PNG.bitblt(png, out, minX, minY, out.width, out.height, 0, 0);
  return out;
}

// Composantes connexes sur alpha>0, agrégées autour des N plus grosses
// (les débris flottants sous chaque îlot restent rattachés à leur îlot).
function splitClusters(png, expected) {
  const { width: w, height: h, data } = png;
  const label = new Int32Array(w * h).fill(-1);
  const comps = [];
  for (let p = 0; p < w * h; p++) {
    if (label[p] !== -1 || data[(p << 2) + 3] === 0) continue;
    const id = comps.length;
    const comp = { id, pixels: [], minX: w, minY: h, maxX: 0, maxY: 0 };
    const stack = [p];
    label[p] = id;
    while (stack.length) {
      const q = stack.pop();
      comp.pixels.push(q);
      const x = q % w, y = (q / w) | 0;
      if (x < comp.minX) comp.minX = x;
      if (x > comp.maxX) comp.maxX = x;
      if (y < comp.minY) comp.minY = y;
      if (y > comp.maxY) comp.maxY = y;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const np = w * ny + nx;
        if (label[np] !== -1 || data[(np << 2) + 3] === 0) continue;
        label[np] = id;
        stack.push(np);
      }
    }
    comps.push(comp);
  }
  comps.sort((a, b) => b.pixels.length - a.pixels.length);
  const seeds = comps.slice(0, expected);
  const center = (c) => ({ x: (c.minX + c.maxX) / 2, y: (c.minY + c.maxY) / 2 });
  const clusters = seeds.map((s) => [s]);
  for (const c of comps.slice(expected)) {
    const cc = center(c);
    let best = 0, bd = Infinity;
    seeds.forEach((s, i) => {
      const sc = center(s);
      const d = Math.hypot(cc.x - sc.x, cc.y - sc.y);
      if (d < bd) { bd = d; best = i; }
    });
    clusters[best].push(c);
  }
  // Extraction : uniquement les pixels du cluster (pas la bbox brute)
  return clusters.map((cluster) => {
    const minX = Math.min(...cluster.map((c) => c.minX));
    const minY = Math.min(...cluster.map((c) => c.minY));
    const maxX = Math.max(...cluster.map((c) => c.maxX));
    const maxY = Math.max(...cluster.map((c) => c.maxY));
    const out = new PNG({ width: maxX - minX + 1, height: maxY - minY + 1 });
    const ids = new Set(cluster.map((c) => c.id));
    for (const c of cluster) {
      for (const q of c.pixels) {
        const x = q % w, y = (q / w) | 0;
        const si = q << 2;
        const di = (out.width * (y - minY) + (x - minX)) << 2;
        out.data[di] = data[si];
        out.data[di + 1] = data[si + 1];
        out.data[di + 2] = data[si + 2];
        out.data[di + 3] = data[si + 3];
      }
    }
    void ids;
    // tri gauche→droite puis haut→bas assuré par l'appelant
    return { png: out, minX, minY };
  });
}

// Downscale box-filter (facteur entier) pour alléger les socles.
function downscale(png, factor) {
  if (factor <= 1) return png;
  const w = Math.floor(png.width / factor), h = Math.floor(png.height / factor);
  const out = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const i = idx(png, x * factor + dx, y * factor + dy);
          const al = png.data[i + 3];
          r += png.data[i] * al; g += png.data[i + 1] * al; b += png.data[i + 2] * al;
          a += al; n++;
        }
      }
      const o = idx(out, x, y);
      out.data[o + 3] = Math.round(a / n);
      if (a > 0) {
        out.data[o] = Math.round(r / a);
        out.data[o + 1] = Math.round(g / a);
        out.data[o + 2] = Math.round(b / a);
      }
    }
  }
  return out;
}

// ------------------------------------------------------------------ socles ---

function processSheet(file, expected, baseName, scaleFactor, names = null) {
  console.log(file);
  const png = read(file);
  const bg = floodFromBorders(png, isMagenta);
  // le magenta est uniforme : on classe aussi les pixels magenta non atteints
  const { width: w, height: h, data } = png;
  for (let p = 0; p < w * h; p++) {
    const i = p << 2;
    if (!bg[p] && isMagenta(data[i], data[i + 1], data[i + 2])) bg[p] = 1;
  }
  applyMask(png, bg);
  despillMagenta(png);
  const parts = splitClusters(png, expected)
    .sort((a, b) => (a.minY + a.png.height / 2 > h * 0.55 ? 1 : 0) - (b.minY + b.png.height / 2 > h * 0.55 ? 1 : 0) || a.minX - b.minX);
  parts.forEach((part, i) => {
    const name = names ? names[i] : `${baseName}-${i + 1}`;
    write(downscale(trim(part.png), scaleFactor), `${name}.png`);
  });
}

// --------------------------------------------------------------- continent ---

function processContinent(file, outName) {
  console.log(file);
  const png = read(file);
  const bg = floodFromBorders(png, isSpace);
  applyMask(png, bg);
  write(trim(png), outName);
}

processSheet('socles-continent-brut.png', 3, 'socle', 2);
processSheet('ilots-espace-brut.png', 5, 'ilot', 1);
// Cases spéciales (2026-07-06 soir) : gauche→droite = départ, arrivée, événement
processSheet('cases-speciales-brut.png', 3, 'case', 2, ['case-depart', 'case-arrivee', 'case-event']);
// Marqueur de piège (remplace l'emoji 🪤 sur le plateau)
processSheet('piege-brut.png', 1, 'piege', 2, ['piege']);
processContinent('continent-generique-brut.png', 'continent-generique.png');
console.log('OK');
