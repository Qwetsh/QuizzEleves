// Duel d'ÉCHECS « mat en N » multi-surface, PILOTÉ PAR LE STORE. Contrairement à
// memory/pkmn (téléphone seulement), il tourne AUSSI en ligne : chaque camp voit
// SA position (fen public) et propose son coup via l'intent turnChessMove
// (chessDuelMove). L'hôte est l'autorité : moteur logic/chessPuzzle, minuteries
// de secousse / révélation, victoire de manche (BO3). Le SECRET (solution UCI +
// chess.js par camp) reste module-level → jamais publié.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { buildTurnPayload } from '../logic/sessionConfig.js';
import { CHESS_WRONG_HOLD_MS, CHESS_REVEAL_MS } from '../store/chessFightHandlers.js';
import chessData from '../data/chessPuzzles.json';
import { Chess } from 'chess.js';

const S = () => useGameStore.getState();

// Le thème `maths_logique` résout le moteur `chess` (cf. THEME_MINIGAMES).
function startChessDuel(surface = 'phone') {
  useGameStore.setState({
    phase: 'setup', devSandbox: false, _devRestore: null,
    connectionMode: 'board', phoneController: false, sessionCode: null,
    showFight: null, finished: false, log: [],
  });
  S().devStartFight('maths_logique', false, surface);
  S().fightBegin();
}

// Retrouve le puzzle joué par un camp à partir de la fen publiée (position de
// départ du puzzle) → sa solution UCI (le secret n'est pas exposé par le store).
function solutionFor(side) {
  const fen = S().showFight.chess.sides[side].fen;
  const puzzle = chessData.puzzles.find((p) => p.fen === fen);
  return puzzle ? puzzle.solution : null;
}
function uciMove(uci) {
  const from = uci.slice(0, 2), to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci[4] : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}
// Coup ILLÉGAL garanti dans la position d'un camp : on cherche une paire
// from→to ABSENTE de la liste des coups légaux (via chess.js jetable).
function illegalMove(side) {
  const fen = S().showFight.chess.sides[side].fen;
  const c = new Chess(fen);
  const legal = new Set(c.moves({ verbose: true }).map((m) => m.from + m.to));
  const cells = [];
  for (const f of '12345678') for (const col of 'abcdefgh') cells.push(col + f);
  for (const from of cells) for (const to of cells) {
    if (from !== to && !legal.has(from + to)) return { from, to };
  }
  return { from: 'a1', to: 'a1' };
}
// Trouve un coup LÉGAL ≠ `avoidUci` dans la position `fen`, via une instance
// chess.js jetable (le moteur du duel ne joue jamais un coup faux, on le calcule
// ici pour le test).
function findLegalWrong(fen, avoidUci) {
  const c = new Chess(fen);
  const moves = c.moves({ verbose: true });
  const avoidFrom = avoidUci.slice(0, 2), avoidTo = avoidUci.slice(2, 4);
  const m = moves.find((mv) => !(mv.from === avoidFrom && mv.to === avoidTo));
  return m ? { from: m.from, to: m.to } : null;
}

describe('duel d\'échecs multi-surface (showFight.chess)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('surface téléphone : fightBegin distribue un duel piloté par le store, un puzzle par camp', () => {
    startChessDuel('phone');
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.chess).toBeTruthy();
    expect(f.chess.roundNo).toBe(1);
    expect(f.chess.mateIn).toBe(1);
    expect(f.chess.sides.attacker.fen).toBeTruthy();
    expect(f.chess.sides.defender.fen).toBeTruthy();
    // Chaque camp a SON propre puzzle (pas la même position → pas de copie).
    // (Anti-répétition par camp : deux tirages distincts, rarement égaux.)
    expect(solutionFor('attacker')).toBeTruthy();
    expect(solutionFor('defender')).toBeTruthy();
  });

  it('surface en ligne : le duel d\'échecs démarre AUSSI (pas de repli éclair)', () => {
    startChessDuel('online');
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.chess).toBeTruthy();      // chess a bien démarré en ligne
    expect(f.race).toBeFalsy();        // PAS le duel éclair de repli
  });

  it('coup illégal : secousse (shakeSeq++), position inchangée, pas de verrou', () => {
    startChessDuel('phone');
    const before = S().showFight.chess.sides.attacker;
    S().chessDuelMove('attacker', illegalMove('attacker'));
    const after = S().showFight.chess.sides.attacker;
    expect(after.shakeSeq).toBe((before.shakeSeq || 0) + 1);
    expect(after.fen).toBe(before.fen);   // position inchangée
    expect(after.locked).toBe(false);     // pas de blocage sur un illégal
  });

  it('coup légal mais faux : verrou posé puis relevé après la minuterie', () => {
    startChessDuel('phone');
    const side = 'attacker';
    const host = S().showFight.chess.sides[side];
    // Cherche un coup LÉGAL ≠ solution : on l'obtient via le moteur en testant
    // les poussées de pions, puis on choisit celui qui n'est pas le 1er coup solution.
    const sol = solutionFor(side);
    const wrong = findLegalWrong(host.fen, sol[0]);
    expect(wrong).toBeTruthy();
    S().chessDuelMove(side, wrong);
    expect(S().showFight.chess.sides[side].locked).toBe(true);
    expect(S().showFight.chess.sides[side].fen).toBe(host.fen); // position inchangée
    vi.advanceTimersByTime(CHESS_WRONG_HOLD_MS);
    expect(S().showFight.chess.sides[side].locked).toBe(false); // verrou relevé
  });

  it('mat en 1 correct : révélation du vainqueur puis manche marquée (BO3) + manche neuve', () => {
    startChessDuel('phone');
    const sol = solutionFor('attacker');
    S().chessDuelMove('attacker', uciMove(sol[0]));
    // Révélation immédiate du vainqueur.
    expect(S().showFight.chess.reveal).toEqual({ winner: 'attacker' });
    expect(S().showFight.wins.attacker).toBe(0); // pas encore marqué (révélation)
    vi.advanceTimersByTime(CHESS_REVEAL_MS);
    expect(S().showFight.wins.attacker).toBe(1); // manche marquée
    // Le combat continue (BO3) → nouvelle manche propre, reveal purgé.
    const nc = S().showFight.chess;
    expect(nc.reveal).toBeNull();
    expect(nc.roundNo).toBe(2);
  });

  it('anti-triche : le payload publie la position (fen) mais AUCUNE solution', () => {
    startChessDuel('phone');
    const chess = buildTurnPayload(S()).fight.chess;
    expect(chess).toBeTruthy();
    expect(chess.sides.attacker.fen).toBeTruthy(); // position visible : OK
    // Aucun champ « solution » ne fuit dans le payload (le secret est module-level).
    const blob = JSON.stringify(chess);
    expect(blob).not.toContain('solution');
    expect(chess.sides.attacker.solution).toBeUndefined();
    expect(chess.sides.defender.solution).toBeUndefined();
  });

  it('un intent turnChessMove est mappé au bon camp par jeton (pas de contrôle adverse)', () => {
    startChessDuel('phone');
    const f = S().showFight;
    const solAtt = solutionFor('attacker');
    // Le DÉFENSEUR (idx = defenderIndex) tente le coup gagnant de l'ATTAQUANT :
    // le routeur d'intents le mappe sur SON propre camp → n'affecte pas l'attaquant.
    S().applyFightIntent(f.defenderIndex, 'turnChessMove', uciMove(solAtt[0]));
    expect(S().showFight.chess.reveal).toBeNull(); // l'attaquant n'a PAS gagné
    expect(S().showFight.chess.sides.attacker.solved).toBe(false);
  });
});
