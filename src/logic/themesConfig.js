// Chargement de l'arbre de thèmes (table `quete_themes`) depuis Supabase :
// cache localStorage synchrone au boot + refresh réseau async. Calqué sur
// `categoriesConfig.js`. Applique via `setThemesData` (src/data/themes.js).
import { supabase } from './supabaseClient.js';
import { setThemesData } from '../data/themes.js';

const LS_KEY = 'quete_themes_v1';

export function rowToTheme(r) {
  const t = { key: r.key, path: r.path, parentKey: r.parent_key ?? null, kind: r.kind || 'theme', name: r.name };
  if (r.subject_key != null) t.subjectKey = r.subject_key;
  if (r.name_en != null) t.nameEn = r.name_en;
  if (r.short != null) t.short = r.short;
  if (r.icon != null) t.icon = r.icon;
  if (r.emblem != null) t.emblem = r.emblem;
  if (r.color != null) t.color = r.color;
  if (r.color_soft != null) t.colorSoft = r.color_soft;
  if (r.color_deep != null) t.colorDeep = r.color_deep;
  if (r.biome != null) t.biome = r.biome;
  if (r.biome_en != null) t.biomeEn = r.biome_en;
  if (r.default_on != null) t.defaultOn = r.default_on;
  if (r.ord != null) t.ord = r.ord;
  return t;
}

export function buildThemesFromRows(rows = []) {
  const ok = [...rows].filter((r) => r.enabled !== false).sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
  const themes = {};
  for (const r of ok) themes[r.key] = rowToTheme(r);
  const roots = ok.filter((r) => !r.parent_key).map((r) => r.key);
  return { themes, roots };
}

function writeCache(bundle) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(bundle)); } catch { /* quota */ }
}

export function applyCachedThemes() {
  try {
    const cached = JSON.parse(localStorage.getItem(LS_KEY));
    if (cached && cached.themes && Object.keys(cached.themes).length && Array.isArray(cached.roots)) {
      setThemesData(cached);
    }
  } catch { /* cache illisible */ }
}

export async function refreshThemes() {
  const { data, error } = await supabase.from('quete_themes').select('*').order('path', { ascending: true });
  if (error) throw error;
  if (!data || !data.length) return 0; // base vide : on garde le fallback (arbre vide)
  const bundle = buildThemesFromRows(data);
  setThemesData(bundle);
  writeCache(bundle);
  return Object.keys(bundle.themes).length;
}

// --- CRUD pour l'éditeur de thèmes (lignes brutes DB, cf. ThemesEditor) ---

// Toutes les lignes brutes (colonnes DB, snake_case) triées par path.
export async function fetchThemeRows() {
  const { data, error } = await supabase.from('quete_themes').select('*').order('path', { ascending: true });
  if (error) throw error;
  return data || [];
}

// Insère ou met à jour (upsert par `key`, identité stable). `row` en snake_case.
export async function saveThemeRow(row) {
  const payload = { ...row, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('quete_themes')
    .upsert(payload, { onConflict: 'key' }).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteThemeRow(key) {
  const { error } = await supabase.from('quete_themes').delete().eq('key', key);
  if (error) throw error;
}

// Segment ltree valide (labels [A-Za-z0-9_]). Accents retirés, tout le reste → _.
export function slugifyKey(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
}

// Recalcule les `path` d'un sous-arbre après changement de parent. PUR : renvoie
// la liste des lignes { ...row, parent_key, path } à ré-enregistrer (le nœud +
// tous ses descendants). `rows` = lignes brutes DB (avec `path`/`parent_key`).
export function repathSubtree(rows, key, newParentKey) {
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  const node = byKey[key];
  if (!node) return [];
  const newParent = newParentKey ? byKey[newParentKey] : null;
  const oldPath = node.path;
  const newPath = newParent ? `${newParent.path}.${key}` : key;
  if (newPath === oldPath && (node.parent_key ?? null) === (newParentKey ?? null)) return [];
  const updates = [];
  for (const r of rows) {
    if (r.key === key) updates.push({ ...r, parent_key: newParentKey ?? null, path: newPath });
    else if (r.path.startsWith(`${oldPath}.`)) updates.push({ ...r, path: newPath + r.path.slice(oldPath.length) });
  }
  return updates;
}
