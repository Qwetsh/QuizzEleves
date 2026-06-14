import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

// Overlay transitoire : un éclair frappe le pion de la cible quand la Foudre est lancée.
// Déclenché par le champ store `vfx = { type:'lightning', teamIndex, id }`, puis nettoyé.
export default function LightningStrike() {
  const vfx = useGameStore((s) => s.vfx);
  const clearVfx = useGameStore((s) => s.clearVfx);
  const [strike, setStrike] = useState(null);

  useEffect(() => {
    if (!vfx || vfx.type !== 'lightning') return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Localise la cible : pion du plateau en priorité, sinon carte de la bande du bas.
    const el =
      document.querySelector(`[data-pawn-idx="${vfx.teamIndex}"]`) ||
      document.querySelectorAll('.ts-card')[vfx.teamIndex];
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    if (el) {
      const r = el.getBoundingClientRect();
      tx = r.left + r.width / 2;
      ty = r.top + r.height / 2;
    }

    // Trajet en zig-zag du haut de l'écran jusqu'à la cible.
    const segs = 9;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const jitter = i === 0 || i === segs ? 0 : (Math.sin(i * 2.3) * 22 + (Math.random() - 0.5) * 30) * (1 - t * 0.3);
      pts.push(`${tx + jitter},${t * ty}`);
    }

    setStrike({ id: vfx.id ?? 0, tx, ty, points: pts.join(' '), reduce });
    const timer = setTimeout(() => {
      setStrike(null);
      clearVfx();
    }, reduce ? 350 : 750);
    return () => clearTimeout(timer);
  }, [vfx?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!strike) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{`
        @keyframes lk-flash { 0% { opacity: 0; } 8% { opacity: 0.85; } 22% { opacity: 0.1; } 30% { opacity: 0.6; } 100% { opacity: 0; } }
        @keyframes lk-bolt { 0% { opacity: 0; } 6% { opacity: 1; } 16% { opacity: 0.3; } 26% { opacity: 1; } 60% { opacity: 0.9; } 100% { opacity: 0; } }
        @keyframes lk-ring { 0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0.9; } 100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .lk-flash { animation-duration: 300ms !important; }
        }
      `}</style>

      {/* Flash plein écran */}
      <div
        className="lk-flash"
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(circle at ' + strike.tx + 'px ' + strike.ty + 'px, rgba(255,255,255,0.95), rgba(210,225,255,0.5) 30%, rgba(120,150,220,0.15) 60%, transparent 75%)',
          animation: `lk-flash ${strike.reduce ? 300 : 600}ms ease-out forwards`,
        }}
      />

      {!strike.reduce && (
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <filter id="lk-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* Halo large */}
          <polyline
            points={strike.points} fill="none" stroke="#bcd2ff" strokeWidth={11}
            strokeLinejoin="round" strokeLinecap="round" opacity={0.5}
            filter="url(#lk-glow)"
            style={{ animation: 'lk-bolt 700ms ease-out forwards' }}
          />
          {/* Cœur de l'éclair */}
          <polyline
            points={strike.points} fill="none" stroke="#ffffff" strokeWidth={4}
            strokeLinejoin="round" strokeLinecap="round"
            filter="url(#lk-glow)"
            style={{ animation: 'lk-bolt 700ms ease-out forwards' }}
          />
        </svg>
      )}

      {/* Onde d'impact à la cible */}
      <div
        style={{
          position: 'absolute', left: strike.tx, top: strike.ty,
          width: 90, height: 90, borderRadius: '50%',
          border: '4px solid rgba(200,220,255,0.9)',
          boxShadow: '0 0 30px rgba(150,180,255,0.8)',
          animation: `lk-ring ${strike.reduce ? 350 : 600}ms ease-out forwards`,
        }}
      />
    </div>
  );
}
