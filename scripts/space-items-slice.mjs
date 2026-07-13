// Détourage (fond MAGENTA) + découpe en grille de planches d'icônes pixel-art
// (casques / armures / amulettes / consommables), générées par IA sur fond
// magenta plein. Sortie : PNG alpha individuels + une planche « _preview.png ».
//
//   node scripts/space-items-slice.mjs [outDir]
//
// Stratégie de détourage : identique en esprit à dechecker-slice.mjs mais pour un
// fond SATURÉ. On échantillonne la bordure → couleur(s) de fond dominante(s), puis
// remplissage par DIFFUSION (flood fill 4-connexe) depuis les bords : seuls les
// pixels magenta CONNECTÉS au bord disparaissent. Les détails violets/roses À
// L'INTÉRIEUR des objets (cristaux, capes, potions) restent car isolés par les
// contours sombres du pixel-art. Une passe « anti-halo » gomme le liseré d'anti-
// aliasing magenta restant au bord des objets.
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const OUT = process.argv[2] || 'art/space-items';
fs.mkdirSync(OUT, { recursive: true });

const DL = 'C:/Users/Utilisateur/Downloads';
const F = (n) => `ChatGPT Image 13 juil. 2026, ${n}.png`;

// 10 planches uniques (les « - Copie » sont des doublons, ignorés). cols×rows =
// disposition de la grille. Ordre = tête → corps → pieds → consommables.
const SHEETS = [
  { f: F('12_13_38'),     cols: 4, rows: 3, tag: 'mixte(tête/corps/pieds)' },
  { f: F('12_13_53 (2)'), cols: 4, rows: 3, tag: 'casques' },
  { f: F('12_20_19 (1)'), cols: 4, rows: 3, tag: 'casques' },
  { f: F('12_13_53 (1)'), cols: 4, rows: 3, tag: 'armures' },
  { f: F('12_20_19 (2)'), cols: 4, rows: 3, tag: 'armures' },
  { f: F('12_13_55 (4)'), cols: 4, rows: 4, tag: 'amulettes' },
  { f: F('12_20_19 (3)'), cols: 4, rows: 4, tag: 'amulettes' },
  { f: F('12_13_43'),     cols: 4, rows: 4, tag: 'consommables' },
  { f: F('12_13_54 (3)'), cols: 4, rows: 4, tag: 'consommables' },
  { f: F('12_20_19 (4)'), cols: 4, rows: 4, tag: 'consommables' },
];

function detourage(png) {
  const { width: w, height: h, data } = png;
  // 1) Couleur(s) de fond : histogramme quantifié des 4 px de bordure → 2 dominantes.
  const hist = new Map();
  const sample = (x, y) => {
    const i = (y * w + x) * 4;
    const k = (data[i] >> 3) + ',' + (data[i + 1] >> 3) + ',' + (data[i + 2] >> 3);
    hist.set(k, (hist.get(k) || 0) + 1);
  };
  for (let x = 0; x < w; x++) for (let b = 0; b < 4; b++) { sample(x, b); sample(x, h - 1 - b); }
  for (let y = 0; y < h; y++) for (let b = 0; b < 4; b++) { sample(b, y); sample(w - 1 - b, y); }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)
    .map(([k]) => k.split(',').map((n) => Number(n) << 3));

  const near = (r, g, b, tol) => top.some((c) => Math.abs(r - c[0]) <= tol && Math.abs(g - c[1]) <= tol && Math.abs(b - c[2]) <= tol);
  // Fond = proche d'une teinte de bordure ET « en forme de magenta » (R et B >> G).
  const TOL = 48;
  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (g > 160) return false;                     // clair/vert = objet
    if ((r - g) < 30 && (b - g) < 20) return false; // pas assez magenta
    return near(r, g, b, TOL);
  };

  // 2) Diffusion depuis les bords (pile explicite).
  const seen = new Uint8Array(w * h);
  const st = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x; if (seen[p]) return; seen[p] = 1;
    if (isBg(p * 4)) { data[p * 4 + 3] = 0; st.push(p); }
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) { const p = st.pop(); const x = p % w, y = (p / w) | 0; push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1); }

  // 3) Anti-halo : gomme le liseré rose/magenta d'anti-aliasing au bord des objets.
  // Test de TEINTE (pas de proximité au fond) pour attraper aussi les halos teintés
  // par l'objet (rose doré sur un anneau d'or). On ne gomme QUE des pixels TOUCHANT
  // déjà du transparent → le magenta INTÉRIEUR (sable de sablier, potion) est
  // protégé. `r >= b - 25` distingue le halo (R≈B, magenta) du VIOLET des objets
  // (B ≫ R, ex. cristaux) qui reste intact.
  const isHalo = (i) => {
    if (data[i + 3] === 0) return false;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    return r > 90 && b > 70 && g < r - 25 && g < b - 15 && r >= b - 25;
  };
  for (let pass = 0; pass < 6; pass++) {
    const kill = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; if (data[p * 4 + 3] === 0) continue; if (!isHalo(p * 4)) continue;
      const nb = (x > 0 && data[(p - 1) * 4 + 3] === 0) || (x < w - 1 && data[(p + 1) * 4 + 3] === 0)
        || (y > 0 && data[(p - w) * 4 + 3] === 0) || (y < h - 1 && data[(p + w) * 4 + 3] === 0);
      if (nb) kill.push(p);
    }
    if (!kill.length) break;
    for (const p of kill) data[p * 4 + 3] = 0;
  }
}

const ALPHA_MIN = 24, PAD = 6;

// Crop de la bbox alpha DANS un rectangle donné, marge PAD étendue jusqu'aux
// bords de l'image (le pourtour est transparent → aucune fuite).
function cropRect(png, rx0, ry0, rx1, ry1) {
  const { width: w, height: h, data } = png;
  let bx0 = rx1, by0 = ry1, bx1 = rx0 - 1, by1 = ry0 - 1;
  for (let y = ry0; y <= ry1; y++) for (let x = rx0; x <= rx1; x++) {
    if (data[(y * w + x) * 4 + 3] >= ALPHA_MIN) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  }
  if (bx1 < bx0) return null;
  bx0 = Math.max(0, bx0 - PAD); by0 = Math.max(0, by0 - PAD);
  bx1 = Math.min(w - 1, bx1 + PAD); by1 = Math.min(h - 1, by1 + PAD);
  const ow = bx1 - bx0 + 1, oh = by1 - by0 + 1;
  const out = new PNG({ width: ow, height: oh });
  PNG.bitblt(png, out, bx0, by0, ow, oh, 0, 0);
  return out;
}

// Bandes de CONTENU dans un profil de projection : runs où sum > minContent,
// fusionnés si séparés par un vide < gapMerge, gardés si longueur >= minLen.
function bands(sum, minContent, gapMerge, minLen) {
  const runs = []; let s = -1;
  for (let i = 0; i < sum.length; i++) {
    const c = sum[i] > minContent;
    if (c && s < 0) s = i;
    if (!c && s >= 0) { runs.push([s, i - 1]); s = -1; }
  }
  if (s >= 0) runs.push([s, sum.length - 1]);
  const merged = [];
  for (const r of runs) {
    const last = merged[merged.length - 1];
    if (last && r[0] - last[1] - 1 <= gapMerge) last[1] = r[1];
    else merged.push([...r]);
  }
  return merged.filter((r) => r[1] - r[0] + 1 >= minLen);
}

// Divise [lo,hi] en n segments égaux (repli quand la détection ne rend pas n bandes).
function equalBands(lo, hi, n) {
  const out = []; const span = hi - lo + 1;
  for (let i = 0; i < n; i++) out.push([Math.round(lo + span * i / n), Math.round(lo + span * (i + 1) / n) - 1]);
  return out;
}

const crops = [];
for (const s of SHEETS) {
  const p = path.join(DL, s.f);
  if (!fs.existsSync(p)) { console.error('MANQUANT:', p); continue; }
  const png = PNG.sync.read(fs.readFileSync(p));
  detourage(png);
  const { width: w, height: h, data } = png;
  const cellH = h / s.rows, cellW = w / s.cols;

  // Profil vertical global → bandes de rangées. Repli : étendue de contenu / rows.
  const rowSum = new Array(h).fill(0);
  for (let y = 0; y < h; y++) { let a = 0; for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] >= ALPHA_MIN) a++; rowSum[y] = a; }
  let ybands = bands(rowSum, 3, Math.round(cellH * 0.30), Math.round(cellH * 0.35));
  let yFallback = false;
  if (ybands.length !== s.rows) {
    yFallback = true;
    let ymin = h, ymax = -1; for (let y = 0; y < h; y++) if (rowSum[y] > 3) { if (y < ymin) ymin = y; if (y > ymax) ymax = y; }
    if (ymax < ymin) { ymin = 0; ymax = h - 1; }
    ybands = equalBands(ymin, ymax, s.rows);
  }

  let cnt = 0, colFallbacks = 0;
  for (const [y0, y1] of ybands) {
    const colSum = new Array(w).fill(0);
    for (let x = 0; x < w; x++) { let a = 0; for (let y = y0; y <= y1; y++) if (data[(y * w + x) * 4 + 3] >= ALPHA_MIN) a++; colSum[x] = a; }
    let xbands = bands(colSum, 2, Math.round(cellW * 0.30), Math.round(cellW * 0.18));
    if (xbands.length !== s.cols) {
      colFallbacks++;
      let xmin = w, xmax = -1; for (let x = 0; x < w; x++) if (colSum[x] > 2) { if (x < xmin) xmin = x; if (x > xmax) xmax = x; }
      if (xmax < xmin) { xmin = 0; xmax = w - 1; }
      xbands = equalBands(xmin, xmax, s.cols);
    }
    for (const [x0, x1] of xbands) {
      const out = cropRect(png, x0, y0, x1, y1);
      if (out) { crops.push(out); cnt++; }
    }
  }
  const flags = `${yFallback ? ' [Y=repli]' : ''}${colFallbacks ? ` [X=repli×${colFallbacks}]` : ''}`;
  console.log(`${s.tag.padEnd(22)} ${s.f}  →  ${cnt}/${s.cols * s.rows}${flags}`);
}

crops.forEach((c, i) => fs.writeFileSync(path.join(OUT, `space${String(i + 1).padStart(3, '0')}.png`), PNG.sync.write(c)));
console.log(`\nTOTAL ${crops.length} icônes → ${OUT}`);

// --- Planche de prévisualisation (fond gris) pour vérif visuelle ------------
const CELL = 118, COLS = 12, MARG = 5;
const ROWS = Math.ceil(crops.length / COLS);
const mw = COLS * CELL, mh = ROWS * CELL;
const mont = new PNG({ width: mw, height: mh });
for (let i = 0; i < mw * mh; i++) { mont.data[i * 4] = 52; mont.data[i * 4 + 1] = 52; mont.data[i * 4 + 2] = 58; mont.data[i * 4 + 3] = 255; }
const blit = (src, dx, dy) => {
  const box = CELL - 2 * MARG;
  const sc = Math.min(box / src.width, box / src.height, 1);
  const dw = Math.max(1, Math.round(src.width * sc)), dh = Math.max(1, Math.round(src.height * sc));
  const ox = dx + Math.round((CELL - dw) / 2), oy = dy + Math.round((CELL - dh) / 2);
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const sx = Math.min(src.width - 1, Math.floor(x / sc)), sy = Math.min(src.height - 1, Math.floor(y / sc));
    const si = (sy * src.width + sx) * 4; const a = src.data[si + 3] / 255; if (a <= 0.02) continue;
    const mx = ox + x, my = oy + y; if (mx < 0 || my < 0 || mx >= mw || my >= mh) continue;
    const mi = (my * mw + mx) * 4;
    mont.data[mi] = Math.round(src.data[si] * a + mont.data[mi] * (1 - a));
    mont.data[mi + 1] = Math.round(src.data[si + 1] * a + mont.data[mi + 1] * (1 - a));
    mont.data[mi + 2] = Math.round(src.data[si + 2] * a + mont.data[mi + 2] * (1 - a));
  }
};
crops.forEach((c, i) => blit(c, (i % COLS) * CELL, ((i / COLS) | 0) * CELL));
fs.writeFileSync(path.join(OUT, '_preview.png'), PNG.sync.write(mont));
console.log('Prévisualisation → ' + path.join(OUT, '_preview.png'));
