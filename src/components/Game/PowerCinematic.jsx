import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import '../../styles/power-fx.css';

// Cinematiques d'IDENTITE des pouvoirs, ancrees sur la carte d'une equipe dans la
// bande du bas (HUD). Pilote par le canal store `powerFx` (liste MULTI-cibles :
// un Sablier qui frappe « toutes les autres » emet une entree par victime).
// Chaque entree { id, type, teamIndex, color } est rendue puis auto-retiree.
//
// Extensible : un nouveau `type` = un nouveau rendu ci-dessous (Double, Indice...).
// Pour l'instant : 'sablier' = horloge qui se materialise, fait tic-tac, puis se
// deregle (aiguilles emballees + felures + secousse + effondrement).

// Graduations du cadran (12), les heures plus marquees. viewBox 0..100.
const CX = 50, CY = 50;
const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 - 90) * (Math.PI / 180);
  const isH = i % 3 === 0;
  const r1 = 46, r2 = isH ? 38 : 42;
  return {
    isH,
    x1: CX + r1 * Math.cos(a), y1: CY + r1 * Math.sin(a),
    x2: CX + r2 * Math.cos(a), y2: CY + r2 * Math.sin(a),
  };
});
// Felures qui surgissent au deraillement (tracees l'une apres l'autre).
const CRACKS = [
  'M50 50 L70 30 L74 16',
  'M50 50 L32 40 L18 44',
  'M50 50 L58 74 L52 88',
];

function clockGeometry(teamIndex) {
  const el = document.querySelectorAll('.ts-card')[teamIndex];
  const r = el && el.getBoundingClientRect();
  if (!r) {
    return { cx: window.innerWidth / 2, cy: window.innerHeight - 90, d: 96 };
  }
  return {
    cx: r.left + r.width / 2,
    cy: r.top + r.height / 2,
    d: Math.round(Math.max(70, Math.min(132, Math.min(r.width, r.height) * 0.62))),
  };
}

function SablierClock({ inst, onDone }) {
  const [geo, setGeo] = useState(null);
  // Variante POSITIVE (sablier lance sur soi) : l'horloge se remonte au lieu de
  // casser. Pilotee par la classe pfx-boost (cf. power-fx.css).
  const boost = inst.type === 'sablierSelf';

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setGeo(clockGeometry(inst.teamIndex));
    const id = setTimeout(onDone, reduce ? 1000 : (boost ? 1980 : 2380));
    return () => clearTimeout(id);
  }, [inst.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!geo) return null;
  return (
    <div className="pfx-root" style={{ '--pfx-color': inst.color }}>
      <div className={`pfx-clock${boost ? ' pfx-boost' : ''}`} style={{ left: geo.cx, top: geo.cy, '--d': `${geo.d}px` }}>
        <div className="pfx-glow" />
        <div className="pfx-shake">
          <svg className="pfx-face" viewBox="0 0 100 100">
            <circle className="pfx-rim" cx="50" cy="50" r="47" />
            <circle className="pfx-rim-inner" cx="50" cy="50" r="43" />
            {TICKS.map((t, i) => (
              <line key={i} className={`pfx-tick${t.isH ? ' pfx-tick--h' : ''}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
            ))}
            {CRACKS.map((d, i) => (
              <path key={i} className="pfx-crack" d={d} pathLength="1" style={{ animationDelay: `${1150 + i * 170}ms` }} />
            ))}
          </svg>
          <div className="pfx-hand pfx-hour" />
          <div className="pfx-hand pfx-min" />
          <div className="pfx-hand pfx-sec" />
          <div className="pfx-center" />
        </div>
      </div>
    </div>
  );
}

// DOUBLE : un « ❓ » se materialise sur la carte, se dedouble et essaime des
// copies fantomes en echo (questions imposees qui se multiplient).
const DBL_ECHOES = 6;
function DoubleEcho({ inst, onDone }) {
  const [pos, setPos] = useState(null);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const el = document.querySelectorAll('.ts-card')[inst.teamIndex];
    const r = el && el.getBoundingClientRect();
    setPos(r
      ? { cx: r.left + r.width / 2, cy: r.top + r.height / 2, d: Math.round(Math.max(56, Math.min(112, Math.min(r.width, r.height) * 0.5))) }
      : { cx: window.innerWidth / 2, cy: window.innerHeight - 90, d: 84 });
    const id = setTimeout(onDone, reduce ? 1000 : 1740);
    return () => clearTimeout(id);
  }, [inst.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!pos) return null;
  return (
    <div className="pdbl-root" style={{ '--pfx-color': inst.color }}>
      <div className="pdbl" style={{ left: pos.cx, top: pos.cy, fontSize: `${pos.d}px` }}>
        {Array.from({ length: DBL_ECHOES }).map((_, i) => {
          const a = (i / DBL_ECHOES) * Math.PI * 2;
          return (
            <span
              key={i}
              className="pdbl-echo"
              style={{
                '--dx': `${Math.cos(a) * pos.d * 0.95}px`,
                '--dy': `${Math.sin(a) * pos.d * 0.95}px`,
                animationDelay: `${220 + (i % 3) * 150}ms`,
              }}
            >❓</span>
          );
        })}
        <span className="pdbl-core">❓</span>
      </div>
    </div>
  );
}

const RENDERERS = { sablier: SablierClock, sablierSelf: SablierClock, double: DoubleEcho };

export default function PowerCinematic() {
  const powerFx = useGameStore((s) => s.powerFx) || [];
  const clearPowerFx = useGameStore((s) => s.clearPowerFx);
  if (!powerFx.length) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 252, pointerEvents: 'none', overflow: 'hidden' }}>
      {powerFx.map((inst) => {
        const Renderer = RENDERERS[inst.type];
        return Renderer ? <Renderer key={inst.id} inst={inst} onDone={() => clearPowerFx(inst.id)} /> : null;
      })}
    </div>
  );
}
