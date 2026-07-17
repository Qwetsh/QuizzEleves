// Tests du SETUP solo : équipes bots, gating d'extensions, réponse simulée,
// routage « duel éclair » quand un bot est impliqué.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { soloExtensions, defaultExtensions, extOn } from '../extensions/registry.js';
import { BOT_NAMES } from '../logic/botBrain.js';

const S = () => useGameStore.getState();

const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 4; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 4 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 5, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const mkTeam = (i, over = {}) => ({
  name: `T${i}`, emoji: '🦁', color: '#111', pos: 'n2', money: 10, correct: 0, wrong: 0,
  powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], buffs: [], ...over,
});

afterEach(() => {
  S().clearSoloSetup();
  vi.useRealTimers();
});

describe('setupSoloTeams', () => {
  it('construit [humain, N bots] avec niveaux et personnages', () => {
    S().setupSoloTeams(2, 'difficile');
    const { setupTeams, nbTeams, soloConfig } = S();
    expect(nbTeams).toBe(3);
    expect(setupTeams).toHaveLength(3);
    expect(setupTeams[0].isBot).toBeUndefined();
    expect(setupTeams[1]).toMatchObject({ isBot: true, botLevel: 'difficile', name: BOT_NAMES[0] });
    expect(setupTeams[2]).toMatchObject({ isBot: true, botLevel: 'difficile', name: BOT_NAMES[1] });
    // Chaque équipe garde couleur/perso distincts (spread des défauts par index).
    expect(setupTeams[1].character).not.toBe(setupTeams[0].character);
    expect(soloConfig).toEqual({ nBots: 2, level: 'difficile' });
  });

  it('borne le nombre de bots à 1-3', () => {
    S().setupSoloTeams(9, 'facile');
    expect(S().setupTeams).toHaveLength(4);
    S().setupSoloTeams(0, 'facile');
    expect(S().setupTeams).toHaveLength(2);
  });

  it('clearSoloSetup restaure les équipes multi par défaut', () => {
    S().setupSoloTeams(3, 'moyen');
    S().clearSoloSetup();
    expect(S().soloConfig).toBeNull();
    expect(S().nbTeams).toBe(3);
    expect(S().setupTeams.some((t) => t.isBot)).toBe(false);
  });
});

describe('soloExtensions', () => {
  it('force OFF les extensions non gérées par l’IA, garde Objets et Maîtrise', () => {
    const all = Object.fromEntries(Object.keys(defaultExtensions()).map((k) => [k, true]));
    const solo = soloExtensions(all);
    for (const id of ['forge', 'alchemy', 'enchant', 'magic', 'metier', 'trade', 'diplomacy', 'weather']) {
      expect(extOn(solo, id)).toBe(false);
    }
    expect(extOn(solo, 'equipment')).toBe(true);
    expect(extOn(solo, 'mastery')).toBe(true);
  });
});

describe('botSelectAnswer', () => {
  const openQuestion = () => {
    useGameStore.setState({
      phase: 'game', devSandbox: true, board: BOARD, finished: false,
      teams: [mkTeam(0), mkTeam(1, { isBot: true, botLevel: 'moyen' })], currentTeam: 1,
      indiceHidden: [],
      showQuestion: {
        question: { q: 'Q ?', a: ['a', 'b', 'c', 'd'], c: 2 },
        subject: 'maths', deadline: Date.now() + 30000,
        selected: null, answerRevealed: false, timeLeftAtReveal: null,
      },
    });
  };

  it('révèle la réponse avec un temps restant SIMULÉ (ratio × durée)', () => {
    openQuestion();
    S().botSelectAnswer(2, 0.5);
    const sq = S().showQuestion;
    expect(sq.answerRevealed).toBe(true);
    expect(sq.selected).toBe(2);
    expect(sq.timeLeftAtReveal).toBe(15); // 30 s × 0,5 — pas la vraie horloge
  });

  it('respecte les gardes de selectAnswer (index barré, déjà révélé)', () => {
    openQuestion();
    useGameStore.setState({ indiceHidden: [1] });
    S().botSelectAnswer(1, 0.5);
    expect(S().showQuestion.answerRevealed).toBe(false);
    S().botSelectAnswer(0, 0.5);
    expect(S().showQuestion.answerRevealed).toBe(true);
    const frozen = S().showQuestion.timeLeftAtReveal;
    S().botSelectAnswer(2, 0.9); // déjà révélé → no-op
    expect(S().showQuestion.selected).toBe(0);
    expect(S().showQuestion.timeLeftAtReveal).toBe(frozen);
  });
});

describe('fightBegin en solo → duel éclair (course)', () => {
  const setupFight = (teams) => {
    useGameStore.setState({
      phase: 'game', devSandbox: true, board: BOARD, finished: false,
      connectionMode: 'board',
      teams, currentTeam: 0,
      questions: { maths: [{ q: 'M ?', a: ['a', 'b', 'c', 'd'], c: 0 }] }, askedQuestions: {},
      log: [],
      showFight: {
        attackerIndex: 0, defenderIndex: 1, subject: 'maths', phase: 'versus',
        round: 1, wins: { attacker: 0, defender: 0 }, winnerSide: null, reward: null, resultMessage: null,
      },
    });
  };

  it('un bot est impliqué → course à la question (pas de briefing)', () => {
    vi.useFakeTimers();
    setupFight([mkTeam(0), mkTeam(1, { isBot: true, botLevel: 'moyen' })]);
    S().fightBegin();
    const f = S().showFight;
    expect(f.phase).toBe('minigame');
    expect(f.race).toBeTruthy();
    // pickQuestion MÉLANGE les réponses : on vérifie le texte, pas l'index.
    expect(f.race.q.a[f.race.q.c]).toBe('a');
  });

  it('aucun bot (multi local) → briefing du mini-jeu TBI (inchangé)', () => {
    setupFight([mkTeam(0), mkTeam(1)]);
    S().fightBegin();
    expect(S().showFight.phase).toBe('briefing');
  });
});
