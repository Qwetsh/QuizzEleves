// Rogne les marges TRANSPARENTES des jaquettes déjà détourées (bbox alpha, sans
// marge) : la coque atteint alors les bords du PNG → en jeu, la face avant fait
// exactement la largeur de la tranche (cassette-top.png, opaque bord à bord),
// plus de « vide » aux angles sous la plaque du dessus. Idempotent, écrit EN PLACE.
// Complète detour-cassettes.mjs (qui, lui, garde PAD=14px autour de la coque).
//   node scripts/trim-cassettes.mjs <f1.png> [f2.png ...]
import fs from 'node:fs';
import { PNG } from 'pngjs';

const ALPHA_MIN = 12;

function trim(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const { width: w, height: h, data } = png;
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] >= ALPHA_MIN) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
  }
  if (bx1 < 0) { console.warn(`?? ${file} entièrement transparent, ignoré`); return; }
  const ow = bx1 - bx0 + 1, oh = by1 - by0 + 1;
  if (ow === w && oh === h) { console.log(`=  ${file.split(/[\\/]/).pop().padEnd(34)} déjà rogné (${w}×${h}, ratio ${(w / h).toFixed(3)})`); return; }
  const crop = new PNG({ width: ow, height: oh });
  PNG.bitblt(png, crop, bx0, by0, ow, oh, 0, 0);
  fs.writeFileSync(file, PNG.sync.write(crop));
  console.log(`ok ${file.split(/[\\/]/).pop().padEnd(34)} ${w}×${h} → ${ow}×${oh}  ratio ${(ow / oh).toFixed(3)}`);
}

const files = process.argv.slice(2);
if (!files.length) { console.error('usage: trim-cassettes.mjs <f1.png> [f2.png ...]'); process.exit(1); }
for (const f of files) trim(f);
