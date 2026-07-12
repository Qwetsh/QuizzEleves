import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import TeamAvatar from '../TeamAvatar';
import { SUBJECTS } from '../../data/subjects';
import { locName, loc } from '../../i18n/content';
import { questionRerollOptions } from '../../store/effectEngine';
import { soundCorrect, soundWrong, soundTimer, soundKatana, soundReveal } from '../../logic/sounds';
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
        padding: '18px 20px', borderRadius: 14,
        border: '2px solid rgba(122,94,58,0.12)', background: 'var(--parch-100)',
        fontSize: 22, color: 'var(--ink-500)',
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
        width: 38, height: 38, borderRadius: 9, background: 'var(--parch-200)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink-400)', flexShrink: 0,
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
  const selectAnswer = useGameStore((s) => s.selectAnswer);
  const continueQuestion = useGameStore((s) => s.continueQuestion);
  const revealQuestionTimeout = useGameStore((s) => s.revealQuestionTimeout);
  const usePower = useGameStore((s) => s.usePower);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const indiceUsed = useGameStore((s) => s.indiceUsed);
  const indiceHidden = useGameStore((s) => s.indiceHidden);
  const rerollUsedState = useGameStore((s) => s.rerollUsed);
  const useQuestionReroll = useGameStore((s) => s.useQuestionReroll);
  const englishMode = useGameStore((s) => s.englishMode);

  // Sélection + révélation vivent dans le STORE (manette téléphone : le TBI et
  // le téléphone de l'équipe active doivent voir le même état). `timeLeft` reste
  // un état local d'AFFICHAGE, recalculé depuis la deadline du store (le TBI est
  // l'horloge de référence : c'est lui qui déclenche le timeout).
  const selected = showQuestion?.selected ?? null;
  const revealed = !!showQuestion?.answerRevealed;
  const deadline = showQuestion?.deadline || null;
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [showTrans, setShowTrans] = useState(false); // afficher la traduction (autre langue)
  // Modeleur de l'espace (Sablier voie) : les réponses changent de place toutes
  // les N s (gêne le clic). `order` = ordre d'AFFICHAGE ; les clics gardent l'index réel.
  const modeleur = showQuestion?.modeleur || null;
  // Clairvoyance (Indice ultime) : la bonne réponse est surlignée AVANT de répondre
  // (on peut toujours cliquer ; la série compte normalement).
  const hintReveal = !!showQuestion?.revealHint;
  const [order, setOrder] = useState(null);
  useEffect(() => {
    const q = showQuestion?.question;
    if (!modeleur || !q) { setOrder(null); return undefined; }
    const n = q.a.length;
    const shuffle = () => {
      const a = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      setOrder(a);
    };
    shuffle();
    const id = setInterval(shuffle, modeleur * 1000);
    return () => clearInterval(id);
  }, [modeleur, showQuestion?.question]);

  const question = showQuestion?.question;
  // Affichage anglais (repli FR par champ si la traduction manque). `c` (index
  // bonne réponse) reste identique → la bonne réponse reste alignée.
  const en = englishMode && !!question;
  const qText = en && question.q_en ? question.q_en : question?.q;
  const ansText = (idx) => (en && question?.a_en?.[idx]) ? question.a_en[idx] : question?.a?.[idx];
  const eText = en && question?.e_en ? question.e_en : question?.e;
  // « Voir la traduction » : l'AUTRE langue que celle affichée (FR si on montre
  // l'EN, EN si on montre le FR). Disponible seulement si cette autre version existe.
  const otherQ = englishMode ? question?.q : question?.q_en;
  const otherA = (idx) => englishMode ? question?.a?.[idx] : question?.a_en?.[idx];
  const otherE = englishMode ? question?.e : question?.e_en;
  const hasTranslation = !!otherQ;
  const L = englishMode
    ? { explanation: 'Explanation:', correct: 'Correct!', wrong: 'Wrong answer', timeout: "Time's up!", choose: 'Choose your answer', continue: 'Continue', time: 'TIME', showTrans: '🇫🇷 Voir en français', hideTrans: '🇫🇷 Masquer le français' }
    : { explanation: 'Explication :', correct: 'Bonne réponse !', wrong: 'Mauvaise réponse', timeout: 'Temps écoulé !', choose: 'Choisis ta réponse', continue: 'Continuer', time: 'TEMPS', showTrans: '🇬🇧 Voir en anglais', hideTrans: '🇬🇧 Masquer l’anglais' };
  const subject = showQuestion?.subject;
  const timerHalved = showQuestion?.timerHalved;
  // Sablier niv.2/3 divise par 3/4 — meme base que le calcul d'argent du store
  const timerDivisor = showQuestion?.timerDivisor || (timerHalved ? 2 : 1);
  const bonusTime = showQuestion?.bonusTime || 0;
  // Bonus d'equipement / consommable (calcule par le store dans askQuestion)
  const itemBonusTime = showQuestion?.itemBonusTime || 0;
  // Chrono partagé (Double L5) : temps de DÉPART imposé pour cette question de rafale.
  const sharedStart = showQuestion?.sharedStart;
  const confused = showQuestion?.confused; // Confusion (Sablier L5) : énoncé brouillé au départ
  const team = teams[currentTeam];
  const subjectInfo = SUBJECTS[subject] || {};
  // Sablier brisé (ultime) : plafonne le timer MAX (showQuestion.timerCap).
  const timerCap = showQuestion?.timerCap || Infinity;
  const duration = Math.min(timerCap, sharedStart != null ? Math.max(1, sharedStart) : Math.floor(TIMER_DURATION / timerDivisor) + itemBonusTime);

  // Rafale de questions (Double cumulable) : « Question X / N » + ambiance maudite
  const multiIndex = showQuestion?.multiIndex;
  const multiTotal = showQuestion?.multiTotal;
  const isBurst = !!multiTotal && multiTotal > 1;

  const canUseIndice = !indiceUsed && !revealed && team?.powers?.indice?.charges > 0;
  // Objets « changer la question » (équipement plafonné + consommables du sac)
  const rerollOptions = !revealed ? questionRerollOptions(team, rerollUsedState, showQuestion?.subject) : [];

  // Reset d'affichage quand la QUESTION change (sélection/révélation sont déjà
  // remises à zéro par le store avec la nouvelle question).
  useEffect(() => {
    if (question) setShowTrans(false);
  }, [question]);

  // Confusion : l'énoncé est flouté pendant ~3 s au début de la question.
  const [blurStmt, setBlurStmt] = useState(false);
  useEffect(() => {
    if (confused && question) {
      setBlurStmt(true);
      const t = setTimeout(() => setBlurStmt(false), 3000);
      return () => clearTimeout(t);
    }
    setBlurStmt(false);
  }, [confused, question]);

  // (Indice niv.2 : les secondes bonus prolongent la deadline DANS le store —
  // l'affichage suit automatiquement via le tick ci-dessous.)

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

  // Affichage du temps : recalcul régulier depuis la deadline du store (pas de
  // dérive, et un bonus de temps — qui décale la deadline — est suivi sans code
  // dédié). S'arrête à la révélation.
  useEffect(() => {
    if (!showQuestion || revealed || !deadline) return;
    const tick = () => setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [question, revealed, deadline, showQuestion]);

  // Sons (compte à rebours) + TIMEOUT : le TBI est l'horloge de référence —
  // c'est LUI qui bascule la révélation à 0 (le téléphone ne fait que refléter).
  useEffect(() => {
    if (!showQuestion || revealed) return;
    if (timeLeft <= 0) { revealQuestionTimeout(); return; }
    if (timeLeft <= 5) soundTimer();
  }, [timeLeft, revealed, showQuestion, revealQuestionTimeout]);

  // Sons de verdict à la RÉVÉLATION (transition), que la réponse vienne du TBI
  // ou du téléphone. Fige aussi l'affichage du temps sur la valeur retenue.
  const prevRevealedRef = useRef(false);
  useEffect(() => {
    if (revealed && !prevRevealedRef.current) {
      if (selected != null && selected === question?.c) soundCorrect();
      else soundWrong();
      // Silhouette (« Qui est ce Pokémon ? ») : jingle de révélation quand l'image
      // passe en couleur, par-dessus le verdict.
      if (question?.render === 'silhouette') setTimeout(() => soundReveal(), 140);
      if (showQuestion?.timeLeftAtReveal != null) setTimeLeft(showQuestion.timeLeftAtReveal);
    }
    prevRevealedRef.current = revealed;
  }, [revealed, selected, question, showQuestion]);

  const handleAnswer = useCallback((idx) => {
    if (revealed) return;
    selectAnswer(idx);
  }, [revealed, selectAnswer]);

  const handleContinue = useCallback(() => {
    if (!revealed) return;
    continueQuestion();
  }, [revealed, continueQuestion]);

  // Temps total réellement disponible (base 30 s + bonus d'équipement déjà inclus
  // dans `duration`, + bonus d'Indice ajouté à timeLeft). Sert d'échelle stable
  // pour la barre afin de matérialiser la zone « bonus » au-delà des 30 s.
  const barMax = Math.max(duration + bonusTime, TIMER_DURATION);
  const timerRatio = Math.min(1, timeLeft / barMax);
  // Zone bonus : portion de la barre située au-delà des 30 s de base.
  const hasBonus = barMax > TIMER_DURATION + 0.5;
  const baseFrac = TIMER_DURATION / barMax;       // position du repère 30 s (0..1)
  const bonusSeconds = Math.round(barMax - TIMER_DURATION);
  const isOpen = !!(showQuestion && question);
  const bgColor = subjectInfo.color || '#888';

  const isCorrect = revealed && selected != null && selected === question?.c;
  const isWrong = revealed && (selected == null || selected !== question?.c);
  const isHardcore = subject === 'hardcore';

  // Barres d'égaliseur du timer (habillage rétro) : hauteurs pseudo-aléatoires
  // stables par index, allumées jusqu'au ratio restant, dorées dans la zone bonus.
  const BAR_COUNT = 22;
  const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
    const h = 30 + ((i * 29) % 70);
    const on = i < Math.ceil(timerRatio * BAR_COUNT);
    const frac = i / BAR_COUNT;
    let color = '#3a3f45';
    if (on) {
      if (hasBonus && frac >= baseFrac) color = '#f3c969';
      else if (frac < 0.5) color = '#57c84d';
      else if (frac < 0.78) color = '#e8a13a';
      else color = '#e14b3a';
    }
    return { h: `${h}%`, color };
  });
  const feedColor = !revealed ? '#8b9096' : (isCorrect ? '#57c84d' : '#e8574b');
  const feedText = !revealed ? L.choose : (isCorrect ? `✓ ${L.correct}` : (selected != null ? `✕ ${L.wrong}` : `✕ ${L.timeout}`));

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalOverlay className={`max-w-[820px] ${isCorrect ? 'quiz-correct' : ''} ${isWrong ? 'quiz-wrong' : ''} ${isBurst ? 'quiz-cursed' : ''} ${isHardcore ? 'quiz-hardcore' : ''}`} panelStyle={STONE_PANEL}>
          <div className="rq-frame">
          {/* Barre du haut : bandeau LED catégorie + équipe */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div className="rq-lcd" style={{ maxWidth: '68%' }}>
              <span className="rq-lcd__led" style={{ background: bgColor, boxShadow: `0 0 8px ${bgColor}` }} />
              <span className="rq-lcd__txt">
                {subjectInfo.icon} {locName(subjectInfo)}{subjectInfo.biome ? ` · ${loc(subjectInfo, 'biome')}` : ''}
              </span>
            </div>
            <div className="rq-teamchip"><TeamAvatar team={team} size={22} />{team?.name}</div>
          </div>
          <div className="rq-topbadges">

            {isBurst && (
              <div className="quiz-curse-badge">
                <span className="quiz-curse-skull">{'\u{1F480}'}</span>
                Malédiction · Question {multiIndex} / {multiTotal}
              </div>
            )}

            {isHardcore && (
              <div className="quiz-hell-badge">
                <span className="quiz-hell-flame">{'\u{1F525}'}</span>
                Épreuve infernale · niveau lycée
              </div>
            )}

          </div>

          {/* Ecran creme : enonce (+ confusion, traduction) */}
          <div className="rq-screen">
            <div className="rq-screen__kicker">
              {subjectInfo.icon} QUESTION{isBurst ? ` ${multiIndex}/${multiTotal}` : ''} {'\u00b7'} {team?.name}
            </div>
            <div className="rq-screen__text" style={{ filter: blurStmt ? 'blur(8px)' : 'none', transition: 'filter 0.4s ease', userSelect: blurStmt ? 'none' : 'auto' }}>
              {qText}
            </div>
            {blurStmt && <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>🌀 Confusion… l'énoncé se précise.</div>}
            {/* Traduction de la question (autre langue) — bouton + ligne révélée */}
            {hasTranslation && !blurStmt && (
              <button type="button" className="rq-transbtn" onClick={() => setShowTrans((v) => !v)}>
                {showTrans ? L.hideTrans : L.showTrans}
              </button>
            )}
            {showTrans && otherQ && (
              <div className="rq-screen__trans">{otherQ}</div>
            )}

            {/* Image de la question (ex. drapeau à identifier). Floutée aussi
                pendant la Confusion pour rester cohérent avec l'énoncé.
                Mode 'silhouette' (« Qui est ce Pokémon ? ») : l'image est masquée
                en noir (brightness 0) jusqu'à la révélation, puis fond en couleur
                avec un petit « pop ». L'URL du bucket est opaque → jamais de spoil. */}
            {question.img && (() => {
              const silhouette = question.render === 'silhouette';
              const masked = silhouette && !revealed; // encore en ombre chinoise
              return (
                <div className="rq-media" style={{ marginTop: 12, textAlign: 'center', filter: blurStmt ? 'blur(8px)' : 'none', transition: 'filter 0.4s ease' }}>
                  <img
                    src={question.img}
                    alt=""
                    style={{
                      maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 10,
                      boxShadow: masked ? 'none' : '0 4px 14px rgba(0,0,0,0.18)',
                      filter: masked ? 'brightness(0)' : 'brightness(1)',
                      transform: silhouette && revealed ? 'scale(1.05)' : 'scale(1)',
                      transition: 'filter 0.6s ease, transform 0.45s cubic-bezier(.2,1.4,.4,1)',
                    }}
                  />
                </div>
              );
            })()}

          </div>

          {/* Choices - 2x2 grid */}
          <div className={'grid gap-3 grid-cols-1 sm:grid-cols-2' + (modeleur ? ' quiz-modeleur' : '')} style={{ marginTop: 14 }}>
            {(order || question.a.map((_, i) => i)).map((idx, pos) => {
              const shown = ansText(idx); // texte affiché (EN si dispo, sinon FR)
              if (indiceHidden.includes(idx)) {
                return <EliminatedAnswer key={idx} idx={idx} answer={shown} />;
              }

              // Base = .tm-choice (parchemin + liseré pierre) ; surcharge à la révélation
              let choiceStyle = null;
              let letterStyle = null;
              // Clairvoyance : surligne la bonne réponse avant de répondre (clic gardé).
              if (!revealed && hintReveal && idx === question.c) {
                choiceStyle = { border: '2px solid #5b8c3a', background: 'linear-gradient(180deg, #d1f0b8, #a8d889)', color: '#1f3d10' };
                letterStyle = { background: '#5b8c3a', color: '#fff' };
              }
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
              // Modeleur : ondulation « bourré » en vague, déphasée par position.
              const modeleurStyle = modeleur ? { animationDelay: `${(pos % 4) * 0.4}s`, animationDuration: `${1.4 + (modeleur - 2) * 0.25}s` } : null;
              return (
                <button
                  key={idx}
                  className={'rq-choice' + (modeleur ? ' tm-choice--modeleur' : '')}
                  onClick={() => handleAnswer(idx)}
                  disabled={revealed}
                  aria-label={`Option ${letter}: ${shown}`}
                  style={(choiceStyle || modeleurStyle) ? { ...choiceStyle, ...modeleurStyle } : undefined}
                >
                  <span className="rq-choice-letter" style={letterStyle || undefined}>
                    {letter}
                  </span>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                    {/* Média de la réponse (ex. drapeau à choisir), aligné sur l'index. */}
                    {question.a_img?.[idx] && (
                      <img src={question.a_img[idx]} alt="" style={{ maxWidth: '100%', maxHeight: 96, objectFit: 'contain', borderRadius: 6 }} />
                    )}
                    {shown && <span>{shown}</span>}
                    {showTrans && otherA(idx) && <span style={{ fontSize: 12.5, fontStyle: 'italic', opacity: 0.72 }}>{otherA(idx)}</span>}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Timer egaliseur + feedback */}
          <div className="rq-timer">
            <span className="rq-timer__label">{L.time}</span>
            <div className="rq-bars">
              {bars.map((b, i) => <div key={i} className="rq-bar" style={{ height: b.h, background: b.color }} />)}
              {hasBonus && <div className="rq-bars__tick" style={{ left: `${baseFrac * 100}%` }} />}
            </div>
            <span className="rq-timer__secs" aria-live="polite">{timeLeft}s</span>
            <span className="rq-timer__feed" style={{ color: feedColor }}>{feedText}</span>
          </div>
          <div>
            {hasBonus && <span className="rq-chip" style={{ color: '#f3c969' }}>{`+${bonusSeconds}s bonus`}</span>}
            {timerHalved && <span className="rq-chip">{`Sablier actif : ${duration}s`}</span>}
            {itemBonusTime > 0 && <span className="rq-chip">{`Equipement : +${itemBonusTime}s`}</span>}
          </div>

          {/* Actions bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, minHeight: 40 }}>
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
            </div>
            {revealed && (
              <button className="rg-btn" onClick={handleContinue}>
                {L.continue}
              </button>
            )}
          </div>

          {/* Explanation */}
          {revealed && eText && (
            <div className="rq-explain">
              <strong>{L.explanation}</strong> {eText}
              {showTrans && otherE && <div style={{ fontSize: 14, fontStyle: 'italic', opacity: 0.78, marginTop: 4 }}>{otherE}</div>}
            </div>
          )}
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
