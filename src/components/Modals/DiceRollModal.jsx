import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import Dice3D from '../Game/Dice3D';
import TeamAvatar from '../TeamAvatar';
import { extOn } from '../../extensions/registry';
import { metierActive } from '../../logic/metier';
import { getDieFaces, faceEffects, clampFaceValue } from '../../logic/forge';
import { FORGE_EFFECTS } from '../../logic/forgeEffects';
import { buffValue, getEffectValue } from '../../logic/itemEffects';
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
  const T = useT();
  const showDiceModal = useGameStore((s) => s.showDiceModal);
  const diceValue = useGameStore((s) => s.diceValue);
  const teams = useGameStore((s) => s.teams);
  const currentTeam = useGameStore((s) => s.currentTeam);
  // Visuel forgeable pour TOUT le monde dès que Forge OU Métiers est active (un
  // non-forgeron peut avoir un dé forgé par un autre via la prestation de forgeage).
  const dieVisualOn = useGameStore((s) => extOn(s.extensions, 'forge') || metierActive(s.extensions));
  const completeDiceRoll = useGameStore((s) => s.completeDiceRoll);

  const [phase, setPhase] = useState('intro');

  const team = teams[currentTeam];
  const accent = team?.color || '#888';
  // Forge : le dé montre les faces forgées ; la face tirée (slot = diceValue)
  // donne la VALEUR de déplacement et l'effet à révéler (≠ adresse du slot).
  const faces = dieVisualOn && team ? getDieFaces(team) : null;
  const landed = faces && diceValue ? faces[((diceValue - 1) % 6 + 6) % 6] : null;
  // Cases réellement parcourues = valeur de face (bornée) + bonus de dé − malus de
  // dé, plancher 0 — IDENTIQUE à handleDiceResult, pour ne pas annoncer un nombre
  // de cases différent du déplacement effectif quand un buff/passif est actif.
  const faceVal = landed ? clampFaceValue(landed.value) : diceValue;
  const moveVal = team
    ? Math.max(0, faceVal + buffValue(team, 'diceBonus') - getEffectValue(team, 'diceMalus'))
    : faceVal;
  const landedIcons = faceEffects(landed).map((e) => FORGE_EFFECTS[e.type]?.icon).filter(Boolean);

  useEffect(() => {
    if (!showDiceModal) return;
    setPhase('intro');
    const timers = [];
    timers.push(setTimeout(() => { setPhase('rolling'); soundDice(); }, 350));
    timers.push(setTimeout(() => setPhase('reveal'), 350 + 1200));
    timers.push(setTimeout(() => setPhase('outro'), 350 + 1200 + 1100));
    timers.push(setTimeout(() => completeDiceRoll(), 350 + 1200 + 1100 + 280));
    return () => timers.forEach(clearTimeout);
    // `diceValue` dans les deps : une Relance (face Forge) change la valeur en
    // gardant la modale ouverte → la timeline d'animation redémarre (re-spin).
  }, [showDiceModal, diceValue]);

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
            <TeamAvatar team={team} size={40} />
          </div>
          <div className="dice-modal-team-info">
            <div className="dice-modal-team-kicker">{T('modal.dice.turnOf')}</div>
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
            <Dice3D value={diceValue} rolling={phase !== 'intro'} size={220} faces={faces} />
          </div>

          {(phase === 'reveal' || phase === 'outro') && (
            <div className="dice-modal-value-badge">
              <span className="dice-modal-value-num">{moveVal}</span>
              {landedIcons.length > 0 && <span style={{ fontSize: 22, marginLeft: 4 }}>{landedIcons.join('')}</span>}
            </div>
          )}
        </div>

        <div className="dice-modal-caption">
          {phase === 'intro' && <span className="dim">{T('modal.dice.preparing')}</span>}
          {phase === 'rolling' && (
            <span className="dice-modal-caption-roll">
              {Array.from(T('modal.dice.rolling')).map((ch, i) => (
                <span key={i}>{ch}</span>
              ))}
            </span>
          )}
          {(phase === 'reveal' || phase === 'outro') && (
            <div className="dice-modal-caption-reveal">
              <span className="dice-modal-caption-big">{moveVal === 1 ? T('modal.dice.oneSquare') : T('modal.dice.nSquares', { n: moveVal })}</span>
              <span className="dice-modal-caption-sub">{T('modal.dice.toTravel')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
