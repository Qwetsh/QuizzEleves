// Journal de partie — messages de recul (turnHelpers : applyRecul /
// resolveWrongAnswer / resolveDoubleQuestion). Clés log.turn.* ; vars {x}.
export default {
  'log.turn.reasonWrong': { fr: 'Mauvaise réponse', en: 'Wrong answer' },
  'log.turn.reasonTimeout': { fr: 'Temps écoulé', en: 'Time up' },

  // Messages composés (recul d'une mauvaise réponse / temps écoulé).
  'log.turn.wrong.buff': {
    fr: '❌ {reason} ! \u{1F6DF} Protégé (effet de durée) : pas de recul !',
    en: '❌ {reason}! \u{1F6DF} Protected (lasting effect): no setback!',
  },
  'log.turn.wrong.absorbed': {
    fr: '❌ {reason} ! \u{1F6E1}️ Recul totalement absorbé !{coins}',
    en: '❌ {reason}! \u{1F6E1}️ Setback fully absorbed!{coins}',
  },
  'log.turn.wrong.equip': {
    fr: "❌ {reason} ! \u{1F392} L'équipement absorbe le recul !",
    en: '❌ {reason}! \u{1F392} Equipment absorbs the setback!',
  },
  'log.turn.wrong.reduced': {
    fr: '❌ {reason} ! \u{1F6E1}️ Recul réduit à {cases}.{coins}',
    en: '❌ {reason}! \u{1F6E1}️ Setback reduced to {cases}.{coins}',
  },
  'log.turn.wrong.normal': {
    fr: '❌ {reason} ! Recul de {cases}.',
    en: '❌ {reason}! Setback of {cases}.',
  },
  'log.turn.wrong.forward': {
    fr: '❌ {reason} ! \u{1F6E1}️ Mais ton bouclier te fait AVANCER de {cases} !{coins}',
    en: '❌ {reason}! \u{1F6E1}️ But your shield makes you MOVE FORWARD {cases}!{coins}',
  },
  // Forteresse (Bouclier L10) hors mauvaise réponse (duel, boss, événement) : le recul devient une avance.
  'log.turn.fortressAdvance': {
    fr: '🏰 Forteresse ! {team} avance de {cases} au lieu de reculer.',
    en: '🏰 Fortress! {team} moves forward {cases} instead of back.',
  },

  // Question multiple (Double cumulable).
  'log.turn.multiQuestion': {
    fr: ['❓ Question multiple ! Encore {n} question...', '❓ Question multiple ! Encore {n} questions...'],
    en: ['❓ Multiple question! {n} more question...', '❓ Multiple question! {n} more questions...'],
  },

  // Étiquettes du détail dépliable (volet GameLog).
  'log.turn.detail.reculPrevu': { fr: 'Recul prévu', en: 'Setback expected' },
  'log.turn.detail.effetDuree': { fr: 'Effet de durée', en: 'Lasting effect' },
  'log.turn.detail.pasDeRecul': { fr: 'pas de recul', en: 'no setback' },
  'log.turn.detail.reculSubi': { fr: 'Recul subi', en: 'Setback taken' },
  'log.turn.detail.bouclierBois': { fr: 'Bouclier de bois', en: 'Wooden shield' },
  'log.turn.detail.bouclierNiv': { fr: 'Bouclier niv.{level}', en: 'Shield lv.{level}' },
  'log.turn.detail.bonusBouclier': { fr: 'Bonus du bouclier', en: 'Shield bonus' },
  'log.turn.detail.tresorGuerre': { fr: 'Trésor de guerre', en: 'War treasure' },
  'log.turn.detail.chargePlus': { fr: '+1 charge {power}', en: '+1 charge {power}' },
  'log.turn.detail.equipement': { fr: 'Équipement', en: 'Equipment' },
  'log.turn.detail.bouclierPassif': { fr: 'Bouclier (passif)', en: 'Shield (passive)' },
  'log.turn.detail.forteresse': { fr: 'Forteresse : recul annulé → avance', en: 'Fortress: setback cancelled → advance' },
  'log.turn.detail.avance': { fr: 'Avance', en: 'Advance' },
};
