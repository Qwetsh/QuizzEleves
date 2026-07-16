// Traductions des modales joueur (Question, Event, Shop, Inventory, Victory…). Phase A.
// Clés namespacées `modal.*`. { fr, en }.
// NB : le contenu data (noms/desc d'objets, pouvoirs, événements, matières) n'est
// PAS traduit ici — seul le chrome (boutons, titres, libellés fixes).
export default {
  // ---- Communs aux modales ----
  'modal.ok': { fr: 'OK', en: 'OK' },
  'modal.skip': { fr: 'Passer', en: 'Skip' },
  'modal.nice': { fr: 'Super !', en: 'Nice!' },
  'modal.loading': { fr: 'Chargement...', en: 'Loading...' },
  'modal.explanation': { fr: 'Explication :', en: 'Explanation:' },

  // ---- EventModal ----
  'modal.event.special': { fr: 'Événement spécial', en: 'Special event' },
  'modal.event.accept': { fr: 'Accepter', en: 'Accept' },
  'modal.event.decline': { fr: 'Refuser', en: 'Decline' },
  'modal.event.brewing': { fr: 'Un événement se prépare…', en: 'An event is brewing…' },
  'modal.event.reveal': { fr: '✨ Révélation !', en: '✨ Reveal!' },
  'modal.event.spinning': { fr: '🎰 La roue tourne…', en: '🎰 The wheel is spinning…' },
  'modal.event.diceResult': { fr: 'Résultat : {n} !', en: 'Result: {n}!' },
  'modal.event.chooseTarget': { fr: 'Choisir une cible :', en: 'Choose a target:' },
  'modal.event.target.decharge': { fr: 'Qui reçoit la décharge ? (recul = lancer de dé)', en: 'Who takes the shock? (setback = dice roll)' },
  'modal.event.target.sacrifice': { fr: 'Qui recule de 4 cases ?', en: 'Who moves back 4 squares?' },
  'modal.event.target.duel': { fr: 'Qui doit répondre ?', en: 'Who must answer?' },
  'modal.event.target.don': { fr: 'Qui avance de 3 cases ?', en: 'Who moves forward 3 squares?' },
  'modal.event.target.vol': { fr: 'À qui voler une charge ?', en: 'Steal a charge from whom?' },
  'modal.event.target.echange': { fr: 'Échanger ta position avec qui ?', en: 'Swap your position with whom?' },
  'modal.event.target.pillage': { fr: 'À qui voler un objet ?', en: 'Steal an item from whom?' },
  'modal.event.boss.chooseWeapon': { fr: '👨‍🏫 Choisis ton arme pour affronter le Prof :', en: '👨‍🏫 Choose your weapon to face the Teacher:' },
  'modal.event.recharge.which': { fr: 'Quel pouvoir veux-tu recharger ?', en: 'Which power do you want to recharge?' },
  'modal.event.vol.whichSteal': { fr: 'Quel pouvoir voler à {team} ?', en: 'Which power to steal from {team}?' },
  'modal.event.vol.whichRecharge': { fr: 'Tu voles 1 charge de {power}. Quel pouvoir recharger ?', en: 'You steal 1 charge of {power}. Which power to recharge?' },
  'modal.event.vol.changeTarget': { fr: '← Changer de pouvoir à voler', en: '← Change power to steal' },
  'modal.event.marcheNoir.title': { fr: '1 charge à moitié prix — tu as {n} ', en: '1 charge at half price — you have {n} ' },
  'modal.event.passMyWay': { fr: 'Non merci, je passe mon chemin', en: 'No thanks, I\'ll move along' },
  'modal.event.merchant.title': { fr: 'Objets à -30% — tu as {n} ', en: 'Items at -30% — you have {n} ' },
  'modal.event.bagFull': { fr: 'Sac plein !', en: 'Bag full!' },
  'modal.event.chests.title': { fr: 'Choisis UN coffre — ton choix est définitif !', en: 'Pick ONE chest — your choice is final!' },
  'modal.event.trade.which': { fr: 'Quel objet sacrifies-tu au troc ? (tu en reçois un au hasard)', en: 'Which item do you trade away? (you get a random one)' },
  'modal.event.trade.cancel': { fr: 'Annuler le troc', en: 'Cancel the trade' },
  'modal.event.pillage.which': { fr: 'Quel objet voler à {team} ?', en: 'Which item to steal from {team}?' },
  'modal.event.charges': { fr: ['charge', 'charges'], en: ['charge', 'charges'] },
  'modal.event.consumable': { fr: 'Consommable', en: 'Consumable' },
  'modal.event.vatout.goodAnswer': { fr: '✅ Bonne réponse ! ', en: '✅ Correct answer! ' },
  'modal.event.vatout.pot': { fr: 'Mise : {n} ', en: 'Pot: {n} ' },
  'modal.event.vatout.warn': { fr: 'Continuer rapporterait +{n} de plus… mais une mauvaise réponse fait TOUT perdre et reculer d\'1D10 !', en: 'Continuing would earn +{n} more… but a wrong answer loses EVERYTHING and sets you back 1D10!' },
  'modal.event.vatout.continue': { fr: '🎲 Continuer (+{n})', en: '🎲 Continue (+{n})' },
  'modal.event.vatout.cashOut': { fr: '💰 Encaisser {n}', en: '💰 Cash out {n}' },

  // ---- InvestPickerModal (bourse galactique) ----
  'modal.invest.title': { fr: 'Bourse galactique', en: 'Galactic Exchange' },
  'modal.invest.sub': { fr: 'Combien veux-tu investir, {emoji} {name} ?', en: 'How much do you want to invest, {emoji} {name}?' },
  'modal.invest.available': { fr: 'Capital disponible', en: 'Available capital' },
  'modal.invest.rate': { fr: 'Taux de retour', en: 'Return rate' },
  'modal.invest.stakeLabel': { fr: 'Ta mise', en: 'Your stake' },
  'modal.invest.payout': { fr: 'Remboursement si bonne réponse', en: 'Payout on a correct answer' },
  'modal.invest.net': { fr: 'Bénéfice net', en: 'Net profit' },
  'modal.invest.warn': { fr: '⚠️ Mise perdue en cas de mauvaise réponse.', en: '⚠️ Stake lost on a wrong answer.' },
  'modal.invest.confirm': { fr: '🚀 Investir {n} 🪙', en: '🚀 Invest {n} 🪙' },
  'modal.invest.decline': { fr: 'Ne pas investir', en: 'Don\'t invest' },

  // ---- InvestResultModal (retour sur investissement) ----
  'modal.investResult.title': { fr: 'Retour sur investissement', en: 'Return on investment' },
  'modal.investResult.flavor': { fr: 'Les marchés stellaires te sourient ! 🌌', en: 'The stellar markets smile on you! 🌌' },
  'modal.investResult.stake': { fr: 'Mise', en: 'Stake' },
  'modal.investResult.rate': { fr: 'Taux', en: 'Rate' },
  'modal.investResult.payout': { fr: 'Remboursement', en: 'Payout' },
  'modal.investResult.profit': { fr: 'Bénéfice', en: 'Profit' },
  'modal.investResult.close': { fr: '💰 Encaisser', en: '💰 Cash in' },

  // ---- ShopPromptModal ----
  'modal.shopPrompt.title': { fr: 'La boutique t\'attend, {emoji} {name} !', en: 'The shop awaits, {emoji} {name}!' },
  'modal.shopPrompt.sub': { fr: 'Tu as de quoi t\'équiper avant de continuer.', en: 'You can gear up before moving on.' },
  'modal.shopPrompt.go': { fr: '🛒 Oui, j\'y vais !', en: '🛒 Yes, let\'s go!' },

  // ---- DuelChoiceModal ----
  'modal.duel.title': { fr: '{emoji} {name}, un duel ?', en: '{emoji} {name}, a duel?' },
  'modal.duel.land': { fr: 'Tu arrives sur une case occupée.', en: 'You land on an occupied square.' },
  'modal.duel.subjectIn': { fr: 'Duel en', en: 'Duel in' },
  'modal.duel.whoChallenge': { fr: 'Qui veux-tu défier ?', en: 'Who do you want to challenge?' },
  'modal.duel.immuneTitle': { fr: '{name} est immunisé(e) aux duels', en: '{name} is immune to duels' },
  'modal.duel.immuneLine': { fr: '🛡️ Immunisé — impossible à défier', en: '🛡️ Immune — cannot be challenged' },
  'modal.duel.playSquare': { fr: '🤝 Non, je joue la case', en: '🤝 No, I\'ll play the square' },

  // ---- DiceRollModal ----
  'modal.dice.turnOf': { fr: 'Tour de', en: 'Turn of' },
  'modal.dice.preparing': { fr: 'Préparation…', en: 'Preparing…' },
  'modal.dice.rolling': { fr: 'Le dé tournoie…', en: 'The die spins…' },
  'modal.dice.oneSquare': { fr: '1 case', en: '1 square' },
  'modal.dice.nSquares': { fr: '{n} cases', en: '{n} squares' },
  'modal.dice.toTravel': { fr: 'à parcourir !', en: 'to travel!' },

  // ---- ShopModal ----
  'modal.shop.title': { fr: 'BOUTIQUE', en: 'SHOP' },
  'modal.shop.marcheNoir.title': { fr: 'MARCHÉ NOIR', en: 'BLACK MARKET' },
  'modal.shop.marcheNoir.banner': { fr: '🕯️ Étals clandestins', en: '🕯️ Clandestine stalls' },
  'modal.shop.marcheNoir.note': { fr: 'Marchandise « tombée du camion » — {pct}% sur tout. Pars quand tu veux.', en: 'Goods that "fell off a truck" — {pct}% off everything. Leave whenever you like.' },
  'modal.shop.tab.items': { fr: '🧳 Objets', en: '🧳 Items' },
  'modal.shop.tab.powers': { fr: '⚡ Pouvoirs', en: '⚡ Powers' },
  'modal.forge.title': { fr: 'Forge de dés', en: 'Dice forge' },
  'modal.shop.fxDetail': { fr: 'Détail de l’effet', en: 'Effect details' },
  'modal.shop.items': { fr: '📦 Objets', en: '📦 Items' },
  'modal.shop.consumables': { fr: '🧪 Consommables', en: '🧪 Consumables' },
  'modal.shop.equipment': { fr: '🛡️ Équipements', en: '🛡️ Equipment' },
  'modal.shop.recharge': { fr: '⚡ Recharger', en: '⚡ Recharge' },
  'modal.shop.upgrade': { fr: '⬆️ Améliorer', en: '⬆️ Upgrade' },
  'modal.shop.unlock': { fr: '🔓 Débloquer', en: '🔓 Unlock' },
  'modal.shop.empty': { fr: 'La boutique n\'a plus rien à vendre pour le moment.', en: 'The shop has nothing left to sell for now.' },
  'modal.shop.consumable': { fr: 'Consommable', en: 'Consumable' },
  'modal.shop.slotTaken': { fr: '{slot} occupée → ira dans le sac', en: '{slot} taken → goes to the bag' },
  'modal.shop.bagFull': { fr: 'Sac plein !', en: 'Bag full!' },
  'modal.shop.addCharge': { fr: '+1 Charge', en: '+1 Charge' },
  'modal.shop.chargeFull': { fr: '⚡ Au max', en: '⚡ Full' },
  'modal.shop.level': { fr: 'Niv. {a} → {b}', en: 'Lvl. {a} → {b}' },
  'modal.shop.current': { fr: 'Actuel : {desc}', en: 'Current: {desc}' },
  'modal.shop.next': { fr: 'Suivant : {desc}', en: 'Next: {desc}' },
  'modal.shop.branchAt': { fr: '🌟 Choix de voie au niveau {n} !', en: '🌟 Path choice at level {n}!' },
  'modal.shop.upgradeBtn': { fr: 'Améliorer', en: 'Upgrade' },
  'modal.shop.defensive': { fr: 'Défensif', en: 'Defensive' },
  'modal.shop.offensive': { fr: 'Offensif', en: 'Offensive' },
  'modal.shop.unlockBtn': { fr: 'Débloquer', en: 'Unlock' },

  // ---- InventoryModal ----
  'modal.inv.title': { fr: 'Inventaire', en: 'Inventory' },
  'modal.inv.equipTitle': { fr: '⚙ ÉQUIPEMENT', en: '⚙ EQUIPMENT' },
  'modal.inv.bagTitle': { fr: 'Sac — {n} emplacements', en: 'Bag — {n} slots' },

  // ---- VictoryModal ----
  'modal.victory.title': { fr: 'VICTOIRE !', en: 'VICTORY!' },
  'modal.victory.wins': { fr: 'remportent la quête', en: 'win the quest' },
  'modal.victory.ranking': { fr: 'Classement final', en: 'Final ranking' },
  'modal.victory.reviewBoard': { fr: 'Revoir le plateau', en: 'Review the board' },
  'modal.victory.analysis': { fr: '📊 Voir l\'analyse', en: '📊 View analysis' },
  'modal.victory.newGame': { fr: '🔁 Nouvelle partie', en: '🔁 New game' },

  // ---- TargetPickerModal ----
  'modal.target.stealName': { fr: 'Cible du vol/effet', en: 'Target of the steal/effect' },
  'modal.target.moveName': { fr: 'Cible du déplacement', en: 'Target of the move' },
  'modal.target.desc': { fr: 'Choisis une équipe à viser.', en: 'Choose a team to target.' },
  'modal.target.surgeName': { fr: 'Sur-réduction', en: 'Overcharge' },
  'modal.target.surgeDesc': { fr: 'Choisis une équipe à reculer de {n} cases.', en: 'Choose a team to push back {n} squares.' },
  'modal.target.immune': { fr: 'immunisé', en: 'immune' },
  'modal.target.self': { fr: 'toi — gain de temps', en: 'you — time gain' },
  'modal.target.chooseTeam': { fr: 'Choisir une équipe cible :', en: 'Choose a target team:' },
  // Pacte de non-agression (« Complots ») : avertissement + confirmation de trahison.
  'modal.target.pact': { fr: 'pacte', en: 'pact' },
  'modal.target.betrayTitle': { fr: 'Trahir {emoji} {name} ?', en: 'Betray {emoji} {name}?' },
  'modal.target.betrayWarn': { fr: 'Tu avais promis de ne pas l\'attaquer. Briser le pacte sera annoncé à toute la classe et te coûtera de l\'or et ta série.', en: 'You promised not to attack them. Breaking the pact will be announced to the whole class and cost you gold and your streak.' },
  'modal.target.betrayConfirm': { fr: '🐍 Trahir', en: '🐍 Betray' },

  // ---- ChargePickerModal ----
  'modal.charge.recharge': { fr: 'Recharge !', en: 'Recharge!' },
  'modal.charge.dieOne': { fr: 'Dé de 1 !', en: 'Rolled a 1!' },
  'modal.charge.chooseRecharge': { fr: 'Choisis un pouvoir à recharger :', en: 'Choose a power to recharge:' },
  'modal.charge.chooseRechargeFree': { fr: 'Choisis un pouvoir à recharger gratuitement :', en: 'Choose a power to recharge for free:' },
  'modal.charge.offNow': { fr: 'Offensif — utilisable immédiatement', en: 'Offensive — usable right away' },

  // ---- SpecPickerModal ----
  'modal.spec.title': { fr: '{name} — Niveau {tier} !', en: '{name} — Level {tier}!' },
  'modal.spec.choose': { fr: 'Choisis ta voie (définitif) :', en: 'Choose your path (final):' },

  // ---- MetierPickerModal (extension « Métiers ») ----
  'modal.metier.title': { fr: '{emoji} {name} — choisis ton métier', en: '{emoji} {name} — choose your trade' },
  'modal.metier.choose': { fr: 'Un seul artisanat pour toute la partie. Choix définitif !', en: 'A single craft for the whole game. Final choice!' },
  'modal.metier.locked': { fr: '🔒 Une fois choisi, le métier ne peut plus changer.', en: '🔒 Once chosen, your trade can no longer change.' },

  // ---- EnchantPickerModal ----
  'modal.enchant.onWhich': { fr: 'Sur quelle pièce ?', en: 'On which piece?' },

  // ---- SubjectPickerModal ----
  'modal.subject.title': { fr: 'Choisis le thème', en: 'Choose the theme' },
  'modal.subject.sub': { fr: 'La nouvelle question portera sur cette matière.', en: 'The new question will be about this subject.' },
  'modal.subject.randomTitle': { fr: 'Thème au sort', en: 'Random theme' },
  'modal.subject.randomSub': { fr: 'Choisis parmi ces thèmes tirés au hasard.', en: 'Pick from these randomly drawn themes.' },

  // ---- TrapInspectModal ----
  'modal.trap.title': { fr: 'Piège', en: 'Trap' },
  'modal.trap.sub': { fr: 'Déclenché par la première équipe qui marche dessus.', en: 'Triggered by the first team that steps on it.' },
  'modal.trap.unknown': { fr: 'Effet inconnu.', en: 'Unknown effect.' },

  // ---- LootReveal ----
  'modal.loot.title': { fr: 'Objet obtenu !', en: 'Item obtained!' },
  'modal.loot.pillageTitle': { fr: '🏴‍☠️ Objet pillé !', en: '🏴‍☠️ Item plundered!' },
  'modal.loot.consumable': { fr: 'Consommable', en: 'Consumable' },
  'modal.loot.effects': { fr: 'Effets', en: 'Effects' },

  // ---- StarterChest ----
  'modal.chest.treasure': { fr: '{emoji} Trésor de départ !', en: '{emoji} Starting treasure!' },
  'modal.chest.aChest': { fr: '🧰 Un coffre de départ !', en: '🧰 A starting chest!' },
  'modal.chest.openPrompt': { fr: 'Ouvre-le pour bien démarrer l\'aventure !', en: 'Open it to get a good start on the adventure!' },
  'modal.chest.openBtn': { fr: '🗝️ Ouvrir le coffre', en: '🗝️ Open the chest' },
  'modal.event.tag': { fr: 'ÉVÉNEMENT', en: 'LOG ENTRY' },
  'modal.event.hyperspace': { fr: 'SAUT HYPERSPATIAL…', en: 'HYPERSPACE JUMP…' },
  'modal.chest.tapPrompt': { fr: '👆 Touche le coffre pour l\'ouvrir !', en: '👆 Tap the chest to open it!' },
  // En ligne, vu des AUTRES écrans : le joueur actif ouvre son coffre chez lui.
  'modal.chest.tapPromptOnline': { fr: '🎁 L\'équipe ouvre son coffre sur son écran…', en: '🎁 The team is opening its chest on their screen…' },
  // --- Troc PC (modale « jeu en ligne ») ---
  'modal.trade.title': { fr: 'Troc', en: 'Trade' },
  'modal.trade.none': { fr: 'Aucune offre pour le moment.', en: 'No offers yet.' },
  'modal.trade.cancel': { fr: 'Annuler', en: 'Cancel' },
  'modal.trade.compose': { fr: 'Proposer un deal', en: 'Propose a deal' },
  'modal.trade.turns': { fr: 'tours', en: 'turns' },
  'modal.trade.pactShort': { fr: '🕊️ pacte {n} tours', en: '🕊️ pact {n} turns' },
  'modal.trade.peaceGive': { fr: 'Je promets de ne pas attaquer {who} pendant', en: 'I promise not to attack {who} for' },
  'modal.trade.peaceWant': { fr: '{who} promet de ne pas m\'attaquer pendant', en: '{who} promises not to attack me for' },
  'modal.trade.sentOk': { fr: 'Offre envoyée !', en: 'Offer sent!' },
  'modal.chest.opening': { fr: '✨ Ouverture…', en: '✨ Opening…' },
  'modal.chest.chooseOne': { fr: 'Choisis UN objet pour démarrer :', en: 'Choose ONE item to start:' },
  'modal.chest.chooseN': { fr: 'Choisis {n} objets ({picked}/{n}) :', en: 'Choose {n} items ({picked}/{n}):' },
  'modal.chest.validate': { fr: 'Valider mon choix', en: 'Confirm my choice' },
  'modal.chest.final': { fr: 'Ton choix est définitif.', en: 'Your choice is final.' },

  // ---- SetBonusInfo ----
  'modal.set.pieces': { fr: '{n} pièces', en: '{n} pieces' },
  'modal.set.active': { fr: '✓ actif', en: '✓ active' },
  'modal.set.need': { fr: 'encore {n} pièce(s)', en: '{n} more piece(s)' },
  'modal.set.piecesEquipped': { fr: '{n} pièces sur 3 équipées', en: '{n} of 3 pieces equipped' },

  // ---- ItemActionCard ----
  'modal.item.consumable': { fr: 'Consommable', en: 'Consumable' },
  'modal.item.effects': { fr: '⚡ Effets', en: '⚡ Effects' },
  'modal.item.enchantEffects': { fr: '✦ Enchantement', en: '✦ Enchantment' },
  'modal.item.use': { fr: 'Utiliser', en: 'Use' },
  'modal.item.sell': { fr: '♻️ Revendre +{n}', en: '♻️ Sell +{n}' },
};
