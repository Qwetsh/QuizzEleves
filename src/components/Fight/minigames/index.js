import QuickDuel from './QuickDuel.jsx';
import VerbHunt from './VerbHunt.jsx';
import TimelineGame from './TimelineGame.jsx';
import CompteEstBon from './CompteEstBon.jsx';
import MotLePlusLong from './MotLePlusLong.jsx';
import SortingHunt from './SortingHunt.jsx';
import GeoDuel from './GeoDuel.jsx';

/**
 * Registre des mini-jeux de combat, par matiere.
 * Chaque mini-jeu recoit { attacker, defender, subject, round, onRoundWin }
 * et appelle onRoundWin('attacker'|'defender') a chaque manche gagnee.
 * `persistent: true` = le composant n'est pas remonte entre les manches
 * (il gere lui-meme la continuite, ex. la frise Timeline).
 */
// Les libellés (nom, règles, but, étapes, winLabel) sont des CLÉS i18n `fight.mg.*`
// résolues à l'affichage par FightBriefing / FightModal via useT().
const MINIGAMES = {
  anglais: {
    Component: VerbHunt,
    name: 'fight.mg.anglais.name',
    rules: 'fight.mg.anglais.rules',
    persistent: false,
    howto: {
      demo: 'tapBubbles',
      goal: 'fight.mg.anglais.goal',
      steps: [
        'fight.mg.anglais.step1',
        'fight.mg.anglais.step2',
        'fight.mg.anglais.step3',
        'fight.mg.anglais.step4',
      ],
    },
  },
  histoire: {
    Component: TimelineGame,
    name: 'fight.mg.histoire.name',
    rules: 'fight.mg.histoire.rules',
    persistent: true,
    howto: {
      demo: 'timeline',
      goal: 'fight.mg.histoire.goal',
      steps: [
        'fight.mg.histoire.step1',
        'fight.mg.histoire.step2',
        'fight.mg.histoire.step3',
        'fight.mg.histoire.step4',
      ],
    },
  },
  maths: {
    Component: CompteEstBon,
    name: 'fight.mg.maths.name',
    rules: 'fight.mg.maths.rules',
    persistent: false,
    howto: {
      demo: 'compute',
      goal: 'fight.mg.maths.goal',
      steps: [
        'fight.mg.maths.step1',
        'fight.mg.maths.step2',
        'fight.mg.maths.step3',
      ],
    },
  },
  francais: {
    Component: MotLePlusLong,
    name: 'fight.mg.francais.name',
    rules: 'fight.mg.francais.rules',
    persistent: false,
    howto: {
      demo: 'word',
      goal: 'fight.mg.francais.goal',
      steps: [
        'fight.mg.francais.step1',
        'fight.mg.francais.step2',
        'fight.mg.francais.step3',
        'fight.mg.francais.step4',
      ],
    },
  },
  svt: {
    Component: SortingHunt,
    name: 'fight.mg.svt.name',
    rules: 'fight.mg.svt.rules',
    persistent: true,
    howto: {
      demo: 'tapBubbles',
      goal: 'fight.mg.svt.goal',
      steps: [
        'fight.mg.svt.step1',
        'fight.mg.svt.step2',
        'fight.mg.svt.step3',
        'fight.mg.svt.step4',
      ],
    },
  },
  geographie: {
    Component: GeoDuel,
    name: 'fight.mg.geographie.name',
    rules: 'fight.mg.geographie.rules',
    persistent: true,
    pointsBased: true,
    winLabel: 'fight.mg.geographie.winLabel',
    howto: {
      demo: 'geo',
      goal: 'fight.mg.geographie.goal',
      steps: [
        'fight.mg.geographie.step1',
        'fight.mg.geographie.step2',
        'fight.mg.geographie.step3',
        'fight.mg.geographie.step4',
      ],
    },
  },
};

const DEFAULT_MINIGAME = {
  Component: QuickDuel,
  name: 'fight.mg.default.name',
  rules: 'fight.mg.default.rules',
  persistent: false,
  howto: {
    demo: 'pickAnswer',
    goal: 'fight.mg.default.goal',
    steps: [
      'fight.mg.default.step1',
      'fight.mg.default.step2',
      'fight.mg.default.step3',
    ],
  },
};

export function getMinigame(subject) {
  return MINIGAMES[subject] || DEFAULT_MINIGAME;
}

// Le duel generique (utilise par le simulateur dev pour tester le fallback)
export function getDefaultMinigame() {
  return DEFAULT_MINIGAME;
}
