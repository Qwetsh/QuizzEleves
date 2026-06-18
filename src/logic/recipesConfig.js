// Chargement et édition des RECETTES d'alchimie personnalisées depuis Supabase
// (table public.quete_recipes). Mêmes principes offline-safe que les objets/
// événements : cache localStorage au boot (synchrone), puis rafraîchissement
// réseau. Les recettes personnalisées sont FUSIONNÉES par-dessus les intégrées
// (code) via setCustomRecipes — les intégrées restent toujours présentes.
import { supabase } from './supabaseClient.js';
import { setCustomRecipes } from '../data/recipes.js';

const LS_KEY = 'quete_recipes_v1';

// Ligne DB -> recette interne ({ id, ingredients:[3], potion }).
function rowToRecipe(r) {
  return { id: r.key, ingredients: Array.isArray(r.ingredients) ? r.ingredients : [], potion: r.potion };
}

// Recette interne -> payload DB. Utilisé par l'éditeur.
export function recipeToPayload(rec) {
  return {
    key: rec.id,
    ingredients: rec.ingredients || [],
    potion: rec.potion,
    enabled: rec.enabled !== false,
    ord: rec.ord ?? null,
    updated_at: new Date().toISOString(),
  };
}

function rowsToCustom(rows) {
  return (rows || [])
    .filter((r) => r.enabled !== false && r.key && r.potion)
    .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0))
    .map(rowToRecipe);
}

function writeCache(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch { /* quota */ }
}

// Boot synchrone : applique le cache des recettes custom (aucun réseau).
export function applyCachedRecipes() {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_KEY));
    if (Array.isArray(cached)) setCustomRecipes(cached);
  } catch { /* cache illisible */ }
}

// Récupère les recettes custom activées, les fusionne et met à jour le cache.
export async function refreshRecipes() {
  const { data, error } = await supabase.from('quete_recipes').select('*').order('ord', { ascending: true });
  if (error) throw error;
  const list = rowsToCustom(data);
  setCustomRecipes(list);
  writeCache(list);
  return list.length;
}

// --- CRUD pour l'éditeur (lignes brutes, même désactivées) ---

export async function fetchRecipeRows() {
  const { data, error } = await supabase.from('quete_recipes').select('*').order('ord', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveRecipeRow(rec, { isNew = false } = {}) {
  const payload = recipeToPayload(rec);
  const q = isNew
    ? supabase.from('quete_recipes').insert(payload)
    : supabase.from('quete_recipes').update(payload).eq('key', payload.key);
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}

export async function deleteRecipeRow(key) {
  const { error } = await supabase.from('quete_recipes').delete().eq('key', key);
  if (error) throw error;
}
