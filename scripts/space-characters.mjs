// Découpe la planche de personnages (pixel-art, univers espace) en sprites
// individuels détourés, et isole l'écharpe rouge de chacun en un calque
// grayscale « tintable » (recoloré à la couleur d'équipe au rendu via un filtre
// SVG multiply).
//
// Entrée : une planche 2 rangées × 5 colonnes, fond magenta plein.
// Sortie : src/assets/characters/<id>.png (corps) + <id>-scarf.png (écharpe),
//          plus un montage de contrôle tmp_sprites/_preview.png.
//
// Usage : node scripts/space-characters.mjs [chemin-planche]
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DL = 'C:/Users/Utilisateur/Downloads';
const OUT = path.join(ROOT, 'src/assets/characters');
const TMP = path.join(ROOT, 'tmp_sprites');

// Planches sources (2 rangées × 5, fond magenta) et l'ordre de lecture des
// personnages (rangée 1 gauche→droite, puis rangée 2).
const SHEETS = [
  { file: `${DL}/ChatGPT Image 10 juil. 2026, 06_31_20.png`, ids: ['aviatrice', 'gameur', 'robot', 'drone', 'alien', 'mecano', 'pilote', 'martien', 'singe', 'dragon'] },
  { file: `${DL}/ChatGPT Image 10 juil. 2026, 10_28_49.png`, ids: ['baroudeuse', 'streamer', 'mercenaire', 'exploratrice', 'cosmonaute', 'lezard', 'mystique', 'capitaine', 'lapin', 'felin'] },
  { file: `${DL}/ChatGPT Image 10 juil. 2026, 10_34_54.png`, ids: ['renard', 'loup', 'ours', 'lievre', 'panda', 'aigle', 'dragonnet', 'cerf', 'herisson', 'tigre'] },
];

const isBg = (r, g, b) => r > 180 && b > 180 && g < 90;              // magenta plein
// Rouge SATURÉ de l'écharpe uniquement — le seuil r>g*2 écarte les fourrures
// orange (renard, tigre) et le brun/tan (cerf, cols de fourrure).
const isRed = (r, g, b) => r > 100 && r > g * 2.0 && r > b * 1.8 && (r - Math.max(g, b)) > 50;
const lum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

// Bande verticale (fractions de hauteur) où chercher l'écharpe, pour les persos
// dont la fourrure/tenue partage la teinte rouge-orangée : on coupe la tête
// (rousse) et la tenue basse (orange) AVANT l'étiquetage → écharpe seule.
const REGION = {
  pilote: { y0: 0.27 },           // crête rouge du casque au-dessus
  lezard: { y1: 0.60 },           // cuisses de la tunique orange en dessous
  renard: { y0: 0.30, y1: 0.66 }, // museau roux (haut) + queue/pieds (bas)
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });

  const previews = [];
  const PAD = 6;

  for (const sheet of SHEETS) {
   const { data, info } = await sharp(sheet.file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
   const W = info.width, H = info.height, C = info.channels;
   const content = (x, y) => { const i = (y * W + x) * C; return !isBg(data[i], data[i + 1], data[i + 2]); };

   // --- Auto-slice : bandes horizontales puis colonnes ---
   const rowHas = [];
   for (let y = 0; y < H; y++) { let h = false; for (let x = 0; x < W; x++) if (content(x, y)) { h = true; break; } rowHas.push(h); }
   const bands = []; let s = -1;
   for (let y = 0; y < H; y++) { if (rowHas[y] && s < 0) s = y; else if (!rowHas[y] && s >= 0) { bands.push([s, y - 1]); s = -1; } }
   if (s >= 0) bands.push([s, H - 1]);

   const cells = [];
   for (const [y0, y1] of bands) {
    if (y1 - y0 < 40) continue;
    const colHas = [];
    for (let x = 0; x < W; x++) { let h = false; for (let y = y0; y <= y1; y++) if (content(x, y)) { h = true; break; } colHas.push(h); }
    let cs = -1;
    for (let x = 0; x < W; x++) {
      if (colHas[x] && cs < 0) cs = x;
      else if (!colHas[x] && cs >= 0) { if (x - 1 - cs > 20) cells.push([cs, y0, x - 1, y1]); cs = -1; }
    }
    if (cs >= 0 && W - 1 - cs > 20) cells.push([cs, y0, W - 1, y1]);
   }
   if (cells.length !== sheet.ids.length) throw new Error(`${sheet.file}: attendu ${sheet.ids.length} personnages, détecté ${cells.length}`);

   for (let k = 0; k < cells.length; k++) {
    let [x0, y0, x1, y1] = cells[k];
    // Resserre la bbox sur le contenu réel
    let nx0 = x1, ny0 = y1, nx1 = x0, ny1 = y0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (content(x, y)) { if (x < nx0) nx0 = x; if (x > nx1) nx1 = x; if (y < ny0) ny0 = y; if (y > ny1) ny1 = y; }
    x0 = Math.max(0, nx0 - PAD); y0 = Math.max(0, ny0 - PAD); x1 = Math.min(W - 1, nx1 + PAD); y1 = Math.min(H - 1, ny1 + PAD);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

    // Buffers RGBA du corps + masque des pixels rouges (candidats écharpe)
    const body = Buffer.alloc(cw * ch * 4, 0);
    const redMask = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const si = ((y0 + y) * W + (x0 + x)) * C;
      const r = data[si], g = data[si + 1], b = data[si + 2];
      const di = (y * cw + x) * 4;
      if (isBg(r, g, b)) continue;           // fond → transparent
      body[di] = r; body[di + 1] = g; body[di + 2] = b; body[di + 3] = 255;
      if (isRed(r, g, b)) redMask[y * cw + x] = 1;
    }

    // Clip éventuel à la bande « cou » (persos à teinte fourrure/tenue ambiguë)
    const reg = REGION[sheet.ids[k]];
    if (reg) {
      const yLo = (reg.y0 ?? 0) * ch, yHi = (reg.y1 ?? 1) * ch;
      for (let y = 0; y < ch; y++) if (y < yLo || y > yHi) for (let x = 0; x < cw; x++) redMask[y * cw + x] = 0;
    }

    // L'écharpe est la (les) plus grosse(s) masse(s) rouge(s) CONTIGUË(S).
    // On étiquette les composantes connexes (4-conn) et on ne garde que celles
    // ≥ 35 % de la plus grande : les petits accents d'armure/harnais isolés
    // (rouges mais éparpillés) sont ainsi écartés → écharpe seule.
    const labels = new Int32Array(cw * ch).fill(0);
    const areas = [0];
    let nextLabel = 1;
    const stack = [];
    for (let start = 0; start < cw * ch; start++) {
      if (!redMask[start] || labels[start]) continue;
      const lab = nextLabel++; let area = 0; stack.push(start); labels[start] = lab;
      while (stack.length) {
        const q = stack.pop(); area++;
        const qx = q % cw, qy = (q / cw) | 0;
        if (qx > 0 && redMask[q - 1] && !labels[q - 1]) { labels[q - 1] = lab; stack.push(q - 1); }
        if (qx < cw - 1 && redMask[q + 1] && !labels[q + 1]) { labels[q + 1] = lab; stack.push(q + 1); }
        if (qy > 0 && redMask[q - cw] && !labels[q - cw]) { labels[q - cw] = lab; stack.push(q - cw); }
        if (qy < ch - 1 && redMask[q + cw] && !labels[q + cw]) { labels[q + cw] = lab; stack.push(q + cw); }
      }
      areas.push(area);
    }
    const maxArea = Math.max(0, ...areas.slice(1));
    const keepMin = Math.max(150, maxArea * 0.35);
    const keep = new Set();
    for (let l = 1; l < areas.length; l++) if (areas[l] >= keepMin) keep.add(l);

    const scarf = Buffer.alloc(cw * ch * 4, 0);
    const scarfLums = [];
    for (let q = 0; q < cw * ch; q++) if (keep.has(labels[q])) {
      const si = ((y0 + ((q / cw) | 0)) * W + (x0 + (q % cw))) * C;
      scarfLums.push(lum(data[si], data[si + 1], data[si + 2]));
    }
    // Normalise la luminance de l'écharpe → gris clair [150..255] (pour que le
    // multiply par la couleur d'équipe rende un tissu bien coloré et ombré).
    scarfLums.sort((a, b) => a - b);
    const p = (q) => scarfLums.length ? scarfLums[Math.min(scarfLums.length - 1, Math.floor(q * scarfLums.length))] : 0;
    const lo = p(0.05), hi = Math.max(lo + 1, p(0.95));
    let scarfCount = 0;
    for (let q = 0; q < cw * ch; q++) {
      if (!keep.has(labels[q])) continue;
      const si = ((y0 + ((q / cw) | 0)) * W + (x0 + (q % cw))) * C;
      const t = Math.max(0, Math.min(1, (lum(data[si], data[si + 1], data[si + 2]) - lo) / (hi - lo)));
      const v = Math.round(150 + t * 105);   // gris clair ombré
      const di = q * 4;
      scarf[di] = v; scarf[di + 1] = v; scarf[di + 2] = v; scarf[di + 3] = 255;
      scarfCount++;
    }

    const id = sheet.ids[k];
    await sharp(body, { raw: { width: cw, height: ch, channels: 4 } }).png().toFile(path.join(OUT, `${id}.png`));
    await sharp(scarf, { raw: { width: cw, height: ch, channels: 4 } }).png().toFile(path.join(OUT, `${id}-scarf.png`));
    console.log(`${id.padEnd(10)} ${cw}×${ch}  écharpe=${scarfCount}px`);

    // Montage de contrôle : corps | écharpe tintée cyan (multiply)
    const TINT = [18, 159, 176]; // #129fb0
    const tinted = Buffer.alloc(cw * ch * 4, 0);
    for (let i = 0; i < cw * ch; i++) {
      if (scarf[i * 4 + 3]) {
        const v = scarf[i * 4] / 255;
        tinted[i * 4] = Math.round(TINT[0] * v); tinted[i * 4 + 1] = Math.round(TINT[1] * v);
        tinted[i * 4 + 2] = Math.round(TINT[2] * v); tinted[i * 4 + 3] = 255;
      }
    }
    const bodyPng = await sharp(body, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer();
    const overPng = await sharp(tinted, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer();
    const combo = await sharp(body, { raw: { width: cw, height: ch, channels: 4 } })
      .composite([{ input: overPng }]).png().toBuffer();
    previews.push({ id, cw, ch, bodyPng, combo });
   }
  }

  // Assemble un montage : 2 colonnes par perso (corps brut | écharpe tintée)
  const CELL = 200;
  const cols = 4, rows = Math.ceil(previews.length / (cols / 2));
  const cvW = cols * CELL, cvH = rows * CELL;
  const canvas = sharp({ create: { width: cvW, height: cvH, channels: 4, background: { r: 40, g: 20, b: 60, alpha: 1 } } });
  const comps = [];
  for (let i = 0; i < previews.length; i++) {
    const pr = previews[i];
    const scale = Math.min(CELL / pr.cw, CELL / pr.ch, 1);
    const w = Math.round(pr.cw * scale), h = Math.round(pr.ch * scale);
    const col = (i % 2) * 2, row = Math.floor(i / 2);
    const b = await sharp(pr.bodyPng).resize(w, h).png().toBuffer();
    const c = await sharp(pr.combo).resize(w, h).png().toBuffer();
    comps.push({ input: b, left: col * CELL + (CELL - w) / 2 | 0, top: row * CELL + (CELL - h) / 2 | 0 });
    comps.push({ input: c, left: (col + 1) * CELL + (CELL - w) / 2 | 0, top: row * CELL + (CELL - h) / 2 | 0 });
  }
  await canvas.composite(comps).png().toFile(path.join(TMP, '_preview.png'));
  console.log('\nMontage de contrôle : tmp_sprites/_preview.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
