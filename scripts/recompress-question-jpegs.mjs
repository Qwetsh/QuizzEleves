// Recompression des JPEG du bucket `quete-questions` (PersoDB) pour réduire le
// stockage. Beaucoup de JPEG ont été uploadés bruts (jusqu'à 13 Mo pour une image
// affichée en petit) → ré-encodage mozjpeg q82 + redimension max 1400px.
//
// SÛRETÉ :
//   - JPEG → JPEG, MÊME nom de fichier : l'URL en base ne change pas, aucun
//     UPDATE de quete_questions nécessaire.
//   - On ne réécrit QUE si le nouveau fichier est ≥10 % plus léger (sinon on
//     garde l'original intact — pas de perte de qualité inutile).
//   - N'agrandit jamais (withoutEnlargement), ne touche ni PNG, ni audio, ni SVG.
//   - La réécriture (upsert) passe par la policy publique UPDATE/INSERT déjà en
//     place sur le bucket → la clé anon suffit, aucune policy à ajouter.
//
//   node scripts/recompress-question-jpegs.mjs            # dry-run (mesure, n'écrit rien)
//   node scripts/recompress-question-jpegs.mjs --limit 30 # dry-run sur 30 fichiers
//   node scripts/recompress-question-jpegs.mjs --apply     # réécrit réellement
//
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const BUCKET = 'quete-questions';
const APPLY = process.argv.includes('--apply');
const limIdx = process.argv.indexOf('--limit');
const LIMIT = limIdx >= 0 ? parseInt(process.argv[limIdx + 1], 10) : Infinity;

const MAX_DIM = 1400;
const QUALITY = 82;
const MIN_GAIN = 0.10; // ne réécrit que si ≥10 % plus léger
const CONCURRENCY = 6;

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' Mo';

async function listJpegs() {
  const out = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.storage.from(BUCKET).list('', { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data.length) break;
    for (const f of data) {
      const ext = f.name.split('.').pop().toLowerCase();
      if (ext === 'jpg' || ext === 'jpeg') out.push({ name: f.name, size: Number(f.metadata?.size || 0) });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

async function processOne(f, stats) {
  try {
    const url = sb.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const inBuf = Buffer.from(await res.arrayBuffer());
    const outBuf = await sharp(inBuf)
      .rotate() // respecte l'orientation EXIF avant de la perdre
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toBuffer();

    const gain = 1 - outBuf.length / inBuf.length;
    if (outBuf.length === 0 || gain < MIN_GAIN) {
      stats.skipped++;
      return;
    }
    stats.savedBytes += inBuf.length - outBuf.length;
    stats.rewritten++;
    if (APPLY) {
      const { error } = await sb.storage.from(BUCKET).upload(f.name, outBuf, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
    }
  } catch (e) {
    stats.errors++;
    console.warn(`  ⚠ ${f.name}: ${e.message}`);
  }
}

(async () => {
  console.log(`Bucket : ${BUCKET}  —  ${APPLY ? 'APPLY (réécriture)' : 'DRY-RUN (mesure)'}${LIMIT !== Infinity ? `  limit=${LIMIT}` : ''}`);
  let jpegs = await listJpegs();
  const totalJpeg = jpegs.reduce((s, f) => s + f.size, 0);
  if (LIMIT !== Infinity) jpegs = jpegs.slice(0, LIMIT);
  console.log(`JPEG à traiter : ${jpegs.length}  (${mb(jpegs.reduce((s, f) => s + f.size, 0))} sur ${mb(totalJpeg)} au total)\n`);

  const stats = { rewritten: 0, skipped: 0, errors: 0, savedBytes: 0 };
  let done = 0;
  for (let i = 0; i < jpegs.length; i += CONCURRENCY) {
    await Promise.all(jpegs.slice(i, i + CONCURRENCY).map((f) => processOne(f, stats)));
    done = Math.min(i + CONCURRENCY, jpegs.length);
    if (done % 60 === 0 || done === jpegs.length) console.log(`  ${done}/${jpegs.length}  (gain cumulé ${mb(stats.savedBytes)})`);
  }

  console.log('\n── Bilan ──────────────────────────────');
  console.log(`Réécrits ${APPLY ? '' : '(prévus) '}: ${stats.rewritten}`);
  console.log(`Ignorés (gain <10 %) : ${stats.skipped}`);
  console.log(`Erreurs : ${stats.errors}`);
  console.log(`Espace ${APPLY ? 'libéré' : 'récupérable'} : ${mb(stats.savedBytes)}`);
  console.log('───────────────────────────────────────');
  if (!APPLY) console.log('DRY-RUN : rien écrit. Relance avec --apply pour appliquer.');
})().catch((e) => { console.error(e); process.exit(1); });
