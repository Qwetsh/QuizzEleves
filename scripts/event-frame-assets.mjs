// Découpe la planche « modale d'événement » (fond magenta) en assets détourés :
//   event-frame.png       — le cadre HUD (bas-gauche : header ÉVÉNEMENT + 2 panneaux, SANS les 3 cases)
//   event-btn-green.png    — case choix vert (+)   → Accepter / choix bénéfique
//   event-btn-yellow.png   — case choix jaune (★)  → neutre / spécial
//   event-btn-red.png      — case choix rouge (☠)  → Refuser / choix risqué
// Sortie : src/assets/space/ (chargée via import.meta.glob comme les autres). Montage : tmp_sprites/_event.png
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INPUT = process.argv[2] || 'C:/Users/Utilisateur/Downloads/ChatGPT Image 11 juil. 2026, 18_09_31.png';
const OUT = path.join(ROOT, 'src/assets/space');
const TMP = path.join(ROOT, 'tmp_sprites');

const isBg = (r, g, b) => r > 165 && b > 165 && g < 115; // magenta/rose du fond

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  const { data, info } = await sharp(INPUT).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, C = info.channels;
  const content = (x, y) => { const i = (y * W + x) * C; return !isBg(data[i], data[i + 1], data[i + 2]); };

  // Bandes horizontales (séparées par des lignes 100% magenta), puis colonnes.
  const rowHas = [];
  for (let y = 0; y < H; y++) { let h = false; for (let x = 0; x < W; x++) if (content(x, y)) { h = true; break; } rowHas.push(h); }
  const bands = []; let s = -1;
  for (let y = 0; y < H; y++) { if (rowHas[y] && s < 0) s = y; else if (!rowHas[y] && s >= 0) { bands.push([s, y - 1]); s = -1; } }
  if (s >= 0) bands.push([s, H - 1]);

  const cells = [];
  for (const [y0, y1] of bands) {
    if (y1 - y0 < 70) continue; // ignore les bandes de TITRE (texte fin)
    const colHas = [];
    for (let x = 0; x < W; x++) { let h = false; for (let y = y0; y <= y1; y++) if (content(x, y)) { h = true; break; } colHas.push(h); }
    let cs = -1;
    for (let x = 0; x < W; x++) {
      if (colHas[x] && cs < 0) cs = x;
      else if (!colHas[x] && cs >= 0) { if (x - 1 - cs > 40) cells.push([cs, y0, x - 1, y1]); cs = -1; }
    }
    if (cs >= 0 && W - 1 - cs > 40) cells.push([cs, y0, W - 1, y1]);
  }

  // Resserre chaque cellule sur son contenu réel + détoure le magenta.
  const PAD = 3;
  const crop = (cell) => {
    let [x0, y0, x1, y1] = cell;
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
    return { x0, y0, cw, ch, buf };
  };

  const all = cells.map(crop).map((c, i) => ({ ...c, idx: i }));
  console.log('cellules retenues :', all.map((c) => `${c.cw}×${c.ch}@(${c.x0},${c.y0})`).join('  '));

  const frames = all.filter((c) => c.cw > 450);
  const boxes = all.filter((c) => c.cw >= 120 && c.cw <= 450).sort((a, b) => a.x0 - b.x0);
  // Cadre cible = bas-gauche : parmi les frames, y0 le plus grand (rangée du bas) et x0 petit.
  const bottomFrames = frames.filter((f) => f.y0 > H * 0.45).sort((a, b) => a.x0 - b.x0);
  const frame = bottomFrames[0] || frames.sort((a, b) => b.y0 - a.y0)[0];
  const bottomBoxes = boxes.filter((b) => b.y0 > H * 0.45);
  if (!frame) throw new Error('Cadre non détecté');
  if (bottomBoxes.length !== 3) throw new Error(`Attendu 3 cases, détecté ${bottomBoxes.length}`);

  const save = async (c, name) => {
    await sharp(c.buf, { raw: { width: c.cw, height: c.ch, channels: 4 } }).png().toFile(path.join(OUT, `${name}.png`));
    console.log(`${name.padEnd(18)} ${c.cw}×${c.ch}`);
  };
  await save(frame, 'event-frame');
  const names = ['event-btn-green', 'event-btn-yellow', 'event-btn-red'];
  for (let i = 0; i < 3; i++) await save(bottomBoxes[i], names[i]);

  // Montage de contrôle (fond sombre)
  const items = [frame, ...bottomBoxes];
  const CH = 240;
  const comps = []; let left = 0;
  for (const o of items) {
    const scale = Math.min(CH / o.ch, 1);
    const w = Math.round(o.cw * scale), h = Math.round(o.ch * scale);
    const png = await sharp(o.buf, { raw: { width: o.cw, height: o.ch, channels: 4 } }).resize(w, h).png().toBuffer();
    comps.push({ input: png, left, top: (CH - h) / 2 | 0 }); left += w + 12;
  }
  await sharp({ create: { width: left, height: CH, channels: 4, background: { r: 20, g: 26, b: 40, alpha: 1 } } })
    .composite(comps).png().toFile(path.join(TMP, '_event.png'));
  console.log('\nMontage : tmp_sprites/_event.png');
}

main().catch((e) => { console.error(e); process.exit(1); });
