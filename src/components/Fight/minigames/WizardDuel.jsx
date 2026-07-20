import { useState, useEffect, useMemo, useRef } from 'react';
import { useGameStore } from '../../../store/gameStore';
import { shuffle } from '../../../data/fightData';
import { soundCorrect, soundWrong } from '../../../logic/sounds';
import { createBeam, pushBeam } from '../../../logic/wizardDuel';
import WizardBeam from './WizardBeam.jsx';
import TeamAvatar from '../../TeamAvatar';
import { useT } from '../../../i18n';

// Verrou d'une baguette « enrayée » après une mauvaise réponse (ms).
const LOCK_MS = 1400;
// Pause avant l'annonce de victoire, le temps de laisser voir l'impact (ms).
const HIT_MS = 1200;

/**
 * Duel de sorciers (Priori Incantatem) — composant TACTILE split-screen.
 * pointsBased : un DUEL UNIQUE à mort. En HAUT, la scène (WizardBeam) avec les
 * deux sorciers et l'orbe ; en BAS, deux zones de réponse (gauche/droite) pour
 * la MÊME question. Le premier à toucher la bonne réponse pousse son sort vers
 * l'adversaire ; quand l'orbe touche un camp, l'AUTRE gagne (fightMatchWin).
 *
 * Une mauvaise réponse « enraye » la baguette de ce camp ~1,4 s (l'autre peut
 * en profiter). La victoire ne passe PAS par onRoundWin (moteur pointsBased) :
 * elle est déclarée au store via fightMatchWin.
 */
export default function WizardDuel({ attacker, defender, subject }) {
  const T = useT();
  const fightPickQuestion = useGameStore((s) => s.fightPickQuestion);
  const fightMatchWin = useGameStore((s) => s.fightMatchWin);

  const [beam, setBeam] = useState(() => createBeam());
  const [question, setQuestion] = useState(null);
  const [locked, setLocked] = useState({ attacker: false, defender: false });
  const [resolved, setResolved] = useState(false); // camp gagnant de la question
  const [push, setPush] = useState(null); // { side, seq } → anim de poussée
  const [hit, setHit] = useState(null); // { side, seq } → anim d'impact
  const [over, setOver] = useState(false); // duel terminé (fige les entrées)
  const [noQuestion, setNoQuestion] = useState(false);

  // Garde de démontage : reset DANS le corps de l'effet (StrictMode simule
  // démontage + remontage de la même instance en dev).
  const dead = useRef(false);
  const seq = useRef(0);
  useEffect(() => {
    dead.current = false;
    return () => { dead.current = true; };
  }, []);

  // Tire une question ; repli propre si le pool est vide (pas de soft-lock).
  const serve = () => {
    const q = fightPickQuestion(subject);
    if (!q) { setNoQuestion(true); return; }
    setQuestion(q);
    setLocked({ attacker: false, defender: false });
    setResolved(false);
  };

  // Première question au montage (mémoïsée dans un effet — pas de random au rendu).
  useEffect(() => { serve(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ordres d'affichage indépendants par côté (anti-copie).
  const orders = useMemo(() => {
    if (!question) return null;
    const idx = question.a.map((_, i) => i);
    return { attacker: shuffle(idx), defender: shuffle(idx) };
  }, [question]);

  if (noQuestion) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontFamily: 'var(--font-display)' }}>
        {T('fight.wizard.noQuestion')}
        <button className="btn btn--ghost" style={{ marginTop: 14 }} onClick={() => !over && fightMatchWin('defender')}>
          {T('fight.quick.roundToDefender')}
        </button>
      </div>
    );
  }

  const handleTap = (side, answerIdx) => {
    if (over || resolved || locked[side] || !question) return;
    if (answerIdx === question.c) {
      // Bonne réponse rapide → pousse le sort vers l'adversaire.
      setResolved(true);
      soundCorrect();
      const next = pushBeam(beam, side);
      setBeam(next);
      seq.current += 1;
      setPush({ side, seq: seq.current });
      if (next.winner) {
        // L'orbe a touché le camp perdant → impact puis victoire.
        setOver(true);
        const loser = next.winner === 'attacker' ? 'defender' : 'attacker';
        seq.current += 1;
        setHit({ side: loser, seq: seq.current });
        setTimeout(() => { if (!dead.current) fightMatchWin(next.winner); }, HIT_MS);
      } else {
        // Manche gagnée mais duel en cours → nouvelle question.
        setTimeout(() => { if (!dead.current) serve(); }, 850);
      }
    } else {
      // Mauvaise réponse → la baguette de ce camp s'enraye brièvement.
      soundWrong();
      setLocked((l) => ({ ...l, [side]: true }));
      setTimeout(() => { if (!dead.current) setLocked((l) => ({ ...l, [side]: false })); }, LOCK_MS);
    }
  };

  const renderSide = (side, team) => {
    const isLocked = locked[side];
    const disabled = over || resolved || isLocked;
    return (
      <div
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '10px 12px',
          background: `linear-gradient(180deg, ${team.color}26, ${team.color}0d)`,
          borderTop: `4px solid ${team.color}`,
          borderRadius: 14,
          opacity: isLocked ? 0.55 : 1,
          transition: 'opacity 200ms ease',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <TeamAvatar team={team} size={28} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: team.color }}>{team.name}</span>
        </div>
        {isLocked && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: 20, color: '#c9472f',
            background: 'rgba(255,255,255,0.5)', borderRadius: 14, zIndex: 2, textAlign: 'center', padding: 8,
          }}>
            {T('fight.wizard.locked')}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1, justifyContent: 'center' }}>
          {orders[side].map((answerIdx) => {
            const showResult = resolved && answerIdx === question.c;
            return (
              <button
                key={answerIdx}
                onPointerDown={() => handleTap(side, answerIdx)}
                disabled={disabled}
                style={{
                  padding: '12px 14px', borderRadius: 12,
                  border: showResult ? '3px solid #5b8c3a' : '2px solid rgba(150,120,200,0.3)',
                  background: showResult ? '#d1f0b8' : '#fffefb',
                  fontFamily: 'var(--font-ui)', fontSize: 15, fontWeight: 500,
                  textAlign: 'left', cursor: disabled ? 'default' : 'pointer',
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {/* La scène : le spectacle du beam struggle */}
      <div style={{ flex: '0 0 42%', minHeight: 150 }}>
        <WizardBeam attacker={attacker} defender={defender} pos={beam.pos} push={push} hit={hit} />
      </div>

      {/* L'énoncé partagé */}
      {question && (
        <div style={{
          padding: '10px 20px', borderRadius: 14, textAlign: 'center',
          background: 'rgba(255,254,251,0.95)',
          fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        }}>
          {question.q}
        </div>
      )}

      {/* Les deux zones de réponse */}
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {orders && renderSide('attacker', attacker)}
        {orders && renderSide('defender', defender)}
      </div>

      <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-ui)' }}>
        {T('fight.wizard.hint')}
      </div>
    </div>
  );
}
