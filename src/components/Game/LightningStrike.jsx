import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

// Overlay transitoire centré sur le pion d'une équipe :
//  - vfx.type 'lightning' : éclair + flash blanc/bleu (Foudre)
//  - vfx.type 'shield'    : flash bleu/cyan + onde (Bouclier qui absorbe un recul)
// Déclenché par le champ store `vfx = { type, teamIndex, id }`, puis nettoyé.
export default function LightningStrike() {
  const vfx = useGameStore((s) => s.vfx);
  const clearVfx = useGameStore((s) => s.clearVfx);
  const [strike, setStrike] = useState(null);

  useEffect(() => {
    if (!vfx || (vfx.type !== 'lightning' && vfx.type !== 'shield')) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isShield = vfx.type === 'shield';

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

    // Trajet en zig-zag du haut de l'écran jusqu'à la cible (éclair seulement).
    const segs = 9;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const jitter = i === 0 || i === segs ? 0 : (Math.sin(i * 2.3) * 22 + (Math.random() - 0.5) * 30) * (1 - t * 0.3);
      pts.push(`${tx + jitter},${t * ty}`);
    }

    setStrike({ id: vfx.id ?? 0, tx, ty, points: pts.join(' '), reduce, isShield });
    const timer = setTimeout(() => {
      setStrike(null);
      clearVfx();
    }, reduce ? 350 : (isShield ? 600 : 750));
    return () => clearTimeout(timer);
  }, [vfx?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!strike) return null;

  const sh = strike.isShield;
  // Flash localisé : bleu/cyan pour le bouclier, blanc/bleu pour la foudre.
  const flashBg = sh
    ? 'radial-gradient(circle at ' + strike.tx + 'px ' + strike.ty + 'px, rgba(150,220,255,0.9), rgba(90,160,255,0.4) 28%, rgba(60,110,220,0.12) 55%, transparent 70%)'
    : 'radial-gradient(circle at ' + strike.tx + 'px ' + strike.ty + 'px, rgba(255,255,255,0.95), rgba(210,225,255,0.5) 30%, rgba(120,150,220,0.15) 60%, transparent 75%)';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 250, pointerEvents: 'none', overflow: 'hidden' }}>
      <style>{`
        @keyframes lk-flash { 0% { opacity: 0; } 8% { opacity: 0.85; } 22% { opacity: 0.1; } 30% { opacity: 0.6; } 100% { opacity: 0; } }
        @keyframes lk-bolt { 0% { opacity: 0; } 6% { opacity: 1; } 16% { opacity: 0.3; } 26% { opacity: 1; } 60% { opacity: 0.9; } 100% { opacity: 0; } }
        @keyframes lk-ring { 0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0.9; } 100% { transform: translate(-50%,-50%) scale(2.6); opacity: 0; } }
        @keyframes lk-shield { 0% { transform: translate(-50%,-50%) scale(0.4); opacity: 0; } 25% { opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .lk-flash { animation-duration: 300ms !important; }
        }
      `}</style>

      {/* Flash localisé */}
      <div
        className="lk-flash"
        style={{
          position: 'absolute', inset: 0,
          background: flashBg,
          animation: `lk-flash ${strike.reduce ? 300 : (sh ? 450 : 600)}ms ease-out forwards`,
        }}
      />

      {/* Bouclier : disque bleu pulsé sur le pion (pas d'éclair) */}
      {sh && (
        <div
          style={{
            position: 'absolute', left: strike.tx, top: strike.ty,
            width: 96, height: 96, borderRadius: '50%',
            display: 'grid', placeItems: 'center', fontSize: 44,
            border: '4px solid rgba(150,210,255,0.95)',
            boxShadow: '0 0 34px rgba(110,170,255,0.85), inset 0 0 22px rgba(150,210,255,0.6)',
            background: 'radial-gradient(circle, rgba(120,180,255,0.35), transparent 70%)',
            animation: `lk-shield ${strike.reduce ? 350 : 600}ms ease-out forwards`,
          }}
        >🛡️</div>
      )}

      {!strike.reduce && !sh && (
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

      {/* Onde d'impact à la cible (foudre) */}
      {!sh && (
        <div
          style={{
            position: 'absolute', left: strike.tx, top: strike.ty,
            width: 90, height: 90, borderRadius: '50%',
            border: '4px solid rgba(200,220,255,0.9)',
            boxShadow: '0 0 30px rgba(150,180,255,0.8)',
            animation: `lk-ring ${strike.reduce ? 350 : 600}ms ease-out forwards`,
          }}
        />
      )}
    </div>
  );
}
