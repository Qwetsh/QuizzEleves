// Met à jour UNIQUEMENT les colonnes anglaises (name_en, description_en) des
// objets d'alchimie (ingrédients + potions) en base, depuis src/data/alchemyGen.js.
// N'INSÈRE NI NE SUPPRIME rien : UPDATE par clé → préserve effects/desc/édits FR.
// Idempotent, relançable.
//
//   node scripts/update-alchemy-en.mjs
import { createClient } from '@supabase/supabase-js';
import { INGREDIENTS, POTIONS } from '../src/data/alchemyGen.js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const rows = [];
for (const [key, it] of Object.entries(INGREDIENTS)) rows.push({ key, name_en: it.name_en, description_en: it.desc_en });
for (const [key, p] of Object.entries(POTIONS)) rows.push({ key, name_en: p.name_en, description_en: p.desc_en });

console.log(`À mettre à jour : ${rows.length} objets d'alchimie (name_en + description_en).`);

let done = 0, failed = 0;
const POOL = 16;
async function worker(slice) {
  for (const r of slice) {
    const { error } = await supabase
      .from('quete_items')
      .update({ name_en: r.name_en, description_en: r.description_en })
      .eq('key', r.key);
    if (error) { failed++; if (failed <= 5) console.error(`  ✗ ${r.key}: ${error.message}`); }
    else { done++; if (done % 200 === 0) process.stdout.write(`  ${done}/${rows.length}\r`); }
  }
}
// Répartit les lignes en POOL tranches traitées en parallèle.
const slices = Array.from({ length: POOL }, (_, i) => rows.filter((_, idx) => idx % POOL === i));
await Promise.all(slices.map(worker));

console.log(`\n✅ Terminé : ${done} mis à jour, ${failed} échecs.`);
