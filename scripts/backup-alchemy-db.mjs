// Sauvegarde JSON de l'alchimie en DB (ingrédients + potions + recettes) AVANT
// tout reseed. Pagination >1000 lignes. Filet de sécurité pour le rééquilibrage
// des potions (et pour ne JAMAIS perdre les effets d'ingrédients édités à la main).
//   node scripts/backup-alchemy-db.mjs [suffixe]
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.env.VITE_SUPABASE_URL || 'https://tppecozmygtjmbcdqgfc.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_tVHWrjNRFN_RDTuD5PEdkA_uMaP7HXJ';
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

async function fetchAll(table, filter) {
  const out = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select('*').order('ord', { ascending: true }).range(from, from + PAGE - 1);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...data);
    if (data.length < PAGE) break;
  }
  return out;
}

const items = await fetchAll('quete_items', (q) => q.in('family', ['ingredient', 'potion']));
const recipes = await fetchAll('quete_recipes');
const ingredients = items.filter((i) => i.family === 'ingredient');
const potions = items.filter((i) => i.family === 'potion');

const suffix = process.argv[2] || 'manual';
const dir = join(process.cwd(), 'backups');
mkdirSync(dir, { recursive: true });
const path = join(dir, `alchemy-db-${suffix}.json`);
writeFileSync(path, JSON.stringify({ savedSuffix: suffix, ingredients, potions, recipes }, null, 2), 'utf8');

console.log(`Sauvegarde : ${ingredients.length} ingrédients, ${potions.length} potions, ${recipes.length} recettes`);
console.log('→', path);
