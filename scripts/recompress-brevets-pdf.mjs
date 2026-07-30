// Compression des PDF du bucket `brevets` (projet Class'it, PAS PersoDB) via
// ghostscript. Ce sont des sujets de brevet + copies : texte VECTORIEL (reste
// net) + images stockées en lossless (Flate) → sous-échantillonnage à 200 dpi +
// JPEG. Testé : 17 Mo → 1,5 Mo (91 %), lisibilité intacte.
//
// SÛRETÉ :
//   - Compression EN PLACE, MÊME chemin → l'URL en base (Class'it) ne change pas.
//   - On ne réécrit QUE si le résultat est ≥15 % plus léger ET reste un PDF valide
//     (sinon original conservé — les petits sujets Maths quasi sans image sont
//     laissés tels quels).
//   - L'UPDATE (upsert) nécessite une policy publique temporaire sur `brevets`
//     (le bucket n'autorise l'écriture qu'aux authentifiés) → poser
//     `tmp_brevets_public_update`, lancer avec --apply, puis DROP.
//
// Prérequis : ghostscript portable extrait dans C:\Users\Utilisateur\gs-portable
// (ou variable GS_BIN). ffmpeg non requis ici.
//
//   node scripts/recompress-brevets-pdf.mjs             # dry-run (mesure)
//   node scripts/recompress-brevets-pdf.mjs --limit 5   # dry-run échantillon
//   node scripts/recompress-brevets-pdf.mjs --apply      # réécrit (policy requise)
//
import { createClient } from '@supabase/supabase-js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
// Projet Class'it (différent de PersoDB)
const URL = 'https://djodkjysovalpufgevrr.supabase.co';
const KEY = process.env.CLASSIT_ANON_KEY || 'sb_publishable_pUCXLrBR3cogEC6ZDP2aJA_qBJOdr37';
const BUCKET = 'brevets';
const GS = process.env.GS_BIN || 'C:\\Users\\Utilisateur\\gs-portable\\bin\\gswin64c.exe';
const APPLY = process.argv.includes('--apply');
const limIdx = process.argv.indexOf('--limit');
const LIMIT = limIdx >= 0 ? parseInt(process.argv[limIdx + 1], 10) : Infinity;

const MIN_GAIN = 0.15;
const CONCURRENCY = 4;

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' Mo';
const pub = (name) => sb.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;

// Liste récursive (racine + sous-dossiers type `custom/`)
async function listPdfs(prefix = '') {
  const out = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.storage.from(BUCKET).list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data.length) break;
    for (const e of data) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null || e.metadata === null) {
        out.push(...await listPdfs(path)); // dossier → récursion
      } else if (e.name.toLowerCase().endsWith('.pdf')) {
        out.push({ path, size: Number(e.metadata?.size || 0) });
      }
    }
    if (data.length < PAGE) break;
  }
  return out;
}

async function processOne(f, stats) {
  const safe = f.path.replace(/[\\/]/g, '_');
  const inPath = join(tmpdir(), 'bin-' + safe);
  const outPath = join(tmpdir(), 'bout-' + safe);
  try {
    const res = await fetch(pub(f.path));
    if (!res.ok) throw new Error('download HTTP ' + res.status);
    await writeFile(inPath, Buffer.from(await res.arrayBuffer()));
    await run(GS, [
      '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dPDFSETTINGS=/ebook',
      '-dDownsampleColorImages=true', '-dColorImageResolution=200',
      '-dDownsampleGrayImages=true', '-dGrayImageResolution=200',
      '-dDownsampleMonoImages=true', '-dMonoImageResolution=300',
      '-dNOPAUSE', '-dBATCH', '-dQUIET', '-sOutputFile=' + outPath, inPath,
    ], { maxBuffer: 64 * 1024 * 1024 });
    const outBuf = await readFile(outPath);
    const validPdf = outBuf.length > 0 && outBuf.subarray(0, 5).toString('latin1') === '%PDF-';
    const gain = 1 - outBuf.length / f.size;
    if (!validPdf || gain < MIN_GAIN) { stats.skipped++; return; }
    stats.savedBytes += f.size - outBuf.length;
    stats.rewritten++;
    console.log(`  ${f.path}  ${mb(f.size)} → ${mb(outBuf.length)}  (-${Math.round(gain * 100)}%)`);
    if (APPLY) {
      const { error } = await sb.storage.from(BUCKET).upload(f.path, outBuf, { contentType: 'application/pdf', upsert: true });
      if (error) throw error;
    }
  } catch (e) {
    stats.errors++;
    console.warn(`  ⚠ ${f.path}: ${e.message}`);
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

(async () => {
  console.log(`brevets (Class'it) PDF  —  ${APPLY ? 'APPLY' : 'DRY-RUN'}${LIMIT !== Infinity ? `  limit=${LIMIT}` : ''}`);
  let files = (await listPdfs()).sort((a, b) => b.size - a.size); // gros d'abord
  const totalAll = files.reduce((s, f) => s + f.size, 0);
  if (LIMIT !== Infinity) files = files.slice(0, LIMIT);
  console.log(`PDF : ${files.length}  (${mb(files.reduce((s, f) => s + f.size, 0))} sur ${mb(totalAll)})\n`);

  const stats = { rewritten: 0, skipped: 0, errors: 0, savedBytes: 0 };
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    await Promise.all(files.slice(i, i + CONCURRENCY).map((f) => processOne(f, stats)));
  }

  console.log('\n── Bilan ──────────────────────────────');
  console.log(`Réécrits ${APPLY ? '' : '(prévus) '}: ${stats.rewritten}`);
  console.log(`Ignorés (gain <15 % ou déjà minimal) : ${stats.skipped}`);
  console.log(`Erreurs : ${stats.errors}`);
  console.log(`Espace ${APPLY ? 'libéré' : 'récupérable'} : ${mb(stats.savedBytes)}`);
  console.log('───────────────────────────────────────');
  if (!APPLY) console.log('DRY-RUN : rien écrit. Relance avec --apply (+ policy tmp_brevets_public_update).');
})().catch((e) => { console.error(e); process.exit(1); });
