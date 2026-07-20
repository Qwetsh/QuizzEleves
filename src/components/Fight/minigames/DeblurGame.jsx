import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';

// Durée du défloutage (flou total → net), en secondes. Répondre tôt = plus dur
// mais plus rapide que l'adversaire : c'est tout le dilemme du jeu.
export const DEBLUR_DURATION = 18;
const START_BLUR = 26; // px

// Défloutage par ANIMATION CSS sur un élément recréé à chaque image
// (key={challenge.img}) : une animation démarre toujours de son from sur un
// élément neuf — contrairement à une transition, qui rate son départ si les
// deux valeurs de filter tombent dans le même recalcul de style.
const DEBLUR_CSS = `
@keyframes mgDeblurSharpen { from { filter: blur(${START_BLUR}px); } to { filter: blur(0px); } }
@keyframes mgDeblurGauge { from { width: 0%; } to { width: 100%; } }
`;

/**
 * Deblur (« photo mystère ») — écran scindé tactile. UNE image partagée au
 * centre passe progressivement de floue à nette ; chaque côté a les mêmes
 * réponses (mélangées indépendamment — anti-copie). Le premier à toucher la
 * bonne réponse gagne la manche ; une erreur verrouille son côté ; deux côtés
 * verrouillés = nouvelle image.
 *
 * Deux formes de `content` (cf. DESIGN_MINIGAMES.md) :
 *   - { fromQuestions: '<subjectKey>' } : pioche une question À IMAGE du pool
 *     (img + 4 choix + bonne réponse déjà en base — drapeaux…) ;
 *   - [{ img, answer, decoys[], prompt? }] : contenu statique dédié au thème.
 *
 * `sharp` (moteur `imgrace`) : l'image s'affiche NETTE d'emblée — pas de
 * défloutage ni de jauge, pure course de reconnaissance (ex. Drapeau éclair).
 */
export default function DeblurGame({ attacker, defender, round, onRoundWin, content, sharp = false }) {
  const T = useT();
  const fightPickImageQuestion = useGameStore((s) => s.fightPickImageQuestion);

  const pickChallenge = () => {
    if (Array.isArray(content) && content.length) {
      const item = content[Math.floor(Math.random() * content.length)];
      const a = shuffle([item.answer, ...(item.decoys || []).slice(0, 3)]);
      return { img: item.img, prompt: item.prompt || null, a, c: a.indexOf(item.answer) };
    }
    const q = fightPickImageQuestion(content?.fromQuestions);
    return q ? { img: q.img, prompt: q.q, a: q.a, c: q.c } : null;
  };

  const [challenge, setChallenge] = useState(null);
  const [locked, setLocked] = useState({ attacker: false, defender: false });
  const [resolved, setResolved] = useState(false);
  const [loaded, setLoaded] = useState(false); // image chargée → le défloutage démarre
  // Échecs de chargement CONSÉCUTIFS (reset au premier onLoad) : image morte →
  // on passe au défi suivant ; au-delà de MAX_IMG_FAILS on débloque le jeu
  // (setLoaded) plutôt que de boucler — mieux vaut jouer à l'aveugle que figé.
  const MAX_IMG_FAILS = 3;
  const [imgFails, setImgFails] = useState(0);
  // Garde de démontage pour le timer. ⚠️ Reset dans le CORPS de l'effet :
  // le StrictMode dev simule démontage + re-montage de la même instance.
  const dead = useRef(false);
  useEffect(() => {
    dead.current = false;
    return () => { dead.current = true; };
  }, []);

  const newChallenge = () => {
    setChallenge(pickChallenge());
    setLocked({ attacker: false, defender: false });
    setResolved(false);
    setLoaded(false);
  };

  const onImgError = () => {
    const n = imgFails + 1;
    setImgFails(n);
    if (n >= MAX_IMG_FAILS) { setLoaded(true); return; }
    setTimeout(() => { if (!dead.current) newChallenge(); }, 700);
  };

  // Nouvelle image à chaque manche (le composant est remonté, mais round/subject
  // peuvent aussi changer sans remontage si un jour persistent passe à true).
  useEffect(() => { newChallenge(); }, [round]);

  // Ordres d'affichage indépendants par côté (anti-copie).
  const orders = useMemo(() => {
    if (!challenge) return null;
    const idx = challenge.a.map((_, i) => i);
    return { attacker: shuffle(idx), defender: shuffle(idx) };
  }, [challenge]);

  if (!challenge) {
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
    if (answerIdx === challenge.c) {
      setResolved(true);
      soundCorrect();
      setTimeout(() => onRoundWin(side), 1100); // laisse voir l'image nette
    } else {
      soundWrong();
      const next = { ...locked, [side]: true };
      setLocked(next);
      if (next.attacker && next.defender) setTimeout(newChallenge, 900);
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
            const showResult = resolved && answerIdx === challenge.c;
            return (
              <button
                key={answerIdx}
                onPointerDown={() => handleTap(side, answerIdx)}
                style={{
                  padding: '13px 14px', borderRadius: 12,
                  border: showResult ? '3px solid #5b8c3a' : '2px solid rgba(122,94,58,0.25)',
                  background: showResult ? '#d1f0b8' : '#fffefb',
                  fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 500,
                  textAlign: 'left', cursor: 'pointer',
                  touchAction: 'manipulation',
                }}
              >
                {challenge.a[answerIdx]}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {challenge.prompt && (
        <div
          style={{
            padding: '10px 20px', borderRadius: 14, textAlign: 'center',
            background: 'rgba(255,254,251,0.95)',
            fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          }}
        >
          {challenge.prompt}
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {renderSide('attacker', attacker)}

        {/* Photo mystère partagée (équité : même image, même flou pour les deux) */}
        <div style={{ flex: '0 1 min(38vw, 560px)', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 180 }}>
          <div
            style={{
              flex: 1, minHeight: 0, borderRadius: 16, overflow: 'hidden',
              background: '#0d0a06', border: '3px solid rgba(243,201,105,0.5)',
              boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.4)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <style>{DEBLUR_CSS}</style>
            <img
              // imgFails dans la clé : si le tirage ressert LA MÊME URL morte,
              // l'élément est recréé → onError refeu → la garde peut escalader.
              key={`${challenge.img}#${imgFails}`}
              src={challenge.img}
              alt=""
              draggable={false}
              onLoad={() => { setLoaded(true); setImgFails(0); }}
              onError={onImgError}
              // image en cache : onLoad peut ne pas refeu → complete fait foi
              ref={(el) => { if (el && el.complete && el.naturalWidth > 0) setLoaded(true); }}
              style={{
                width: '100%', height: '100%', objectFit: 'contain',
                // scale léger : masque le halo de bord du blur
                transform: sharp ? 'none' : 'scale(1.06)',
                filter: sharp || resolved ? 'blur(0px)' : `blur(${START_BLUR}px)`,
                // longhand only : mélanger le raccourci `animation` et
                // animationPlayState fait râler React (styles en conflit)
                animationName: sharp || resolved ? 'none' : 'mgDeblurSharpen',
                animationDuration: `${DEBLUR_DURATION}s`,
                animationTimingFunction: 'linear',
                animationFillMode: 'forwards',
                animationPlayState: loaded ? 'running' : 'paused',
                userSelect: 'none', pointerEvents: 'none',
              }}
            />
          </div>
          {/* Jauge de netteté : se remplit au rythme du défloutage (pas en mode net) */}
          {!sharp && (
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.15)', overflow: 'hidden' }}>
              <div
                key={challenge.img}
                style={{
                  height: '100%', borderRadius: 4,
                  background: 'linear-gradient(90deg, #f3c969, #9be67f)',
                  width: resolved ? '100%' : '0%',
                  animationName: resolved ? 'none' : 'mgDeblurGauge',
                  animationDuration: `${DEBLUR_DURATION}s`,
                  animationTimingFunction: 'linear',
                  animationFillMode: 'forwards',
                  animationPlayState: loaded ? 'running' : 'paused',
                }}
              />
            </div>
          )}
        </div>

        {renderSide('defender', defender)}
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T(sharp ? 'fight.imgrace.hint' : 'fight.deblur.hint')}
      </div>
    </div>
  );
}
