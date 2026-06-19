import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { AnimatePresence, motion } from 'framer-motion';
import { setLang } from './i18n';
import Setup from './components/Setup/Setup';
import PowerSetup from './components/Setup/PowerSetup';
import GameLayout from './components/Game/GameLayout';

const pageVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.04 },
};

const pageTransition = { duration: 0.35, ease: 'easeInOut' };

export default function App() {
  const phase = useGameStore((s) => s.phase);
  // Tient la langue globale (getLang) synchronisée avec le toggle, pour les
  // helpers de contenu (effectText, noms de données) côté TBI.
  const englishMode = useGameStore((s) => s.englishMode);
  useEffect(() => { setLang(englishMode ? 'en' : 'fr'); }, [englishMode]);

  return (
    <div className="absolute inset-0 no-select" style={{ fontFamily: 'var(--font-ui)' }}>
      <AnimatePresence mode="wait">
        {phase === 'setup' && (
          <motion.div key="setup" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} className="absolute inset-0">
            <Setup />
          </motion.div>
        )}
        {phase === 'powerSelect' && (
          <motion.div key="power" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} className="absolute inset-0">
            <PowerSetup />
          </motion.div>
        )}
        {phase === 'game' && (
          <motion.div key="game" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} className="absolute inset-0">
            <GameLayout />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
