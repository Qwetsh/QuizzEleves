// Chargement des MODULES (thèmes) et CATÉGORIES (matières) depuis Supabase
// (tables public.quete_modules / public.quete_categories). Même stratégie
// offline-safe que les objets/événements : cache localStorage appliqué au boot
// (synchrone), puis rafraîchissement réseau. Fallback ultime : le catalogue en
// dur de src/data/subjects.js (BASE_SUBJECTS).
//
// Le moteur consomme toujours SUBJECTS / SUBJECT_KEYS / … (bindings dynamiques) ;
// ici on ne fait que REMPLIR ces bindings via setSubjectsData.
import { supabase } from './supabaseClient.js';
import { setSubjectsData } from '../data/subjects.js';

const LS_KEY = 'quete_categories_v1';

// Ligne DB -> catégorie interne (camelCase, champs non-null uniquement pour
// reproduire exactement la forme du catalogue en dur).
export function rowToCategory(r) {
  const c = { module: r.module || 'college', name: r.name };
  if (r.name_en != null) c.name_en = r.name_en;
  if (r.short != null) c.short = r.short;
  if (r.icon != null) c.icon = r.icon;
  if (r.color != null) c.color = r.color;
  if (r.color_soft != null) c.colorSoft = r.color_soft;
  if (r.color_deep != null) c.colorDeep = r.color_deep;
  if (r.biome != null) c.biome = r.biome;
  if (r.biome_en != null) c.biome_en = r.biome_en;
  return c;
}

function rowToModule(r) {
  const m = { key: r.key, name: r.name };
  if (r.name_en != null) m.name_en = r.name_en;
  if (r.icon != null) m.icon = r.icon;
  if (r.kind != null) m.kind = r.kind;
  if (r.description != null) m.description = r.description;
  // Identité visuelle d'un thème (pour les voies-thèmes en mode multi).
  if (r.color != null) m.color = r.color;
  if (r.color_soft != null) m.colorSoft = r.color_soft;
  if (r.color_deep != null) m.colorDeep = r.color_deep;
  if (r.biome != null) m.biome = r.biome;
  if (r.biome_en != null) m.biome_en = r.biome_en;
  return m;
}

// Construit le « bundle » de catalogue (subjects + listes dérivées + modules)
// depuis les lignes DB. Exporté pour les tests (vérif d'égalité avec BASE).
export function buildCatalogFromRows(catRows = [], modRows = []) {
  const rows = [...catRows].filter((r) => r.enabled !== false).sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
  const subjects = {};
  for (const r of rows) subjects[r.key] = rowToCategory(r);

  const keys = rows.filter((r) => r.role === 'subject').map((r) => r.key);
  const defaults = rows.filter((r) => r.role === 'subject' && r.default_on).map((r) => r.key);
  const lv2 = rows.filter((r) => r.lv2_member).map((r) => r.key);
  const forced = rows.filter((r) => r.role === 'forced').map((r) => r.key);

  const mrows = [...modRows].filter((r) => r.enabled !== false).sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
  const modules = {};
  for (const r of mrows) modules[r.key] = rowToModule(r);
  const moduleKeys = mrows.map((r) => r.key);

  return { subjects, keys, defaults, lv2, forced, modules, moduleKeys };
}

function writeCache(bundle) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(bundle)); } catch { /* quota */ }
}

// Boot synchrone : applique le cache s'il est bien formé (sinon on garde le
// fallback en dur). Aucun appel réseau.
export function applyCachedCategories() {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_KEY));
    if (cached && cached.subjects && Object.keys(cached.subjects).length && Array.isArray(cached.keys)) {
      setSubjectsData(cached);
    }
  } catch { /* cache illisible */ }
}

// Récupère modules + catégories, remplit les bindings et met à jour le cache.
export async function refreshCategories() {
  const [{ data: cats, error: e1 }, { data: mods, error: e2 }] = await Promise.all([
    supabase.from('quete_categories').select('*').order('ord', { ascending: true }),
    supabase.from('quete_modules').select('*').order('ord', { ascending: true }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (!cats || !cats.length) return 0;       // base vide : on garde le fallback
  const bundle = buildCatalogFromRows(cats, mods || []);
  setSubjectsData(bundle);
  writeCache(bundle);
  return Object.keys(bundle.subjects).length;
}
