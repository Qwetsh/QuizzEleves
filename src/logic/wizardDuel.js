// Moteur PUR du « Duel de sorciers » (Priori Incantatem — le beam struggle).
// Aucune dépendance React : un état sérialisable + des transitions, testables
// et réutilisables tels quels par le portage téléphone/en ligne (le store
// publiera `pos` + les seq d'animation, cf. WizardDuel.jsx).
//
// Modèle : un orbe lumineux sur un axe [0..100] entre les deux baguettes.
//   - 50 = centre (équilibre parfait) ;
//   - l'ATTAQUANT (à gauche) pousse l'orbe vers 100 = le camp du DÉFENSEUR ;
//   - le DÉFENSEUR (à droite) pousse l'orbe vers 0 = le camp de l'ATTAQUANT.
// Quand l'orbe ATTEINT un camp, ce camp est frappé → l'AUTRE gagne le duel :
//   - pos >= 100 → le défenseur est touché → winner: 'attacker' ;
//   - pos <=   0 → l'attaquant est touché → winner: 'defender'.

// Poussée par défaut d'une bonne réponse (en unités de position, sur 100).
export const WIZARD_PUSH = 18;

/**
 * Crée l'état initial d'un rai. `push` = poussée par bonne réponse.
 * @returns {{ pos: number, push: number, winner: 'attacker'|'defender'|null }}
 */
export function createBeam({ push = WIZARD_PUSH } = {}) {
  return { pos: 50, push, winner: null };
}

// Clamp utilitaire.
const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n);

/**
 * Applique une poussée d'un camp. `attacker` pousse l'orbe vers 100, `defender`
 * vers 0. `amount` remplace la poussée par défaut de l'état si fourni.
 * Une fois un vainqueur décidé, l'état est GELÉ (les poussées suivantes n'ont
 * plus d'effet — le duel est terminé).
 * @returns un NOUVEL état (immuable).
 */
export function pushBeam(state, side, amount) {
  if (!state || state.winner) return state;
  const step = Number.isFinite(amount) ? amount : state.push;
  const delta = side === 'attacker' ? step : -step;
  const pos = clamp(state.pos + delta, 0, 100);
  let winner = null;
  if (pos >= 100) winner = 'attacker'; // le défenseur (à 100) est frappé
  else if (pos <= 0) winner = 'defender'; // l'attaquant (à 0) est frappé
  return { ...state, pos, winner };
}

/**
 * Biais visuel de l'orbe vers le camp qui MÈNE : 0..1.
 *   - 0.5 au centre (pos = 50) ;
 *   - → 1 quand l'orbe fonce vers 100 (l'attaquant mène) ;
 *   - → 0 quand l'orbe fonce vers 0 (le défenseur mène).
 * Utilisé pour teinter l'orbe vers la couleur du meneur.
 */
export function beamSideBias(pos) {
  return clamp((pos ?? 50) / 100, 0, 1);
}

/** L'état a-t-il un vainqueur ? */
export function isWin(state) {
  return !!(state && state.winner);
}

/**
 * Réponse correcte ? `q` = { a:[...], c } (c = index de la bonne réponse, comme
 * fightPickQuestion). Helper optionnel pour le composant.
 */
export function checkAnswer(q, index) {
  return !!q && index === q.c;
}
