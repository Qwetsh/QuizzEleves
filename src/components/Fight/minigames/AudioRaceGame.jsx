import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong, getSfxLevel } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';

// Platine + égaliseur du Blind test (animations CSS pures).
const AUDIO_CSS = `
@keyframes arSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes arBar { 0% { transform: scaleY(0.25); } 100% { transform: scaleY(1); } }
`;

/**
 * Blind test (moteur audiorace) — écran scindé tactile. Un extrait audio (30 s,
 * en boucle) joue au centre (platine vinyle + égaliseur) ; mêmes réponses des
 * deux côtés (mélangées indépendamment). Premier sur la bonne réponse = manche ;
 * erreur = côté verrouillé ; deux verrous = nouvel extrait.
 *
 * `content` = { fromQuestions: '<subjectKey>' } : questions à AUDIO du pool
 * (colonne `audio`, extraits seedés par scripts/seed-audio-tracks.mjs).
 * Si l'autoplay est bloqué par le navigateur, la platine affiche ▶ (un tap
 * relance la lecture — replay autorisé à volonté).
 */
export default function AudioRaceGame({ attacker, defender, round, onRoundWin, content }) {
  const T = useT();
  const fightPickAudioQuestion = useGameStore((s) => s.fightPickAudioQuestion);

  const [question, setQuestion] = useState(null);
  const [locked, setLocked] = useState({ attacker: false, defender: false });
  const [resolved, setResolved] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const stopAudio = () => {
    const a = audioRef.current;
    if (a) { a.pause(); a.src = ''; }
    audioRef.current = null;
    setPlaying(false);
  };

  const startAudio = (url) => {
    stopAudio();
    const a = new Audio(url);
    a.loop = true;
    a.volume = getSfxLevel();
    audioRef.current = a;
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); // autoplay bloqué → ▶
  };

  const newQuestion = () => {
    const q = fightPickAudioQuestion(content?.fromQuestions);
    setQuestion(q);
    setLocked({ attacker: false, defender: false });
    setResolved(false);
    if (q?.audio) startAudio(q.audio);
  };

  useEffect(() => { newQuestion(); }, [round]);
  useEffect(() => () => stopAudio(), []); // démontage = silence

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

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) { if (question.audio) startAudio(question.audio); return; }
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {});
    else { a.pause(); setPlaying(false); }
  };

  const handleTap = (side, answerIdx) => {
    if (resolved || locked[side]) return;
    if (answerIdx === question.c) {
      setResolved(true);
      stopAudio();
      soundCorrect();
      setTimeout(() => onRoundWin(side), 1200);
    } else {
      soundWrong();
      const next = { ...locked, [side]: true };
      setLocked(next);
      if (next.attacker && next.defender) setTimeout(newQuestion, 1100);
    }
  };

  const renderSide = (side, team) => {
    const isLocked = locked[side];
    return (
      <div
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', gap: 10,
          padding: '12px 14px',
          background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
          borderTop: `4px solid ${team.color}`,
          borderRadius: 16,
          opacity: isLocked ? 0.55 : 1,
          transition: 'opacity 200ms ease',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <TeamAvatar team={team} size={30} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: team.color }}>{team.name}</span>
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
                  padding: '13px 14px', borderRadius: 12,
                  border: showResult ? '3px solid #5b8c3a' : '2px solid rgba(122,94,58,0.25)',
                  background: showResult ? '#d1f0b8' : '#fffefb',
                  fontFamily: 'var(--font-ui)', fontSize: 14.5, fontWeight: 500,
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

  // Barres d'égaliseur : hauteurs/durées variées, figées quand la lecture s'arrête.
  const bars = [0.9, 0.55, 0.75, 0.4, 1, 0.6, 0.85, 0.5, 0.7];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <style>{AUDIO_CSS}</style>
      <div
        style={{
          padding: '10px 20px', borderRadius: 14, textAlign: 'center',
          background: 'rgba(255,254,251,0.95)',
          fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}
      >
        {question.q}
      </div>
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {renderSide('attacker', attacker)}

        {/* Platine partagée : vinyle qui tourne + égaliseur (tap = ▶ / ⏸) */}
        <div
          onPointerDown={togglePlay}
          style={{
            flex: '0 1 min(30vw, 420px)', minWidth: 180, cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
            borderRadius: 16, background: '#14100b',
            border: '3px solid rgba(243,201,105,0.5)',
            boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: 'min(20vw, 230px)', aspectRatio: '1', borderRadius: '50%', position: 'relative',
              background: 'repeating-radial-gradient(circle at 50% 50%, #191919 0 3px, #232323 3px 6px)',
              border: '4px solid #0a0a0a',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6), inset 0 0 18px rgba(0,0,0,0.8)',
              animation: 'arSpin 2.2s linear infinite',
              animationPlayState: playing && !resolved ? 'running' : 'paused',
              display: 'grid', placeItems: 'center',
            }}
          >
            <div style={{
              width: '34%', aspectRatio: '1', borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #f3c969, #b8862c)',
              display: 'grid', placeItems: 'center',
              fontSize: 'clamp(18px, 2vw, 30px)',
            }}>
              {playing && !resolved ? '🎵' : '▶'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 44 }}>
            {bars.map((h, i) => (
              <div
                key={i}
                style={{
                  width: 8, height: 44 * h, borderRadius: 3,
                  background: 'linear-gradient(180deg, #9be67f, #f3c969)',
                  transformOrigin: 'bottom',
                  animation: `arBar ${0.35 + (i % 4) * 0.12}s ease-in-out infinite alternate`,
                  animationPlayState: playing && !resolved ? 'running' : 'paused',
                  opacity: playing && !resolved ? 1 : 0.35,
                }}
              />
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: 11, color: 'rgba(255,243,212,0.6)' }}>
            {T('fight.audio.tap')}
          </div>
        </div>

        {renderSide('defender', defender)}
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.audio.hint')}
      </div>
    </div>
  );
}
