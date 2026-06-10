import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong } from '../../../logic/sounds';

const ROUND_MS = 30000;
const LIFE_MS = 2600;          // duree de vie d'une bulle
const SPAWN_EVERY_MS = 850;    // cadence d'apparition (+ jitter)
const GOOD_RATIO = 0.55;
const FEEDBACK_MS = 320;       // la bulle touchee reste colorée un instant

/**
 * Genere le planning des bulles d'une manche : memes mots, memes instants,
 * memes positions des deux cotes (equite parfaite). La zone de jeu est
 * decoupee en 4x3 cases pour eviter les chevauchements de bulles vivantes.
 */
function makeSchedule(challenge) {
  const goodPool = shuffle(challenge.good);
  const badPool = shuffle(challenge.bad);
  let gi = 0;
  let bi = 0;
  const cols = 4;
  const rows = 3;
  const zoneBusyUntil = Array(cols * rows).fill(0);
  const items = [];
  let t = 700;
  let id = 0;

  while (t < ROUND_MS - LIFE_MS - 200) {
    const free = [];
    for (let z = 0; z < cols * rows; z++) if (zoneBusyUntil[z] <= t) free.push(z);
    if (free.length) {
      const z = free[Math.floor(Math.random() * free.length)];
      zoneBusyUntil[z] = t + LIFE_MS + 250;
      const good = Math.random() < GOOD_RATIO;
      const label = good ? goodPool[gi++ % goodPool.length] : badPool[bi++ % badPool.length];
      items.push({
        id: id++,
        label,
        good,
        x: (z % cols + 0.5) / cols + (Math.random() - 0.5) * 0.08,
        y: (Math.floor(z / cols) + 0.5) / rows + (Math.random() - 0.5) * 0.10,
        t,
      });
    }
    t += SPAWN_EVERY_MS + Math.random() * 300;
  }
  return items;
}

/**
 * Moteur de chasse aux bulles — écran scindé tactile.
 * Des bulles-mots apparaissent et éclatent d'elles-mêmes : touche celles
 * de la catégorie demandée (+1) avant qu'elles disparaissent, évite les
 * intrus (-1). Même planning des deux côtés. Utilisé par la Chasse aux
 * verbes (anglais) et Le Grand Tri (SVT).
 *
 * Props : { attacker, defender, round, onRoundWin,
 *           pickChallenge() -> { id, prompt, good[], bad[] } }
 */
export default function BubbleHunt({ attacker, defender, round, onRoundWin, pickChallenge }) {
  const [challenge, setChallenge] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [now, setNow] = useState(0);
  const [tapped, setTapped] = useState({ attacker: {}, defender: {} });
  const [scores, setScores] = useState({ attacker: 0, defender: 0 });
  const [finished, setFinished] = useState(false);
  const [tie, setTie] = useState(false);
  const reported = useRef(false);

  const startRound = () => {
    const ch = pickChallenge();
    setChallenge(ch);
    setSchedule(makeSchedule(ch));
    setNow(0);
    setTapped({ attacker: {}, defender: {} });
    setScores({ attacker: 0, defender: 0 });
    setFinished(false);
    setTie(false);
    reported.current = false;
  };

  useEffect(() => { startRound(); }, [round]);

  // Horloge de la manche (100 ms)
  useEffect(() => {
    if (finished || !schedule) return;
    const start = Date.now() - now;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed >= ROUND_MS) { setNow(ROUND_MS); setFinished(true); clearInterval(interval); }
      else setNow(elapsed);
    }, 100);
    return () => clearInterval(interval);
  }, [finished, schedule]);

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

  if (!challenge || !schedule) return null;

  const handleTap = (side, bubble) => {
    if (finished || tapped[side][bubble.id]) return;
    if (bubble.good) soundCorrect(); else soundWrong();
    setTapped((prev) => ({ ...prev, [side]: { ...prev[side], [bubble.id]: { good: bubble.good, at: now } } }));
    setScores((prev) => ({ ...prev, [side]: prev[side] + (bubble.good ? 1 : -1) }));
  };

  const renderSide = (side, team) => {
    // Bulles vivantes : non expirees, non touchees (ou touchees a l'instant,
    // le temps du feedback colore)
    const visible = schedule.filter((b) => {
      if (b.t > now || now >= b.t + LIFE_MS) return false;
      const tap = tapped[side][b.id];
      return !tap || now - tap.at < FEEDBACK_MS;
    });

    return (
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

        {/* Zone de jeu : les bulles */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
          <AnimatePresence>
            {visible.map((b) => {
              const tap = tapped[side][b.id];
              return (
                <motion.button
                  key={b.id}
                  initial={{ scale: 0 }}
                  animate={tap
                    ? { scale: 1.15 }
                    : { scale: [0, 1.08, 1, 0.72] }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={tap
                    ? { duration: 0.15 }
                    : { duration: LIFE_MS / 1000, times: [0, 0.1, 0.18, 1], ease: 'linear' }}
                  onPointerDown={() => handleTap(side, b)}
                  style={{
                    position: 'absolute',
                    left: `${b.x * 100}%`, top: `${b.y * 100}%`,
                    // centrage via les motion values (composees avec le scale anime)
                    x: '-50%', y: '-50%',
                    padding: '10px 16px', borderRadius: 999,
                    border: tap
                      ? `3px solid ${tap.good ? '#5b8c3a' : '#c9472f'}`
                      : '2px solid rgba(122,94,58,0.35)',
                    background: tap
                      ? (tap.good ? '#d1f0b8' : '#f7c8c8')
                      : 'radial-gradient(circle at 30% 25%, #ffffff, #fdf6e3 60%, #f0e4c8)',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.8)',
                    fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 700,
                    color: 'var(--ink-900)',
                    cursor: 'pointer',
                    touchAction: 'manipulation',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {b.label}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  const timeLeft = Math.max(0, Math.ceil((ROUND_MS - now) / 1000));
  const timerRatio = Math.max(0, (ROUND_MS - now) / ROUND_MS);

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
        {tie ? '⚖️ Égalité ! Nouvelle salve…' : finished ? 'Temps écoulé !' : challenge.prompt}
        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-ui)', marginTop: 2 }}>
          Touche les bulles avant qu'elles éclatent ! +1 par bonne réponse, -1 par intrus
        </div>
        <div style={{ height: 6, background: 'rgba(0,0,0,0.1)', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%', width: `${timerRatio * 100}%`,
              background: timerRatio > 0.3 ? 'linear-gradient(90deg, #5b8c3a, #8bc34a)' : '#c9472f',
              borderRadius: 3,
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
