import QuickDuel from './QuickDuel.jsx';
import VerbHunt from './VerbHunt.jsx';
import TimelineGame from './TimelineGame.jsx';
import CompteEstBon from './CompteEstBon.jsx';
import MotLePlusLong from './MotLePlusLong.jsx';
import AnatomyDuel from './AnatomyDuel.jsx';
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
    rules: 'Touchez les verbes IRRÉGULIERS de votre côté ! +1 par verbe irrégulier, -1 par verbe régulier. 30 secondes !',
    persistent: false,
  },
  histoire: {
    Component: TimelineGame,
    name: 'Frise du temps',
    rules: 'Chacun son tour, placez l\'événement au bon endroit de la frise. Une erreur = manche perdue !',
    persistent: true,
  },
  maths: {
    Component: CompteEstBon,
    name: 'Le Compte est Bon',
    rules: 'Combinez vos plaques (+ − × ÷) pour atteindre la cible ! Compte exact = victoire immédiate, sinon le plus proche au gong gagne.',
    persistent: false,
  },
  francais: {
    Component: MotLePlusLong,
    name: 'Le Mot le Plus Long',
    rules: 'Composez le mot le plus fort avec les 9 lettres (valeurs Scrabble). Validez pour cacher votre mot — hors dictionnaire = 0 point !',
    persistent: false,
  },
  svt: {
    Component: AnatomyDuel,
    name: "L'Anatomiste",
    rules: 'Placez l\'élément demandé sur la silhouette, puis validez : votre repère se cache. Le plus proche de la cible gagne la manche !',
    persistent: true,
  },
  geographie: {
    Component: GeoDuel,
    name: 'Tour du monde',
    rules: 'Plantez votre drapeau sur la carte à l\'endroit du lieu annoncé, puis validez. Révélation quand les deux équipes ont validé : le plus proche gagne !',
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

// Le duel generique (utilise par le simulateur dev pour tester le fallback)
export function getDefaultMinigame() {
  return DEFAULT_MINIGAME;
}
