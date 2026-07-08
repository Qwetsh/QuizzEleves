// Traitement du LOT de continents thématiques (maps v2 espace).
//
//   node scripts/space-continents.mjs
//
// - c01.png est une image double → découpée en 2 panneaux (haut/bas).
// - Détourage par flood fill depuis les bords avec PALETTE ADAPTATIVE :
//   les couleurs de fond sont échantillonnées sur le pourtour de CHAQUE image
//   (violettes, dorées, vertes, bleues… peu importe), + règle « étoile blanche ».
// - Sorties trimées : src/assets/space/cont-{theme}.png (plat, ramassé par le
//   glob existant de BoardSVG).
// - Planches de contrôle sur fond vert : map-design/espace/check-continents-N.png

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'map-design', 'espace', 'src', 'continents');
// PNG détourés pleine qualité (archive + scripts de contrôle pngjs)
const OUT_PNG = path.join(ROOT, 'map-design', 'espace', 'detoures');
// WebP embarqués dans le jeu (q82 ≈ ÷7 vs PNG)
const OUT_WEBP = path.join(ROOT, 'src', 'assets', 'space');
const CHECK = path.join(ROOT, 'map-design', 'espace');
fs.mkdirSync(OUT_PNG, { recursive: true });

// Attribution des thèmes (identification visuelle du 2026-07-06 ; c01a confirmé
// SKYRIM par l'utilisateur — pack bonus jeu vidéo, comme harrypotter).
// DOUTE restant : c31/c32 (villes_monuments vs pays_capitales).
const THEME_MAP = {
  c01a: 'skyrim',
  c01b: 'harrypotter',
  c02: 'tele_celebrites',
  c03: 'bd_comics_manga',
  c04: 'jeux_de_societe',
  c05: 'jeux_video',
  c06: 'musique_populaire',
  c07: 'series_tv',
  c08: 'cinema',
  c09: 'cyclisme',
  c10: 'sports_mecaniques',
  c11: 'athletisme_jo',
  c12: 'tennis_raquettes',
  c13: 'sports_collectifs',
  c14: 'monde_contemporain',
  c15: 'xxe_siecle',
  c16: 'revolutions_xixe',
  c17: 'epoque_moderne',
  c18: 'prehistoire_antiquite',
  c19: 'animaux',
  c20: 'plantes_botanique',
  c21: 'corps_humain_sante',
  c22: 'ecologie_environnement',
  c23: 'geologie_mineraux',
  c24: 'maths_logique',
  c25: 'physique',
  c26: 'chimie',
  c27: 'astronomie_espace',
  c28: 'informatique_numerique',
  c29: 'inventions_technologies',
  c30: 'geographie_physique',
  c31: 'villes_monuments',
  c32: 'pays_capitales',
  c33: 'drapeaux_symboles',
  c34: 'mers_deserts_reperes',
  c35: 'moyen_age',
  // Lot 2 (2026-07-06 après-midi) : Arts (fond rose) + Société (fond rouge)
  c36: 'peinture_sculpture',
  c37: 'litterature_auteurs',
  c38: 'photographie_arts_visuels',
  c39: 'musique_classique_opera',
  c40: 'architecture_design',
  c41: 'politique_institutions',
  c42: 'economie_marques_logos',
  c43: 'religions_mythologies',
  c44: 'gastronomie_cuisine',
  c45: 'langues_expressions',
  c46: 'fetes_traditions_symboles',
  // Sous-thème Cinéma (2026-07-06 soir) : manoir hanté, citrouilles, cimetière
  c47: 'film_horreur',
};

// ---------------------------------------------------------------- helpers ---

// Palette de fond adaptative à BUCKETS EXACTS (16 niveaux/canal, quantification
// 12 bits) : les couleurs du pourtour de CHAQUE image forment la palette du fond.
// PAS d'élargissement aux buckets voisins — testé : l'expansion ±1 fusionnait
// « brun sombre de nébuleuse » et « brun sombre de roche » et rongeait tous les
// continents à fond doré. En exact, ces bruns tombent dans des buckets distincts,
// et la connexité (flood depuis les bords) protège l'intérieur. Le prix : une
// frange de pixels anti-aliasés (mi-fond mi-roche, hors palette) subsiste par
// endroits au ras de la silhouette — invisible à l'échelle du jeu (0.66) et
// adoucie par l'alpha 210 du bord.
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
  for (const [key, c] of counts) {
    if (c >= total * 0.001) allowed.add(key);
  }
  return (r, g, b) => {
    if (r > 205 && g > 200 && b > 200) return true; // étoiles / constellations
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

// Érosion de frange : les mèches de nébuleuse restées ACCROCHÉES à la silhouette
// (hors palette exacte à cause de l'anti-aliasing) sont retirées par une passe
// à palette ÉLARGIE (buckets ±1), mais limitée à `depth` px de profondeur depuis
// le fond déjà détouré — impossible de ronger l'intérieur du continent.
// Palette « élargie » (buckets ±1) construite sur le FOND DÉTECTÉ tout entier :
// les mèches vives de nébuleuse qui collent au continent ont leurs couleurs
// ailleurs dans le fond, même si elles sont rares au bord de l'image.
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

// Profondeur 5 (et pas plus) : à 10, les stalactites rocheuses fines des
// continents à fond doré se faisaient ronger (brun roche ≈ brun nébuleuse
// dans la palette élargie).
function erodeFringe(png, bgMask, inLoose, depth = 5) {
  const { width: w, height: h } = png;
  let frontier = [];
  for (let p = 0; p < w * h; p++) if (bgMask[p]) frontier.push(p);
  let removed = 0;
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const p of frontier) {
      const x = p % w, y = (p / w) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q < 0 || bgMask[q] || !inLoose(q)) continue;
        bgMask[q] = 1;
        next.push(q);
        removed++;
      }
    }
    frontier = next;
  }
  return removed;
}

// Nettoyage post-flood des composantes opaques détachées du continent :
// - minuscules (< minKeep px) → taches, transparentes ;
// - moyennes (< maxCheck px) majoritairement aux couleurs du fond → MORCEAUX
//   DE NÉBULEUSE (les gros fragments dorés qui survivaient au seuil de taille),
//   transparents. Les îlots satellites (roche/herbe, hors palette) sont gardés.
function dropSpecks(png, bgMask, inLoose, minKeep = 260, maxCheck = 22000) {
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
    if (comp.length < minKeep) {
      comp.forEach((q) => { bgMask[q] = 1; });
    } else if (comp.length < maxCheck) {
      // couleurs de fond majoritaires OU aucun pixel sombre (un îlot rocheux a
      // toujours son encrage/ses ombres ; un flare de nébuleuse, jamais)
      let bgLike = 0, dark = 0;
      const { data } = png;
      for (const q of comp) {
        if (inLoose(q)) bgLike++;
        const i = q << 2;
        if (data[i] + data[i + 1] + data[i + 2] < 210) dark++;
      }
      if (bgLike / comp.length > 0.6 || dark / comp.length < 0.04) {
        comp.forEach((q) => { bgMask[q] = 1; });
      }
    }
  }
}

function applyMask(png, bgMask) {
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

function trim(png, pad = 2) {
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
  if (maxX < 0) throw new Error('image vide après détourage');
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const out = new PNG({ width: maxX - minX + 1, height: maxY - minY + 1 });
  PNG.bitblt(png, out, minX, minY, out.width, out.height, 0, 0);
  // origine du recadrage dans l'image source : indispensable pour MIGRER les
  // calibrations quand un re-traitement change le trim (cf. continentsGen.js)
  out.trimOrigin = { ox: minX, oy: minY };
  return out;
}

function crop(png, x0, y0, w, h) {
  const out = new PNG({ width: w, height: h });
  PNG.bitblt(png, out, x0, y0, w, h, 0, 0);
  return out;
}

function processImage(png, name) {
  const bg = floodFromBorders(png);
  const inLoose = buildLoosePalette(png, bg);
  erodeFringe(png, bg, inLoose);
  dropSpecks(png, bg, inLoose);
  applyMask(png, bg);
  const trimmed = trim(png);
  let t = 0;
  for (let i = 3; i < trimmed.data.length; i += 4) if (trimmed.data[i] === 0) t++;
  const pct = Math.round((t / (trimmed.width * trimmed.height)) * 100);
  console.log(`${name} → ${trimmed.width}x${trimmed.height} (${pct}% transparent)`);
  if (pct < 8) console.log(`  ⚠️ ${name} : très peu de fond retiré, à contrôler`);
  if (pct > 65) console.log(`  ⚠️ ${name} : énormément retiré, continent peut-être rongé`);
  return trimmed;
}

// ------------------------------------------------------------------ marche ---

// Filtre optionnel : node scripts/space-continents.mjs c09 c16 c35
const only = process.argv.slice(2);
const jobs = [];
for (const f of fs.readdirSync(SRC).sort()) {
  const m = f.match(/^(c\d\d)\.png$/);
  if (!m) continue;
  const id = m[1];
  if (only.length && !only.includes(id)) continue;
  if (id === 'c01') {
    const png = PNG.sync.read(fs.readFileSync(path.join(SRC, f)));
    const mid = Math.round(png.height / 2); // image double : panneau haut / bas
    jobs.push(['c01a', crop(png, 0, 0, png.width, mid)]);
    jobs.push(['c01b', crop(png, 0, mid, png.width, png.height - mid)]);
  } else {
    jobs.push([id, PNG.sync.read(fs.readFileSync(path.join(SRC, f)))]);
  }
}

const done = [];
for (const [id, png] of jobs) {
  const theme = THEME_MAP[id];
  if (!theme) { console.log(`(${id} : pas de thème attribué, ignoré)`); continue; }
  const result = processImage(png, `${id} (${theme})`);
  const buf = PNG.sync.write(result);
  fs.writeFileSync(path.join(OUT_PNG, `cont-${theme}.png`), buf);
  await sharp(buf).webp({ quality: 82 }).toFile(path.join(OUT_WEBP, `cont-${theme}.webp`));
  done.push([id, theme, result]);
}

// --- Planches de contrôle (fond vert, 12 par planche) ---
const CELL_W = 360, CELL_H = 300, COLS = 4;
for (let s = 0; s < Math.ceil(done.length / 12); s++) {
  const batch = done.slice(s * 12, s * 12 + 12);
  const rows = Math.ceil(batch.length / COLS);
  const sheet = new PNG({ width: CELL_W * COLS, height: CELL_H * rows });
  for (let i = 0; i < sheet.data.length; i += 4) {
    sheet.data[i] = 20; sheet.data[i + 1] = 150; sheet.data[i + 2] = 50; sheet.data[i + 3] = 255;
  }
  batch.forEach(([id, theme, png], bi) => {
    const cx = (bi % COLS) * CELL_W, cy = ((bi / COLS) | 0) * CELL_H;
    const scale = Math.min((CELL_W - 8) / png.width, (CELL_H - 8) / png.height);
    const w = Math.round(png.width * scale), h = Math.round(png.height * scale);
    const ox = cx + ((CELL_W - w) >> 1), oy = cy + ((CELL_H - h) >> 1);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = ((Math.floor(y / scale) * png.width) + Math.floor(x / scale)) << 2;
        const a = png.data[si + 3] / 255;
        if (a < 0.04) continue;
        const di = ((sheet.width * (oy + y)) + ox + x) << 2;
        for (let c = 0; c < 3; c++) sheet.data[di + c] = Math.round(png.data[si + c] * a + sheet.data[di + c] * (1 - a));
      }
    }
    void id; void theme;
  });
  const p = path.join(CHECK, `check-continents-${s + 1}.png`);
  fs.writeFileSync(p, PNG.sync.write(sheet));
  console.log('planche →', p);
}
// --- Fichier généré : dimensions des assets (consommé par src/data/maps/espace.js) ---
// (uniquement lors d'un traitement COMPLET, pour ne pas tronquer le fichier)
if (!only.length) {
  const dims = {};
  for (const [, theme, png] of done) {
    dims[theme] = { w: png.width, h: png.height, ...(png.trimOrigin || {}) };
  }
  const gen = `// GÉNÉRÉ par scripts/space-continents.mjs — ne pas éditer à la main.
// Dimensions (après détourage/trim) des continents thématiques cont-{theme}.png,
// + origine du trim (ox, oy) dans l'image source — sert à migrer les calibrations
// si un re-traitement change le recadrage.
export const CONTINENT_DIMS = ${JSON.stringify(dims, null, 2)};
`;
  fs.writeFileSync(path.join(ROOT, 'src', 'data', 'maps', 'continentsGen.js'), gen);
  console.log('→ src/data/maps/continentsGen.js');
}
console.log(`OK — ${done.length} continents traités`);
