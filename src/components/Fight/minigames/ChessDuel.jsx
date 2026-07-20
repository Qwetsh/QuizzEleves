import { useState, useEffect, useMemo, useRef } from 'react';
import { createPuzzleState, attempt, boardMatrix } from '../../../logic/chessPuzzle.js';
import { soundCorrect, soundWrong, soundClick } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';
import chessData from '../../../data/chessPuzzles.json';

// ── Anti-répétition des puzzles entre les manches (module-level : survit aux
// remontages, reset quand le pool d'une difficulté est épuisé). Une clé par
// difficulté (mateIn 1 / 2) pour ne pas mélanger les compteurs. ────────────────
const servedByMate = { 1: new Set(), 2: new Set() };

// Glyphes Unicode des pièces (chess.js : color 'w'|'b', type 'p'|'n'|'b'|'r'|'q'|'k').
const GLYPHS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Case algébrique depuis (rang, colonne) de la matrice board() (rang 0 = 8e).
function squareOf(r, c) { return FILES[c] + (8 - r); }

// Ordre d'affichage des rangs/colonnes selon l'orientation (le camp du solveur
// EN BAS). Blancs : rang 8→1 (haut→bas), colonnes a→h. Noirs : miroir.
function orderFor(orientation) {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = [0, 1, 2, 3, 4, 5, 6, 7];
  return orientation === 'b'
    ? { rows: rows.slice().reverse(), cols: cols.slice().reverse() }
    : { rows, cols };
}

// Tire un puzzle de la difficulté voulue (mateIn), anti-répétition ; repli sur
// l'autre difficulté si le pool ciblé est vide (souhait : manches 3+ → mat en 2,
// repli mat en 1 s'il en manque). Retourne null si AUCUN puzzle.
function pickPuzzle(wantMateIn) {
  const all = chessData?.puzzles || [];
  if (!all.length) return null;
  const wanted = all.filter((p) => p.mateIn === wantMateIn);
  const pool = wanted.length ? wanted : all; // repli toutes difficultés
  const mate = wanted.length ? wantMateIn : (pool[0].mateIn || 1);
  const served = servedByMate[mate] || (servedByMate[mate] = new Set());
  const free = pool.filter((p) => !served.has(p.id));
  const bag = free.length ? free : pool;
  if (!free.length) served.clear();
  const chosen = bag[Math.floor(Math.random() * bag.length)];
  served.add(chosen.id);
  return chosen;
}

/**
 * « Échecs — mat en N » (thème maths_logique) — écran scindé tactile.
 * Les DEUX camps courent le MÊME puzzle (équité) : deux échiquiers NUS (aucune
 * aide, aucun surlignage de coups légaux), chacun interactif indépendamment. Le
 * premier à réaliser le mat gagne la manche. Interaction tap-pièce-puis-
 * destination via PointerEvents.
 *
 * Difficulté pilotée par la MANCHE (`round`) : manches 1-2 → mat en 1 ;
 * manche 3+ → mat en 2 (repli mat en 1 si le pool en manque).
 */
export default function ChessDuel({ attacker, defender, round, onRoundWin }) {
  const T = useT();

  // Un SEUL puzzle par manche, tiré à la 1re monte (mémoïsé sur round → pas de
  // Math.random au rendu). Difficulté selon la manche.
  const puzzle = useMemo(() => {
    const wantMateIn = (round || 1) >= 3 ? 2 : 1;
    return pickPuzzle(wantMateIn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  // Repli propre si le pool est vide : écran d'issue avec bouton (pas de soft-lock).
  if (!puzzle) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontFamily: 'var(--font-display)' }}>
        {T('fight.chess.noPuzzle')}
        <button className="btn btn--ghost" style={{ marginTop: 14 }} onClick={() => onRoundWin('defender')}>
          {T('fight.quick.roundToDefender')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <style>{'@keyframes chess-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}'}</style>
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        <ChessSide side="attacker" team={attacker} puzzle={puzzle} onWin={() => onRoundWin('attacker')} T={T} />
        <ChessSide side="defender" team={defender} puzzle={puzzle} onWin={() => onRoundWin('defender')} T={T} />
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.chess.hint')}
      </div>
    </div>
  );
}

// Un échiquier jouable (un camp). Gère sa propre instance de puzzle (le même
// puzzle des deux côtés, mais deux états indépendants), sa sélection, son verrou.
function ChessSide({ team, puzzle, onWin, T }) {
  // Instance propre à ce camp (createPuzzleState → chess.js frais).
  const stateRef = useRef(null);
  if (!stateRef.current || stateRef.current.puzzle.id !== puzzle.id) {
    stateRef.current = createPuzzleState(puzzle);
  }
  const state = stateRef.current;

  const [board, setBoard] = useState(() => boardMatrix(state));
  const [sel, setSel] = useState(null); // case sélectionnée (« e2 ») ou null
  const [locked, setLocked] = useState(false); // verrou bref après coup faux
  const [shake, setShake] = useState(null); // case qui « secoue » (coup illégal)
  const [banner, setBanner] = useState(null); // 'yourFinish' | 'wrong' | 'win'
  const [won, setWon] = useState(false);

  const dead = useRef(false);
  const timers = useRef([]);
  useEffect(() => {
    dead.current = false; // StrictMode : réarme dans le CORPS de l'effet
    return () => { dead.current = true; timers.current.forEach(clearTimeout); timers.current = []; };
  }, []);
  const after = (ms, fn) => { const t = setTimeout(() => { if (!dead.current) fn(); }, ms); timers.current.push(t); };

  const { rows, cols } = orderFor(state.orientation);
  const myColor = state.orientation; // 'w' | 'b' : la couleur que ce camp joue
  const mateIn = puzzle.mateIn;

  const tapSquare = (sq) => {
    if (won || locked) return;
    const piece = state.chess.get(sq); // { type, color } | false

    // 1er tap : sélectionner une pièce de SA couleur (halo autorisé — pas une aide).
    if (!sel) {
      if (piece && piece.color === myColor) { setSel(sq); soundClick(); }
      return;
    }
    // Re-tap sur la même case ou sur une autre pièce à soi : change la sélection.
    if (sq === sel) { setSel(null); return; }
    if (piece && piece.color === myColor) { setSel(sq); soundClick(); return; }

    // 2e tap = destination. Promotion en Dame par défaut (v1, pas de sélecteur).
    const from = sel;
    const dest = sq;
    setSel(null);
    const verdict = attempt(state, { from, to: dest, promotion: 'q' });

    if (verdict.illegal) {
      // Coup illégal : petit shake, AUCUNE pénalité.
      setShake(dest);
      after(300, () => setShake(null));
      return;
    }
    if (verdict.wrong) {
      // Coup légal mais faux : verrou bref de CE camp, bandeau « Raté ! ».
      soundWrong();
      setLocked(true);
      setBanner('wrong');
      after(1200, () => { setLocked(false); setBanner(null); });
      return;
    }
    if (verdict.solved) {
      // Mat → ce camp gagne la manche.
      soundCorrect();
      setBoard(boardMatrix(state));
      setWon(true);
      setBanner('win');
      after(700, () => { if (!dead.current) onWin(); });
      return;
    }
    if (verdict.advanced) {
      // Mat en 2 : 1er coup correct → riposte adverse jouée (dans le moteur) +
      // « À toi de finir ! ». On rafraîchit le plateau pour montrer les 2 coups.
      soundCorrect();
      setBoard(boardMatrix(state));
      setBanner('yourFinish');
      after(1400, () => { if (!dead.current) setBanner(null); });
    }
  };

  const light = '#e9d6b0';
  const dark = '#a97e56';

  return (
    <div
      style={{
        flex: 1, minWidth: 0, position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '10px 12px',
        background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
        borderTop: `4px solid ${team.color}`,
        borderRadius: 16,
        opacity: locked ? 0.7 : 1,
        transition: 'opacity 200ms ease',
      }}
    >
      {/* En-tête : équipe + « MAT EN N » + trait */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <TeamAvatar team={team} size={26} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: team.color }}>{team.name}</span>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 13, color: '#3a2c1a',
          background: '#f3c969', borderRadius: 999, padding: '2px 10px',
        }}>
          {mateIn === 2 ? T('fight.chess.mateIn2') : T('fight.chess.mateIn1')}
        </span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>
          {myColor === 'w' ? T('fight.chess.whiteToMove') : T('fight.chess.blackToMove')}
        </span>
      </div>

      {/* Bandeau d'état (par-dessus l'échiquier) */}
      {banner && (
        <div style={{
          position: 'absolute', top: 44, left: 0, right: 0, zIndex: 4,
          display: 'flex', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 18, padding: '6px 18px', borderRadius: 999,
            color: banner === 'wrong' ? '#fff' : '#25301a',
            background: banner === 'wrong' ? 'rgba(201,71,47,0.95)'
              : banner === 'win' ? 'rgba(155,230,127,0.97)' : 'rgba(243,201,105,0.97)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          }}>
            {banner === 'wrong' ? T('fight.chess.wrong')
              : banner === 'win' ? T('fight.chess.win') : T('fight.chess.yourFinish')}
          </span>
        </div>
      )}

      {/* Échiquier NU */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(8, 1fr)',
            gridTemplateRows: 'repeat(8, 1fr)',
            width: 'min(100%, 60vh)', aspectRatio: '1 / 1',
            border: '3px solid #5a4024', borderRadius: 6, overflow: 'hidden',
            boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
          }}
        >
          {rows.map((r) => cols.map((c) => {
            const sq = squareOf(r, c);
            const cell = board[r][c]; // { type, color } | null
            const isLight = (r + c) % 2 === 0;
            const isSel = sel === sq;
            const isShake = shake === sq;
            // Libellés discrets : colonne sur la dernière rangée, rang sur la 1re colonne.
            const isBottomRow = rows[rows.length - 1] === r;
            const isFirstCol = cols[0] === c;
            return (
              <div
                key={sq}
                onPointerDown={() => tapSquare(sq)}
                style={{
                  position: 'relative',
                  background: isLight ? light : dark,
                  display: 'grid', placeItems: 'center',
                  cursor: won || locked ? 'default' : 'pointer',
                  touchAction: 'manipulation',
                  boxShadow: isSel ? 'inset 0 0 0 4px rgba(91,140,58,0.85)' : 'none',
                  animation: isShake ? 'chess-shake 0.3s' : 'none',
                }}
              >
                {cell && (
                  <span style={{
                    fontSize: 'clamp(18px, 6vh, 40px)', lineHeight: 1,
                    color: cell.color === 'w' ? '#fffdf7' : '#1c1a17',
                    textShadow: cell.color === 'w'
                      ? '0 1px 1px rgba(0,0,0,0.55)'
                      : '0 1px 0 rgba(255,255,255,0.25)',
                    userSelect: 'none', pointerEvents: 'none',
                  }}>
                    {GLYPHS[cell.color][cell.type]}
                  </span>
                )}
                {isBottomRow && (
                  <span style={{ position: 'absolute', right: 2, bottom: 0, fontSize: 8, fontWeight: 700, color: isLight ? dark : light, opacity: 0.8 }}>
                    {FILES[c]}
                  </span>
                )}
                {isFirstCol && (
                  <span style={{ position: 'absolute', left: 2, top: 0, fontSize: 8, fontWeight: 700, color: isLight ? dark : light, opacity: 0.8 }}>
                    {8 - r}
                  </span>
                )}
              </div>
            );
          }))}
        </div>
      </div>
    </div>
  );
}
