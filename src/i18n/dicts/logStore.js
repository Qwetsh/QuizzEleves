// Journal de partie — messages localisés (FR/EN) pour gameStore.js.
// Clés namespacées log.store.* ; vars interpolées via {x}.
export default {
  // --- Coffre de départ ---
  'log.store.starterChest':      { fr: '🧰 {emoji} {name} ouvre son coffre de départ : +{gold} 🪙{items}',
                                   en: '🧰 {emoji} {name} opens their starter chest: +{gold} 🪙{items}' },
  'log.store.starterChest.items':  { fr: ' et {names} !', en: ' and {names}!' },
  'log.store.starterChest.empty':  { fr: ' !', en: '!' },

  // --- Paliers d'or ---
  'log.store.milestone':         { fr: '💰 {emoji} {name} : {msg}', en: '💰 {emoji} {name}: {msg}' },
  'log.store.milestone.20':      { fr: 'Déjà 20 pièces ! File à la boutique t’offrir un objet.',
                                   en: 'Already 20 coins! Head to the shop and treat yourself to an item.' },
  'log.store.milestone.40':      { fr: '40 pièces en poche — de quoi t’équiper sérieusement !',
                                   en: '40 coins in your pocket — enough to gear up seriously!' },
  'log.store.milestone.60':      { fr: 'Le magot enfle : 60 pièces ! Un objet rare t’attend à la boutique.',
                                   en: 'Your loot is growing: 60 coins! A rare item awaits you at the shop.' },

  // --- Démarrage de partie ---
  'log.store.gameStart':         { fr: ['🎲 Début de la partie ! {n} équipe en lice.', '🎲 Début de la partie ! {n} équipes en lice.'],
                                   en: ['🎲 The game begins! {n} team in the running.', '🎲 The game begins! {n} teams in the running.'] },

  // --- Dé / déplacement ---
  'log.store.frozen':            { fr: '🧊 {emoji} {name} est gelé : tour sauté !', en: '🧊 {emoji} {name} is frozen: turn skipped!' },
  'log.store.roll.bonus':        { fr: '{emoji} {name} lance le dé : {value} (+{bonus} bonus) → avance de {eff} !',
                                   en: '{emoji} {name} rolls the die: {value} (+{bonus} bonus) → advances {eff}!' },
  'log.store.roll.malus':        { fr: '{emoji} {name} lance le dé : {value} (−{malus} malus) → avance de {eff} !',
                                   en: '{emoji} {name} rolls the die: {value} (−{malus} malus) → advances {eff}!' },
  'log.store.roll':              { fr: '{emoji} {name} lance le dé : {value}', en: '{emoji} {name} rolls the die: {value}' },
  'log.store.pilote':            { fr: '🧭 Pilote : choisis ta voie !', en: '🧭 Pilot: choose your path!' },
  'log.store.randomPath':        { fr: '🎲 Voie choisie au hasard !', en: '🎲 Path chosen at random!' },
  'log.store.choosePath':        { fr: '↔️ Choisis une voie !', en: '↔️ Choose a path!' },

  // --- Arrivée ---
  'log.store.finish':            { fr: '🏆 {emoji} {name} atteint l\'arrivée !', en: '🏆 {emoji} {name} reaches the finish line!' },

  // --- Piège ---
  'log.store.trap':              { fr: '🪤 {emoji} {name} declenche un piege{label} !', en: '🪤 {emoji} {name} triggers a trap{label}!' },
  'log.store.trap.label':        { fr: ' : {label}', en: ': {label}' },
  'log.store.trapAvoided':       { fr: '😅 {emoji} {name} frôle un piège{label} sans le déclencher.',
                                   en: '😅 {emoji} {name} narrowly avoids a trap{label}.' },

  // --- Duels ---
  'log.store.duelImmune':        { fr: '🛡️ Duel évité : {emoji} {name} est immunisé(e) aux duels.',
                                   en: '🛡️ Duel avoided: {emoji} {name} is immune to duels.' },
  'log.store.duelImmuneFoes':    { fr: '🛡️ Duel évité : adversaire(s) immunisé(s).', en: '🛡️ Duel avoided: immune opponent(s).' },
  'log.store.declineDuel':       { fr: '🤝 {emoji} {name} préfère ne pas défier et joue la case.',
                                   en: '🤝 {emoji} {name} prefers not to challenge and plays the space.' },

  // --- Événement ---
  'log.store.landEvent':         { fr: '🎁 {emoji} {name} tombe sur : {eicon} {ename}', en: '🎁 {emoji} {name} lands on: {eicon} {ename}' },

  // --- Questions ---
  'log.store.hardcore':          { fr: '💀 {emoji} {name} : question Hardcore ! ({pct}%)', en: '💀 {emoji} {name}: Hardcore question! ({pct}%)' },
  'log.store.noQuestion':        { fr: '⚠️ Pas de question disponible en {subject}.', en: '⚠️ No question available in {subject}.' },
  'log.store.question':          { fr: '{icon} Question en {subject}', en: '{icon} {subject} question' },
  'log.store.sablier':           { fr: '⏱️ Sablier actif ! Timer divisé par {div}.', en: '⏱️ Hourglass active! Timer divided by {div}.' },
  'log.store.equipHide':         { fr: ['💡 Équipement : {n} mauvaise réponse éliminée d\'office !', '💡 Équipement : {n} mauvaises réponses éliminées d\'office !'],
                                   en: ['💡 Equipment: {n} wrong answer eliminated automatically!', '💡 Equipment: {n} wrong answers eliminated automatically!'] },

  // --- Réponses ---
  'log.store.allOrNothing':      { fr: '🎰 Tout-ou-rien réussi ! Gains doublés : +{n} 💰', en: '🎰 All-or-nothing succeeded! Winnings doubled: +{n} 💰' },
  'log.store.correct':           { fr: '✅ Bonne réponse !{gain}', en: '✅ Correct answer!{gain}' },
  'log.store.correct.gain':      { fr: ' +{n} 💰', en: ' +{n} 💰' },
  'log.store.correct.noBonus':   { fr: ' (pas de bonus)', en: ' (no bonus)' },
  'log.store.detail.speed':      { fr: 'Rapidité de réponse', en: 'Answer speed' },
  'log.store.wagerWin':          { fr: '🎲 Défi réussi ! Récompense à la clé.', en: '🎲 Challenge won! Reward to come.' },
  'log.store.wagerLose':         { fr: '🎲 Défi perdu...', en: '🎲 Challenge lost...' },
  'log.store.contre':            { fr: '🔁 {emoji} {name} : Contre ! Nouvelle question.', en: '🔁 {emoji} {name}: Counter! New question.' },
  'log.store.doubleFailed':      { fr: '❓ Double question échouée ! Fin du tour.', en: '❓ Double question failed! End of turn.' },
  'log.store.interroGenerale':   { fr: '🏫 Interro générale ! {emoji} {name} subit aussi la Double au prochain tour.',
                                   en: '🏫 Pop quiz! {emoji} {name} also gets the Double next turn.' },

  // --- Loot de réponse ---
  'log.store.lootRefunded':      { fr: '✨ {emoji} {name} trouve {icon} {iname}... sac plein, revendu +{refund} 💰 !',
                                   en: '✨ {emoji} {name} finds {icon} {iname}... bag full, sold back +{refund} 💰!' },
  'log.store.lootFound':         { fr: '✨ {emoji} {name} trouve un objet : {icon} {iname} !', en: '✨ {emoji} {name} finds an item: {icon} {iname}!' },
  'log.store.buyFace':           { fr: '🎲 {emoji} {name} achète une face : {label} ({price} 💰).', en: '🎲 {emoji} {name} buys a die face: {label} ({price} 💰).' },
  'log.store.forgeFace':         { fr: '🔨 {emoji} {name} forge la face n°{base} : {label}.', en: '🔨 {emoji} {name} forges face #{base}: {label}.' },
  'log.store.relanceFace':       { fr: '🎲 {emoji} {name} relance (face Forge) → {value} !', en: '🎲 {emoji} {name} rerolls (forged face) → {value}!' },
  'log.store.freshQuestion':     { fr: '🔄 {emoji} {name} écarte la question et en pioche une autre.', en: '🔄 {emoji} {name} discards the question and draws another.' },

  // --- Timeout ---
  'log.store.timeoutPenalty':    { fr: '💸 {emoji} {name} dépasse le temps : −{n} or (Taxe du temps).',
                                   en: '💸 {emoji} {name} runs out of time: −{n} gold (Time Tax).' },

  // --- Dev / lose item ---
  'log.store.devMoney':          { fr: '🛠️ [dev] {emoji} {name} reçoit {n} pièces.', en: '🛠️ [dev] {emoji} {name} receives {n} coins.' },
  'log.store.loseItemGold':      { fr: '💸 {emoji} {name} n\'a aucun objet : perd {n} 🪙.', en: '💸 {emoji} {name} has no item: loses {n} 🪙.' },
  'log.store.loseItem':          { fr: '💔 {emoji} {name} perd {icon} {iname} !', en: '💔 {emoji} {name} loses {icon} {iname}!' },

  // --- Troc ---
  'log.store.trade':             { fr: '🤝 {emojiA} {nameA} et {emojiB} {nameB} ont fait affaire !', en: '🤝 {emojiA} {nameA} and {emojiB} {nameB} made a deal!' },

  // --- Complots : trahison d'un pacte (public) & expiration (discret) ---
  'log.store.betray':            { fr: '🐍 TRAHISON ! {emoji} {name} brise son pacte et attaque {vemoji} {vname} — il perd {penalty} or et sa série !', en: '🐍 BETRAYAL! {emoji} {name} breaks their pact and attacks {vemoji} {vname} — losing {penalty} gold and their streak!' },
  'log.store.betrayToast':       { fr: '{emoji} trahit {vemoji} !', en: '{emoji} betrays {vemoji}!' },
  'log.store.pactExpired':       { fr: '🕊️ Un pacte de {emoji} {name} a pris fin.', en: '🕊️ A pact of {emoji} {name} has ended.' },

  // --- Admin ---
  'log.store.adminMoney':        { fr: '🛠️ {emoji} {name} : {sign}{n} 🪙 (admin)', en: '🛠️ {emoji} {name}: {sign}{n} 🪙 (admin)' },
  'log.store.adminRemoveItem':   { fr: '🛠️ {emoji} {name} perd {icon} {iname} (admin)', en: '🛠️ {emoji} {name} loses {icon} {iname} (admin)' },

  // --- Fin de tour : effets de durée ---
  'log.store.fumigene':          { fr: '💨 Le fumigène de {emoji} {name} s\'est dissipé.', en: '💨 {emoji} {name}\'s smoke bomb has dissipated.' },
  'log.store.buffExpired':       { fr: '⏳ Un effet de durée de {emoji} {name} s\'est dissipé.', en: '⏳ A timed effect of {emoji} {name} has worn off.' },
  // DoT « saignement d'or » (vol/perte par tour) + immunité.
  'log.store.bleedSteal':        { fr: ['🩸 {emoji} {name} perd {n} pièce volée par {aemoji} {aname} !', '🩸 {emoji} {name} perd {n} pièces volées par {aemoji} {aname} !'],
                                   en: ['🩸 {emoji} {name} loses {n} coin stolen by {aemoji} {aname}!', '🩸 {emoji} {name} loses {n} coins stolen by {aemoji} {aname}!'] },
  'log.store.bleedLose':         { fr: ['🩸 {emoji} {name} perd {n} pièce (saignement) !', '🩸 {emoji} {name} perd {n} pièces (saignement) !'],
                                   en: ['🩸 {emoji} {name} loses {n} coin (bleed)!', '🩸 {emoji} {name} loses {n} coins (bleed)!'] },
  'log.store.bleedImmune':       { fr: "🔒 {emoji} {name} est immunisé : le saignement d'or n'a aucun effet.", en: '🔒 {emoji} {name} is immune: the gold bleed has no effect.' },
  // Fin des blocages.
  'log.store.powersUnblocked':       { fr: '✅ {emoji} {name} peut à nouveau utiliser ses pouvoirs.', en: '✅ {emoji} {name} can use powers again.' },
  'log.store.consumablesUnblocked':  { fr: '✅ {emoji} {name} peut à nouveau utiliser ses consommables.', en: '✅ {emoji} {name} can use consumables again.' },
};
