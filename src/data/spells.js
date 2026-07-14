// Sorts de l'extension « Magie » : une séquence ORDONNÉE de runes (data/runes.js)
// + un coût en magie + des ACTIONS du moteur d'effets (mêmes formes que les
// événements scriptés / objets composables — voir src/store/effectEngine.js).
//
// Sorts INTÉGRÉS (fallback hors-ligne) — les sorts PERSONNALISÉS (table
// quete_spells, éditeur) sont fusionnés par-dessus via setCustomSpells()
// (pattern identique aux recettes d'alchimie). DB = source de vérité.
//
// `targeted: true` → le sort vise une équipe adverse : la cible est choisie au
// téléphone AVANT l'incantation (jamais de picker suspendu sur le chemin
// intent) ; en découverte expérimentale, elle est tirée au hasard par le TBI
// (« magie sauvage »). `facePick: true` → idem pour un numéro de face (1-6).
export const BASE_SPELLS = [
  {
    key: 'etincelle',
    name: 'Étincelle dorée', name_en: 'Golden spark',
    icon: '💰', color: '#e0a458',
    runes: ['cercle', 'eclair'], cost: 20,
    desc: 'Fait jaillir 10 pièces d’or du néant.',
    desc_en: 'Conjures 10 gold coins out of thin air.',
    actions: [{ action: 'money', mode: 'gain', n: 10, target: 'self' }],
  },
  {
    key: 'pasDeLEclair',
    name: 'Pas de l’éclair', name_en: 'Lightning step',
    icon: '🌩️', color: '#4aa3df',
    runes: ['eclair', 'fleche'], cost: 30,
    desc: 'Le pion glisse de 2 cases en avant, porté par la foudre.',
    desc_en: 'Your pawn slides 2 spaces forward on a bolt of lightning.',
    actions: [{ action: 'move', dir: 'forward', n: 2, target: 'self' }],
  },
  {
    key: 'mainInvisible',
    name: 'Main invisible', name_en: 'Invisible hand',
    icon: '🫳', color: '#8745d4',
    runes: ['spirale', 'serpent'], cost: 40, targeted: true,
    desc: 'Une main spectrale dérobe 10 pièces d’or à une équipe.',
    desc_en: 'A ghostly hand steals 10 gold coins from a team.',
    actions: [{ action: 'money', mode: 'steal', n: 10, target: 'target' }],
  },
  {
    key: 'benedictionDe',
    name: 'Bénédiction du dé', name_en: 'Die blessing',
    icon: '✨', color: '#e8c34a',
    runes: ['triangle', 'cercle', 'croix'], cost: 50, facePick: true,
    desc: 'Bénis une face de ton dé : +10 or chaque fois qu’elle tombe.',
    desc_en: 'Bless one face of your die: +10 gold whenever it lands.',
    actions: [{ action: 'blessFace', n: 10, target: 'self' }],
  },
  {
    key: 'maledictionDe',
    name: 'Malédiction du dé', name_en: 'Die curse',
    icon: '☠️', color: '#8a1f2e',
    runes: ['serpent', 'triangle', 'eclair'], cost: 50, targeted: true, facePick: true,
    desc: 'Maudis une face du dé d’une équipe : −10 or chaque fois qu’elle tombe.',
    desc_en: 'Curse one face of a team’s die: −10 gold whenever it lands.',
    actions: [{ action: 'curseFace', n: 10, target: 'target' }],
  },
  {
    key: 'purification',
    name: 'Purification', name_en: 'Cleansing',
    icon: '💧', color: '#2f9d5a',
    runes: ['croix', 'cercle'], cost: 30,
    desc: 'Dissipe toutes les bénédictions et malédictions de ton dé.',
    desc_en: 'Dispels every blessing and curse on your die.',
    actions: [{ action: 'cleanseFaces', scope: 'all', target: 'self' }],
  },
  {
    key: 'brouillardMental',
    name: 'Brouillard mental', name_en: 'Mind fog',
    icon: '🌫️', color: '#6b7a8f',
    runes: ['serpent', 'spirale'], cost: 45, targeted: true,
    desc: 'À sa prochaine question, les réponses de la cible changent de place toutes les 3 secondes.',
    desc_en: 'On their next question, the target’s answers shuffle around every 3 seconds.',
    actions: [{ action: 'unstableAnswers', interval: 3, target: 'target' }],
  },
];

// Liste VIVE des sorts (mutée EN PLACE pour préserver le binding des imports).
export const SPELLS = [...BASE_SPELLS];

// Fusionne les sorts personnalisés (par `key`) par-dessus les intégrés.
export function setCustomSpells(list) {
  const byKey = new Map(BASE_SPELLS.map((s) => [s.key, s]));
  for (const s of (Array.isArray(list) ? list : [])) {
    if (s && s.key && Array.isArray(s.runes) && s.runes.length) byKey.set(s.key, s);
  }
  SPELLS.length = 0;
  SPELLS.push(...byKey.values());
}

// Clé canonique d'une séquence (l'ORDRE compte, contrairement à l'alchimie).
const seqKey = (runes) => (runes || []).filter(Boolean).join('>');

// Sort correspondant EXACTEMENT à une séquence de runes tracée, ou null.
export function matchSpell(runes, spells = SPELLS) {
  if (!Array.isArray(runes) || !runes.length) return null;
  const k = seqKey(runes);
  return spells.find((s) => s.enabled !== false && seqKey(s.runes) === k) || null;
}

export const spellName = (s, lang = 'fr') => (lang === 'en' ? s?.name_en : s?.name) || s?.name || s?.key || '';
