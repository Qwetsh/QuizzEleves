// Catalogue des CATÉGORIES jouables (= « matières » historiques). Source de
// vérité du contenu posé sur les voies/cases du plateau et déclencheur de défi.
//
// ⚙️ Refonte « modules de thèmes » (DESIGN_MODULES.md) — Phase 1, incrément 1 :
// ce catalogue devient REMPLAÇABLE à chaud (cf. setSubjectsData), sur le modèle
// de ITEMS/EVENTS (mutation en place → tout importeur voit les nouvelles données).
// Tant que personne n'appelle le setter, le comportement est STRICTEMENT inchangé.
// Chaque catégorie porte désormais `module` (ici 'college' pour tout l'existant) ;
// l'école n'est plus un cas spécial, juste le premier module.

// Registre des MODULES (= thèmes). Pour l'instant : Collège uniquement (school).
export const MODULES = {
  college: { key: 'college', name: 'Collège', name_en: 'Middle School', icon: '🎒', kind: 'school', color: '#b8862c', colorSoft: '#f3e7ce', colorDeep: '#6e4e10', biome: 'L’École des Savoirs', biome_en: 'The School of Knowledge' },
};
export let MODULE_KEYS = ['college'];

// Couleurs alignees sur la palette des assets du plateau (disques de pierre,
// voir scripts/sample-disc-colors.mjs) — refonte map 2026-06.
// `module:'college'` : toutes les catégories historiques appartiennent au module Collège.
export const SUBJECTS = {
  francais:   { module: 'college', name: 'Français', name_en: 'French', short: 'FR',  icon: '\u{1F4DC}', color: '#9b3165', colorSoft: '#e9d2dd', colorDeep: '#521a36', biome: 'Le Scriptorium', biome_en: 'The Scriptorium' },
  maths:      { module: 'college', name: 'Maths',         short: 'MA',  icon: '\u{1F4D0}', color: '#c65429', colorSoft: '#f2d9d0', colorDeep: '#692d16', biome: 'Les Cimes Cristal', biome_en: 'The Crystal Peaks' },
  histoire:   { module: 'college', name: 'Histoire',      name_en: 'History', short: 'HI',  icon: '\u{1F3DB}️', color: '#c79120', colorSoft: '#f3e7ce', colorDeep: '#694d11', biome: 'Les Ruines Dorées', biome_en: 'The Golden Ruins' },
  geographie: { module: 'college', name: 'Géographie', name_en: 'Geography', short: 'GE', icon: '\u{1F9ED}', color: '#579b9a', colorSoft: '#dae9e9', colorDeep: '#2e5252', biome: "L'Archipel Émeraude", biome_en: 'The Emerald Archipelago' },
  svt:        { module: 'college', name: 'SVT',           short: 'SV',  icon: '\u{1F33F}', color: '#779313', colorSoft: '#e1e7cb', colorDeep: '#3f4e0a', biome: 'La Forêt Vivante', biome_en: 'The Living Forest' },
  anglais:    { module: 'college', name: 'Anglais',       short: 'EN',  icon: '\u{1F339}', color: '#3160a5', colorSoft: '#d2dceb', colorDeep: '#1a3357', biome: 'Les Cours Tudor', biome_en: 'The Tudor Courts' },
  allemand:   { module: 'college', name: 'Allemand',      short: 'DE',  icon: '\u{1F985}', color: '#3a3f7a', colorSoft: '#d4d6e8', colorDeep: '#23264d', biome: 'Le Château de Brume', biome_en: 'The Mist Castle' },
  espagnol:   { module: 'college', name: 'Espagnol',      short: 'ES',  icon: '☀️', color: '#cb3a3a', colorSoft: '#f1d2d2', colorDeep: '#6e1717', biome: 'La Cour des Alcázars', biome_en: 'The Alcázar Court' },
  multi:      { module: 'college', name: 'Multi-matière', short: '?', icon: '\u{1F3B2}', color: '#e0a458', colorSoft: '#f0e0b2', colorDeep: '#8a5f1a', biome: 'Carrefour', biome_en: 'Crossroads' },
  // Filière « LV2 au choix » : fusion Allemand+Espagnol. Posée sur le plateau
  // quand le mode lv2 est actif ; chaque équipe répond dans SA langue (team.lv2).
  lv2:        { module: 'college', name: 'LV2', short: 'LV2', icon: '🗣️', color: '#5b6cc4', colorSoft: '#dadef2', colorDeep: '#2f3a78', biome: 'Le Carrefour des Langues', biome_en: 'The Crossroads of Languages' },
  // Matières « forcé-only » : jamais sur le plateau, seulement déclenchées par un
  // effet « question forcée ». Pas de filtrage par niveau (transverses).
  cultureG:   { module: 'college', name: 'Culture générale', name_en: 'General Knowledge', short: 'CG', icon: '\u{1F9E0}', color: '#7a5ea8', colorSoft: '#e2d9f0', colorDeep: '#41306b', biome: 'La Grande Bibliothèque', biome_en: 'The Great Library' },
  hardcore:   { module: 'college', name: 'Hardcore',      name_en: 'Hardcore', short: 'HC',  icon: '\u{1F480}', color: '#8a1f2e', colorSoft: '#ecc9cd', colorDeep: '#4d0f17', biome: "L'Antre du Défi", biome_en: 'The Den of Challenge' },
};

// Matières DISPONIBLES pour le plateau (cases). cultureG/hardcore exclues
// (forcé-only). Allemand/Espagnol sont disponibles mais OFF par défaut tant
// qu'elles n'ont pas de contenu (cf. DEFAULT_BOARD_SUBJECTS).
export let SUBJECT_KEYS = ['francais', 'maths', 'histoire', 'geographie', 'svt', 'anglais', 'allemand', 'espagnol'];
// Sélection de matières ACTIVÉES par défaut au Setup (les 6 historiques). Une
// matière sans question est de toute façon écartée du plateau au démarrage.
export let DEFAULT_BOARD_SUBJECTS = ['francais', 'maths', 'histoire', 'geographie', 'svt', 'anglais'];

// Langues vivantes 2 fusionnables en une filière « LV2 au choix ».
export let LV2_SUBJECTS = ['allemand', 'espagnol'];
// Matières supplémentaires « forcé-only » (jamais tirées par une case, uniquement
// via un effet). Chargées dans les pools de questions, hors filtrage par niveau.
export let FORCED_SUBJECT_KEYS = ['cultureG', 'hardcore'];

// Snapshot d'origine (fallback hors-ligne ultime, cf. BASE_ITEMS).
export const BASE_SUBJECTS = JSON.parse(JSON.stringify(SUBJECTS));
const BASE_KEYS = {
  SUBJECT_KEYS: [...SUBJECT_KEYS],
  DEFAULT_BOARD_SUBJECTS: [...DEFAULT_BOARD_SUBJECTS],
  LV2_SUBJECTS: [...LV2_SUBJECTS],
  FORCED_SUBJECT_KEYS: [...FORCED_SUBJECT_KEYS],
};

// Remplace le catalogue de catégories (mutation en place de SUBJECTS pour que
// tout importeur voie les nouvelles données) + met à jour les listes dérivées.
// Sera appelé par la future couche de chargement (categoriesConfig, incrément 2).
// `data` : { subjects, keys?, defaults?, lv2?, forced?, modules?, moduleKeys? }.
export function setSubjectsData(data = {}) {
  const { subjects, keys, defaults, lv2, forced, modules, moduleKeys } = data;
  if (subjects && Object.keys(subjects).length) {
    for (const k of Object.keys(SUBJECTS)) delete SUBJECTS[k];
    for (const [k, c] of Object.entries(subjects)) SUBJECTS[k] = { ...c };
  }
  if (Array.isArray(keys)) SUBJECT_KEYS = keys;
  if (Array.isArray(defaults)) DEFAULT_BOARD_SUBJECTS = defaults;
  if (Array.isArray(lv2)) LV2_SUBJECTS = lv2;
  if (Array.isArray(forced)) FORCED_SUBJECT_KEYS = forced;
  if (modules && Object.keys(modules).length) {
    for (const k of Object.keys(MODULES)) delete MODULES[k];
    for (const [k, m] of Object.entries(modules)) MODULES[k] = { ...m };
  }
  if (Array.isArray(moduleKeys)) MODULE_KEYS = moduleKeys;
}

// Restaure le catalogue d'origine (tests / réinitialisation).
export function resetSubjectsData() {
  setSubjectsData({ subjects: BASE_SUBJECTS, ...BASE_KEYS });
  for (const k of Object.keys(MODULES)) if (k !== 'college') delete MODULES[k];
  MODULE_KEYS = ['college'];
}
