// Journal de partie — messages localisés (FR/EN) pour effectEngine.js.
// Clés namespacées log.fx.* ; vars interpolées via {x}.
export default {
  // --- Détails (labels) ---
  'log.fx.detail.stealPlanned':   { fr: 'Vol prévu', en: 'Theft planned' },
  'log.fx.detail.protectionOf':   { fr: 'Protection de {name}', en: "{name}'s protection" },
  'log.fx.detail.coinsStolen':    { fr: 'Pièces volées', en: 'Coins stolen' },
  'log.fx.detail.purseOf':        { fr: 'Bourse de {name}', en: "{name}'s purse" },
  'log.fx.detail.lossPlanned':    { fr: 'Perte prévue', en: 'Loss planned' },
  'log.fx.detail.protection':     { fr: 'Protection', en: 'Protection' },
  'log.fx.detail.coinsLost':      { fr: 'Pièces perdues', en: 'Coins lost' },

  'log.fx.cases':         { fr: ['{n} case', '{n} cases'], en: ['{n} space', '{n} spaces'] },
  'log.fx.percentOfGold': { fr: "{prefix}{n}% de l'or", en: '{prefix}{n}% of gold' },

  // --- money ---
  'log.fx.steal':   { fr: ['💰 {emoji} vole {n} pièce à {vemoji} {vname} !', '💰 {emoji} vole {n} pièces à {vemoji} {vname} !'],
                      en: ['💰 {emoji} steals {n} coin from {vemoji} {vname}!', '💰 {emoji} steals {n} coins from {vemoji} {vname}!'] },
  'log.fx.stealAll':{ fr: ['💰 {emoji} vide la bourse de {vemoji} {vname} : {n} pièce volée (sur {want} visées) !', '💰 {emoji} vide la bourse de {vemoji} {vname} : {n} pièces volées (sur {want} visées) !'],
                      en: ["💰 {emoji} empties {vemoji} {vname}'s purse: {n} coin stolen (out of {want} intended)!", "💰 {emoji} empties {vemoji} {vname}'s purse: {n} coins stolen (out of {want} intended)!"] },
  'log.fx.stealEmpty':       { fr: '💸 {emoji} tente de voler {vemoji} {vname}… bourse vide, rien à prendre !',
                               en: '💸 {emoji} tries to rob {vemoji} {vname}… empty purse, nothing to take!' },
  'log.fx.stealEmpty.toast': { fr: '💸 {vname} : bourse vide !', en: '💸 {vname}: empty purse!' },
  'log.fx.stealBlocked':     { fr: '🛡️ La protection de {vemoji} {vname} bloque tout le vol !',
                               en: "🛡️ {vemoji} {vname}'s protection blocks the whole theft!" },
  'log.fx.stealNone':        { fr: "💸 {emoji} n'a rien pu voler à {vemoji} {vname}.",
                               en: '💸 {emoji} could not steal anything from {vemoji} {vname}.' },
  'log.fx.lose':    { fr: ['💸 {emoji} {name} perd {n} pièce.', '💸 {emoji} {name} perd {n} pièces.'],
                      en: ['💸 {emoji} {name} loses {n} coin.', '💸 {emoji} {name} loses {n} coins.'] },
  'log.fx.loseAll': { fr: ['💸 {emoji} {name} perd {n} pièce — toute sa bourse (perte prévue : {want}).', '💸 {emoji} {name} perd {n} pièces — toute sa bourse (perte prévue : {want}).'],
                      en: ['💸 {emoji} {name} loses {n} coin — their whole purse (intended loss: {want}).', '💸 {emoji} {name} loses {n} coins — their whole purse (intended loss: {want}).'] },
  'log.fx.loseEmpty': { fr: '💸 {emoji} {name} devait perdre {want} 🪙… bourse déjà vide !',
                        en: '💸 {emoji} {name} was to lose {want} 🪙… purse already empty!' },
  'log.fx.give':    { fr: ['💰 {emoji} {name} reçoit {n} pièce.', '💰 {emoji} {name} reçoit {n} pièces.'],
                      en: ['💰 {emoji} {name} receives {n} coin.', '💰 {emoji} {name} receives {n} coins.'] },
  'log.fx.gain':    { fr: ['💰 {emoji} {name} gagne {n} pièce !', '💰 {emoji} {name} gagne {n} pièces !'],
                      en: ['💰 {emoji} {name} gains {n} coin!', '💰 {emoji} {name} gains {n} coins!'] },

  // --- reroll / forced subject ---
  'log.fx.forcedNext':       { fr: '🔄 Prochaine question forcée en {subject} !', en: '🔄 Next question forced to {subject}!' },
  'log.fx.forcedNext.toast': { fr: 'Prochaine question → {subject}', en: 'Next question → {subject}' },
  'log.fx.noQuestionIn':     { fr: '⚠️ Pas de question en {subject}.', en: '⚠️ No question in {subject}.' },
  'log.fx.newQuestion':      { fr: '🔄 {icon} Nouvelle question ({subject}) !', en: '🔄 {icon} New question ({subject})!' },
  'log.fx.newQuestion.toast':{ fr: 'Nouvelle question ({subject})', en: 'New question ({subject})' },

  // --- move ---
  'log.fx.reculBuff':   { fr: '🛟 {emoji} {name} : recul annulé (effet de durée) !', en: '🛟 {emoji} {name}: setback cancelled (timed effect)!' },
  'log.fx.reculEquip':  { fr: "🎒 {emoji} {name} : l'équipement absorbe le recul !", en: '🎒 {emoji} {name}: equipment absorbs the setback!' },
  'log.fx.reculFull':   { fr: '🛡️ {emoji} {name} : recul totalement absorbé !', en: '🛡️ {emoji} {name}: setback fully absorbed!' },
  'log.fx.back':        { fr: ['⬅️ {emoji} {name} recule de {n} case{reduced}.', '⬅️ {emoji} {name} recule de {n} cases{reduced}.'],
                          en: ['⬅️ {emoji} {name} moves back {n} space{reduced}.', '⬅️ {emoji} {name} moves back {n} spaces{reduced}.'] },
  'log.fx.reduced':     { fr: ' (réduit)', en: ' (reduced)' },
  'log.fx.forward':     { fr: ['➡️ {emoji} {name} avance de {n} case.', '➡️ {emoji} {name} avance de {n} cases.'],
                          en: ['➡️ {emoji} {name} advances {n} space.', '➡️ {emoji} {name} advances {n} spaces.'] },
  'log.fx.reachFinish': { fr: "🏆 {emoji} {name} atteint l'arrivée !", en: '🏆 {emoji} {name} reaches the finish!' },
  'log.fx.move.toast':  { fr: ['{label} de {n} case{tag}', '{label} de {n} cases{tag}'],
                          en: ['{label} {n} space{tag}', '{label} {n} spaces{tag}'] },
  'log.fx.move.advance':{ fr: 'Avance', en: 'Advance' },
  'log.fx.move.back':   { fr: 'Recul', en: 'Setback' },

  // --- money toast (dice) ---
  'log.fx.money.toast': { fr: '{formula} → {n}{unit}', en: '{formula} → {n}{unit}' },
  'log.fx.unit.percent':{ fr: '%', en: '%' },
  'log.fx.unit.gold':   { fr: ' or', en: ' gold' },

  // --- extraTime ---
  'log.fx.extraTimeThis':       { fr: '⌛ +{n}s sur cette question.', en: '⌛ +{n}s on this question.' },
  'log.fx.extraTimeThis.toast': { fr: '+{n}s sur cette question{tag}', en: '+{n}s on this question{tag}' },
  'log.fx.extraTimeNext':       { fr: '⌛ +{n}s à la prochaine question.', en: '⌛ +{n}s on the next question.' },
  'log.fx.extraTimeNext.toast': { fr: '+{n}s à la prochaine question{tag}', en: '+{n}s on the next question{tag}' },

  // --- hideWrong ---
  'log.fx.hideWrong':       { fr: ['💡 {n} mauvaise réponse éliminée !', '💡 {n} mauvaises réponses éliminées !'],
                              en: ['💡 {n} wrong answer removed!', '💡 {n} wrong answers removed!'] },
  'log.fx.hideWrong.toast': { fr: ['−{n} mauvaise réponse{tag}', '−{n} mauvaises réponses{tag}'],
                              en: ['−{n} wrong answer{tag}', '−{n} wrong answers{tag}'] },

  // --- shieldNext ---
  'log.fx.shieldNext':       { fr: ['🪵 Bouclier de bois armé : ton prochain recul sera réduit de {n} case.', '🪵 Bouclier de bois armé : ton prochain recul sera réduit de {n} cases.'],
                               en: ['🪵 Wooden shield ready: your next setback will be reduced by {n} space.', '🪵 Wooden shield ready: your next setback will be reduced by {n} spaces.'] },
  'log.fx.shieldNext.toast': { fr: ['Bouclier armé (−{n} case){tag}', 'Bouclier armé (−{n} cases){tag}'],
                               en: ['Shield ready (−{n} space){tag}', 'Shield ready (−{n} spaces){tag}'] },

  // --- fumigene ---
  'log.fx.fumigeneTurns':       { fr: ['💨 Fumigène actif pendant {n} tour.', '💨 Fumigène actif pendant {n} tours.'],
                                  en: ['💨 Smoke bomb active for {n} turn.', '💨 Smoke bomb active for {n} turns.'] },
  'log.fx.fumigeneUntil':       { fr: '💨 Le prochain pouvoir offensif subi sera annulé.', en: '💨 The next offensive power you suffer will be cancelled.' },
  'log.fx.fumigene.toast':      { fr: 'Fumigène armé{suffix}', en: 'Smoke bomb ready{suffix}' },

  // --- gainCharge ---
  'log.fx.noPowerToCharge': { fr: '✨ Aucun pouvoir à recharger.', en: '✨ No power to recharge.' },
  'log.fx.chargeNoEffect': { fr: '✨ Pouvoir déjà plein : aucun effet.', en: '✨ Power already full: no effect.' },

  // --- forceSubject ---
  'log.fx.forceSubject':       { fr: '🎯 {icon} {who} forcée en {subject} !', en: '🎯 {icon} {who} forced to {subject}!' },
  'log.fx.forceSubject.toast': { fr: 'Question forcée → {subject}', en: 'Question forced → {subject}' },
  'log.fx.who.self':           { fr: 'ta prochaine question', en: 'your next question' },
  'log.fx.who.target':         { fr: 'la prochaine question de la cible', en: "the target's next question" },

  // --- randomPathNext ---
  'log.fx.randomPath':       { fr: '🎲 {who} sera choisie au hasard !', en: '🎲 {who} will be chosen at random!' },
  'log.fx.randomPath.toast': { fr: '{who} → au hasard', en: '{who} → random' },
  'log.fx.path.self':        { fr: 'Ta prochaine voie', en: 'Your next path' },
  'log.fx.path.all':         { fr: 'La prochaine voie de chaque équipe', en: "Each team's next path" },
  'log.fx.path.target':      { fr: 'La prochaine voie de la cible', en: "The target's next path" },

  // --- teleportFurthest ---
  'log.fx.teleport':          { fr: '✨ {emoji} {name} se téléporte sur sa case la plus avancée !', en: '✨ {emoji} {name} teleports to its furthest space!' },
  'log.fx.teleport.done':     { fr: 'Téléportation : case la plus avancée !', en: 'Teleport: furthest space!' },
  'log.fx.teleport.already':  { fr: 'Déjà au plus loin atteint', en: 'Already at furthest reached' },

  // --- challenge ---
  'log.fx.challenge':       { fr: '🎲 Défi lancé ! Ta prochaine question sera en {subject}.', en: '🎲 Challenge issued! Your next question will be in {subject}.' },
  'log.fx.challenge.toast': { fr: 'Défi → {subject}', en: 'Challenge → {subject}' },

  // --- buff ---
  'log.fx.buff': { fr: ['✨ Effet de durée posé pour {n} tour.', '✨ Effet de durée posé pour {n} tours.'],
                   en: ['✨ Timed effect applied for {n} turn.', '✨ Timed effect applied for {n} turns.'] },

  // --- curseTimer ---
  'log.fx.curseTimer':       { fr: '⏱️ Malédiction : timer ÷{n} au prochain tour !', en: '⏱️ Curse: timer ÷{n} on the next turn!' },
  'log.fx.curseTimer.toast': { fr: 'Timer ÷{n}', en: 'Timer ÷{n}' },

  // --- Alchimie / Enchantement (événements) ---
  'log.fx.discoverRecipe': { fr: '📖 {emoji} {name} découvre une recette : {potion} !', en: '📖 {emoji} {name} discovers a recipe: {potion}!' },
  'log.fx.runeEnchant': { fr: '🔮 {emoji} {name} : une rune enchante {icon} {item} !', en: '🔮 {emoji} {name}: a rune enchants {icon} {item}!' },
  'log.fx.runeEnchant.toast': { fr: 'Rune gravée !', en: 'Rune inscribed!' },
  'log.fx.unenchant': { fr: '🧽 {emoji} {name} : un enchantement de {icon} {item} s\'efface…', en: '🧽 {emoji} {name}: an enchantment fades from {icon} {item}…' },

  // --- curseExtraQuestion ---
  'log.fx.curseExtra':       { fr: ['❓ Malédiction : +{n} question au prochain tour !', '❓ Malédiction : +{n} questions au prochain tour !'],
                               en: ['❓ Curse: +{n} question on the next turn!', '❓ Curse: +{n} questions on the next turn!'] },
  'log.fx.curseExtra.toast': { fr: ['+{n} question', '+{n} questions'], en: ['+{n} question', '+{n} questions'] },

  // --- placeTrap ---
  'log.fx.trapAlready':   { fr: '🪤 Cette case a déjà un piège.', en: '🪤 This space already has a trap.' },
  'log.fx.trapPlaced':    { fr: '🪤 {emoji} pose un piège ({label}) !', en: '🪤 {emoji} sets a trap ({label})!' },
  'log.fx.trapPlaced.toast':{ fr: 'Piège posé : {label}', en: 'Trap set: {label}' },
  'log.fx.trapDefault':   { fr: 'piège', en: 'trap' },

  // --- consumeFumigene ---
  'log.fx.fumigeneDodge':       { fr: "💨 {emoji} {name} esquive l'effet (bombe fumigène) !", en: '💨 {emoji} {name} dodges the effect (smoke bomb)!' },
  'log.fx.fumigeneDodge.toast': { fr: '{emoji} Contré par le fumigène !', en: '{emoji} Countered by the smoke bomb!' },

  // --- __rollD6 ---
  'log.fx.objectRolls': { fr: "🎲 L'objet fait {n} !", en: '🎲 The object rolls {n}!' },

  // --- Renvoi / immunités / blocages ---
  'log.fx.reflect':       { fr: "↩️ {vemoji} {vname} RENVOIE l'effet sur {aemoji} {aname} !", en: '↩️ {vemoji} {vname} REFLECTS the effect onto {aemoji} {aname}!' },
  'log.fx.reflect.toast': { fr: '↩️ Renvoyé par {vname} sur {aname} !', en: '↩️ Reflected by {vname} onto {aname}!' },
  'log.fx.goldImmune':       { fr: "🔒 {emoji} {name} est immunisé au vol d'or : rien n'est pris !", en: '🔒 {emoji} {name} is immune to gold theft: nothing taken!' },
  'log.fx.goldImmune.toast': { fr: '🔒 {name} : or protégé !', en: '🔒 {name}: gold protected!' },
  'log.fx.blockPowers':       { fr: ['🚫 Pouvoirs bloqués pendant {n} tour !', '🚫 Pouvoirs bloqués pendant {n} tours !'],
                                en: ['🚫 Powers blocked for {n} turn!', '🚫 Powers blocked for {n} turns!'] },
  'log.fx.blockPowers.toast': { fr: ['🚫 Pouvoirs bloqués ({n} tour)', '🚫 Pouvoirs bloqués ({n} tours)'],
                                en: ['🚫 Powers blocked ({n} turn)', '🚫 Powers blocked ({n} turns)'] },
  'log.fx.blockConsumables':       { fr: ['🚫 Consommables bloqués pendant {n} tour !', '🚫 Consommables bloqués pendant {n} tours !'],
                                     en: ['🚫 Consumables blocked for {n} turn!', '🚫 Consumables blocked for {n} turns!'] },
  'log.fx.blockConsumables.toast': { fr: ['🚫 Consommables bloqués ({n} tour)', '🚫 Consommables bloqués ({n} tours)'],
                                     en: ['🚫 Consumables blocked ({n} turn)', '🚫 Consumables blocked ({n} turns)'] },
  'log.fx.hackApp':           { fr: ['💀 Application piratée ! Prochain tour perdu ({n} tour).', '💀 Application piratée ! Prochains tours perdus ({n} tours).'],
                                en: ['💀 App hacked! Next turn lost ({n} turn).', '💀 App hacked! Next turns lost ({n} turns).'] },
  'log.fx.hackApp.toast':     { fr: '💀 SYSTÈME PIRATÉ', en: '💀 SYSTEM HACKED' },
};
