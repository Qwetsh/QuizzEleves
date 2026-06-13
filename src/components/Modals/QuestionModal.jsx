import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { soundCorrect, soundWrong, soundTimer } from '../../logic/sounds';
import ModalOverlay from './ModalOverlay';
import '../../styles/temple-modal.css';

const TIMER_DURATION = 30;

// Cadre de pierre (panelStyle de ModalOverlay) — rappelle l'inventaire
const STONE_PANEL = { background: 'transparent', border: 'none', boxShadow: 'none', borderRadius: 24, overflow: 'visible' };

export default function QuestionModal() {
  const showQuestion = useGameStore((s) => s.showQuestion);
  const answerQuestion = useGameStore((s) => s.answerQuestion);
  const timeoutQuestion = useGameStore((s) => s.timeoutQuestion);
  const usePower = useGameStore((s) => s.usePower);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const indiceUsed = useGameStore((s) => s.indiceUsed);
  const indiceHidden = useGameStore((s) => s.indiceHidden);

  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);

  const question = showQuestion?.question;
  const subject = showQuestion?.subject;
  const timerHalved = showQuestion?.timerHalved;
  // Sablier niv.2/3 divise par 3/4 — meme base que le calcul d'argent du store
  const timerDivisor = showQuestion?.timerDivisor || (timerHalved ? 2 : 1);
  const bonusTime = showQuestion?.bonusTime || 0;
  // Bonus d'equipement / consommable (calcule par le store dans askQuestion)
  const itemBonusTime = showQuestion?.itemBonusTime || 0;
  const team = teams[currentTeam];
  const subjectInfo = SUBJECTS[subject] || {};
  const duration = Math.floor(TIMER_DURATION / timerDivisor) + itemBonusTime;

  const canUseIndice = !indiceUsed && !revealed && team?.powers?.indice?.charges > 0;

  // Reset uniquement quand la QUESTION change (pas quand showQuestion est
  // re-cree par l'ajout de bonusTime apres usage de l'Indice).
  const bonusApplied = useRef(false);
  useEffect(() => {
    if (question) {
      setSelected(null);
      setRevealed(false);
      setTimeLeft(Math.floor(TIMER_DURATION / timerDivisor) + itemBonusTime);
      bonusApplied.current = false;
    }
  }, [question, timerDivisor, itemBonusTime]);

  // Indice niv.2 : secondes bonus ajoutees une seule fois
  useEffect(() => {
    if (bonusTime > 0 && !bonusApplied.current) {
      bonusApplied.current = true;
      setTimeLeft((t) => t + bonusTime);
    }
  }, [bonusTime]);

  useEffect(() => {
    if (!showQuestion || revealed) return;
    if (timeLeft <= 0) {
      soundWrong();
      setRevealed(true);
      return;
    }
    if (timeLeft <= 5) soundTimer();
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [showQuestion, timeLeft, revealed]);

  const handleAnswer = useCallback((idx) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    if (idx === question?.c) soundCorrect();
    else soundWrong();
  }, [revealed, question]);

  const handleContinue = useCallback(() => {
    if (!revealed) return;
    if (selected != null) {
      answerQuestion(selected, timeLeft);
    } else {
      timeoutQuestion();
    }
  }, [revealed, selected, timeLeft, answerQuestion, timeoutQuestion]);

  const timerRatio = Math.min(1, timeLeft / duration);
  const timerColor = timerRatio > 0.5 ? '#fff' : timerRatio > 0.2 ? '#f3c969' : '#e85d6b';
  const isOpen = !!(showQuestion && question);
  const bgColor = subjectInfo.color || '#888';

  const isCorrect = revealed && selected != null && selected === question?.c;
  const isWrong = revealed && (selected == null || selected !== question?.c);

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalOverlay className={`max-w-[640px] ${isCorrect ? 'quiz-correct' : ''} ${isWrong ? 'quiz-wrong' : ''}`} panelStyle={STONE_PANEL}>
          <div className="tm-stone"><div className="tm-parch">
          {/* Quiz Header */}
          <div
            className="relative overflow-hidden text-center text-white"
            style={{
              padding: 28,
              background: `linear-gradient(180deg, ${bgColor} 0%, ${bgColor}dd 100%)`,
            }}
          >
            {/* Shine sweep */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: '-40%', left: '-10%', width: '60%', height: '200%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
                transform: 'rotate(20deg)',
              }}
            />

            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="text-xl">{team?.emoji}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, opacity: 0.85 }}>{team?.name}</span>
            </div>

            <div
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 999,
                background: 'rgba(255,255,255,0.18)',
                fontFamily: 'var(--font-display)',
                fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.08em',
                marginBottom: 14,
              }}
            >
              <span>{subjectInfo.icon}</span>
              <span>{subjectInfo.name} {subjectInfo.biome ? `\u00b7 ${subjectInfo.biome}` : ''}</span>
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, lineHeight: 1.3, marginTop: 6, textShadow: '0 2px 0 rgba(0,0,0,0.15)' }}>
              {question.q}
            </div>

            {/* Timer bar */}
            <div style={{ height: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 3, overflow: 'hidden', marginTop: 18 }}>
              <div
                style={{
                  height: '100%',
                  background: `linear-gradient(90deg, #fff, ${timerColor})`,
                  borderRadius: 3,
                  width: `${timerRatio * 100}%`,
                  transition: 'width 1s linear',
                }}
              />
            </div>
            <div aria-live="polite" style={{ fontSize: 12, marginTop: 6, opacity: 0.85 }}>{timeLeft}s</div>

            {timerHalved && (
              <div style={{ fontSize: 12, marginTop: 6, padding: '2px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.2)', display: 'inline-block' }}>
                {`\u23F1\uFE0F Sablier actif \u2014 ${duration}s`}
              </div>
            )}
            {itemBonusTime > 0 && (
              <div style={{ fontSize: 12, marginTop: 6, marginLeft: 6, padding: '2px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.2)', display: 'inline-block' }}>
                {`\u{1F392} \u00C9quipement : +${itemBonusTime}s`}
              </div>
            )}
          </div>

          {/* Choices - 2x2 grid */}
          <div className="grid gap-3 p-5 grid-cols-1 sm:grid-cols-2">
            {question.a.map((answer, idx) => {
              if (indiceHidden.includes(idx)) {
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '16px 18px', borderRadius: 14,
                      border: '2px solid rgba(122,94,58,0.12)',
                      background: 'var(--parch-100)',
                      opacity: 0.25, textDecoration: 'line-through',
                      fontSize: 16, color: 'var(--ink-500)',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    <span style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: 'var(--parch-200)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-400)',
                      flexShrink: 0,
                    }}>
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {answer}
                  </div>
                );
              }

              // Base = .tm-choice (parchemin + liseré pierre) ; surcharge à la révélation
              let choiceStyle = null;
              let letterStyle = null;
              if (revealed) {
                if (idx === question.c) {
                  choiceStyle = { border: '2px solid #5b8c3a', background: 'linear-gradient(180deg, #d1f0b8, #a8d889)', color: '#1f3d10' };
                  letterStyle = { background: '#5b8c3a', color: '#fff' };
                } else if (idx === selected && idx !== question.c) {
                  choiceStyle = { border: '2px solid #c9472f', background: 'linear-gradient(180deg, #f7c8c8, #e89898)', color: '#5f1a10' };
                  letterStyle = { background: '#c9472f', color: '#fff' };
                } else {
                  choiceStyle = { opacity: 0.4 };
                }
              }

              const letter = String.fromCharCode(65 + idx);
              return (
                <button
                  key={idx}
                  className="tm-choice"
                  onClick={() => handleAnswer(idx)}
                  disabled={revealed}
                  aria-label={`Option ${letter}: ${answer}`}
                  style={choiceStyle || undefined}
                >
                  <span className="tm-choice-letter" style={letterStyle || undefined}>
                    {letter}
                  </span>
                  <span>{answer}</span>
                </button>
              );
            })}
          </div>

          {/* Actions bar */}
          <div
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 22px 22px',
              borderTop: '1px solid rgba(122,94,58,0.16)',
              background: 'var(--parch-50)',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {canUseIndice && !revealed && (
                <button
                  onClick={() => usePower('indice')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 999,
                    background: '#fffefb',
                    border: '1px solid rgba(122,94,58,0.22)',
                    fontSize: 13, color: 'var(--ink-700)',
                    cursor: 'pointer', fontWeight: 500,
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  {"\u{1F4A1} Indice"} <span style={{ opacity: 0.6 }}>(x{team.powers.indice.charges})</span>
                </button>
              )}
              <div style={{ fontSize: 13, color: 'var(--ink-500)' }}>
                {revealed && selected != null && selected === question.c ? (
                  <strong style={{ color: '#2f9d5a' }}>{"Bonne r\u00e9ponse !"}</strong>
                ) : revealed && selected != null ? (
                  <strong style={{ color: '#c9472f' }}>{"Mauvaise r\u00e9ponse"}</strong>
                ) : revealed ? (
                  <strong style={{ color: '#c9472f' }}>{"Temps \u00e9coul\u00e9 !"}</strong>
                ) : (
                  <span>{"Choisis ta r\u00e9ponse"}</span>
                )}
              </div>
            </div>
            {revealed && (
              <button className="tm-btn-gold" onClick={handleContinue}>
                Continuer
              </button>
            )}
          </div>

          {/* Explanation */}
          {revealed && question.e && (
            <div style={{ padding: '0 22px 22px' }}>
              <div style={{
                padding: 14, borderRadius: 14,
                background: 'var(--parch-50)',
                border: '1px solid rgba(122,94,58,0.16)',
                fontSize: 14, lineHeight: 1.5, color: 'var(--ink-700)',
              }}>
                <strong>Explication :</strong> {question.e}
              </div>
            </div>
          )}
          </div></div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
