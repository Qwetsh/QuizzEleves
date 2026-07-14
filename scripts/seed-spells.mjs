// Seed des SORTS de base (extension « Magie ») dans Supabase, depuis
// src/data/spells.js (BASE_SPELLS). Idempotent (purge + réinsère les clés du
// set de base UNIQUEMENT — les sorts custom créés dans l'éditeur sont intacts).
//
//   node scripts/seed-spells.mjs
//
// ⚠️ DB = source de vérité ensuite : édite les sorts dans l'éditeur (onglet
//    ✨ Sorts), pas dans spells.js (qui reste le repli hors-ligne).
import { createClient } from '@supabase/supabase-js';
import { BASE_SPELLS } from '../src/data/spells.js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const rows = BASE_SPELLS.map((s, i) => ({
  key: s.key,
  name: s.name,
  name_en: s.name_en ?? null,
  description: s.desc || '',
  description_en: s.desc_en ?? null,
  icon: s.icon || '✨',
  color: s.color || '#8745d4',
  runes: s.runes || [],
  cost: s.cost || 0,
  targeted: !!s.targeted,
  face_pick: !!s.facePick,
  actions: s.actions || [],
  enabled: true,
  ord: i,
  updated_at: new Date().toISOString(),
}));

console.log(`Préparé : ${rows.length} sorts de base.`);
{
  const { error } = await supabase.from('quete_spells').delete().in('key', rows.map((r) => r.key));
  if (error) throw new Error('purge: ' + error.message);
}
{
  const { error } = await supabase.from('quete_spells').insert(rows);
  if (error) throw new Error('insert: ' + error.message);
}
console.log(`quete_spells : ${rows.length} sorts insérés ✓`);
