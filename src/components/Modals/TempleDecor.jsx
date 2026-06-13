// Décor « Temple moussu » partagé entre les grands panneaux pleine page
// (inventaire, boutique) : brins de feuillage SVG procéduraux qui débordent
// du cadre de pierre, runes gravées pour les médaillons, et TemplePanel —
// le chrome complet (overlay, mise à l'échelle, plaque-titre, fanion
// d'équipe, bourse, accessibilité) dont chaque modale ne fournit que
// l'intérieur.
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { soundClick } from '../../logic/sounds';

/* ---------- Brin de feuillage (SVG procédural, porté du design) ---------- */
export function Sprig({ x, y, rot = 0, size = 110, leaves = 6, spread = 150, flower = null, flip = false, className = '' }) {
  const L = [];
  for (let i = 0; i < leaves; i++) {
    const a = -spread / 2 + (spread * i) / Math.max(1, leaves - 1);
    const len = 0.66 + 0.34 * Math.sin((i / Math.max(1, leaves - 1)) * Math.PI);
    const c = ['a', 'b', 'c'][i % 3];
    L.push(
      <path
        key={i}
        d="M0 0 C-9 -20 -7 -44 0 -60 C7 -44 9 -20 0 0 Z"
        fill={`var(--leaf-${c})`}
        transform={`rotate(${a}) scale(${len.toFixed(2)})`}
      />
    );
  }
  return (
    <svg
      className={'inv-sprig ' + className}
      viewBox="-62 -66 124 72"
      style={{
        left: x, top: y, width: size,
        transform: `translate(-50%,-50%) rotate(${rot}deg)` + (flip ? ' scaleX(-1)' : ''),
      }}
    >
      <g transform="translate(0,3)">{L}</g>
      {flower && (
        <g transform="translate(0,-26)">
          {[0, 72, 144, 216, 288].map((p) => (
            <ellipse key={p} cx="0" cy="-9" rx="5.5" ry="9" fill={flower} transform={`rotate(${p})`} />
          ))}
          <circle r="4.5" fill="#f3c969" />
        </g>
      )}
    </svg>
  );
}

/* ---------- Rune gravée (médaillon de l'inventaire) ---------- */
export function Rune() {
  return (
    <svg viewBox="0 0 64 64">
      <path
        d="M18 46 L46 46 L46 18 L26 18 L26 38 L38 38 L38 28"
        fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square"
      />
    </svg>
  );
}

/* ---------- Rune-pièce (médaillon de la boutique) ---------- */
export function CoinRune() {
  return (
    <svg viewBox="0 0 64 64">
      <circle cx="32" cy="32" r="23" fill="none" stroke="currentColor" strokeWidth="6" />
      <path d="M32 21 L41 32 L32 43 L23 32 Z" fill="currentColor" />
    </svg>
  );
}

/* ---------- Panneau temple complet ---------- */

// Feuillage débordant du cadre (positions en % du panneau)
const FOLIAGE = [
  { x: '13%', y: '0%', rot: -14, size: 125, leaves: 7 },
  { x: '27%', y: '-0.5%', rot: 9, size: 95, leaves: 5, flower: '#d878c0' },
  { x: '69%', y: '-0.5%', rot: -7, size: 100, leaves: 6, flower: '#efe9d4' },
  { x: '86%', y: '0.5%', rot: 13, size: 118, leaves: 7 },
  { x: '0.5%', y: '30%', rot: -82, size: 112, leaves: 6 },
  { x: '0.5%', y: '62%', rot: -96, size: 92, leaves: 5, flower: '#efe9d4' },
  { x: '99.5%', y: '36%', rot: 84, size: 116, leaves: 6, flower: '#e0852f' },
  { x: '99.5%', y: '68%', rot: 97, size: 100, leaves: 6, flower: '#b66bd9' },
  { x: '9%', y: '99.5%', rot: -152, size: 112, leaves: 6 },
  { x: '89%', y: '99.5%', rot: 153, size: 106, leaves: 6, flower: '#d878c0' },
];

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Chrome complet d'un panneau « Temple moussu » plein écran : overlay,
 * animation d'ouverture, mise à l'échelle 1080x850, feuillage, plaque-titre,
 * fanion d'équipe, médaillon, bouton fermer, ornement bas et bourse.
 * Accessibilité : role=dialog, Échap, focus initial, piège Tab, restauration
 * du focus à la fermeture (parité avec ModalOverlay).
 * À monter dans un <AnimatePresence> ; children = l'intérieur du cadre.
 */
export function TemplePanel({ title, team, onClose, medallion, className = '', onBackdropPointerDown, children }) {
  // Mise à l'échelle : le panneau fait 1080x850 (+ plaques débordantes)
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const compute = () => setScale(Math.min(1, (window.innerWidth - 24) / 1100, (window.innerHeight - 24) / 930));
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  // Focus initial dans le panneau + restauration à la fermeture
  const dialogRef = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const raf = requestAnimationFrame(() => {
      dialogRef.current?.querySelector(FOCUSABLE)?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      if (typeof prev?.focus === 'function') prev.focus();
    };
  }, []);

  // Échap ferme ; Tab reste piégé dans le panneau
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') { onClose?.(); return; }
    if (e.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll(FOCUSABLE) || []);
    if (!focusable.length) { e.preventDefault(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, [onClose]);

  return (
    <motion.div
      className="inv-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onKeyDown={onKeyDown}
      onPointerDown={onBackdropPointerDown || ((e) => { if (e.target === e.currentTarget) onClose?.(); })}
    >
      <motion.div
        initial={{ scale: 0.82, y: 26 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', damping: 18, stiffness: 220 }}
      >
        <div ref={dialogRef} className={'inv' + (className ? ' ' + className : '')} style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>
          <div className="inv-frame">
            {children}

            {/* Décor par-dessus le cadre */}
            {FOLIAGE.map((f, i) => (
              <Sprig key={i} {...f} />
            ))}
            <div className="inv-plaque">
              <span className="dia">◆</span>
              <span className="inv-plaque-text">{title}</span>
              <span className="dia">◆</span>
            </div>
            <div className="inv-teamtag" style={{ '--team': team.color }}>
              {team.emoji} {team.name}
            </div>
            <div className="inv-medallion">{medallion}</div>
            <button className="inv-close" onClick={() => { soundClick(); onClose?.(); }} aria-label="Fermer">✕</button>
            <div className="inv-foot">{medallion}</div>
            <div className="inv-money">
              <span className="coin" style={{ filter: 'brightness(1.1)' }} />
              <span>{team.money ?? 0}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
