// Arbre de thèmes (table `quete_themes`, ltree). Chargé depuis Supabase via
// `themesConfig.js` (cache offline + refresh). Fallback = vide : l'écran de
// sélection « cassettes » est optionnel/beta et se masque si l'arbre est absent.
//
// Muté EN PLACE (comme SUBJECTS/MODULES dans subjects.js) pour que tous les
// importeurs voient la mise à jour après un refresh async.
//
// Forme d'un nœud : { key, path, parentKey, subjectKey?, kind, name, nameEn?,
//   short?, icon?, emblem?, color?, colorSoft?, colorDeep?, biome?, biomeEn?,
//   defaultOn?, ord? }. Une FEUILLE porte `subjectKey` (= quete_questions.subject) ;
// un nœud LARGE (INTÉGRALE/domaine) ne l'a pas.

export const THEMES = {};        // key -> node
export let THEME_ROOTS = [];     // keys des domaines racines (parentKey null), triés ord

export function setThemesData({ themes, roots } = {}) {
  if (themes && Object.keys(themes).length) {
    for (const k of Object.keys(THEMES)) delete THEMES[k];
    for (const [k, t] of Object.entries(themes)) THEMES[k] = { ...t };
  }
  if (Array.isArray(roots)) THEME_ROOTS = roots;
}

export function resetThemesData() {
  for (const k of Object.keys(THEMES)) delete THEMES[k];
  THEME_ROOTS = [];
}

// --- Helpers d'arbre (lisent THEMES) ---
export const isLeaf = (key) => !!THEMES[key]?.subjectKey;
export const pathOf = (key) => THEMES[key]?.path || null;

export function childrenOf(key) {
  return Object.values(THEMES)
    .filter((t) => t.parentKey === key)
    .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
}

// subject_keys de toutes les feuilles descendantes de `key` (DFS), dédupliqués,
// dans l'ordre de l'arbre. Si `key` est lui-même une feuille, renvoie [subjectKey].
export function descendantLeaves(key) {
  const out = [];
  const seen = new Set();
  const walk = (k) => {
    const node = THEMES[k];
    if (!node) return;
    if (node.subjectKey) {
      if (!seen.has(node.subjectKey)) { seen.add(node.subjectKey); out.push(node.subjectKey); }
      return;
    }
    for (const child of childrenOf(k)) walk(child.key);
  };
  walk(key);
  return out;
}
