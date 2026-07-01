import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import '../../styles/curse-vfx.css';

// Overlay d'aura (malediction/bonus) qui frappe la carte d'une equipe dans la
// bande du bas (HUD). Pilote par le canal store `curseVfx` (liste MULTI-cibles :
// « maudire les autres groupes » emet une entree par victime, toutes jouees en
// meme temps). Chaque entree { id, teamIndex, icon, color, tone } est rendue
// puis auto-retiree via clearCurseVfx(id).
//
// Sequence : projectile depuis le centre -> impact en haut de la carte ->
// deux brins descendent les cotes et se rejoignent en bas -> sceau + icone.

// Construit deux demi-trajets de rectangle arrondi, partant tous deux du
// CENTRE-HAUT pour redescendre par un cote et se rejoindre au CENTRE-BAS.
function buildHalfPaths(rect) {
  const { x, y, w, h } = rect;
  const rad = Math.max(4, Math.min(16, w / 2, h / 2));
  const cx = x + w / 2;
  const right = [
    `M ${cx} ${y}`,
    `L ${x + w - rad} ${y}`,
    `A ${rad} ${rad} 0 0 1 ${x + w} ${y + rad}`,
    `L ${x + w} ${y + h - rad}`,
    `A ${rad} ${rad} 0 0 1 ${x + w - rad} ${y + h}`,
    `L ${cx} ${y + h}`,
  ].join(' ');
  const left = [
    `M ${cx} ${y}`,
    `L ${x + rad} ${y}`,
    `A ${rad} ${rad} 0 0 0 ${x} ${y + rad}`,
    `L ${x} ${y + h - rad}`,
    `A ${rad} ${rad} 0 0 0 ${x + rad} ${y + h}`,
    `L ${cx} ${y + h}`,
  ].join(' ');
  return { right, left };
}

function CurseInstance({ inst, onDone }) {
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Cartes de la bande du bas en ordre d'index d'equipe (memes selecteurs que
    // LightningStrike). Repli : un rectangle au bas-centre de l'ecran.
    const el = document.querySelectorAll('.ts-card')[inst.teamIndex];
    const r = el && el.getBoundingClientRect();
    const pad = 3; // la « ceinture » entoure legerement la carte
    const rect = r
      ? { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 }
      : { x: window.innerWidth / 2 - 90, y: window.innerHeight - 130, w: 180, h: 110 };

    const cx = rect.x + rect.w / 2;
    setGeo({
      paths: buildHalfPaths(rect),
      cx,
      topY: rect.y,
      botY: rect.y + rect.h,
      dx: window.innerWidth / 2 - cx,        // offset de depart de l'orbe (centre ecran)
      dy: window.innerHeight / 2 - rect.y,
    });

    const id = setTimeout(onDone, reduce ? 760 : 1780);
    return () => clearTimeout(id);
  }, [inst.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!geo) return null;
  const glowId = `cv-glow-${inst.id}`;
  return (
    <div className="cv-root" style={{ '--cv-color': inst.color }}>
      {/* 1. Projectile partant du centre de l'ecran vers le haut de la carte */}
      <div
        className="cv-orb"
        style={{ left: geo.cx, top: geo.topY, '--cv-dx': `${geo.dx}px`, '--cv-dy': `${geo.dy}px` }}
      >
        <span className="cv-orb-trail" />
        <span className="cv-orb-core" />
      </div>
      <div className="cv-impact" style={{ left: geo.cx, top: geo.topY }} />

      {/* 2. Brins qui ceinturent la carte et se rejoignent en bas */}
      <svg className="cv-svg" width="100%" height="100%">
        <defs>
          <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path className="cv-trace" d={geo.paths.right} pathLength="1" filter={`url(#${glowId})`} />
        <path className="cv-trace" d={geo.paths.left} pathLength="1" filter={`url(#${glowId})`} />
      </svg>

      {/* 3. Sceau + icone du debuff/bonus qui surgit en bas-centre */}
      <div className="cv-seal" style={{ left: geo.cx, top: geo.botY }}>
        <span className="cv-seal-ring" />
        <span className="cv-seal-icon">{inst.icon}</span>
      </div>
    </div>
  );
}

export default function CurseStrike() {
  const curseVfx = useGameStore((s) => s.curseVfx) || [];
  const clearCurseVfx = useGameStore((s) => s.clearCurseVfx);
  if (!curseVfx.length) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 251, pointerEvents: 'none', overflow: 'hidden' }}>
      {curseVfx.map((inst) => (
        <CurseInstance key={inst.id} inst={inst} onDone={() => clearCurseVfx(inst.id)} />
      ))}
    </div>
  );
}
