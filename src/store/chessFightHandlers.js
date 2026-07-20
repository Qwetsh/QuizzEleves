// Duel d'ÉCHECS « mat en N » PILOTÉ PAR LE STORE — multi-surface : l'hôte
// (écran partagé TV, ou hôte en ligne) est l'autorité (tirage des puzzles,
// moteur logic/chessPuzzle, minuteries de secousse / révélation, victoire de
// manche BO3). Chaque duelliste joue SON coup depuis son appareil (intent
// turnChessMove). Contrairement à memory/pkmn, ce duel tourne AUSSI en ligne :
// l'échiquier ne demande aucun écran tactile partagé, chaque camp voit sa
// position et propose son coup.
//
// SECRET (anti-triche) : la SOLUTION (coups UCI) et l'instance chess.js de
// chaque camp restent MODULE-LEVEL (hostStates) — JAMAIS dans showFight, donc
// jamais publiées. La `fen` publiée = la POSITION visible : aucun avantage (il
// faut trouver le coup mat). CHAQUE CAMP A SON PROPRE PUZZLE (de la difficulté
// de la manche) pour qu'un camp ne puisse pas copier le coup de l'autre via le
// fen public.
//
// showFight.chess = {
//   roundNo,                  // manche courante (1, 2, 3…)
//   mateIn,                   // difficulté de la manche (1 ou 2)
//   sides: {
//     attacker: { fen, turn:'w'|'b', step, solved, locked, shakeSeq, lastMove },
//     defender: { …idem },
//   },
//   reveal: null | { winner: 'attacker'|'defender' },
//   seq,                      // jeton anti-minuterie-périmée
// }
import chessData from '../data/chessPuzzles.json';
import { createPuzzleState, attempt, boardMatrix } from '../logic/chessPuzzle.js';

export const CHESS_WRONG_HOLD_MS = 1200;   // coup légal faux : blocage court (secousse)
export const CHESS_REVEAL_MS = 1400;       // manche gagnée : mat affiché avant la suite

const SIDES = ['attacker', 'defender'];

// SECRET côté hôte : instance chess.js + solution par camp (non sérialisé, jamais
// publié). Réinitialisé au démarrage de chaque duel.
let hostStates = { attacker: null, defender: null };
// Anti-répétition par CAMP (motif `used` de memory) : un même puzzle ne retombe
// pas deux fois pour un camp sur la durée du combat (recyclé si le pool s'épuise).
let usedIds = { attacker: [], defender: [] };

// Difficulté d'une manche : manches 1-2 → mat en 1, manche 3+ → mat en 2.
function mateInForRound(roundNo) {
  return roundNo >= 3 ? 2 : 1;
}

// Tire un puzzle de la difficulté demandée, non déjà vu par ce camp (recycle si
// épuisé). Repli sur mat-en-1 si le pool mat-en-2 est vide. Retourne null si
// aucun puzzle du tout (garde-fou — isPlayable l'exclut normalement en amont).
function pickPuzzle(mateIn, side) {
  const all = chessData?.puzzles || [];
  const ofDifficulty = all.filter((p) => p.mateIn === mateIn);
  const pool = ofDifficulty.length ? ofDifficulty : all.filter((p) => p.mateIn === 1);
  if (!pool.length) return null;
  let fresh = pool.filter((p) => !usedIds[side].includes(p.id));
  if (!fresh.length) { usedIds[side] = []; fresh = pool; }
  const puzzle = fresh[Math.floor(Math.random() * fresh.length)];
  usedIds[side] = [...usedIds[side], puzzle.id];
  return puzzle;
}

// Vue PUBLIQUE d'un camp à partir de son état hôte (aucun secret : ni solution,
// ni step au-delà de l'index — juste la position visible + les drapeaux d'UI).
function publicSide(hostState) {
  return {
    fen: hostState.chess.fen(),
    turn: hostState.chess.turn(),      // 'w'|'b' — au trait du solveur
    step: hostState.step,
    solved: hostState.solved,
    locked: false,
    shakeSeq: 0,
    lastMove: null,
  };
}

// Prépare une manche : nouveaux puzzles (un par camp) de la difficulté voulue,
// états hôte module-level + états publics. Retourne le bloc showFight.chess (ou
// null si le pool est vide → garde-fou).
function freshRound(roundNo) {
  const mateIn = mateInForRound(roundNo);
  const pa = pickPuzzle(mateIn, 'attacker');
  const pd = pickPuzzle(mateIn, 'defender');
  if (!pa || !pd) return null;
  hostStates = {
    attacker: createPuzzleState(pa),
    defender: createPuzzleState(pd),
  };
  return {
    roundNo,
    mateIn,
    sides: {
      attacker: publicSide(hostStates.attacker),
      defender: publicSide(hostStates.defender),
    },
    reveal: null,
    seq: 0,
  };
}

export function startChessDuel(set, get) {
  const f = get().showFight;
  if (!f) return;
  // RESET l'anti-répétition et l'état hôte au démarrage d'un nouveau duel.
  hostStates = { attacker: null, defender: null };
  usedIds = { attacker: [], defender: [] };
  const chess = freshRound(1);
  if (!chess) return; // pool vide : garde-fou (fightBegin ne route pas ici normalement)
  set({ showFight: { ...f, phase: 'minigame', chess } });
}

// Republie le bloc public d'un camp depuis son état hôte, en préservant les
// drapeaux d'UI transitoires (locked, shakeSeq, lastMove) déjà posés.
function republishSide(prevSide, hostState, patch = {}) {
  return {
    ...prevSide,
    fen: hostState.chess.fen(),
    turn: hostState.chess.turn(),
    step: hostState.step,
    solved: hostState.solved,
    ...patch,
  };
}

// Un duelliste propose un coup { from, to, promotion? } pour SON camp. L'hôte
// arbitre via le moteur pur (attempt) : coup illégal → secousse ; coup légal
// faux → blocage court ; coup correct → avance / mat.
export function chessDuelMove(set, get, side, move) {
  const f = get().showFight;
  const c = f?.chess;
  if (!c || c.reveal || f.phase !== 'minigame') return;
  if (!SIDES.includes(side)) return;
  const pub = c.sides[side];
  const host = hostStates[side];
  if (!pub || !host || pub.locked || pub.solved) return;

  const verdict = attempt(host, {
    from: move.from, to: move.to,
    promotion: move.promotion || undefined,
  });

  // Coup illégal : feedback de secousse, aucune mutation de position.
  if (verdict.illegal) {
    const sides = { ...c.sides, [side]: { ...pub, shakeSeq: (pub.shakeSeq || 0) + 1 } };
    set({ showFight: { ...f, chess: { ...c, sides } } });
    return;
  }

  // Coup légal mais faux : blocage court (secousse), puis on relève le verrou.
  if (verdict.wrong) {
    const seq = (c.seq || 0) + 1;
    const sides = { ...c.sides, [side]: { ...pub, locked: true, shakeSeq: (pub.shakeSeq || 0) + 1 } };
    set({ showFight: { ...f, chess: { ...c, sides, seq } } });
    setTimeout(() => {
      const cur = get().showFight;
      const cc = cur?.chess;
      if (!cc || cc.seq !== seq || cur.phase !== 'minigame' || cc.reveal) return;
      const s = cc.sides[side];
      if (!s?.locked) return;
      set({ showFight: { ...cur, chess: { ...cc, sides: { ...cc.sides, [side]: { ...s, locked: false } } } } });
    }, CHESS_WRONG_HOLD_MS);
    return;
  }

  // Mat en 2, 1er coup correct : la riposte adverse a déjà été jouée par le
  // moteur → on republie la nouvelle position (fen/turn/step avancés).
  if (verdict.advanced) {
    const sides = {
      ...c.sides,
      [side]: republishSide(pub, host, { lastMove: { from: move.from, to: move.to }, locked: false }),
    };
    set({ showFight: { ...f, chess: { ...c, sides } } });
    return;
  }

  // Mat : le camp remporte la manche. On republie la position finale, on affiche
  // la révélation, puis on marque la manche (fightRoundWin) et, si le combat
  // continue, on sert une manche neuve (motif checkMemoryBoardEnd).
  if (verdict.solved) {
    const seq = (c.seq || 0) + 1;
    const sides = {
      ...c.sides,
      [side]: republishSide(pub, host, { lastMove: { from: move.from, to: move.to }, locked: false }),
    };
    set({ showFight: { ...f, chess: { ...c, sides, reveal: { winner: side }, seq } } });
    setTimeout(() => {
      const cur = get().showFight;
      const cc = cur?.chess;
      if (!cc || cc.seq !== seq || cur.phase !== 'minigame' || cc.reveal?.winner !== side) return;
      get().fightRoundWin(side); // BO3 : peut passer en phase 'reward'
      const nf = get().showFight;
      if (nf && nf.phase === 'minigame' && !nf.winnerSide && nf.chess) {
        const next = freshRound(nf.chess.roundNo + 1);
        if (next) set({ showFight: { ...nf, chess: next } });
      }
    }, CHESS_REVEAL_MS);
  }
}

// Exposé pour l'UI / les tests : matrice 8x8 de la position d'un camp (rendu
// d'échiquier). Lit l'état hôte module-level (le fen public suffit aussi).
export function chessBoardMatrix(side) {
  const host = hostStates[side];
  return host ? boardMatrix(host) : null;
}
