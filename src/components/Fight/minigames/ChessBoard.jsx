// Échiquier PRÉSENTATIONNEL réutilisable (aucune logique de partie).
// Utilisé par : (a) ChessDuel tactile (split-screen), (b) ChessDuelView
// (téléphone/client du duelliste, interactif), (c) ChessDuelStage (scène TV,
// lecture seule). Rendu à partir d'une FEN, orientation au choix.
//
// Props :
//   fen          : position à afficher (chaîne FEN). Le camp au trait est déduit
//                  par le parent (turn) ; ici on ne rend que la position visible.
//   orientation  : 'w' | 'b' — quel camp est EN BAS (le solveur voit le sien).
//   interactive  : booléen — autorise tap-pièce-puis-destination.
//   onMove       : ({from,to,promotion}) => void — appelé sur un 2e tap (case de
//                  destination). L'AUTORITÉ reste l'hôte : on envoie juste le coup.
//   locked       : verrou visuel (après coup faux / attente) — désactive le tap.
//   shakeSeq     : entier — quand il change, la dernière case tapée « secoue »
//                  (feedback coup illégal, piloté par l'hôte).
//   lastMove     : { from, to } | null — surligne le dernier coup joué.
//   myColor      : 'w' | 'b' — couleur des pièces jouables (défaut = orientation).
import { useState, useEffect, useMemo, useRef } from 'react';
import { Chess } from 'chess.js';
import { soundClick } from '../../../logic/sounds';

// Glyphes Unicode des pièces (chess.js : color 'w'|'b', type 'p'|'n'|'b'|'r'|'q'|'k').
const GLYPHS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

// Case algébrique depuis (rang, colonne) de la matrice board() (rang 0 = 8e).
function squareOf(r, c) { return FILES[c] + (8 - r); }

// Ordre d'affichage des rangs/colonnes selon l'orientation (le camp EN BAS).
// Blancs : rang 8→1 (haut→bas), colonnes a→h. Noirs : miroir.
function orderFor(orientation) {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7];
  const cols = [0, 1, 2, 3, 4, 5, 6, 7];
  return orientation === 'b'
    ? { rows: rows.slice().reverse(), cols: cols.slice().reverse() }
    : { rows, cols };
}

const light = '#e9d6b0';
const dark = '#a97e56';

export default function ChessBoard({
  fen,
  orientation = 'w',
  interactive = false,
  onMove,
  locked = false,
  shakeSeq = 0,
  lastMove = null,
  myColor,
}) {
  // Matrice 8x8 dérivée de la FEN (mémoïsée). Repli sur un plateau vide si la
  // FEN est absente/invalide (robustesse : jamais de crash côté client).
  const board = useMemo(() => {
    if (!fen) return null;
    try { return new Chess(fen).board(); } catch { return null; }
  }, [fen]);

  const playColor = myColor || orientation;
  const [sel, setSel] = useState(null); // case sélectionnée (« e2 ») ou null
  const [shakeSq, setShakeSq] = useState(null); // case qui « secoue »

  // Nouvelle position (FEN) → on abandonne la sélection en cours (le coup a été
  // pris en compte, ou le camp a changé).
  useEffect(() => { setSel(null); }, [fen]);

  // Verrou → plus de sélection possible.
  useEffect(() => { if (locked) setSel(null); }, [locked]);

  // shakeSeq piloté par l'hôte (coup illégal signalé) : secoue la case tapée.
  const prevShake = useRef(shakeSeq);
  const lastTapped = useRef(null);
  useEffect(() => {
    if (shakeSeq === prevShake.current) return;
    prevShake.current = shakeSeq;
    const sq = lastTapped.current;
    if (!sq) return;
    setShakeSq(sq);
    const t = setTimeout(() => setShakeSq(null), 300);
    return () => clearTimeout(t);
  }, [shakeSeq]);

  if (!board) {
    return <div style={{ width: 'min(100%, 60vh)', aspectRatio: '1 / 1', background: '#1c140b', borderRadius: 6 }} />;
  }

  const { rows, cols } = orderFor(orientation);

  const tapSquare = (sq) => {
    if (!interactive || locked) return;
    lastTapped.current = sq;
    // chess.js get(sq) → { type, color } | false. On lit la matrice locale pour
    // ne pas ré-instancier Chess à chaque tap.
    const r = 8 - Number(sq[1]);
    const c = FILES.indexOf(sq[0]);
    const piece = board[r] ? board[r][c] : null;

    // 1er tap : sélectionner une pièce de SA couleur (halo autorisé, pas une aide).
    if (!sel) {
      if (piece && piece.color === playColor) { setSel(sq); soundClick(); }
      return;
    }
    // Re-tap sur la même case ou une autre pièce à soi : change la sélection.
    if (sq === sel) { setSel(null); return; }
    if (piece && piece.color === playColor) { setSel(sq); soundClick(); return; }

    // 2e tap = destination. Promotion en Dame par défaut (v1). L'hôte tranche la
    // légalité / la justesse — on envoie juste from/to.
    const from = sel;
    setSel(null);
    if (onMove) onMove({ from, to: sq, promotion: 'q' });
  };

  const lastFrom = lastMove?.from || null;
  const lastTo = lastMove?.to || null;

  return (
    <div style={{ flex: '0 1 auto', minHeight: 0, display: 'grid', placeItems: 'center', width: '100%' }}>
      <style>{'@keyframes chessb-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}'}</style>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
          width: 'min(100%, 60vh)', aspectRatio: '1 / 1',
          border: '3px solid #5a4024', borderRadius: 6, overflow: 'hidden',
          boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
          opacity: locked ? 0.75 : 1, transition: 'opacity 200ms ease',
        }}
      >
        {rows.map((r) => cols.map((c) => {
          const sq = squareOf(r, c);
          const cell = board[r][c]; // { type, color } | null
          const isLight = (r + c) % 2 === 0;
          const isSel = sel === sq;
          const isShake = shakeSq === sq;
          const isLast = sq === lastFrom || sq === lastTo;
          const isBottomRow = rows[rows.length - 1] === r;
          const isFirstCol = cols[0] === c;
          return (
            <div
              key={sq}
              onPointerDown={interactive ? () => tapSquare(sq) : undefined}
              style={{
                position: 'relative',
                background: isLight ? light : dark,
                display: 'grid', placeItems: 'center',
                cursor: interactive && !locked ? 'pointer' : 'default',
                touchAction: 'manipulation',
                boxShadow: isSel
                  ? 'inset 0 0 0 4px rgba(91,140,58,0.85)'
                  : isLast ? 'inset 0 0 0 4px rgba(243,201,105,0.55)' : 'none',
                animation: isShake ? 'chessb-shake 0.3s' : 'none',
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
  );
}
