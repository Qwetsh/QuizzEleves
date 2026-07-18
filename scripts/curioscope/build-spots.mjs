// Curioscope P3 — étape 2 : spots.csv → images WebP dans le bucket quete-spots
// + lignes dans la table quete_spots. Idempotent : les captures déjà envoyées
// (fichier .curio-done.json du dossier) sont sautées — relançable sans doublon.
//
//   node scripts/curioscope/build-spots.mjs <dossier-session> [--dry-run] [--calib calib.json]
//
// calib.json (optionnel, si la carte-image n'est pas l'art uiMap exact) :
//   { "wow_kalimdor": { "ax": 1, "bx": 0, "ay": 1, "by": 0 } }
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { parseCsv, applyCalib } from './snaplib.mjs';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const BUCKET = 'quete-spots';

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const calibIdx = args.indexOf('--calib');
const calib = calibIdx >= 0 ? JSON.parse(readFileSync(args[calibIdx + 1], 'utf8')) : {};

if (!dir || !existsSync(join(dir, 'spots.csv'))) {
  console.error('Usage: node scripts/curioscope/build-spots.mjs <dossier-session> [--dry-run] [--calib calib.json]');
  process.exit(1);
}

const donePath = join(dir, '.curio-done.json');
const done = new Set(existsSync(donePath) ? JSON.parse(readFileSync(donePath, 'utf8')) : []);
const rows = parseCsv(readFileSync(join(dir, 'spots.csv'), 'utf8'));

let sent = 0; let skipped = 0; let errors = 0;
for (const r of rows) {
  if (String(r.actif) !== '1') { skipped++; continue; }
  if (done.has(r.t)) { skipped++; continue; }
  if (!r.fichier || !r.universe || r.cx === '' || r.cy === '') { skipped++; continue; }
  const imgPath = join(dir, r.fichier);
  if (!existsSync(imgPath)) { console.warn(`⚠ image absente : ${r.fichier}`); errors++; continue; }

  const { cx, cy } = applyCalib(Number(r.cx), Number(r.cy), calib[r.universe]);
  const path = `wow/s-${randomUUID()}.webp`; // nom opaque (anti-triche)

  if (dryRun) {
    console.log(`[dry-run] ${r.fichier} → ${r.universe} « ${r.label} » (${cx.toFixed(4)}, ${cy.toFixed(4)}) diff=${r.difficulte}`);
    sent++;
    continue;
  }

  try {
    const buf = await sharp(imgPath)
      .resize({ width: 1600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    const up = await sb.storage.from(BUCKET).upload(path, buf, { contentType: 'image/webp', upsert: true });
    if (up.error) throw up.error;
    const ins = await sb.from('quete_spots').insert({
      universe: r.universe,
      label: r.label || r.zone || null,
      zone: r.zone || null,
      cx: cx.toFixed(5), cy: cy.toFixed(5),
      image_path: path, // chemin RELATIF (base d'URL côté client)
      difficulte: Math.min(5, Math.max(1, Number(r.difficulte) || 3)),
      meta: { t: r.t, map: Number(r.map) || null, x_zone: Number(r.x_zone) || null, y_zone: Number(r.y_zone) || null, cont: Number(r.cont) || null },
    });
    if (ins.error) throw ins.error;
    done.add(r.t);
    writeFileSync(donePath, JSON.stringify([...done], null, 1), 'utf8');
    sent++;
    console.log(`✔ ${r.universe} « ${r.label} » (${(buf.length / 1024).toFixed(0)} Ko) → ${path}`);
  } catch (e) {
    errors++;
    console.error(`✘ ${r.fichier} : ${e.message || e}`);
  }
}

console.log(`\n${dryRun ? '[dry-run] ' : ''}Envoyés : ${sent} · sautés : ${skipped} · erreurs : ${errors}`);
if (!dryRun && sent) console.log('→ Recharge le jeu (le TBI rafraîchit quete_spots au démarrage).');
