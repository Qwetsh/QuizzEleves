// Journal & toasts de l'extension MAGIE (sorts, runes, faces bénies/maudites).
export default {
  // — Cast de sorts (castSpellFor) —
  'log.magic.cast': { fr: '{emoji} {name} incante {icon} {spell} (−{cost} ✨)', en: '{emoji} {name} casts {icon} {spell} (−{cost} ✨)' },
  'log.magic.discover': { fr: '{emoji} {name} DÉCOUVRE le sort {icon} {spell} en expérimentant !', en: '{emoji} {name} DISCOVERS the spell {icon} {spell} by experimenting!' },
  'log.magic.fizzle': { fr: '{emoji} {name} trace une combinaison qui échoue… (−{cost} ✨)', en: '{emoji} {name} traces a combination that fizzles… (−{cost} ✨)' },
  'log.magic.noMana': { fr: '{emoji} {name} manque de magie pour incanter ({need} ✨ nécessaires)', en: '{emoji} {name} lacks magic to cast ({need} ✨ needed)' },
  'log.magic.noMana.toast': { fr: 'Magie insuffisante !', en: 'Not enough magic!' },
  'log.magic.cooldown': { fr: '{emoji} {name} incante trop vite — le sort se dissipe', en: '{emoji} {name} casts too fast — the spell dissipates' },

  // — Actions du moteur —
  'log.fx.gainMagic': { fr: '{emoji} {name} : +{n} ✨ magie', en: '{emoji} {name}: +{n} ✨ magic' },
  'log.fx.gainMagic.toast': { fr: '+{n} ✨ magie', en: '+{n} ✨ magic' },
  'log.fx.learnRune': { fr: '{emoji} {name} apprend la rune {icon} {rune} (codex)', en: '{emoji} {name} learns the {icon} {rune} rune (codex)' },
  'log.fx.learnRune.toast': { fr: 'Nouvelle rune au codex !', en: 'New rune in the codex!' },
  'log.fx.learnSpell': { fr: '{emoji} {name} apprend le sort {icon} {spell} (codex)', en: '{emoji} {name} learns the spell {icon} {spell} (codex)' },
  'log.fx.learnSpell.toast': { fr: 'Nouveau sort au codex !', en: 'New spell in the codex!' },
  'log.fx.blessFace': { fr: '{emoji} {name} : face {face} du dé BÉNIE (+{n} or quand elle tombe)', en: '{emoji} {name}: die face {face} BLESSED (+{n} gold when it lands)' },
  'log.fx.blessFace.toast': { fr: '✨ Face {face} bénie !', en: '✨ Face {face} blessed!' },
  'log.fx.curseFace': { fr: '{emoji} {name} : face {face} du dé MAUDITE (−{n} or quand elle tombe)', en: '{emoji} {name}: die face {face} CURSED (−{n} gold when it lands)' },
  'log.fx.curseFace.toast': { fr: '☠️ Face {face} maudite !', en: '☠️ Face {face} cursed!' },
  'log.fx.cleanseFaces': { fr: '{emoji} {name} : le dé est purifié ({n} marque(s) dissipée(s))', en: '{emoji} {name}: the die is cleansed ({n} mark(s) dispelled)' },
  'log.fx.cleanseFaces.toast': { fr: '💧 Dé purifié', en: '💧 Die cleansed' },
  'log.fx.unstable': { fr: 'les réponses deviendront INSTABLES à la prochaine question (toutes les {n}s)', en: 'answers will become UNSTABLE on the next question (every {n}s)' },
  'log.fx.unstable.toast': { fr: '🌫️ Réponses instables !', en: '🌫️ Unstable answers!' },

  // — Résolution au lancer (handleDiceResult) —
  'log.magic.faceBlessHit': { fr: '{emoji} {name} : la face {face} bénie rapporte +{n} or ✨', en: '{emoji} {name}: blessed face {face} grants +{n} gold ✨' },
  'log.magic.faceCurseHit': { fr: '{emoji} {name} : la face {face} maudite coûte −{n} or ☠️', en: '{emoji} {name}: cursed face {face} costs −{n} gold ☠️' },
  'log.magic.faceBlessHit.toast': { fr: '✨ Face bénie : +{n} or', en: '✨ Blessed face: +{n} gold' },
  'log.magic.faceCurseHit.toast': { fr: '☠️ Face maudite : −{n} or', en: '☠️ Cursed face: −{n} gold' },

  // — Loot de runes (bonne réponse) —
  'log.magic.runeLoot': { fr: '{emoji} {name} déchiffre une rune sur la case : {icon} {rune} !', en: '{emoji} {name} deciphers a rune on the space: {icon} {rune}!' },
};
