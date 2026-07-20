// Moteur pur du mini-jeu « Échecs — mat en N ». Fixtures INLINE (on ne dépend
// pas du vrai chessPuzzles.json, produit par un agent parallèle). Chaque FEN est
// au trait du solveur ; les coups sont vérifiés au moteur chess.js.
import { describe, it, expect } from 'vitest';
import {
  createPuzzleState, attempt, expectedSolverMove, boardMatrix, parseUci,
} from '../logic/chessPuzzle.js';

// Mat en 1 : « back-rank mate ». Blancs Tour a1, Roi h2 ; Noirs Roi g8 enfermé
// par ses pions f7/g7/h7. Ta1-a8 est échec et mat.
const MATE_IN_1 = {
  id: 'test-m1',
  fen: '6k1/5ppp/8/8/8/8/7K/R7 w - - 0 1',
  solution: ['a1a8'],
  mateIn: 1,
  sideToMove: 'w',
  rating: 800,
};

// Mat en 1 par les NOIRS (orientation 'b') : Tour a8, Roi h7 ; Blancs Roi g1
// enfermé par f2/g2/h2. Ta8-a1 est mat.
const MATE_IN_1_BLACK = {
  id: 'test-m1b',
  fen: 'r7/7k/8/8/8/8/5PPP/6K1 b - - 0 1',
  solution: ['a8a1'],
  mateIn: 1,
  sideToMove: 'b',
  rating: 800,
};

// Mat en 2 FORCÉ (roi et dame contre roi) : Dame f6, Roi g6 ; Noirs Roi h8.
// 1.Qf6-f7+ échec → la SEULE case du Roi noir est g8 (Kh8-g8) → 2.Qf7-d8 mat.
// La riposte g8 est l'unique coup légal (mat en 2 propre, vérifié à chess.js).
const MATE_IN_2 = {
  id: 'test-m2',
  fen: '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1',
  solution: ['f7f6', 'h8g8', 'f6d8'],
  mateIn: 2,
  sideToMove: 'w',
  rating: 1200,
};

// Mat en 1 par promotion : pion b7, Tour a1, Roi h2 ; Noirs Roi h8, pions g7/h7.
// b7b8=D est mat (la Dame b8 + tour... en fait vérifions la mécanique de promo
// via un coup légal qui promeut). On teste surtout la NORMALISATION de promotion.
const PROMO_MATE = {
  id: 'test-promo',
  fen: '7k/1P4pp/8/8/8/8/6RK/8 w - - 0 1',
  solution: ['b7b8q'],
  mateIn: 1,
  sideToMove: 'w',
  rating: 900,
};

describe('chessPuzzle — parseUci', () => {
  it('décompose from/to et la promotion', () => {
    expect(parseUci('g1f3')).toEqual({ from: 'g1', to: 'f3' });
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });
});

describe('chessPuzzle — état initial et orientation', () => {
  it('crée un état au trait du solveur, orienté selon sideToMove', () => {
    const w = createPuzzleState(MATE_IN_1);
    expect(w.orientation).toBe('w');
    expect(w.chess.turn()).toBe('w');
    expect(w.step).toBe(0);
    expect(w.solved).toBe(false);
    expect(boardMatrix(w).length).toBe(8);

    const b = createPuzzleState(MATE_IN_1_BLACK);
    expect(b.orientation).toBe('b');
    expect(b.chess.turn()).toBe('b');
    expect(expectedSolverMove(b)).toEqual({ from: 'a8', to: 'a1' });
  });
});

describe('chessPuzzle — mat en 1', () => {
  it('le bon coup résout (solved + san)', () => {
    const s = createPuzzleState(MATE_IN_1);
    const v = attempt(s, { from: 'a1', to: 'a8' });
    expect(v.solved).toBe(true);
    expect(typeof v.san).toBe('string');
    expect(v.san).toContain('#'); // notation de mat
    expect(s.solved).toBe(true);
    expect(s.chess.isCheckmate()).toBe(true);
  });

  it('les Noirs (orientation b) résolvent aussi', () => {
    const s = createPuzzleState(MATE_IN_1_BLACK);
    const v = attempt(s, { from: 'a8', to: 'a1' });
    expect(v.solved).toBe(true);
    expect(s.chess.isCheckmate()).toBe(true);
  });
});

describe('chessPuzzle — coup légal mais faux', () => {
  it('renvoie { wrong } et laisse la position INCHANGÉE', () => {
    const s = createPuzzleState(MATE_IN_1);
    const fen0 = s.chess.fen();
    // Ta1-a7 est légal mais n'est pas le mat.
    const v = attempt(s, { from: 'a1', to: 'a7' });
    expect(v.wrong).toBe(true);
    expect(v.solved).toBeUndefined();
    expect(s.chess.fen()).toBe(fen0); // rien joué
    expect(s.step).toBe(0);
    // On peut toujours jouer le bon coup ensuite.
    expect(attempt(s, { from: 'a1', to: 'a8' }).solved).toBe(true);
  });
});

describe('chessPuzzle — coup illégal', () => {
  it('renvoie { illegal } et ne mute rien', () => {
    const s = createPuzzleState(MATE_IN_1);
    const fen0 = s.chess.fen();
    // Ta1-b8 : la tour ne peut pas sauter en diagonale.
    const v = attempt(s, { from: 'a1', to: 'b8' });
    expect(v.illegal).toBe(true);
    expect(s.chess.fen()).toBe(fen0);
    // Déplacer une pièce adverse = illégal aussi.
    expect(attempt(s, { from: 'g8', to: 'f8' }).illegal).toBe(true);
  });
});

describe('chessPuzzle — mat en 2 (riposte auto)', () => {
  it('1er coup correct → joue la riposte adverse, avance ; 2e coup mate', () => {
    const s = createPuzzleState(MATE_IN_2);
    const v1 = attempt(s, { from: 'f7', to: 'f6' });
    expect(v1.advanced).toBe(true);
    expect(typeof v1.san).toBe('string');
    expect(typeof v1.oppSan).toBe('string');
    expect(v1.oppMove).toEqual({ from: 'h8', to: 'g8', promotion: undefined });
    expect(s.step).toBe(2);
    expect(s.solved).toBe(false);
    // La riposte adverse a bien été jouée → c'est de nouveau au solveur.
    expect(s.chess.turn()).toBe('w');
    expect(expectedSolverMove(s)).toEqual({ from: 'f6', to: 'd8' });

    // 2e coup solveur = mat.
    const v2 = attempt(s, { from: 'f6', to: 'd8' });
    expect(v2.solved).toBe(true);
    expect(s.chess.isCheckmate()).toBe(true);
  });

  it('mauvais 1er coup d\'un mat en 2 = { wrong }, position intacte', () => {
    const s = createPuzzleState(MATE_IN_2);
    const fen0 = s.chess.fen();
    const v = attempt(s, { from: 'g6', to: 'g5' }); // Roi légal mais pas la solution
    expect(v.wrong).toBe(true);
    expect(s.chess.fen()).toBe(fen0);
    expect(s.step).toBe(0);
  });
});

describe('chessPuzzle — promotion', () => {
  it('promotion exigée : la bonne pièce résout', () => {
    const s = createPuzzleState(PROMO_MATE);
    const v = attempt(s, { from: 'b7', to: 'b8', promotion: 'q' });
    expect(v.solved).toBe(true);
  });

  it('promotion implicite (from/to seuls) tolérée quand la Dame est attendue', () => {
    const s = createPuzzleState(PROMO_MATE);
    const v = attempt(s, { from: 'b7', to: 'b8' }); // pas de promotion fournie
    expect(v.solved).toBe(true);
  });

  it('sous-promotion (cavalier) refusée comme fausse quand la Dame est attendue', () => {
    const s = createPuzzleState(PROMO_MATE);
    const fen0 = s.chess.fen();
    const v = attempt(s, { from: 'b7', to: 'b8', promotion: 'n' });
    expect(v.wrong).toBe(true);
    expect(s.chess.fen()).toBe(fen0);
  });
});
