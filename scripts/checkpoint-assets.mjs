// Découpe la planche « point de contrôle » (fond magenta) en 5 assets détourés :
//   checkpoint-socle.png        — la plateforme de pierre gravée (avec le trou central)
//   checkpoint-cristal-1..4.png — les 4 frames du cristal (animation en boucle)
// Sortie : src/assets/space/ (chargée par BoardSVG via import.meta.glob).
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INPUT = process.argv[2] || 'C:/Users/Utilisateur/Downloads/ChatGPT Image 10 juil. 2026, 14_29_19.png';
const OUT = path.join(ROOT, 'src/assets/space');
const TMP = path.join(ROOT, 'tmp_sprites');

const isBg = (r, g, b) => r > 180 && b > 180 && g < 90; // magenta plein

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const { data, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const content = (x, y) => { const i = (y * W + x) * C; return !isBg(data[i], data[i + 1], data[i + 2]); };

  // Bande(s) horizontale(s) puis colonnes (comme space-characters)
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
      else if (!colHas[x] && cs >= 0) { if (x - 1 - cs > 30) cells.push([cs, y0, x - 1, y1]); cs = -1; }
    }
    if (cs >= 0 && W - 1 - cs > 30) cells.push([cs, y0, W - 1, y1]);
  }
  console.log('cellules détectées', cells.length);
  if (cells.length !== 5) throw new Error(`Attendu 5 (socle + 4 cristaux), détecté ${cells.length}`);

  const PAD = 4;
  const names = ['checkpoint-socle', 'checkpoint-cristal-1', 'checkpoint-cristal-2', 'checkpoint-cristal-3', 'checkpoint-cristal-4'];
  const out = [];
  for (let k = 0; k < cells.length; k++) {
    let [x0, y0, x1, y1] = cells[k];
    // Resserre sur le contenu réel
    let nx0 = x1, ny0 = y1, nx1 = x0, ny1 = y0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (content(x, y)) { if (x < nx0) nx0 = x; if (x > nx1) nx1 = x; if (y < ny0) ny0 = y; if (y > ny1) ny1 = y; }
    x0 = Math.max(0, nx0 - PAD); y0 = Math.max(0, ny0 - PAD); x1 = Math.min(W - 1, nx1 + PAD); y1 = Math.min(H - 1, ny1 + PAD);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    const buf = Buffer.alloc(cw * ch * 4, 0);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const si = ((y0 + y) * W + (x0 + x)) * C;
      const r = data[si], g = data[si + 1], b = data[si + 2];
      if (isBg(r, g, b)) continue;
      const di = (y * cw + x) * 4;
      buf[di] = r; buf[di + 1] = g; buf[di + 2] = b; buf[di + 3] = 255;
    }
    await sharp(buf, { raw: { width: cw, height: ch, channels: 4 } }).png().toFile(path.join(OUT, `${names[k]}.png`));
    console.log(`${names[k].padEnd(22)} ${cw}×${ch}`);
    out.push({ name: names[k], cw, ch, buf });
  }

  // Montage de contrôle
  const CELL = 260;
  const comps = [];
  for (let i = 0; i < out.length; i++) {
    const o = out[i];
    const scale = Math.min(CELL / o.cw, CELL / o.ch, 1);
    const w = Math.round(o.cw * scale), h = Math.round(o.ch * scale);
    const png = await sharp(o.buf, { raw: { width: o.cw, height: o.ch, channels: 4 } }).resize(w, h).png().toBuffer();
    comps.push({ input: png, left: i * CELL + ((CELL - w) / 2 | 0), top: (CELL - h) / 2 | 0 });
  }
  await sharp({ create: { width: out.length * CELL, height: CELL, channels: 4, background: { r: 40, g: 20, b: 60, alpha: 1 } } })
    .composite(comps).png().toFile(path.join(TMP, '_checkpoint.png'));
  console.log('\nMontage : tmp_sprites/_checkpoint.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
