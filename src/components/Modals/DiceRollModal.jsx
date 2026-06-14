import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import Dice3D from '../Game/Dice3D';
import { soundDice } from '../../logic/sounds';
import '../../styles/dice-roll-modal.css';

function DustParticles({ active, count = 26 }) {
  const particles = useMemo(() =>
    Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const radius = 40 + Math.random() * 180;
      return {
        id: i,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        size: 4 + Math.random() * 8,
        delay: Math.random() * 600,
        duration: 900 + Math.random() * 800,
        kind: Math.random() > 0.6 ? 'spark' : 'dust',
      };
    }), [count]);

  if (!active) return null;
  return (
    <div className="dice-modal-particles dice-modal-particles--dust">
      {particles.map(p => (
        <span
          key={p.id}
          className={'dice-particle dice-particle--' + p.kind}
          style={{
            '--x': p.x + 'px',
            '--y': p.y + 'px',
            '--size': p.size + 'px',
            animationDelay: p.delay + 'ms',
            animationDuration: p.duration + 'ms',
          }}
        />
      ))}
    </div>
  );
}

function BurstParticles({ count = 42 }) {
  const particles = useMemo(() =>
    Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 180 + Math.random() * 260;
      return {
        id: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: 6 + Math.random() * 12,
        rot: Math.random() * 720 - 360,
        kind: i % 5 === 0 ? 'star' : (i % 3 === 0 ? 'coin' : 'confetti'),
        hue: Math.random() > 0.5 ? 'gold' : (Math.random() > 0.5 ? 'rose' : 'leaf'),
        delay: Math.random() * 120,
      };
    }), [count]);

  return (
    <div className="dice-modal-particles dice-modal-particles--burst">
      {particles.map(p => (
        <span
          key={p.id}
          className={'dice-burst dice-burst--' + p.kind + ' dice-burst--' + p.hue}
          style={{
            '--x': p.x + 'px',
            '--y': p.y + 'px',
            '--size': p.size + 'px',
            '--rot': p.rot + 'deg',
            animationDelay: p.delay + 'ms',
          }}
        />
      ))}
    </div>
  );
}

export default function DiceRollModal() {
  const showDiceModal = useGameStore((s) => s.showDiceModal);
  const diceValue = useGameStore((s) => s.diceValue);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  const completeDiceRoll = useGameStore((s) => s.completeDiceRoll);

  const [phase, setPhase] = useState('intro');

  const team = teams[currentTeam];
  const accent = team?.color || '#888';

  useEffect(() => {
    if (!showDiceModal) return;
    setPhase('intro');
    const timers = [];
    timers.push(setTimeout(() => { setPhase('rolling'); soundDice(); }, 350));
    timers.push(setTimeout(() => setPhase('reveal'), 350 + 1200));
    timers.push(setTimeout(() => setPhase('outro'), 350 + 1200 + 1100));
    timers.push(setTimeout(() => completeDiceRoll(), 350 + 1200 + 1100 + 280));
    return () => timers.forEach(clearTimeout);
  }, [showDiceModal]);

  if (!showDiceModal || !team || !diceValue) return null;

  return (
    <div className="dice-modal" data-phase={phase} style={{ '--team-accent': accent }}>
      <div className="dice-modal-bg">
        <div className="dice-modal-rays" />
        <div className="dice-modal-vignette" />
      </div>

      <DustParticles active={phase === 'rolling'} />
      {(phase === 'reveal' || phase === 'outro') && <BurstParticles />}

      <div className="dice-modal-stage">
        <div className="dice-modal-team">
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
            boxShadow: `inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.18), 0 0 12px ${accent}66`,
          }}>
            {team.emoji}
          </div>
          <div className="dice-modal-team-info">
            <div className="dice-modal-team-kicker">Tour de</div>
            <div className="dice-modal-team-name" style={{ color: accent }}>{team.name}</div>
          </div>
        </div>

        <div className="dice-modal-dice-stage">
          <div className="dice-modal-podium">
            <div className="dice-modal-podium-ring" />
            <div className="dice-modal-podium-ring is-outer" />
          </div>

          {(phase === 'reveal' || phase === 'outro') && (
            <>
              <div className="dice-modal-burst-ring" />
              <div className="dice-modal-burst-ring is-2" />
              <div className="dice-modal-burst-ring is-3" />
            </>
          )}

          <div className={'dice-modal-dice ' + (phase === 'reveal' || phase === 'outro' ? 'is-revealed' : '')}>
            <Dice3D value={diceValue} rolling={phase !== 'intro'} size={220} />
          </div>

          {(phase === 'reveal' || phase === 'outro') && (
            <div className="dice-modal-value-badge">
              <span className="dice-modal-value-num">{diceValue}</span>
            </div>
          )}
        </div>

        <div className="dice-modal-caption">
          {phase === 'intro' && <span className="dim">{`Pr\u00e9paration\u2026`}</span>}
          {phase === 'rolling' && (
            <span className="dice-modal-caption-roll">
              <span>L</span><span>e</span><span> </span>
              <span>d</span><span>{'\u00e9'}</span><span> </span>
              <span>t</span><span>o</span><span>u</span><span>r</span><span>n</span><span>o</span><span>i</span><span>e</span>
              <span>{'\u2026'}</span>
            </span>
          )}
          {(phase === 'reveal' || phase === 'outro') && (
            <div className="dice-modal-caption-reveal">
              <span className="dice-modal-caption-big">{diceValue === 1 ? '1 case' : `${diceValue} cases`}</span>
              <span className="dice-modal-caption-sub">{'\u00e0'} parcourir !</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
