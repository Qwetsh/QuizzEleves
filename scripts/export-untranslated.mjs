// Exporte les questions NON encore traduites en anglais (q_en vide) des matières
// cibles, dans scripts/generated/to-translate.json. Sert de point d'entrée à la
// traduction (manuelle, ou multi-agents) puis à import-translations.mjs.
//
//   node scripts/export-untranslated.mjs
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TARGET_SUBJECTS } from './translate-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const PAGE = 1000;
const rows = [];
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase.from('quete_questions')
    .select('id,subject,q,rep_a,rep_b,rep_c,rep_d,e,q_en')
    .in('subject', TARGET_SUBJECTS)
    .order('id', { ascending: true })
    .range(from, from + PAGE - 1);
  if (error) throw error;
  rows.push(...data);
  if (data.length < PAGE) break;
}

// Non traduites = q_en absent/vide.
const todo = rows.filter((r) => !r.q_en || !String(r.q_en).trim()).map((r) => ({
  id: r.id, subject: r.subject, q: r.q,
  a: [r.rep_a, r.rep_b, r.rep_c, r.rep_d].filter((x) => x != null && x !== ''),
  e: r.e || '',
}));

mkdirSync(join(__dirname, 'generated'), { recursive: true });
const out = join(__dirname, 'generated', 'to-translate.json');
writeFileSync(out, JSON.stringify(todo, null, 0), 'utf8');

const bySubject = todo.reduce((m, q) => ((m[q.subject] = (m[q.subject] || 0) + 1), m), {});
console.log(`${rows.length} questions cibles, ${todo.length} À TRADUIRE :`, bySubject);
console.log('Écrit →', out);
