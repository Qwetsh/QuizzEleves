// Ré-encodage des audios déjà compressés du bucket `quete-questions` (PersoDB)
// vers un débit plus raisonnable. Cibles : hymnes, cris d'animaux, extraits
// musicaux — la RECONNAISSANCE reste transparente à ~112 kbps.
//
// SÛRETÉ :
//   - Ré-encodage EN PLACE, MÊME format et MÊME nom (ogg→ogg, mp3→mp3, oga→oga)
//     → l'URL en base ne change pas, aucun UPDATE de quete_questions.
//   - On ne réécrit QUE si le résultat est ≥15 % plus léger (sinon original gardé
//     → pas de perte de qualité inutile sur les fichiers déjà bien encodés).
//   - Ré-encodage lossy→lossy : perte générationnelle légère, acceptable pour de
//     la reconnaissance. m4a (4 Mo) et mid ignorés.
//   - Upsert via la policy INSERT/UPDATE publique déjà en place → clé anon suffit.
//
//   node scripts/recompress-question-audio.mjs             # dry-run (mesure)
//   node scripts/recompress-question-audio.mjs --limit 20  # dry-run échantillon
//   node scripts/recompress-question-audio.mjs --apply      # réécrit
//
import { createClient } from '@supabase/supabase-js';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = promisify(execFile);
const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const BUCKET = 'quete-questions';
const APPLY = process.argv.includes('--apply');
const limIdx = process.argv.indexOf('--limit');
const LIMIT = limIdx >= 0 ? parseInt(process.argv[limIdx + 1], 10) : Infinity;

const MIN_GAIN = 0.15;      // ne réécrit que si ≥15 % plus léger
const CONCURRENCY = 4;
// paramètres d'encodage + mime, par extension
const ENC = {
  ogg: { args: ['-c:a', 'libvorbis', '-q:a', '3'], mime: 'audio/ogg' },
  oga: { args: ['-c:a', 'libvorbis', '-q:a', '3'], mime: 'audio/ogg' },
  mp3: { args: ['-c:a', 'libmp3lame', '-b:a', '112k'], mime: 'audio/mpeg' },
};

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' Mo';
const pub = (name) => sb.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;

async function listAudio() {
  const out = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.storage.from(BUCKET).list('', { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data.length) break;
    for (const f of data) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (ENC[ext]) out.push({ name: f.name, ext, size: Number(f.metadata?.size || 0) });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

async function processOne(f, stats) {
  const inPath = join(tmpdir(), 'ain-' + f.name);
  const outPath = join(tmpdir(), 'aout-' + f.name); // même extension → conteneur déduit
  try {
    const res = await fetch(pub(f.name));
    if (!res.ok) throw new Error('download HTTP ' + res.status);
    await writeFile(inPath, Buffer.from(await res.arrayBuffer()));
    await run(ffmpegPath, ['-y', '-i', inPath, ...ENC[f.ext].args, outPath]);
    const outBuf = await readFile(outPath);
    const gain = 1 - outBuf.length / f.size;
    if (outBuf.length === 0 || gain < MIN_GAIN) { stats.skipped++; return; }
    stats.savedBytes += f.size - outBuf.length;
    stats.rewritten++;
    if (APPLY) {
      const { error } = await sb.storage.from(BUCKET).upload(f.name, outBuf, { contentType: ENC[f.ext].mime, upsert: true });
      if (error) throw error;
    }
  } catch (e) {
    stats.errors++;
    console.warn(`  ⚠ ${f.name}: ${e.message}`);
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}

(async () => {
  console.log(`Audio ré-encodage  —  ${APPLY ? 'APPLY' : 'DRY-RUN'}${LIMIT !== Infinity ? `  limit=${LIMIT}` : ''}`);
  let files = await listAudio();
  const totalAll = files.reduce((s, f) => s + f.size, 0);
  if (LIMIT !== Infinity) files = files.slice(0, LIMIT);
  console.log(`Fichiers audio : ${files.length}  (${mb(files.reduce((s, f) => s + f.size, 0))} sur ${mb(totalAll)})\n`);

  const stats = { rewritten: 0, skipped: 0, errors: 0, savedBytes: 0 };
  let done = 0;
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    await Promise.all(files.slice(i, i + CONCURRENCY).map((f) => processOne(f, stats)));
    done = Math.min(i + CONCURRENCY, files.length);
    if (done % 40 === 0 || done === files.length) console.log(`  ${done}/${files.length}  (gain cumulé ${mb(stats.savedBytes)})`);
  }

  console.log('\n── Bilan ──────────────────────────────');
  console.log(`Réécrits ${APPLY ? '' : '(prévus) '}: ${stats.rewritten}`);
  console.log(`Ignorés (gain <15 %) : ${stats.skipped}`);
  console.log(`Erreurs : ${stats.errors}`);
  console.log(`Espace ${APPLY ? 'libéré' : 'récupérable'} : ${mb(stats.savedBytes)}`);
  console.log('───────────────────────────────────────');
  if (!APPLY) console.log('DRY-RUN : rien écrit. Relance avec --apply pour appliquer.');
})().catch((e) => { console.error(e); process.exit(1); });
