import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { soundEvent, soundClick } from '../../logic/sounds';
import ModalOverlay from './ModalOverlay';

const DICE_FACES = [null, '\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'];

export default function EventModal() {
  const showEvent = useGameStore((s) => s.showEvent);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const acceptEvent = useGameStore((s) => s.acceptEvent);
  const declineEvent = useGameStore((s) => s.declineEvent);
  const closeEvent = useGameStore((s) => s.closeEvent);
  const eventSelectTarget = useGameStore((s) => s.eventSelectTarget);
  const eventAnswerQuestion = useGameStore((s) => s.eventAnswerQuestion);
  const eventRechargeChoice = useGameStore((s) => s.eventRechargeChoice);

  useEffect(() => {
    if (showEvent) soundEvent();
  }, [showEvent?.key]);

  const isOpen = !!showEvent;
  const { event, key, phase, data } = showEvent || {};
  const team = teams[currentTeam];

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalOverlay className="max-w-md">
          <div style={{ padding: '26px 26px 4px', textAlign: 'center' }}>
            {/* Large icon */}
            <div
              style={{
                width: 100, height: 100, borderRadius: 28,
                margin: '0 auto 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 54,
                background: 'linear-gradient(180deg, #a371e0, #7c3aed)',
                boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -6px 0 rgba(0,0,0,0.18), 0 8px 0 rgba(60,25,110,0.5)',
              }}
            >
              {event?.icon}
            </div>
            <div
              style={{
                display: 'inline-block', padding: '4px 14px',
                background: 'rgba(168, 62, 127, 0.15)',
                color: 'var(--m-anglais-deep)',
                fontSize: 11, fontFamily: 'var(--font-display)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                borderRadius: 999, marginBottom: 12,
              }}
            >
              {"\u00c9v\u00e9nement sp\u00e9cial"}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>{event?.name}</h2>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: '10px 0 4px', color: 'var(--ink-600)' }}>
              <span className="text-lg">{team?.emoji}</span>
              <span>{team?.name}</span>
            </div>
          </div>

          <div style={{ padding: '10px 32px 24px', textAlign: 'center' }}>
            {phase === 'intro' && (
              <IntroPhase event={event} onAccept={acceptEvent} onDecline={declineEvent} />
            )}
            {phase === 'target' && (
              <TargetPhase teams={teams} currentTeam={currentTeam} eventKey={key} onSelect={eventSelectTarget} />
            )}
            {phase === 'dice' && <DicePhase data={data} />}
            {phase === 'question' && (
              <QuestionPhase data={data} onAnswer={eventAnswerQuestion} />
            )}
            {phase === 'choice' && (
              <ChoicePhase eventKey={key} team={team} onChoice={eventRechargeChoice} />
            )}
            {phase === 'result' && <ResultPhase data={data} onClose={closeEvent} />}
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}

function IntroPhase({ event, onAccept, onDecline }) {
  return (
    <>
      <p style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--ink-700)', margin: '12px 0 22px' }}>
        {event.desc}
      </p>
      <div className="flex gap-3 justify-center">
        {event.optional ? (
          <>
            <button className="btn btn--green" onClick={onAccept}>Accepter</button>
            <button className="btn btn--ghost" onClick={onDecline}>Refuser</button>
          </>
        ) : (
          <button className="btn btn--purple btn--lg" onClick={onAccept}>OK</button>
        )}
      </div>
    </>
  );
}

function TargetPhase({ teams, currentTeam, eventKey, onSelect }) {
  const labels = {
    foudreFree: 'Qui recule de 3 cases ?',
    sacrifice: 'Qui recule de 4 cases ?',
    duel: 'Qui doit r\u00e9pondre ?',
    don: 'Qui avance de 3 cases ?',
    vol: '\u00c0 qui voler une charge ?',
    echange: '\u00c9changer ta position avec qui ?',
  };
  return (
    <>
      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>{labels[eventKey] || 'Choisir une cible :'}</p>
      <div className="space-y-2">
        {teams.map((t, i) => {
          if (i === currentTeam) return null;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: 12, borderRadius: 14,
                border: '2px solid rgba(122,94,58,0.22)',
                background: '#fffefb',
                cursor: 'pointer', fontFamily: 'var(--font-ui)',
                transition: 'all 100ms ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#a83e7f'; e.currentTarget.style.background = '#faf0f5'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(122,94,58,0.22)'; e.currentTarget.style.background = '#fffefb'; }}
            >
              <span className="text-2xl">{t.emoji}</span>
              <span style={{ fontFamily: 'var(--font-display)', color: t.color }}>{t.name}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function DicePhase({ data }) {
  const dv = data?.diceValue;
  const rolling = data?.diceRolling;
  return (
    <div className="text-center py-4">
      <div className={`text-7xl select-none ${rolling ? 'anim-float' : ''}`}>
        {dv ? DICE_FACES[dv] : '\u{1F3B2}'}
      </div>
      {!rolling && dv && (
        <p style={{ fontSize: 18, fontFamily: 'var(--font-display)', marginTop: 12 }}>
          {"R\u00e9sultat : "}{dv} !
        </p>
      )}
    </div>
  );
}

function QuestionPhase({ data, onAnswer }) {
  const question = data?.eventQuestion;
  const subject = data?.eventSubject;
  const revealed = data?.questionRevealed;
  const selected = data?.questionSelected;

  if (!question) return <p>Chargement...</p>;
  const subjectInfo = SUBJECTS[subject] || {};

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 justify-center">
        <span className="text-xl">{subjectInfo.icon}</span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: subjectInfo.color }}>{subjectInfo.name}</span>
      </div>
      <p style={{ fontWeight: 600, marginBottom: 16 }}>{question.q}</p>
      <div className="space-y-2">
        {question.a.map((answer, idx) => {
          let style = { border: '2px solid rgba(122,94,58,0.22)', background: '#fffefb' };
          if (revealed) {
            if (idx === question.c) style = { border: '2px solid #5b8c3a', background: '#d1f0b8' };
            else if (idx === selected && idx !== question.c) style = { border: '2px solid #c9472f', background: '#f7c8c8' };
            else style = { ...style, opacity: 0.4 };
          }
          return (
            <button
              key={idx}
              onClick={() => !revealed && onAnswer(idx)}
              disabled={revealed}
              style={{
                width: '100%', textAlign: 'left', padding: 12, borderRadius: 14,
                cursor: revealed ? 'not-allowed' : 'pointer',
                fontSize: 14, transition: 'all 100ms ease',
                fontFamily: 'var(--font-ui)',
                ...style,
              }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--ink-400)', marginRight: 8 }}>
                {String.fromCharCode(65 + idx)}
              </span>
              {answer}
            </button>
          );
        })}
      </div>
      {revealed && question.e && (
        <div style={{ marginTop: 12, padding: 12, background: 'var(--parch-50)', borderRadius: 12, border: '1px solid rgba(122,94,58,0.16)', fontSize: 13 }}>
          <strong>Explication :</strong> {question.e}
        </div>
      )}
    </div>
  );
}

function ChoicePhase({ eventKey, team, onChoice }) {
  if (eventKey === 'recharge') {
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>Quelle charge veux-tu recharger ?</p>
        <div className="flex gap-3 justify-center">
          <button className="btn btn--blue" onClick={() => onChoice('bouclier')}>
            {"\u{1F6E1}\uFE0F Bouclier"}
          </button>
          <button className="btn" onClick={() => onChoice('indice')}>
            {"\u{1F4A1} Indice"}
          </button>
        </div>
      </>
    );
  }
  return null;
}

function ResultPhase({ data, onClose }) {
  return (
    <>
      <p style={{ fontSize: 18, fontFamily: 'var(--font-display)', marginBottom: 22 }}>{data?.message}</p>
      <button className="btn btn--purple btn--lg" onClick={onClose}>OK</button>
    </>
  );
}
