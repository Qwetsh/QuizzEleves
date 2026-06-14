import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { questionRerollOptions } from '../../store/effectEngine';
import { soundCorrect, soundWrong, soundTimer, soundKatana } from '../../logic/sounds';
import ModalOverlay from './ModalOverlay';
import '../../styles/temple-modal.css';

const TIMER_DURATION = 30;

// Cadre de pierre (panelStyle de ModalOverlay) — rappelle l'inventaire
const STONE_PANEL = { background: 'transparent', border: 'none', boxShadow: 'none', borderRadius: 24, overflow: 'visible' };

// Réponse éliminée (pouvoir Indice ou objet) : le coup de katana joue À LA POSE
// (montage du composant = instant où la réponse entre dans indiceHidden).
function EliminatedAnswer({ idx, answer }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return (
    <motion.div
      className="quiz-answer-eliminated"
      initial={{ scale: reduce ? 1 : 1.02 }}
      animate={{ scale: 1 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'relative', overflow: 'hidden',
        padding: '16px 18px', borderRadius: 14,
        border: '2px solid rgba(122,94,58,0.12)', background: 'var(--parch-100)',
        fontSize: 16, color: 'var(--ink-500)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      {!reduce && (
        <>
          {/* lame brillante qui balaie en diagonale */}
          <motion.span
            aria-hidden
            initial={{ left: '-65%', opacity: 0 }}
            animate={{ left: '125%', opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.34, ease: 'easeIn' }}
            style={{
              position: 'absolute', top: '-40%', height: '180%', width: '42%',
              transform: 'rotate(18deg)', pointerEvents: 'none', mixBlendMode: 'screen',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95) 50%, transparent)',
              filter: 'drop-shadow(0 0 7px #fff)',
            }}
          />
          {/* trait de coupe rouge qui reste après le passage de la lame */}
          <motion.span
            aria-hidden
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.17, duration: 0.16 }}
            style={{
              position: 'absolute', left: 10, right: 10, top: '52%', height: 2,
              transformOrigin: 'left', pointerEvents: 'none',
              background: 'linear-gradient(90deg, #c9472f, #e89898)',
              boxShadow: '0 0 6px #c9472f',
            }}
          />
        </>
      )}
      <span style={{
        width: 30, height: 30, borderRadius: 8, background: 'var(--parch-200)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-400)', flexShrink: 0,
      }}>
        {String.fromCharCode(65 + idx)}
      </span>
      <motion.span
        initial={{ x: 0 }}
        animate={reduce ? { x: 0 } : { x: [0, -3, 4, -2, 0] }}
        transition={{ delay: 0.16, duration: 0.24 }}
        style={{ textDecoration: 'line-through' }}
      >
        {answer}
      </motion.span>
    </motion.div>
  );
}

export default function QuestionModal() {
  const showQuestion = useGameStore((s) => s.showQuestion);
  const answerQuestion = useGameStore((s) => s.answerQuestion);
  const timeoutQuestion = useGameStore((s) => s.timeoutQuestion);
  const usePower = useGameStore((s) => s.usePower);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const indiceUsed = useGameStore((s) => s.indiceUsed);
  const indiceHidden = useGameStore((s) => s.indiceHidden);
  const rerollUsedState = useGameStore((s) => s.rerollUsed);
  const useQuestionReroll = useGameStore((s) => s.useQuestionReroll);

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

  // Rafale de questions (Double cumulable) : « Question X / N » + ambiance maudite
  const multiIndex = showQuestion?.multiIndex;
  const multiTotal = showQuestion?.multiTotal;
  const isBurst = !!multiTotal && multiTotal > 1;

  const canUseIndice = !indiceUsed && !revealed && team?.powers?.indice?.charges > 0;
  // Objets « changer la question » (équipement plafonné + consommables du sac)
  const rerollOptions = !revealed ? questionRerollOptions(team, rerollUsedState) : [];

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

  // Son de katana à chaque NOUVELLE réponse barrée (ouverture avec éliminations
  // passives, ou ajout par le pouvoir Indice). On compare au compte précédent
  // de la MÊME question (sinon le passage à une nouvelle question repart de 0).
  const slashTrack = useRef({ q: null, count: 0 });
  useEffect(() => {
    const t = slashTrack.current;
    const base = t.q === question ? t.count : 0;
    const count = indiceHidden.length;
    if (count > base) {
      for (let i = 0; i < count - base; i++) setTimeout(() => soundKatana(), i * 110);
    }
    slashTrack.current = { q: question, count };
  }, [question, indiceHidden]);

  // Un SEUL intervalle par question (décrément régulier, pas de dérive ni de
  // recréation à chaque tick) ; s'arrête à la révélation. Le bonus de temps
  // (Indice niv.2) reste pris en compte via la mise à jour fonctionnelle.
  useEffect(() => {
    if (!showQuestion || revealed) return;
    const iv = setInterval(() => setTimeLeft((t) => (t <= 0 ? 0 : t - 1)), 1000);
    return () => clearInterval(iv);
  }, [question, revealed, showQuestion]);

  // Sons (compte à rebours / temps écoulé) + bascule en révélation à 0.
  useEffect(() => {
    if (!showQuestion || revealed) return;
    if (timeLeft <= 0) { soundWrong(); setRevealed(true); return; }
    if (timeLeft <= 5) soundTimer();
  }, [timeLeft, revealed, showQuestion]);

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
        <ModalOverlay className={`max-w-[640px] ${isCorrect ? 'quiz-correct' : ''} ${isWrong ? 'quiz-wrong' : ''} ${isBurst ? 'quiz-cursed' : ''}`} panelStyle={STONE_PANEL}>
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

            {isBurst && (
              <div className="quiz-curse-badge">
                <span className="quiz-curse-skull">{'\u{1F480}'}</span>
                Malédiction · Question {multiIndex} / {multiTotal}
              </div>
            )}

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
                return <EliminatedAnswer key={idx} idx={idx} answer={answer} />;
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
                  className="quiz-indice-btn"
                >
                  <span className="quiz-indice-bulb">{'\u{1F4A1}'}</span>
                  <span className="quiz-indice-label">Indice</span>
                  <span className="quiz-indice-count">x{team.powers.indice.charges}</span>
                </button>
              )}
              {rerollOptions.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => useQuestionReroll(opt)}
                  className="quiz-reroll-btn"
                  title={`Changer la question (${opt.itemName})`}
                >
                  <span style={{ fontSize: 17 }}>{'\u{1F504}'}</span>
                  <span>Changer</span>
                </button>
              ))}
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
