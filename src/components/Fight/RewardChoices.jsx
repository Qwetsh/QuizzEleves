// Cartes de choix de récompense d'un duel (Piller / Repousser / Butin).
// Présentationnel et partagé par les DEUX surfaces :
//   - écran partagé / TV (RewardScreen, variante parchemin, dark=false) ;
//   - téléphone / en ligne (DuelRaceView, variante sombre, dark=true).
// Le code couleur porte le SENS de la récompense : or = pièces, rose =
// agression, violet = trésor. Le composant est « bête » : les libellés
// (name/tag) sont fournis par l'appelant (i18n côté FightModal, littéraux
// côté DuelRaceView) — aucun couplage i18n ici.
import { motion } from 'framer-motion';

export const REWARD_ACCENTS = {
  steal:     { icon: '💰', from: '#f7d379', to: '#c68a1f', ring: 'rgba(138,95,26,0.85)', glow: 'rgba(224,164,88,0.55)' },
  knockback: { icon: '⬅️', from: '#ef7a84', to: '#c9472f', ring: 'rgba(138,40,32,0.85)', glow: 'rgba(201,71,47,0.50)' },
  loot:      { icon: '🎒', from: '#b48be6', to: '#7c3aed', ring: 'rgba(60,25,110,0.85)',  glow: 'rgba(124,58,237,0.50)' },
};

export function RewardCard({ rw, name, tag, onClick, dark = false, delay = 0 }) {
  const a = REWARD_ACCENTS[rw] || REWARD_ACCENTS.steal;
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', damping: 18, stiffness: 220 }}
      whileHover={{ y: -3 }}
      whileTap={{ y: 2, scale: 0.99 }}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14, width: '100%',
        textAlign: 'left', cursor: 'pointer', border: 'none',
        padding: '13px 16px', borderRadius: 16,
        background: dark
          ? 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(0,0,0,0.18))'
          : 'linear-gradient(180deg, #fffdf7, #f6ead2)',
        // Liseré de couleur à gauche (inset → respecte le border-radius) + relief 3D « juteux ».
        boxShadow: dark
          ? `inset 6px 0 0 0 ${a.to}, inset 0 0 0 1px rgba(255,255,255,0.08), 0 4px 0 rgba(0,0,0,0.45)`
          : `inset 6px 0 0 0 ${a.to}, inset 0 0 0 1px rgba(122,94,58,0.14), 0 4px 0 ${a.ring}, 0 9px 20px rgba(46,31,16,0.14)`,
      }}
    >
      {/* Médaillon d'icône teinté */}
      <span
        aria-hidden
        style={{
          flexShrink: 0, width: 52, height: 52, borderRadius: '50%',
          display: 'grid', placeItems: 'center', fontSize: 27,
          background: `radial-gradient(circle at 32% 28%, ${a.from}, ${a.to} 72%)`,
          boxShadow: `inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -3px 0 rgba(0,0,0,0.22), 0 0 16px ${a.glow}`,
        }}
      >
        {a.icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontFamily: 'var(--font-display)', fontSize: 21,
          letterSpacing: '0.03em', lineHeight: 1.05,
          color: dark ? '#fff' : a.to,
        }}>{name}</span>
        <span style={{
          display: 'block', fontFamily: 'var(--font-ui)', fontSize: 13, marginTop: 3,
          color: dark ? '#c2ccd2' : 'var(--ink-600)',
        }}>{tag}</span>
      </span>
      <span aria-hidden style={{ fontSize: 26, fontWeight: 700, color: dark ? a.from : a.to, opacity: 0.7 }}>›</span>
    </motion.button>
  );
}
