// Seede les questions « Le Seigneur des anneaux » (CSV « ; » — champs guillemetés
// SEULEMENT s'ils contiennent un « ; »). Parser CSV à états (respecte les
// guillemets), mélange les positions de réponse. Idempotent : delete-then-insert
// subject='seigneur_des_anneaux'. t = sous_theme (Production, Casting, Lieux…).
//   node scripts/seed-seigneur-des-anneaux.mjs
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const file = path.join(process.cwd(), 'scripts', 'generated', 'pool', 'seigneur_des_anneaux_source.csv');
const lines = readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim());
lines.shift(); // en-tête

// Parser CSV « ; » : champ entre guillemets => délimiteur ignoré à l'intérieur,
// "" => guillemet littéral. Champs nus autorisés.
const parseCSV = (line) => {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ';') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
};

function shuffle4(correct, distr) {
  const a = [correct, ...distr];
  const idx = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { a: idx.map((k) => a[k]), correcte: idx.indexOf(0) + 1 };
}

const rows = [];
const problems = [];
lines.forEach((line, i) => {
  const f = parseCSV(line);
  if (f[0] === 'theme') return; // en-tête résiduel éventuel
  if (f.length < 10) { problems.push(`ligne ${i + 2}: ${f.length} champs`); return; }
  const [, sous, q, bonne, d1, d2, d3, expl, diff, gen] = f;
  const distr = [d1, d2, d3].map((x) => x.trim());
  const uniq = new Set([bonne.trim().toLowerCase(), ...distr.map((x) => x.toLowerCase())]);
  if (uniq.size !== 4) problems.push(`ligne ${i + 2}: doublon réponse/distracteur — « ${q.slice(0, 40)}… »`);
  const { a, correcte } = shuffle4(bonne.trim(), distr);
  rows.push({
    pool: 'cycle4', subject: 'seigneur_des_anneaux', level: null, q: q.trim(),
    rep_a: a[0], rep_b: a[1], rep_c: a[2], rep_d: a[3], correcte,
    e: expl.trim() || null, t: sous.trim() || null,
    difficulte: parseInt(diff, 10) || null, generalite: parseInt(gen, 10) || null,
    enabled: true, ord: i,
  });
});

if (problems.length) console.log('⚠ Problèmes:\n' + problems.join('\n'));
console.log(`${rows.length} questions prêtes.`);

{ const { error } = await sb.from('quete_questions').delete().eq('subject', 'seigneur_des_anneaux'); if (error) { console.error('del:', error.message); process.exit(1); } }
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from('quete_questions').insert(rows.slice(i, i + 500));
  if (error) { console.error('insert:', error.message); process.exit(1); }
}
console.log(`✓ ${rows.length} questions « Le Seigneur des anneaux » insérées.`);
