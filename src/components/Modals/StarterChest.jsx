// Cérémonie du « coffre de départ » : à son premier tour, chaque équipe ouvre
// un coffre qui lui donne 20 pièces + un consommable aléatoire. Pilotée par le
// store (showStarterChest + lastStarterReward) ; le butin est tiré à l'avance,
// accordé à la fermeture (closeStarterChest) — ce qui déclenche FlyingCoins.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import { locName, locDesc } from '../../i18n/content';
import { ITEMS, RARITIES } from '../../data/items';
import { itemImg } from '../../logic/itemAssets';
import { itemEffectLines } from '../../logic/effectText';
import { EVENT_IMG } from '../../data/eventAssets';
import { soundClick, soundMoney } from '../../logic/sounds';
import '../../styles/loot-reveal.css';

// Rayons dorés rotatifs derrière le coffre (même esprit que LootReveal).
const GOLD_RAYS = `conic-gradient(${Array.from({ length: 12 }, (_, i) => {
  const a = i * 30;
  return `#f5d36a40 ${a}deg ${a + 10}deg, transparent ${a + 10}deg ${a + 30}deg`;
}).join(', ')})`;

// Mini-carte de choix (3 tiennent côte à côte dans la modale grâce à flex:1).
// Affiche l'EFFET de l'objet : les élèves ne connaissent pas les consommables.
function ChoiceCard({ itemKey, index, onPick, selected }) {
  const item = ITEMS[itemKey];
  if (!item) return null;
  const r = RARITIES[item.rarity] || { color: '#888', name: '' };
  const img = itemImg(item);
  // Description lisible : desc simple si présente, sinon lignes d'effet auto.
  const desc = (locDesc(item) && locDesc(item).trim()) || itemEffectLines(item).join(' · ');
  return (
    <motion.button
      type="button"
      className={'loot-choice' + (selected ? ' is-selected' : '')}
      style={{ '--rar': r.color }}
      onClick={() => onPick(itemKey)}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + index * 0.1 }}
      whileHover={{ scale: 1.04, y: -3 }} whileTap={{ scale: 0.96 }}
    >
      {selected && <span className="loot-choice__check">✓</span>}
      {img
        ? <img className="loot-choice__img" src={img} alt="" draggable={false} style={{ filter: `drop-shadow(0 0 10px ${r.color}88)` }} />
        : <span className="loot-choice__emoji">{item.icon}</span>}
      <span className="loot-choice__name">{locName(item)}</span>
      <span className="loot-choice__rar">{r.name}</span>
      {desc && <span className="loot-choice__desc">{desc}</span>}
    </motion.button>
  );
}

function ChestInner({ team }) {
  const T = useT();
  const reward = useGameStore((s) => s.lastStarterReward);
  const close = useGameStore((s) => s.closeStarterChest);
  const [opened, setOpened] = useState(false);
  const [picked, setPicked] = useState([]);

  const choices = (reward?.choices || []).filter((k) => ITEMS[k]);
  const gold = reward?.gold ?? 20;
  // Nombre d'objets à garder, plafonné par ce qui est réellement proposé.
  const keep = Math.max(1, Math.min(reward?.keep ?? 1, choices.length || 1));
  const target = Math.min(keep, choices.length); // objets à sélectionner
  const single = target <= 1;

  // La modale s'élargit avec le nombre d'objets (au-delà de 2) : 4 colonnes max,
  // les cartes s'enroulent ensuite. Au plus 92% de l'écran.
  const cols = Math.min(choices.length || 1, 4);
  const modalWidth = choices.length > 2 ? Math.min(640, 96 + cols * 132) : 360;

  const open = () => { soundMoney(); setOpened(true); };
  const done = () => { soundClick(); close(null); };
  // 1 seul à garder : tap = choix immédiat. Plusieurs : on bascule la sélection.
  const onPick = (key) => {
    soundClick();
    if (single) { close(key); return; }
    setPicked((cur) => {
      if (cur.includes(key)) return cur.filter((k) => k !== key);
      if (cur.length >= target) return cur; // plafond atteint
      return [...cur, key];
    });
  };
  const validate = () => { soundClick(); close(picked); };

  return (
    <motion.div className="loot-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div
        initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 240 }}
      >
        <div className="loot-modal" style={{ width: modalWidth, maxWidth: '92vw' }}>
          <div className="loot-banner">{opened ? T('modal.chest.treasure', { emoji: team?.emoji || '' }) : T('modal.chest.aChest')}</div>

          {/* Scène du coffre */}
          <div style={{ position: 'relative', width: 300, height: 240, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
            <motion.div
              aria-hidden
              style={{ position: 'absolute', width: 320, height: 320, background: GOLD_RAYS, borderRadius: '50%' }}
              animate={{ rotate: 360, opacity: opened ? 0.95 : 0.35 }}
              transition={{ rotate: { repeat: Infinity, ease: 'linear', duration: 14 }, opacity: { duration: 0.4 } }}
            />
            <motion.img
              src={EVENT_IMG.coffre} alt={T('modal.chest.aChest')}
              style={{ width: opened ? 224 : 190, height: 'auto', position: 'relative', filter: 'drop-shadow(0 0 26px #f5d36aaa) drop-shadow(0 8px 10px rgba(0,0,0,.5))' }}
              animate={opened ? { scale: [1, 1.18, 1], rotate: [0, -3, 3, 0] } : { y: [0, -8, 0] }}
              transition={opened ? { duration: 0.6 } : { y: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' } }}
            />
          </div>

          {!opened ? (
            <>
              <p className="loot-desc" style={{ textAlign: 'center' }}>{T('modal.chest.openPrompt')}</p>
              <button className="loot-btn" onClick={open}>{T('modal.chest.openBtn')}</button>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
            >
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 10, delay: 0.25 }}
                style={{ fontFamily: "'Archivo Black', var(--font-display), sans-serif", fontSize: 30, color: '#f2b64a', textShadow: '0 2px 0 rgba(0,0,0,0.5)', display: 'inline-flex', alignItems: 'center', gap: 8 }}
              >
                +{gold} <span className="coin" />
              </motion.div>
              {choices.length > 0 ? (
                <>
                  <p className="loot-desc" style={{ textAlign: 'center', margin: 0 }}>
                    {single
                      ? T('modal.chest.chooseOne')
                      : T('modal.chest.chooseN', { n: target, picked: picked.length })}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, width: '100%', padding: '0 16px', alignItems: 'stretch' }}>
                    {choices.map((key, i) => (
                      <ChoiceCard key={key} itemKey={key} index={i} onPick={onPick} selected={picked.includes(key)} />
                    ))}
                  </div>
                  {!single && (
                    <button className="loot-btn" onClick={validate} disabled={picked.length !== target} style={picked.length !== target ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
                      {T('modal.chest.validate')}
                    </button>
                  )}
                  <p style={{ fontSize: 11, color: '#8b9096' }}>{T('modal.chest.final')}</p>
                </>
              ) : (
                <button className="loot-btn" onClick={done}>{T('modal.nice')}</button>
              )}
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
