// Seed des questions Allemand + Espagnol (LV2, 6e→3e) vers Supabase
// (table public.quete_questions), depuis les fichiers générés
// scripts/generated/{allemand,espagnol}.json.
//
// Convention : la bonne réponse est en 1re position (answers[0]) → correcte = 1 ;
// le jeu mélange les réponses à l'affichage. `t` = thème (affiché).
// IDEMPOTENT : supprime d'abord toutes les lignes des matières allemand/espagnol,
// puis réinsère. À relancer après chaque régénération des fichiers.
//
//   node scripts/seed-questions-lv2.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const DIR = join(dirname(fileURLToPath(import.meta.url)), 'generated');
const LEVELS = new Set(['6e', '5e', '4e', '3e']);
const SUBJECTS = { allemand: 'allemand.json', espagnol: 'espagnol.json' };

// Charge + valide un fichier de questions généré.
function load(subject, file) {
  const data = JSON.parse(readFileSync(join(DIR, file), 'utf8'));
  if (!Array.isArray(data)) throw new Error(`${file} : pas un tableau`);
  const seen = new Set();
  const rows = data.map((o, i) => {
    const where = `${file}[${i}]`;
    if (o.subject !== subject) throw new Error(`${where} : subject attendu ${subject}, reçu ${o.subject}`);
    if (!LEVELS.has(o.level)) throw new Error(`${where} : level invalide « ${o.level} »`);
    if (typeof o.q !== 'string' || !o.q.trim()) throw new Error(`${where} : énoncé vide`);
    if (!Array.isArray(o.answers) || o.answers.length !== 4) throw new Error(`${where} : il faut exactement 4 réponses`);
    if (o.answers.some((a) => typeof a !== 'string' || !a.trim())) throw new Error(`${where} : réponse vide`);
    if (new Set(o.answers).size !== 4) throw new Error(`${where} : réponses en double`);
    const key = `${o.level}|${o.q}`;
    if (seen.has(key)) throw new Error(`${where} : question en double « ${o.q} »`);
    seen.add(key);
    return {
      pool: 'cycle4',
      subject,
      level: o.level,
      q: o.q,
      rep_a: o.answers[0], rep_b: o.answers[1], rep_c: o.answers[2], rep_d: o.answers[3],
      correcte: 1, // bonne réponse en 1re position (mélangée à l'affichage)
      e: o.e || null,
      t: o.theme || null,
      enabled: true,
      ord: i,
    };
  });
  return rows;
}

const allRows = [];
const summary = {};
for (const [subject, file] of Object.entries(SUBJECTS)) {
  const rows = load(subject, file);
  allRows.push(...rows);
  summary[subject] = rows.reduce((acc, r) => { acc[r.level] = (acc[r.level] || 0) + 1; return acc; }, {});
}

console.log('Validation OK. Répartition :');
for (const [s, byLevel] of Object.entries(summary)) {
  const total = Object.values(byLevel).reduce((a, b) => a + b, 0);
  console.log(`  ${s} : ${total}  (` + ['6e', '5e', '4e', '3e'].map((l) => `${l}:${byLevel[l] || 0}`).join(' · ') + ')');
}

// Idempotence : on repart d'une base propre pour ces 2 matières.
for (const subject of Object.keys(SUBJECTS)) {
  const del = await supabase.from('quete_questions').delete().eq('subject', subject);
  if (del.error) { console.error(`DELETE ${subject} échec :`, del.error.message); process.exit(1); }
}

// Insertion par lots (marge de sécurité sous les limites de payload).
for (let i = 0; i < allRows.length; i += 200) {
  const chunk = allRows.slice(i, i + 200);
  const { error } = await supabase.from('quete_questions').insert(chunk);
  if (error) { console.error('INSERT échec :', error.message); process.exit(1); }
}

const { count } = await supabase.from('quete_questions')
  .select('*', { count: 'exact', head: true })
  .in('subject', ['allemand', 'espagnol']);
console.log(`\nTerminé. ${allRows.length} questions insérées · total en base (allemand+espagnol) : ${count}.`);
