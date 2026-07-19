// Construction du « périmètre » d'une partie à partir d'une sélection de thèmes
// (issue de l'écran « lecteur de cassettes »). Fonctions PURES, testables.
//
// Sortie compatible avec le moteur existant SANS le réécrire :
//   - boardSubjects : clés de voies posées sur le plateau (generateBoard.subjects)
//   - categoryPools : { voie: [sous-thèmes] } consommé par resolveSubjectFor
//   - displayInject : { voie: pseudo-catégorie } pour le disque coloré du plateau
//
// Une FEUILLE → voie identité (categoryPools[sk] = [sk]). Un NŒUD LARGE
// (INTÉGRALE/domaine) → voie dont le pool = ses feuilles descendantes à contenu.
import { THEMES, THEME_ROOTS, childrenOf, isLeaf, isPureLeaf, descendantLeaves } from '../data/themes.js';

// Cycles scolaires → niveaux (réutilise le champ `level` existant du moteur).
export const CYCLES = {
  cycle3: ['6e'],
  cycle4: ['5e', '4e', '3e'],
  lycee: ['2nde', '1ere', 'terminale'], // pas encore de contenu en base
};
export const levelForCycle = (cycle) => CYCLES[cycle] || 'cycle4';

/**
 * @param {Array<{themeKey:string, excludedSubjectKeys?:string[]}>} selection
 * @param {{ level?:any, hasContent?:(subjectKey:string)=>boolean }} opts
 */
export function buildPerimeter(selection = [], { level = 'cycle4', hasContent = () => true } = {}) {
  const boardSubjects = [];
  const categoryPools = {};
  const displayInject = {};
  for (const sel of selection) {
    const themeKey = sel && sel.themeKey;
    const node = THEMES[themeKey];
    if (!node) continue;
    const excluded = sel.excludedSubjectKeys || [];

    if (isPureLeaf(themeKey)) {
      const sk = node.subjectKey;
      if (!hasContent(sk) || categoryPools[sk]) continue;
      boardSubjects.push(sk);
      categoryPools[sk] = [sk]; // singleton → resolveSubjectFor renvoie la feuille
    } else {
      if (categoryPools[themeKey]) continue;
      const leaves = descendantLeaves(themeKey).filter((sk) => !excluded.includes(sk) && hasContent(sk));
      if (!leaves.length) continue; // domaine/nœud sans contenu → pas de voie vide
      boardSubjects.push(themeKey);
      categoryPools[themeKey] = leaves;
      displayInject[themeKey] = {
        module: themeKey, name: node.name, name_en: node.nameEn, icon: node.icon,
        color: node.color, colorSoft: node.colorSoft, colorDeep: node.colorDeep,
        biome: node.biome, biome_en: node.biomeEn,
      };
    }
  }
  return { boardSubjects, categoryPools, displayInject, level };
}

// --- Modèle pour l'écran cassette : THEMES → { DOMAINS, GROUPS } ---

// Feuilles (NŒUDS) sous `key`, dans l'ordre de l'arbre. Nœud mixte : inclut le
// nœud lui-même PUIS ses enfants (cohérent avec descendantLeaves). Les cassettes
// DURES descendantes (`hard`) sont EXCLUES du bundle d'une intégrale (elles ne
// figurent pas dans son `sub`), pour ne pas les inclure par défaut ; elles restent
// émises comme leur PROPRE carte-cassette (cf. themesToCassetteModel/emit).
function leafNodesUnder(key) {
  const out = [];
  const seen = new Set();
  const walk = (k, isRoot) => {
    const node = THEMES[k];
    if (!node) return;
    if (!isRoot && node.hard) return; // cassette dure : pas dans le bundle de l'ancêtre
    if (node.subjectKey && !seen.has(node.subjectKey)) { seen.add(node.subjectKey); out.push(node); }
    for (const c of childrenOf(k)) walk(c.key, false);
  };
  walk(key, true);
  return out;
}

/**
 * Transforme l'arbre `THEMES` en modèle attendu par SelectionCassettes :
 * chaque domaine = un rayon ; chaque carte porte un `id` = clé de thème
 * (consommée par buildPerimeter). Les INTÉGRALEs portent `sub` = leurs feuilles
 * excluables ({ label, key }).
 */
export function themesToCassetteModel() {
  const DOMAINS = [];
  const GROUPS = [];
  for (const rootKey of THEME_ROOTS) {
    const root = THEMES[rootKey];
    if (!root) continue;
    DOMAINS.push({
      id: root.key,
      name: (root.name || root.key).toUpperCase(),
      color: root.color || '#d9cda5',
      ink: root.colorDeep || '#241a10',
      emblem: root.emblem || '●',
      biome: root.biome || root.name,
      sceneBg: root.colorSoft || '#e3d0aa',
    });
    const items = [];
    const scolaire = root.kind === 'scolaire';
    const rootLeaves = leafNodesUnder(rootKey);
    // INTÉGRALE du domaine (voie large, depth 0) — seulement s'il a du contenu.
    if (rootLeaves.length) {
      items.push({
        id: root.key,
        label: root.name,
        type: scolaire ? 'cartouche' : 'integrale',
        sub: rootLeaves.map((n) => ({ label: n.name, key: n.subjectKey })),
        depth: 0, parentId: null,
      });
    }
    // DFS des sous-thèmes : chaque nœud = une carte. `depth` = niveau sous le
    // domaine (1 = enfant direct, 2+ = mini-cassette imbriquée) ; `parentId` = la
    // carte parente (null aux niveaux 0/1) → pilote le repli des sous-sous-thèmes.
    // Un nœud à enfants (conteneur OU mixte) = INTÉGRALE (voie large insérable
    // telle quelle) et on descend ; une feuille pure = carte thème.
    const emit = (key, depth, parentId) => {
      const node = THEMES[key];
      if (!node) return;
      const kids = childrenOf(key);
      if (kids.length) {
        const leaves = leafNodesUnder(key);
        if (!leaves.length) return; // conteneur sans contenu → ignoré
        items.push({
          id: key, label: node.name, type: scolaire ? 'cartouche' : 'integrale',
          sub: leaves.map((n) => ({ label: n.name, key: n.subjectKey })), depth, parentId,
        });
        for (const c of kids) emit(c.key, depth + 1, key);
      } else if (isLeaf(key)) {
        items.push({ id: key, label: node.name, type: scolaire ? 'cartouche' : 'theme', depth, parentId });
      }
    };
    // Les enfants directs (depth 1) ne sont jamais repliés → parentId null.
    for (const child of childrenOf(rootKey)) emit(child.key, 1, null);
    GROUPS.push({ domain: root.key, items });
  }
  return { DOMAINS, GROUPS };
}

// --- Sélection ALÉATOIRE de thèmes (mode « Surprise » du jeu en ligne) ---

/**
 * Feuilles-thèmes à contenu, regroupées par domaine (pour la checklist
 * d'exclusion côté hôte + la résolution des noms côté client). `hasContent`
 * (fourni via getQuestions au niveau choisi) filtre les thèmes sans question.
 * @returns {Array<{domain:string, name:string, color:string, items:Array<{key:string, subjectKey:string, name:string}>}>}
 */
export function eligibleThemesByDomain({ hasContent = () => true } = {}) {
  const out = [];
  for (const rootKey of THEME_ROOTS) {
    const root = THEMES[rootKey];
    if (!root) continue;
    const items = leafNodesUnder(rootKey)
      .filter((n) => n.subjectKey && hasContent(n.subjectKey))
      .map((n) => ({ key: n.key, subjectKey: n.subjectKey, name: n.name }));
    if (!items.length) continue;
    out.push({ domain: root.key, name: root.name, color: root.color || '#d9cda5', items });
  }
  return out;
}

/**
 * Tire `count` thèmes-feuilles DISTINCTS au hasard parmi ceux à contenu, hors
 * `excluded` (clés de thème bannies par l'hôte). Retourne une `selection` prête
 * pour buildPerimeter. Repli : si le pool est plus petit que `count`, prend tout.
 * @param {{ count?:number, excluded?:string[], hasContent?:(k:string)=>boolean }} opts
 * @returns {Array<{themeKey:string}>}
 */
export function randomThemeSelection({ count = 4, excluded = [], hasContent = () => true } = {}) {
  const ex = new Set(excluded);
  const pool = eligibleThemesByDomain({ hasContent }).flatMap((d) => d.items).filter((t) => !ex.has(t.key));
  // Fisher–Yates (Math.random : runtime navigateur/tests, hors scripts workflow).
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const n = Math.max(1, Math.min(count, pool.length));
  return pool.slice(0, n).map((t) => ({ themeKey: t.key }));
}
