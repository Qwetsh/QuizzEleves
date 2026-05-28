import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';

const COIN_COUNT = 8;
const ANIMATION_DURATION = 900;

function CoinSprite({ index, startX, startY, endX, endY, delay }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: startX,
        top: startY,
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 30%, var(--gold-shine), var(--gold-500) 55%, var(--gold-700) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.3)',
        zIndex: 300,
        pointerEvents: 'none',
        animation: `fly-coin ${ANIMATION_DURATION}ms cubic-bezier(.2,.7,.4,1) ${delay}ms both`,
        '--end-x': `${endX - startX}px`,
        '--end-y': `${endY - startY}px`,
      }}
    />
  );
}

export default function FlyingCoins() {
  const teams = useGameStore((s) => s.teams);
  const [animations, setAnimations] = useState([]);
  const prevMoneyRef = useRef(null);
  const idCounter = useRef(0);

  useEffect(() => {
    if (!teams || teams.length === 0) return;

    const prev = prevMoneyRef.current;

    // Check every team for money gains (not just currentTeam)
    if (prev !== null) {
      teams.forEach((team, teamIndex) => {
        const prevMoney = prev[teamIndex] ?? 0;
        const currentMoney = team.money ?? 0;

        if (currentMoney > prevMoney) {
          const gained = currentMoney - prevMoney;

          const statChips = document.querySelectorAll('.ts-stat--coin');
          const targetChip = statChips[teamIndex];

          if (targetChip) {
            const targetRect = targetChip.getBoundingClientRect();
            const endX = targetRect.left + targetRect.width / 2;
            const endY = targetRect.top + targetRect.height / 2;

            const startX = window.innerWidth / 2;
            const startY = window.innerHeight / 2;

            const coinCount = Math.min(COIN_COUNT, Math.max(3, gained));
            const id = ++idCounter.current;

            const newCoins = Array.from({ length: coinCount }).map((_, i) => ({
              id: `${id}-${i}`,
              startX: startX + (Math.random() - 0.5) * 80,
              startY: startY + (Math.random() - 0.5) * 80,
              endX: endX + (Math.random() - 0.5) * 20,
              endY: endY + (Math.random() - 0.5) * 10,
              delay: i * 60,
            }));

            setAnimations((a) => [...a, ...newCoins]);

            setTimeout(() => {
              setAnimations((a) => a.filter((c) => !c.id.startsWith(`${id}-`)));
            }, ANIMATION_DURATION + coinCount * 60 + 100);
          }
        }
      });
    }

    // Track all teams' money
    prevMoneyRef.current = teams.map((t) => t.money ?? 0);
  }, [teams]);

  if (animations.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes fly-coin {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.3) rotate(0deg);
          }
          15% {
            opacity: 1;
            transform: translate(0, -30px) scale(1.2) rotate(45deg);
          }
          100% {
            opacity: 0.6;
            transform: translate(var(--end-x), var(--end-y)) scale(0.6) rotate(360deg);
          }
        }
      `}</style>
      {animations.map((coin) => (
        <CoinSprite key={coin.id} index={coin.id} {...coin} />
      ))}
    </>
  );
}
