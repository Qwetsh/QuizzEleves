// Importe les traductions anglaises dans quete_questions (colonnes *_en), par id.
// Entrée = un JSON (chemin en argument, défaut scripts/generated/translated.json)
// au format TABLEAU [{ id, q_en, rep_a_en, rep_b_en, rep_c_en, rep_d_en, e_en }]
// (ou objet { id: { … } }). Idempotent (UPDATE par id).
//
//   node scripts/import-translations.mjs [chemin.json]
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const path = process.argv[2] || join(__dirname, 'generated', 'translated.json');
const raw = JSON.parse(readFileSync(path, 'utf8'));
// Normalise en tableau d'objets avec `id`.
const list = Array.isArray(raw) ? raw : Object.entries(raw).map(([id, v]) => ({ id: Number(id), ...v }));

const COLS = ['q_en', 'rep_a_en', 'rep_b_en', 'rep_c_en', 'rep_d_en', 'e_en'];
const blank = (v) => (v == null || v === '' ? null : v);

let done = 0, fail = 0;
for (const t of list) {
  if (t.id == null) { fail++; continue; }
  const patch = { updated_at: new Date().toISOString() };
  for (const c of COLS) if (c in t) patch[c] = blank(t[c]);
  const { error } = await supabase.from('quete_questions').update(patch).eq('id', t.id);
  if (error) { fail++; if (fail <= 5) console.warn('échec id', t.id, error.message); }
  else done++;
  if (done % 100 === 0) process.stdout.write(`  ${done}/${list.length}\r`);
}
console.log(`✅ ${done} traductions importées, ${fail} échecs (sur ${list.length}).`);
