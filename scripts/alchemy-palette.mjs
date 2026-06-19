// PALETTE D'ALCHIMIE — source de vérité « cohérente » pour générer 20 ingrédients
// et les 1140 potions (C(20,3)). Maintenable à la main : on règle ici les profils
// d'ingrédients, les barèmes de magnitude, la rareté, les noms et icônes.
//
// Le générateur (gen-alchemy.mjs) combine les 3 profils d'une recette → effets
// (≤6), rareté, nom, icône. Aucun appel réseau ici.

// ----- AXES d'effet : chaque ingrédient « pousse » certains axes (poids 1..3) ---
// positifs (buff pour soi) / négatifs (débuff sur les autres) / aléatoire.
export const POSITIVE = ['gold', 'move', 'time', 'shield', 'charge', 'themeBuff', 'advance', 'dice', 'loot', 'teleport', 'fumigene', 'immune'];
export const NEGATIVE = ['foeMoney', 'foeMove', 'foeForce', 'foeTimer', 'foeQuestion', 'foePath'];
export const RANDOM = ['gamble'];
export const ALL_AXES = [...POSITIVE, ...NEGATIVE, ...RANDOM];

// ----- 20 INGRÉDIENTS ---------------------------------------------------------
// profile : { axe: poids } · favSubject : matière de prédilection (loot)
// lootWeight : poids de base au loot · favMult : ×proba sur sa matière favorite
// solo : ≤2 effets simples (révélés à l'usage) ; si absent, dérivé du profil.
export const INGREDIENTS = [
  { key: 'herbeSolaire',  name: 'Herbe solaire',     icon: '🌻', rarity: 'commun', favSubject: 'svt',        lootWeight: 10, favMult: 2.5, profile: { gold: 2, time: 1 } },
  { key: 'roseeMatin',    name: 'Rosée du matin',    icon: '💧', rarity: 'commun', favSubject: 'francais',   lootWeight: 10, favMult: 2.5, profile: { time: 2, shield: 1 } },
  { key: 'champNuit',     name: 'Champignon de nuit', icon: '🍄', rarity: 'commun', favSubject: 'svt',       lootWeight: 9,  favMult: 2.0, profile: { gamble: 2, foeQuestion: 1 } },
  { key: 'silexAncien',   name: 'Silex ancien',      icon: '🪨', rarity: 'commun', favSubject: 'histoire',   lootWeight: 10, favMult: 2.5, profile: { shield: 2, foeMove: 1 } },
  { key: 'pousseVive',    name: 'Pousse vive',       icon: '🌱', rarity: 'commun', favSubject: 'svt',        lootWeight: 10, favMult: 2.5, profile: { move: 2, advance: 1 } },
  { key: 'plumeCorbeau',  name: 'Plume de corbeau',  icon: '🪶', rarity: 'commun', favSubject: 'francais',   lootWeight: 9,  favMult: 2.0, profile: { foeForce: 2, dice: 1 } },
  { key: 'sableDore',     name: 'Sable doré',        icon: '⏳', rarity: 'commun', favSubject: 'geographie', lootWeight: 10, favMult: 2.5, profile: { time: 2, gold: 1 } },
  { key: 'ecorceRunique', name: 'Écorce runique',    icon: '🪵', rarity: 'commun', favSubject: 'histoire',   lootWeight: 9,  favMult: 2.0, profile: { charge: 2, immune: 1 } },
  { key: 'baieEcarlate',  name: 'Baie écarlate',     icon: '🍒', rarity: 'commun', favSubject: 'anglais',    lootWeight: 10, favMult: 2.5, profile: { gold: 2, gamble: 1 } },
  { key: 'ailePapillon',  name: 'Aile de papillon',  icon: '🦋', rarity: 'commun', favSubject: 'geographie', lootWeight: 9,  favMult: 2.0, profile: { move: 2, teleport: 1 } },
  { key: 'crinMetal',     name: 'Crin de métal',     icon: '⚙️', rarity: 'rare',   favSubject: 'maths',      lootWeight: 6,  favMult: 2.5, profile: { dice: 2, move: 1 } },
  { key: 'larmeLune',     name: 'Larme de lune',     icon: '🌙', rarity: 'rare',   favSubject: 'francais',   lootWeight: 6,  favMult: 2.5, profile: { time: 2, charge: 2 } },
  { key: 'epineRonce',    name: 'Épine de ronce',    icon: '🌵', rarity: 'rare',   favSubject: 'svt',        lootWeight: 6,  favMult: 2.5, profile: { foeMove: 2, foeMoney: 2 } },
  { key: 'cristalFoudre', name: 'Cristal de foudre', icon: '⚡', rarity: 'rare',   favSubject: 'maths',      lootWeight: 6,  favMult: 2.5, profile: { charge: 2, foeTimer: 2 } },
  { key: 'cendreVolcan',  name: 'Cendre de volcan',  icon: '🌋', rarity: 'rare',   favSubject: 'geographie', lootWeight: 6,  favMult: 2.5, profile: { foeMove: 2, gold: 2 } },
  { key: 'mielSauvage',   name: 'Miel sauvage',      icon: '🍯', rarity: 'rare',   favSubject: 'anglais',    lootWeight: 6,  favMult: 2.5, profile: { gold: 2, themeBuff: 2 } },
  { key: 'osDragon',      name: 'Os de dragon',      icon: '🦴', rarity: 'rare',   favSubject: 'histoire',   lootWeight: 6,  favMult: 2.5, profile: { foeMoney: 2, shield: 2 } },
  { key: 'vifArgent',     name: 'Vif-argent',        icon: '💠', rarity: 'rare',   favSubject: 'maths',      lootWeight: 6,  favMult: 2.5, profile: { move: 2, dice: 2 } },
  { key: 'fleurAbysse',   name: 'Fleur des abysses', icon: '🪸', rarity: 'legendaire', favSubject: 'svt',    lootWeight: 3,  favMult: 3.0, profile: { teleport: 2, foePath: 2, gold: 2 } },
  { key: 'coeurEtoile',   name: "Cœur d'étoile",     icon: '🌟', rarity: 'legendaire', favSubject: 'anglais', lootWeight: 3, favMult: 3.0, profile: { charge: 2, loot: 2, time: 2 } },
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
  // ---- négatifs (sur les autres) ; foeTarget ∈ allOthers|randomOpponent|target ----
  foeMoney: (m, rng, subj, ft) => ft === 'allOthers'
    ? [{ action: 'money', mode: 'lose', target: 'allOthers', n: clamp(Math.round(m * 2) + 2, 3, 25), unit: 'flat' }]
    : [{ action: 'money', mode: 'steal', target: ft, n: clamp(Math.round(m * 2) + 3, 4, 30), unit: 'flat' }],
  foeMove:  (m, rng, subj, ft) => [{ action: 'move', target: ft, dir: 'back', n: clamp(Math.round(m / 2), 1, 4) }],
  foeForce: (m, rng, subj, ft) => [{ action: 'forceSubject', target: ft, subject: (rng() < 0.5 ? 'hardcore' : 'cultureG') }],
  foeTimer: (m, rng, subj, ft) => [{ action: 'curseTimer', target: ft, divisor: 2 }],
  foeQuestion: (m, rng, subj, ft) => [{ action: 'curseExtraQuestion', target: ft, n: clamp(Math.round(m / 3), 1, 2) }],
  foePath:  (m, rng, subj, ft) => [{ action: 'randomPathNext', target: ft }],
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
  foeMoney: 1.6, foeMove: 1.6, foeForce: 2, foeTimer: 2, foeQuestion: 1.8, foePath: 1.4, gamble: 1.2,
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
// Fragment de nom + icône par axe dominant.
export const AXIS_FLAVOR = {
  gold: { word: "de l'Avare", icon: '🟡' }, move: { word: 'de la Ruée', icon: '🚀' },
  time: { word: 'du Temps', icon: '⏳' }, shield: { word: 'du Roc', icon: '🛡️' },
  charge: { word: 'de l\'Arcane', icon: '🔮' }, themeBuff: { word: 'du Savoir', icon: '📚' },
  advance: { word: 'du Marathon', icon: '🏃' }, dice: { word: 'du Joueur', icon: '🎲' },
  loot: { word: 'du Butin', icon: '🎁' }, teleport: { word: 'du Mirage', icon: '🌀' },
  fumigene: { word: 'de la Brume', icon: '💨' }, immune: { word: 'du Rempart', icon: '🏰' },
  foeMoney: { word: 'du Larcin', icon: '🪙' }, foeMove: { word: 'du Faux Pas', icon: '🥾' },
  foeForce: { word: 'du Défi', icon: '💀' }, foeTimer: { word: 'de la Hâte', icon: '⏱️' },
  foeQuestion: { word: 'de l\'Examen', icon: '❓' }, foePath: { word: 'de l\'Égarement', icon: '🧭' },
  gamble: { word: 'du Hasard', icon: '🃏' },
};
export const LEGENDARY_ICON = '🌟';
export const ri_ = ri; // exporté pour le générateur
