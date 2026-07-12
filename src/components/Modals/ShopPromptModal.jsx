// Prompt « Visiter la boutique ? » — proposé en début de tour quand l'équipe
// active n'a pas vu la boutique depuis LOOT.shopPromptDelay tours et peut
// s'offrir au moins un objet de l'arrivage (cf. nextTurn dans gameStore).
// Oui → ouvre la boutique ; Plus tard → snooze (reset du compteur).
// Habillage spatial HUD (cohérent avec la modale d'événement / le coffre).
import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '../../store/gameStore';
import { useT } from '../../i18n';
import ModalOverlay from './ModalOverlay';
import { soundClick } from '../../logic/sounds';
import '../../styles/shop-prompt.css';

const PANEL = {
  background: 'linear-gradient(180deg,#0f1c2e,#0a1220)',
  border: '1.5px solid rgba(120,200,235,0.55)',
  borderRadius: 18,
  boxShadow: '0 24px 60px rgba(0,0,0,0.6), inset 0 0 40px rgba(40,120,170,0.15)',
  color: '#cfe8f5',
};

export default function ShopPromptModal() {
  const T = useT();
  const show = useGameStore((s) => s.showShopPrompt);
  const team = useGameStore((s) => s.teams[s.currentTeam]);
  const accept = useGameStore((s) => s.acceptShopPrompt);
  const dismiss = useGameStore((s) => s.dismissShopPrompt);

  return (
    <AnimatePresence>
      {show && team && (
        <ModalOverlay className="max-w-md" panelStyle={PANEL} onClose={() => { soundClick(); dismiss(); }}>
          <div className="spm">
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 13, stiffness: 240, delay: 0.05 }}
            >
              <div className="spm-icon" aria-hidden>🛒</div>
            </motion.div>

            <h2 className="spm-title">{T('modal.shopPrompt.title', { emoji: team.emoji, name: team.name })}</h2>
            <p className="spm-sub">{T('modal.shopPrompt.sub')}</p>
            <div className="spm-money">{team.money ?? 0} <span className="coin" /></div>

            <div className="spm-actions">
              <button className="spm-btn spm-btn--go" onClick={() => { soundClick(); accept(); }}>
                {T('modal.shopPrompt.go')}
              </button>
              <button className="spm-btn spm-btn--later" onClick={() => { soundClick(); dismiss(); }}>
                {T('common.later')}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </AnimatePresence>
  );
}
