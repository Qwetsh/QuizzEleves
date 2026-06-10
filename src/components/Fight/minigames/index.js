import QuickDuel from './QuickDuel.jsx';
import VerbHunt from './VerbHunt.jsx';
import TimelineGame from './TimelineGame.jsx';

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
    rules: 'Touchez les verbes IRRÉGULIERS de votre côté ! +1 par verbe irrégulier, -1 par verbe régulier. 30 secondes !',
    persistent: false,
  },
  histoire: {
    Component: TimelineGame,
    name: 'Frise du temps',
    rules: 'Chacun son tour, placez l\'événement au bon endroit de la frise. Une erreur = manche perdue !',
    persistent: true,
  },
};

const DEFAULT_MINIGAME = {
  Component: QuickDuel,
  name: 'Duel de rapidité',
  rules: 'La même question des deux côtés : le premier à toucher la bonne réponse gagne la manche. Une erreur verrouille votre côté !',
  persistent: false,
};

export function getMinigame(subject) {
  return MINIGAMES[subject] || DEFAULT_MINIGAME;
}
