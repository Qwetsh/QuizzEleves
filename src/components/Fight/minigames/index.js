import QuickDuel from './QuickDuel.jsx';
import BubbleHunt from './BubbleHunt.jsx';
import TimelineGame from './TimelineGame.jsx';
import CompteEstBon from './CompteEstBon.jsx';
import MotLePlusLong from './MotLePlusLong.jsx';
import GeoDuel from './GeoDuel.jsx';
import MemoryGame from './MemoryGame.jsx';
import {
  IRREGULAR_VERBS, REGULAR_VERBS, SVT_CHALLENGES, TIMELINE_EVENTS,
  MOVIE_EVENTS, RPG_CHALLENGE, MEMORY_VOCAB,
} from '../../../data/fightData';

/**
 * Système de mini-jeux de duel — séparé en MOTEURS (theme-agnostiques) et THÈMES
 * (données + libellés). Ajouter un thème = AJOUTER UNE ENTRÉE dans THEME_MINIGAMES
 * (+ son contenu), sans écrire de nouveau composant tant qu'un moteur convient.
 *
 * Chaque moteur reçoit { attacker, defender, subject, round, onRoundWin, content }
 * et appelle onRoundWin('attacker'|'defender') à chaque manche gagnée.
 * `persistent: true` = le composant n'est pas remonté entre les manches (il gère
 * lui-même la continuité, ex. la frise Timeline). `content` = données du thème,
 * dont la forme dépend du moteur :
 *   - bubble   : [{ id, prompt, prompt_en?, good[], bad[] }]  (touche-la-catégorie)
 *   - timeline : [{ name, year }]                              (ordonne-par-valeur)
 *   - maths/french/geo : pas de `content` (jeu auto-suffisant)
 */
const ENGINES = {
  bubble: { Component: BubbleHunt, persistent: false },
  timeline: { Component: TimelineGame, persistent: true },
  maths: { Component: CompteEstBon, persistent: false },
  french: { Component: MotLePlusLong, persistent: false },
  geo: { Component: GeoDuel, persistent: true, pointsBased: true },
  memory: { Component: MemoryGame, persistent: false },
};

// Contenu « bubble » de l'anglais (chasse aux verbes irréguliers).
const VERB_CONTENT = [{
  id: 'verbes-irreguliers',
  prompt: 'Touche les verbes IRRÉGULIERS !', prompt_en: 'Tap the IRREGULAR verbs!',
  good: IRREGULAR_VERBS, bad: REGULAR_VERBS,
}];

// THÈMES → moteur + contenu + libellés (clés i18n `fight.mg.*` résolues à
// l'affichage par FightBriefing / FightModal). `name`/`rules`/`howto` sont propres
// au thème (ex. « Chasse aux verbes » vs « Le Grand Tri » partagent le moteur bubble).
const THEME_MINIGAMES = {
  anglais: {
    engine: 'bubble', content: VERB_CONTENT,
    name: 'fight.mg.anglais.name', rules: 'fight.mg.anglais.rules',
    howto: { demo: 'tapBubbles', goal: 'fight.mg.anglais.goal', steps: ['fight.mg.anglais.step1', 'fight.mg.anglais.step2', 'fight.mg.anglais.step3', 'fight.mg.anglais.step4'] },
  },
  svt: {
    engine: 'bubble', content: SVT_CHALLENGES,
    name: 'fight.mg.svt.name', rules: 'fight.mg.svt.rules',
    howto: { demo: 'tapBubbles', goal: 'fight.mg.svt.goal', steps: ['fight.mg.svt.step1', 'fight.mg.svt.step2', 'fight.mg.svt.step3', 'fight.mg.svt.step4'] },
  },
  histoire: {
    engine: 'timeline', content: TIMELINE_EVENTS,
    name: 'fight.mg.histoire.name', rules: 'fight.mg.histoire.rules',
    howto: { demo: 'timeline', goal: 'fight.mg.histoire.goal', steps: ['fight.mg.histoire.step1', 'fight.mg.histoire.step2', 'fight.mg.histoire.step3', 'fight.mg.histoire.step4'] },
  },
  maths: {
    engine: 'maths',
    name: 'fight.mg.maths.name', rules: 'fight.mg.maths.rules',
    howto: { demo: 'compute', goal: 'fight.mg.maths.goal', steps: ['fight.mg.maths.step1', 'fight.mg.maths.step2', 'fight.mg.maths.step3'] },
  },
  francais: {
    engine: 'french',
    name: 'fight.mg.francais.name', rules: 'fight.mg.francais.rules',
    howto: { demo: 'word', goal: 'fight.mg.francais.goal', steps: ['fight.mg.francais.step1', 'fight.mg.francais.step2', 'fight.mg.francais.step3', 'fight.mg.francais.step4'] },
  },
  geographie: {
    engine: 'geo',
    name: 'fight.mg.geographie.name', rules: 'fight.mg.geographie.rules', winLabel: 'fight.mg.geographie.winLabel',
    howto: { demo: 'geo', goal: 'fight.mg.geographie.goal', steps: ['fight.mg.geographie.step1', 'fight.mg.geographie.step2', 'fight.mg.geographie.step3', 'fight.mg.geographie.step4'] },
  },

  // ── Nouveaux thèmes (preuve : réutilisation pure des moteurs, 0 composant) ──
  films: {
    engine: 'timeline', content: MOVIE_EVENTS,
    name: 'fight.mg.films.name', rules: 'fight.mg.films.rules',
    howto: { demo: 'timeline', goal: 'fight.mg.films.goal', steps: ['fight.mg.films.step1', 'fight.mg.films.step2', 'fight.mg.films.step3', 'fight.mg.films.step4'] },
  },
  jeuxvideo: {
    engine: 'bubble', content: [RPG_CHALLENGE],
    name: 'fight.mg.jeuxvideo.name', rules: 'fight.mg.jeuxvideo.rules',
    howto: { demo: 'tapBubbles', goal: 'fight.mg.jeuxvideo.goal', steps: ['fight.mg.jeuxvideo.step1', 'fight.mg.jeuxvideo.step2', 'fight.mg.jeuxvideo.step3', 'fight.mg.jeuxvideo.step4'] },
  },
  vocabulaire: {
    engine: 'memory', content: MEMORY_VOCAB,
    name: 'fight.mg.vocabulaire.name', rules: 'fight.mg.vocabulaire.rules',
    howto: { demo: 'memory', goal: 'fight.mg.vocabulaire.goal', steps: ['fight.mg.vocabulaire.step1', 'fight.mg.vocabulaire.step2', 'fight.mg.vocabulaire.step3', 'fight.mg.vocabulaire.step4'] },
  },
};

const DEFAULT_MINIGAME = {
  Component: QuickDuel, persistent: false, content: undefined,
  name: 'fight.mg.default.name', rules: 'fight.mg.default.rules',
  howto: { demo: 'pickAnswer', goal: 'fight.mg.default.goal', steps: ['fight.mg.default.step1', 'fight.mg.default.step2', 'fight.mg.default.step3'] },
};

// Résout le mini-jeu d'un thème : fusionne le MOTEUR (composant + technique) et le
// THÈME (contenu + libellés). Repli sur le duel générique si thème inconnu.
export function getMinigame(subject) {
  const theme = THEME_MINIGAMES[subject];
  if (!theme) return DEFAULT_MINIGAME;
  const engine = ENGINES[theme.engine] || {};
  return {
    Component: engine.Component,
    persistent: !!engine.persistent,
    pointsBased: !!engine.pointsBased,
    content: theme.content,
    name: theme.name,
    rules: theme.rules,
    winLabel: theme.winLabel,
    howto: theme.howto,
  };
}

// Le duel générique (utilisé par le simulateur dev pour tester le fallback).
export function getDefaultMinigame() {
  return DEFAULT_MINIGAME;
}

// Exposé pour les tests / le simulateur : liste des thèmes câblés.
export const MINIGAME_THEMES = Object.keys(THEME_MINIGAMES);
