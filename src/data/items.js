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
//   diceMalus        -N cases sur l'avancée à CHAQUE lancer (handicap, plancher 0 case)
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

  // === ALCHIMIE — ingrédients (effet mineur en usage seul) ==================
  // family:'ingredient'. Se combinent par 3 (recettes dans data/recipes.js).
  herbeDoree:    { name: 'Herbe dorée',      icon: '🌿', slot: 'consumable', family: 'ingredient', rarity: 'commun', price: 4, desc: 'Ingrédient. Seule : +3 pièces.', effects: [{ type: 'gainMoney', value: 3 }] },
  champignonBleu:{ name: 'Champignon bleu',  icon: '🍄', slot: 'consumable', family: 'ingredient', rarity: 'commun', price: 4, desc: 'Ingrédient. Seul : +4s à ta prochaine question.', effects: [{ type: 'extraTime', value: 4 }] },
  racinePierre:  { name: 'Racine de pierre', icon: '🪨', slot: 'consumable', family: 'ingredient', rarity: 'commun', price: 4, desc: 'Ingrédient. Seule : annule ton prochain recul.', effects: [{ type: 'shieldNext', value: 1 }] },
  aileFee:       { name: 'Aile de fée',      icon: '🦋', slot: 'consumable', family: 'ingredient', rarity: 'commun', price: 4, desc: 'Ingrédient. Seule : avance d’1 case.', effects: [{ type: 'moveForward', value: 1 }] },
  fleurLune:     { name: 'Fleur de lune',    icon: '🌙', slot: 'consumable', family: 'ingredient', rarity: 'commun', price: 4, desc: 'Ingrédient. Seule : +3 pièces.', effects: [{ type: 'gainMoney', value: 3 }] },
  cendreDragon:  { name: 'Cendre de dragon', icon: '🔥', slot: 'consumable', family: 'ingredient', rarity: 'rare',   price: 6, desc: 'Ingrédient. Seule : +4s à ta prochaine question.', effects: [{ type: 'extraTime', value: 4 }] },
  larmeCristal:  { name: 'Larme de cristal', icon: '💧', slot: 'consumable', family: 'ingredient', rarity: 'rare',   price: 6, desc: 'Ingrédient. Seule : avance d’1 case.', effects: [{ type: 'moveForward', value: 1 }] },
  ecailleArgent: { name: 'Écaille d’argent', icon: '🐟', slot: 'consumable', family: 'ingredient', rarity: 'rare',   price: 6, desc: 'Ingrédient. Seule : annule ton prochain recul.', effects: [{ type: 'shieldNext', value: 1 }] },

  // === ALCHIMIE — potions (effet majeur, obtenues par distillation) =========
  potionOr:      { name: 'Potion d’or',       icon: '🟡', slot: 'consumable', family: 'potion', rarity: 'rare',       price: 0, lootOnly: true, desc: 'Potion : +15 pièces.', effects: [{ type: 'gainMoney', value: 15 }] },
  elixirTemps:   { name: 'Élixir du temps',   icon: '⏳', slot: 'consumable', family: 'potion', rarity: 'rare',       price: 0, lootOnly: true, desc: 'Potion : +12s à ta prochaine question.', effects: [{ type: 'extraTime', value: 12 }] },
  potionPierre:  { name: 'Potion de pierre',  icon: '🛡️', slot: 'consumable', family: 'potion', rarity: 'rare',       price: 0, lootOnly: true, desc: 'Potion : annule tes 2 prochains reculs.', effects: [{ type: 'shieldNext', value: 2 }] },
  potionRuee:    { name: 'Potion de ruée',     icon: '🚀', slot: 'consumable', family: 'potion', rarity: 'rare',       price: 0, lootOnly: true, desc: 'Potion : avance de 4 cases.', effects: [{ type: 'moveForward', value: 4 }] },
  elixirSupreme: { name: 'Élixir suprême',    icon: '🌟', slot: 'consumable', family: 'potion', rarity: 'legendaire', price: 0, lootOnly: true, desc: 'Potion : +20 pièces, +8s et recharge 1 pouvoir.', effects: [{ type: 'gainMoney', value: 20 }, { type: 'extraTime', value: 8 }, { type: 'gainCharge', value: 1 }] },

  // === ENCHANTEMENT — parchemins (posés sur une pièce équipée) ==============
  // family:'parchment'. Les parchemins pré-faits ont été RETIRÉS : l'enchantement
  // passe désormais par l'Autel du Scribe (craft d'un parchemin gravé sur mesure).

  // Parchemin VIERGE : matière première de l'Autel du Scribe (craft d'enchant
  // personnalisé). En boutique quand l'extension Enchantement est active.
  parcheminVierge: { name: 'Parchemin vierge', name_en: 'Blank scroll', icon: '📜', slot: 'consumable', family: 'parchment', rarity: 'commun', price: 8, blank: true, desc: "Sert à graver un enchantement personnalisé à l'Autel du Scribe (avec de l'or).", desc_en: 'Used to inscribe a custom enchantment at the Scribe\'s Altar (with gold).' },
  // Parchemin GRAVÉ : porteur d'un enchant CUSTOM (specs dans la case du sac, champ
  // `enchants`). Uniquement produit par le craft (lootOnly → hors boutique/loot).
  parcheminGrave: { name: 'Parchemin gravé', name_en: 'Inscribed scroll', icon: '✒️', slot: 'consumable', family: 'parchment', rarity: 'rare', price: 0, lootOnly: true, desc: 'Parchemin d\'enchantement gravé sur mesure.', desc_en: 'A custom-inscribed enchantment scroll.' },

  // === EFFETS AVANCÉS — immunités, renvoi, blocages, saignement d'or ========
  // Passifs d'équipement (immunité au vol d'objet / d'or, renvoi % d'effet).
  talismanGardien: {
    name: 'Talisman du gardien', icon: '🧿', slot: 'feet', rarity: 'rare', price: 24,
    desc: "Tes objets sont impossibles à voler (pillage, pickpocket, butin de duel).",
    effects: [{ type: 'itemStealImmune', value: 1 }],
  },
  cadenasRunique: {
    name: 'Cadenas runique', icon: '🔒', slot: 'feet', rarity: 'rare', price: 24,
    desc: "Ton or est impossible à voler.",
    effects: [{ type: 'goldStealImmune', value: 1 }],
  },
  amuletteMiroir: {
    name: 'Amulette du miroir', icon: '🪞', slot: 'feet', rarity: 'legendaire', price: 40, lootOnly: true,
    desc: "30 % de chance de RENVOYER un effet négatif (objet ou pouvoir) sur l'attaquant.",
    effects: [{ type: 'reflectChance', value: 30 }],
  },
  // Consommables offensifs (ciblent une équipe).
  fioleSangsue: {
    name: 'Fiole de sangsue', icon: '🩸', slot: 'consumable', rarity: 'rare', price: 16,
    desc: "Une équipe se fait voler 1D10 d'or à chacun de ses 3 prochains tours (à ton profit).",
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'buff', target: 'target', buff: { type: 'bleedGold', turns: 3, n: 'd10', mode: 'steal' } }] }],
  },
  sceauSilence: {
    name: 'Sceau de silence', icon: '🤐', slot: 'consumable', rarity: 'rare', price: 16,
    desc: "Bloque les POUVOIRS d'une équipe pendant 2 tours.",
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'blockPowers', target: 'target', turns: 2 }] }],
  },
  baillonOsier: {
    name: "Bâillon d'osier", icon: '🧺', slot: 'consumable', rarity: 'rare', price: 14,
    desc: "Bloque les CONSOMMABLES d'une équipe pendant 2 tours.",
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'blockConsumables', target: 'target', turns: 2 }] }],
  },
  // Consommable « pacte » : on renonce à ses pouvoirs, mais on gagne de l'or.
  pacteReclus: {
    name: 'Pacte du reclus', icon: '🧙', slot: 'consumable', rarity: 'rare', price: 18,
    desc: "Tu renonces à tes POUVOIRS pendant 3 tours, mais gagnes 40 pièces tout de suite.",
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'blockPowers', target: 'self', turns: 3 }, { action: 'money', mode: 'gain', target: 'self', n: 40, unit: 'flat' }] }],
  },

  // === EFFETS AVANCÉS — fournée 2 (équipements + consommables) ==============
  // -- Équipements passifs (renvoi / immunités, parfois combinés) --
  heaumeRenvoi: {
    name: 'Heaume du renvoi', icon: '⛑️', slot: 'head', rarity: 'rare', price: 26,
    desc: '20 % de chance de renvoyer un effet négatif sur l’attaquant.',
    effects: [{ type: 'reflectChance', value: 20 }],
  },
  capeReflet: {
    name: 'Cape de reflet', icon: '🌫️', slot: 'body', rarity: 'rare', price: 30,
    desc: '25 % de chance de renvoyer un effet négatif sur l’attaquant.',
    effects: [{ type: 'reflectChance', value: 25 }],
  },
  plastronGardien: {
    name: 'Plastron du gardien', icon: '🦺', slot: 'body', rarity: 'rare', price: 26,
    desc: 'Tes objets sont impossibles à voler.',
    effects: [{ type: 'itemStealImmune', value: 1 }],
  },
  diademeBanquier: {
    name: 'Diadème du banquier', icon: '👑', slot: 'head', rarity: 'legendaire', price: 48, lootOnly: true,
    desc: 'Ton or est impossible à voler, et +2 pièces par bonne réponse.',
    effects: [{ type: 'goldStealImmune', value: 1 }, { type: 'moneyPerCorrect', value: 2 }],
  },
  sandalesSpectre: {
    name: 'Sandales du spectre', icon: '👣', slot: 'feet', rarity: 'legendaire', price: 46, lootOnly: true,
    desc: 'Tes objets sont involables et ton recul subi est réduit d’1 case.',
    effects: [{ type: 'itemStealImmune', value: 1 }, { type: 'reculReduction', value: 1 }],
  },
  miroirArdent: {
    name: 'Miroir ardent', icon: '🔮', slot: 'head', rarity: 'legendaire', price: 50, lootOnly: true,
    desc: '40 % de chance de renvoyer un effet négatif sur l’attaquant.',
    effects: [{ type: 'reflectChance', value: 40 }],
  },

  // -- Consommables OFFENSIFS (ciblent une ou plusieurs équipes) --
  poisonLent: {
    name: 'Poison lent', icon: '🧫', slot: 'consumable', rarity: 'rare', price: 12,
    desc: 'Une équipe perd 1D6 d’or à chacun de ses 2 prochains tours (perte sèche).',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'buff', target: 'target', buff: { type: 'bleedGold', turns: 2, n: 'd6', mode: 'lose' } }] }],
  },
  voleurDeVoix: {
    name: 'Voleur de voix', icon: '🗣️', slot: 'consumable', rarity: 'rare', price: 16,
    desc: 'Bloque les POUVOIRS d’un adversaire au hasard pendant 2 tours.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'blockPowers', target: 'randomOpponent', turns: 2 }] }],
  },
  museliere: {
    name: 'Muselière', icon: '😶', slot: 'consumable', rarity: 'rare', price: 14,
    desc: 'Bloque les CONSOMMABLES d’un adversaire au hasard pendant 2 tours.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'blockConsumables', target: 'randomOpponent', turns: 2 }] }],
  },
  brouilleurRunique: {
    name: 'Brouilleur runique', icon: '📡', slot: 'consumable', rarity: 'legendaire', price: 30, lootOnly: true,
    desc: 'Bloque les POUVOIRS de TOUTES les autres équipes pendant 1 tour.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'blockPowers', target: 'allOthers', turns: 1 }] }],
  },

  // -- Consommables DÉFENSIFS (buff temporaire sur soi) --
  potionMiroir: {
    name: 'Potion de miroir', icon: '🪩', slot: 'consumable', rarity: 'rare', price: 16,
    desc: '50 % de chance de renvoyer un effet négatif, pendant 2 tours.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'buff', target: 'self', buff: { type: 'reflectChance', turns: 2, n: 50 } }] }],
  },
  fioleInsaisissable: {
    name: 'Fiole d’insaisissable', icon: '💨', slot: 'consumable', rarity: 'commun', price: 8,
    desc: 'Tes objets sont involables pendant 3 tours.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'buff', target: 'self', buff: { type: 'itemStealImmune', turns: 3 } }] }],
  },
  elixirCoffreFort: {
    name: 'Élixir du coffre-fort', icon: '🪙', slot: 'consumable', rarity: 'commun', price: 8,
    desc: 'Ton or est involable pendant 3 tours.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'buff', target: 'self', buff: { type: 'goldStealImmune', turns: 3 } }] }],
  },

  // -- Consommable « tradeoff » : malus sur soi compensé par de l'or --
  voeuSilence: {
    name: 'Vœu de silence', icon: '🤫', slot: 'consumable', rarity: 'rare', price: 16,
    desc: 'Tu renonces à tes CONSOMMABLES pendant 3 tours, mais gagnes 35 pièces tout de suite.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'blockConsumables', target: 'self', turns: 3 }, { action: 'money', mode: 'gain', target: 'self', n: 35, unit: 'flat' }] }],
  },

  // === Objets d'exemple des effets 2026-07-10 (épines, garde-série, seconde
  // chance, échange de place, vol d'objet, thème aléatoire) ===
  carapaceEpines: {
    name: "Carapace d'épines", name_en: 'Thornmail', icon: '🌵', slot: 'body', rarity: 'rare', price: 24,
    desc: "Quand on te fait reculer ou qu'on te vole de l'or, l'attaquant en subit 40 % en retour.",
    effects: [{ type: 'thorns', value: 40 }],
  },
  braseroConstance: {
    name: 'Brasero de constance', name_en: 'Ember of Constancy', icon: '🔥', slot: 'feet', rarity: 'rare', price: 22,
    desc: 'Ta série de bonnes réponses ne casse plus en cas d’erreur.',
    effects: [{ type: 'streakGuard', value: 1 }],
  },
  secondSouffle: {
    name: 'Second souffle', name_en: 'Second Wind', icon: '🔁', slot: 'consumable', rarity: 'rare', price: 15,
    desc: 'Pendant 2 tours, ta première mauvaise réponse peut être rejouée une fois.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'buff', target: 'self', buff: { type: 'secondChance', turns: 2 } }] }],
  },
  permutateur: {
    name: 'Permutateur', name_en: 'Swapper', icon: '🔀', slot: 'consumable', rarity: 'rare', price: 18,
    desc: 'Échange ta place avec une équipe de ton choix.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'swapPositions', target: 'target' }] }],
  },
  mainLeste: {
    name: 'Main leste', name_en: 'Nimble Hand', icon: '🕵️', slot: 'consumable', rarity: 'rare', price: 16,
    desc: 'Vole un objet au hasard à une équipe (sinon 10 or).',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'stealItem', target: 'target', category: '', fallbackGold: 10 }] }],
  },
  deDuDestin: {
    name: 'Dé du destin', name_en: 'Die of Fate', icon: '🎲', slot: 'consumable', rarity: 'commun', price: 10,
    desc: 'Deux thèmes tirés au sort : choisis celui de ta prochaine question.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'forceSubject', target: 'self', subject: { random: true, choices: 2 } }] }],
  },

  // === Objets d'exemple des effets 2026-07-11 (sabotage, ancre, assurance,
  // dé chanceux, intérêts, dîme, vol de charge, prime, investissement, checkpoint) ===
  gantDuVoleur: {
    name: 'Gant du voleur', name_en: "Thief's Glove", icon: '⚡', slot: 'consumable', rarity: 'rare', price: 16,
    desc: 'Vole une charge de pouvoir à une équipe.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'stealCharge', target: 'target' }] }],
  },
  avisDeRecherche: {
    name: 'Avis de recherche', name_en: 'Wanted Poster', icon: '🎯', slot: 'consumable', rarity: 'commun', price: 10,
    desc: 'Pose une prime : la prochaine erreur de la cible te rapporte 15 or.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'bounty', target: 'target', n: 15 }] }],
  },
  ticketDeBourse: {
    name: 'Ticket de bourse', name_en: 'Stock Ticket', icon: '📈', slot: 'consumable', rarity: 'commun', price: 8,
    desc: 'Investis l’or de ton choix : remboursé à 200 % à ta prochaine bonne réponse (perdu sinon).',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'invest', rate: 200 }] }],
  },
  baliseRetour: {
    name: 'Balise de retour', name_en: 'Return Beacon', icon: '🚩', slot: 'consumable', rarity: 'rare', price: 14,
    desc: 'Point de contrôle : à ton tour, clique dessus pour t’y téléporter (50 % de le consommer).',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'setCheckpoint', consumeChance: 50 }] }],
  },
  deTruque: {
    name: 'Dé truqué', name_en: 'Loaded Die', icon: '🎲', slot: 'consumable', rarity: 'commun', price: 9,
    desc: 'Sabote le dé d’une équipe : −2 pendant 2 tours.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'buff', target: 'target', buff: { type: 'diceMalus', turns: 2, n: 2 } }] }],
  },
  grappinDAncrage: {
    name: "Grappin d'ancrage", name_en: 'Anchor Hook', icon: '⚓', slot: 'consumable', rarity: 'rare', price: 15,
    desc: 'Ancre : immunisé au déplacement forcé pendant 2 tours.',
    effects: [{ kind: 'trigger', on: 'use', do: [{ action: 'buff', target: 'self', buff: { type: 'anchor', turns: 2 } }] }],
  },
  treflefetiche: {
    name: 'Trèfle fétiche', name_en: 'Lucky Clover', icon: '🍀', slot: 'feet', rarity: 'rare', price: 22,
    desc: 'Dé chanceux : ton dé fait toujours au moins 2.',
    effects: [{ type: 'minRoll', value: 2 }],
  },
  policeAssurance: {
    name: "Police d'assurance", name_en: 'Insurance Policy', icon: '🛟', slot: 'body', rarity: 'rare', price: 24,
    desc: "Assurance : récupère 40 % de l'or qu'on te vole ou te fait perdre.",
    effects: [{ type: 'insurance', value: 40 }],
  },
  livretEpargne: {
    name: "Livret d'épargne", name_en: 'Savings Book', icon: '💹', slot: 'head', rarity: 'rare', price: 26,
    desc: '+8 % de ton or à chaque début de tour (intérêts).',
    effects: [{ type: 'interest', value: 8 }],
  },
  sceauDeLaDime: {
    name: 'Sceau de la dîme', name_en: 'Tithe Seal', icon: '⛪', slot: 'body', rarity: 'rare', price: 24,
    desc: "Dîme : prélève 15 % de l'or gagné par les adversaires à chaque bonne réponse.",
    effects: [{ type: 'tithe', value: 15 }],
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
