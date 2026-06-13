// Seed des questions vers Supabase (table public.quete_questions).
// Lit les fichiers JS source (_cycle4.js, _brevet.js), VIDE la table puis
// réinsère tout. À NE LANCER QU'UNE FOIS pour amorcer la base — après, la DB
// devient la source de vérité (éditée à la main / via l'éditeur in-game), et
// un nouveau seed écraserait les modifs.
//
//   node scripts/seed-questions.mjs
import { createClient } from '@supabase/supabase-js';
import { CYCLE4_QUESTIONS } from '../src/data/questions/_cycle4.js';
import { BREVET_QUESTIONS } from '../src/data/questions/_brevet.js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const levelOf = (t) => {
  const m = /^\s*(6e|5e|4e|3e)/.exec(t || '');
  return m ? m[1] : null;
};

const rows = [];
let skipped = 0;
const collect = (pool, source, withLevel) => {
  for (const [subject, arr] of Object.entries(source)) {
    arr.forEach((it, i) => {
      // 2 à 4 réponses (Vrai/Faux = 2), bonne réponse dans l'intervalle valide
      if (!Array.isArray(it.a) || it.a.length < 2 || it.a.length > 4 || it.c < 0 || it.c >= it.a.length) {
        skipped++;
        console.warn(`  ignorée : ${pool}/${subject} #${i} (nbRep=${it.a?.length}, c=${it.c})`);
        return;
      }
      rows.push({
        pool,
        subject,
        level: withLevel ? levelOf(it.t) : null,
        q: it.q,
        rep_a: it.a[0],
        rep_b: it.a[1],
        rep_c: it.a[2] ?? null,
        rep_d: it.a[3] ?? null,
        correcte: it.c + 1,
        e: it.e ?? null,
        t: it.t ?? null,
        ord: i,
      });
    });
  }
};

collect('cycle4', CYCLE4_QUESTIONS, true);
collect('brevet', BREVET_QUESTIONS, false);

console.log(`Préparé : ${rows.length} questions (${skipped} ignorées car format invalide).`);

// Purge puis insertion par lots
const del = await supabase.from('quete_questions').delete().neq('id', -1);
if (del.error) { console.error('DELETE échec :', del.error.message); process.exit(1); }
console.log('Table vidée.');

const BATCH = 200;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const { error } = await supabase.from('quete_questions').insert(chunk);
  if (error) { console.error(`INSERT lot ${i / BATCH} échec :`, error.message); process.exit(1); }
  console.log(`Inséré ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
}

const { count } = await supabase.from('quete_questions').select('*', { count: 'exact', head: true });
console.log(`Terminé. Total en base : ${count}.`);
