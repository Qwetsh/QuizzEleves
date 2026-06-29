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

describe('Bouclier par niveau (recul = valeur du dé, réduction croissante)', () => {
  // Recul de base = 5 (le dé qui a fait avancer), équipe partie de n8.
  const RECUL = 5;
  const withBouclier = (level, extra = {}) =>
    mkTeam(0, { pos: 'n8', powers: { bouclier: { charges: 2, level } }, ...extra });
  const wrong = (t) => resolveWrongAnswer(t, BOARD, 'Mauvaise réponse', RECUL);

  it('niv.1 : retire 2 cases au recul (5 → 3) ; charge consommée', () => {
    const r = wrong(withBouclier(1));
    expect(r.updatedTeam.pos).toBe('n5'); // n8 reculé de 3
    expect(r.updatedTeam.powers.bouclier.charges).toBe(1);
  });

  it('niv.2 : retire 4 cases au recul (5 → 1)', () => {
    const r = wrong(withBouclier(2));
    expect(r.updatedTeam.pos).toBe('n7'); // n8 reculé de 1
    expect(r.updatedTeam.money).toBe(50);
  });

  it('niv.3 : retire 6 cases (recul absorbé) + 5 pièces', () => {
    const r = wrong(withBouclier(3));
    expect(r.updatedTeam.pos).toBe('n8'); // 5 - 6 <= 0
    expect(r.updatedTeam.money).toBe(55);
  });

  it('niv.1 + bottes usées : recul encore réduit par l’équipement', () => {
    const t = withBouclier(1, { equipment: { head: null, body: null, feet: 'bottesUsees' } });
    const r = wrong(t);
    // 5 - 2 (bouclier) = 3, puis bottesUsees (reculReduction) réduit encore
    expect(['n6', 'n7', 'n8']).toContain(r.updatedTeam.pos);
    expect(r.updatedTeam.powers.bouclier.charges).toBe(1);
  });

  it('sans charge : recul = valeur du dé', () => {
    const t = mkTeam(0, { pos: 'n8', powers: { bouclier: { charges: 0, level: 3 } } });
    const r = wrong(t);
    expect(r.updatedTeam.pos).toBe('n3'); // n8 reculé de 5
    expect(r.updatedTeam.money).toBe(50);
  });
});

describe('Recul = valeur du dé (flux complet)', () => {
  it('mauvaise réponse : recul = preRollValue', () => {
    freshGame();
    useGameStore.setState({ teams: [mkTeam(0, { pos: 'n8' }), mkTeam(1), mkTeam(2)], currentTeam: 0, preRollValue: 5 });
    S().askQuestion('maths');
    const wrong = (S().showQuestion.question.c + 1) % 4;
    S().answerQuestion(wrong, 10);
    expect(team(0).pos).toBe('n3'); // n8 reculé de 5 (le dé)
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

  it('niv.1 : +1 question extra sans bonus pièces', () => {
    castDouble(1);
    expect(team(1).doubleActive).toBe(true);
    expect(team(1).doubleExtra).toBe(1);
    expect(team(1).doubleNoBonus).toBe(true);
    expect(team(1).sablierActif).toBe(false);
  });

  it('niv.2 : +1 question extra (5 % d’une de plus)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // > 5 % → pas de question bonus
    castDouble(2);
    expect(team(1).doubleExtra).toBe(1); // spec : L2 = +1 question (+ chance bonus)
    expect(team(1).sablierActif).toBe(false);
    vi.restoreAllMocks();
  });

  it('niv.3 : +2 questions extra', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // > 5 % → pas de question bonus
    castDouble(3);
    expect(team(1).doubleExtra).toBe(2);
    // La Double ne divise plus le timer (le timer commun est la voie « Temps commun »).
    expect(team(1).doubleTimerDivisor).toBeUndefined();
    expect(team(1).sablierActif).toBe(false);
    vi.restoreAllMocks();
  });

  it('cumul Double + Double : les questions extra s’additionnent', () => {
    castDouble(1);
    castDouble(1);
    expect(team(1).doubleExtra).toBe(2); // 1 + 1
    expect(team(1).doubleNoBonus).toBe(true);
  });

  it('plafond : doubleExtra ne dépasse pas 4 (5 questions max)', () => {
    for (let i = 0; i < 5; i++) castDouble(2); // +2 chacun
    expect(team(1).doubleExtra).toBe(4);
  });

  it('niv.3 : la rafale s’enchaîne sur 3 questions puis se nettoie', () => {
    castDouble(3);
    useGameStore.setState({ currentTeam: 1 });

    // Question 1 sur 3 (1 base + 2 extra)
    S().askQuestion('maths');
    expect(S().showQuestion.multiIndex).toBe(1);
    expect(S().showQuestion.multiTotal).toBe(3);
    S().answerQuestion(S().showQuestion.question.c, 10);

    // Question 2 (enchaînée automatiquement)
    expect(S().showQuestion).toBeTruthy();
    expect(S().showQuestion.multiIndex).toBe(2);
    S().answerQuestion(S().showQuestion.question.c, 10);

    // Question 3, puis fin de rafale -> tout est nettoyé
    expect(S().showQuestion.multiIndex).toBe(3);
    S().answerQuestion(S().showQuestion.question.c, 10);
    expect(S().showQuestion).toBeNull();
    expect(team(1).doubleActive).toBe(false);
    expect(team(1).doubleExtra).toBe(0);
    expect(team(1).doubleTotal).toBe(0);
    expect(team(1).doubleAsked).toBe(0);
    // Sans bonus : aucune pièce gagnée malgré 3 bonnes réponses
    expect(team(1).money).toBe(50);
    expect(team(1).correct).toBe(3);
  });

  it('bonus pièces sur la DERNIÈRE question seulement quand noBonus=false', () => {
    // Simule une rafale issue d'un futur objet « bonus » (doubleNoBonus=false)
    const teams = [...S().teams];
    teams[1] = { ...teams[1], money: 50, doubleActive: true, doubleExtra: 1, doubleNoBonus: false };
    useGameStore.setState({ teams, currentTeam: 1 });

    S().askQuestion('maths');
    S().answerQuestion(S().showQuestion.question.c, 10); // Q1 : pas de bonus (extra restant)
    expect(team(1).money).toBe(50);
    S().answerQuestion(S().showQuestion.question.c, 10); // Q2 (dernière) : bonus
    expect(team(1).money).toBeGreaterThan(50);
    expect(team(1).correct).toBe(2);
  });

  it('rafale interrompue par une erreur : timer réduit nettoyé aussi', () => {
    castDouble(3);
    useGameStore.setState({ currentTeam: 1 });
    S().askQuestion('maths');
    const wrong = (S().showQuestion.question.c + 1) % 4;
    S().answerQuestion(wrong, 10);
    expect(team(1).doubleActive).toBe(false);
    expect(team(1).doubleTimerDivisor).toBeUndefined();
    expect(team(1).doubleExtra).toBe(0);
    expect(team(1).doubleAsked).toBe(0);
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
    expect(S().showQuestion.multiTotal).toBe(2); // 1 base + 1 extra
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
