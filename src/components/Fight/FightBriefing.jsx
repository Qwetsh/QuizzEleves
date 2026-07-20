import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { FIGHT_ROUNDS_TO_WIN } from '../../store/fightHandlers';
import { getMinigame, getDefaultMinigame } from './minigames';
import TeamAvatar from '../TeamAvatar';
import { soundClick, soundEvent } from '../../logic/sounds';
import { useT } from '../../i18n';

function resolveMinigame(fight) {
  return fight.forceDefault ? getDefaultMinigame() : getMinigame(fight.subject);
}

// ============================================================
//  Démos animées « exemple in-game » (façon présentation Mario Party)
//  Chaque démo est une petite scène qui boucle dans un écran.
// ============================================================

const SCREEN_W = 360;
const SCREEN_H = 208;

// Curseur main qui pointe/tape (réutilisé)
function TapCursor({ x, y, period = 2.4 }) {
  return (
    <motion.div
      style={{ position: 'absolute', fontSize: 30, zIndex: 5, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))' }}
      animate={{ left: x, top: y, scale: [1, 0.82, 1] }}
      transition={{ left: { duration: period, repeat: Infinity, ease: 'easeInOut' }, top: { duration: period, repeat: Infinity, ease: 'easeInOut' }, scale: { duration: period, repeat: Infinity, times: [0.45, 0.55, 0.65] } }}
    >
      {'\u{1F446}'}
    </motion.div>
  );
}

function FloatPlus({ x, delay = 0, val = '+1', color = '#7bd66a' }) {
  return (
    <motion.div
      style={{ position: 'absolute', left: x, fontFamily: 'var(--font-display)', fontWeight: 800, color, fontSize: 22, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
      initial={false}
      animate={{ top: ['52%', '20%'], opacity: [0, 1, 1, 0], scale: [0.6, 1.2, 1] }}
      transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.0, delay, times: [0, 0.2, 0.7, 1] }}
    >
      {val}
    </motion.div>
  );
}

// 1) Bulles à toucher (anglais / SVT)
function DemoTapBubbles() {
  const bubbles = [
    { label: '✓', good: true, x: 60, delay: 0 },
    { label: '✗', good: false, x: 175, delay: 0.7 },
    { label: '✓', good: true, x: 285, delay: 1.3 },
  ];
  return (
    <>
      {bubbles.map((b, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute', left: b.x - 26, width: 52, height: 52, borderRadius: '50%',
            display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 800,
            background: b.good ? 'radial-gradient(circle at 35% 30%, #d8f7cf, #8ed47e)' : 'radial-gradient(circle at 35% 30%, #f7d2d2, #e08e8e)',
            border: `3px solid ${b.good ? '#5b8c3a' : '#c9472f'}`,
            color: b.good ? '#2f5d18' : '#7a2218',
            boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
          }}
          animate={{ top: [SCREEN_H + 20, -60], scale: b.good ? [1, 1, 0.7, 1, 1] : [1, 1] }}
          transition={{ top: { duration: 3, repeat: Infinity, ease: 'linear', delay: b.delay }, scale: { duration: 3, repeat: Infinity, delay: b.delay, times: [0, 0.45, 0.5, 0.55, 1] } }}
        >
          {b.label}
        </motion.div>
      ))}
      <FloatPlus x={60 - 12} val="+1" delay={0.2} />
      <FloatPlus x={285 - 12} val="+1" delay={1.5} />
      <FloatPlus x={175 - 14} val="−1" color="#e88" delay={0.9} />
      <TapCursor x={[40, 50, 270, 270, 40]} y={[150, 80, 80, 110, 150]} period={3} />
    </>
  );
}

// 2) Choisir la bonne réponse (duel de rapidité)
function DemoPickAnswer() {
  const card = (label, x, correct) => (
    <motion.div
      style={{
        position: 'absolute', left: x, top: 70, width: 130, height: 64, borderRadius: 12,
        display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
        background: 'linear-gradient(180deg, #fffaf0, #f0e3c6)', border: '2px solid #b89a5e',
        fontFamily: 'var(--font-ui)', fontWeight: 600, color: '#5a4424',
      }}
      animate={correct ? { borderColor: ['#b89a5e', '#b89a5e', '#5b8c3a', '#5b8c3a', '#b89a5e'], background: ['linear-gradient(180deg,#fffaf0,#f0e3c6)', 'linear-gradient(180deg,#fffaf0,#f0e3c6)', 'linear-gradient(180deg,#d6f3c2,#a9da88)', 'linear-gradient(180deg,#d6f3c2,#a9da88)', 'linear-gradient(180deg,#fffaf0,#f0e3c6)'] } : {}}
      transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.45, 0.55, 0.85, 1] }}
    >
      <span style={{ width: 24, height: 24, borderRadius: 6, background: '#b89a5e', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{label}</span>
      <span style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(122,94,58,0.25)' }} />
      {correct && (
        <motion.span style={{ color: '#5b8c3a', fontWeight: 900, fontSize: 20 }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.5, 0.5, 1.3, 1, 0.5] }}
          transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.5, 0.6, 0.85, 1] }}>{'✓'}</motion.span>
      )}
    </motion.div>
  );
  return (
    <>
      <div style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', width: 200, height: 26, borderRadius: 8, background: 'rgba(255,255,255,0.25)' }} />
      {card('A', 30, true)}
      {card('B', 200, false)}
      <TapCursor x={[150, 60, 60, 150]} y={[120, 95, 110, 120]} period={2.6} />
    </>
  );
}

// 3) Frise du temps (histoire) : une carte tombe dans le bon créneau
function DemoTimeline() {
  const slotY = 120;
  return (
    <>
      {/* frise */}
      <div style={{ position: 'absolute', left: 24, right: 24, top: slotY + 26, height: 4, background: '#caa86a', borderRadius: 2 }} />
      {[40, 150, 260].map((x, i) => (
        <div key={i} style={{ position: 'absolute', left: x, top: slotY, width: 60, height: 42, borderRadius: 8, border: '2px dashed #caa86a', background: 'rgba(255,255,255,0.12)' }} />
      ))}
      {/* cartes déjà posées */}
      <div style={{ position: 'absolute', left: 40, top: slotY, width: 60, height: 42, borderRadius: 8, background: 'linear-gradient(180deg,#fffaf0,#e9d8b0)', border: '2px solid #b89a5e', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#7a5a28', fontSize: 13 }}>1789</div>
      <div style={{ position: 'absolute', left: 260, top: slotY, width: 60, height: 42, borderRadius: 8, background: 'linear-gradient(180deg,#fffaf0,#e9d8b0)', border: '2px solid #b89a5e', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#7a5a28', fontSize: 13 }}>1914</div>
      {/* carte qui tombe au milieu */}
      <motion.div
        style={{ position: 'absolute', left: 150, width: 60, height: 42, borderRadius: 8, background: 'linear-gradient(180deg,#fff,#d9ecff)', border: '2px solid #3b6cb3', display: 'grid', placeItems: 'center', fontWeight: 800, color: '#274b7a', fontSize: 13, zIndex: 4 }}
        animate={{ top: [-50, slotY, slotY], borderColor: ['#3b6cb3', '#3b6cb3', '#5b8c3a'], boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 0 0 rgba(0,0,0,0)', '0 0 16px rgba(91,140,58,0.8)'] }}
        transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.5, 1], ease: 'easeIn' }}
      >1870</motion.div>
    </>
  );
}

// 4) Le compte est bon (maths)
function DemoCompute() {
  const T = useT();
  const tiles = ['6', '×', '7', '−', '2'];
  return (
    <>
      <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-ui)', color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{T('fight.compte.target')}</span>
        <motion.span
          style={{ fontFamily: 'var(--font-display)', fontSize: 30, padding: '2px 14px', borderRadius: 10, background: '#2b1c10', color: '#f3c969', border: '2px solid #f3c969' }}
          animate={{ boxShadow: ['0 0 0 rgba(243,201,105,0)', '0 0 0 rgba(243,201,105,0)', '0 0 18px rgba(123,214,106,0.9)'], color: ['#f3c969', '#f3c969', '#9be67f'] }}
          transition={{ duration: 3, repeat: Infinity, times: [0, 0.75, 1] }}
        >40</motion.span>
      </div>
      <div style={{ position: 'absolute', top: 96, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
        {tiles.map((t, i) => (
          <motion.span key={i}
            style={{ width: 40, height: 48, borderRadius: 10, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: 22, background: 'linear-gradient(180deg,#fffaf0,#e9d8b0)', border: '2px solid #b89a5e', color: '#5a4424' }}
            animate={{ opacity: [0, 1], y: [12, 0], scale: [0.6, 1] }}
            transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 3 - 0.4, delay: i * 0.45 }}
          >{t}</motion.span>
        ))}
      </div>
      <motion.div
        style={{ position: 'absolute', top: 160, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-display)', fontSize: 20, color: '#9be67f' }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: 3, repeat: Infinity, times: [0, 0.7, 0.78, 0.95, 1] }}
      >= 40 {'✓'}</motion.div>
    </>
  );
}

// 5) Le mot le plus long (français)
function DemoWord() {
  const letters = ['M', 'A', 'I', 'S', 'O', 'N'];
  return (
    <>
      <div style={{ position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 6 }}>
        {letters.map((l, i) => (
          <motion.span key={i}
            style={{ position: 'relative', width: 40, height: 48, borderRadius: 8, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontSize: 22, background: 'linear-gradient(180deg,#fff6df,#f0d99a)', border: '2px solid #c9a24e', color: '#6a4e02' }}
            animate={{ opacity: [0, 1], y: [-18, 0], rotate: [-8, 0] }}
            transition={{ duration: 0.35, repeat: Infinity, repeatDelay: 3 - 0.35, delay: i * 0.4 }}
          >
            {l}
            <span style={{ position: 'absolute', right: 3, bottom: 1, fontSize: 9, color: '#9a7a2a', fontFamily: 'var(--font-ui)', fontWeight: 700 }}>{[1, 1, 1, 1, 1, 1][i]}</span>
          </motion.span>
        ))}
      </div>
      <motion.div
        style={{ position: 'absolute', top: 150, left: '50%', transform: 'translateX(-50%)', fontFamily: 'var(--font-display)', fontSize: 22, color: '#f3c969' }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.6, 0.6, 1.2, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, times: [0, 0.72, 0.8, 0.95, 1] }}
      >+27 {'\u{1F4AA}'}</motion.div>
    </>
  );
}

// 6) Tour du monde (géo) : drapeau qui se plante près de la cible
function DemoGeo() {
  return (
    <>
      {/* carte stylisée */}
      <div style={{ position: 'absolute', inset: 16, borderRadius: 14, background: 'linear-gradient(180deg,#9fd3ef,#7fbfe3)', overflow: 'hidden', border: '2px solid rgba(255,255,255,0.4)' }}>
        <div style={{ position: 'absolute', left: '12%', top: '30%', width: 90, height: 70, background: '#9ccf7a', borderRadius: '40% 50% 45% 55%' }} />
        <div style={{ position: 'absolute', right: '14%', top: '20%', width: 70, height: 90, background: '#9ccf7a', borderRadius: '55% 45% 50% 40%' }} />
        <div style={{ position: 'absolute', right: '24%', bottom: '12%', width: 50, height: 40, background: '#9ccf7a', borderRadius: '50%' }} />
      </div>
      {/* cible */}
      <div style={{ position: 'absolute', right: 96, top: 70, fontSize: 22 }}>{'⭐'}</div>
      {/* drapeau qui tombe */}
      <motion.div
        style={{ position: 'absolute', right: 86, fontSize: 30, transformOrigin: 'bottom center' }}
        animate={{ top: [-30, 92, 92], rotate: [-20, 0, 0] }}
        transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.5, 1], ease: 'easeIn' }}
      >{'\u{1F4CD}'}</motion.div>
      <motion.div
        style={{ position: 'absolute', right: 70, top: 60, fontFamily: 'var(--font-display)', fontSize: 18, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.6, 0.6, 1.2, 1, 0.6] }}
        transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.55, 0.65, 0.9, 1] }}
      >5 000 !</motion.div>
    </>
  );
}

// 7) Memory (paires) : deux cartes se retournent et révèlent une paire qui matche
function DemoMemory() {
  const cells = [0, 1, 2, 3, 4, 5];
  // les cartes 1 et 4 forment la paire révélée (dog / chien)
  const reveal = { 1: 'dog', 4: 'chien' };
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gridTemplateRows: 'repeat(2, 56px)', gap: 10 }}>
        {cells.map((c) => {
          const isPair = c === 1 || c === 4;
          return (
            <motion.div
              key={c}
              style={{ borderRadius: 10, display: 'grid', placeItems: 'center', fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 14, border: '2px solid #b89a5e', overflow: 'hidden' }}
              animate={isPair
                ? { background: ['radial-gradient(circle at 50% 30%,#6a4f8a,#3a2a55)', 'radial-gradient(circle at 50% 30%,#6a4f8a,#3a2a55)', 'linear-gradient(180deg,#d1f0b8,#fffdf7)', 'linear-gradient(180deg,#d1f0b8,#fffdf7)'], color: ['#3a2a55', '#3a2a55', '#3a5a18', '#3a5a18'], borderColor: ['#b89a5e', '#b89a5e', '#5b8c3a', '#5b8c3a'] }
                : { background: 'radial-gradient(circle at 50% 30%,#6a4f8a,#3a2a55)', color: '#3a2a55' }}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.4, 0.55, 1] }}
            >
              {isPair
                ? <motion.span animate={{ opacity: [0, 0, 1, 1] }} transition={{ duration: 3, repeat: Infinity, times: [0, 0.5, 0.6, 1] }}>{reveal[c]}</motion.span>
                : <span style={{ fontSize: 22, color: 'rgba(255,255,255,0.85)' }}>{'❓'}</span>}
            </motion.div>
          );
        })}
      </div>
      <FloatPlus x={150} val="paire !" color="#7bd66a" />
    </div>
  );
}

// 8) Deblur (photo mystère) : l'image se défloute, on touche le bon nom
function DemoDeblur() {
  const chip = (label, x, correct) => (
    <motion.div
      style={{
        position: 'absolute', left: x, top: 156, width: 120, height: 36, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: 'linear-gradient(180deg, #fffaf0, #f0e3c6)', border: '2px solid #b89a5e',
        fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13, color: '#5a4424',
      }}
      animate={correct
        ? { borderColor: ['#b89a5e', '#b89a5e', '#5b8c3a', '#5b8c3a', '#b89a5e'], background: ['linear-gradient(180deg,#fffaf0,#f0e3c6)', 'linear-gradient(180deg,#fffaf0,#f0e3c6)', 'linear-gradient(180deg,#d6f3c2,#a9da88)', 'linear-gradient(180deg,#d6f3c2,#a9da88)', 'linear-gradient(180deg,#fffaf0,#f0e3c6)'] }
        : {}}
      transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.6, 0.7, 0.9, 1] }}
    >
      {label}
      {correct && (
        <motion.span style={{ color: '#5b8c3a', fontWeight: 900 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.65, 0.72, 0.9, 1] }}>{'✓'}</motion.span>
      )}
    </motion.div>
  );
  return (
    <>
      {/* cadre photo au centre, l'emoji se défloute en boucle */}
      <div style={{ position: 'absolute', left: '50%', top: 18, transform: 'translateX(-50%)', width: 130, height: 124, borderRadius: 12, background: '#0d0a06', border: '2px solid rgba(243,201,105,0.6)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
        <motion.span
          style={{ fontSize: 72 }}
          animate={{ filter: ['blur(14px)', 'blur(1px)', 'blur(0px)', 'blur(14px)'] }}
          transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.6, 0.9, 1], ease: 'linear' }}
        >
          {'\u{1F98A}'}
        </motion.span>
      </div>
      {/* jauge de netteté */}
      <div style={{ position: 'absolute', left: '50%', top: 146, transform: 'translateX(-50%)', width: 130, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.18)', overflow: 'hidden' }}>
        <motion.div
          style={{ height: '100%', background: 'linear-gradient(90deg, #f3c969, #9be67f)' }}
          animate={{ width: ['0%', '100%', '100%', '0%'] }}
          transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.6, 0.98, 1], ease: 'linear' }}
        />
      </div>
      {chip('Renard', 46, true)}
      {chip('Loup', 196, false)}
      <TapCursor x={[240, 90, 90, 240]} y={[120, 168, 172, 120]} period={3.2} />
    </>
  );
}

// « Qui est ce Pokémon ?! » : mini plateau TV (rayons rouges + halo étoilé),
// silhouette noire qui passe en couleur, « ? » jaune, chip du bon nom validée.
function DemoSilhouette() {
  const chip = (label, x, correct) => (
    <motion.div
      style={{
        position: 'absolute', left: x, top: 156, width: 120, height: 36, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: 'linear-gradient(180deg, #fffaf0, #f0e3c6)', border: '2px solid #b89a5e',
        fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13, color: '#5a4424',
      }}
      animate={correct
        ? { borderColor: ['#b89a5e', '#b89a5e', '#5b8c3a', '#5b8c3a', '#b89a5e'], background: ['linear-gradient(180deg,#fffaf0,#f0e3c6)', 'linear-gradient(180deg,#fffaf0,#f0e3c6)', 'linear-gradient(180deg,#d6f3c2,#a9da88)', 'linear-gradient(180deg,#d6f3c2,#a9da88)', 'linear-gradient(180deg,#fffaf0,#f0e3c6)'] }
        : {}}
      transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.55, 0.65, 0.9, 1] }}
    >
      {label}
      {correct && (
        <motion.span style={{ color: '#5b8c3a', fontWeight: 900 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.6, 0.67, 0.9, 1] }}>{'✓'}</motion.span>
      )}
    </motion.div>
  );
  return (
    <>
      {/* plateau TV : rayons rouges + halo étoilé, silhouette révélée en boucle */}
      <div style={{ position: 'absolute', left: '50%', top: 14, transform: 'translateX(-50%)', width: 170, height: 132, borderRadius: 12, overflow: 'hidden', border: '2px solid #16161a' }}>
        <div style={{ position: 'absolute', inset: '-60%', background: 'repeating-conic-gradient(from 0deg at 50% 50%, #e8402c 0deg 12deg, #c92315 12deg 24deg)' }} />
        <div style={{ position: 'absolute', left: '50%', top: '50%', width: 96, height: 96, transform: 'translate(-50%, -50%)', borderRadius: '50%', background: 'radial-gradient(circle, #fff 32%, #cfe4ff 52%, transparent 70%)' }} />
        <motion.span
          style={{ position: 'absolute', left: '50%', top: '50%', x: '-50%', y: '-50%', fontSize: 58, lineHeight: 1 }}
          animate={{ filter: ['brightness(0)', 'brightness(0)', 'brightness(1)', 'brightness(1)', 'brightness(0)'] }}
          transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.6, 0.68, 0.95, 1] }}
        >
          {'\u{1F422}'}
        </motion.span>
        <motion.span
          style={{ position: 'absolute', right: 8, top: 6, fontSize: 30, fontWeight: 900, color: '#ffcb05', WebkitTextStroke: '1.5px #3d7dca', fontFamily: 'var(--font-display)', transform: 'rotate(6deg)' }}
          animate={{ opacity: [1, 1, 0, 0, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.6, 0.66, 0.95, 1] }}
        >
          ?
        </motion.span>
      </div>
      {chip('Tortank', 46, true)}
      {chip('Onix', 196, false)}
      <TapCursor x={[240, 90, 90, 240]} y={[120, 168, 172, 120]} period={3.2} />
    </>
  );
}

// Course d'images NETTES (Drapeau éclair) : un drapeau s'affiche, le curseur
// fonce sur le bon nom — pure rapidité, pas de flou.
function DemoImgRace() {
  const chip = (label, x, correct) => (
    <motion.div
      style={{
        position: 'absolute', left: x, top: 156, width: 120, height: 36, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: 'linear-gradient(180deg, #fffaf0, #f0e3c6)', border: '2px solid #b89a5e',
        fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 13, color: '#5a4424',
      }}
      animate={correct
        ? { borderColor: ['#b89a5e', '#b89a5e', '#5b8c3a', '#5b8c3a', '#b89a5e'], background: ['linear-gradient(180deg,#fffaf0,#f0e3c6)', 'linear-gradient(180deg,#fffaf0,#f0e3c6)', 'linear-gradient(180deg,#d6f3c2,#a9da88)', 'linear-gradient(180deg,#d6f3c2,#a9da88)', 'linear-gradient(180deg,#fffaf0,#f0e3c6)'] }
        : {}}
      transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.35, 0.45, 0.9, 1] }}
    >
      {label}
      {correct && (
        <motion.span style={{ color: '#5b8c3a', fontWeight: 900 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.4, 0.47, 0.9, 1] }}>{'✓'}</motion.span>
      )}
    </motion.div>
  );
  return (
    <>
      {/* drapeau tricolore stylisé, affiché NET, qui pop à chaque boucle */}
      <motion.div
        style={{ position: 'absolute', left: '50%', top: 22, transform: 'translateX(-50%)', width: 170, height: 116, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.5)', display: 'flex', boxShadow: '0 6px 14px rgba(0,0,0,0.4)' }}
        animate={{ scale: [0.7, 1, 1, 0.7], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.12, 0.94, 1] }}
      >
        <div style={{ flex: 1, background: '#0055a4' }} />
        <div style={{ flex: 1, background: '#fff' }} />
        <div style={{ flex: 1, background: '#ef4135' }} />
      </motion.div>
      {chip('France', 46, true)}
      {chip('Pays-Bas', 196, false)}
      <TapCursor x={[240, 90, 90, 240]} y={[120, 168, 172, 120]} period={2.4} />
    </>
  );
}

// Tableau de Mendeleïev : mini-grille d'éléments colorés, la cible s'affiche
// (« Fer ») et le curseur clique la bonne case qui s'illumine.
function DemoMendeleiev() {
  const T = useT();
  const cells = [
    ['H', '#6bc6f9'], ['Li', '#f97b6b'], ['Na', '#f97b6b'], ['Mg', '#f9a86b'], ['Al', '#a8d08d'], ['Si', '#6bd6a8'],
    ['K', '#f97b6b'], ['Ca', '#f9a86b'], ['Fe', '#f9d66b'], ['Cu', '#f9d66b'], ['Zn', '#f9d66b'], ['Br', '#8f9bf9'],
    ['Ag', '#f9d66b'], ['Sn', '#a8d08d'], ['I', '#8f9bf9'], ['Au', '#f9d66b'], ['Hg', '#f9d66b'], ['Pb', '#a8d08d'],
  ];
  return (
    <>
      <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', padding: '4px 16px', borderRadius: 9, background: 'rgba(255,254,251,0.95)', fontFamily: 'var(--font-display)', fontSize: 16, color: '#3a2c1a' }}>
        {T('fight.mendeleiev.find')} <b>Fer</b>
      </div>
      <div style={{ position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)', display: 'grid', gridTemplateColumns: 'repeat(6, 42px)', gap: 4 }}>
        {cells.map(([s, color], i) => {
          const isFe = s === 'Fe';
          return (
            <motion.div
              key={i}
              style={{
                height: 38, borderRadius: 5, display: 'grid', placeItems: 'center',
                background: color, border: '1px solid rgba(0,0,0,0.25)',
                fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 14, color: '#25303a',
              }}
              animate={isFe
                ? { scale: [1, 1, 1.35, 1.35, 1], background: [color, color, '#9be67f', '#9be67f', color], boxShadow: ['0 0 0 rgba(0,0,0,0)', '0 0 0 rgba(0,0,0,0)', '0 0 16px rgba(155,230,127,0.9)', '0 0 16px rgba(155,230,127,0.9)', '0 0 0 rgba(0,0,0,0)'] }
                : {}}
              transition={{ duration: 2.8, repeat: Infinity, times: [0, 0.5, 0.6, 0.9, 1] }}
            >
              {s}
            </motion.div>
          );
        })}
      </div>
      <TapCursor x={[260, 120, 120, 260]} y={[170, 108, 112, 170]} period={2.8} />
    </>
  );
}

// Blind test : vinyle qui tourne + égaliseur, le curseur choisit la bonne réponse.
function DemoAudioRace() {
  const chip = (label, x, correct) => (
    <motion.div
      style={{
        position: 'absolute', left: x, top: 156, width: 130, height: 36, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        background: 'linear-gradient(180deg, #fffaf0, #f0e3c6)', border: '2px solid #b89a5e',
        fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 12, color: '#5a4424',
      }}
      animate={correct
        ? { borderColor: ['#b89a5e', '#b89a5e', '#5b8c3a', '#5b8c3a', '#b89a5e'], background: ['linear-gradient(180deg,#fffaf0,#f0e3c6)', 'linear-gradient(180deg,#fffaf0,#f0e3c6)', 'linear-gradient(180deg,#d6f3c2,#a9da88)', 'linear-gradient(180deg,#d6f3c2,#a9da88)', 'linear-gradient(180deg,#fffaf0,#f0e3c6)'] }
        : {}}
      transition={{ duration: 3, repeat: Infinity, times: [0, 0.55, 0.65, 0.9, 1] }}
    >
      {label}
      {correct && (
        <motion.span style={{ color: '#5b8c3a', fontWeight: 900 }}
          animate={{ opacity: [0, 0, 1, 1, 0] }}
          transition={{ duration: 3, repeat: Infinity, times: [0, 0.6, 0.67, 0.9, 1] }}>{'✓'}</motion.span>
      )}
    </motion.div>
  );
  return (
    <>
      {/* vinyle */}
      <motion.div
        style={{
          position: 'absolute', left: 62, top: 34, width: 96, height: 96, borderRadius: '50%',
          background: 'repeating-radial-gradient(circle at 50% 50%, #191919 0 3px, #2a2a2a 3px 6px)',
          border: '3px solid #0a0a0a', display: 'grid', placeItems: 'center',
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
      >
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #f3c969, #b8862c)', display: 'grid', placeItems: 'center', fontSize: 15 }}>🎵</div>
      </motion.div>
      {/* égaliseur */}
      <div style={{ position: 'absolute', left: 196, top: 56, display: 'flex', alignItems: 'flex-end', gap: 5, height: 52 }}>
        {[0.9, 0.5, 0.75, 0.4, 1, 0.6].map((h, i) => (
          <motion.div
            key={i}
            style={{ width: 9, height: 52 * h, borderRadius: 3, background: 'linear-gradient(180deg, #9be67f, #f3c969)', transformOrigin: 'bottom' }}
            animate={{ scaleY: [0.3, 1, 0.3] }}
            transition={{ duration: 0.5 + (i % 3) * 0.16, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>
      {chip('♪ Titre A', 40, true)}
      {chip('♪ Titre B', 196, false)}
      <TapCursor x={[250, 90, 90, 250]} y={[120, 168, 172, 120]} period={3} />
    </>
  );
}

// Combat Pokémon : deux sprites face à face, lunge + barre de PV qui fond.
function DemoPkmn() {
  const T = useT();
  const bar = (side, animate) => (
    <div style={{ position: 'absolute', [side]: 14, top: side === 'right' ? 16 : 118, width: 130, borderRadius: 8, padding: '4px 8px', background: 'linear-gradient(180deg,#fdf6dd,#f0e3bc)', border: '2px solid #5a4a28' }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#3a2c14' }}>{side === 'right' ? 'Tortank' : 'Dracaufeu'} <span style={{ float: 'right', color: '#7a6236' }}>Nv.50</span></div>
      <div style={{ marginTop: 3, height: 7, borderRadius: 4, background: '#4a3c20', padding: 1 }}>
        {animate
          ? <motion.div style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(180deg,#7de060,#3fae42)' }} animate={{ width: ['86%', '86%', '38%', '38%', '86%'], background: ['linear-gradient(180deg,#7de060,#3fae42)', 'linear-gradient(180deg,#7de060,#3fae42)', 'linear-gradient(180deg,#f2d060,#d8a53f)', 'linear-gradient(180deg,#f2d060,#d8a53f)', 'linear-gradient(180deg,#7de060,#3fae42)'] }} transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.42, 0.55, 0.92, 1] }} />
          : <div style={{ height: '100%', width: '72%', borderRadius: 3, background: 'linear-gradient(180deg,#7de060,#3fae42)' }} />}
      </div>
    </div>
  );
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #8ecff2 0%, #b9e3f7 52%, #7cba6d 52%, #5f9e52 100%)' }} />
      <motion.img
        src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/6.gif"
        style={{ position: 'absolute', left: 44, bottom: 26, height: 72, imageRendering: 'pixelated', transform: 'scaleX(-1)' }}
        animate={{ x: [0, 0, 34, 0, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.38, 0.48, 0.58, 1] }}
      />
      <motion.img
        src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/9.gif"
        style={{ position: 'absolute', right: 48, bottom: 78, height: 60, imageRendering: 'pixelated' }}
        animate={{ filter: ['brightness(1)', 'brightness(1)', 'brightness(2.6)', 'brightness(1)'], x: [0, 0, 6, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.5, 0.56, 0.65] }}
      />
      {bar('right', true)}
      {bar('left', false)}
      <motion.div
        style={{ position: 'absolute', left: '50%', bottom: 8, transform: 'translateX(-50%)', fontFamily: 'var(--font-display)', fontSize: 14, color: '#fff', textShadow: '0 2px 3px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.55, 0.62, 0.92, 1] }}
      >
        {T('fight.pkmn.superEff')}
      </motion.div>
    </>
  );
}

// Échecs « mat en N » : mini-échiquier 4x4, un Cavalier saute vers la case du
// mat (flèche + halo vert), le Roi noir cerné. Démo LÉGÈRE, purement illustrative.
function DemoChess() {
  const light = '#e9d6b0';
  const dark = '#a97e56';
  const N = 4;
  const cell = 46;
  const board = N * cell;
  // Pièces posées (col,row 0-indexé depuis le haut-gauche) : Roi noir cerné en
  // haut-droite, notre Cavalier en bas-gauche qui vient mater.
  const bK = { c: 3, r: 0, g: '♚', color: '#1c1a17' };
  const wN = { c: 1, r: 3, g: '♘', color: '#fffdf7' };
  const wQ = { c: 3, r: 3, g: '♕', color: '#fffdf7' };
  const target = { c: 2, r: 1 }; // case du mat (Cf5#-like)
  const pos = (c, r) => ({ left: c * cell, top: r * cell });
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <div style={{ position: 'relative', width: board, height: board, borderRadius: 6, overflow: 'hidden', border: '3px solid #5a4024', boxShadow: '0 6px 16px rgba(0,0,0,0.4)' }}>
        {/* cases */}
        {Array.from({ length: N * N }, (_, i) => {
          const c = i % N; const r = Math.floor(i / N);
          const isLight = (c + r) % 2 === 0;
          const isTarget = c === target.c && r === target.r;
          return (
            <motion.div key={i}
              style={{ position: 'absolute', left: c * cell, top: r * cell, width: cell, height: cell, background: isLight ? light : dark }}
              animate={isTarget ? { boxShadow: ['inset 0 0 0 0 rgba(91,140,58,0)', 'inset 0 0 0 0 rgba(91,140,58,0)', 'inset 0 0 0 4px rgba(91,140,58,0.9)', 'inset 0 0 0 4px rgba(91,140,58,0.9)', 'inset 0 0 0 0 rgba(91,140,58,0)'] } : {}}
              transition={{ duration: 3, repeat: Infinity, times: [0, 0.45, 0.55, 0.9, 1] }}
            />
          );
        })}
        {/* Roi noir + Dame blanche (statiques) */}
        {[bK, wQ].map((p, i) => (
          <span key={i} style={{ position: 'absolute', ...pos(p.c, p.r), width: cell, height: cell, display: 'grid', placeItems: 'center', fontSize: 30, color: p.color, textShadow: p.color === '#1c1a17' ? '0 1px 0 rgba(255,255,255,0.25)' : '0 1px 1px rgba(0,0,0,0.55)' }}>{p.g}</span>
        ))}
        {/* Cavalier qui saute vers la case du mat, en boucle */}
        <motion.span
          style={{ position: 'absolute', width: cell, height: cell, display: 'grid', placeItems: 'center', fontSize: 30, color: wN.color, textShadow: '0 1px 1px rgba(0,0,0,0.55)', zIndex: 3 }}
          animate={{ left: [wN.c * cell, wN.c * cell, target.c * cell, target.c * cell, wN.c * cell], top: [wN.r * cell, wN.r * cell, target.r * cell, target.r * cell, wN.r * cell] }}
          transition={{ duration: 3, repeat: Infinity, times: [0, 0.4, 0.55, 0.9, 1], ease: 'easeInOut' }}
        >
          {wN.g}
        </motion.span>
        {/* « # » (mat) qui apparaît sur le Roi */}
        <motion.span
          style={{ position: 'absolute', left: bK.c * cell + 8, top: bK.r * cell - 4, fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 900, color: '#c9472f', zIndex: 4, textShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
          animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.5, 0.5, 1.3, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, times: [0, 0.55, 0.65, 0.9, 1] }}
        >#</motion.span>
      </div>
    </div>
  );
}

// Cyber-duel (Hacking) : mini-terminal — une ligne de code trouée dont le trou
// se remplit en vert, la barre de hack se remplit, puis « ACCÈS ACCORDÉ ».
function DemoHack() {
  const T = useT();
  const mono = "'Consolas','SF Mono',ui-monospace,monospace";
  return (
    <div style={{ position: 'absolute', inset: 14, borderRadius: 10, background: '#04070a', border: '1px solid rgba(74,224,138,0.4)', overflow: 'hidden', backgroundImage: 'repeating-linear-gradient(0deg, rgba(74,224,138,0.05) 0 1px, transparent 1px 4px)', fontFamily: mono }}>
      {/* barre de titre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'linear-gradient(180deg,#12181a,#0a0e10)', borderBottom: '1px solid rgba(74,224,138,0.25)', fontSize: 11, color: '#7fe0a8' }}>
        ██ EXPLOIT.py
      </div>
      {/* code */}
      <div style={{ padding: '14px 12px', fontSize: 15, lineHeight: 1.8, color: '#3ddc84', textShadow: '0 0 6px rgba(61,220,132,0.4)' }}>
        <div><span style={{ color: 'rgba(74,224,138,0.35)', marginRight: 8 }}>1</span><span style={{ color: '#7fe0a8' }}>shell = os.</span>
          <motion.span
            style={{ display: 'inline-block', minWidth: 40, padding: '0 4px', borderRadius: 3, fontWeight: 800 }}
            animate={{
              color: ['#04070a', '#04070a', '#9bff6d', '#9bff6d', '#04070a'],
              background: ['#f3d64a', '#f3d64a', 'rgba(120,255,110,0.16)', 'rgba(120,255,110,0.16)', '#f3d64a'],
              boxShadow: ['0 0 12px rgba(243,214,74,0.8)', '0 0 12px rgba(243,214,74,0.8)', '0 0 12px rgba(120,255,110,0.7)', '0 0 12px rgba(120,255,110,0.7)', '0 0 12px rgba(243,214,74,0.8)'],
            }}
            transition={{ duration: 3, repeat: Infinity, times: [0, 0.4, 0.5, 0.9, 1] }}
          >
            <motion.span animate={{ opacity: [1, 1, 0, 0, 1] }} transition={{ duration: 3, repeat: Infinity, times: [0, 0.45, 0.5, 0.9, 1] }}>▮</motion.span>
            <motion.span animate={{ opacity: [0, 0, 1, 1, 0] }} transition={{ duration: 3, repeat: Infinity, times: [0, 0.45, 0.5, 0.9, 1] }}>system</motion.span>
          </motion.span>
          <span style={{ color: '#7fe0a8' }}>()</span>
        </div>
      </div>
      {/* barre de hack */}
      <div style={{ position: 'absolute', left: 12, right: 12, bottom: 40, height: 8, borderRadius: 5, background: 'rgba(74,224,138,0.12)', border: '1px solid rgba(74,224,138,0.3)', overflow: 'hidden' }}>
        <motion.div style={{ height: '100%', background: 'linear-gradient(90deg,#2fae5f,#8effc0)' }}
          animate={{ width: ['0%', '0%', '100%', '100%', '0%'] }}
          transition={{ duration: 3, repeat: Infinity, times: [0, 0.45, 0.55, 0.9, 1] }} />
      </div>
      {/* ACCÈS ACCORDÉ */}
      <motion.div
        style={{ position: 'absolute', left: 0, right: 0, bottom: 8, textAlign: 'center', fontFamily: mono, fontSize: 15, fontWeight: 800, letterSpacing: '0.08em', color: '#8effc0', textShadow: '0 0 12px rgba(120,255,180,0.9)' }}
        animate={{ opacity: [0, 0, 1, 1, 0], scale: [0.7, 0.7, 1.1, 1, 0.7] }}
        transition={{ duration: 3, repeat: Infinity, times: [0, 0.55, 0.62, 0.9, 1] }}
      >
        {T('fight.hack.access')}
      </motion.div>
    </div>
  );
}

// Duel de sorciers (Priori Incantatem) : deux baguettes, deux rais qui se
// heurtent en un orbe au centre qui oscille, puis un « toucher » côté droit.
function DemoWizard() {
  const T = useT();
  const A = '#c0392b'; // rai attaquant (gauche)
  const D = '#2e86c1'; // rai défenseur (droite)
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 35%, #1a1230, #0d0818 65%, #050308)' }}>
      {/* baguettes */}
      <div style={{ position: 'absolute', left: 40, top: '48%', width: 34, height: 4, borderRadius: 3, background: 'linear-gradient(90deg,#6a5636,#d8c39a)', transform: 'translateY(-50%) rotate(-8deg)' }} />
      <div style={{ position: 'absolute', right: 40, top: '48%', width: 34, height: 4, borderRadius: 3, background: 'linear-gradient(270deg,#6a5636,#d8c39a)', transform: 'translateY(-50%) rotate(8deg)' }} />
      {/* deux sorciers stylisés (chapeaux pointus) */}
      {[{ x: 18, c: A }, { x: SCREEN_W - 46, c: D }].map((w, i) => (
        <motion.div key={i} style={{ position: 'absolute', left: w.x, top: '42%', width: 28, height: 44 }}
          animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity, delay: i * 1.5 }}>
          <div style={{ position: 'absolute', left: 4, top: 0, width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderBottom: `16px solid ${w.c}` }} />
          <div style={{ position: 'absolute', left: 2, top: 16, width: 24, height: 28, borderRadius: '10px 10px 4px 4px', background: `${w.c}cc` }} />
        </motion.div>
      ))}
      {/* les deux rais : leur largeur suit l'orbe qui oscille */}
      <motion.div style={{ position: 'absolute', left: 66, top: '48%', height: 7, transformOrigin: 'left center', borderRadius: 6, background: `linear-gradient(90deg, ${A}00, ${A} 40%, #fff)`, boxShadow: `0 0 14px ${A}`, translateY: '-50%' }}
        animate={{ width: [120, 200, 60, 200, 120] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.35, 0.65, 0.85, 1], ease: 'easeInOut' }} />
      <motion.div style={{ position: 'absolute', right: 66, top: '48%', height: 7, transformOrigin: 'right center', borderRadius: 6, background: `linear-gradient(270deg, ${D}00, ${D} 40%, #fff)`, boxShadow: `0 0 14px ${D}`, translateY: '-50%' }}
        animate={{ width: [180, 100, 240, 100, 180] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.35, 0.65, 0.85, 1], ease: 'easeInOut' }} />
      {/* l'orbe au point de rencontre, qui glisse vers la droite (le défenseur) */}
      <motion.div style={{ position: 'absolute', top: '48%', width: 30, height: 30, borderRadius: '50%', translateX: '-50%', translateY: '-50%', background: 'radial-gradient(circle at 40% 35%, #fff, #b06bd0 60%)', boxShadow: '0 0 20px 6px #b06bd0' }}
        animate={{ left: [186, 246, 126, 246, SCREEN_W - 70], scale: [1, 1.12, 1, 1.12, 1.5] }}
        transition={{ duration: 4, repeat: Infinity, times: [0, 0.35, 0.65, 0.85, 1], ease: 'easeInOut' }} />
      {/* flash d'impact côté droit + « Touché ! » */}
      <motion.div style={{ position: 'absolute', right: 40, top: '48%', width: 60, height: 60, borderRadius: '50%', translateY: '-50%', background: `radial-gradient(circle, #fff, ${D} 55%, transparent 75%)` }}
        animate={{ opacity: [0, 0, 0.95, 0], scale: [0.3, 0.3, 2.2, 0.3] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.9, 0.95, 1] }} />
      <motion.div style={{ position: 'absolute', left: '50%', bottom: 14, transform: 'translateX(-50%)', fontFamily: 'var(--font-display)', fontSize: 20, color: '#f3c969', textShadow: '0 2px 4px rgba(0,0,0,0.6)', whiteSpace: 'nowrap' }}
        animate={{ opacity: [0, 0, 1, 0], scale: [0.6, 0.6, 1.2, 0.6] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.88, 0.95, 1] }}>
        {T('fight.wizard.hit')}
      </motion.div>
    </div>
  );
}

const DEMOS = {
  tapBubbles: DemoTapBubbles,
  wizard: DemoWizard,
  chess: DemoChess,
  hack: DemoHack,
  pickAnswer: DemoPickAnswer,
  timeline: DemoTimeline,
  compute: DemoCompute,
  word: DemoWord,
  geo: DemoGeo,
  memory: DemoMemory,
  deblur: DemoDeblur,
  silhouette: DemoSilhouette,
  imgrace: DemoImgRace,
  mendeleiev: DemoMendeleiev,
  audiorace: DemoAudioRace,
  pkmn: DemoPkmn,
};

function DemoScreen({ type }) {
  const T = useT();
  const Demo = DEMOS[type];
  return (
    <div
      style={{
        position: 'relative', width: SCREEN_W, height: SCREEN_H, maxWidth: '90vw',
        borderRadius: 16, overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 0%, #20304a, #131a28)',
        border: '4px solid #3a2a14',
        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5), 0 14px 30px rgba(0,0,0,0.5), 0 0 0 6px rgba(243,201,105,0.25)',
      }}
    >
      {/* étiquette « démo » */}
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 6, padding: '2px 10px', borderRadius: 999, background: 'rgba(243,201,105,0.9)', color: '#3a2a14', fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '0.08em' }}>
        {T('fight.briefing.demo')}
      </div>
      {Demo ? <Demo /> : null}
    </div>
  );
}

// ============================================================
//  Bouton « Je suis prêt » par équipe
// ============================================================

function ReadyButton({ team, ready, onReady, side, T }) {
  return (
    <motion.button
      onClick={ready ? undefined : onReady}
      disabled={ready}
      whileTap={ready ? {} : { scale: 0.95 }}
      animate={ready ? {} : { boxShadow: [`0 0 0 0 ${team.color}88`, `0 0 0 14px ${team.color}00`] }}
      transition={ready ? {} : { duration: 1.4, repeat: Infinity }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 26px', borderRadius: 16, cursor: ready ? 'default' : 'pointer',
        border: `3px solid ${ready ? '#5b8c3a' : team.color}`,
        background: ready
          ? 'linear-gradient(180deg, #d6f3c2, #a9da88)'
          : `linear-gradient(180deg, ${team.color}, ${team.color}cc)`,
        color: ready ? '#2f5d18' : '#fff',
        fontFamily: 'var(--font-display)', fontSize: 20,
        textShadow: ready ? 'none' : '0 1px 0 rgba(0,0,0,0.3)',
        boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.35), inset 0 -3px 0 rgba(0,0,0,0.2), 0 6px 14px rgba(0,0,0,0.4)',
      }}
    >
      <TeamAvatar team={team} size={40} />
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
        <span style={{ fontSize: 13, opacity: 0.85, fontFamily: 'var(--font-ui)' }}>{team.name}</span>
        <span>{ready ? T('fight.briefing.readyDone') : T('fight.briefing.ready')}</span>
      </span>
    </motion.button>
  );
}

// ============================================================
//  Écran de briefing complet
// ============================================================

export default function FightBriefing({ fight, attacker, defender }) {
  const T = useT();
  const fightStart = useGameStore((s) => s.fightStart);
  const minigame = resolveMinigame(fight);
  const subjectInfo = SUBJECTS[fight.subject] || {};
  const howto = minigame.howto || { demo: null, goal: minigame.rules, steps: [] };

  const [ready, setReady] = useState({ attacker: false, defender: false });
  const both = ready.attacker && ready.defender;
  const [go, setGo] = useState(false);

  useEffect(() => {
    if (!both) return;
    soundEvent();
    setGo(true);
    const t = setTimeout(fightStart, 1200);
    return () => clearTimeout(t);
  }, [both, fightStart]);

  const markReady = (side) => {
    soundClick();
    setReady((r) => ({ ...r, [side]: true }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '18px 20px 16px', gap: 14, overflowY: 'auto' }}
    >
      {/* En-tête */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'rgba(255,243,212,0.7)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {T('fight.briefing.howToPlay')}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          {subjectInfo.icon} {T(minigame.name)}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: '#f3c969', marginTop: 2 }}>
          {T(howto.goal)}
        </div>
      </div>

      {/* Démo + étapes */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'center', justifyContent: 'center' }}>
        <DemoScreen type={howto.demo} />

        <div style={{ maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(howto.steps || []).map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.18 }}
              style={{ display: 'flex', alignItems: 'center', gap: 12 }}
            >
              <span style={{ flexShrink: 0, width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(180deg, var(--gold-400), var(--gold-600))', color: '#3a2a14', fontFamily: 'var(--font-display)', fontSize: 16, display: 'grid', placeItems: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)' }}>{i + 1}</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: '#fff' }}>{T(step)}</span>
            </motion.div>
          ))}
          <div style={{ marginTop: 4, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,243,212,0.65)' }}>
            {minigame.winLabel ? T(minigame.winLabel) : T('fight.briefing.firstToWin', { n: FIGHT_ROUNDS_TO_WIN })}
          </div>
        </div>
      </div>

      {/* Boutons « prêt » + GO */}
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, flexWrap: 'wrap', position: 'relative' }}>
        <ReadyButton team={attacker} side="attacker" ready={ready.attacker} onReady={() => markReady('attacker')} T={T} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'rgba(255,243,212,0.6)' }}>
          {both ? '' : T('fight.briefing.bothMustBeReady')}
        </div>
        <ReadyButton team={defender} side="defender" ready={ready.defender} onReady={() => markReady('defender')} T={T} />
      </div>

      <AnimatePresence>
        {go && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(10,6,2,0.55)', zIndex: 10 }}
          >
            <motion.div
              initial={{ scale: 0.3, rotate: -12 }}
              animate={{ scale: 1, rotate: -6 }}
              transition={{ type: 'spring', damping: 10, stiffness: 200 }}
              style={{ fontFamily: 'var(--font-display)', fontSize: 64, color: '#f3c969', textShadow: '0 4px 0 rgba(110,78,16,0.8), 0 0 40px rgba(243,201,105,0.8)' }}
            >
              {T('fight.briefing.go')}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
