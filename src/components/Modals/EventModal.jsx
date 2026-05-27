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
        <div className="p-6">
        {/* Header */}
        <div className="text-center mb-4">
          <div className="text-5xl mb-2">{event.icon}</div>
          <h2 className="text-xl font-bold">{event.name}</h2>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-lg">{team?.emoji}</span>
            <span className="font-semibold" style={{ color: team?.color }}>
              {team?.name}
            </span>
          </div>
        </div>

        {/* Phase content */}
        {phase === 'intro' && (
          <IntroPhase event={event} onAccept={acceptEvent} onDecline={declineEvent} />
        )}

        {phase === 'target' && (
          <TargetPhase
            teams={teams}
            currentTeam={currentTeam}
            eventKey={key}
            onSelect={eventSelectTarget}
          />
        )}

        {phase === 'dice' && (
          <DicePhase data={data} />
        )}

        {phase === 'question' && (
          <QuestionPhase data={data} onAnswer={eventAnswerQuestion} />
        )}

        {phase === 'choice' && (
          <ChoicePhase eventKey={key} team={team} onChoice={eventRechargeChoice} />
        )}

        {phase === 'result' && (
          <ResultPhase data={data} onClose={closeEvent} />
        )}
        </div>
      </ModalOverlay>
      )}
    </AnimatePresence>
  );
}

// --- Sub-components ---

function IntroPhase({ event, onAccept, onDecline }) {
  return (
    <>
      <p className="text-[var(--muted)] mb-6 text-center">{event.desc}</p>
      <div className="flex gap-3 justify-center">
        {event.optional ? (
          <>
            <button
              onClick={onAccept}
              className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition"
            >
              Accepter
            </button>
            <button
              onClick={onDecline}
              className="px-6 py-2 bg-gray-400 text-white font-bold rounded-lg hover:bg-gray-500 transition"
            >
              Refuser
            </button>
          </>
        ) : (
          <button
            onClick={onAccept}
            className="px-6 py-2 bg-pink-600 text-white font-bold rounded-lg hover:bg-pink-700 transition"
          >
            OK
          </button>
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
      <p className="text-sm font-semibold mb-3 text-center">{labels[eventKey] || 'Choisir une cible :'}</p>
      <div className="space-y-2">
        {teams.map((t, i) => {
          if (i === currentTeam) return null;
          return (
            <button
              key={i}
              onClick={() => onSelect(i)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border-2 border-[var(--border)] bg-white hover:border-pink-400 hover:bg-pink-50 transition"
            >
              <span className="text-2xl">{t.emoji}</span>
              <span className="font-bold" style={{ color: t.color }}>{t.name}</span>
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
      <div className={`text-7xl mb-4 select-none ${rolling ? 'animate-bounce' : ''}`}>
        {dv ? DICE_FACES[dv] : '\u{1F3B2}'}
      </div>
      {!rolling && dv && (
        <p className="text-lg font-bold">
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
        <span className="font-bold text-sm" style={{ color: subjectInfo.color }}>{subjectInfo.name}</span>
      </div>
      <p className="font-semibold mb-4">{question.q}</p>
      <div className="space-y-2">
        {question.a.map((answer, idx) => {
          let btnClass = 'border-[var(--border)] bg-white hover:border-blue-400';
          if (revealed) {
            if (idx === question.c) {
              btnClass = 'border-green-500 bg-green-50 ring-2 ring-green-400';
            } else if (idx === selected && idx !== question.c) {
              btnClass = 'border-red-500 bg-red-50';
            } else {
              btnClass = 'border-gray-200 bg-gray-50 opacity-50';
            }
          }

          return (
            <button
              key={idx}
              onClick={() => !revealed && onAnswer(idx)}
              disabled={revealed}
              className={`w-full text-left p-3 rounded-lg border-2 transition text-sm ${btnClass}`}
            >
              <span className="font-mono text-xs text-[var(--muted)] mr-2">
                {String.fromCharCode(65 + idx)}
              </span>
              {answer}
            </button>
          );
        })}
      </div>
      {revealed && (
        <div className="mt-3 p-2 bg-blue-50 rounded-lg border border-blue-200 text-xs">
          <strong>Explication :</strong> {question.e}
        </div>
      )}
    </div>
  );
}

function ChoicePhase({ eventKey, team, onChoice }) {
  if (eventKey === 'recharge') {
    const hasBouclier = team.powerDef === 'bouclier' || team.powerOff === 'bouclier' || team.powers?.bouclier;
    const hasIndice = team.powerDef === 'indice' || team.powerOff === 'indice' || team.powers?.indice;

    return (
      <>
        <p className="text-sm font-semibold mb-3 text-center">Quelle charge veux-tu recharger ?</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => onChoice('bouclier')}
            className="px-5 py-3 rounded-lg border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 font-bold transition"
          >
            {"\u{1F6E1}\uFE0F Bouclier"}
          </button>
          <button
            onClick={() => onChoice('indice')}
            className="px-5 py-3 rounded-lg border-2 border-yellow-300 bg-yellow-50 hover:bg-yellow-100 font-bold transition"
          >
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
      <p className="text-center text-lg font-semibold mb-6">{data?.message}</p>
      <div className="text-center">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-pink-600 text-white font-bold rounded-lg hover:bg-pink-700 transition"
        >
          OK
        </button>
      </div>
    </>
  );
}
