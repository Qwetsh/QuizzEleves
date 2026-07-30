// Conversion des 8 fichiers .wav NON COMPRESSÉS du bucket `quete-questions`
// (cris d'animaux, mini-jeu « devine l'animal ») vers .ogg (Vorbis ~128 kbps).
// Un .wav de ~8 Mo tombe à ~0,5 Mo, transparent pour reconnaître un cri.
//
// L'extension change (.wav → .ogg) donc l'URL change : le script met à jour la
// colonne quete_questions.audio en conséquence. Ordre sûr par fichier :
//   1. convertir + UPLOAD le .ogg (policy INSERT publique → OK en anon) ;
//   2. UPDATE quete_questions.audio vers la nouvelle URL ;
//   3. seulement ensuite, SUPPRIMER l'ancien .wav (nécessite une policy DELETE
//      publique temporaire + CLEANUP_ANON_OK=1 ; sinon le .wav est laissé et
//      deviendra un orphelin nettoyable plus tard).
//
//   node scripts/recompress-question-wav.mjs           # dry-run
//   CLEANUP_ANON_OK=1 node scripts/recompress-question-wav.mjs --apply
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
const ANON_OK = process.env.CLEANUP_ANON_OK === '1';

const sb = createClient(URL, KEY, { auth: { persistSession: false } });
const mb = (b) => (b / 1024 / 1024).toFixed(2) + ' Mo';
const pub = (name) => sb.storage.from(BUCKET).getPublicUrl(name).data.publicUrl;

async function listWavs() {
  const out = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.storage.from(BUCKET).list('', { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data.length) break;
    for (const f of data) {
      if (f.name.toLowerCase().endsWith('.wav')) out.push({ name: f.name, size: Number(f.metadata?.size || 0) });
    }
    if (data.length < PAGE) break;
  }
  return out;
}

(async () => {
  console.log(`WAV → OGG  —  ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const wavs = await listWavs();
  console.log(`Fichiers .wav : ${wavs.length}  (${mb(wavs.reduce((s, f) => s + f.size, 0))})\n`);

  let saved = 0, ok = 0, errs = 0;
  for (const w of wavs) {
    const oggName = w.name.replace(/\.wav$/i, '.ogg');
    const inPath = join(tmpdir(), 'in-' + w.name);
    const outPath = join(tmpdir(), 'out-' + oggName);
    try {
      const res = await fetch(pub(w.name));
      if (!res.ok) throw new Error('download HTTP ' + res.status);
      await writeFile(inPath, Buffer.from(await res.arrayBuffer()));
      await run(ffmpegPath, ['-y', '-i', inPath, '-c:a', 'libvorbis', '-q:a', '4', outPath]);
      const outBuf = await readFile(outPath);
      saved += w.size - outBuf.length;
      console.log(`  ${w.name}  ${mb(w.size)} → ${oggName}  ${mb(outBuf.length)}`);

      if (APPLY) {
        // 1) upload ogg
        const up = await sb.storage.from(BUCKET).upload(oggName, outBuf, { contentType: 'audio/ogg', upsert: true });
        if (up.error) throw up.error;
        // 2) maj DB : toutes les questions dont audio pointe vers l'ancien .wav
        const { data: rows, error: selErr } = await sb.from('quete_questions').select('id, audio').like('audio', '%' + w.name);
        if (selErr) throw selErr;
        for (const r of rows) {
          const newUrl = r.audio.replace(w.name, oggName);
          const { error: updErr } = await sb.from('quete_questions').update({ audio: newUrl }).eq('id', r.id);
          if (updErr) throw updErr;
        }
        // 3) suppression de l'ancien .wav (si policy DELETE en place)
        if (ANON_OK || process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const del = await sb.storage.from(BUCKET).remove([w.name]);
          if (del.error) throw del.error;
        } else {
          console.log(`    (ancien .wav conservé — pas de droit DELETE ; orphelin à nettoyer plus tard)`);
        }
      }
      ok++;
    } catch (e) {
      errs++;
      console.warn(`  ⚠ ${w.name}: ${e.message}`);
    } finally {
      await unlink(inPath).catch(() => {});
      await unlink(outPath).catch(() => {});
    }
  }

  console.log(`\n── Bilan ── OK ${ok} · erreurs ${errs} · espace ${APPLY ? 'libéré' : 'récupérable'} ≈ ${mb(saved)}`);
  if (!APPLY) console.log('DRY-RUN : rien écrit. Relance avec --apply (+ CLEANUP_ANON_OK=1 pour supprimer les .wav).');
})().catch((e) => { console.error(e); process.exit(1); });
