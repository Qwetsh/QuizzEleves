// Curioscope — carte « satellite » : grande image assemblée (export minimap
// wow.export, rendu type WyriMaps) → PYRAMIDE DE TUILES WebP {z}/{x}/{y}
// dans le bucket quete-spots sous maps/<universe>/, pour le mode `tiles`
// d'UniverseMap (zoom profond, détail à la wowcarto).
//
//   node scripts/curioscope/make-tiles.mjs <image> <universe> [--ref cx,cy=px,py]... [--max-size N] [--dry-run]
//
// CALIBRATION (--ref, recommandé ×2 minimum, points éloignés en diagonale) :
// l'assemblage minimap ne couvre PAS le même cadre que la carte uiMap du jeu
// (repère des cx/cy de l'addon). Donner ≥2 lieux reconnaissables :
//   cx,cy = coords normalisées uiMap (le print CurioSnap donne cx%/cy% → /100)
//   px,py = position du MÊME lieu en pixels sur l'image source
// → l'image est recadrée sur le cadre uiMap avant tuilage : les spots tombent
// juste sans aucune retouche. Sans --ref : l'image est supposée déjà cadrée
// uiMap (cas de l'art de carte du jeu).
//
// À la fin, reporter la ligne `map: { type:'tiles', ... }` affichée dans
// src/data/universes.js.
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { TILE, maxZoomFor, levelSize, tileGrid, totalTiles, solveFrame } from './tilelib.mjs';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const BUCKET = 'quete-spots';
const OCEAN = { r: 12, g: 26, b: 38, alpha: 1 }; // fond hors-carte (≈ #0c1a26)

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const [img, universe] = pos;
const dryRun = args.includes('--dry-run');
const maxSizeIdx = args.indexOf('--max-size');
const maxSize = maxSizeIdx >= 0 ? Number(args[maxSizeIdx + 1]) : 16384;
const refs = args
  .map((a, i) => (a === '--ref' ? args[i + 1] : null))
  .filter(Boolean)
  .map((s) => {
    const m = s.match(/^([\d.]+),([\d.]+)=([\d.-]+),([\d.-]+)$/);
    if (!m) throw new Error(`--ref invalide : ${s} (attendu cx,cy=px,py)`);
    return { cx: +m[1], cy: +m[2], px: +m[3], py: +m[4] };
  });

if (!img || !universe || !existsSync(img)) {
  console.error('Usage: node scripts/curioscope/make-tiles.mjs <image> <universe> [--ref cx,cy=px,py]... [--max-size N] [--dry-run]');
  process.exit(1);
}

// 1. Charge, PLAFONNE d'abord la résolution (mémoire : le cadre uiMap peut
// déborder largement de l'image — marges d'océan — on réduit AVANT d'étendre),
// puis recadre sur le cadre uiMap (calibration --ref).
sharp.cache(false);
let base = sharp(img, { limitInputPixels: false });
const srcMeta = await base.metadata();
console.log(`Source : ${srcMeta.width}×${srcMeta.height}`);

let frame = refs.length >= 2 ? solveFrame(refs) : null;
if (frame) console.log(`Cadre uiMap résolu : left=${frame.left} top=${frame.top} ${frame.width}×${frame.height}`);

// Facteur de réduction pour que la SORTIE (cadre si fourni, image sinon)
// tienne dans maxSize (16384 par défaut : Z=6, ~1 900 tuiles/continent).
const outW0 = frame ? frame.width : srcMeta.width;
const outH0 = frame ? frame.height : srcMeta.height;
const f = Math.min(1, maxSize / Math.max(outW0, outH0));
if (f < 1) {
  base = sharp(await base.resize({ width: Math.round(srcMeta.width * f) }).toBuffer(), { limitInputPixels: false });
  if (frame) {
    frame = {
      left: Math.round(frame.left * f), top: Math.round(frame.top * f),
      width: Math.round(frame.width * f), height: Math.round(frame.height * f),
    };
  }
}

if (frame) {
  // Découpe le cadre, en étendant avec le fond si le cadre déborde de l'image.
  const m = await base.metadata();
  const padL = Math.max(0, -frame.left);
  const padT = Math.max(0, -frame.top);
  const padR = Math.max(0, frame.left + frame.width - m.width);
  const padB = Math.max(0, frame.top + frame.height - m.height);
  if (padL || padT || padR || padB) {
    base = sharp(await base.extend({ top: padT, bottom: padB, left: padL, right: padR, background: OCEAN }).toBuffer(), { limitInputPixels: false });
  }
  base = sharp(await base.extract({
    left: frame.left + padL, top: frame.top + padT, width: frame.width, height: frame.height,
  }).toBuffer(), { limitInputPixels: false });
}

const { width: w, height: h } = await base.metadata();
const Z = maxZoomFor(w, h);
console.log(`Tuilage : ${w}×${h}, zoom 0→${Z}, ${totalTiles(w, h, Z)} tuiles`);

// 3. Génère et pousse chaque niveau (concurrence 8, upsert = relançable).
let sent = 0; let bytes = 0;
for (let z = Z; z >= 0; z--) {
  const { w: lw, h: lh } = levelSize(w, h, z, Z);
  const levelBuf = await base.clone().resize({ width: lw, height: lh }).raw().toBuffer({ resolveWithObject: true });
  const grid = tileGrid(w, h, z, Z);
  for (let i = 0; i < grid.length; i += 8) {
    await Promise.all(grid.slice(i, i + 8).map(async (t) => {
      let tile = sharp(levelBuf.data, { raw: levelBuf.info, limitInputPixels: false })
        .extract({ left: t.left, top: t.top, width: t.w, height: t.h });
      if (t.w < TILE || t.h < TILE) {
        tile = tile.extend({ right: TILE - t.w, bottom: TILE - t.h, background: OCEAN });
      }
      const buf = await tile.webp({ quality: 80 }).toBuffer();
      bytes += buf.length;
      if (!dryRun) {
        const { error } = await sb.storage.from(BUCKET)
          .upload(`maps/${universe}/${t.z}/${t.x}/${t.y}.webp`, buf, { contentType: 'image/webp', upsert: true });
        if (error) throw new Error(`tuile ${t.z}/${t.x}/${t.y} : ${error.message}`);
      }
      sent++;
    }));
  }
  console.log(`  z=${z} : ${grid.length} tuile(s) ${dryRun ? '[dry-run]' : 'ok'}`);
}

console.log(`\n✔ ${sent} tuiles, ${(bytes / 1024 / 1024).toFixed(1)} Mo → maps/${universe}/{z}/{x}/{y}.webp`);
console.log('→ Dans src/data/universes.js, remplace la config map de cet univers par :');
console.log(`   map: { type: 'tiles', path: 'maps/${universe}', w: ${w}, h: ${h}, maxNativeZoom: ${Z} },`);
