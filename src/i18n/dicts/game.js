// Traductions de l'interface en partie (TBI) : HUD, plateau, sidebar. Phase A.
// Clés namespacées `game.*`. { fr, en }.
export default {
  // --- HUD / GameLayout ---
  'game.yourTurn': { fr: 'C\'est ton tour !', en: 'Your turn!' },
  'game.openShop': { fr: 'Ouvrir la boutique', en: 'Open the shop' },
  'game.openInventory': { fr: 'Ouvrir l\'inventaire', en: 'Open the inventory' },
  'game.openScribe': { fr: 'Ouvrir l\'Autel du Scribe', en: 'Open the Scribe\'s Altar' },
  'game.openForge': { fr: 'Gérer mon dé (forge)', en: 'Manage my die (forge)' },
  'game.scribeBtn': { fr: 'Autel', en: 'Altar' },
  'game.openAlchemy': { fr: 'Ouvrir l\'atelier d\'alchimie', en: 'Open the alchemy workshop' },
  'game.alchBtn': { fr: 'Alchimie', en: 'Alchemy' },
  // Overlay TBI d'une prestation de forgeage en cours
  'game.forgeSvcTitle': { fr: '{p} forge le dé de {c}', en: '{p} is forging {c}\'s die' },
  'game.forgeSvcCancel': { fr: 'Annuler la forge', en: 'Cancel forging' },
  'game.forgeSvcPayFail': { fr: '⚠️ Le client ne peut plus payer le prix convenu.', en: '⚠️ The client can no longer pay the agreed price.' },
  'game.title': { fr: 'Curioscope', en: 'Curioscope' },
  'game.boardGame': { fr: 'Jeu de plateau', en: 'Board game' },
  'game.turnN': { fr: 'TOUR {n}', en: 'TURN {n}' },
  'game.shopBtn': { fr: 'BOUTIQUE', en: 'SHOP' },
  'game.invBtn': { fr: 'INVENTAIRE', en: 'INVENTORY' },
  'game.tvColor': { fr: 'COULEUR', en: 'COLOR' },
  'game.tvPixel': { fr: '8-BIT', en: '8-BIT' },
  'game.tvSwitch': { fr: 'Changer de chaîne', en: 'Switch channel' },
  'game.journal': { fr: 'Journal', en: 'Log' },
  'game.fullscreen': { fr: 'Plein écran', en: 'Fullscreen' },
  'game.exitFullscreen': { fr: 'Quitter le plein écran', en: 'Exit fullscreen' },
  'game.quit': { fr: 'Quitter', en: 'Quit' },

  // --- Board tile types / locations (BottomBar) ---
  'game.tile.depart': { fr: 'Départ', en: 'Start' },
  'game.tile.arrivee': { fr: 'Arrivée', en: 'Finish' },
  'game.tile.jonction': { fr: 'Carrefour', en: 'Crossroads' },
  'game.tile.event': { fr: 'Événement', en: 'Event' },
  'game.location.waiting': { fr: 'En attente…', en: 'Waiting…' },

  // --- BottomBar : team cards ---
  'game.yourMove': { fr: 'À TOI DE JOUER', en: 'YOUR MOVE' },
  'game.stat.coins': { fr: 'Pièces d\'or', en: 'Gold coins' },
  'game.stat.correct': { fr: 'Bonnes réponses', en: 'Correct answers' },
  'game.stat.wrong': { fr: 'Erreurs', en: 'Mistakes' },
  'game.stat.winRate': { fr: 'Taux de réussite', en: 'Success rate' },
  'game.activeMalus': { fr: 'Malus actifs ({n})', en: 'Active penalties ({n})' },
  'game.section.equipment': { fr: 'Équipement', en: 'Equipment' },
  'game.section.powers': { fr: 'Pouvoirs', en: 'Powers' },
  'game.noPower': { fr: 'Aucun pouvoir.', en: 'No power.' },
  'game.bagLabel': { fr: 'Sac', en: 'Bag' },
  'game.slotEmpty': { fr: '{slot} : vide', en: '{slot}: empty' },
  'game.slotItem': { fr: '{slot} : {item}', en: '{slot}: {item}' },
  'game.enchanted': { fr: '(✦ enchanté ×{n})', en: '(✦ enchanted ×{n})' },
  'game.powerTitleLong': { fr: '{name} — Niv.{level} — {charges}', en: '{name} — Lv.{level} — {charges}' },
  'game.powerTitleDesc': { fr: '{name} — Niv.{level} — {charges}\n{desc}', en: '{name} — Lv.{level} — {charges}\n{desc}' },
  'game.kind.attack': { fr: 'Attaque', en: 'Attack' },
  'game.kind.defense': { fr: 'Défense', en: 'Defense' },
  'game.charge': { fr: ['charge', 'charges'], en: ['charge', 'charges'] },

  // --- PowerButtons ---
  'game.powerCharges': { fr: '{name} ({charges})', en: '{name} ({charges})' },
  'game.relanceSwap': { fr: 'Échange de place', en: 'Place swap' },
  'game.relanceSwapHint': { fr: 'Échange ta place avec le 1ᵉʳ ({cost} charges)', en: 'Swap places with the leader ({cost} charges)' },
  'game.shieldImmunity': { fr: 'Immunité totale', en: 'Total immunity' },
  'game.shieldImmunityHint': { fr: 'Dépense {cost} charges → immunité {turns} tours', en: 'Spend {cost} charges → immunity for {turns} turns' },
  'game.clairvoyance': { fr: 'Clairvoyance', en: 'Clairvoyance' },
  'game.clairvoyanceHint': { fr: 'Dépense {cost} charges → révèle la bonne réponse ce tour', en: 'Spend {cost} charges → reveal the correct answer this turn' },
  'game.foudreBanish': { fr: 'Renvoi au départ', en: 'Banish to start' },
  'game.foudreBanishHint': { fr: 'Dépense {cost} charges → renvoie une équipe au départ', en: 'Spend {cost} charges → send a team back to the start' },
  'game.sablierBroken': { fr: 'Sablier brisé', en: 'Broken hourglass' },
  'game.sablierBrokenHint': { fr: 'Dépense {cost} charges → timer max des autres réduit à {floor}s', en: 'Spend {cost} charges → other teams’ max timer reduced to {floor}s' },

  // --- ConsumableBar ---
  'game.itemsToUse': { fr: 'Objets à utiliser', en: 'Items to use' },
  'game.tapToUse': { fr: '{name} — appuie pour voir l\'effet et l\'utiliser', en: '{name} — tap to preview the effect and use it' },

  // --- GameLog ---
  'game.gameStarting': { fr: 'La partie démarre…', en: 'The game is starting…' },
  'game.hideDetail': { fr: 'Masquer le détail', en: 'Hide details' },
  'game.showDetail': { fr: 'Voir le détail du calcul', en: 'Show the calculation details' },

  // --- Dice ---
  'game.diceSpinning': { fr: 'Le dé tourne…', en: 'The die is rolling…' },
  'game.rerollPossible': { fr: 'Relance possible !', en: 'Reroll available!' },
  'game.onTheWay': { fr: 'En route…', en: 'On the way…' },
  'game.clickToRoll': { fr: 'Cliquer pour lancer', en: 'Click to roll' },
  'game.rollDie': { fr: 'Lancer le dé', en: 'Roll the die' },
  'game.reroll': { fr: 'Relance !', en: 'Reroll!' },
  'game.dieValue': { fr: 'Dé, valeur {value}', en: 'Die, value {value}' },

  // --- ActionDiceOverlay ---
  'game.itemRollsDie': { fr: 'L\'objet lance le dé…', en: 'The item rolls the die…' },
  'game.result': { fr: 'Résultat !', en: 'Result!' },

  // --- BoardSVG ---
  'game.placeTrapPrompt': { fr: 'Choisis une case pour poser ton piège', en: 'Pick a tile to set your trap' },
  'game.placeTrapPromptNamed': { fr: 'Choisis une case pour poser ton piège « {label} »', en: 'Pick a tile to set your trap "{label}"' },
  'game.seeTrapEffect': { fr: 'Voir l\'effet du piège', en: 'See the trap\'s effect' },
  'game.checkpointTeleport': { fr: '↩︎ Me téléporter', en: '↩︎ Teleport here' },

  // --- TeamCard (sidebar) ---
  'game.turnMarker': { fr: 'tour', en: 'turn' },
  'game.timerHalf': { fr: 'Timer /2', en: 'Timer /2' },
  'game.doubleQuestion': { fr: 'Double question', en: 'Double question' },
  'game.shieldBlocks': { fr: 'Bouclier : annule {n}', en: 'Shield: blocks {n}' },
  'game.smokeNextOff': { fr: 'Fumigène : prochain pouvoir offensif annulé', en: 'Smoke: next offensive power cancelled' },
  'game.smokeNextOffTurns': { fr: 'Fumigène : prochain pouvoir offensif annulé ({turns})', en: 'Smoke: next offensive power cancelled ({turns})' },
  'game.powersBlocked': { fr: 'Pouvoirs bloqués ({n})', en: 'Powers blocked ({n})' },
  'game.consumablesBlocked': { fr: 'Consommables bloqués ({n})', en: 'Consumables blocked ({n})' },
  'game.itemStealImmune': { fr: "Immunisé au vol d'objet", en: 'Immune to item theft' },
  'game.goldStealImmune': { fr: "Immunisé au vol d'or", en: 'Immune to gold theft' },
  'game.reflectChance': { fr: "Renvoi d'effet : {n}%", en: 'Effect reflect: {n}%' },
};
