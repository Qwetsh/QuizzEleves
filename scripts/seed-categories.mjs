// Seed des tables quete_modules / quete_categories DEPUIS la source de vérité
// (src/data/subjects.js) — garantit que la base est byte-pour-byte identique au
// catalogue en dur (Phase 1 « Collège = zéro changement »). Idempotent (upsert).
//
//   node scripts/seed-categories.mjs
import { createClient } from '@supabase/supabase-js';
import {
  BASE_SUBJECTS, SUBJECT_KEYS, DEFAULT_BOARD_SUBJECTS, LV2_SUBJECTS, FORCED_SUBJECT_KEYS, MODULES,
} from '../src/data/subjects.js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const roleOf = (key) => {
  if (FORCED_SUBJECT_KEYS.includes(key)) return 'forced';
  if (key === 'lv2') return 'lv2';
  if (key === 'multi') return 'multi';
  return 'subject';
};

const moduleRows = Object.values(MODULES).map((m, i) => ({
  key: m.key, name: m.name, name_en: m.name_en ?? null, icon: m.icon ?? null,
  kind: m.kind || 'themed', description: m.description ?? null,
  color: m.color ?? null, color_soft: m.colorSoft ?? null, color_deep: m.colorDeep ?? null,
  biome: m.biome ?? null, biome_en: m.biome_en ?? null, enabled: true, ord: i,
}));

const catRows = Object.entries(BASE_SUBJECTS).map(([key, c], i) => ({
  key,
  module: c.module || 'college',
  name: c.name,
  name_en: c.name_en ?? null,
  short: c.short ?? null,
  icon: c.icon ?? null,
  color: c.color ?? null,
  color_soft: c.colorSoft ?? null,
  color_deep: c.colorDeep ?? null,
  biome: c.biome ?? null,
  biome_en: c.biome_en ?? null,
  role: roleOf(key),
  board: SUBJECT_KEYS.includes(key),
  default_on: DEFAULT_BOARD_SUBJECTS.includes(key),
  lv2_member: LV2_SUBJECTS.includes(key),
  enabled: true,
  ord: i,
}));

console.log(`Modules : ${moduleRows.length} · Catégories : ${catRows.length}`);
{
  const { error } = await supabase.from('quete_modules').upsert(moduleRows, { onConflict: 'key' });
  if (error) throw new Error('modules: ' + error.message);
}
{
  const { error } = await supabase.from('quete_categories').upsert(catRows, { onConflict: 'key' });
  if (error) throw new Error('categories: ' + error.message);
}
console.log('✅ Seed modules/catégories terminé.');
