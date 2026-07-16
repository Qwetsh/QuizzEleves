// Cérémonie du « coffre de départ » — version futuriste GATCHA. À son premier tour,
// chaque équipe ouvre un coffre spatial : il gigote, on le touche → charge lumineuse
// → éclat → coffre OUVERT + butin (20 pièces + consommable(s) au choix). Piloté par
// le store (showStarterChest + lastStarterReward) ; le butin est accordé à la fermeture.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import { canDriveTurn } from '../../logic/onlineSelf';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';
import { ITEMS, RARITIES } from '../../data/items';
import { itemImg } from '../../logic/itemAssets';
import { itemEffectLines } from '../../logic/effectText';
import { soundClick, soundMoney, soundEvent } from '../../logic/sounds';
import chestClosed from '../../assets/space/chest-closed.png';
import chestOpen from '../../assets/space/chest-open.png';
import '../../styles/starter-chest.css';

const SPARKS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2;
  return { x: Math.cos(a) * 120, y: Math.sin(a) * 120, d: (i % 5) * 0.03 };
});

// Carte de choix d'objet (thème sombre). Montre l'EFFET (les élèves ne connaissent
// pas les consommables par leur nom).
function SciCard({ itemKey, index, onPick, selected }) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const r = RARITIES[item.rarity] || { color: '#63c8e8', name: '' };
  const img = itemImg(item);
  const desc = (locDesc(item) && locDesc(item).trim()) || itemEffectLines(item).join(' · ');
  return (
    <motion.button
      type="button" className={'sc-card' + (selected ? ' is-selected' : '')}
      style={{ '--rar': r.color }} onClick={() => onPick(itemKey)}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + index * 0.08 }}
      whileTap={{ scale: 0.96 }}
    >
      {selected && <span className="sc-card__check">✓</span>}
      {img
        ? <img className="sc-card__img" src={img} alt="" draggable={false} style={{ filter: `drop-shadow(0 0 8px ${r.color})` }} />
        : <span className="sc-card__emoji">{item.icon}</span>}
      <span className="sc-card__name">{locName(item)}</span>
      <span className="sc-card__rar">{r.name}</span>
      {desc && <span className="sc-card__desc">{desc}</span>}
    </motion.button>
  );
}

function ChestInner({ team }) {
  const T = useT();
  const reward = useGameStore((s) => s.lastStarterReward);
  const close = useGameStore((s) => s.closeStarterChest);
  const [phase, setPhase] = useState('idle'); // idle | charging | open
  const [picked, setPicked] = useState([]);

  const choices = (reward?.choices || []).filter((k) => ITEMS[k]);
  const gold = reward?.gold ?? 20;
  const keep = Math.max(1, Math.min(reward?.keep ?? 1, choices.length || 1));
  const target = Math.min(keep, choices.length);
  const single = target <= 1;
  const opened = phase === 'open';

  const cols = Math.min(choices.length || 1, 4);
  const modalWidth = choices.length > 2 ? Math.min(600, 120 + cols * 130) : 380;

  const openChest = () => {
    if (phase !== 'idle') return;
    soundEvent();
    setPhase('charging');
    setTimeout(() => { soundMoney(); setPhase('open'); }, 1050);
  };
  const done = () => { soundClick(); close(null); };
  const onPick = (key) => {
    soundClick();
    if (single) { close(key); return; }
    setPicked((cur) => {
      if (cur.includes(key)) return cur.filter((k) => k !== key);
      if (cur.length >= target) return cur;
      return [...cur, key];
    });
  };
  const validate = () => { soundClick(); close(picked); };

  // En LIGNE, le coffre se clique DIRECTEMENT — mais uniquement sur l'écran du
  // joueur dont c'est le tour (portail hors plateau : le gating de GameLayout
  // ne s'applique pas ici). Sur le miroir, ses clics partent en intents
  // (closeStarterChest → turnStarterChest via onlineMirror) ; les autres
  // écrans regardent le spectacle.
  const online = useGameStore((s) => s.connectionMode === 'online' || !!s._mirror);
  const drive = useGameStore(canDriveTurn);

  return (
    <motion.div className="sc-overlay" style={!drive ? { pointerEvents: 'none' } : undefined} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        className="sc-panel" style={{ width: modalWidth, maxWidth: '94vw' }}
        initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 240 }}
      >
        <div className="sc-title">{opened ? T('modal.chest.treasure', { emoji: team?.emoji || '' }) : T('modal.chest.aChest')}</div>

        {/* Scène */}
        <div className="sc-stage">
          {/* Rayons rotatifs (accélèrent à la charge, explosent à l'ouverture) */}
          <motion.div className="sc-rays" aria-hidden
            animate={{ rotate: 360, opacity: opened ? 0.9 : phase === 'charging' ? 0.75 : 0.3, scale: opened ? 1.15 : 1 }}
            transition={{ rotate: { repeat: Infinity, ease: 'linear', duration: phase === 'charging' ? 2.5 : opened ? 8 : 16 }, opacity: { duration: 0.3 } }}
          />
          {/* Halo (pulse à l'idle, gonfle à la charge) */}
          <motion.div className="sc-aura" aria-hidden
            animate={phase === 'charging' ? { scale: [1, 1.35], opacity: [0.4, 1] } : opened ? { scale: 1.2, opacity: 0.85 } : { scale: [1, 1.08, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={phase === 'charging' ? { duration: 1 } : opened ? { duration: 0.4 } : { repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
          />

          {/* Éclat + flash à l'ouverture */}
          <AnimatePresence>
            {opened && (
              <>
                <motion.div className="sc-burst" aria-hidden
                  initial={{ scale: 0.2, opacity: 1 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }} />
                <motion.div className="sc-flash" aria-hidden
                  initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} />
                {SPARKS.map((s, i) => (
                  <motion.span key={i} className="sc-spark" aria-hidden
                    initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                    animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.4 }}
                    transition={{ duration: 0.7, delay: s.d, ease: 'easeOut' }} />
                ))}
              </>
            )}
          </AnimatePresence>

          {/* Le coffre : fermé (gigote / charge) puis ouvert */}
          {!opened ? (
            <motion.img
              className={'sc-chest' + (phase === 'idle' ? ' is-clickable' : '')}
              src={chestClosed} alt={T('modal.chest.aChest')} draggable={false}
              onClick={openChest}
              style={{ filter: 'drop-shadow(0 0 22px rgba(90,200,245,0.55)) drop-shadow(0 8px 10px rgba(0,0,0,.5))' }}
              animate={phase === 'charging'
                ? { rotate: [-8, 8, -7, 7, -9, 9, -6, 6, 0], x: [-4, 4, -4, 4, -3, 3, -2, 2, 0], scale: [1, 1.05, 1.03, 1.07, 1.1, 1.12] }
                : { rotate: [-4, 4, -4], y: [0, -5, 0] }}
              transition={phase === 'charging'
                ? { duration: 1.05, ease: 'easeInOut' }
                : { repeat: Infinity, duration: 0.55, ease: 'easeInOut' }}
            />
          ) : (
            <motion.img
              className="sc-chest" src={chestOpen} alt="" draggable={false}
              style={{ height: 224, filter: 'drop-shadow(0 0 30px rgba(120,220,250,0.8)) drop-shadow(0 8px 10px rgba(0,0,0,.5))' }}
              initial={{ scale: 0.5, opacity: 0, rotate: -6 }}
              animate={{ scale: [0.5, 1.18, 1], opacity: 1, rotate: [-6, 3, 0] }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          )}
        </div>

        {/* Invite (idle) ou révélation (open) */}
        {phase !== 'open' ? (
          <p className="sc-prompt">
            {phase === 'charging' ? T('modal.chest.opening') : <><b>{T(online && !drive ? 'modal.chest.tapPromptOnline' : 'modal.chest.tapPrompt')}</b></>}
          </p>
        ) : (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <motion.div className="sc-gold"
              initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 10, delay: 0.25 }}>
              +{gold} <span className="coin" />
            </motion.div>
            {choices.length > 0 ? (
              <>
                <p className="sc-reveal-desc">
                  {single ? T('modal.chest.chooseOne') : T('modal.chest.chooseN', { n: target, picked: picked.length })}
                </p>
                <div className="sc-choices" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                  {choices.map((key, i) => (
                    <SciCard key={key} itemKey={key} index={i} onPick={onPick} selected={picked.includes(key)} />
                  ))}
                </div>
                {!single && (
                  <button className="sc-btn" onClick={validate} disabled={picked.length !== target}>
                    {T('modal.chest.validate')}
                  </button>
                )}
                <p className="sc-final">{T('modal.chest.final')}</p>
              </>
            ) : (
              <button className="sc-btn" onClick={done}>{T('modal.nice')}</button>
            )}
          </motion.div>
        )}
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
