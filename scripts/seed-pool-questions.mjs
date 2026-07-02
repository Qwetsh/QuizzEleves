// Atterrissage des questions du pool culture-G : ingère les fichiers JSON produits
// par le workflow de génération (scripts/generated/pool/<subject>.json) et les
// insère dans quete_questions. Idempotent : delete-then-insert PAR subject.
//
// Format d'un fichier : tableau d'objets
//   { q, a:[4 strings], correct:0-3, e, difficulte:1-5, generalite:1-5 }
// `correct` (0-indexé) → `correcte` (1-indexé) en base. level=null (transverse).
//
//   node scripts/seed-pool-questions.mjs [subject1 subject2 …]   (défaut : tous les fichiers)
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const DIR = path.join(process.cwd(), 'scripts', 'generated', 'pool');
if (!existsSync(DIR)) { console.error('Dossier introuvable: ' + DIR); process.exit(1); }

const only = process.argv.slice(2);
let files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
if (only.length) files = files.filter((f) => only.includes(f.replace(/\.json$/, '')));

const valid = (qq) =>
  qq && typeof qq.q === 'string' && qq.q.trim() &&
  Array.isArray(qq.a) && qq.a.length === 4 && qq.a.every((x) => typeof x === 'string' && x.trim()) &&
  Number.isInteger(qq.correct) && qq.correct >= 0 && qq.correct <= 3;

// Melange les 4 reponses (Fisher-Yates) + recalcule l'index correct : varie la
// position de la bonne reponse en base, independamment d'un biais du generateur.
function shuffleAns(qq) {
  const idx = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { a: idx.map((k) => qq.a[k]), correct: idx.indexOf(qq.correct) };
}

let totalIns = 0;
const report = [];
for (const f of files) {
  const subject = f.replace(/\.json$/, '');
  let arr;
  try { arr = JSON.parse(readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { report.push(`✗ ${subject}: JSON illisible (${e.message})`); continue; }
  if (!Array.isArray(arr)) { report.push(`✗ ${subject}: pas un tableau`); continue; }
  const good = arr.filter(valid);
  const skipped = arr.length - good.length;
  const rows = good.map((qq, i) => {
    const s = shuffleAns(qq);
    return {
      pool: 'cycle4', subject, level: null, q: qq.q.trim(),
      rep_a: s.a[0], rep_b: s.a[1], rep_c: s.a[2], rep_d: s.a[3],
      correcte: s.correct + 1, e: qq.e ?? null, t: null,
      difficulte: Number.isInteger(qq.difficulte) ? qq.difficulte : null,
      generalite: Number.isInteger(qq.generalite) ? qq.generalite : null,
      enabled: true, ord: i,
    };
  });
  // Idempotence : on remplace le pool de ce subject.
  { const { error } = await sb.from('quete_questions').delete().eq('subject', subject); if (error) { report.push(`✗ ${subject}: del (${error.message})`); continue; } }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
    if (error) { report.push(`✗ ${subject}: insert (${error.message})`); break; }
  }
  totalIns += rows.length;
  report.push(`✓ ${subject}: ${rows.length} insérées${skipped ? ` (${skipped} écartées)` : ''}`);
}

console.log(report.join('\n'));
console.log(`\nTotal inséré : ${totalIns} questions sur ${files.length} thème(s).`);
