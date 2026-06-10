import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { soundCorrect, soundClick } from '../../../logic/sounds';

/**
 * Moteur de placement commit-reveal — partagé par L'Anatomiste (SVT)
 * et le GeoGuessr (géographie).
 *
 * Chaque équipe place un marqueur sur SA copie de la scène, puis VALIDE :
 * son marqueur se cache (anti-copiage temporel, les deux équipes sont
 * devant le même tableau). Quand les deux ont validé : révélation sur une
 * grande scène commune, le plus proche de la cible gagne la manche.
 *
 * Props :
 * - attacker, defender : équipes
 * - round : numéro de manche (le composant est persistant, reset sur changement)
 * - onRoundWin('attacker'|'defender')
 * - pickTarget(usedIds) -> { id, label, x, y } : cible suivante (coords 0..1)
 * - renderScene() : fond de scène (SVG/img) remplissant son conteneur
 * - aspect : ratio largeur/hauteur de la scène (ex. 2 pour la carte monde)
 * - formatDistance(a, b) -> string : distance affichée entre 2 points 0..1
 * - metric(a, b) -> number : distance servant à départager
 */
export default function PlacementDuel({
  attacker, defender, round, onRoundWin,
  pickTarget, renderScene, aspect = 1, formatDistance, metric,
}) {
  const usedIds = useRef([]);
  const reported = useRef(false);
  const [target, setTarget] = useState(null);
  const [marks, setMarks] = useState({ attacker: null, defender: null });
  const [validated, setValidated] = useState({ attacker: false, defender: false });
  const [reveal, setReveal] = useState(null); // { winner, dA, dB } | { tie: true }

  const startRound = () => {
    const t = pickTarget(usedIds.current);
    if (t) usedIds.current = [...usedIds.current, t.id];
    setTarget(t);
    setMarks({ attacker: null, defender: null });
    setValidated({ attacker: false, defender: false });
    setReveal(null);
    reported.current = false;
  };

  useEffect(() => { startRound(); }, [round]);

  // Revelation quand les deux ont valide
  useEffect(() => {
    if (!validated.attacker || !validated.defender || reveal || !target) return;
    const dA = metric(marks.attacker, target);
    const dB = metric(marks.defender, target);
    if (dA === dB) {
      setReveal({ tie: true });
      setTimeout(startRound, 2000);
      return;
    }
    const winner = dA < dB ? 'attacker' : 'defender';
    setReveal({ winner, dA, dB });
    soundCorrect();
    if (!reported.current) {
      reported.current = true;
      setTimeout(() => onRoundWin(winner), 3200);
    }
  }, [validated]);

  if (!target) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontFamily: 'var(--font-display)' }}>
        Plus de cible disponible…
      </div>
    );
  }

  const place = (side, e) => {
    if (validated[side] || reveal) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    soundClick();
    setMarks((prev) => ({ ...prev, [side]: { x, y } }));
  };

  const validate = (side) => {
    if (!marks[side] || validated[side]) return;
    soundClick();
    setValidated((prev) => ({ ...prev, [side]: true }));
  };

  const pin = (color, pos, hidden = false) => pos && (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x * 100}%`, top: `${pos.y * 100}%`,
        transform: 'translate(-50%, -100%)',
        fontSize: 26, lineHeight: 1,
        filter: `drop-shadow(0 2px 2px rgba(0,0,0,0.4))`,
        color,
        opacity: hidden ? 0 : 1,
        pointerEvents: 'none',
        transition: 'opacity 200ms ease',
      }}
    >
      <span style={{ WebkitTextStroke: `1.5px ${color}`, color }}>{'\u{1F4CD}'}</span>
    </div>
  );

  // --- Phase revelation : une grande scene commune ---
  if (reveal && !reveal.tie) {
    const winnerTeam = reveal.winner === 'attacker' ? attacker : defender;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', alignItems: 'center' }}>
        <div style={banner()}>
          {'\u{1F3AF}'} {target.label} — <strong style={{ color: winnerTeam.color }}>{winnerTeam.emoji} {winnerTeam.name}</strong> est au plus près !
        </div>
        <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', aspectRatio: String(aspect), maxWidth: '100%', maxHeight: '100%', borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {renderScene()}
            {/* cible */}
            <motion.div
              initial={{ scale: 3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              style={{
                position: 'absolute', left: `${target.x * 100}%`, top: `${target.y * 100}%`,
                transform: 'translate(-50%, -50%)', fontSize: 24, pointerEvents: 'none',
                filter: 'drop-shadow(0 0 6px rgba(243,201,105,0.9))',
              }}
            >
              {'⭐'}
            </motion.div>
            {pin(attacker.color, marks.attacker)}
            {pin(defender.color, marks.defender)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, fontFamily: 'var(--font-ui)', fontSize: 14, color: '#fff' }}>
          <span><span style={{ color: attacker.color }}>{'\u{1F4CD}'}</span> {attacker.name} : <strong>{formatDistance(marks.attacker, target)}</strong></span>
          <span><span style={{ color: defender.color }}>{'\u{1F4CD}'}</span> {defender.name} : <strong>{formatDistance(marks.defender, target)}</strong></span>
        </div>
      </div>
    );
  }

  if (reveal?.tie) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontFamily: 'var(--font-display)', fontSize: 22 }}>
        {'⚖️'} Égalité parfaite ! Nouvelle cible…
      </div>
    );
  }

  // --- Phase placement : deux scenes cote a cote ---
  const side = (key, team) => {
    const done = validated[key];
    return (
      <div
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '10px 12px',
          background: `linear-gradient(180deg, ${team.color}22, ${team.color}0d)`,
          borderTop: `4px solid ${team.color}`,
          borderRadius: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{team.emoji}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: team.color }}>{team.name}</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div
            onPointerDown={(e) => place(key, e)}
            style={{
              position: 'relative', aspectRatio: String(aspect),
              maxWidth: '100%', maxHeight: '100%', width: '100%',
              borderRadius: 12, overflow: 'hidden',
              cursor: done ? 'default' : 'crosshair',
              touchAction: 'manipulation',
              boxShadow: 'inset 0 0 0 2px rgba(122,94,58,0.25)',
            }}
          >
            {renderScene()}
            {pin(team.color, marks[key], done)}
            {done && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,254,251,0.72)',
                fontFamily: 'var(--font-display)', fontSize: 20, color: '#2f5a18',
              }}>
                {'✔'} Validé !
              </div>
            )}
          </div>
        </div>
        <button
          onPointerDown={() => validate(key)}
          disabled={!marks[key] || done}
          className="btn btn--green"
          style={{ opacity: !marks[key] || done ? 0.45 : 1, padding: '8px 14px' }}
        >
          {done ? 'En attente de l’adversaire…' : 'Valider mon placement'}
        </button>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={banner()}>
        Place : <strong style={{ fontSize: 21 }}>{target.label}</strong>
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2, fontFamily: 'var(--font-ui)' }}>
          Touche ta scène pour poser ton repère (ajustable), puis valide. Révélation quand les deux équipes ont validé !
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {side('attacker', attacker)}
        {side('defender', defender)}
      </div>
    </div>
  );
}

function banner() {
  return {
    padding: '10px 20px', borderRadius: 14, textAlign: 'center',
    background: 'rgba(255,254,251,0.95)',
    fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-900)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  };
}
