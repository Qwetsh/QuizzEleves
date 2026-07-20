// Moteur PUR du mini-jeu « Échecs — mat en N » (thème maths_logique).
// Aucune dépendance React, aucun Math.random : l'aléa (tirage du puzzle,
// anti-répétition) vit dans le COMPOSANT. Ici on ne fait que dérouler la
// solution d'un puzzle contre les coups proposés par le joueur.
//
// SCHÉMA d'un puzzle (src/data/chessPuzzles.json → { puzzles: [...] }) :
//   { id, fen, solution:[uci...], mateIn:1|2, sideToMove:'w'|'b', rating }
//   - `fen`      = position AU TRAIT DU SOLVEUR (déjà normalisée).
//   - `sideToMove` = couleur du solveur ('w'|'b') = orientation du plateau.
//   - `solution` UCI :
//       index 0 (et 2) = coups du SOLVEUR ;
//       index 1        = riposte adverse AUTO (mat en 2 uniquement).
//       Longueur 1 (mat en 1) ou 3 (mat en 2). Dernier coup solveur = mat.
//   - UCI « e7e8q » → { from:'e7', to:'e8', promotion:'q' }.
import { Chess } from 'chess.js';

// Décompose un coup UCI (« g1f3 », « e7e8q ») en { from, to, promotion? }.
export function parseUci(uci) {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4].toLowerCase() : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

// Crée l'état de jeu d'un puzzle. `chess` est positionné à la FEN du puzzle
// (au trait du solveur). `step` = index dans `solution` du prochain coup ATTENDU
// du solveur (0, puis 2 pour le 2e coup d'un mat en 2).
export function createPuzzleState(puzzle) {
  return {
    chess: new Chess(puzzle.fen),
    puzzle,
    step: 0,
    solved: false,
    orientation: puzzle.sideToMove,
  };
}

// Coup solveur attendu à l'étape courante, en { from, to, promotion? } (ou null
// si le puzzle est déjà résolu / index hors solution).
export function expectedSolverMove(state) {
  const uci = state.puzzle.solution[state.step];
  return uci ? parseUci(uci) : null;
}

// Matrice 8x8 de la position courante (chess.js board()), pour le rendu.
export function boardMatrix(state) {
  return state.chess.board();
}

// Deux coups sont-ils « le même » ? On compare from/to, et la promotion en
// tolérant l'implicite : si le coup attendu ne promeut PAS, on ignore la
// promotion proposée ; s'il promeut, on EXIGE la bonne pièce (défaut 'q').
function sameMove(proposed, expected) {
  if (proposed.from !== expected.from || proposed.to !== expected.to) return false;
  if (!expected.promotion) return true;
  const got = (proposed.promotion || 'q').toLowerCase();
  return got === expected.promotion.toLowerCase();
}

// Le coup { from, to } est-il légal dans la position courante ? (sans muter).
function isLegal(chess, move) {
  return chess.moves({ verbose: true })
    .some((m) => m.from === move.from && m.to === move.to);
}

/**
 * Tente le coup { from, to, promotion? } du solveur. Renvoie un VERDICT et ne
 * mute l'état QUE sur un coup correct :
 *   - { illegal:true }  : coup non légal dans la position — position INCHANGÉE.
 *   - { wrong:true }    : coup légal mais ≠ coup attendu — position INCHANGÉE
 *                         (on ne le joue JAMAIS, sinon le puzzle serait cassé).
 *   - mat en 1 (ou 2e coup d'un mat en 2) correct → applique le coup :
 *       { solved:true, san }
 *   - 1er coup d'un mat en 2 correct → applique le coup PUIS la riposte adverse
 *     auto (solution[1]) et avance `step` à 2 :
 *       { advanced:true, san, oppSan, oppMove:{ from, to, promotion? } }
 */
export function attempt(state, move) {
  if (state.solved) return { wrong: true };
  const expected = expectedSolverMove(state);
  if (!expected) return { wrong: true };

  // 1) Légalité d'abord : un coup illégal ne pénalise pas et ne mute rien.
  if (!isLegal(state.chess, move)) return { illegal: true };

  // 2) Est-ce LE coup attendu de la solution ?
  if (!sameMove(move, expected)) return { wrong: true };

  // 3) Correct : on applique le coup solveur.
  const solverMove = state.chess.move({
    from: expected.from, to: expected.to,
    promotion: expected.promotion || 'q',
  });

  // Dernier coup de la solution → mat.
  const isLastSolverStep = state.step + 1 >= state.puzzle.solution.length;
  if (isLastSolverStep || state.chess.isCheckmate()) {
    state.solved = true;
    state.step += 1;
    return { solved: true, san: solverMove.san };
  }

  // Sinon (mat en 2, 1er coup) : on joue la riposte adverse automatique.
  const opp = parseUci(state.puzzle.solution[state.step + 1]);
  const oppMove = state.chess.move({
    from: opp.from, to: opp.to, promotion: opp.promotion || 'q',
  });
  state.step += 2; // le prochain coup attendu du solveur est solution[2]
  return {
    advanced: true,
    san: solverMove.san,
    oppSan: oppMove.san,
    oppMove: { from: opp.from, to: opp.to, promotion: opp.promotion },
  };
}
