import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong, soundReveal, soundWtpJingle, stopWtpJingle, soundWtpBall } from '../../../logic/sounds';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';

// Durée de l'intro pokéball (vol vers le centre + flash) avant l'apparition de
// la silhouette. Les taps sont ignorés pendant l'intro.
export const WTP_INTRO_MS = 1250;

// Rotation lente des rayons, intro pokéball (vol → impact → flash), pop de la
// silhouette. IMPORTANT : les keyframes qui animent `transform` vivent sur des
// éléments SANS translate inline (le centrage est porté par un wrapper grid),
// sinon l'animation écrase le translate(-50%,-50%) et l'image part en vrille.
const WTP_CSS = `
@keyframes wtpRays { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes wtpPop { 0% { transform: scale(0.92); } 55% { transform: scale(1.12); } 100% { transform: scale(1.05); } }
@keyframes wtpBanner { from { transform: translateX(-50%) scale(0.6); opacity: 0; } to { transform: translateX(-50%) scale(1); opacity: 1; } }
@keyframes wtpBallFly {
  from { transform: translate(-46vw, 34vh) scale(0.22) rotate(-900deg); }
  to { transform: translate(0, 0) scale(1) rotate(0deg); }
}
@keyframes wtpBallPop {
  from { transform: scale(1); opacity: 1; }
  to { transform: scale(1.7); opacity: 0; }
}
@keyframes wtpFlash {
  0% { transform: scale(0.2); opacity: 0; }
  30% { opacity: 0.95; }
  100% { transform: scale(2.4); opacity: 0; }
}
@keyframes wtpAppear {
  from { transform: scale(0.35); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
`;

// Étoile « explosion » du plateau TV : polygone en dents de scie irrégulières
// (pseudo-aléa déterministe par sinus → même étoile à chaque rendu, pas de
// scintillement). Centre 50,50 dans un viewBox 0 0 100 100.
function starPoints(spikes, rOut, rIn, seed) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const base = (Math.PI * i) / spikes;
    const jitterA = (Math.sin(seed * 3.1 + i * 78.233) * 0.55) / spikes;
    const jitterR = 0.62 + 0.38 * Math.abs(Math.sin(seed + i * 12.9898));
    const r = i % 2 === 0 ? rOut * jitterR : rIn * (0.82 + 0.18 * Math.abs(Math.sin(seed * 1.7 + i * 3.7)));
    const a = base + jitterA;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

// Pokéball en pur CSS (rouge / bande noire / blanc + bouton central).
function Pokeball({ size = '100%' }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: '50%', position: 'relative',
        background: 'linear-gradient(180deg, #e3350d 0%, #e3350d 44%, #16161a 44%, #16161a 56%, #f4f4f4 56%, #f4f4f4 100%)',
        border: '3px solid #16161a',
        boxShadow: '0 10px 22px rgba(0,0,0,0.4), inset -8px -10px 18px rgba(0,0,0,0.18), inset 6px 8px 14px rgba(255,255,255,0.25)',
      }}
    >
      <div style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: '30%', aspectRatio: '1', borderRadius: '50%',
        background: '#f4f4f4', border: '4px solid #16161a',
        boxShadow: 'inset 0 0 0 4px #dcdcdc',
      }} />
    </div>
  );
}

// Intro pilotée par l'image courante : true pendant WTP_INTRO_MS après chaque
// nouvelle silhouette (pokéball qui vole au centre + flash), puis false.
// SÉQUENCE SONORE (le hook ne vit que sur l'écran qui affiche le plateau) :
// lancer (sifflement + pop d'impact calés sur l'animation) → à l'apparition de
// la silhouette, le jingle « Who's that Pokémon?! » — démarré APRÈS l'impact
// pour ne pas masquer le sifflement. `revealed` : si la manche est déjà résolue
// à la fin de l'intro (réponse téléphone ultra-rapide), pas de jingle.
export function useWtpIntro(img, revealed = false) {
  const [intro, setIntro] = useState(true);
  const revealedRef = useRef(revealed);
  revealedRef.current = revealed;
  useEffect(() => {
    if (!img) return undefined;
    setIntro(true);
    soundWtpBall();
    const t = setTimeout(() => {
      setIntro(false);
      if (!revealedRef.current) soundWtpJingle();
    }, WTP_INTRO_MS);
    return () => clearTimeout(t);
  }, [img]);
  return intro;
}

/**
 * Le PLATEAU TV partagé (visuel pur, aucune logique de jeu) : fond rouge à
 * rayons, explosion étoilée, pokéball d'intro, silhouette noire → couleur,
 * « ? », logo et bandeau « C'est … ! ». Réutilisé par le mini-jeu tactile
 * (WhosThatPokemon) ET par la scène TV du duel multi-surface (WtpDuelStage).
 *
 * Props : img (URL) · intro (pokéball en vol, silhouette cachée) ·
 * revealed (image en couleur + pop) · revealLabel (bandeau, null = caché).
 */
export function WtpStage({ img, intro, revealed, revealLabel }) {
  // Étoile stable par image (seed dérivée de l'URL).
  const seed = useMemo(() => {
    let h = 0;
    for (const ch of img || '') h = (h * 31 + ch.charCodeAt(0)) % 997;
    return h / 100 + 1;
  }, [img]);

  return (
    <div
      style={{
        position: 'relative', width: '100%', height: '100%',
        borderRadius: 16, overflow: 'hidden',
        border: '4px solid #16161a',
        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.4)',
        background: '#d92a1c',
      }}
    >
      <style>{WTP_CSS}</style>

      {/* Rayons rouges en rotation lente (débordent pour couvrir les coins) */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: '250%', aspectRatio: '1', transform: 'translate(-50%, -50%)' }}>
        <div
          style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'repeating-conic-gradient(from 0deg at 50% 50%, #e8402c 0deg 11deg, #c92315 11deg 22deg)',
            animation: 'wtpRays 90s linear infinite',
          }}
        />
      </div>

      {/* Explosion étoilée blanc/bleu derrière la silhouette */}
      <svg
        viewBox="0 0 100 100"
        style={{
          position: 'absolute', left: '50%', top: '50%', width: 'min(96%, 74vh)', aspectRatio: '1',
          transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        }}
      >
        <polygon points={starPoints(30, 49, 26, seed)} fill="#8fc4f2" opacity="0.85" />
        <polygon points={starPoints(26, 43, 23, seed + 2.4)} fill="#d9ecff" opacity="0.92" />
        <polygon points={starPoints(22, 36, 20, seed + 5.1)} fill="#ffffff" />
      </svg>

      {/* Intro : pokéball qui se lance vers le centre puis éclate en flash.
          key={img} → les animations repartent de zéro à chaque silhouette. */}
      {intro && (
        <div key={img} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{
            width: 'min(24%, 150px)', aspectRatio: '1',
            animation: 'wtpBallFly 0.85s cubic-bezier(.3,.9,.55,1) forwards, wtpBallPop 0.3s ease-out 0.9s forwards',
          }}>
            <Pokeball />
          </div>
          <div style={{
            position: 'absolute', width: 'min(46%, 320px)', aspectRatio: '1', borderRadius: '50%',
            background: 'radial-gradient(circle, #ffffff 30%, #cfe4ff 55%, rgba(207,228,255,0) 72%)',
            opacity: 0, animation: 'wtpFlash 0.55s ease-out 0.82s forwards',
          }} />
        </div>
      )}

      {/* La silhouette : centrage porté par le wrapper (grid), les animations
          (apparition / pop) ne touchent qu'au scale de l'image — le reveal
          reste donc PILE au centre. */}
      {!intro && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <img
            key={img}
            src={img}
            alt=""
            draggable={false}
            style={{
              maxWidth: '52%', maxHeight: '58%', objectFit: 'contain',
              filter: revealed ? 'brightness(1) drop-shadow(0 4px 10px rgba(0,0,0,0.35))' : 'brightness(0)',
              transition: 'filter 0.5s ease',
              animation: revealed
                ? 'wtpPop 0.5s cubic-bezier(.2,1.4,.4,1) forwards'
                : 'wtpAppear 0.35s cubic-bezier(.2,1.3,.4,1) forwards',
              userSelect: 'none',
            }}
          />
        </div>
      )}

      {/* « ? » jaune bordé de bleu (disparaît à la révélation) */}
      {!revealed && (
        <div
          style={{
            position: 'absolute', right: '6%', top: '8%',
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 'clamp(48px, 8vw, 110px)', lineHeight: 1,
            color: '#ffcb05',
            WebkitTextStroke: '3px #3d7dca',
            textShadow: '4px 5px 0 rgba(27,79,138,0.55)',
            transform: 'rotate(6deg)',
            pointerEvents: 'none',
          }}
        >
          ?
        </div>
      )}

      {/* Logo « Pokémon » (jaune bordé de bleu, légèrement incliné) */}
      <div
        style={{
          position: 'absolute', right: '4%', bottom: '4%',
          fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: 'clamp(22px, 3vw, 42px)', lineHeight: 1,
          color: '#ffcb05',
          WebkitTextStroke: '2px #2a75bb',
          textShadow: '3px 3px 0 rgba(27,79,138,0.6)',
          transform: 'rotate(-5deg)', letterSpacing: '0.02em',
          pointerEvents: 'none',
        }}
      >
        Pokémon
      </div>

      {/* Bandeau de révélation « C'est… X ! » */}
      {revealLabel && (
        <div
          style={{
            position: 'absolute', left: '50%', bottom: '7%',
            transform: 'translateX(-50%)',
            padding: '10px 26px', borderRadius: 999, whiteSpace: 'nowrap',
            background: 'rgba(255,255,255,0.95)', border: '3px solid #2a75bb',
            fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 2.4vw, 30px)', color: '#1b4f8a',
            boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
            animation: 'wtpBanner 0.45s cubic-bezier(.2,1.4,.4,1) forwards',
          }}
        >
          {revealLabel}
        </div>
      )}
    </div>
  );
}

/**
 * « Qui est ce Pokémon ?! » — version TACTILE (écran partagé/scindé) : le
 * plateau TV au centre, les mêmes réponses des deux côtés (mélangées
 * indépendamment — anti-copie). Le premier à toucher le bon nom gagne la
 * manche ; une erreur verrouille son côté ; deux côtés verrouillés = révélation
 * sans vainqueur puis silhouette suivante. Jingle original à chaque manche,
 * coupé à la révélation. Sur les surfaces téléphone/en ligne, ce composant
 * n'est PAS monté : fightBegin route vers le duel-course piloté par le store
 * (flag showFight.wtp) — plateau TV via WtpDuelStage, réponses au téléphone.
 *
 * Contenu (même contrat que Deblur, cf. DESIGN_MINIGAMES.md) :
 *   - { fromQuestions: '<subjectKey>' } : questions à image du pool (Pokémon…) ;
 *   - [{ img, answer, decoys[] }] : contenu statique dédié.
 */
export default function WhosThatPokemon({ attacker, defender, round, onRoundWin, content }) {
  const T = useT();
  const fightPickImageQuestion = useGameStore((s) => s.fightPickImageQuestion);

  const pickChallenge = () => {
    if (Array.isArray(content) && content.length) {
      const item = content[Math.floor(Math.random() * content.length)];
      const a = shuffle([item.answer, ...(item.decoys || []).slice(0, 3)]);
      return { img: item.img, a, c: a.indexOf(item.answer) };
    }
    const q = fightPickImageQuestion(content?.fromQuestions);
    return q ? { img: q.img, a: q.a, c: q.c } : null;
  };

  const [challenge, setChallenge] = useState(null);
  const [locked, setLocked] = useState({ attacker: false, defender: false });
  // null = en jeu · 'attacker'/'defender' = vainqueur · 'nobody' = double erreur
  const [resolved, setResolved] = useState(null);
  // Sons d'intro (lancer puis jingle) gérés par le hook, calés sur l'image.
  const intro = useWtpIntro(challenge?.img, !!resolved);

  const newChallenge = () => {
    setChallenge(pickChallenge());
    setLocked({ attacker: false, defender: false });
    setResolved(null);
  };

  useEffect(() => { newChallenge(); }, [round]);
  useEffect(() => () => stopWtpJingle(), []); // démontage = silence

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

  const revealed = !!resolved;

  const reveal = (winner) => {
    setResolved(winner);
    stopWtpJingle();
    soundReveal();
  };

  const handleTap = (side, answerIdx) => {
    if (revealed || intro || locked[side]) return;
    if (answerIdx === challenge.c) {
      soundCorrect();
      reveal(side);
      setTimeout(() => onRoundWin(side), 1900); // laisse savourer la révélation
    } else {
      soundWrong();
      const next = { ...locked, [side]: true };
      setLocked(next);
      if (next.attacker && next.defender) {
        reveal('nobody');
        setTimeout(newChallenge, 2400);
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
            const showResult = revealed && answerIdx === challenge.c;
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
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {renderSide('attacker', attacker)}

        {/* Plateau TV partagé (équité : même silhouette pour les deux) */}
        <div style={{ flex: '0 1 min(46vw, 680px)', minWidth: 220 }}>
          <WtpStage
            img={challenge.img}
            intro={intro}
            revealed={revealed}
            revealLabel={revealed ? `${T('fight.wtp.its')} ${challenge.a[challenge.c]} !` : null}
          />
        </div>

        {renderSide('defender', defender)}
      </div>
      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.wtp.hint')}
      </div>
    </div>
  );
}
