import { useEffect, useRef } from 'react';
import TeamAvatar from '../TeamAvatar';
import MemoryBoard from './minigames/MemoryBoard';
import { soundCorrect, soundWrong } from '../../logic/sounds';
import { useT } from '../../i18n';

/**
 * Duel Memory — plateau TV du duel MULTI-SURFACE (mode « écran + téléphones-
 * manettes »). L'écran partagé affiche le plateau + les scores en LECTURE SEULE :
 * les duellistes retournent les cartes depuis LEUR téléphone (MemoryDuelView,
 * intents turnMemoryFlip → memoryDuelFlip). Le store (fight.memory) est l'autorité.
 */
export default function MemoryDuelStage({ fight, attacker, defender }) {
  const T = useT();
  const m = fight.memory;
  const done = m?.reveal || null;
  const activeSide = m?.activeSide || 'attacker';
  const team = activeSide === 'attacker' ? attacker : defender;

  // Sons partagés avec le moteur tactile : cloche à chaque capture (nombre de
  // paires prises croît), buzzer quand la main passe à l'autre camp.
  const prevMatched = useRef(0);
  const prevActive = useRef(activeSide);
  useEffect(() => {
    if (!m) return;
    const n = Object.keys(m.matched || {}).length;
    if (n > prevMatched.current) soundCorrect();
    else if (m.activeSide !== prevActive.current) soundWrong();
    prevMatched.current = n;
    prevActive.current = m.activeSide;
  }, [m]);

  const boardCards = (m?.cards || []).map((c, idx) => ({
    key: c.key,
    text: c.text,
    owner: m.matched[c.pairId] || null,
    faceUp: m.flipped.includes(idx),
  }));

  const sideScore = (side, tm) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: activeSide === side || done ? 1 : 0.55 }}>
      <TeamAvatar team={tm} size={30} />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: tm.color }}>{tm.name}</span>
      <span style={{ minWidth: 30, textAlign: 'center', padding: '2px 10px', borderRadius: 999, background: '#fffefb', border: `1px solid ${tm.color}66`, fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-900)' }}>
        {m?.scores?.[side] ?? 0}
      </span>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, padding: 14, minHeight: 0 }}>
      {/* Bandeau : scores + tour actif (miroir du moteur tactile) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderRadius: 14, background: 'rgba(255,254,251,0.95)', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
        {sideScore('attacker', attacker)}
        <div style={{ textAlign: 'center', fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--ink-600)' }}>
          {done?.winner === 'tie'
            ? T('fight.memory.tie')
            : <><span style={{ display: 'block', fontSize: 11, color: 'var(--ink-400)' }}>{T('fight.memory.turn')}</span><strong style={{ color: team.color, fontFamily: 'var(--font-display)', fontSize: 15 }}>{team.emoji} {team.name}</strong></>}
        </div>
        {sideScore('defender', defender)}
      </div>

      {/* Plateau (lecture seule : pas de onFlip) */}
      <MemoryBoard cards={boardCards} attacker={attacker} defender={defender} onFlip={null} locked />

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.memory.phonesHint')}
      </div>
    </div>
  );
}
