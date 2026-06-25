// PALETTE D'ALCHIMIE — données de base des 20 ingrédients + constantes de nommage
// et de rareté, utilisées par gen-alchemy.mjs.
//
// ⚠️ Les EFFETS des potions ne sont PLUS dérivés des profils d'axes ci-dessous :
// depuis le rééquilibrage 2026-06, ils sont produits par un distributeur équilibré
// (scripts/potion-effects.mjs, cible de distribution). Les `profile` ne servent
// donc plus qu'à dériver les effets « solo » des ingrédients (file fallback ;
// la DB édité à la main reste l'autorité au runtime).

// ----- 20 INGRÉDIENTS ---------------------------------------------------------
// profile : { axe: poids } → effets solo de l'ingrédient (soloEffects, fallback)
// favSubject/lootWeight/favMult : données de loot. `img` = clé d'asset embarqué.
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

// Plafond d'effets « solo » d'un ingrédient (révélés à l'usage).
export const MAX_INGREDIENT_EFFECTS = 2;

// Répartition cible de rareté des potions (appliquée par split déterministe).
export const RARITY_SPLIT = { commun: 0.50, rare: 0.38, legendaire: 0.12 };

// ----- Nommage des potions ----------------------------------------------------
// Formes (FR) cyclées + saveur de l'effet dominant + épithète (cf. gen-alchemy).
export const FORMS = ['Potion', 'Élixir', 'Philtre', 'Décoction', 'Breuvage', 'Tonique', 'Mixture', 'Essence', 'Sérum', 'Nectar'];
// Formes EN (mêmes indices que FORMS).
export const FORMS_EN = ['Potion', 'Elixir', 'Philter', 'Decoction', 'Brew', 'Tonic', 'Mixture', 'Essence', 'Serum', 'Nectar'];

// Libellés de rareté EN (pour la description générée) + icône légendaire.
export const RARITY_EN = { commun: 'Common', rare: 'Rare', legendaire: 'Legendary' };
export const LEGENDARY_ICON = '🌟';
