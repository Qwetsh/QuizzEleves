// Supprime le damier "fausse transparence" peint dans les planches d'assets
// generees par IA, et produit un vrai PNG avec canal alpha.
//
// Methode :
//  1. Les 2 gris du damier sont estimes depuis les bords de l'image.
//  2. Un remplissage par propagation (BFS) part des bords et traverse les
//     pixels qui matchent l'un des 2 gris (damier nu) OU une version
//     assombrie uniforme de ceux-ci (ombres portees sur le damier).
//     -> un blanc/gris A L'INTERIEUR d'un objet n'est jamais atteint.
//  3. Damier nu -> alpha 0 ; ombre -> noir semi-transparent (demelange) ;
//     bords d'objets -> alpha lisse (feathering par demelange).
//
// Usage : node scripts/strip-checker.mjs <in.png> [...] --out <dir>

import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx !== -1 ? args[outIdx + 1] : 'art/board-sheets/clean';
const tolIdx = args.indexOf('--tol');
const skip = new Set();
if (outIdx !== -1) { skip.add(outIdx); skip.add(outIdx + 1); }
if (tolIdx !== -1) { skip.add(tolIdx); skip.add(tolIdx + 1); }
const inputs = args.filter((_, i) => !skip.has(i));
fs.mkdirSync(outDir, { recursive: true });

// --tol : tolerance de match du damier (defaut 16) — monter si le damier
// peint varie en luminosite et laisse des residus
const MATCH_TOL = tolIdx !== -1 ? Number(args[tolIdx + 1]) : 16;
const SHADOW_MIN = 0.45;     // assombrissement max tolere pour une ombre
const SHADOW_DEV = 14;       // uniformite du ratio entre canaux
const FEATHER_DIST = 40;     // distance couleur -> alpha plein sur les bords

function estimateCheckerColors(png) {
  // Histogramme grossier des pixels du pourtour (4 px de marge)
  const { width: w, height: h, data } = png;
  const counts = new Map();
  const sample = (x, y) => {
    const i = (y * w + x) * 4;
    const key = `${data[i] >> 3}_${data[i + 1] >> 3}_${data[i + 2] >> 3}`;
    const e = counts.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    e.n++; e.r += data[i]; e.g += data[i + 1]; e.b += data[i + 2];
    counts.set(key, e);
  };
  for (let x = 0; x < w; x++) for (const y of [0, 1, 2, 3, h - 4, h - 3, h - 2, h - 1]) sample(x, y);
  for (let y = 0; y < h; y++) for (const x of [0, 1, 2, 3, w - 4, w - 3, w - 2, w - 1]) sample(x, y);
  const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 2);
  return top.map((e) => [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)]);
}

function processSheet(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: w, height: h, data } = png;
  const [c1, c2] = estimateCheckerColors(png);
  console.log(`${path.basename(file)} : damier estime rgb(${c1}) / rgb(${c2})`);

  // Pour chaque pixel : distance au gris du damier le plus proche, et
  // detection d'ombre (C ~= d * checker, d uniforme sur les canaux)
  const distTo = (i, c) => Math.max(
    Math.abs(data[i] - c[0]), Math.abs(data[i + 1] - c[1]), Math.abs(data[i + 2] - c[2])
  );
  const classify = (i) => {
    const d1 = distTo(i, c1);
    const d2 = distTo(i, c2);
    const cNear = d1 <= d2 ? c1 : c2;
    const dMin = Math.min(d1, d2);
    if (dMin < MATCH_TOL) return { kind: 'bg', cNear };
    // ombre : ratio uniforme < 1 sur les 3 canaux du gris le plus proche
    const r0 = data[i] / cNear[0];
    const r1 = data[i + 1] / cNear[1];
    const r2 = data[i + 2] / cNear[2];
    const mean = (r0 + r1 + r2) / 3;
    if (mean >= SHADOW_MIN && mean < 0.985) {
      const dev = Math.max(
        Math.abs(data[i] - cNear[0] * mean),
        Math.abs(data[i + 1] - cNear[1] * mean),
        Math.abs(data[i + 2] - cNear[2] * mean)
      );
      if (dev < SHADOW_DEV) return { kind: 'shadow', cNear, d: mean };
    }
    return { kind: 'fg', cNear, dMin };
  };

  // BFS depuis les bords a travers bg/shadow
  const state = new Uint8Array(w * h); // 0=non visite, 1=bg, 2=ombre
  const queue = [];
  const push = (x, y) => {
    const p = y * w + x;
    if (state[p]) return;
    const cl = classify(p * 4);
    if (cl.kind === 'bg') { state[p] = 1; queue.push(p); }
    else if (cl.kind === 'shadow') { state[p] = 2; queue.push(p); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (queue.length) {
    const p = queue.pop();
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  // Application de l'alpha
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (state[p] === 1) {
      data[i + 3] = 0;
    } else if (state[p] === 2) {
      // Ombre : noir semi-transparent (demelange C = a*0 + (1-a)*B)
      const cl = classify(i);
      const a = Math.round(255 * (1 - (cl.d ?? 0.9)) * 0.9);
      data[i] = 30; data[i + 1] = 22; data[i + 2] = 10;
      data[i + 3] = Math.min(160, a);
    }
  }

  // Feathering : pixels opaques touchant le fond -> alpha proportionnel a la
  // distance couleur au damier, couleur demelangee
  const out = Buffer.from(data); // lire l'etat fige, ecrire dans out
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (state[p]) continue;
      let nearBg = false;
      for (let dy = -1; dy <= 1 && !nearBg; dy++) {
        for (let dx = -1; dx <= 1 && !nearBg; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (state[ny * w + nx] === 1) nearBg = true;
        }
      }
      if (!nearBg) continue;
      const i = p * 4;
      const d1 = distTo(i, c1);
      const d2 = distTo(i, c2);
      const cNear = d1 <= d2 ? c1 : c2;
      const a = Math.min(255, Math.round((Math.min(d1, d2) / FEATHER_DIST) * 255));
      if (a >= 250) continue;
      const af = Math.max(a, 24) / 255;
      for (let c = 0; c < 3; c++) {
        out[i + c] = Math.max(0, Math.min(255, Math.round((data[i + c] - (1 - af) * cNear[c]) / af)));
      }
      out[i + 3] = a;
    }
  }
  png.data = out;

  const dest = path.join(outDir, path.basename(file));
  fs.writeFileSync(dest, PNG.sync.write(png));
  const bgPct = Math.round((100 * state.filter((s) => s === 1).length) / (w * h));
  console.log(`  -> ${dest} (${bgPct}% de fond supprime)`);
}

for (const f of inputs) processSheet(f);
