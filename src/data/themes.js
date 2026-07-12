// Arbre de thèmes (table `quete_themes`, ltree). Chargé depuis Supabase via
// `themesConfig.js` (cache offline + refresh). Fallback = vide : l'écran de
// sélection « cassettes » est optionnel/beta et se masque si l'arbre est absent.
//
// Muté EN PLACE (comme SUBJECTS/MODULES dans subjects.js) pour que tous les
// importeurs voient la mise à jour après un refresh async.
//
// Forme d'un nœud : { key, path, parentKey, subjectKey?, kind, name, nameEn?,
//   short?, icon?, emblem?, color?, colorSoft?, colorDeep?, biome?, biomeEn?,
//   defaultOn?, hard?, ord? }. Une FEUILLE porte `subjectKey` (= quete_questions.subject) ;
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
// `isLeaf` = porte un subjectKey (donc du contenu). Attention : un nœud MIXTE
// (subjectKey ET enfants) est à la fois « leaf » et parent — préférer `isPureLeaf`
// quand la sémantique « voie singleton vs voie large » compte (cf. perimeter).
export const isLeaf = (key) => !!THEMES[key]?.subjectKey;
export const pathOf = (key) => THEMES[key]?.path || null;

export function childrenOf(key) {
  return Object.values(THEMES)
    .filter((t) => t.parentKey === key)
    .sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0));
}

export const hasChildren = (key) => childrenOf(key).length > 0;
// Feuille PURE = du contenu propre ET aucun enfant → voie singleton.
export const isPureLeaf = (key) => isLeaf(key) && !hasChildren(key);

// subject_keys de toutes les feuilles descendantes de `key` (DFS), dédupliqués,
// dans l'ordre de l'arbre. NŒUD MIXTE : on inclut son propre subjectKey PUIS on
// descend dans ses enfants (« insérer Jeux vidéo » = ses Q générales + Skyrim + …).
// Une feuille pure renvoie [subjectKey].
//
// Cassettes DURES (`hard`, ex. « Qui est ce Pokémon ? », hymnes, silhouettes) :
// exclues par défaut. Un nœud dur DESCENDANT n'est jamais aspiré par la sélection
// d'un ancêtre (on ne veut pas imposer le mode difficile en prenant tout le thème).
// Il reste sélectionnable DIRECTEMENT (le nœud racine de l'appel est toujours
// inclus, même dur → cf. buildPerimeter branche « feuille pure »). `includeHard`
// force l'inclusion (utilisé par l'éditeur pour tout regrouper sous l'arbre).
export function descendantLeaves(key, { includeHard = false } = {}) {
  const out = [];
  const seen = new Set();
  const walk = (k, isRoot) => {
    const node = THEMES[k];
    if (!node) return;
    if (!isRoot && node.hard && !includeHard) return; // cassette dure : pas aspirée
    if (node.subjectKey && !seen.has(node.subjectKey)) { seen.add(node.subjectKey); out.push(node.subjectKey); }
    for (const child of childrenOf(k)) walk(child.key, false);
  };
  walk(key, true);
  return out;
}
