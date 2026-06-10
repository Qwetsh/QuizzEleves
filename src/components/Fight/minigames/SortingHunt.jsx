import { useState, useEffect, useRef } from 'react';
import { SVT_CHALLENGES, shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong } from '../../../logic/sounds';

const ROUND_SECONDS = 30;
const GRID_SIZE = 16;
const MAX_GOOD = 8;

function makeGrid(challenge) {
  const good = shuffle(challenge.good).slice(0, MAX_GOOD);
  const bad = shuffle(challenge.bad).slice(0, GRID_SIZE - good.length);
  return shuffle([
    ...good.map((label) => ({ label, good: true })),
    ...bad.map((label) => ({ label, good: false })),
  ]);
}

/**
 * Le Grand Tri (SVT) — écran scindé tactile, moteur de la Chasse aux
 * verbes généralisé : une consigne de catégorie (« Touche tous les
 * VERTÉBRÉS ! »), 16 propositions identiques des deux côtés (ordres
 * différents), +1 par bonne réponse, -1 par intrus, 30 secondes.
 * Le défi change à chaque manche sans se répéter (composant persistant).
 */
export default function SortingHunt({ attacker, defender, round, onRoundWin }) {
  const usedChallenges = useRef([]);
  const [challenge, setChallenge] = useState(null);
  const [cells, setCells] = useState(null);
  const [orders, setOrders] = useState(null);
  const [tapped, setTapped] = useState({ attacker: {}, defender: {} });
  const [scores, setScores] = useState({ attacker: 0, defender: 0 });
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [finished, setFinished] = useState(false);
  const [tie, setTie] = useState(false);
  const reported = useRef(false);

  const startRound = () => {
    const remaining = SVT_CHALLENGES.filter((c) => !usedChallenges.current.includes(c.id));
    const pool = remaining.length ? remaining : SVT_CHALLENGES;
    const ch = shuffle(pool)[0];
    usedChallenges.current = [...usedChallenges.current, ch.id];
    const grid = makeGrid(ch);
    const idx = grid.map((_, i) => i);
    setChallenge(ch);
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

  if (!cells || !orders || !challenge) return null;

  const handleTap = (side, cellIdx) => {
    if (finished || tapped[side][cellIdx]) return;
    const cell = cells[cellIdx];
    if (cell.good) soundCorrect(); else soundWrong();
    setTapped((prev) => ({ ...prev, [side]: { ...prev[side], [cellIdx]: true } }));
    setScores((prev) => ({ ...prev, [side]: prev[side] + (cell.good ? 1 : -1) }));
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
            bg = cell.good ? '#d1f0b8' : '#f7c8c8';
            border = cell.good ? '2px solid #5b8c3a' : '2px solid #c9472f';
          } else if (finished && cell.good) {
            border = '2px dashed #5b8c3a';
          }
          return (
            <button
              key={cellIdx}
              onPointerDown={() => handleTap(side, cellIdx)}
              style={{
                borderRadius: 10, border, background: bg,
                fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600,
                cursor: finished ? 'default' : 'pointer',
                touchAction: 'manipulation',
                padding: '6px 2px',
                lineHeight: 1.15,
              }}
            >
              {cell.label}
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
          fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {tie ? '⚖️ Égalité ! Nouveau défi…' : finished ? 'Temps écoulé !' : challenge.prompt}
        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-ui)', marginTop: 2 }}>
          +1 par bonne réponse, -1 par intrus
        </div>
        <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
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
