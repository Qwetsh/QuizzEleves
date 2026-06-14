import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { FIGHT_ROUNDS_TO_WIN } from '../../store/fightHandlers';
import { getMinigame, getDefaultMinigame } from './minigames';
import { soundClick, soundEvent } from '../../logic/sounds';

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
  const tiles = ['6', '×', '7', '−', '2'];
  return (
    <>
      <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-ui)', color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Cible</span>
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

const DEMOS = {
  tapBubbles: DemoTapBubbles,
  pickAnswer: DemoPickAnswer,
  timeline: DemoTimeline,
  compute: DemoCompute,
  word: DemoWord,
  geo: DemoGeo,
};

function DemoScreen({ type }) {
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
        DÉMO
      </div>
      {Demo ? <Demo /> : null}
    </div>
  );
}

// ============================================================
//  Bouton « Je suis prêt » par équipe
// ============================================================

function ReadyButton({ team, ready, onReady, side }) {
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
      <span style={{ fontSize: 30 }}>{team.emoji}</span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
        <span style={{ fontSize: 13, opacity: 0.85, fontFamily: 'var(--font-ui)' }}>{team.name}</span>
        <span>{ready ? '✓ Prêt !' : '\u{1F44D} Je suis prêt'}</span>
      </span>
    </motion.button>
  );
}

// ============================================================
//  Écran de briefing complet
// ============================================================

export default function FightBriefing({ fight, attacker, defender }) {
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
          Comment jouer
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
          {subjectInfo.icon} {minigame.name}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 14, color: '#f3c969', marginTop: 2 }}>
          {howto.goal}
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
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: 15, color: '#fff' }}>{step}</span>
            </motion.div>
          ))}
          <div style={{ marginTop: 4, fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,243,212,0.65)' }}>
            {minigame.winLabel || `Premier à ${FIGHT_ROUNDS_TO_WIN} manches gagnées`}
          </div>
        </div>
      </div>

      {/* Boutons « prêt » + GO */}
      <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, flexWrap: 'wrap', position: 'relative' }}>
        <ReadyButton team={attacker} side="attacker" ready={ready.attacker} onReady={() => markReady('attacker')} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'rgba(255,243,212,0.6)' }}>
          {both ? '' : 'Les deux équipes doivent être prêtes'}
        </div>
        <ReadyButton team={defender} side="defender" ready={ready.defender} onReady={() => markReady('defender')} />
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
              C'EST PARTI !
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
