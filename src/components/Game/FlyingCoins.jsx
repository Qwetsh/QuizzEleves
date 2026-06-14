import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/gameStore';
import { soundMoney, soundCoinLoss } from '../../logic/sounds';

const COIN_COUNT = 8;
const ANIMATION_DURATION = 900;

function CoinSprite({ startX, startY, endX, endY, delay, loss }) {
  return (
    <div
      style={{
        position: 'fixed',
        left: startX,
        top: startY,
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: loss
          ? 'radial-gradient(circle at 30% 30%, #d8cba0, #9a8a5c 55%, #6e6038 100%)'
          : 'radial-gradient(circle at 30% 30%, var(--gold-shine), var(--gold-500) 55%, var(--gold-700) 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.3)',
        zIndex: 300,
        pointerEvents: 'none',
        animation: `${loss ? 'fly-coin-loss' : 'fly-coin'} ${ANIMATION_DURATION}ms cubic-bezier(.2,.7,.4,1) ${delay}ms both`,
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

    if (prev !== null) {
      let gained = false, lost = false;

      teams.forEach((team, teamIndex) => {
        const prevMoney = prev[teamIndex] ?? 0;
        const currentMoney = team.money ?? 0;
        const delta = currentMoney - prevMoney;
        if (delta === 0) return;

        const statChips = document.querySelectorAll('.ts-stat--coin');
        const targetChip = statChips[teamIndex];
        if (!targetChip) return;

        const rect = targetChip.getBoundingClientRect();
        const chipX = rect.left + rect.width / 2;
        const chipY = rect.top + rect.height / 2;
        const isLoss = delta < 0;
        const amount = Math.abs(delta);
        const coinCount = Math.min(COIN_COUNT, Math.max(3, amount));
        const id = ++idCounter.current;

        let newCoins;
        if (isLoss) {
          lost = true;
          // Les pièces partent de la pastille et s'échappent vers le bas
          newCoins = Array.from({ length: coinCount }).map((_, i) => ({
            id: `${id}-${i}`,
            loss: true,
            startX: chipX + (Math.random() - 0.5) * 24,
            startY: chipY + (Math.random() - 0.5) * 12,
            endX: chipX + (Math.random() - 0.5) * 160,
            endY: chipY + 120 + Math.random() * 80,
            delay: i * 55,
          }));
        } else {
          gained = true;
          // Les pièces convergent du centre de l'écran vers la pastille
          const startX = window.innerWidth / 2;
          const startY = window.innerHeight / 2;
          newCoins = Array.from({ length: coinCount }).map((_, i) => ({
            id: `${id}-${i}`,
            loss: false,
            startX: startX + (Math.random() - 0.5) * 80,
            startY: startY + (Math.random() - 0.5) * 80,
            endX: chipX + (Math.random() - 0.5) * 20,
            endY: chipY + (Math.random() - 0.5) * 10,
            delay: i * 60,
          }));
        }

        setAnimations((a) => [...a, ...newCoins]);
        setTimeout(() => {
          setAnimations((a) => a.filter((c) => !c.id.startsWith(`${id}-`)));
        }, ANIMATION_DURATION + coinCount * 60 + 100);
      });

      if (gained) soundMoney();
      if (lost) soundCoinLoss();
    }

    prevMoneyRef.current = teams.map((t) => t.money ?? 0);
  }, [teams]);

  if (animations.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes fly-coin {
          0%   { opacity: 0; transform: translate(0, 0) scale(0.3) rotate(0deg); }
          15%  { opacity: 1; transform: translate(0, -30px) scale(1.2) rotate(45deg); }
          100% { opacity: 0.6; transform: translate(var(--end-x), var(--end-y)) scale(0.6) rotate(360deg); }
        }
        @keyframes fly-coin-loss {
          0%   { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
          20%  { opacity: 1; transform: translate(calc(var(--end-x) * 0.2), -18px) scale(1.05) rotate(60deg); }
          100% { opacity: 0; transform: translate(var(--end-x), var(--end-y)) scale(0.5) rotate(420deg); }
        }
      `}</style>
      {animations.map((coin) => (
        <CoinSprite key={coin.id} {...coin} />
      ))}
    </>
  );
}
