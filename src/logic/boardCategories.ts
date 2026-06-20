// Granularité automatique des voies du plateau (DESIGN_MODULES.md §0) :
//  - sous-thèmes couvrant ≥ 2 THÈMES → 1 voie = 1 thème (qui pioche parmi ses
//    sous-thèmes via categoryPools) ;
//  - 1 seul thème → 1 voie = 1 sous-thème (mode mono = comportement historique).
// Pur, typé, testable sans le store.

export interface BoardCategories {
  /** Catégories posées sur les voies (thèmes en multi, sous-thèmes en mono). */
  boardCats: string[];
  /** En multi : thème → ses sous-thèmes (clés de pool de questions). Vide en mono. */
  categoryPools: Record<string, string[]>;
}

// `subjects` = sous-thèmes effectifs (avec contenu) ; `themeOf(key)` = clé du
// thème/module d'un sous-thème (défaut 'college').
export function boardCategoriesFor(subjects: string[], themeOf: (k: string) => string): BoardCategories {
  const themes = [...new Set(subjects.map(themeOf))];
  if (themes.length >= 2) {
    const categoryPools: Record<string, string[]> = {};
    for (const th of themes) categoryPools[th] = subjects.filter((k) => themeOf(k) === th);
    return { boardCats: themes, categoryPools };
  }
  return { boardCats: subjects, categoryPools: {} };
}
