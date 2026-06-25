import { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

// Overlay transitoire centré sur le pion d'une équipe :
//  - vfx.type 'lightning' : éclair + flash blanc/bleu (Foudre)
//  - vfx.type 'shield'    : flash bleu/cyan + onde (Bouclier qui absorbe un recul)
//  - vfx.type 'trap'      : mâchoire 🪤 qui claque + onde rouge (Piège déclenché)
//  - vfx.type 'reflect'   : disque violet + ↩️ tournoyant (effet RENVOYÉ à l'attaquant)
// Déclenché par le champ store `vfx = { type, teamIndex, id }`, puis nettoyé.
const VFX_TYPES = ['lightning', 'shield', 'trap', 'reflect'];
export default function LightningStrike() {
  const vfx = useGameStore((s) => s.vfx);
  const clearVfx = useGameStore((s) => s.clearVfx);
  const [strike, setStrike] = useState(null);

  useEffect(() => {
    if (!vfx || !VFX_TYPES.includes(vfx.type)) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isShield = vfx.type === 'shield';
    const isTrap = vfx.type === 'trap';
    const isReflect = vfx.type === 'reflect';

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

    setStrike({ id: vfx.id ?? 0, tx, ty, points: pts.join(' '), reduce, isShield, isTrap, isReflect });
    const timer = setTimeout(() => {
      setStrike(null);
      clearVfx();
    }, reduce ? 380 : (isShield ? 600 : (isTrap ? 920 : (isReflect ? 780 : 750))));
    return () => clearTimeout(timer);
  }, [vfx?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!strike) return null;

  // Piège : claquement de mâchoire + secousse plein écran + vignette rouge.
  if (strike.isTrap) {
    return (
      <div className="tp-shake" style={{ position: 'fixed', inset: 0, zIndex: 250, pointerEvents: 'none', overflow: 'hidden', animation: strike.reduce ? 'none' : 'tp-shake 460ms cubic-bezier(.36,.07,.19,.97)' }}>
        <style>{`
          @keyframes tp-flash { 0% { opacity: 0; } 8% { opacity: 0.9; } 30% { opacity: 0.2; } 46% { opacity: 0.55; } 100% { opacity: 0; } }
          @keyframes tp-vignette { 0% { opacity: 0; } 12% { opacity: 1; } 55% { opacity: 0.4; } 100% { opacity: 0; } }
          @keyframes tp-snap { 0% { transform: translate(-50%,-50%) scale(0.15) rotate(-22deg); opacity: 0; }
                               16% { transform: translate(-50%,-50%) scale(1.7) rotate(10deg); opacity: 1; }
                               32% { transform: translate(-50%,-50%) scale(0.86) rotate(-6deg); }
                               48% { transform: translate(-50%,-50%) scale(1.18) rotate(3deg); }
                               66% { transform: translate(-50%,-50%) scale(0.98) rotate(-1deg); opacity: 1; }
                               100% { transform: translate(-50%,-50%) scale(1.06) rotate(0deg); opacity: 0; } }
          @keyframes tp-ring { 0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0.95; } 100% { transform: translate(-50%,-50%) scale(3.1); opacity: 0; } }
          @keyframes tp-ring2 { 0% { transform: translate(-50%,-50%) scale(0.2); opacity: 0; } 22% { opacity: 0.8; } 100% { transform: translate(-50%,-50%) scale(4.4); opacity: 0; } }
          @keyframes tp-shake { 0%,100% { transform: translate(0,0); } 12% { transform: translate(-9px,5px); } 24% { transform: translate(8px,-6px); } 38% { transform: translate(-7px,-4px); } 52% { transform: translate(6px,5px); } 68% { transform: translate(-4px,2px); } 84% { transform: translate(3px,-2px); } }
          @media (prefers-reduced-motion: reduce) { .tp-shake { animation: none !important; } }
        `}</style>

        {/* Vignette rouge sur tout l'écran (bords) */}
        <div style={{
          position: 'absolute', inset: 0,
          boxShadow: 'inset 0 0 160px 40px rgba(190,25,15,0.85), inset 0 0 60px 10px rgba(255,70,40,0.5)',
          animation: `tp-vignette ${strike.reduce ? 320 : 700}ms ease-out forwards`,
        }} />

        {/* Flash rouge localisé sur le pion */}
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at ${strike.tx}px ${strike.ty}px, rgba(255,100,70,0.92), rgba(210,45,30,0.45) 24%, rgba(150,20,12,0.14) 52%, transparent 70%)`,
          animation: `tp-flash ${strike.reduce ? 320 : 680}ms ease-out forwards`,
        }} />

        {/* Double onde d'impact rouge */}
        <div style={{
          position: 'absolute', left: strike.tx, top: strike.ty,
          width: 100, height: 100, borderRadius: '50%',
          border: '5px solid rgba(255,120,90,0.98)',
          boxShadow: '0 0 38px rgba(225,65,45,0.9)',
          animation: `tp-ring ${strike.reduce ? 360 : 640}ms ease-out forwards`,
        }} />
        {!strike.reduce && (
          <div style={{
            position: 'absolute', left: strike.tx, top: strike.ty,
            width: 100, height: 100, borderRadius: '50%',
            border: '3px solid rgba(255,170,120,0.7)',
            animation: 'tp-ring2 760ms ease-out forwards',
          }} />
        )}

        {/* Mâchoire du piège qui claque (centrée sur le pion) */}
        <div style={{
          position: 'absolute', left: strike.tx, top: strike.ty,
          fontSize: 104, lineHeight: 1,
          filter: 'drop-shadow(0 5px 12px rgba(120,8,0,0.8))',
          animation: `tp-snap ${strike.reduce ? 350 : 860}ms cubic-bezier(.2,.9,.2,1) forwards`,
        }}>🪤</div>
      </div>
    );
  }

  // Renvoi : disque violet pulsé + ↩️ qui tournoie sur le pion de la cible
  // (signale que l'effet a été retourné à l'attaquant).
  if (strike.isReflect) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 250, pointerEvents: 'none', overflow: 'hidden' }}>
        <style>{`
          @keyframes rf-flash { 0% { opacity: 0; } 12% { opacity: 0.7; } 100% { opacity: 0; } }
          @keyframes rf-ring { 0% { transform: translate(-50%,-50%) scale(0.3); opacity: 0.95; } 100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; } }
          @keyframes rf-spin { 0% { transform: translate(-50%,-50%) scale(0.4) rotate(0deg); opacity: 0; }
                               25% { transform: translate(-50%,-50%) scale(1.25) rotate(160deg); opacity: 1; }
                               100% { transform: translate(-50%,-50%) scale(1) rotate(360deg); opacity: 0; } }
        `}</style>
        <div style={{
          position: 'absolute', inset: 0,
          background: `radial-gradient(circle at ${strike.tx}px ${strike.ty}px, rgba(190,150,255,0.85), rgba(135,69,212,0.4) 30%, rgba(90,40,160,0.12) 58%, transparent 72%)`,
          animation: `rf-flash ${strike.reduce ? 320 : 620}ms ease-out forwards`,
        }} />
        <div style={{
          position: 'absolute', left: strike.tx, top: strike.ty,
          width: 92, height: 92, borderRadius: '50%',
          border: '4px solid rgba(190,150,255,0.95)',
          boxShadow: '0 0 30px rgba(150,90,235,0.85)',
          animation: `rf-ring ${strike.reduce ? 340 : 640}ms ease-out forwards`,
        }} />
        <div style={{
          position: 'absolute', left: strike.tx, top: strike.ty,
          fontSize: 64, lineHeight: 1,
          filter: 'drop-shadow(0 4px 10px rgba(90,40,160,0.8))',
          animation: `rf-spin ${strike.reduce ? 360 : 760}ms cubic-bezier(.2,.9,.2,1) forwards`,
        }}>↩️</div>
      </div>
    );
  }

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
