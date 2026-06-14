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
const MINIGAMES = {
  anglais: {
    Component: VerbHunt,
    name: 'Chasse aux verbes irréguliers',
    rules: 'Des bulles de verbes apparaissent et éclatent : touchez les verbes IRRÉGULIERS avant qu\'ils disparaissent ! +1 / -1, 30 secondes.',
    persistent: false,
    howto: {
      demo: 'tapBubbles',
      goal: 'Touchez les verbes IRRÉGULIERS, évitez les réguliers !',
      steps: [
        'Des bulles de verbes montent à l\'écran',
        'Touchez seulement les verbes irréguliers',
        'Bonne bulle +1, mauvaise −1',
        'Le meilleur score en 30 s gagne la manche',
      ],
    },
  },
  histoire: {
    Component: TimelineGame,
    name: 'Frise du temps',
    rules: 'Chacun son tour, placez l\'événement au bon endroit de la frise. Une erreur = manche perdue !',
    persistent: true,
    howto: {
      demo: 'timeline',
      goal: 'Placez chaque événement au bon endroit de la frise',
      steps: [
        'Chacun son tour, une carte-événement apparaît',
        'Glissez-la entre les bonnes dates',
        'Bien placée : on continue',
        'Une erreur = manche perdue !',
      ],
    },
  },
  maths: {
    Component: CompteEstBon,
    name: 'Le Compte est Bon',
    rules: 'Combinez vos plaques (+ − × ÷) pour atteindre la cible ! Compte exact = victoire immédiate, sinon le plus proche au gong gagne.',
    persistent: false,
    howto: {
      demo: 'compute',
      goal: 'Atteignez le nombre cible avec vos plaques',
      steps: [
        'Combinez vos plaques avec + − × ÷',
        'Le compte exact = victoire immédiate',
        'Sinon, le plus proche au gong gagne',
      ],
    },
  },
  francais: {
    Component: MotLePlusLong,
    name: 'Le Mot le Plus Long',
    rules: 'Composez le mot le plus fort avec les 9 lettres (valeurs Scrabble). Validez pour cacher votre mot — hors dictionnaire = 0 point !',
    persistent: false,
    howto: {
      demo: 'word',
      goal: 'Composez le mot qui rapporte le plus de points',
      steps: [
        'Formez un mot avec les 9 lettres',
        'Chaque lettre vaut ses points Scrabble',
        'Validez pour cacher votre mot',
        'Hors dictionnaire = 0 point !',
      ],
    },
  },
  svt: {
    Component: SortingHunt,
    name: 'Le Grand Tri',
    rules: 'Des bulles apparaissent et éclatent : touchez les éléments de la catégorie demandée (vertébrés, ovipares, os…) avant qu\'ils disparaissent ! +1 / -1, 30 secondes.',
    persistent: true,
    howto: {
      demo: 'tapBubbles',
      goal: 'Touchez la bonne catégorie, ignorez le reste !',
      steps: [
        'Une catégorie est demandée (vertébrés, ovipares, os…)',
        'Des bulles montent à l\'écran',
        'Touchez seulement celles de la catégorie',
        'Bonne bulle +1, mauvaise −1, 30 s',
      ],
    },
  },
  geographie: {
    Component: GeoDuel,
    name: 'Tour du monde',
    rules: 'En alternance : une photo mystère, puis une capitale à placer. Plantez votre drapeau sur la carte, puis validez. Moins de 100 km = 5 000 points, puis dégressif. Premier à 10 000 points !',
    persistent: true,
    pointsBased: true,
    winLabel: 'Premier à 10 000 points',
    howto: {
      demo: 'geo',
      goal: 'Placez le lieu (photo) ou la capitale demandée',
      steps: [
        'Une manche sur deux : photo mystère ; sinon, une capitale à placer',
        'Plantez votre drapeau sur la carte, puis validez',
        'Moins de 100 km = 5 000 points (puis dégressif)',
        'Premier à 10 000 points !',
      ],
    },
  },
};

const DEFAULT_MINIGAME = {
  Component: QuickDuel,
  name: 'Duel de rapidité',
  rules: 'La même question des deux côtés : le premier à toucher la bonne réponse gagne la manche. Une erreur verrouille votre côté !',
  persistent: false,
  howto: {
    demo: 'pickAnswer',
    goal: 'Le plus rapide à trouver la bonne réponse gagne',
    steps: [
      'La même question des deux côtés',
      'Touchez la bonne réponse en premier',
      'Une erreur verrouille votre côté !',
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
