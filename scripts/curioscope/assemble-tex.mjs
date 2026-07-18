// Curioscope — assemble les tuiles `tex_X_Y.png` d'un export de carte
// wow.export (Maps → qualité « minimap data », 512 px/tuile ADT) en UNE image
// continent, prête pour make-tiles.mjs.
//
//   node scripts/curioscope/assemble-tex.mjs <dossier-export> <sortie.png> [universe]
//   ex. node scripts/curioscope/assemble-tex.mjs C:\Users\...\wow.export\maps\azeroth C:\CurioscopeAssets\maps\royaumes_est.png wow_royaumes_est
//
// Si `universe` est fourni, affiche la commande make-tiles COMPLÈTE avec les
// refs du cadre uiMap calculées mathématiquement (adtFrameRefs, données
// UiMapAssignment du client) — aucune calibration manuelle.
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { adtFrameRefs } from './tilelib.mjs';

const [dir, out, universe] = process.argv.slice(2);
if (!dir || !out || !existsSync(dir)) {
  console.error('Usage: node scripts/curioscope/assemble-tex.mjs <dossier-export> <sortie.png> [universe]');
  process.exit(1);
}

const tiles = [];
for (const f of readdirSync(dir)) {
  const m = f.match(/^tex_(\d+)_(\d+)\.png$/);
  if (m) tiles.push({ f: join(dir, f), col: +m[1], row: +m[2] });
}
if (!tiles.length) { console.error('Aucune tuile tex_X_Y.png trouvée.'); process.exit(1); }

const T = (await sharp(tiles[0].f).metadata()).width; // 512 en qualité minimap
const minCol = Math.min(...tiles.map((t) => t.col));
const maxCol = Math.max(...tiles.map((t) => t.col));
const minRow = Math.min(...tiles.map((t) => t.row));
const maxRow = Math.max(...tiles.map((t) => t.row));
const W = (maxCol - minCol + 1) * T;
const H = (maxRow - minRow + 1) * T;
console.log(`${tiles.length} tuiles de ${T}px — grille ADT cols ${minCol}-${maxCol}, rows ${minRow}-${maxRow} → ${W}×${H}px`);

// Composition par bandes de lignes (limite la mémoire sur les grands continents).
const OCEAN = { r: 12, g: 26, b: 38 };
const BAND = 8; // lignes ADT par bande
const bands = [];
for (let r0 = minRow; r0 <= maxRow; r0 += BAND) {
  const r1 = Math.min(maxRow, r0 + BAND - 1);
  const bandTiles = tiles.filter((t) => t.row >= r0 && t.row <= r1);
  const band = await sharp({ create: { width: W, height: (r1 - r0 + 1) * T, channels: 3, background: OCEAN } })
    .composite(bandTiles.map((t) => ({ input: t.f, left: (t.col - minCol) * T, top: (t.row - r0) * T })))
    .png().toBuffer();
  bands.push({ input: band, left: 0, top: (r0 - minRow) * T });
  process.stdout.write(`\r  lignes ${r0}-${r1} assemblées…   `);
}
console.log('');
await sharp({ create: { width: W, height: H, channels: 3, background: OCEAN }, limitInputPixels: false })
  .composite(bands)
  .png().toFile(out);
console.log(`✔ ${out} (${W}×${H})`);
console.log(`  grille : minCol=${minCol} minRow=${minRow} tile=${T}px`);
if (universe) {
  const refs = adtFrameRefs(universe, minCol, minRow, T);
  const refArgs = refs.map((r) => `--ref ${r.cx},${r.cy}=${Math.round(r.px)},${Math.round(r.py)}`).join(' ');
  console.log('→ commande de tuilage (cadre uiMap calculé automatiquement) :');
  console.log(`  node scripts/curioscope/make-tiles.mjs "${out}" ${universe} ${refArgs}`);
}
