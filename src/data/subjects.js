// Couleurs alignees sur la palette des assets du plateau (disques de pierre,
// voir scripts/sample-disc-colors.mjs) \u2014 refonte map 2026-06
export const SUBJECTS = {
  francais:   { name: 'Fran\u00e7ais', short: 'FR',  icon: '\u{1F4DC}', color: '#9b3165', colorSoft: '#e9d2dd', colorDeep: '#521a36', biome: 'Le Scriptorium' },
  maths:      { name: 'Maths',         short: 'MA',  icon: '\u{1F4D0}', color: '#c65429', colorSoft: '#f2d9d0', colorDeep: '#692d16', biome: 'Les Cimes Cristal' },
  histoire:   { name: 'Histoire',      short: 'HI',  icon: '\u{1F3DB}\uFE0F', color: '#c79120', colorSoft: '#f3e7ce', colorDeep: '#694d11', biome: 'Les Ruines Dor\u00e9es' },
  geographie: { name: 'G\u00e9ographie', short: 'GE', icon: '\u{1F9ED}', color: '#579b9a', colorSoft: '#dae9e9', colorDeep: '#2e5252', biome: "L'Archipel \u00c9meraude" },
  svt:        { name: 'SVT',           short: 'SV',  icon: '\u{1F33F}', color: '#779313', colorSoft: '#e1e7cb', colorDeep: '#3f4e0a', biome: 'La For\u00eat Vivante' },
  anglais:    { name: 'Anglais',       short: 'EN',  icon: '\u{1F339}', color: '#3160a5', colorSoft: '#d2dceb', colorDeep: '#1a3357', biome: 'Les Cours Tudor' },
  multi:      { name: 'Multi-mati\u00e8re', short: '?', icon: '\u{1F3B2}', color: '#e0a458', colorSoft: '#f0e0b2', colorDeep: '#8a5f1a', biome: 'Carrefour' },
  // Mati\u00e8res \u00ab forc\u00e9-only \u00bb : jamais sur le plateau, seulement d\u00e9clench\u00e9es par un
  // effet \u00ab question forc\u00e9e \u00bb. Pas de filtrage par niveau (transverses).
  cultureG:   { name: 'Culture g\u00e9n\u00e9rale', short: 'CG', icon: '\u{1F9E0}', color: '#7a5ea8', colorSoft: '#e2d9f0', colorDeep: '#41306b', biome: 'La Grande Biblioth\u00e8que' },
  hardcore:   { name: 'Hardcore',      short: 'HC',  icon: '\u{1F480}', color: '#8a1f2e', colorSoft: '#ecc9cd', colorDeep: '#4d0f17', biome: "L'Antre du D\u00e9fi" },
};

// Mati\u00e8res du PLATEAU (cases). cultureG/hardcore en sont volontairement exclues.
export const SUBJECT_KEYS = ['francais', 'maths', 'histoire', 'geographie', 'svt', 'anglais'];
// Mati\u00e8res suppl\u00e9mentaires \u00ab forc\u00e9-only \u00bb (jamais tir\u00e9es par une case, uniquement
// via un effet). Charg\u00e9es dans les pools de questions, hors filtrage par niveau.
export const FORCED_SUBJECT_KEYS = ['cultureG', 'hardcore'];
