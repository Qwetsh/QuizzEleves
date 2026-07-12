import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';

/**
 * Duel de rapidité (toutes matières) — écran scindé tactile.
 * La même question s'affiche des deux côtés (réponses mélangées
 * indépendamment). Le premier à toucher la bonne réponse gagne la manche.
 * Une mauvaise réponse verrouille son côté ; deux côtés verrouillés =
 * nouvelle question.
 */
export default function QuickDuel({ attacker, defender, subject, round, onRoundWin }) {
  const T = useT();
  const fightPickQuestion = useGameStore((s) => s.fightPickQuestion);

  const [question, setQuestion] = useState(null);
  const [locked, setLocked] = useState({ attacker: false, defender: false });
  const [resolved, setResolved] = useState(false);

  const newQuestion = () => {
    setQuestion(fightPickQuestion(subject));
    setLocked({ attacker: false, defender: false });
    setResolved(false);
  };

  // Nouvelle question a chaque manche
  useEffect(() => { newQuestion(); }, [round, subject]);

  // Ordres d'affichage independants par cote
  const orders = useMemo(() => {
    if (!question) return null;
    const idx = question.a.map((_, i) => i);
    return { attacker: shuffle(idx), defender: shuffle(idx) };
  }, [question]);

  if (!question) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontFamily: 'var(--font-display)' }}>
        {T('fight.quick.noQuestion')}
        <button className="btn btn--ghost" style={{ marginTop: 14 }} onClick={() => onRoundWin('defender')}>
          {T('fight.quick.roundToDefender')}
        </button>
      </div>
    );
  }

  const handleTap = (side, answerIdx) => {
    if (resolved || locked[side]) return;
    if (answerIdx === question.c) {
      setResolved(true);
      soundCorrect();
      setTimeout(() => onRoundWin(side), 700);
    } else {
      soundWrong();
      const next = { ...locked, [side]: true };
      setLocked(next);
      if (next.attacker && next.defender) {
        setTimeout(newQuestion, 900);
      }
    }
  };

  const renderSide = (side, team) => {
    const isLocked = locked[side];
    return (
      <div
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: '14px 16px',
          background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
          borderTop: `4px solid ${team.color}`,
          borderRadius: 16,
          opacity: isLocked ? 0.55 : 1,
          transition: 'opacity 200ms ease',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <TeamAvatar team={team} size={32} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: team.color }}>{team.name}</span>
        </div>
        {isLocked && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 22, color: '#c9472f',
            background: 'rgba(255,255,255,0.55)', borderRadius: 16, zIndex: 2,
          }}>
            {T('fight.quick.locked')}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, justifyContent: 'center' }}>
          {orders[side].map((answerIdx) => {
            const showResult = resolved && answerIdx === question.c;
            return (
              <button
                key={answerIdx}
                onPointerDown={() => handleTap(side, answerIdx)}
                style={{
                  padding: '14px 14px', borderRadius: 12,
                  border: showResult ? '3px solid #5b8c3a' : '2px solid rgba(122,94,58,0.25)',
                  background: showResult ? '#d1f0b8' : '#fffefb',
                  fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 500,
                  textAlign: 'left', cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                {question.a[answerIdx]}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div
        style={{
          padding: '14px 20px', borderRadius: 14, textAlign: 'center',
          background: 'rgba(255,254,251,0.95)',
          fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--ink-900)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {question.q}
      </div>
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {renderSide('attacker', attacker)}
        {renderSide('defender', defender)}
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.quick.hint')}
      </div>
    </div>
  );
}
