import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { soundVictory } from '../../logic/sounds';
import ModalOverlay from './ModalOverlay';
import { OFFLINE } from '../../logic/offline';

const analyseUrl = () => `${window.location.origin}${import.meta.env.BASE_URL || '/'}?analyse`;

const CONFETTI_COLORS = ['#f3c969', '#e85d6b', '#2f9d5a', '#2f6fd8', '#8745d4', '#129fb0'];

export default function VictoryModal() {
  const finished = useGameStore((s) => s.finished);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const reset = useGameStore((s) => s.reset);

  const [dismissed, setDismissed] = useState(false);
  const winner = teams[currentTeam];

  useEffect(() => {
    if (finished && !dismissed) soundVictory();
  }, [finished, dismissed]);

  const isOpen = finished && !dismissed && !!winner;

  const confetti = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 4,
      color: CONFETTI_COLORS[i % 6],
      duration: 2.5 + Math.random() * 2,
    }));
  }, []);

  const sorted = isOpen
    ? [...teams].sort((a, b) => (b.correct - a.correct) || (b.money - a.money))
    : [];

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalOverlay className="max-w-lg">
          {/* Confetti layer */}
          <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
            {confetti.map((c, i) => (
              <div
                key={i}
                className="confetti"
                style={{
                  position: 'absolute',
                  left: c.left + '%',
                  top: -20,
                  width: 12, height: 16,
                  borderRadius: 2,
                  background: c.color,
                  animationDelay: c.delay + 's',
                  animationDuration: c.duration + 's',
                }}
              />
            ))}
          </div>

          {/* Victory content */}
          <div
            className="text-center"
            style={{
              padding: 40,
              background: 'radial-gradient(ellipse at center, rgba(243,201,105,0.3), transparent 60%)',
            }}
          >
            <div className="text-6xl mb-4">{winner.emoji}</div>
            <div
              className="text-4xl sm:text-6xl"
              style={{
                fontFamily: 'var(--font-display)',
                background: 'linear-gradient(180deg, #f3c969 0%, #b8862c 60%, #6e4e10 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                marginBottom: 8,
                lineHeight: 1,
              }}
            >
              VICTOIRE !
            </div>
            <div style={{ fontSize: 22, color: 'var(--ink-700)', marginBottom: 32 }}>
              <strong style={{ color: winner.color }}>{winner.name}</strong> remportent la qu\u00eate
            </div>

            {/* Rankings */}
            <div
              style={{
                background: 'rgba(255,250,240,0.85)',
                borderRadius: 20, padding: 22,
                boxShadow: 'var(--sh-md)',
                marginBottom: 24, textAlign: 'left',
              }}
            >
              <div style={{
                fontFamily: 'var(--font-display)', letterSpacing: 1, color: 'var(--ink-500)',
                fontSize: 12, marginBottom: 10, textTransform: 'uppercase', textAlign: 'center',
              }}>
                Classement final
              </div>
              {sorted.map((t, i) => {
                const total = t.correct + t.wrong;
                const accuracy = total > 0 ? Math.round((t.correct / total) * 100) : 0;
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px dashed rgba(122, 94, 58, 0.2)',
                    }}
                  >
                    <div style={{
                      width: 24, textAlign: 'center',
                      fontFamily: 'var(--font-display)', fontSize: 18,
                      color: i === 0 ? 'var(--gold-600)' : 'var(--ink-500)',
                    }}>
                      {i + 1}
                    </div>
                    <span className="text-xl">{t.emoji}</span>
                    <div style={{ flex: 1, fontFamily: 'var(--font-display)', fontSize: 16 }}>{t.name}</div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 14, color: 'var(--ink-600)' }}>
                      <span>{"\u2713"} {t.correct}</span>
                      <span>{"\u2717"} {t.wrong}</span>
                      <span>{t.money} <span className="coin" /></span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => setDismissed(true)}
                className="btn btn--ghost"
              >
                Revoir le plateau
              </button>
              {!OFFLINE && (
                <button
                  onClick={() => window.open(analyseUrl(), '_blank', 'noopener')}
                  className="btn btn--ghost"
                >
                  {"\u{1F4CA} Voir l'analyse"}
                </button>
              )}
              <button
                onClick={reset}
                className="btn btn--lg"
              >
                {"\u{1F501} Nouvelle partie"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
