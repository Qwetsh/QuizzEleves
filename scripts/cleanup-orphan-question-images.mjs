// Nettoyage des images ORPHELINES du bucket `quete-questions` (PersoDB).
//
// Contexte : le bucket utilise des noms de fichiers OPAQUES anti-triche
// (q-<uuid>.jpg). Quand une question est ré-uploadée (image remplacée) ou
// supprimée, l'ancien fichier reste dans le bucket sans jamais être nettoyé.
// Ces orphelins se sont accumulés jusqu'à ~773 Mo (mesuré le 2026-07-30),
// poussant l'org Supabase au-dessus de son quota de stockage (limite 1,1 Go).
//
// Ce script recalcule LUI-MÊME l'ensemble des orphelins (robuste dans le temps) :
//   1. lit tous les noms de fichiers référencés par quete_questions
//      (colonnes img, rep_a_img, rep_b_img, rep_c_img, rep_d_img, audio —
//       ⚠ le bucket contient AUSSI l'audio des questions : hymnes/cris) ;
//   2. liste tout le contenu du bucket (pagination) ;
//   3. orphelins = fichiers du bucket - fichiers référencés ;
//   4. affiche le bilan. Ne SUPPRIME que si l'option --apply est passée.
//
// SÉCURITÉ : supprimer un objet Storage exige la clé service_role (jamais
// committée). Fournis-la via la variable d'environnement SUPABASE_SERVICE_ROLE_KEY
// (Dashboard Supabase → Project Settings → API → service_role secret).
//
//   # Aperçu (dry-run, ne supprime rien) :
//   node scripts/cleanup-orphan-question-images.mjs
//
//   # Suppression réelle (PowerShell) :
//   $env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."; node scripts/cleanup-orphan-question-images.mjs --apply
//
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const BUCKET = 'quete-questions';
const APPLY = process.argv.includes('--apply');

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const fname = (v) => (v ? String(v).split('/').pop().split('?')[0] : null);

// 1) Noms de fichiers référencés par les questions.
async function referencedNames() {
  const set = new Set();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('quete_questions')
      .select('img, rep_a_img, rep_b_img, rep_c_img, rep_d_img, audio')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data.length) break;
    for (const row of data) {
      for (const v of [row.img, row.rep_a_img, row.rep_b_img, row.rep_c_img, row.rep_d_img, row.audio]) {
        const n = fname(v);
        if (n) set.add(n);
      }
    }
    if (data.length < PAGE) break;
  }
  return set;
}

// 2) Tous les fichiers du bucket (nom + taille).
async function bucketFiles() {
  const files = [];
  const PAGE = 1000;
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.storage.from(BUCKET).list('', {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data.length) break;
    for (const f of data) files.push({ name: f.name, size: f.metadata?.size ?? 0 });
    if (data.length < PAGE) break;
  }
  return files;
}

const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' Mo';

(async () => {
  console.log(`Bucket : ${BUCKET}  (${URL})`);
  const usingServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log(`Clé : ${usingServiceRole ? 'service_role' : 'anon (⚠ suppression probablement refusée par RLS)'}`);

  const [referenced, files] = await Promise.all([referencedNames(), bucketFiles()]);
  const orphans = files.filter((f) => !referenced.has(f.name));
  const orphanBytes = orphans.reduce((s, f) => s + Number(f.size || 0), 0);
  const totalBytes = files.reduce((s, f) => s + Number(f.size || 0), 0);

  console.log('\n── Bilan ──────────────────────────────');
  console.log(`Fichiers dans le bucket : ${files.length}  (${mb(totalBytes)})`);
  console.log(`Noms référencés (questions) : ${referenced.size}`);
  console.log(`ORPHELINS : ${orphans.length}  (${mb(orphanBytes)})`);
  console.log(`Restant après nettoyage : ${files.length - orphans.length} fichiers (${mb(totalBytes - orphanBytes)})`);
  console.log('───────────────────────────────────────\n');

  if (!orphans.length) return console.log('Rien à supprimer. ✅');

  if (!APPLY) {
    console.log('DRY-RUN : aucune suppression. Relance avec --apply (et SUPABASE_SERVICE_ROLE_KEY) pour supprimer.');
    console.log('Exemples d\'orphelins :', orphans.slice(0, 5).map((f) => f.name).join(', '));
    return;
  }

  const anonOk = process.env.CLEANUP_ANON_OK === '1'; // suppression via anon + policy RLS DELETE temporaire
  if (!usingServiceRole && !anonOk) {
    console.error('\n❌ --apply requiert SUPABASE_SERVICE_ROLE_KEY (la clé anon ne peut pas supprimer sans policy). Abandon.');
    console.error('   (ou CLEANUP_ANON_OK=1 si une policy RLS DELETE publique est temporairement en place)');
    process.exit(1);
  }

  console.log(`Suppression de ${orphans.length} orphelins…`);
  const BATCH = 100;
  let done = 0;
  for (let i = 0; i < orphans.length; i += BATCH) {
    const names = orphans.slice(i, i + BATCH).map((f) => f.name);
    const { error } = await sb.storage.from(BUCKET).remove(names);
    if (error) throw error;
    done += names.length;
    console.log(`  ${done}/${orphans.length}`);
  }
  console.log(`\n✅ Terminé. ${mb(orphanBytes)} libérés.`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
