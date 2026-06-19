// Prompt « Visiter la boutique ? » — proposé en début de tour quand l'équipe
// active n'a pas vu la boutique depuis LOOT.shopPromptDelay tours et peut
// s'offrir au moins un objet de l'arrivage (cf. nextTurn dans gameStore).
// Oui → ouvre la boutique ; Plus tard → snooze (reset du compteur).
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import ModalOverlay from './ModalOverlay';
import { soundClick } from '../../logic/sounds';
import btnBoutique from '../../assets/inventory/btn-boutique.png';

export default function ShopPromptModal() {
  const T = useT();
  const show = useGameStore((s) => s.showShopPrompt);
  const team = useGameStore((s) => s.teams[s.currentTeam]);
  const accept = useGameStore((s) => s.acceptShopPrompt);
  const dismiss = useGameStore((s) => s.dismissShopPrompt);

  return (
    <AnimatePresence>
      {show && team && (
        <ModalOverlay className="max-w-md" onClose={() => { soundClick(); dismiss(); }}>
          <div style={{ padding: '26px 26px 22px', textAlign: 'center' }}>
            <motion.div
              initial={{ scale: 0.4, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 240, delay: 0.05 }}
              style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}
            >
              <img src={btnBoutique} alt="" draggable={false} style={{ width: 150, height: 'auto', filter: 'drop-shadow(0 8px 14px rgba(46,31,16,0.4))' }} />
            </motion.div>

            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1.05,
              color: 'var(--ink-900)', margin: '4px 0 6px',
            }}>
              {T('modal.shopPrompt.title', { emoji: team.emoji, name: team.name })}
            </h2>
            <p style={{ fontSize: 15, color: 'var(--ink-600)', margin: '0 0 4px' }}>
              {T('modal.shopPrompt.sub')}
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 999, marginBottom: 18,
              background: 'linear-gradient(180deg, #fff5d0, #f3d997)',
              border: '1px solid rgba(184, 134, 44, 0.45)',
              fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink-900)',
            }}>
              {team.money ?? 0} <span className="coin" />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="btn btn--green"
                style={{ fontSize: 17, padding: '12px 22px' }}
                onClick={() => { soundClick(); accept(); }}
              >
                {T('modal.shopPrompt.go')}
              </button>
              <button
                className="btn btn--ghost"
                style={{ fontSize: 16, padding: '12px 18px' }}
                onClick={() => { soundClick(); dismiss(); }}
              >
                {T('common.later')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
