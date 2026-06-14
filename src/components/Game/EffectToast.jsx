import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';

// Toast animé affiché quand un effet d'objet s'active (impact visuel).
function Toast({ toast, onDone }) {
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(onDone, reduce ? 1100 : 1900);
    return () => clearTimeout(t);
    // dépend de l'id (stable) et non de onDone (recréé à chaque render parent),
    // sinon le minuteur de disparition se ré-arme sans fin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.4, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -24 }}
      transition={{ type: 'spring', damping: 14, stiffness: 240 }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 22px 12px 14px', borderRadius: 999,
        background: 'linear-gradient(180deg, #fffefb, #f3ead4)',
        border: `3px solid ${toast.color}`,
        boxShadow: `0 8px 22px rgba(0,0,0,0.35), 0 0 22px ${toast.color}66`,
        fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)',
        pointerEvents: 'none',
      }}
    >
      <motion.span
        initial={{ rotate: -20, scale: 0.5 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 8, stiffness: 200, delay: 0.05 }}
        style={{
          fontSize: 30, width: 46, height: 46, borderRadius: '50%',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          background: `radial-gradient(circle at 35% 30%, ${toast.color}33, ${toast.color}22)`,
          boxShadow: `inset 0 0 0 2px ${toast.color}55`,
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
        }}
      >
        {toast.icon}
      </motion.span>
      <span style={{ paddingRight: 4 }}>{toast.text}</span>
    </motion.div>
  );
}

export default function EffectToast() {
  const effectToasts = useGameStore((s) => s.effectToasts);
  const dismissFx = useGameStore((s) => s.dismissFx);

  return (
    <div style={{
      position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
      zIndex: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      pointerEvents: 'none',
    }}>
      <AnimatePresence>
        {(effectToasts || []).map((toast) => (
          <Toast key={toast.id} toast={toast} onDone={() => dismissFx(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}
