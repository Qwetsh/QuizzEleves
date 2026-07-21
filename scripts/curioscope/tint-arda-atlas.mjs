// Curioscope — TEINTE PARCHEMIN de la carte source Terre du Milieu « atlas »
// (Internet Archive « ThirdageMiddle-earth.jpg », N&B détaillé) en PLEINE
// RÉSOLUTION (pas de resize) : reproduit la recette de l'aperçu déjà validé
// (arda-thirdage.png), puis composite une vignette radiale pour le vieilli.
//
//   node scripts/curioscope/tint-arda-atlas.mjs
//
// Sortie : .tmp-arda/tdm-atlas-tinted.jpg (qualité 90) ~8740×8208.
// ⚠️ Carte PLACEHOLDER usage perso (licence non claire) — à remplacer avant
//    toute publication.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, '.tmp-arda', 'ia-thirdage.jpg');
const OUT = join(ROOT, '.tmp-arda', 'tdm-atlas-tinted.jpg');

if (!existsSync(SRC)) {
  console.error(`✘ Introuvable : ${SRC}`);
  process.exit(1);
}

sharp.cache(false);

const base = sharp(SRC, { limitInputPixels: false })
  .grayscale()
  .linear(1.06, -8)
  .tint({ r: 214, g: 184, b: 132 })
  .modulate({ saturation: 1.15 });

const meta = await base.metadata();
const W = meta.width;
const H = meta.height;
console.log(`Teinte : ${W}×${H} (pleine résolution)`);

// Vignette : dégradé radial blanc au centre → #b48a55 aux bords, blend multiply.
const vignette = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
     <defs>
       <radialGradient id="v" cx="50%" cy="50%" r="72%">
         <stop offset="0%" stop-color="#ffffff"/>
         <stop offset="60%" stop-color="#f0e2c8"/>
         <stop offset="100%" stop-color="#b48a55"/>
       </radialGradient>
     </defs>
     <rect width="${W}" height="${H}" fill="url(#v)"/>
   </svg>`,
);

const tintedBuf = await base.toBuffer();
await sharp(tintedBuf, { limitInputPixels: false })
  .composite([{ input: vignette, blend: 'multiply' }])
  .jpeg({ quality: 90 })
  .toFile(OUT);

const outMeta = await sharp(OUT, { limitInputPixels: false }).metadata();
console.log(`✔ Écrit ${OUT} → ${outMeta.width}×${outMeta.height}`);
if (outMeta.width !== W || outMeta.height !== H) {
  console.error('⚠️ La sortie a été redimensionnée !');
  process.exit(1);
}
