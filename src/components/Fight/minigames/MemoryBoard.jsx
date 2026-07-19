import { motion } from 'framer-motion';
import TeamAvatar from '../../TeamAvatar';

/**
 * Plateau Memory PRÉSENTATIONNEL (aucune logique de jeu) — partagé par les trois
 * surfaces : moteur tactile (MemoryGame), plateau TV en lecture seule
 * (MemoryDuelStage) et téléphone-manette (MemoryDuelView).
 *
 * Cartes normalisées : [{ key, text, owner, faceUp }]
 *   - owner  : 'attacker' | 'defender' | null  → carte capturée (colorée équipe)
 *   - faceUp : true si la carte est retournée MAINTENANT (visible, pas encore capturée)
 *   - text   : libellé (null tant que la carte est au dos — anti-triche téléphone)
 *
 * Retournement 3D réel (perspective + preserve-3d, deux faces backface-hidden) ;
 * une carte capturée prend la couleur de son équipe → avancée visible d'un coup.
 */
export default function MemoryBoard({ cards, attacker, defender, onFlip, locked }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gridAutoRows: '1fr', gap: 10, padding: 4 }}>
      {cards.map((card, idx) => {
        const ownerTeam = card.owner === 'attacker' ? attacker : card.owner === 'defender' ? defender : null;
        const revealed = card.faceUp || ownerTeam != null;
        const clickable = !!onFlip && !locked && !revealed;
        const faceStyle = {
          position: 'absolute', inset: 0, WebkitBackfaceVisibility: 'hidden', backfaceVisibility: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px',
          borderRadius: 12, overflow: 'hidden', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 4px 10px rgba(0,0,0,0.3)',
        };
        return (
          <button
            key={card.key}
            type="button"
            onPointerDown={clickable ? () => onFlip(idx) : undefined}
            disabled={!clickable}
            style={{
              position: 'relative', minHeight: 0, padding: 0, border: 'none', background: 'transparent',
              perspective: 900, cursor: clickable ? 'pointer' : 'default',
              touchAction: 'manipulation', zIndex: card.faceUp ? 2 : 1,
            }}
          >
            <motion.div
              animate={{ rotateY: revealed ? 180 : 0 }}
              transition={{ type: 'spring', damping: 16, stiffness: 260 }}
              style={{ position: 'relative', width: '100%', height: '100%', transformStyle: 'preserve-3d' }}
            >
              {/* Dos de la carte */}
              <div style={{
                ...faceStyle,
                border: '2px solid rgba(122,94,58,0.4)',
                background: 'radial-gradient(circle at 50% 30%, #6a4f8a, #3a2a55)',
              }}>
                <span style={{ fontSize: 26, color: 'rgba(255,255,255,0.85)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>{'❓'}</span>
              </div>
              {/* Face avant (contenu) */}
              <div style={{
                ...faceStyle,
                transform: 'rotateY(180deg)',
                border: `3px solid ${ownerTeam ? ownerTeam.color : 'var(--gold-600, #b8862c)'}`,
                background: ownerTeam
                  ? `linear-gradient(160deg, ${ownerTeam.color}dd, ${ownerTeam.color}88 55%, #fffdf7)`
                  : 'linear-gradient(180deg,#fffefb,#f3e6c9)',
              }}>
                <span style={{
                  fontFamily: 'var(--font-ui)', fontWeight: 700, fontSize: 14, lineHeight: 1.15,
                  color: ownerTeam ? '#fff' : 'var(--ink-900)', textAlign: 'center', wordBreak: 'break-word',
                  textShadow: ownerTeam ? '0 1px 3px rgba(0,0,0,0.45)' : 'none',
                }}>
                  {card.text}
                </span>
                {ownerTeam && (
                  <span style={{ position: 'absolute', top: 3, right: 5, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>
                    <TeamAvatar team={ownerTeam} size={18} />
                  </span>
                )}
              </div>
            </motion.div>
          </button>
        );
      })}
    </div>
  );
}
