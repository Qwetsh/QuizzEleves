import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { soundCorrect, soundClick } from '../../../logic/sounds';
import { useT } from '../../../i18n';

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
 * - scoreFn(metricValue) -> number (optionnel) : mode POINTS façon GeoGuessr —
 *   chaque équipe marque à chaque manche, pas d'égalité rejouée
 * - onRoundEnd({ winner, dA, dB, pA, pB }) (optionnel) : remplace l'appel
 *   direct à onRoundWin au clic sur Suivant (utilisé par le mode points)
 */
export default function PlacementDuel({
  attacker, defender, round, onRoundWin,
  pickTarget, renderScene, aspect = 1, formatDistance, metric,
  scoreFn, onRoundEnd,
}) {
  const T = useT();
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
    // Mode manches : egalite parfaite = on rejoue. Mode points : on marque quand meme.
    if (dA === dB && !scoreFn) {
      setReveal({ tie: true });
      setTimeout(startRound, 2000);
      return;
    }
    const winner = dA < dB ? 'attacker' : dB < dA ? 'defender' : null;
    setReveal({
      winner, dA, dB,
      pA: scoreFn ? scoreFn(dA) : null,
      pB: scoreFn ? scoreFn(dB) : null,
    });
    soundCorrect();
  }, [validated]);

  // Passage manuel a la manche suivante (bouton Suivant de la revelation)
  const nextRound = () => {
    if (!reveal || reveal.tie || reported.current) return;
    reported.current = true;
    if (onRoundEnd) onRoundEnd(reveal);
    else onRoundWin(reveal.winner);
  };

  if (!target) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontFamily: 'var(--font-display)' }}>
        {T('fight.placement.noTarget')}
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

  // Epingle a l'effigie de l'equipe : goutte coloree avec l'emoji dedans,
  // la pointe posee exactement sur le point choisi.
  const pin = (team, pos, hidden = false) => pos && (
    <div
      style={{
        position: 'absolute',
        left: `${pos.x * 100}%`, top: `${pos.y * 100}%`,
        transform: 'translate(-50%, -100%)',
        opacity: hidden ? 0 : 1,
        pointerEvents: 'none',
        transition: 'opacity 200ms ease',
        zIndex: 5,
        filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.45))',
      }}
    >
      <div
        style={{
          width: 32, height: 32,
          borderRadius: '50% 50% 50% 0',
          transform: 'rotate(-45deg)',
          background: team.color,
          border: '2.5px solid #fffefb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ transform: 'rotate(45deg)', fontSize: 16, lineHeight: 1 }}>{team.emoji}</span>
      </div>
    </div>
  );

  // Badge de distance pose au milieu du trait drapeau -> cible (revelation)
  const distanceBadge = (team, pos) => pos && (
    <div
      style={{
        position: 'absolute',
        left: `${((pos.x + target.x) / 2) * 100}%`,
        top: `${((pos.y + target.y) / 2) * 100}%`,
        transform: 'translate(-50%, -50%)',
        padding: '3px 10px', borderRadius: 999,
        background: 'rgba(255,254,251,0.95)',
        border: `2px solid ${team.color}`,
        fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--ink-900)',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 6,
        boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
      }}
    >
      {formatDistance(pos, target)}
    </div>
  );

  // --- Phase revelation : une grande scene commune ---
  if (reveal && !reveal.tie) {
    const winnerTeam = reveal.winner ? (reveal.winner === 'attacker' ? attacker : defender) : null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%', alignItems: 'center' }}>
        <div style={banner()}>
          {'\u{1F3AF}'} {target.label} — {winnerTeam ? (
            <><strong style={{ color: winnerTeam.color }}>{winnerTeam.emoji} {winnerTeam.name}</strong> {T('fight.placement.winnerNote')}</>
          ) : (
            <strong>{T('fight.placement.perfectTie')}</strong>
          )}
        </div>
        <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ position: 'relative', aspectRatio: String(aspect), maxWidth: '100%', maxHeight: '100%', borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {renderScene()}
            {/* traits pointilles drapeau -> cible */}
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 4 }}
            >
              <line
                x1={marks.attacker.x * 100} y1={marks.attacker.y * 100}
                x2={target.x * 100} y2={target.y * 100}
                stroke={attacker.color} strokeWidth="0.45" strokeDasharray="1.6 1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round"
                style={{ strokeWidth: 2.5 }}
              />
              <line
                x1={marks.defender.x * 100} y1={marks.defender.y * 100}
                x2={target.x * 100} y2={target.y * 100}
                stroke={defender.color} strokeWidth="0.45" strokeDasharray="1.6 1.2" vectorEffect="non-scaling-stroke" strokeLinecap="round"
                style={{ strokeWidth: 2.5 }}
              />
            </svg>
            {/* cible */}
            <motion.div
              initial={{ scale: 3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              style={{
                position: 'absolute', left: `${target.x * 100}%`, top: `${target.y * 100}%`,
                transform: 'translate(-50%, -50%)', fontSize: 24, pointerEvents: 'none', zIndex: 5,
                filter: 'drop-shadow(0 0 6px rgba(243,201,105,0.9))',
              }}
            >
              {'⭐'}
            </motion.div>
            {pin(attacker, marks.attacker)}
            {pin(defender, marks.defender)}
            {distanceBadge(attacker, marks.attacker)}
            {distanceBadge(defender, marks.defender)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', fontFamily: 'var(--font-ui)', fontSize: 14, color: '#fff', flexWrap: 'wrap', justifyContent: 'center' }}>
          <span>
            {attacker.emoji} {attacker.name} : <strong>{formatDistance(marks.attacker, target)}</strong>
            {reveal.pA != null && <strong style={{ color: '#f3c969' }}>{' +' + T('fight.geo.points', { n: reveal.pA.toLocaleString(T.lang === 'en' ? 'en-US' : 'fr-FR') })}</strong>}
          </span>
          <span>
            {defender.emoji} {defender.name} : <strong>{formatDistance(marks.defender, target)}</strong>
            {reveal.pB != null && <strong style={{ color: '#f3c969' }}>{' +' + T('fight.geo.points', { n: reveal.pB.toLocaleString(T.lang === 'en' ? 'en-US' : 'fr-FR') })}</strong>}
          </span>
          <button className="btn btn--green" onPointerDown={nextRound} style={{ padding: '8px 22px' }}>
            {T('fight.placement.next')}
          </button>
        </div>
      </div>
    );
  }

  if (reveal?.tie) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#fff', fontFamily: 'var(--font-display)', fontSize: 22 }}>
        {T('fight.placement.tieNewTarget')}
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
            {pin(team, marks[key], done)}
            {done && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(255,254,251,0.72)',
                fontFamily: 'var(--font-display)', fontSize: 20, color: '#2f5a18',
              }}>
                {T('fight.placement.validated')}
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
          {done ? T('fight.placement.waitingOpponent') : T('fight.placement.validatePlacement')}
        </button>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={banner()}>
        {target.photo ? (
          <>
            {/* Mode devinette : la photo SANS le nom du lieu */}
            <img
              src={target.photo}
              alt={T('fight.placement.mysteryAlt')}
              draggable={false}
              style={{
                height: 130, maxWidth: '90%', borderRadius: 10, objectFit: 'cover',
                display: 'block', margin: '0 auto 6px',
                boxShadow: '0 3px 10px rgba(0,0,0,0.3)', userSelect: 'none',
              }}
            />
            <strong style={{ fontSize: 19 }}>
              {target.showName ? T('fight.placement.place', { label: target.label }) : T('fight.placement.whereIsThis')}
            </strong>
          </>
        ) : (
          <>{T('fight.placement.placePrefix')} <strong style={{ fontSize: 21 }}>{target.label}</strong></>
        )}
        <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2, fontFamily: 'var(--font-ui)' }}>
          {T('fight.placement.hint')}
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
