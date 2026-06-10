import { useState, useEffect, useRef } from 'react';
import { IRREGULAR_VERBS, REGULAR_VERBS, shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong } from '../../../logic/sounds';

const ROUND_SECONDS = 30;
const GRID_SIZE = 16;
const IRREGULAR_COUNT = 7;

function makeGrid() {
  const irregular = shuffle(IRREGULAR_VERBS).slice(0, IRREGULAR_COUNT);
  const regular = shuffle(REGULAR_VERBS).slice(0, GRID_SIZE - IRREGULAR_COUNT);
  return shuffle([
    ...irregular.map((v) => ({ verb: v, irregular: true })),
    ...regular.map((v) => ({ verb: v, irregular: false })),
  ]);
}

/**
 * Chasse aux verbes irréguliers (anglais) — écran scindé tactile.
 * Chaque côté reçoit la même liste de verbes (ordre différent) :
 * touche les verbes IRRÉGULIERS (+1) et évite les réguliers (-1).
 * Au bout de 30 s, le meilleur score gagne la manche. Égalité = on rejoue.
 */
export default function VerbHunt({ attacker, defender, round, onRoundWin }) {
  const [cells, setCells] = useState(null);            // verbes communs
  const [orders, setOrders] = useState(null);          // ordre par côté
  const [tapped, setTapped] = useState({ attacker: {}, defender: {} });
  const [scores, setScores] = useState({ attacker: 0, defender: 0 });
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [finished, setFinished] = useState(false);
  const [tie, setTie] = useState(false);
  const reported = useRef(false);

  const startRound = () => {
    const grid = makeGrid();
    const idx = grid.map((_, i) => i);
    setCells(grid);
    setOrders({ attacker: shuffle(idx), defender: shuffle(idx) });
    setTapped({ attacker: {}, defender: {} });
    setScores({ attacker: 0, defender: 0 });
    setTimeLeft(ROUND_SECONDS);
    setFinished(false);
    setTie(false);
    reported.current = false;
  };

  useEffect(() => { startRound(); }, [round]);

  // Compte a rebours
  useEffect(() => {
    if (finished || !cells) return;
    if (timeLeft <= 0) { setFinished(true); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, finished, cells]);

  // Fin de manche : compare les scores
  useEffect(() => {
    if (!finished || reported.current) return;
    reported.current = true;
    if (scores.attacker > scores.defender) {
      setTimeout(() => onRoundWin('attacker'), 1400);
    } else if (scores.defender > scores.attacker) {
      setTimeout(() => onRoundWin('defender'), 1400);
    } else {
      setTie(true);
      setTimeout(startRound, 1800);
    }
  }, [finished]);

  if (!cells || !orders) return null;

  const handleTap = (side, cellIdx) => {
    if (finished || tapped[side][cellIdx]) return;
    const cell = cells[cellIdx];
    if (cell.irregular) soundCorrect(); else soundWrong();
    setTapped((prev) => ({ ...prev, [side]: { ...prev[side], [cellIdx]: true } }));
    setScores((prev) => ({ ...prev, [side]: prev[side] + (cell.irregular ? 1 : -1) }));
  };

  const renderSide = (side, team) => (
    <div
      style={{
        flex: 1, minWidth: 0,
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '12px 14px',
        background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
        borderTop: `4px solid ${team.color}`,
        borderRadius: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{team.emoji}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: team.color }}>{team.name}</span>
        <span
          style={{
            marginLeft: 8, padding: '2px 12px', borderRadius: 999,
            background: '#fffefb', border: '1px solid rgba(122,94,58,0.3)',
            fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-900)',
          }}
        >
          {scores[side]}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, flex: 1 }}>
        {orders[side].map((cellIdx) => {
          const cell = cells[cellIdx];
          const isTapped = tapped[side][cellIdx];
          const reveal = finished || isTapped;
          let bg = '#fffefb';
          let border = '2px solid rgba(122,94,58,0.25)';
          if (reveal && isTapped) {
            bg = cell.irregular ? '#d1f0b8' : '#f7c8c8';
            border = cell.irregular ? '2px solid #5b8c3a' : '2px solid #c9472f';
          } else if (finished && cell.irregular) {
            border = '2px dashed #5b8c3a';
          }
          return (
            <button
              key={cellIdx}
              onPointerDown={() => handleTap(side, cellIdx)}
              style={{
                borderRadius: 10, border, background: bg,
                fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600,
                cursor: finished ? 'default' : 'pointer',
                touchAction: 'manipulation',
                padding: '8px 2px',
              }}
            >
              {cell.verb}
            </button>
          );
        })}
      </div>
    </div>
  );

  const timerRatio = timeLeft / ROUND_SECONDS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div
        style={{
          padding: '10px 20px', borderRadius: 14, textAlign: 'center',
          background: 'rgba(255,254,251,0.95)',
          fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-900)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {tie ? '⚖️ Égalité ! Nouvelle grille…' : finished ? 'Temps écoulé !' : `Touche les verbes IRRÉGULIERS ! (+1 / -1)`}
        <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, marginTop: 8, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', width: `${timerRatio * 100}%`,
              background: timerRatio > 0.3 ? 'linear-gradient(90deg, #5b8c3a, #8bc34a)' : '#c9472f',
              transition: 'width 1s linear', borderRadius: 3,
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>{timeLeft}s</div>
      </div>
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {renderSide('attacker', attacker)}
        {renderSide('defender', defender)}
      </div>
    </div>
  );
}
