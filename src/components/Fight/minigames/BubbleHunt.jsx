import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';
import { makeSchedules, ROUND_MS, LIFE_MS } from './bubbleSchedule';

const FEEDBACK_MS = 320;       // la bulle touchee reste colorée un instant

/**
 * Moteur de chasse aux bulles — écran scindé tactile.
 * Des bulles-mots apparaissent et éclatent d'elles-mêmes : touche celles
 * de la catégorie demandée (+1) avant qu'elles disparaissent, évite les
 * intrus (-1). Même planning des deux côtés. Utilisé par la Chasse aux
 * verbes (anglais) et Le Grand Tri (SVT).
 *
 * Props : { attacker, defender, round, onRoundWin,
 *           content: [{ id, prompt, prompt_en?, good[], bad[] }] }
 * Le contenu (défis) vient du thème. À chaque manche, un défi est tiré sans
 * répétition (tant qu'il en reste). Deux plannings indépendants par côté.
 */
export default function BubbleHunt({ attacker, defender, round, onRoundWin, content }) {
  const T = useT();
  const en = T.lang === 'en';
  const usedRef = useRef([]);
  const [challenge, setChallenge] = useState(null);
  const [schedule, setSchedule] = useState(null); // { attacker: [...], defender: [...] }
  const [now, setNow] = useState(0);
  const [tapped, setTapped] = useState({ attacker: {}, defender: {} });
  const [scores, setScores] = useState({ attacker: 0, defender: 0 });
  const [finished, setFinished] = useState(false);
  const [tie, setTie] = useState(false);
  const reported = useRef(false);

  // Tire un défi du contenu du thème, sans répétition tant qu'il en reste.
  const pickChallenge = () => {
    const list = Array.isArray(content) ? content : content ? [content] : [];
    if (!list.length) return null;
    const remaining = list.filter((c) => !usedRef.current.includes(c.id));
    const pool = remaining.length ? remaining : list;
    const ch = shuffle(pool)[0];
    usedRef.current = [...usedRef.current, ch.id];
    return ch;
  };

  const startRound = () => {
    const ch = pickChallenge();
    setChallenge(ch);
    setSchedule(ch ? makeSchedules(ch) : null);
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
    // le temps du feedback colore). Chaque côté a SON propre planning.
    const visible = schedule[side].filter((b) => {
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
          <TeamAvatar team={team} size={30} />
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
        {tie ? T('fight.bubble.tie') : finished ? T('fight.bubble.timeUp') : (en ? (challenge.prompt_en || challenge.prompt) : challenge.prompt)}
        <div style={{ fontSize: 11, color: 'var(--ink-500)', fontFamily: 'var(--font-ui)', marginTop: 2 }}>
          {T('fight.bubble.hint')}
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
