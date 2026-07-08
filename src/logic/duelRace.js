// « Duel éclair » — résolution de duel pour le mode « jeu en ligne ».
// En classe, les duels se jouent en mini-jeux sur le TBI partagé. À distance,
// chaque duelliste est sur son écran : on remplace le mini-jeu par une COURSE À
// LA QUESTION — les deux reçoivent la même question, le PREMIER à répondre juste
// gagne la manche (best-of-3 via le flux de combat existant). Marche pour tous
// les thèmes et réutilise l'anti-triche du système de questions.
//
// Ce module est PUR (arbitrage d'une réponse), pour être testé sans store.

// Décide ce qu'il advient quand un camp vient de répondre :
//   'win'    → ce camp a répondu JUSTE le premier → il gagne la manche
//   'replay' → faux, et l'autre camp a déjà répondu (faux aussi) → nouvelle question
//   'wait'   → faux, mais on attend encore la réponse de l'autre camp
export function raceOutcomeOnAnswer({ index, correctIndex, otherAnswered }) {
  if (index === correctIndex) return 'win';
  if (otherAnswered) return 'replay';
  return 'wait';
}

// Timeout de la question sans réponse juste : on rejoue une nouvelle question
// (personne ne marque la manche). Renvoie 'replay'.
export function raceOutcomeOnTimeout() {
  return 'replay';
}

// Le camp opposé (pour lire l'autre réponse).
export function otherSide(side) {
  return side === 'attacker' ? 'defender' : 'attacker';
}
