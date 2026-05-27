import { useGameStore } from './store/gameStore';
import { AnimatePresence, motion } from 'framer-motion';
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

  return (
    <div className="min-h-screen">
      <AnimatePresence mode="wait">
        {phase === 'setup' && (
          <motion.div key="setup" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
            <Setup />
          </motion.div>
        )}
        {phase === 'powerSelect' && (
          <motion.div key="power" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition}>
            <PowerSetup />
          </motion.div>
        )}
        {phase === 'game' && (
          <motion.div key="game" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} className="h-screen">
            <GameLayout />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
