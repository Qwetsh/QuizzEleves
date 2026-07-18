// Curioscope P3 — carte continentale : image source → WebP 4096 px de large
// → bucket quete-spots sous maps/<universe>.webp (chemin attendu par
// src/data/universes.js).
//
//   node scripts/curioscope/make-map.mjs <image> <universe>
//   ex. node scripts/curioscope/make-map.mjs C:\CurioscopeAssets\maps\kalimdor.png wow_kalimdor
//
// IMPORTANT : pour que les cx/cy de l'addon tombent juste SANS calibration,
// l'image doit couvrir exactement le cadre de la carte de continent DU JEU
// (art uiMap : la carte plein écran, capture nette sans UI, ou export des
// tuiles Interface/WorldMap via wow.export). Sinon → calib.json (build-spots).
import { existsSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const BUCKET = 'quete-spots';

const [img, universe] = process.argv.slice(2);
if (!img || !universe || !existsSync(img)) {
  console.error('Usage: node scripts/curioscope/make-map.mjs <image> <universe>');
  process.exit(1);
}

const buf = await sharp(img).resize({ width: 4096, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
const meta = await sharp(buf).metadata();
const aspect = (meta.width / meta.height).toFixed(3);
const path = `maps/${universe}.webp`;

const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: 'image/webp', upsert: true });
if (error) { console.error(`✘ upload : ${error.message}`); process.exit(1); }

console.log(`✔ ${path} — ${meta.width}×${meta.height} px, ${(buf.length / 1024).toFixed(0)} Ko`);
console.log(`  URL : ${sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl}`);
console.log(`  aspect = ${aspect} → reporte cette valeur dans src/data/universes.js (${universe}.map.aspect)`);
