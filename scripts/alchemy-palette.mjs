// PALETTE D'ALCHIMIE — source de vérité « cohérente » pour générer 20 ingrédients
// et les 1140 potions (C(20,3)). Maintenable à la main : on règle ici les profils
// d'ingrédients, les barèmes de magnitude, la rareté, les noms et icônes.
//
// Le générateur (gen-alchemy.mjs) combine les 3 profils d'une recette → effets
// (≤6), rareté, nom, icône. Aucun appel réseau ici.

// ----- AXES d'effet : chaque ingrédient « pousse » certains axes (poids 1..3) ---
// positifs (buff pour soi) / négatifs (débuff sur les autres) / aléatoire.
export const POSITIVE = ['gold', 'move', 'time', 'shield', 'charge', 'themeBuff', 'advance', 'dice', 'loot', 'teleport', 'fumigene', 'immune', 'reflect', 'goldGuard', 'itemGuard'];
export const NEGATIVE = ['foeMoney', 'foeMove', 'foeForce', 'foeTimer', 'foeQuestion', 'foePath', 'foeBleed', 'foeSilence', 'foeGag'];
export const RANDOM = ['gamble'];
export const ALL_AXES = [...POSITIVE, ...NEGATIVE, ...RANDOM];

// ----- 20 INGRÉDIENTS ---------------------------------------------------------
// profile : { axe: poids } · favSubject : matière de prédilection (loot)
// lootWeight : poids de base au loot · favMult : ×proba sur sa matière favorite
// solo : ≤2 effets simples (révélés à l'usage) ; si absent, dérivé du profil.
// `img` = clé d'asset embarqué (src/assets/items/alc-<key>.png), résolu par
// itemImg → assetUrl. L'emoji `icon` reste le repli. Certains ingrédients ont
// été renommés pour coller à l'asset retenu (la CLÉ reste stable → recettes OK).
export const INGREDIENTS = [
  { key: 'herbeSolaire',  name: 'Herbe solaire',     name_en: 'Sunleaf',          icon: '🌿', img: 'alc-herbeSolaire',  rarity: 'commun', favSubject: 'svt',        lootWeight: 10, favMult: 2.5, profile: { gold: 2, time: 1 } },
  { key: 'roseeMatin',    name: 'Rosée du matin',    name_en: 'Morning Dew',      icon: '💧', img: 'alc-roseeMatin',    rarity: 'commun', favSubject: 'francais',   lootWeight: 10, favMult: 2.5, profile: { time: 2, shield: 1 } },
  { key: 'champNuit',     name: 'Champignon de nuit', name_en: 'Nightcap Mushroom', icon: '🍄', img: 'alc-champNuit',   rarity: 'commun', favSubject: 'svt',       lootWeight: 9,  favMult: 2.0, profile: { gamble: 2, foeQuestion: 1 } },
  { key: 'silexAncien',   name: 'Géode ancienne',    name_en: 'Ancient Geode',    icon: '💎', img: 'alc-silexAncien',   rarity: 'commun', favSubject: 'histoire',   lootWeight: 10, favMult: 2.5, profile: { shield: 2, foeMove: 1 } },
  { key: 'pousseVive',    name: 'Pousse vive',       name_en: 'Quick Sprout',     icon: '🌱', img: 'alc-pousseVive',    rarity: 'commun', favSubject: 'svt',        lootWeight: 10, favMult: 2.5, profile: { move: 2, advance: 1 } },
  { key: 'plumeCorbeau',  name: 'Plume de corbeau',  name_en: 'Raven Feather',    icon: '🪶', img: 'alc-plumeCorbeau',  rarity: 'commun', favSubject: 'francais',   lootWeight: 9,  favMult: 2.0, profile: { foeForce: 2, dice: 1 } },
  { key: 'sableDore',     name: 'Sable doré',        name_en: 'Golden Sand',      icon: '⏳', img: 'alc-sableDore',     rarity: 'commun', favSubject: 'geographie', lootWeight: 10, favMult: 2.5, profile: { time: 2, gold: 1 } },
  { key: 'ecorceRunique', name: 'Parchemin runique', name_en: 'Runic Scroll',     icon: '📜', img: 'alc-ecorceRunique', rarity: 'commun', favSubject: 'histoire',   lootWeight: 9,  favMult: 2.0, profile: { charge: 2, immune: 1 } },
  { key: 'baieEcarlate',  name: 'Baie écarlate',     name_en: 'Scarlet Berry',    icon: '🍒', img: 'alc-baieEcarlate',  rarity: 'commun', favSubject: 'anglais',    lootWeight: 10, favMult: 2.5, profile: { gold: 2, gamble: 1 } },
  { key: 'ailePapillon',  name: 'Aile de libellule', name_en: 'Dragonfly Wing',   icon: '🪰', img: 'alc-ailePapillon',  rarity: 'commun', favSubject: 'geographie', lootWeight: 9,  favMult: 2.0, profile: { move: 2, teleport: 1 } },
  { key: 'crinMetal',     name: 'Croc acéré',        name_en: 'Sharp Fang',       icon: '🦷', img: 'alc-crinMetal',     rarity: 'rare',   favSubject: 'maths',      lootWeight: 6,  favMult: 2.5, profile: { dice: 2, move: 1 } },
  { key: 'larmeLune',     name: 'Larme de lune',     name_en: 'Moon Tear',        icon: '🌙', img: 'alc-larmeLune',     rarity: 'rare',   favSubject: 'francais',   lootWeight: 6,  favMult: 2.5, profile: { time: 2, charge: 1, reflect: 1 } },
  { key: 'epineRonce',    name: 'Épine de ronce',    name_en: 'Bramble Thorn',    icon: '🌵', img: 'alc-epineRonce',    rarity: 'rare',   favSubject: 'svt',        lootWeight: 6,  favMult: 2.5, profile: { foeMove: 2, foeMoney: 1, foeBleed: 1 } },
  { key: 'cristalFoudre', name: 'Cristal de foudre', name_en: 'Thunder Crystal',  icon: '⚡', img: 'alc-cristalFoudre', rarity: 'rare',   favSubject: 'maths',      lootWeight: 6,  favMult: 2.5, profile: { charge: 2, foeTimer: 1, foeSilence: 1 } },
  { key: 'cendreVolcan',  name: 'Éclats de braise',  name_en: 'Ember Shards',     icon: '🔶', img: 'alc-cendreVolcan',  rarity: 'rare',   favSubject: 'geographie', lootWeight: 6,  favMult: 2.5, profile: { foeMove: 2, gold: 1, foeGag: 1 } },
  { key: 'mielSauvage',   name: 'Miel sauvage',      name_en: 'Wild Honey',       icon: '🍯', img: 'alc-mielSauvage',   rarity: 'rare',   favSubject: 'anglais',    lootWeight: 6,  favMult: 2.5, profile: { gold: 1, themeBuff: 2, goldGuard: 1 } },
  { key: 'osDragon',      name: 'Os de dragon',      name_en: 'Dragon Bone',      icon: '🦴', img: 'alc-osDragon',      rarity: 'rare',   favSubject: 'histoire',   lootWeight: 6,  favMult: 2.5, profile: { foeMoney: 1, shield: 2, itemGuard: 1 } },
  { key: 'vifArgent',     name: "Perles d'argent",   name_en: 'Silver Pearls',    icon: '⚪', img: 'alc-vifArgent',     rarity: 'rare',   favSubject: 'maths',      lootWeight: 6,  favMult: 2.5, profile: { move: 2, dice: 2 } },
  { key: 'fleurAbysse',   name: 'Fleur des abysses', name_en: 'Abyssal Flower',   icon: '🪷', img: 'alc-fleurAbysse',   rarity: 'legendaire', favSubject: 'svt',    lootWeight: 3,  favMult: 3.0, profile: { teleport: 2, foeBleed: 2, foeSilence: 1, gold: 1 } },
  { key: 'coeurEtoile',   name: "Cœur d'étoile",     name_en: 'Star Heart',       icon: '🌟', img: 'alc-coeurEtoile',   rarity: 'legendaire', favSubject: 'anglais', lootWeight: 3, favMult: 3.0, profile: { charge: 2, reflect: 2, itemGuard: 1 } },
];

// ----- BARÈMES de magnitude (m = score d'axe sommé sur les 3 ingrédients) ------
// Chaque template renvoie une (ou des) action(s) du moteur d'effets composable.
// `rng` = générateur pseudo-aléatoire semé (déterministe) ; `subj` = matière
// favorite dominante (pour themeBuff) ; `foeTarget` = ciblage débuff choisi.
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ri = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

export const TEMPLATES = {
  // ---- positifs (self) ----
  gold:     (m, rng) => [{ action: 'money', mode: 'gain', target: 'self', n: clamp(Math.round(m * 4) + 4, 5, 45), unit: 'flat' }],
  move:     (m) => [{ action: 'move', target: 'self', dir: 'forward', n: clamp(Math.round(m / 2), 1, 5) }],
  time:     (m) => [{ action: 'extraTime', n: clamp(Math.round(m * 1.5) + 2, 3, 14) }],
  shield:   (m) => [{ action: 'shieldNext', n: clamp(Math.round(m / 2), 1, 3) }],
  charge:   () => [{ action: 'gainCharge' }],
  themeBuff:(m, rng, subj) => [{ action: 'buff', target: 'self', buff: { type: 'themeBonus', turns: clamp(Math.round(m / 2) + 1, 2, 4), n: clamp(Math.round(m) + 3, 4, 12), subject: subj } }],
  advance:  (m) => [{ action: 'buff', target: 'self', buff: { type: 'advanceOnCorrect', turns: clamp(Math.round(m / 3) + 1, 1, 3), n: clamp(Math.round(m / 3), 1, 2) } }],
  dice:     (m) => [{ action: 'buff', target: 'self', buff: { type: 'diceBonus', turns: clamp(Math.round(m / 2) + 1, 2, 4), n: clamp(Math.round(m / 3), 1, 2) } }],
  loot:     () => [{ action: 'loot', category: 'consumable' }],
  teleport: () => [{ action: 'teleportFurthest', target: 'self' }],
  fumigene: (m) => [{ action: 'fumigene', turns: clamp(Math.round(m / 2), 1, 3) }],
  immune:   (m) => [{ action: 'buff', target: 'self', buff: { type: 'duelImmune', turns: clamp(Math.round(m / 2) + 1, 1, 3) } }],
  // Renvoi (% chance de retourner un effet négatif) — fort : % et durée à l'échelle.
  reflect:  (m) => [{ action: 'buff', target: 'self', buff: { type: 'reflectChance', turns: clamp(Math.round(m / 2) + 1, 1, 3), n: clamp(Math.round(m * 5) + 15, 20, 60) } }],
  // Immunité temporaire au vol d'or / d'objet (sur soi).
  goldGuard:(m) => [{ action: 'buff', target: 'self', buff: { type: 'goldStealImmune', turns: clamp(Math.round(m / 2) + 1, 2, 4) } }],
  itemGuard:(m) => [{ action: 'buff', target: 'self', buff: { type: 'itemStealImmune', turns: clamp(Math.round(m / 2) + 1, 2, 4) } }],
  // ---- négatifs (sur les autres) ; foeTarget ∈ allOthers|randomOpponent|target ----
  foeMoney: (m, rng, subj, ft) => ft === 'allOthers'
    ? [{ action: 'money', mode: 'lose', target: 'allOthers', n: clamp(Math.round(m * 2) + 2, 3, 25), unit: 'flat' }]
    : [{ action: 'money', mode: 'steal', target: ft, n: clamp(Math.round(m * 2) + 3, 4, 30), unit: 'flat' }],
  foeMove:  (m, rng, subj, ft) => [{ action: 'move', target: ft, dir: 'back', n: clamp(Math.round(m / 2), 1, 4) }],
  foeForce: (m, rng, subj, ft) => [{ action: 'forceSubject', target: ft, subject: (rng() < 0.5 ? 'hardcore' : 'cultureG') }],
  foeTimer: (m, rng, subj, ft) => [{ action: 'curseTimer', target: ft, divisor: 2 }],
  foeQuestion: (m, rng, subj, ft) => [{ action: 'curseExtraQuestion', target: ft, n: clamp(Math.round(m / 3), 1, 2) }],
  foePath:  (m, rng, subj, ft) => [{ action: 'randomPathNext', target: ft }],
  // Saignement d'or (DoT) — sur tous : perte sèche (moins cassé) ; ciblé : vol à soi.
  foeBleed: (m, rng, subj, ft) => [{ action: 'buff', target: ft, buff: { type: 'bleedGold', turns: clamp(Math.round(m / 3) + 1, 1, 3), n: clamp(Math.round(m) + 2, 3, 10), mode: ft === 'allOthers' ? 'lose' : 'steal' } }],
  // Blocage des pouvoirs / consommables (X tours) — fort, surtout en allOthers.
  foeSilence: (m, rng, subj, ft) => [{ action: 'blockPowers', target: ft, turns: clamp(Math.round(m / 3) + 1, 1, 2) }],
  foeGag:   (m, rng, subj, ft) => [{ action: 'blockConsumables', target: ft, turns: clamp(Math.round(m / 3) + 1, 1, 2) }],
  // ---- aléatoire : table d6 (mauvais / moyen / bon) à magnitude croissante ----
  gamble:   (m, rng) => [{
    kind: 'inline-roll', // marqueur : le générateur le transforme en trigger on:'use' roll d6
    table: {
      '1': [{ action: 'money', mode: 'lose', target: 'self', n: clamp(Math.round(m), 2, 10), unit: 'flat' }],
      '2-3': [{ action: 'move', target: 'self', dir: 'forward', n: 1 }],
      '4-5': [{ action: 'money', mode: 'gain', target: 'self', n: clamp(Math.round(m * 3) + 5, 8, 30), unit: 'flat' }],
      '6': [{ action: 'money', mode: 'gain', target: 'self', n: clamp(Math.round(m * 5) + 10, 15, 50), unit: 'flat' }],
    },
  }],
};

// « Coût/puissance » d'un axe (pour rareté + tri). Négatifs comptent aussi.
export const AXIS_POWER = {
  gold: 1, move: 1.4, time: 1, shield: 1.3, charge: 2.2, themeBuff: 1.6, advance: 2, dice: 1.8,
  loot: 2.4, teleport: 2.6, fumigene: 1.5, immune: 1.8,
  // Effets avancés (forts) : poussent les potions qui les contiennent vers le haut.
  reflect: 2.6, goldGuard: 1.9, itemGuard: 1.9,
  foeMoney: 1.6, foeMove: 1.6, foeForce: 2, foeTimer: 2, foeQuestion: 1.8, foePath: 1.4, gamble: 1.2,
  foeBleed: 2.6, foeSilence: 2.4, foeGag: 2.2,
};

// Seuil de sélection d'un axe (score sommé minimal pour devenir un effet).
export const AXIS_THRESHOLD = 1;
export const MAX_POTION_EFFECTS = 6;
export const MAX_INGREDIENT_EFFECTS = 2;

// Répartition cible de rareté (percentiles sur la puissance totale).
export const RARITY_SPLIT = { commun: 0.50, rare: 0.38, legendaire: 0.12 };

// Probabilités de ciblage des débuffs (mélange).
export const FOE_TARGETS = [['allOthers', 0.5], ['randomOpponent', 0.3], ['target', 0.2]];

// ----- Nommage & icônes -------------------------------------------------------
export const FORMS = ['Potion', 'Élixir', 'Philtre', 'Décoction', 'Breuvage', 'Tonique', 'Mixture', 'Essence', 'Sérum', 'Nectar'];
// Formes EN (mêmes indices que FORMS) — le nom EN = `${form_en} ${word_en}`.
export const FORMS_EN = ['Potion', 'Elixir', 'Philter', 'Decoction', 'Brew', 'Tonic', 'Mixture', 'Essence', 'Serum', 'Nectar'];
// Fragment de nom (FR `word` + EN `word_en`) + icône par axe dominant.
export const AXIS_FLAVOR = {
  gold: { word: "de l'Avare", word_en: 'of the Miser', icon: '🟡' }, move: { word: 'de la Ruée', word_en: 'of the Rush', icon: '🚀' },
  time: { word: 'du Temps', word_en: 'of Time', icon: '⏳' }, shield: { word: 'du Roc', word_en: 'of the Rock', icon: '🛡️' },
  charge: { word: 'de l\'Arcane', word_en: 'of the Arcane', icon: '🔮' }, themeBuff: { word: 'du Savoir', word_en: 'of Knowledge', icon: '📚' },
  advance: { word: 'du Marathon', word_en: 'of the Marathon', icon: '🏃' }, dice: { word: 'du Joueur', word_en: 'of the Gambler', icon: '🎲' },
  loot: { word: 'du Butin', word_en: 'of Loot', icon: '🎁' }, teleport: { word: 'du Mirage', word_en: 'of the Mirage', icon: '🌀' },
  fumigene: { word: 'de la Brume', word_en: 'of the Mist', icon: '💨' }, immune: { word: 'du Rempart', word_en: 'of the Bulwark', icon: '🏰' },
  reflect: { word: 'du Miroir', word_en: 'of the Mirror', icon: '🪞' }, goldGuard: { word: 'du Coffre', word_en: 'of the Vault', icon: '🔒' },
  itemGuard: { word: 'du Gardien', word_en: 'of the Warden', icon: '🧿' },
  foeMoney: { word: 'du Larcin', word_en: 'of Larceny', icon: '🪙' }, foeMove: { word: 'du Faux Pas', word_en: 'of the Misstep', icon: '🥾' },
  foeForce: { word: 'du Défi', word_en: 'of the Challenge', icon: '💀' }, foeTimer: { word: 'de la Hâte', word_en: 'of Haste', icon: '⏱️' },
  foeQuestion: { word: 'de l\'Examen', word_en: 'of the Exam', icon: '❓' }, foePath: { word: 'de l\'Égarement', word_en: 'of Straying', icon: '🧭' },
  foeBleed: { word: 'de la Sangsue', word_en: 'of the Leech', icon: '🩸' }, foeSilence: { word: 'du Silence', word_en: 'of Silence', icon: '🤐' },
  foeGag: { word: 'du Bâillon', word_en: 'of the Gag', icon: '😶' },
  gamble: { word: 'du Hasard', word_en: 'of Chance', icon: '🃏' },
};
// ----- Visuels de potion (assets réutilisés) ---------------------------------
// 40 fioles dessinées (src/assets/items/alc-pot-r<r>c<c>.png), réutilisées selon
// l'AXE DOMINANT de la potion (cohérent avec l'effet). Le générateur choisit un
// asset de la liste de façon déterministe (hash de la combinaison) → variété.
// Codes de cellule (rXcY) de la planche : r1c1 cœur rouge, r1c3 crâne poison,
// r1c4/5 fioles-écu dorées, r2c1 éclair, r2c3 œil argent, r2c8 grimoire, r3c4 or,
// r3c8 lune, r4c3 arc-en-ciel, r4c6 plume, r4c7 galaxie, r5c2 écu bleu,
// r5c5 crâne violet, r5c6 tentacule-poison, r5c7 constellation…
export const POTION_ART = {
  gold:       ['r3c4', 'r3c1', 'r1c4', 'r1c1'],
  move:       ['r4c6', 'r1c6', 'r5c1', 'r3c2'],
  time:       ['r3c8', 'r5c7', 'r5c4', 'r3c2'],
  shield:     ['r1c5', 'r5c2', 'r1c4', 'r2c6'],
  charge:     ['r2c1', 'r2c8', 'r3c5'],
  themeBuff:  ['r2c8', 'r3c5', 'r2c7'],
  advance:    ['r1c6', 'r4c6', 'r5c4', 'r2c5'],
  dice:       ['r4c3', 'r1c6', 'r5c8', 'r3c3'],
  loot:       ['r3c4', 'r4c8', 'r4c7'],
  teleport:   ['r4c7', 'r4c8', 'r4c3'],
  fumigene:   ['r2c3', 'r3c7', 'r4c4'],
  immune:     ['r5c2', 'r1c5', 'r2c6', 'r1c4'],
  reflect:    ['r2c3', 'r2c4', 'r3c6'],
  goldGuard:  ['r1c4', 'r1c5', 'r3c4'],
  itemGuard:  ['r5c2', 'r2c8', 'r1c4'],
  foeMoney:   ['r5c5', 'r1c3', 'r3c6'],
  foeMove:    ['r4c4', 'r4c5', 'r1c8'],
  foeForce:   ['r1c3', 'r5c5', 'r2c8'],
  foeTimer:   ['r1c8', 'r2c3', 'r3c2'],
  foeQuestion:['r2c8', 'r3c6', 'r1c3'],
  foePath:    ['r4c5', 'r4c3', 'r4c1'],
  foeBleed:   ['r5c6', 'r5c3', 'r1c7', 'r1c3', 'r5c5'],
  foeSilence: ['r5c5', 'r3c6', 'r1c3'],
  foeGag:     ['r3c6', 'r1c3', 'r5c5'],
  gamble:     ['r4c3', 'r5c8', 'r4c1', 'r1c2'],
};
export const POTION_ART_FALLBACK = ['r2c2', 'r4c2', 'r3c3', 'r1c2'];

// Libellés de rareté EN (pour la description générée).
export const RARITY_EN = { commun: 'Common', rare: 'Rare', legendaire: 'Legendary' };
export const LEGENDARY_ICON = '🌟';
export const ri_ = ri; // exporté pour le générateur
