// Journal de partie — messages localisés (FR/EN) pour powerHandlers.js.
// Clés namespacées log.pw.* ; vars interpolées via {x}.
export default {
  // --- Indice ---
  'log.pw.silenced':        { fr: '🔇 {emoji} {name} est réduit au silence : aucun pouvoir ce tour-ci.',
                              en: '🔇 {emoji} {name} is silenced: no power this turn.' },
  'log.pw.powersBlocked':   { fr: ['🚫 {emoji} {name} : pouvoirs bloqués ({n} tour) !', '🚫 {emoji} {name} : pouvoirs bloqués ({n} tours) !'],
                              en: ['🚫 {emoji} {name}: powers blocked ({n} turn)!', '🚫 {emoji} {name}: powers blocked ({n} turns)!'] },
  'log.pw.foudreReflected': { fr: '↩️ {vemoji} {vname} RENVOIE la Foudre sur {aemoji} {aname} !', en: '↩️ {vemoji} {vname} REFLECTS the Lightning onto {aemoji} {aname}!' },
  'log.pw.indiceAllGone':   { fr: '💡 {emoji} {name} : toutes les mauvaises réponses sont déjà éliminées.',
                              en: '💡 {emoji} {name}: all wrong answers are already eliminated.' },
  'log.pw.indiceUse':       { fr: ['💡 {emoji} {name} utilise {power} (niv.{level}) ! {n} réponse éliminée{bonus}.', '💡 {emoji} {name} utilise {power} (niv.{level}) ! {n} réponses éliminées{bonus}.'],
                              en: ['💡 {emoji} {name} uses {power} (lvl.{level})! {n} answer eliminated{bonus}.', '💡 {emoji} {name} uses {power} (lvl.{level})! {n} answers eliminated{bonus}.'] },
  'log.pw.indiceToast':     { fr: ['{power} — {n} réponse éliminée{bonus}', '{power} — {n} réponses éliminées{bonus}'],
                              en: ['{power} — {n} answer eliminated{bonus}', '{power} — {n} answers eliminated{bonus}'] },
  'log.pw.bonusTime':       { fr: ' (+{n}s)', en: ' (+{n}s)' },

  // --- Relance ---
  'log.pw.relanceUse':      { fr: '🎲 {emoji} {name} utilise {power} (niv.{level}) !',
                              en: '🎲 {emoji} {name} uses {power} (lvl.{level})!' },
  'log.pw.relanceToast':    { fr: '{emoji} {name} relance le dé !', en: '{emoji} {name} rerolls the die!' },
  'log.pw.relanceResult':   { fr: '🎲 {power} : {value} !{effective}', en: '🎲 {power}: {value}!{effective}' },
  'log.pw.relanceEffective':{ fr: ' (effectif: {value})', en: ' (effective: {value})' },
  'log.pw.surcharge':       { fr: '✨ Surcharge : +1 charge de {power} !', en: '✨ Overload: +1 charge of {power}!' },
  // Arbre de Maîtrise « Relance »
  'log.pw.relanceRefund':   { fr: '↩️ Remboursement : charge de {power} récupérée !', en: '↩️ Refund: {power} charge recovered!' },
  'log.pw.relanceGold':     { fr: '🪙 Relance lucrative : +{n} or !', en: '🪙 Lucrative reroll: +{n} gold!' },
  'log.pw.relanceOpportune':{ fr: '⏱️ Relance opportune : ta prochaine question est avantagée.', en: '⏱️ Timely reroll: your next question is boosted.' },
  'log.pw.relanceVengeful': { fr: '⚔️ Relance vengeresse : {emoji} {name} recule de {n} !', en: '⚔️ Vengeful reroll: {emoji} {name} pushed back {n}!' },
  'log.pw.relanceLate':     { fr: '🐢 Élan du retardataire : {emoji} {name} gagne 1 charge de relance.', en: '🐢 Underdog’s surge: {emoji} {name} gains 1 reroll charge.' },
  'log.pw.relanceSwap':     { fr: '🔄 {emoji} {name} échange sa place avec {vemoji} {vname} !', en: '🔄 {emoji} {name} swaps places with {vemoji} {vname}!' },
  // Arbre de Maîtrise « Bouclier »
  'log.pw.immuneBlock':     { fr: '🛡️ {emoji} {name} est immunisé : {power} n’a aucun effet !', en: '🛡️ {emoji} {name} is immune: {power} has no effect!' },
  'log.pw.immuneToast':     { fr: '{emoji} Immunité totale !', en: '{emoji} Total immunity!' },
  'log.pw.immuneCast':      { fr: '🛡️ {emoji} {name} active l’Immunité totale ({turns} tours) !', en: '🛡️ {emoji} {name} activates Total Immunity ({turns} turns)!' },
  'log.pw.clairvoyance':    { fr: '🔮 {emoji} {name} active la Clairvoyance : la bonne réponse est révélée ce tour !', en: '🔮 {emoji} {name} activates Clairvoyance: the correct answer is revealed this turn!' },
  'log.pw.clairvoyanceToast': { fr: '🔮 Clairvoyance !', en: '🔮 Clairvoyance!' },
  'log.pw.sablierBrokenCast': { fr: '⏱️ {emoji} {name} brise le sablier : timer max des autres réduit à {n}s !', en: '⏱️ {emoji} {name} breaks the hourglass: others’ max timer reduced to {n}s!' },
  'log.pw.sablierBrokenToast': { fr: '⏱️ Sablier brisé — {n}s max', en: '⏱️ Broken hourglass — {n}s max' },
  'log.pw.surgePush':       { fr: '⏩ Sur-réduction : {vemoji} {vname} recule de {n} !', en: '⏩ Overcharge: {vemoji} {vname} pushed back {n}!' },
  'log.pw.goldVault':       { fr: '🏦 Banque fortifiée : l’or de {emoji} {name} est protégé.', en: '🏦 Fortified vault: {emoji} {name}’s gold is protected.' },

  // --- Offensif : fumigène ---
  'log.pw.fumigeneBlock':   { fr: '💨 La bombe fumigène de {emoji} {name} annule {power} !',
                              en: "💨 {emoji} {name}'s smoke bomb cancels {power}!" },
  'log.pw.fumigeneToast':   { fr: '{emoji} Contré par le fumigène !', en: '{emoji} Blocked by the smoke bomb!' },

  // --- Foudre ---
  'log.pw.orage':           { fr: '🌩️ {emoji} {name} prépare un Orage : choisis une case piégée !',
                              en: '🌩️ {emoji} {name} prepares a Storm: pick a trapped space!' },
  'log.pw.foudreUseMany':   { fr: '⚡ {emoji} {name} utilise {power} (niv.{level}, {die}) sur {nT} équipes !{steal}{reflect}',
                              en: '⚡ {emoji} {name} uses {power} (lvl.{level}, {die}) on {nT} teams!{steal}{reflect}' },
  'log.pw.foudreUseOne':    { fr: '⚡ {emoji} {name} utilise {power} (niv.{level}, {die}) sur {vemoji} {vname} !{steal}{reflect}',
                              en: '⚡ {emoji} {name} uses {power} (lvl.{level}, {die}) on {vemoji} {vname}!{steal}{reflect}' },
  'log.pw.foudreSteal':     { fr: ' Vol de {n} or.', en: ' Stole {n} gold.' },
  'log.pw.foudreReflect':   { fr: ' ↩️ Recul réfléchi !', en: ' ↩️ Setback reflected!' },
  'log.pw.foudreToastMany': { fr: '{power} {die} ×{nT}', en: '{power} {die} ×{nT}' },
  'log.pw.foudreToastOne':  { fr: '{power} {die} sur {vemoji} {vname}', en: '{power} {die} on {vemoji} {vname}' },

  // --- Sablier ---
  'log.pw.sablierUseMany':  { fr: '⏱️ {emoji} {name} utilise {power} (niv.{level}) sur {nS} équipes ! Timer /{divisor}{extras}.',
                              en: '⏱️ {emoji} {name} uses {power} (lvl.{level}) on {nS} teams! Timer /{divisor}{extras}.' },
  'log.pw.sablierUseOne':   { fr: '⏱️ {emoji} {name} utilise {power} (niv.{level}) sur {vemoji} {vname} ! Timer /{divisor}{extras}.',
                              en: '⏱️ {emoji} {name} uses {power} (lvl.{level}) on {vemoji} {vname}! Timer /{divisor}{extras}.' },
  'log.pw.sablierSilence':  { fr: ' · 🔇 Silence', en: ' · 🔇 Silence' },
  'log.pw.sablierFreeze':   { fr: ' · 🧊 Gel du lancer', en: ' · 🧊 Roll freeze' },
  'log.pw.sablierTax':      { fr: ' · 💸 Taxe {n}', en: ' · 💸 Tax {n}' },
  'log.pw.sablierLarcin':   { fr: ' · 🗡️ Larcin', en: ' · 🗡️ Larceny' },
  'log.pw.sablierModeleur': { fr: ' · 🌀 Modeleur', en: ' · 🌀 Space shaper' },
  'log.pw.sablierBroken':   { fr: ' · ⏱️ Timer max {n}s', en: ' · ⏱️ Max timer {n}s' },
  'log.pw.sablierSelf':     { fr: '⏳ {emoji} {name} utilise {power} sur lui-même : +{n}s à sa prochaine question.', en: '⏳ {emoji} {name} uses {power} on itself: +{n}s on its next question.' },
  'log.pw.sablierSelfToast':{ fr: '⏳ +{n}s', en: '⏳ +{n}s' },
  'log.pw.sablierLarcinSteal': { fr: '🗡️ {aemoji} {aname} vole {item} à {vemoji} {vname} (Larcin) !', en: '🗡️ {aemoji} {aname} steals {item} from {vemoji} {vname} (Larceny)!' },
  'log.pw.glaneur':         { fr: '🪙 {emoji} {name} glane {n} or non gagné.', en: '🪙 {emoji} {name} gleans {n} unearned gold.' },
  'log.pw.sablierToastMany':{ fr: '{power} /{divisor} ×{nS}', en: '{power} /{divisor} ×{nS}' },
  'log.pw.sablierToastOne': { fr: '{power} /{divisor} sur {vemoji} {vname}', en: '{power} /{divisor} on {vemoji} {vname}' },

  // --- Double ---
  'log.pw.doubleUse':       { fr: ['❓ {emoji} {name} utilise {power} (niv.{level}) sur {vemoji} {vname} ! +{add} question ({total} au total).{noBonus}{timer}', '❓ {emoji} {name} utilise {power} (niv.{level}) sur {vemoji} {vname} ! +{add} questions ({total} au total).{noBonus}{timer}'],
                              en: ['❓ {emoji} {name} uses {power} (lvl.{level}) on {vemoji} {vname}! +{add} question ({total} total).{noBonus}{timer}', '❓ {emoji} {name} uses {power} (lvl.{level}) on {vemoji} {vname}! +{add} questions ({total} total).{noBonus}{timer}'] },
  'log.pw.doubleNoBonus':   { fr: ' (sans bonus)', en: ' (no bonus)' },
  'log.pw.doubleTimer':     { fr: ' Timer /{n} !', en: ' Timer /{n}!' },
  'log.pw.doubleAll':       { fr: 'toutes les équipes ({n})', en: 'all teams ({n})' },
  'log.pw.doubleCorsees':   { fr: ' · 🔥 Corsées', en: ' · 🔥 Tough' },
  'log.pw.doubleSaboteur':  { fr: ' · 💸 Saboteur', en: ' · 💸 Saboteur' },
  'log.pw.doubleShared':    { fr: ' · 🕐 Temps commun', en: ' · 🕐 Shared time' },
  'log.pw.doubleReport':    { fr: ' · 📋 Report', en: ' · 📋 Carry-over' },
  'log.pw.doubleSaboteurHit': { fr: '💸 Saboteur : {emoji} {name} perd {gold} or{recul}.', en: '💸 Saboteur: {emoji} {name} loses {gold} gold{recul}.' },
  'log.pw.doubleSaboteurRecul': { fr: ' et recule de {n} cases', en: ' and moves back {n} spaces' },
  'log.pw.doubleReportHit': { fr: '📋 Report : {n} question(s) reportée(s) au prochain tour de {emoji} {name}.', en: '📋 Carry-over: {n} question(s) moved to {emoji} {name}\'s next turn.' },
  'log.pw.doubleToast':     { fr: ['{power} sur {vemoji} {vname} — {total} question', '{power} sur {vemoji} {vname} — {total} questions'],
                              en: ['{power} on {vemoji} {vname} — {total} question', '{power} on {vemoji} {vname} — {total} questions'] },

  // --- Recharge (gainCharge) ---
  'log.pw.gainCharge':      { fr: '✨ {emoji} {name} gagne 1 charge de {power} !', en: '✨ {emoji} {name} gains 1 charge of {power}!' },
  'log.pw.gainChargeN':     { fr: '✨ {emoji} {name} gagne {n} charges de {power} !', en: '✨ {emoji} {name} gains {n} charges of {power}!' },

  // --- Boutique (shop) ---
  'log.pw.unlock':          { fr: '🛒 {emoji} {name} débloque {power} ! (-{price} 💰)', en: '🛒 {emoji} {name} unlocks {power}! (-{price} 💰)' },
  'log.pw.buyCharge':       { fr: '🛒 {emoji} {name} achète 1 charge de {power} ({price} 💰)', en: '🛒 {emoji} {name} buys 1 charge of {power} ({price} 💰)' },
  'log.pw.upgrade':         { fr: '⬆️ {emoji} {name} améliore {power} au niveau {level} ! (-{cost} 💰)', en: '⬆️ {emoji} {name} upgrades {power} to level {level}! (-{cost} 💰)' },

  // --- Choix de voie (spec) ---
  'log.pw.specChosen':      { fr: '{icon} {emoji} {name} — {power} : voie « {spec} » choisie !', en: '{icon} {emoji} {name} — {power}: path "{spec}" chosen!' },
};
