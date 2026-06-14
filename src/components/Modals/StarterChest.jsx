// Cérémonie du « coffre de départ » : à son premier tour, chaque équipe ouvre
// un coffre qui lui donne 20 pièces + un consommable aléatoire. Pilotée par le
// store (showStarterChest + lastStarterReward) ; le butin est tiré à l'avance,
// accordé à la fermeture (closeStarterChest) — ce qui déclenche FlyingCoins.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import { ITEMS } from '../../data/items';
import { EVENT_IMG } from '../../data/eventAssets';
import { LootCard } from './LootReveal';
import { soundClick, soundMoney } from '../../logic/sounds';
import '../../styles/loot-reveal.css';

// Rayons dorés rotatifs derrière le coffre (même esprit que LootReveal).
const GOLD_RAYS = `conic-gradient(${Array.from({ length: 12 }, (_, i) => {
  const a = i * 30;
  return `#f5d36a40 ${a}deg ${a + 10}deg, transparent ${a + 10}deg ${a + 30}deg`;
}).join(', ')})`;

function ChestInner({ team }) {
  const reward = useGameStore((s) => s.lastStarterReward);
  const close = useGameStore((s) => s.closeStarterChest);
  const [opened, setOpened] = useState(false);

  const item = reward?.item ? ITEMS[reward.item] : null;
  const gold = reward?.gold ?? 20;

  const open = () => { soundMoney(); setOpened(true); };
  const done = () => { soundClick(); close(); };

  return (
    <motion.div className="loot-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 240 }}
      >
        <div className="loot-modal">
          <div className="loot-banner">{opened ? `${team?.emoji || ''} Trésor de départ !` : '🧰 Un coffre de départ !'}</div>

          {/* Scène du coffre */}
          <div style={{ position: 'relative', width: 300, height: 240, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
            <motion.div
              aria-hidden
              style={{ position: 'absolute', width: 320, height: 320, background: GOLD_RAYS, borderRadius: '50%' }}
              animate={{ rotate: 360, opacity: opened ? 0.95 : 0.35 }}
              transition={{ rotate: { repeat: Infinity, ease: 'linear', duration: 14 }, opacity: { duration: 0.4 } }}
            />
            <motion.img
              src={EVENT_IMG.coffre} alt="Coffre de départ"
              style={{ width: opened ? 224 : 190, height: 'auto', position: 'relative', filter: 'drop-shadow(0 0 26px #f5d36aaa) drop-shadow(0 8px 10px rgba(0,0,0,.5))' }}
              animate={opened ? { scale: [1, 1.18, 1], rotate: [0, -3, 3, 0] } : { y: [0, -8, 0] }}
              transition={opened ? { duration: 0.6 } : { y: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' } }}
            />
          </div>

          {!opened ? (
            <>
              <p className="loot-desc" style={{ textAlign: 'center' }}>Ouvre-le pour bien démarrer l'aventure !</p>
              <button className="loot-btn" onClick={open}>{'\u{1F5DD}️'} Ouvrir le coffre</button>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
            >
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 10, delay: 0.25 }}
                style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: '#b8862c', textShadow: '0 1px 0 #fff', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                +{gold} <span className="coin" />
              </motion.div>
              {item && <LootCard item={item} subtitle="Un consommable pour démarrer" compact />}
              <button className="loot-btn" onClick={done}>Super&nbsp;!</button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function StarterChest() {
  const show = useGameStore((s) => s.showStarterChest);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const teams = useGameStore((s) => s.teams);

  return createPortal(
    <AnimatePresence>
      {show && <ChestInner key={currentTeam} team={teams[currentTeam]} />}
    </AnimatePresence>,
    document.body,
  );
}
