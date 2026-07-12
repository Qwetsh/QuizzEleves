// Événements INTÉGRÉS (codés). Les événements PERSONNALISÉS (éditeur, table
// Supabase quete_events) sont fusionnés par-dessus via setCustomEvents.
const BUILTIN_EVENTS = {
  rejouer:      { name: 'Relance orbitale',           name_en: 'Replay',            icon: '\u{1F3B2}', desc: 'Lance le de et avance du resultat.',                                             desc_en: 'Roll the die and move forward by the result.', optional: false, weight: 1 },
  recul:        { name: 'Poussée inverse',       name_en: 'Forced setback',    icon: '\u2B05\uFE0F', desc: 'Recule de 2 cases.',                                                         desc_en: 'Move back 2 squares.', optional: false, weight: 1 },
  decharge:     { name: 'Surcharge ionique', name_en: 'Electric shock',  icon: '\u26A1',   desc: 'Choisis une equipe et lance le de : elle recule du resultat.',                  desc_en: 'Choose a team and roll the die: it moves back by the result.', optional: true,  weight: 1 },
  sacrifice:    { name: 'Manœuvre risquée',         name_en: 'Sacrifice',         icon: '\u{1F91D}',  desc: 'Tu recules de 2 cases pour faire reculer un adversaire de 4 cases.',            desc_en: 'You move back 2 squares to push an opponent back 4 squares.', optional: true,  weight: 1 },
  duel:         { name: 'Duel de transmission',     name_en: 'Question duel',     icon: '\u2694\uFE0F', desc: 'Choisis une equipe. Elle repond a une question. Reussi = TU recules de 2. Rate = ELLE recule de 2.', desc_en: 'Choose a team. It answers a question. Right = YOU move back 2. Wrong = THEY move back 2.', optional: true, weight: 1 },
  coupDePouce:  { name: 'Propulseur de secours',     name_en: 'Helping hand',      icon: '\u{1F680}',  desc: 'Avance gratuitement de 3 cases.',                                              desc_en: 'Move forward 3 squares for free.', optional: false, weight: 1 },
  teleport:     { name: 'Saut hyperspatial',       name_en: 'Teleporter',        icon: '\u23E9',     desc: 'Avance jusqu\'a la prochaine jonction.',                                        desc_en: 'Move forward to the next junction.', optional: false, weight: 1 },
  don:          { name: 'Poussée offerte',      name_en: 'Gift of squares',   icon: '\u{1F381}',  desc: 'Choisis un adversaire qui avance de 3 cases.',                                  desc_en: 'Choose an opponent who moves forward 3 squares.', optional: false, weight: 1 },
  oubli:        { name: 'Trou noir de l\'oubli',  name_en: 'Pit of oblivion',   icon: '\u{1F573}\uFE0F', desc: 'Retour au DEPART.',                                                       desc_en: 'Back to the START.', optional: false, weight: 0.25 },
  embuscade:    { name: 'Interception pirate',         name_en: 'Ambush',            icon: '\u21AA\uFE0F', desc: 'Recule jusqu\'a la derniere jonction passee.',                                desc_en: 'Move back to the last junction you passed.', optional: false, weight: 1 },
  quitteDouble: { name: 'Orbite ou chute',  name_en: 'Double or nothing', icon: '\u{1F3B0}',  desc: 'Lance le de. 4-6 : avance du DOUBLE de ton lancer d\'arrivee. 1-3 : recule de ton lancer d\'arrivee.', desc_en: 'Roll the die. 4-6: move forward DOUBLE your arrival roll. 1-3: move back your arrival roll.', optional: true,  weight: 1 },
  pari:         { name: 'Pari orbital',              name_en: 'Wager',             icon: '\u{1F4B0}',  desc: 'Reponds a une question. Reussi : +3 cases. Rate : -3 cases.',                   desc_en: 'Answer a question. Right: +3 squares. Wrong: -3 squares.', optional: true,  weight: 1 },
  recharge:     { name: 'Recharge de noyau',          name_en: 'Recharge',          icon: '\u{1F50B}',  desc: 'Gagne 1 charge du pouvoir de ton choix (parmi tes pouvoirs).',                  desc_en: 'Gain 1 charge for the power of your choice (among your powers).', optional: false, weight: 1 },
  vol:          { name: 'Siphon d\'énergie',               name_en: 'Theft',             icon: '\u{1FA99}',  desc: 'Choisis un adversaire : vole 1 charge d\'un de ses pouvoirs pour recharger un des tiens.', desc_en: 'Choose an opponent: steal 1 charge from one of their powers to recharge one of yours.', optional: true,  weight: 1 },
  tempete:      { name: 'Tempête cosmique',           name_en: 'Storm',             icon: '\u{1F32A}\uFE0F', desc: 'Lance le de : TOUTES les equipes reculent du resultat.',                  desc_en: 'Roll the die: ALL teams move back by the result.', optional: false, weight: 1 },
  echange:      { name: 'Permutation quantique',           name_en: 'Swap',              icon: '\u{1F500}',  desc: 'Choisis un adversaire et echange ta position avec lui.',                        desc_en: 'Choose an opponent and swap your position with them.', optional: true,  weight: 1 },
  bonus:        { name: 'Défi cosmique',    name_en: 'Bonus question',    icon: '\u{1F3AF}',  desc: 'Reponds a une question. Reussi : +3 cases. Rate : rien.',                       desc_en: 'Answer a question. Right: +3 squares. Wrong: nothing.', optional: true,  weight: 1 },
  tresor:        { name: 'Cache d\'astéroïde',      name_en: 'Hidden treasure',  icon: '\u{1F4B0}',  desc: 'Tu decouvres un coffre rempli de pieces !',                                       desc_en: 'You discover a chest full of coins!', effect: 'tresor',      category: 'money' },
  impot:         { name: 'Tribut impérial',       name_en: 'Royal tax',        icon: '\u{1F451}',  desc: 'Le roi exige un impot ! Tu perds 30% de tes pieces.',                              desc_en: 'The king demands a tax! You lose 30% of your coins.', effect: 'impot',       category: 'money' },
  marcheNoir:    { name: 'Marché orbital clandestin',       name_en: 'Black market',     icon: '\u{1F56F}️',  desc: 'Des etals clandestins ouvrent dans la ruelle : objets rares a prix casses (-30%) !', desc_en: 'Clandestine stalls open in the alley: rare items at slashed prices (-30%)!', effect: 'marcheNoir',  needsChoice: true, category: 'money', needsItems: true },
  volArgent:     { name: 'Piratage de crédits',     name_en: 'Coin theft',       icon: '\u{1F977}',  desc: 'Tu voles 10 pieces a une equipe de ton choix !',                                    desc_en: 'You steal 10 coins from a team of your choice!', effect: 'vol',         needsTarget: true, category: 'money' },
  taxeCommune:   { name: 'Taxe galactique',      name_en: 'Common tax',       icon: '\u{1F3E6}',  desc: 'Une taxe frappe tout le monde ! Chaque equipe perd 5 pieces.',                      desc_en: 'A tax hits everyone! Each team loses 5 coins.', effect: 'taxeCommune', category: 'money' },
  jackpot:       { name: 'Pactole stellaire',           name_en: 'Jackpot',          icon: '\u{1F3C6}',  desc: 'Question bonus ! Bonne reponse = 30 pieces, mauvaise = -10.',                       desc_en: 'Bonus question! Right answer = 30 coins, wrong = -10.', effect: 'jackpot',     needsQuestion: true, category: 'money' },
  banquier:      { name: 'Banque stellaire',          name_en: 'Banker',           icon: '\u{1F3E6}',  desc: 'Le banquier te recompense : +3 pieces par bonne reponse accumulee !',               desc_en: 'The banker rewards you: +3 coins per accumulated correct answer!', effect: 'banquier',    category: 'money' },
  coffre:           { name: 'Capsule au trésor',  name_en: 'Treasure chest',     icon: '\u{1F9F0}', desc: 'Tu decouvres un coffre mysterieux... Il contient un objet !',                      desc_en: 'You discover a mysterious chest... It contains an item!', effect: 'coffre',      category: 'item', optional: false, weight: 1, needsItems: true },
  marchandAmbulant: { name: 'Marchand interstellaire', name_en: 'Travelling merchant', icon: '\u{1F9D9}', desc: 'Un marchand ambulant te propose ses objets a -30% ! Il a parfois des objets legendaires...', desc_en: 'A travelling merchant offers his items at -30%! He sometimes has legendary items...', effect: 'marchandAmbulant', needsChoice: true, category: 'item', optional: true, weight: 1, needsItems: true },
  pillage:          { name: 'Raid de cargo',           name_en: 'Pillage',            icon: '\u{1F3F4}‍☠️', desc: 'Choisis une equipe et vole-lui UN objet (equipement ou consommable) !',     desc_en: 'Choose a team and steal ONE item from it (equipment or consumable)!', effect: 'pillage',     needsTarget: true, category: 'item', optional: true, weight: 0.5, needsItems: true },
  troisCoffres:     { name: 'Les trois capsules', name_en: 'The three chests',   icon: '\u{1F48E}', desc: 'Trois coffres s\'offrent a toi. Choisis-en UN seul... ton choix est definitif !', desc_en: 'Three chests are offered to you. Choose only ONE... your choice is final!', effect: 'troisCoffres', needsChoice: true, category: 'item', optional: false, weight: 0.7, needsItems: true },
  pickpocket:       { name: 'Larcin orbital',      name_en: 'Pickpocket!',        icon: '\u{1F99D}', desc: 'Un voleur a fouille tes affaires... tu perds un objet au hasard !',           desc_en: 'A thief has rummaged through your belongings... you lose a random item!', effect: 'pickpocket',  category: 'item', optional: false, weight: 0.6, needsItems: true },

  // --- Événements « scriptés » : portent une liste d'ACTIONS du moteur d'effets ---
  benediction:      { name: 'Aura solaire',       name_en: 'Blessing',           icon: '✨',    desc: 'Une aura te porte : pendant 2 tours, chaque bonne reponse te fait AVANCER d\'une case !', desc_en: 'An aura lifts you: for 2 turns, each correct answer moves you FORWARD one square!', category: 'item', optional: false, weight: 0.7,
    actions: [{ action: 'buff', target: 'self', buff: { type: 'advanceOnCorrect', turns: 2, n: 1 } }] },
  malediction:      { name: 'Anomalie maudite',       name_en: 'Curse',              icon: '\u{1F480}', desc: 'Un mauvais sort te frappe : pendant 3 tours, chaque erreur te coute 5 pieces !', desc_en: 'A dark spell strikes you: for 3 turns, each mistake costs you 5 coins!', category: 'money', optional: false, weight: 0.5,
    actions: [{ action: 'buff', target: 'self', buff: { type: 'loseOnWrong', turns: 3, n: 5 } }] },
  boussoleCassee:   { name: 'Navigation brouillée',   name_en: 'Broken compass',     icon: '\u{1F9ED}', desc: 'Ta boussole s\'affole : ta PROCHAINE voie a un carrefour sera choisie au hasard !', desc_en: 'Your compass goes haywire: your NEXT path at a crossroads will be chosen at random!', category: 'item', optional: false, weight: 0.6,
    actions: [{ action: 'randomPathNext', target: 'self' }] },
  tempeteMagnetique:{ name: 'Orage magnétique', name_en: 'Magnetic storm',     icon: '\u{1F9F2}', desc: 'Un champ magnetique brouille tout : la prochaine voie de CHAQUE equipe sera aleatoire !', desc_en: 'A magnetic field scrambles everything: EACH team\'s next path will be random!', category: 'item', optional: false, weight: 0.45,
    actions: [{ action: 'randomPathNext', target: 'all' }] },

  // --- « Hacking » : UNIQUEMENT en mode téléphone (équipes créées au tél.) ---
  // Pirate l'application : le PROCHAIN tour de l'équipe est perdu sous une
  // cinématique « app piratée ». Gating `requiresPhone` (eventPicker).
  hacking:          { name: 'Intrusion système',           name_en: 'Hacking',            icon: '\u{1F480}', desc: 'Le boss pirate ton application ! Ton prochain tour, l\'écran passe sous son contrôle… et l\'app devient inutilisable jusqu\'à la fin de ce tour.', desc_en: 'The boss hacks your app! On your next turn, the screen falls under his control… and the app becomes unusable until the end of that turn.', category: 'item', optional: false, weight: 0.7, requiresPhone: true,
    actions: [{ action: 'hackApp', target: 'self', turns: 1, by: 'boss' }] },

  // --- Boss : combat contre le professeur (choix du mini-jeu) ---
  // `requiresSchool` : ne se déclenche que si au moins une matière SCOLAIRE est
  // présente sur le plateau (le « Prof » n'a pas de sens dans une partie 100 %
  // ludique). Gating dans eventPicker (opt `schoolSubject`). Affiché à part au Setup.
  bossProf:         { name: 'Boss : le Prof',     name_en: 'Boss: the Teacher',  icon: '\u{1F468}‍\u{1F3EB}', desc: 'Le professeur te barre la route ! Choisis ton mini-jeu et affronte-le. Victoire : +50 pieces et un objet. Defaite : recul d\'1D10 !', desc_en: 'The teacher blocks your way! Choose your mini-game and face him. Victory: +50 coins and an item. Defeat: move back 1D10!', category: 'item', optional: true, weight: 0.3, needsChoice: true, requiresSchool: true },

  // --- Pari d'argent / question a enjeu ---
  vaTout:           { name: 'Va-tout stellaire',         name_en: 'All-In',             icon: '\u{1F3B0}', desc: 'Empile les pieces : chaque bonne reponse rapporte de plus en plus (+5, +10, +15...). Encaisse quand tu veux ! Mais une seule erreur et tu perds toute ta mise + recul d\'1D10.', desc_en: 'Stack up coins: each correct answer pays more and more (+5, +10, +15...). Cash out whenever you want! But a single mistake and you lose your whole stake + move back 1D10.', category: 'money', optional: true, weight: 0.7 },
  loterie:          { name: 'Loterie cosmique',           name_en: 'Lottery',            icon: '\u{1F39F}️', desc: 'Tente ta chance : 50% de remporter 40 pieces, sinon tu perds 15 pieces.', desc_en: 'Try your luck: 50% chance to win 40 coins, otherwise you lose 15 coins.', category: 'money', optional: true, weight: 0.7 },
  sphinx:           { name: 'Oracle galactique',         name_en: 'The Sphinx',         icon: '\u{1F5FF}', desc: 'Le Sphinx te pose une question HARDCORE. Juste : +50 pieces. Faux : -20 pieces.', desc_en: 'The Sphinx asks you a HARDCORE question. Right: +50 coins. Wrong: -20 coins.', subject: 'hardcore', category: 'money', optional: true, weight: 0.45 },

  // --- Objets : troc, forge, relique, tournoi ---
  poseurPiege:      { name: 'Poseur de mines orbitales',  name_en: 'Trap setter',        icon: '🪤', desc: 'Place un piege sur une case de ton choix : qui marche dessus recule de 2 cases !', desc_en: 'Place a trap on a square of your choice: whoever steps on it moves back 2 squares!', category: 'item', optional: false, weight: 0.6,
    actions: [{ action: 'placeTrap', trap: { label: 'Piege', icon: '🪤', do: [{ action: 'move', target: 'self', dir: 'back', n: 2 }] } }] },
  troc:             { name: 'Troc quantique',    name_en: 'Trade of fate',      icon: '\u{1F504}', desc: 'Sacrifie un de tes objets... pour en recevoir un autre au hasard. Meilleur ou pire ?', desc_en: 'Sacrifice one of your items... to receive another at random. Better or worse?', needsChoice: true, category: 'item', optional: true, weight: 0.6, needsItems: true },
  forge:            { name: 'Atelier orbital',          name_en: 'The Forge',          icon: '🔨', desc: 'Fais fondre 2 consommables pour forger 1 EQUIPEMENT aleatoire !', desc_en: 'Melt down 2 consumables to forge 1 random piece of EQUIPMENT!', category: 'item', optional: true, weight: 0.5, needsItems: true },
  reliquaire:       { name: 'Relique stellaire',     name_en: 'The Reliquary',      icon: '🏺', desc: 'Une relique t\'attire : recois une piece d\'un SET que tu as deja commence !', desc_en: 'A relic draws you in: receive a piece from a SET you have already started!', category: 'item', optional: false, weight: 0.45, needsItems: true },
  tournoi:          { name: 'Tournoi photonique',    name_en: 'Lightning tournament', icon: '🏅', desc: 'Reponds vite ! Bonne reponse : tu remportes un consommable. Mauvaise : un adversaire le rafle !', desc_en: 'Answer fast! Right answer: you win a consumable. Wrong: an opponent snatches it!', needsQuestion: true, category: 'item', optional: true, weight: 0.5, needsItems: true },

  // --- ALCHIMIE (extension `alchemy`) : ingrédients, recettes, chaudron ---
  herboriste:       { name: 'Botaniste spatial',     name_en: 'The Herbalist',      icon: '🌿', desc: 'Une herboriste partage sa récolte : tu reçois 2 ingrédients d\'alchimie !', desc_en: 'An herbalist shares her harvest: you receive 2 alchemy ingredients!', category: 'item', optional: false, weight: 0.7, requires: ['alchemy'],
    actions: [{ action: 'grantIngredient', target: 'self', n: 2 }] },
  chaudronAbandonne:{ name: 'Réacteur abandonné', name_en: 'The Abandoned Cauldron', icon: '⚗️', desc: 'Près d\'un chaudron oublié traînent 3 ingrédients : de quoi distiller une potion !', desc_en: 'By a forgotten cauldron lie 3 ingredients: enough to distill a potion!', category: 'item', optional: false, weight: 0.5, requires: ['alchemy'],
    actions: [{ action: 'grantIngredient', target: 'self', n: 3 }] },
  pluieEssences:    { name: 'Pluie d\'essences stellaires', name_en: 'Rain of Essences',   icon: '🌧️', desc: 'Une pluie magique tombe : CHAQUE équipe reçoit un ingrédient !', desc_en: 'A magical rain falls: EACH team receives an ingredient!', category: 'item', optional: false, weight: 0.5, requires: ['alchemy'],
    actions: [{ action: 'grantIngredient', target: 'all', n: 1 }] },
  eureka:           { name: 'Signal Eurêka !',          name_en: 'Eureka!',            icon: '📖', desc: 'Un grimoire poussiéreux te révèle une nouvelle recette de potion !', desc_en: 'A dusty grimoire reveals a new potion recipe to you!', category: 'item', optional: false, weight: 0.45, requires: ['alchemy'],
    actions: [{ action: 'discoverRecipe', target: 'self' }] },
  explosionChaudron:{ name: 'Explosion du synthétiseur', name_en: 'Cauldron Blast', icon: '💥', desc: 'Boum ! Une mauvaise manipulation fait partir un de tes ingrédients en fumée.', desc_en: 'Boom! A clumsy move sends one of your ingredients up in smoke.', category: 'item', optional: false, weight: 0.4, requires: ['alchemy'],
    actions: [{ action: 'loseItem', target: 'self', category: 'consumable', family: 'ingredient', fallbackGold: 0 }] },

  // --- ENCHANTEMENT (extension `enchant`) : parchemins, runes, scribe ---
  scribeAmbulant:   { name: 'Archiviste itinérant', name_en: 'The Wandering Scribe', icon: '✒️', desc: 'Un scribe te confie un parchemin vierge : grave-le à l\'Autel du Scribe !', desc_en: 'A scribe hands you a blank scroll: inscribe it at the Scribe\'s Altar!', category: 'item', optional: false, weight: 0.6, requires: ['enchant'],
    actions: [{ action: 'grantItem', target: 'self', key: 'parcheminVierge' }] },
  runeMysterieuse:  { name: 'Glyphe astral',  name_en: 'Mysterious Rune',    icon: '🔮', desc: 'Une rune ancienne s\'illumine et enchante GRATUITEMENT une de tes pièces équipées !', desc_en: 'An ancient rune lights up and enchants one of your equipped pieces FOR FREE!', category: 'item', optional: false, weight: 0.5, requires: ['enchant'],
    actions: [{ action: 'enchantEquipped', target: 'self' }] },
  subventionScribe: { name: 'Bourse de l\'Archiviste', name_en: 'Scribe\'s Grant',  icon: '🪙', desc: 'La guilde des scribes finance ta prochaine gravure : +25 pièces !', desc_en: 'The scribes\' guild funds your next inscription: +25 coins!', category: 'money', optional: false, weight: 0.6, requires: ['enchant'],
    actions: [{ action: 'money', mode: 'gain', target: 'self', n: 25, unit: 'flat' }] },
  encreRunique:     { name: 'Encre cosmique',     name_en: 'Runic Ink',          icon: '🖋️', desc: 'Des runes scintillent sur toi : pendant 2 tours, +5 pièces à chaque bonne réponse !', desc_en: 'Runes shimmer over you: for 2 turns, +5 coins on each correct answer!', category: 'money', optional: false, weight: 0.5, requires: ['enchant'],
    actions: [{ action: 'buff', target: 'self', buff: { type: 'themeBonus', turns: 2, n: 5 } }] },
  effacement:       { name: 'Effacement astral',        name_en: 'Erasure',            icon: '🧽', desc: 'L\'encre pâlit : un enchantement de l\'une de tes pièces s\'efface…', desc_en: 'The ink fades: an enchantment on one of your pieces is erased…', category: 'item', optional: false, weight: 0.4, requires: ['enchant'],
    actions: [{ action: 'unenchant', target: 'self' }] },
};

// --- Classement « ton » des événements (affichage groupé du Setup) ---------
// Purement COSMÉTIQUE : le tirage (eventPicker) n'en dépend pas. Trois groupes :
//   • positive : bénéfique OU offensif pour l'équipe active (viser un adversaire =
//     avantage pour toi → compté ici) ;
//   • negative : néfaste pour l'équipe active (recul, perte, aide un adversaire) ;
//   • gamble   : issue incertaine avec un vrai risque (question à enjeu, pari, RNG).
// `bossProf` est volontairement ABSENT (section dédiée au Setup, cf. requiresSchool).
// Un événement personnalisé (non listé) retombe dans le groupe « autres ».
export const EVENT_TONE = {
  // Positifs / offensifs
  rejouer: 'positive', decharge: 'positive', sacrifice: 'positive', coupDePouce: 'positive',
  teleport: 'positive', recharge: 'positive', vol: 'positive', echange: 'positive',
  bonus: 'positive', tresor: 'positive', marcheNoir: 'positive', volArgent: 'positive',
  banquier: 'positive', coffre: 'positive', marchandAmbulant: 'positive', pillage: 'positive',
  troisCoffres: 'positive', benediction: 'positive', poseurPiege: 'positive', forge: 'positive',
  reliquaire: 'positive', herboriste: 'positive', chaudronAbandonne: 'positive',
  pluieEssences: 'positive', eureka: 'positive', scribeAmbulant: 'positive',
  runeMysterieuse: 'positive', subventionScribe: 'positive', encreRunique: 'positive',
  // Négatifs
  recul: 'negative', don: 'negative', oubli: 'negative', embuscade: 'negative',
  tempete: 'negative', impot: 'negative', taxeCommune: 'negative', pickpocket: 'negative',
  malediction: 'negative', boussoleCassee: 'negative', tempeteMagnetique: 'negative',
  hacking: 'negative', explosionChaudron: 'negative', effacement: 'negative',
  // Paris & hasard
  duel: 'gamble', quitteDouble: 'gamble', pari: 'gamble', jackpot: 'gamble',
  vaTout: 'gamble', loterie: 'gamble', sphinx: 'gamble', troc: 'gamble', tournoi: 'gamble',
};

// Ton d'un événement (par clé), avec repli. bossProf → 'boss' (section à part).
// Un override (custom OU intégré modifié) peut porter son propre `tone` qui prime.
export function eventTone(key) {
  if (key === 'bossProf') return 'boss';
  const ev = EVENTS[key];
  if (ev && ev.tone) return ev.tone;
  return EVENT_TONE[key] || 'other';
}

// --- Valeurs chiffrées éditables (événements « paramétrables », niveau T2) -----
// Chaque événement dont l'effet est codé en dur MAIS repose sur des nombres
// (recul, gains/pertes d'or, %, seuils) expose ici son schéma. L'éditeur génère un
// champ par entrée ; le moteur (eventHandlers/fightHandlers) lit
// `event.params?.X ?? défaut`. Les défauts ci-dessous sont injectés sur les
// BUILTIN_EVENTS (source unique de vérité — pas de nombre magique dupliqué).
export const EVENT_PARAMS_SCHEMA = {
  recul:            [{ key: 'back', label: 'Recul (cases)', min: 0, max: 30, def: 2 }],
  coupDePouce:      [{ key: 'forward', label: 'Avance (cases)', min: 1, max: 30, def: 3 }],
  oubli:            [{ key: 'grappleBack', label: 'Recul si équipement anti-oubli', min: 0, max: 30, def: 3 }],
  quitteDouble:     [{ key: 'winThreshold', label: 'Dé ≥ pour gagner', min: 1, max: 6, def: 4 },
                     { key: 'winMult', label: 'Multiplicateur du gain', min: 1, max: 10, def: 2 }],
  don:              [{ key: 'forward', label: 'Avance de l’adversaire', min: 1, max: 30, def: 3 }],
  sacrifice:        [{ key: 'selfBack', label: 'Mon recul', min: 0, max: 30, def: 2 },
                     { key: 'targetBack', label: 'Recul de la cible', min: 0, max: 30, def: 4 }],
  duel:             [{ key: 'winSelfBack', label: 'Mon recul si la cible réussit', min: 0, max: 30, def: 2 },
                     { key: 'loseTargetBack', label: 'Recul de la cible si elle rate', min: 0, max: 30, def: 2 }],
  pari:             [{ key: 'winForward', label: 'Avance si juste', min: 0, max: 30, def: 3 },
                     { key: 'loseBack', label: 'Recul si faux', min: 0, max: 30, def: 3 }],
  bonus:            [{ key: 'winForward', label: 'Avance si juste', min: 0, max: 30, def: 3 }],
  jackpot:          [{ key: 'win', label: 'Gain si juste (or)', min: 0, max: 999, def: 30 },
                     { key: 'lose', label: 'Perte si faux (or)', min: 0, max: 999, def: 10 }],
  sphinx:           [{ key: 'win', label: 'Gain si juste (or)', min: 0, max: 999, def: 50 },
                     { key: 'lose', label: 'Perte si faux (or)', min: 0, max: 999, def: 20 }],
  vaTout:           [{ key: 'step', label: 'Palier de gain (or)', min: 1, max: 999, def: 5 },
                     { key: 'failDie', label: 'Dé de recul si raté (1DN)', min: 1, max: 100, def: 10 }],
  tresor:           [{ key: 'min', label: 'Or minimum', min: 0, max: 999, def: 15 },
                     { key: 'max', label: 'Or maximum', min: 0, max: 999, def: 25 }],
  impot:            [{ key: 'percent', label: '% d’or prélevé', min: 0, max: 100, def: 30 }],
  volArgent:        [{ key: 'amount', label: 'Or volé (max)', min: 0, max: 999, def: 10 }],
  taxeCommune:      [{ key: 'amount', label: 'Or prélevé par équipe', min: 0, max: 999, def: 5 }],
  banquier:         [{ key: 'perCorrect', label: 'Or par bonne réponse accumulée', min: 0, max: 99, def: 3 }],
  loterie:          [{ key: 'chancePct', label: '% de chance de gagner', min: 0, max: 100, def: 50 },
                     { key: 'win', label: 'Gain si gagné (or)', min: 0, max: 999, def: 40 },
                     { key: 'lose', label: 'Perte si perdu (or)', min: 0, max: 999, def: 15 }],
  marchandAmbulant: [{ key: 'discountPct', label: 'Remise (%)', min: 0, max: 90, def: 30 },
                     { key: 'count', label: 'Objets proposés', min: 1, max: 8, def: 3 }],
  marcheNoir:       [{ key: 'discountPct', label: 'Remise (%)', min: 0, max: 90, def: 30 },
                     { key: 'count', label: 'Objets en vitrine', min: 1, max: 12, def: 5 }],
  troisCoffres:     [{ key: 'count', label: 'Coffres proposés', min: 2, max: 5, def: 3 }],
  forge:            [{ key: 'burnCount', label: 'Consommables à fondre', min: 1, max: 9, def: 2 }],
  bossProf:         [{ key: 'rewardGold', label: 'Or si victoire', min: 0, max: 999, def: 50 },
                     { key: 'defeatDie', label: 'Dé de recul si défaite (1DN)', min: 1, max: 100, def: 10 }],
};

// Défauts d'un événement paramétrable (objet { clé: valeur }) ou undefined.
export function defaultEventParams(key) {
  const schema = EVENT_PARAMS_SCHEMA[key];
  if (!schema) return undefined;
  const p = {};
  for (const f of schema) p[f.key] = f.def;
  return p;
}
// Injecte les défauts sur les intégrés (avant construction d'EVENTS) : le schéma
// reste la seule source des nombres, les handlers font `params?.X ?? def`.
for (const k of Object.keys(EVENT_PARAMS_SCHEMA)) {
  if (BUILTIN_EVENTS[k]) BUILTIN_EVENTS[k].params = defaultEventParams(k);
}

// Niveau d'édition d'un événement (pour l'éditeur) :
//   scripted   → piloté par une liste `actions` (entièrement éditable) ;
//   params     → effet codé mais valeurs chiffrées éditables (EVENT_PARAMS_SCHEMA) ;
//   structural → effet codé non chiffrable (métadonnées seules, verrouillé) ;
//   custom     → événement personnalisé (hors catalogue intégré).
export function eventEditability(key) {
  const ev = BUILTIN_EVENTS[key];
  if (!ev) return 'custom';
  if (Array.isArray(ev.actions) && ev.actions.length) return 'scripted';
  if (EVENT_PARAMS_SCHEMA[key]) return 'params';
  return 'structural';
}

// EVENTS = base + personnalisés. `let` + export → liaison vivante : les modules
// qui lisent EVENTS au moment de l'appel (eventPicker, eventHandlers) voient les
// événements custom dès que setCustomEvents est appelé (boot / éditeur).
export let EVENTS = { ...BUILTIN_EVENTS };

export { BUILTIN_EVENTS };

// Champs qu'un OVERRIDE d'événement intégré peut écraser en toute sécurité. Les
// champs de gating/comportement (effect, needs*, requires*, requiresPhone,
// requiresSchool) ne sont JAMAIS touchés : ils restent pilotés par le code.
const OVERRIDE_FIELDS = ['name', 'name_en', 'icon', 'desc', 'desc_en', 'optional', 'weight', 'category', 'tone'];

// Fusionne les événements personnalisés/overrides par-dessus les intégrés.
//   • clé NOUVELLE  → événement personnalisé complet (comportement historique) ;
//   • clé INTÉGRÉE  → override PARTIEL : seuls les champs éditables sont appliqués,
//     `params` est fusionné en profondeur par-dessus les défauts codés, et
//     `actions` n'est repris QUE pour un événement scripté (jamais détourner un
//     flux codé T2/T3 via une liste d'actions injectée).
export function setCustomEvents(custom) {
  const next = { ...BUILTIN_EVENTS };
  const entries = custom && typeof custom === 'object' ? Object.entries(custom) : [];
  for (const [key, val] of entries) {
    if (!val || typeof val !== 'object') continue;
    const base = BUILTIN_EVENTS[key];
    if (!base) { next[key] = val; continue; } // nouvel événement personnalisé
    const patch = {};
    for (const f of OVERRIDE_FIELDS) if (val[f] !== undefined) patch[f] = val[f];
    const hasParams = base.params || val.params;
    const useActions = eventEditability(key) === 'scripted' && Array.isArray(val.actions) ? val.actions : null;
    next[key] = {
      ...base, ...patch,
      ...(hasParams ? { params: { ...(base.params || {}), ...(val.params || {}) } } : {}),
      ...(useActions ? { actions: useActions } : {}),
      overridden: true,
    };
  }
  EVENTS = next;
}
