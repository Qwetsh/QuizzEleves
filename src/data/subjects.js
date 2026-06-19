// Couleurs alignees sur la palette des assets du plateau (disques de pierre,
// voir scripts/sample-disc-colors.mjs) \u2014 refonte map 2026-06
export const SUBJECTS = {
  francais:   { name: 'Fran\u00e7ais', name_en: 'French', short: 'FR',  icon: '\u{1F4DC}', color: '#9b3165', colorSoft: '#e9d2dd', colorDeep: '#521a36', biome: 'Le Scriptorium', biome_en: 'The Scriptorium' },
  maths:      { name: 'Maths',         short: 'MA',  icon: '\u{1F4D0}', color: '#c65429', colorSoft: '#f2d9d0', colorDeep: '#692d16', biome: 'Les Cimes Cristal', biome_en: 'The Crystal Peaks' },
  histoire:   { name: 'Histoire',      name_en: 'History', short: 'HI',  icon: '\u{1F3DB}\ufe0f', color: '#c79120', colorSoft: '#f3e7ce', colorDeep: '#694d11', biome: 'Les Ruines Dor\u00e9es', biome_en: 'The Golden Ruins' },
  geographie: { name: 'G\u00e9ographie', name_en: 'Geography', short: 'GE', icon: '\u{1F9ED}', color: '#579b9a', colorSoft: '#dae9e9', colorDeep: '#2e5252', biome: "L'Archipel \u00c9meraude", biome_en: 'The Emerald Archipelago' },
  svt:        { name: 'SVT',           short: 'SV',  icon: '\u{1F33F}', color: '#779313', colorSoft: '#e1e7cb', colorDeep: '#3f4e0a', biome: 'La For\u00eat Vivante', biome_en: 'The Living Forest' },
  anglais:    { name: 'Anglais',       short: 'EN',  icon: '\u{1F339}', color: '#3160a5', colorSoft: '#d2dceb', colorDeep: '#1a3357', biome: 'Les Cours Tudor', biome_en: 'The Tudor Courts' },
  allemand:   { name: 'Allemand',      short: 'DE',  icon: '\u{1F985}', color: '#3a3f7a', colorSoft: '#d4d6e8', colorDeep: '#23264d', biome: 'Le Ch\u00e2teau de Brume', biome_en: 'The Mist Castle' },
  espagnol:   { name: 'Espagnol',      short: 'ES',  icon: '\u2600\ufe0f', color: '#cb3a3a', colorSoft: '#f1d2d2', colorDeep: '#6e1717', biome: 'La Cour des Alc\u00e1zars', biome_en: 'The Alc\u00e1zar Court' },
  multi:      { name: 'Multi-mati\u00e8re', short: '?', icon: '\u{1F3B2}', color: '#e0a458', colorSoft: '#f0e0b2', colorDeep: '#8a5f1a', biome: 'Carrefour', biome_en: 'Crossroads' },
  // Fili\u00e8re \u00ab LV2 au choix \u00bb : fusion Allemand+Espagnol. Pos\u00e9e sur le plateau
  // quand le mode lv2 est actif ; chaque \u00e9quipe r\u00e9pond dans SA langue (team.lv2).
  lv2:        { name: 'LV2', short: 'LV2', icon: '\ud83d\udde3\ufe0f', color: '#5b6cc4', colorSoft: '#dadef2', colorDeep: '#2f3a78', biome: 'Le Carrefour des Langues', biome_en: 'The Crossroads of Languages' },
  // Mati\u00e8res \u00ab forc\u00e9-only \u00bb : jamais sur le plateau, seulement d\u00e9clench\u00e9es par un
  // effet \u00ab question forc\u00e9e \u00bb. Pas de filtrage par niveau (transverses).
  cultureG:   { name: 'Culture g\u00e9n\u00e9rale', name_en: 'General Knowledge', short: 'CG', icon: '\u{1F9E0}', color: '#7a5ea8', colorSoft: '#e2d9f0', colorDeep: '#41306b', biome: 'La Grande Biblioth\u00e8que', biome_en: 'The Great Library' },
  hardcore:   { name: 'Hardcore',      name_en: 'Hardcore', short: 'HC',  icon: '\u{1F480}', color: '#8a1f2e', colorSoft: '#ecc9cd', colorDeep: '#4d0f17', biome: "L'Antre du D\u00e9fi", biome_en: 'The Den of Challenge' },
};

// Mati\u00e8res DISPONIBLES pour le plateau (cases). cultureG/hardcore exclues
// (forc\u00e9-only). Allemand/Espagnol sont disponibles mais OFF par d\u00e9faut tant
// qu'elles n'ont pas de contenu (cf. DEFAULT_BOARD_SUBJECTS).
export const SUBJECT_KEYS = ['francais', 'maths', 'histoire', 'geographie', 'svt', 'anglais', 'allemand', 'espagnol'];
// S\u00e9lection de mati\u00e8res ACTIV\u00c9ES par d\u00e9faut au Setup (les 6 historiques). Une
// mati\u00e8re sans question est de toute fa\u00e7on \u00e9cart\u00e9e du plateau au d\u00e9marrage.
export const DEFAULT_BOARD_SUBJECTS = ['francais', 'maths', 'histoire', 'geographie', 'svt', 'anglais'];

// Langues vivantes 2 fusionnables en une fili\u00e8re \u00ab LV2 au choix \u00bb.
export const LV2_SUBJECTS = ['allemand', 'espagnol'];
// Mati\u00e8res suppl\u00e9mentaires \u00ab forc\u00e9-only \u00bb (jamais tir\u00e9es par une case, uniquement
// via un effet). Charg\u00e9es dans les pools de questions, hors filtrage par niveau.
export const FORCED_SUBJECT_KEYS = ['cultureG', 'hardcore'];
