// Tests d'équilibrage des pouvoirs : Bouclier par niveau (reduceRecul/blockRecul)
// et Double (rafale sans bonus, timer réduit niv.3 persistant sur la rafale).
import { useGameStore } from '../store/gameStore.js';
import { resolveWrongAnswer } from '../logic/turnHelpers.js';
import { SUBJECT_KEYS } from '../data/subjects.js';

// Plateau linéaire : depart -> n1..n8 -> arrivee
const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) {
    b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  }
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

// Une question par matière pour que randomSubject() trouve toujours un pool
const QUESTIONS = Object.fromEntries(
  SUBJECT_KEYS.map((k) => [k, [{ q: 'Q ?', a: ['A', 'B', 'C', 'D'], c: 0 }, { q: 'Q2 ?', a: ['A', 'B', 'C', 'D'], c: 0 }, { q: 'Q3 ?', a: ['A', 'B', 'C', 'D'], c: 0 }]])
);

function mkTeam(i, over = {}) {
  return {
    name: `T${i}`, color: '#111', emoji: '🦁', blazonGlyph: 'lion',
    pos: 'n4', correct: 0, wrong: 0, money: 50,
    powerDef: null, powerOff: null, powers: {},
    sablierActif: false, doubleActive: false,
    equipment: { head: null, body: null, feet: null }, bag: [],
    ...over,
  };
}

function freshGame(overrides = [{}, {}, {}]) {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    teams: overrides.map((o, i) => mkTeam(i, o)),
    currentTeam: 0, board: BOARD, finished: false,
    askedQuestions: {}, questions: QUESTIONS, log: [],
    rolling: false, diceValue: null, pendingMove: null, pendingLanding: false,
    awaitingChoice: false, showQuestion: null, showEvent: null, showFight: null,
    showTargetPicker: null, showShop: false, showInventory: false,
    showChargePicker: false, showDiceModal: false, eventApplied: false,
    indiceUsed: false, indiceHidden: [], freeActivation: false,
    shopStock: [], shopStockTurns: 10, movePath: null,
    preRollPos: null, preRollValue: null,
  });
}

const S = () => useGameStore.getState();
const team = (i = 0) => S().teams[i];

describe('Bouclier par niveau', () => {
  const withBouclier = (level, extra = {}) =>
    mkTeam(0, { powers: { bouclier: { charges: 2, level } }, ...extra });

  it('niv.1 : réduit le recul de 2 à 1 (charge consommée)', () => {
    const r = resolveWrongAnswer(withBouclier(1), BOARD);
    expect(r.updatedTeam.pos).toBe('n3');
    expect(r.updatedTeam.powers.bouclier.charges).toBe(1);
  });

  it('niv.1 + bottes usées : recul totalement absorbé', () => {
    const t = withBouclier(1, { equipment: { head: null, body: null, feet: 'bottesUsees' } });
    const r = resolveWrongAnswer(t, BOARD);
    expect(r.updatedTeam.pos).toBe('n4');
    expect(r.updatedTeam.powers.bouclier.charges).toBe(1);
  });

  it('niv.2 : annule le recul', () => {
    const r = resolveWrongAnswer(withBouclier(2), BOARD);
    expect(r.updatedTeam.pos).toBe('n4');
    expect(r.updatedTeam.money).toBe(50);
  });

  it('niv.3 : annule le recul et rapporte 5 pièces', () => {
    const r = resolveWrongAnswer(withBouclier(3), BOARD);
    expect(r.updatedTeam.pos).toBe('n4');
    expect(r.updatedTeam.money).toBe(55);
  });

  it('sans charge : recul normal de 2', () => {
    const t = mkTeam(0, { powers: { bouclier: { charges: 0, level: 3 } } });
    const r = resolveWrongAnswer(t, BOARD);
    expect(r.updatedTeam.pos).toBe('n2');
    expect(r.updatedTeam.money).toBe(50);
  });
});

describe('Double : rafale et timer réduit (niv.3)', () => {
  beforeEach(() => freshGame());

  const castDouble = (level) => {
    const teams = [...S().teams];
    teams[0] = { ...teams[0], powers: { double: { charges: 1, level } } };
    useGameStore.setState({ teams, showTargetPicker: { powerKey: 'double' } });
    S().applyOffensivePower(1);
  };

  it('niv.1 : double question sans bonus pièces', () => {
    castDouble(1);
    expect(team(1).doubleActive).toBe(true);
    expect(team(1).doubleCount).toBe(2);
    expect(team(1).doubleNoBonus).toBe(true);
    expect(team(1).sablierActif).toBe(false);
  });

  it('niv.2 : triple question', () => {
    castDouble(2);
    expect(team(1).doubleCount).toBe(3);
    expect(team(1).sablierActif).toBe(false);
  });

  it('niv.3 : triple question + timer /2 (champ séparé du Sablier)', () => {
    castDouble(3);
    expect(team(1).doubleCount).toBe(3);
    expect(team(1).doubleTimerDivisor).toBe(2);
    expect(team(1).sablierActif).toBe(false);
  });

  it('niv.3 : le timer réduit persiste sur TOUTE la rafale puis se nettoie', () => {
    castDouble(3);
    useGameStore.setState({ currentTeam: 1 });

    // Question 1 : timer /2, la réduction persiste pendant la rafale
    S().askQuestion('maths');
    expect(S().showQuestion.timerDivisor).toBe(2);
    expect(team(1).doubleTimerDivisor).toBe(2);
    S().answerQuestion(S().showQuestion.question.c, 10);

    // Question 2 (enchaînée automatiquement) : toujours /2
    expect(S().showQuestion).toBeTruthy();
    expect(S().showQuestion.timerDivisor).toBe(2);
    S().answerQuestion(S().showQuestion.question.c, 10);

    // Question 3 : toujours /2, puis fin de rafale -> tout est nettoyé
    expect(S().showQuestion.timerDivisor).toBe(2);
    S().answerQuestion(S().showQuestion.question.c, 10);
    expect(S().showQuestion).toBeNull();
    expect(team(1).doubleActive).toBe(false);
    expect(team(1).doubleTimerDivisor).toBeUndefined();
    // Sans bonus : aucune pièce gagnée malgré 3 bonnes réponses
    expect(team(1).money).toBe(50);
    expect(team(1).correct).toBe(3);
  });

  it('rafale interrompue par une erreur : timer réduit nettoyé aussi', () => {
    castDouble(3);
    useGameStore.setState({ currentTeam: 1 });
    S().askQuestion('maths');
    const wrong = (S().showQuestion.question.c + 1) % 4;
    S().answerQuestion(wrong, 10);
    expect(team(1).doubleActive).toBe(false);
    expect(team(1).doubleTimerDivisor).toBeUndefined();
  });

  it('Sablier adverse + rafale Double : consommé sur UNE seule question', () => {
    // Un Sablier classique (effet « 1 question ») lancé sur une équipe qui
    // subit aussi un Double niv.1 ne doit pas persister sur la rafale
    castDouble(1);
    const teams = [...S().teams];
    teams[1] = { ...teams[1], sablierActif: true, sablierDivisor: 2 };
    useGameStore.setState({ teams, currentTeam: 1 });

    S().askQuestion('maths');
    expect(S().showQuestion.timerDivisor).toBe(2);
    expect(team(1).sablierActif).toBe(false); // consommé immédiatement
    S().answerQuestion(S().showQuestion.question.c, 10);

    // Question 2 de la rafale : timer normal
    expect(S().showQuestion).toBeTruthy();
    expect(S().showQuestion.timerDivisor).toBe(1);
  });

  it('Sablier seul (hors rafale) : consommé à la première question', () => {
    const teams = [...S().teams];
    teams[0] = { ...teams[0], sablierActif: true, sablierDivisor: 3 };
    useGameStore.setState({ teams });
    S().askQuestion('maths');
    expect(S().showQuestion.timerDivisor).toBe(3);
    expect(team(0).sablierActif).toBe(false);
  });
});
