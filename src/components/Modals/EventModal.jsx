import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { POWERS } from '../../data/powers';
import { soundEvent, soundClick } from '../../logic/sounds';
import ModalOverlay from './ModalOverlay';
import TeamTargetButton from './TeamTargetButton';

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
  const eventMarcheNoirBuy = useGameStore((s) => s.eventMarcheNoirBuy);
  const eventVolApply = useGameStore((s) => s.eventVolApply);

  useEffect(() => {
    if (showEvent) soundEvent();
  }, [showEvent?.key]);

  const isOpen = !!showEvent;
  const { event, key, phase, data } = showEvent || {};
  const team = teams?.[currentTeam];

  if (isOpen && !team) return null;

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
              <ChoicePhase
                eventKey={key}
                team={team}
                teams={teams}
                data={data}
                onChoice={eventRechargeChoice}
                onMarcheNoirBuy={eventMarcheNoirBuy}
                onVolApply={eventVolApply}
                onSkip={declineEvent}
              />
            )}
            {phase === 'result' && <ResultPhase data={data} onClose={closeEvent} />}
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}

const IntroPhase = React.memo(function IntroPhase({ event, onAccept, onDecline }) {
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
});

const TargetPhase = React.memo(function TargetPhase({ teams, currentTeam, eventKey, onSelect }) {
  const labels = {
    decharge: 'Qui re\u00e7oit la d\u00e9charge ? (recul = lancer de d\u00e9)',
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
            <TeamTargetButton
              key={i}
              team={t}
              onClick={() => onSelect(i)}
              hoverColor="#a83e7f"
              hoverBg="#faf0f5"
            />
          );
        })}
      </div>
    </>
  );
});

const DicePhase = React.memo(function DicePhase({ data }) {
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
});

const QuestionPhase = React.memo(function QuestionPhase({ data, onAnswer }) {
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
});

// Bouton generique de choix de pouvoir (recharge, vol)
function PowerChoiceButton({ powerKey, charges, onClick, disabled }) {
  const power = POWERS[powerKey];
  if (!power) return null;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: 12, borderRadius: 14,
        border: `2px solid ${disabled ? 'rgba(122,94,58,0.18)' : power.color + '66'}`,
        background: disabled ? 'rgba(122,94,58,0.06)' : '#fffefb',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontFamily: 'var(--font-ui)',
        transition: 'all 100ms ease',
      }}
    >
      <span className="text-2xl">{power.icon}</span>
      <span style={{ fontFamily: 'var(--font-display)', flex: 1, textAlign: 'left' }}>
        {power.name}
        {charges != null && (
          <span style={{ fontSize: 11, color: 'var(--ink-500)', marginLeft: 8 }}>
            {charges} charge{charges > 1 ? 's' : ''}
          </span>
        )}
      </span>
    </button>
  );
}

function ChoicePhase({ eventKey, team, teams, data, onChoice, onMarcheNoirBuy, onVolApply, onSkip }) {
  // Vol en 2 etapes : pouvoir vole chez la cible, puis pouvoir recharge chez soi
  const [stealKey, setStealKey] = useState(null);

  if (eventKey === 'recharge') {
    const owned = Object.entries(team.powers || {}).filter(([k]) => POWERS[k]);
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
          Quel pouvoir veux-tu recharger ?
        </p>
        <div className="space-y-2">
          {owned.map(([key, entry]) => (
            <PowerChoiceButton
              key={key}
              powerKey={key}
              charges={entry?.charges ?? 0}
              onClick={() => { soundClick(); onChoice(key); }}
            />
          ))}
        </div>
      </>
    );
  }

  if (eventKey === 'vol') {
    const target = teams?.[data?.targetIndex];
    if (!target) return null;

    if (!stealKey) {
      const stealable = Object.entries(target.powers || {}).filter(([k, p]) => POWERS[k] && p?.charges > 0);
      return (
        <>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
            {`Quel pouvoir voler \u00E0 ${target.emoji} ${target.name} ?`}
          </p>
          <div className="space-y-2">
            {stealable.map(([key, entry]) => (
              <PowerChoiceButton
                key={key}
                powerKey={key}
                charges={entry.charges}
                onClick={() => { soundClick(); setStealKey(key); }}
              />
            ))}
          </div>
        </>
      );
    }

    const mine = Object.entries(team.powers || {}).filter(([k]) => POWERS[k]);
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, textAlign: 'center' }}>
          {`Tu voles 1 charge de ${POWERS[stealKey]?.name}. Quel pouvoir recharger ?`}
        </p>
        <div className="space-y-2">
          {mine.map(([key, entry]) => (
            <PowerChoiceButton
              key={key}
              powerKey={key}
              charges={entry?.charges ?? 0}
              onClick={() => { soundClick(); onVolApply(stealKey, key); }}
            />
          ))}
        </div>
        <button
          onClick={() => setStealKey(null)}
          style={{
            marginTop: 12, width: '100%',
            fontSize: 13, color: 'var(--ink-500)',
            cursor: 'pointer', background: 'none', border: 'none',
            fontFamily: 'var(--font-ui)', padding: 6,
          }}
        >
          \u2190 Changer de pouvoir \u00E0 voler
        </button>
      </>
    );
  }

  if (eventKey === 'marcheNoir') {
    const owned = Object.entries(team.powers || {}).filter(([k]) => POWERS[k]);
    const money = team.money ?? 0;
    return (
      <>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, textAlign: 'center' }}>
          {"1 charge \u00E0 moiti\u00E9 prix \u2014 tu as "}{money} <span className="coin" />
        </p>
        <div className="space-y-2" style={{ marginTop: 12 }}>
          {owned.map(([key, entry]) => {
            const power = POWERS[key];
            const price = Math.ceil(power.price / 2);
            const canBuy = money >= price;
            return (
              <button
                key={key}
                onClick={() => { if (canBuy) { soundClick(); onMarcheNoirBuy(key); } }}
                disabled={!canBuy}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: 12, borderRadius: 14,
                  border: `2px solid ${canBuy ? power.color + '66' : 'rgba(122,94,58,0.18)'}`,
                  background: canBuy ? '#fffefb' : 'rgba(122,94,58,0.06)',
                  cursor: canBuy ? 'pointer' : 'not-allowed',
                  opacity: canBuy ? 1 : 0.55,
                  fontFamily: 'var(--font-ui)',
                  transition: 'all 100ms ease',
                }}
              >
                <span className="text-2xl">{power.icon}</span>
                <span style={{ fontFamily: 'var(--font-display)', flex: 1, textAlign: 'left' }}>
                  {power.name}
                  <span style={{ fontSize: 11, color: 'var(--ink-500)', marginLeft: 8 }}>
                    {entry?.charges ?? 0} charge{(entry?.charges ?? 0) > 1 ? 's' : ''}
                  </span>
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 14 }}>
                  <s style={{ color: 'var(--ink-400)', marginRight: 6 }}>{power.price}</s>
                  {price} <span className="coin" />
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={onSkip}
          style={{
            marginTop: 14, width: '100%',
            fontSize: 14, color: 'var(--ink-500)',
            cursor: 'pointer', background: 'none', border: 'none',
            fontFamily: 'var(--font-ui)', padding: 8,
          }}
        >
          Non merci, je passe mon chemin
        </button>
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
