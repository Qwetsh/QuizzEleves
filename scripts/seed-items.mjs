// Seed des objets vers Supabase (table public.quete_items) depuis items.js.
// À NE LANCER QU'UNE FOIS pour amorcer la base — ensuite la DB est la source de
// vérité (éditée via l'éditeur in-game) et un re-seed écraserait les modifs.
//
//   node scripts/seed-items.mjs
import { createClient } from '@supabase/supabase-js';
import { ITEMS } from '../src/data/items.js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const rows = Object.entries(ITEMS).map(([key, it], i) => ({
  key,
  name: it.name,
  description: it.desc ?? null,
  icon: it.icon ?? null,
  img: it.img ?? null,
  slot: it.slot,
  rarity: it.rarity,
  price: it.price,
  loot_only: !!it.lootOnly,
  effects: it.effects ?? [],
  enabled: true,
  ord: i,
}));

console.log(`Préparé : ${rows.length} objets.`);

const del = await supabase.from('quete_items').delete().neq('key', '__none__');
if (del.error) { console.error('DELETE échec :', del.error.message); process.exit(1); }

const { error } = await supabase.from('quete_items').insert(rows);
if (error) { console.error('INSERT échec :', error.message); process.exit(1); }

const { count } = await supabase.from('quete_items').select('*', { count: 'exact', head: true });
console.log(`Terminé. Total en base : ${count}.`);
