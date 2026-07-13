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

// Crop d'une cellule sur la bbox alpha + marge.
function cropCell(png, cx0, cy0, cx1, cy1, PAD = 6, ALPHA_MIN = 24) {
  const { width: w, data } = png;
  let bx0 = cx1, by0 = cy1, bx1 = cx0 - 1, by1 = cy0 - 1;
  for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
    if (data[(y * w + x) * 4 + 3] >= ALPHA_MIN) { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  }
  if (bx1 < bx0) return null;
  bx0 = Math.max(cx0, bx0 - PAD); by0 = Math.max(cy0, by0 - PAD);
  bx1 = Math.min(cx1 - 1, bx1 + PAD); by1 = Math.min(cy1 - 1, by1 + PAD);
  const ow = bx1 - bx0 + 1, oh = by1 - by0 + 1;
  const out = new PNG({ width: ow, height: oh });
  PNG.bitblt(png, out, bx0, by0, ow, oh, 0, 0);
  return out;
}

const crops = [];
for (const s of SHEETS) {
  const p = path.join(DL, s.f);
  if (!fs.existsSync(p)) { console.error('MANQUANT:', p); continue; }
  const png = PNG.sync.read(fs.readFileSync(p));
  detourage(png);
  const { width: w, height: h } = png;
  const cw = w / s.cols, ch = h / s.rows; let cnt = 0;
  for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
    const out = cropCell(png, Math.round(c * cw), Math.round(r * ch), Math.round((c + 1) * cw), Math.round((r + 1) * ch));
    if (out) { crops.push(out); cnt++; }
  }
  console.log(`${s.tag.padEnd(22)} ${s.f}  →  ${cnt}/${s.cols * s.rows}`);
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
