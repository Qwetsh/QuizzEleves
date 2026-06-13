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
};

export const SUBJECT_KEYS = ['francais', 'maths', 'histoire', 'geographie', 'svt', 'anglais'];
