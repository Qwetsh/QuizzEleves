// Questions d'EXEMPLE pour les nouveaux pools : niveau 6e (cycle 3) + matières
// forcé-only « Culture générale » et « Hardcore » (lycée). Sert à valider la
// mécanique (sélecteur 6e, effet « question forcée »). Le contenu complet
// viendra ensuite (générés par lots et validés).
//
// Idempotent : supprime d'abord les lignes marquées (t = 'exemple-extra'),
// puis réinsère. Ne touche à RIEN d'autre.
//
//   node scripts/seed-questions-extra.mjs
import { createClient } from '@supabase/supabase-js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const MARK = 'exemple-extra';
// [subject, level|null, q, [a,b,c,d], correcte(1..4)]
const DEFS = [
  // --- 6e (cycle 3) : pool cycle4, level '6e' ---
  ['maths', '6e', 'Combien font 7 × 8 ?', ['54', '56', '64', '49'], 2],
  ['maths', '6e', 'Quel est le périmètre d’un carré de côté 5 cm ?', ['10 cm', '15 cm', '20 cm', '25 cm'], 3],
  ['francais', '6e', 'Quel est le pluriel de « cheval » ?', ['chevals', 'chevaux', 'chevales', 'chevaux'], 2],
  ['histoire', '6e', 'Dans quelle ville antique se trouve le Colisée ?', ['Athènes', 'Rome', 'Le Caire', 'Sparte'], 2],
  // --- Culture générale (forcé-only, transverse, pas de level) ---
  ['cultureG', null, 'Quelle est la capitale de l’Australie ?', ['Sydney', 'Melbourne', 'Canberra', 'Perth'], 3],
  ['cultureG', null, 'Qui a peint la Joconde ?', ['Picasso', 'Léonard de Vinci', 'Van Gogh', 'Monet'], 2],
  ['cultureG', null, 'Quelle planète est la plus proche du Soleil ?', ['Vénus', 'Mars', 'Mercure', 'Terre'], 3],
  // --- Hardcore (niveau lycée, forcé-only) ---
  ['hardcore', null, 'Quelle est la dérivée de sin(x) ?', ['−sin(x)', 'cos(x)', '−cos(x)', 'tan(x)'], 2],
  ['hardcore', null, 'Quel est le symbole chimique du sodium ?', ['So', 'Sd', 'Na', 'S'], 3],
  ['hardcore', null, 'Quel philosophe a écrit « Critique de la raison pure » ?', ['Descartes', 'Kant', 'Hegel', 'Nietzsche'], 2],
];

const rows = DEFS.map(([subject, level, q, a, correcte], i) => ({
  pool: 'cycle4',
  subject,
  level,
  q,
  rep_a: a[0], rep_b: a[1], rep_c: a[2] ?? null, rep_d: a[3] ?? null,
  correcte,
  e: null,
  t: MARK,
  enabled: true,
  ord: 9000 + i,
}));

const del = await supabase.from('quete_questions').delete().eq('t', MARK);
if (del.error) { console.error('DELETE échec :', del.error.message); process.exit(1); }

const { error } = await supabase.from('quete_questions').insert(rows);
if (error) { console.error('INSERT échec :', error.message); process.exit(1); }

console.log(`Terminé. ${rows.length} questions d'exemple insérées (6e + cultureG + hardcore).`);
