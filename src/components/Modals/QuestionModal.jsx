import { useState, useEffect, useCallback } from 'react';
import { useGameStore } from '../../store/gameStore';
import { SUBJECTS } from '../../data/subjects';
import { soundCorrect, soundWrong, soundTimer } from '../../logic/sounds';

const TIMER_DURATION = 30;
const TIMER_HALVED = 15;

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
  const team = teams[currentTeam];
  const subjectInfo = SUBJECTS[subject] || {};
  const duration = timerHalved ? TIMER_HALVED : TIMER_DURATION;

  // Can use indice?
  const canUseIndice = !indiceUsed && !revealed && team?.powers?.indice?.charges > 0;

  // Reset on new question
  useEffect(() => {
    if (showQuestion) {
      setSelected(null);
      setRevealed(false);
      setTimeLeft(timerHalved ? TIMER_HALVED : TIMER_DURATION);
    }
  }, [showQuestion, timerHalved]);

  // Timer
  useEffect(() => {
    if (!showQuestion || revealed) return;
    if (timeLeft <= 0) {
      soundWrong();
      setRevealed(true);
      setTimeout(() => timeoutQuestion(), 2000);
      return;
    }
    if (timeLeft <= 5) soundTimer();
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [showQuestion, timeLeft, revealed, timeoutQuestion]);

  const handleAnswer = useCallback((idx) => {
    if (revealed) return;
    setSelected(idx);
    setRevealed(true);
    if (idx === question?.c) soundCorrect();
    else soundWrong();
    const tl = timeLeft;
    setTimeout(() => answerQuestion(idx, tl), 2000);
  }, [revealed, answerQuestion, question, timeLeft]);

  if (!showQuestion || !question) return null;

  const timerRatio = timeLeft / duration;
  const timerColor = timerRatio > 0.5 ? '#16a34a' : timerRatio > 0.2 ? '#f59e0b' : '#dc2626';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--paper)] rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden modal-pop">
        {/* Header */}
        <div className="p-4 flex items-center gap-3" style={{ background: subjectInfo.color || '#888' }}>
          <span className="text-2xl">{subjectInfo.icon}</span>
          <div className="flex-1 text-white">
            <div className="font-bold">{subjectInfo.name}</div>
            <div className="text-xs opacity-80">{question.t}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{team?.emoji}</span>
            <div
              className="w-12 h-12 rounded-full border-4 flex items-center justify-center text-white font-bold text-lg"
              style={{ borderColor: timerColor }}
            >
              {timeLeft}
            </div>
          </div>
        </div>

        {/* Timer bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${timerRatio * 100}%`, background: timerColor }}
          />
        </div>

        {/* Sablier warning */}
        {timerHalved && (
          <div className="px-4 pt-2">
            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded font-bold">
              {"\u23F1\uFE0F Sablier actif \u2014 15 secondes !"}
            </span>
          </div>
        )}

        {/* Question */}
        <div className="p-4">
          <p className="font-semibold text-lg mb-4">{question.q}</p>

          <div className="space-y-2">
            {question.a.map((answer, idx) => {
              // Hidden by indice
              if (indiceHidden.includes(idx)) {
                return (
                  <div
                    key={idx}
                    className="w-full p-3 rounded-lg border-2 border-gray-200 bg-gray-100 opacity-30 line-through text-sm"
                  >
                    <span className="font-mono text-sm text-[var(--muted)] mr-2">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    {answer}
                  </div>
                );
              }

              let btnClass = 'border-[var(--border)] bg-white hover:border-blue-400';
              if (revealed) {
                if (idx === question.c) {
                  btnClass = 'border-green-500 bg-green-50 ring-2 ring-green-400';
                } else if (idx === selected && idx !== question.c) {
                  btnClass = 'border-red-500 bg-red-50';
                } else {
                  btnClass = 'border-gray-200 bg-gray-50 opacity-50';
                }
              } else if (idx === selected) {
                btnClass = 'border-blue-500 bg-blue-50';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={revealed}
                  className={`w-full text-left p-3 rounded-lg border-2 transition ${btnClass}`}
                >
                  <span className="font-mono text-sm text-[var(--muted)] mr-2">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {answer}
                </button>
              );
            })}
          </div>

          {/* Power: Indice button */}
          {canUseIndice && !revealed && (
            <button
              onClick={() => usePower('indice')}
              className="mt-3 w-full text-sm px-3 py-2 rounded-lg border-2 border-yellow-400 bg-yellow-50 hover:bg-yellow-100 font-semibold transition"
            >
              {"\u{1F4A1} Utiliser Indice"} <span className="opacity-60">(x{team.powers.indice.charges})</span>
            </button>
          )}

          {/* Explanation */}
          {revealed && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
              <strong>Explication :</strong> {question.e}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
