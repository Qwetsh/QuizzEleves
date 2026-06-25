// Seed du nouveau système d'alchimie (20 ingrédients + 1140 potions + recettes)
// dans Supabase, depuis src/data/alchemyGen.js (généré par gen-alchemy.mjs).
//
// REMPLACE l'ancien set : supprime les rows family ingredient/potion (garde les
// parchemins) et toutes les recettes, puis insère le nouveau set. Idempotent
// (relançable). Les parchemins (Enchantement) et le reste du catalogue sont
// intacts.
//
//   node scripts/seed-alchemy.mjs
import { createClient } from '@supabase/supabase-js';
import { INGREDIENTS, POTIONS, ALCHEMY_RECIPES } from '../src/data/alchemyGen.js';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
async function insertAll(table, rows) {
  let done = 0;
  for (const part of chunk(rows, 400)) {
    const { error } = await supabase.from(table).insert(part);
    if (error) throw new Error(`${table}: ${error.message}`);
    done += part.length;
    process.stdout.write(`  ${table}: ${done}/${rows.length}\r`);
  }
  console.log(`  ${table}: ${done}/${rows.length} ✓`);
}

const itemRows = [];
let ord = 1000;
for (const [key, it] of Object.entries(INGREDIENTS)) {
  itemRows.push({ key, name: it.name, icon: it.icon, img: it.img ?? null, slot: 'consumable', rarity: it.rarity, price: it.price, loot_only: false, effects: it.effects, family: 'ingredient', description: it.desc, enabled: true, ord: ord++ });
}
for (const [key, p] of Object.entries(POTIONS)) {
  itemRows.push({ key, name: p.name, icon: p.icon, img: p.img ?? null, slot: 'consumable', rarity: p.rarity, price: 0, loot_only: true, effects: p.effects, family: 'potion', description: p.desc, enabled: true, ord: ord++ });
}
const recipeRows = ALCHEMY_RECIPES.map((r, i) => ({ key: r.id, ingredients: r.ingredients, potion: r.potion, enabled: true, ord: i }));

console.log(`Préparé : ${Object.keys(INGREDIENTS).length} ingrédients + ${Object.keys(POTIONS).length} potions = ${itemRows.length} items ; ${recipeRows.length} recettes.`);

// 1) purge ancien set alchimie (ingredient/potion uniquement — parchemins gardés)
console.log('Purge ancien set ingredient/potion…');
{
  const { error } = await supabase.from('quete_items').delete().in('family', ['ingredient', 'potion']);
  if (error) throw new Error('purge items: ' + error.message);
}
console.log('Purge des recettes existantes…');
{
  const { error } = await supabase.from('quete_recipes').delete().neq('key', '__none__');
  if (error) throw new Error('purge recipes: ' + error.message);
}

// 2) insertion du nouveau set
console.log('Insertion…');
await insertAll('quete_items', itemRows);
await insertAll('quete_recipes', recipeRows);

console.log('✅ Seed alchimie terminé.');
