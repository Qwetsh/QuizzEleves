import { lazy, Suspense, useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { AnimatePresence, motion } from 'framer-motion';
import { setLang } from './i18n';
import { playMusic } from './logic/music';
import Setup from './components/Setup/Setup';
import PowerSetup from './components/Setup/PowerSetup';
import GameLayout from './components/Game/GameLayout';
import OnlineHost from './components/Online/OnlineHost';
import BotDriver from './components/Game/BotDriver';

// Console de setup « CURIOSCOPE » (écran principal) : paresseuse. Repli vers
// l'ancien Setup via ?classic (filet de sécurité pendant la transition).
const SelectionCassettes = lazy(() => import('./components/Setup/SelectionCassettes'));
const HomeScreen = lazy(() => import('./components/Home/HomeScreen'));
const OnlineLobby = lazy(() => import('./components/Online/OnlineLobby'));
const CLASSIC_SETUP = new URLSearchParams(window.location.search).has('classic');

const pageVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.04 },
};

const pageTransition = { duration: 0.35, ease: 'easeInOut' };

export default function App() {
  const phase = useGameStore((s) => s.phase);
  // Tient la langue globale (getLang) synchronisée avec le toggle, pour les
  // helpers de contenu (effectText, noms de données) côté TBI. SYNCHRONE pendant
  // le rendu (et non dans un effet) : sinon locName/locDesc, lus pendant le rendu
  // des enfants, auraient un cran de retard → événements/objets affichés dans la
  // mauvaise langue au moindre basculement live (accueil).
  const englishMode = useGameStore((s) => s.englishMode);
  setLang(englishMode ? 'en' : 'fr');

  // Musique de fond : « Stellar Drift » en jeu, « Star Map Menu » partout ailleurs
  // (accueil, sélection, choix des pouvoirs). Fondu enchaîné géré par music.js.
  useEffect(() => {
    playMusic(phase === 'game' ? 'game' : 'menu');
  }, [phase]);

  return (
    <div className="absolute inset-0 no-select" style={{ fontFamily: 'var(--font-ui)' }}>
      <AnimatePresence mode="wait">
        {phase === 'home' && (
          <motion.div key="home" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} className="absolute inset-0">
            {/* ?classic n'a pas d'accueil : l'ancien Setup tout-en-un directement. */}
            {CLASSIC_SETUP ? <Setup /> : <Suspense fallback={null}><HomeScreen /></Suspense>}
          </motion.div>
        )}
        {phase === 'onlineLobby' && (
          <motion.div key="onlineLobby" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} className="absolute inset-0">
            <Suspense fallback={null}><OnlineLobby /></Suspense>
          </motion.div>
        )}
        {phase === 'setup' && (
          <motion.div key="setup" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} className="absolute inset-0">
            {CLASSIC_SETUP ? <Setup /> : <Suspense fallback={null}><SelectionCassettes main /></Suspense>}
          </motion.div>
        )}
        {phase === 'compose' && (
          <motion.div key="compose" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={pageTransition} className="absolute inset-0">
            <Suspense fallback={null}><SelectionCassettes live /></Suspense>
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

      {/* Diffusion « jeu en ligne » (hôte). Inactif hors mode online / sur miroir. */}
      <OnlineHost />
      {/* Bots du mode SOLO : monté hors AnimatePresence pour couvrir la
          sélection des pouvoirs ET la partie (inactif sans équipe bot). */}
      <BotDriver />
    </div>
  );
}
