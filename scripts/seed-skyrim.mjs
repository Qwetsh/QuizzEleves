// Assemble + seede les questions Skyrim : joint le fichier source (question +
// bonne réponse) avec les 3 fichiers de distracteurs générés par agent, mélange
// les positions, mappe la difficulté (Facile/Moyen/Difficile → 2/3/4) et insère
// dans quete_questions (subject='skyrim', t=catégorie). Idempotent (delete-then-insert).
//   node scripts/seed-skyrim.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const DIR = path.join(process.cwd(), 'scripts', 'generated', 'pool');
const read = (f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8'));

const source = read('skyrim_source.json');
const distractors = {};
for (const f of ['skyrim_facile.json', 'skyrim_moyen.json', 'skyrim_difficile.json']) {
  for (const d of read(f)) distractors[d.id] = d.distractors;
}

const DIFF = { Facile: 2, Moyen: 3, Difficile: 4 };

function shuffle4(correct, distr) {
  const a = [correct, ...distr];
  const idx = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { a: idx.map((k) => a[k]), correcte: idx.indexOf(0) + 1 };
}

const rows = [];
const problems = [];
source.forEach((q, i) => {
  const distr = distractors[q.id];
  if (!Array.isArray(distr) || distr.length !== 3 || distr.some((x) => typeof x !== 'string' || !x.trim())) {
    problems.push(`id ${q.id}: distracteurs manquants/invalides`); return;
  }
  const uniq = new Set([q.correct.trim().toLowerCase(), ...distr.map((x) => x.trim().toLowerCase())]);
  if (uniq.size !== 4) problems.push(`id ${q.id}: doublon entre bonne réponse et distracteurs`);
  const { a, correcte } = shuffle4(q.correct.trim(), distr.map((x) => x.trim()));
  rows.push({
    pool: 'cycle4', subject: 'skyrim', level: null, q: q.q.trim(),
    rep_a: a[0], rep_b: a[1], rep_c: a[2], rep_d: a[3], correcte,
    e: null, t: q.categorie, difficulte: DIFF[q.difficulte] ?? null, generalite: null,
    enabled: true, ord: i,
  });
});

if (problems.length) { console.log('⚠ Problèmes:\n' + problems.join('\n')); }
console.log(`${rows.length}/${source.length} questions prêtes.`);

{ const { error } = await sb.from('quete_questions').delete().eq('subject', 'skyrim'); if (error) { console.error('del:', error.message); process.exit(1); } }
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) { console.error('insert:', error.message); process.exit(1); }
}
console.log(`✓ ${rows.length} questions Skyrim insérées.`);
