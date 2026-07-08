// Journal de partie — messages localisés (FR/EN) pour logFight.
// Clés namespacées log.ft.* ; vars interpolées via {x}.
export default {
  // Notes de butin (suffixes appendus aux messages de gain d'objet)
  'log.ft.note.equipped': { fr: ' (équipé)', en: ' (equipped)' },
  'log.ft.note.refunded': { fr: ' (sac plein : revendu +{refund} \u{1F4B0})', en: ' (bag full: sold +{refund} \u{1F4B0})' },

  // Démarrage de duel / boss
  'log.ft.challenge': {
    fr: '⚔️ {att} défie {def} en duel !',
    en: '⚔️ {att} challenges {def} to a duel!',
  },
  'log.ft.bossChallenge': {
    fr: '👨‍🏫 {att} défie LE PROF dans un combat de boss !',
    en: '👨‍🏫 {att} challenges THE TEACHER to a boss fight!',
  },

  // Issue d'un combat de boss
  'log.ft.bossWin': {
    fr: '🏆 {team} terrasse le Prof ! +{gold} \u{1F4B0}{loot} !',
    en: '🏆 {team} defeats the Teacher! +{gold} \u{1F4B0}{loot}!',
  },
  'log.ft.bossWin.loot': {
    fr: ' et {icon} {item}{note}',
    en: ' and {icon} {item}{note}',
  },
  'log.ft.bossLose': {
    fr: '👨‍🏫 Le Prof l\'emporte ! {team} recule de {n} case{s}{reduced}.',
    en: '👨‍🏫 The Teacher wins! {team} moves back {n} space{s}{reduced}.',
  },
  'log.ft.bossLose.absorbed': {
    fr: '👨‍🏫 Le Prof l\'emporte ! \u{1F6E1}️ {team} encaisse mais le recul est absorbé !',
    en: '👨‍🏫 The Teacher wins! \u{1F6E1}️ {team} takes the hit but the knockback is absorbed!',
  },

  // Manches & victoire de duel
  'log.ft.round': {
    fr: '⚔️ Manche {round} pour {team} !',
    en: '⚔️ Round {round} to {team}!',
  },
  'log.ft.duelWin': {
    fr: '\u{1F3C5} {team} remporte le duel !',
    en: '\u{1F3C5} {team} wins the duel!',
  },

  // Récompense : pillage d'objet
  'log.ft.loot.none': {
    fr: '\u{1F9F0} {loser} n\'a aucun objet... {winner} ramasse 10 \u{1F4B0} sur le champ de bataille !',
    en: '\u{1F9F0} {loser} has no item... {winner} picks up 10 \u{1F4B0} from the battlefield!',
  },
  'log.ft.loot.found': {
    fr: '\u{1F9F0} {loser} n\'a aucun objet... {winner} fouille le champ de bataille et trouve {icon} {item} !{note}',
    en: '\u{1F9F0} {loser} has no item... {winner} searches the battlefield and finds {icon} {item}!{note}',
  },
  'log.ft.loot.steal': {
    fr: '\u{1F392} {winner} pille {icon} {item} à {loser} !{note}',
    en: '\u{1F392} {winner} loots {icon} {item} from {loser}!{note}',
  },

  // Récompense : vol de pièces
  'log.ft.steal.gold': {
    fr: ['\u{1F4B0} {winner} pille {n} pièce à {loser} !', '\u{1F4B0} {winner} pille {n} pièces à {loser} !'],
    en: ['\u{1F4B0} {winner} loots {n} coin from {loser}!', '\u{1F4B0} {winner} loots {n} coins from {loser}!'],
  },
  'log.ft.steal.goldAll': {
    fr: ['\u{1F4B0} {winner} vide la bourse de {loser} : {n} pièce pillée (sur {want} visées) !', '\u{1F4B0} {winner} vide la bourse de {loser} : {n} pièces pillées (sur {want} visées) !'],
    en: ["\u{1F4B0} {winner} empties {loser}'s purse: {n} coin looted (out of {want} intended)!", "\u{1F4B0} {winner} empties {loser}'s purse: {n} coins looted (out of {want} intended)!"],
  },
  'log.ft.steal.protected': {
    fr: '\u{1F9B9} {loser} protège ses pièces : rien à piller !',
    en: '\u{1F9B9} {loser} protects their coins: nothing to loot!',
  },
  'log.ft.steal.empty': {
    fr: '\u{1F4B8} La bourse de {loser} était vide : rien à piller !',
    en: "\u{1F4B8} {loser}'s purse was empty: nothing to loot!",
  },

  // Récompense : recul (knockback)
  'log.ft.knockback': {
    fr: ['⬅️ {loser} est repoussé de {n} case{reduced} !', '⬅️ {loser} est repoussé de {n} cases{reduced} !'],
    en: ['⬅️ {loser} is pushed back {n} space{reduced}!', '⬅️ {loser} is pushed back {n} spaces{reduced}!'],
  },
  'log.ft.knockback.equip': {
    fr: '\u{1F392} L\'équipement de {loser} absorbe le recul !',
    en: '\u{1F392} {loser}\'s equipment absorbs the knockback!',
  },
  'log.ft.knockback.shield': {
    fr: '\u{1F6E1}️ {loser} absorbe le recul avec son bouclier !',
    en: '\u{1F6E1}️ {loser} absorbs the knockback with their shield!',
  },
  'log.ft.immune': {
    fr: '\u{1F6E1}️ {loser} est immunisé : aucun recul de duel !',
    en: '\u{1F6E1}️ {loser} is immune: no duel knockback!',
  },
  'log.ft.reflect': {
    fr: ' ↩️ Réflexion : {winner} recule aussi !',
    en: ' ↩️ Reflection: {winner} moves back too!',
  },

  // Fragments réutilisés
  'log.ft.reduced': { fr: ' (réduit)', en: ' (reduced)' },
};
