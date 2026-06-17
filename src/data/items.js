// Catalogue des objets : équipements (3 emplacements) et consommables.
// Les effets sont décrits en data ({ type, value }) — jamais hardcodés dans la
// logique. Voir src/logic/itemEffects.js pour la lecture des effets passifs.
//
// Types d'effets passifs (équipement) :
//   timerBonus       +N secondes au timer des questions
//   indiceBoost      +N réponse(s) éliminée(s) quand Indice est utilisé
//   moneyPerCorrect  +N pièces à chaque bonne réponse
//   taxReduction     -N % sur les impôts et taxes subis
//   stealProtection  -N % sur les pièces qu'on te vole
//   reculReduction   -N cases sur les reculs subis (mauvaise réponse, Foudre, défaite de duel)
//   tempeteImmune    immunisé contre la Tempête
//   oubliProtect     le Trou de l'oubli devient un recul de 3 cases
//   fightStealBonus  +N pièces volées quand tu gagnes un duel (choix "voler")
//
// Types d'effets de consommables (usage unique) :
//   gainMoney    +N pièces immédiatement
//   gainMoneyAll +N pièces pour TOUTES les équipes
//   moveForward  avance de N cases (sans déclencher la case d'arrivée)
//   extraTime    +N secondes à ta prochaine question
//   shieldNext   annule le prochain recul après une mauvaise réponse
//   gainCharge   recharge 1 pouvoir de ton choix
//   fumigene     annule le prochain pouvoir offensif subi

// Couleurs alignées sur le design « Carte d'équipement » (liseré de rareté).
// soft = teinte claire pour les fonds/halos (LootReveal, cartes).
export const RARITIES = {
  commun:     { name: 'Commun',     color: '#969182', soft: '#e3dfd2' },
  rare:       { name: 'Rare',       color: '#3f7fd1', soft: '#d9e6f7' },
  legendaire: { name: 'Légendaire', color: '#e8962e', soft: '#fbe8c8' },
};

export const SLOTS = {
  head: { name: 'Coiffe',   icon: '🎩' },
  body: { name: 'Armure',   icon: '🛡️' },
  feet: { name: 'Amulette', icon: '📿' },
};

export const ITEMS = {
  // --- Coiffes (tête) — clés et effets inchangés, visuels/noms refondus ---
  chapeauPaille: {
    name: "Casque d'explorateur", icon: '🪖', img: 'chapeauPaille', slot: 'head', rarity: 'commun', price: 10,
    desc: '+3 secondes au timer des questions.',
    effects: [{ type: 'timerBonus', value: 3 }],
  },
  plumeScribe: {
    name: 'Tricorne emplumé', icon: '🎩', img: 'plumeScribe', slot: 'head', rarity: 'commun', price: 12,
    desc: '+1 pièce à chaque bonne réponse.',
    effects: [{ type: 'moneyPerCorrect', value: 1 }],
  },
  lunettesLecture: {
    name: 'Lunettes de lecture', icon: '👓', img: 'lunettesLecture', slot: 'head', rarity: 'commun', price: 12,
    desc: "L'Indice élimine 1 réponse de plus.",
    effects: [{ type: 'indiceBoost', value: 1 }],
  },
  bandeauSage: {
    name: 'Couronne du sage', icon: '🌿', img: 'bandeauSage', slot: 'head', rarity: 'rare', price: 24,
    desc: '+5 secondes au timer des questions.',
    effects: [{ type: 'timerBonus', value: 5 }],
  },
  monocleDetective: {
    name: "Lunettes de l'enquêteur", icon: '🥽', img: 'monocleDetective', slot: 'head', rarity: 'rare', price: 26,
    desc: "L'Indice élimine 1 réponse de plus, +2s au timer.",
    effects: [{ type: 'indiceBoost', value: 1 }, { type: 'timerBonus', value: 2 }],
  },
  couronneSavant: {
    name: 'Couronne du savant', icon: '👑', img: 'couronneSavant', slot: 'head', rarity: 'legendaire', price: 45, lootOnly: true,
    desc: '+8 secondes au timer des questions.',
    effects: [{ type: 'timerBonus', value: 8 }],
  },

  // --- Armures (corps) ---
  bourseCuir: {
    name: 'Brigandine du marchand', icon: '🛡️', img: 'bourseCuir', slot: 'body', rarity: 'commun', price: 12,
    desc: '+1 pièce à chaque bonne réponse.',
    effects: [{ type: 'moneyPerCorrect', value: 1 }],
  },
  amuletteFisc: {
    name: 'Plastron du percepteur', icon: '🛡️', img: 'amuletteFisc', slot: 'body', rarity: 'commun', price: 10,
    desc: 'Impôts et taxes réduits de moitié.',
    effects: [{ type: 'taxReduction', value: 50 }],
  },
  fanionSupporter: {
    name: 'Cuirasse du bretteur', icon: '🛡️', img: 'fanionSupporter', slot: 'body', rarity: 'commun', price: 10,
    desc: '+2 pièces volées quand tu gagnes un duel.',
    effects: [{ type: 'fightStealBonus', value: 2 }],
  },
  banniereMarchand: {
    name: 'Cotte du négociant', icon: '🛡️', img: 'banniereMarchand', slot: 'body', rarity: 'rare', price: 26,
    desc: '+2 pièces à chaque bonne réponse.',
    effects: [{ type: 'moneyPerCorrect', value: 2 }],
  },
  talismanOr: {
    name: 'Haubert du collecteur', icon: '🛡️', img: 'talismanOr', slot: 'body', rarity: 'rare', price: 22,
    desc: 'Immunisé contre les impôts et les taxes.',
    effects: [{ type: 'taxReduction', value: 100 }],
  },
  capeOmbre: {
    name: "Cape d'ombre", icon: '🦹', img: 'capeOmbre', slot: 'body', rarity: 'rare', price: 24,
    desc: 'On ne peut te voler que la moitié de tes pièces.',
    effects: [{ type: 'stealProtection', value: 50 }],
  },
  armureGarde: {
    name: 'Armure de garde', icon: '⛓️', img: 'armureGarde', slot: 'body', rarity: 'legendaire', price: 48, lootOnly: true,
    desc: 'Tes pièces sont impossibles à voler.',
    effects: [{ type: 'stealProtection', value: 100 }],
  },
  etendardRoyal: {
    name: 'Cuirasse royale', icon: '🏵️', img: 'etendardRoyal', slot: 'body', rarity: 'legendaire', price: 50, lootOnly: true,
    desc: '+3 pièces par bonne réponse, impôts réduits de moitié.',
    effects: [{ type: 'moneyPerCorrect', value: 3 }, { type: 'taxReduction', value: 50 }],
  },

  // --- Amulettes (anciennement montures) ---
  bottesUsees: {
    name: "Pendentif de l'errant", icon: '📿', img: 'bottesUsees', slot: 'feet', rarity: 'commun', price: 10,
    desc: 'Reculs subis réduits de 1 case.',
    effects: [{ type: 'reculReduction', value: 1 }],
  },
  ancreMarine: {
    name: 'Conque du marin', icon: '🐚', img: 'ancreMarine', slot: 'feet', rarity: 'commun', price: 12,
    desc: 'Immunisé contre la Tempête.',
    effects: [{ type: 'tempeteImmune', value: 1 }],
  },
  bottesMontagne: {
    name: 'Boussole du grimpeur', icon: '🧭', img: 'bottesMontagne', slot: 'feet', rarity: 'rare', price: 24,
    desc: 'Reculs subis réduits de 2 cases.',
    effects: [{ type: 'reculReduction', value: 2 }],
  },
  grappinVoyageur: {
    name: 'Médaillon de mémoire', icon: '🌳', img: 'grappinVoyageur', slot: 'feet', rarity: 'rare', price: 22,
    desc: "Le Trou de l'oubli ne te renvoie plus au départ (recul de 3 cases).",
    effects: [{ type: 'oubliProtect', value: 1 }],
  },
  eperonsDuel: {
    name: 'Talisman du dragon', icon: '🐉', img: 'eperonsDuel', slot: 'feet', rarity: 'rare', price: 24,
    desc: '+3 pièces volées quand tu gagnes un duel.',
    effects: [{ type: 'fightStealBonus', value: 3 }],
  },
  pegase: {
    name: 'Amulette céleste', icon: '🌙', img: 'pegase', slot: 'feet', rarity: 'legendaire', price: 50, lootOnly: true,
    desc: 'Reculs subis réduits de 2 cases, immunisé contre la Tempête.',
    effects: [{ type: 'reculReduction', value: 2 }, { type: 'tempeteImmune', value: 1 }],
  },

  // --- Consommables ---
  potionHate: {
    name: 'Potion de hâte', icon: '🧪', slot: 'consumable', rarity: 'commun', price: 8,
    desc: 'Avance immédiatement de 2 cases.',
    effects: [{ type: 'moveForward', value: 2 }],
  },
  potionCelerite: {
    name: 'Potion de célérité', icon: '⚗️', slot: 'consumable', rarity: 'rare', price: 14,
    desc: 'Avance immédiatement de 4 cases.',
    effects: [{ type: 'moveForward', value: 4 }],
  },
  elixirGeant: {
    name: 'Élixir du géant', icon: '🧉', slot: 'consumable', rarity: 'legendaire', price: 30, lootOnly: true,
    desc: 'Avance immédiatement de 6 cases.',
    effects: [{ type: 'moveForward', value: 6 }],
  },
  painVoyageur: {
    name: 'Pain du voyageur', icon: '🥖', slot: 'consumable', rarity: 'commun', price: 6,
    desc: 'Gagne 8 pièces.',
    effects: [{ type: 'gainMoney', value: 8 }],
  },
  coffretEpices: {
    name: "Coffret d'épices", icon: '🌶️', slot: 'consumable', rarity: 'rare', price: 14,
    desc: 'Gagne 18 pièces.',
    effects: [{ type: 'gainMoney', value: 18 }],
  },
  banquetPartage: {
    name: 'Banquet partagé', icon: '🍲', slot: 'consumable', rarity: 'rare', price: 12,
    desc: 'TOUTES les équipes gagnent 5 pièces.',
    effects: [{ type: 'gainMoneyAll', value: 5 }],
  },
  sablierPoche: {
    name: 'Sablier de poche', icon: '⌛', slot: 'consumable', rarity: 'commun', price: 8,
    desc: '+10 secondes à ta prochaine question.',
    effects: [{ type: 'extraTime', value: 10 }],
  },
  bouclierBois: {
    name: 'Bouclier de bois', icon: '🪵', slot: 'consumable', rarity: 'commun', price: 8,
    desc: 'Réduit ton prochain recul de 1 case (toutes sources : question, événement, duel…).',
    effects: [{ type: 'shieldNext', value: 1 }],
  },
  cristalEnergie: {
    name: "Cristal d'énergie", icon: '💎', slot: 'consumable', rarity: 'rare', price: 15,
    desc: 'Recharge 1 pouvoir de ton choix.',
    effects: [{ type: 'gainCharge', value: 1 }],
  },
  bombeFumigene: {
    name: 'Bombe fumigène', icon: '💨', slot: 'consumable', rarity: 'rare', price: 15,
    desc: 'Annule le prochain pouvoir offensif lancé contre toi.',
    effects: [{ type: 'fumigene', value: 1 }],
  },
  feeFlacon: {
    name: 'Fée en flacon', icon: '🧚', slot: 'consumable', rarity: 'legendaire', price: 30, lootOnly: true,
    desc: 'Recharge 1 pouvoir, annule ton prochain recul et +5s à ta prochaine question.',
    effects: [
      { type: 'gainCharge', value: 1 },
      { type: 'shieldNext', value: 1 },
      { type: 'extraTime', value: 5 },
    ],
  },
};

// Remplace le contenu de ITEMS en gardant la MÊME référence (mutée en place),
// pour que tout le code qui a importé ITEMS voie les nouvelles données.
// Appelé par la couche de chargement (src/logic/itemsConfig.js).
export function setItemsData(items) {
  if (!items || !Object.keys(items).length) return;
  for (const k of Object.keys(ITEMS)) delete ITEMS[k];
  for (const [k, it] of Object.entries(items)) {
    // Normalise effects en tableau (un cache d'un ancien schéma pourrait l'omettre)
    ITEMS[k] = { ...it, effects: Array.isArray(it.effects) ? it.effects : [] };
  }
}

// Snapshot des objets d'origine (fichier source) — fallback hors-ligne ultime.
export const BASE_ITEMS = JSON.parse(JSON.stringify(ITEMS));
