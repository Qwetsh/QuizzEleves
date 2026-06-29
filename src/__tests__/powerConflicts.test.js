// Tests d'INTERACTION entre les nouvelles features de pouvoirs : on empile
// volontairement les mécaniques pour vérifier qu'elles cohabitent sans conflit
// (timer multi-sources, reculs en chaîne, Glaneur pendant une rafale, plafonds,
// charges des ultimes actifs).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '../store/gameStore.js';

const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 16; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 16 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 17, y: 0, type: 'arrivee', next: [] };
  return b;
})();
const Q = [{ q: '?', a: ['A', 'B', 'C', 'D'], c: 1, e: '' }, { q: '?2', a: ['A', 'B', 'C', 'D'], c: 2, e: '' }];
const HC = [{ q: 'HC', a: ['A', 'B', 'C', 'D'], c: 0, e: '' }];

const mk = (over = {}) => ({
  name: 'T', emoji: '🦁', color: '#111', pos: 'n8', money: 100, correct: 0, wrong: 0, streak: 0,
  powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], ...over,
});
const withPower = (key, lvl, spec, over = {}) => mk({ powers: { [key]: { charges: 5, level: lvl, ...(spec || {}) } }, ...over });

const S = () => useGameStore.getState();
const base = (teams, extra = {}) => useGameStore.setState({
  phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
  extensions: { equipment: true, mastery: true }, questions: { maths: Q, hardcore: HC }, askedQuestions: {},
  rolling: false, diceValue: null, pendingMove: null, pendingLanding: false, awaitingChoice: false,
  showQuestion: null, showEvent: null, showFight: null, showTargetPicker: null, showChargePicker: false,
  showDiceModal: false, indiceUsed: false, indiceUses: 0, indiceHidden: [], freeActivation: false,
  movePath: null, preRollPos: 'n7', preRollValue: 2, pendingActions: null, showTilePicker: null,
  showSubjectPicker: false, rerollUsed: false, trapDepth: 0, emitVfx: () => {},
  teams, ...extra,
});

describe('conflits — timer multi-sources (askQuestion)', () => {
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it('Sablier (÷4) + Sablier brisé (cap 7) + Temps commun : timerCap propagé, pas de crash', () => {
    base([{ ...withPower('sablier', 10), sablierActif: true, sablierDivisor: 4, maxTimerCap: 7,
      doubleActive: true, doubleExtra: 1, doubleSharedTimer: true, doubleSharedCut: 5 }]);
    S().askQuestion('maths');
    const q = S().showQuestion;
    expect(q).toBeTruthy();
    expect(q.timerCap).toBe(7);
    expect(q.timerDivisor).toBeGreaterThanOrEqual(4);
    // sablier one-shot consommé
    expect(S().teams[0].sablierActif).toBe(false);
  });

  it('Auto-ciblage (timeCredit) + Modeleur : bonus de temps appliqué, modeleur passé', () => {
    base([{ ...withPower('sablier', 10), timeCredit: 60, modeleurInterval: 3 }]);
    S().askQuestion('maths');
    const q = S().showQuestion;
    expect(q.itemBonusTime).toBeGreaterThanOrEqual(60); // crédit de temps pris en compte
    expect(q.modeleur).toBe(3);
    expect(S().teams[0].timeCredit).toBe(0); // consommé
    expect(S().teams[0].modeleurInterval).toBeUndefined(); // consommé
  });
});

describe('conflits — reculs en chaîne Foudre', () => {
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it('Réaction en chaîne : une 3e équipe sur le trajet recule aussi, le lanceur jamais', () => {
    // Lanceur en n2 ; cible en n10 ; une 3e équipe en n6 (sur le trajet de recul).
    base([
      { ...withPower('foudre', 9, { spec5: 'reaction' }), pos: 'n2' },
      { ...mk(), pos: 'n10' },
      { ...mk(), pos: 'n6' },
    ], { showTargetPicker: { powerKey: 'foudre' } });
    S().applyOffensivePower(1);
    expect(S().teams[1].pos).not.toBe('n10');     // cible reculée
    expect(S().teams[2].pos).not.toBe('n6');       // 3e équipe (sur le trajet) reculée aussi
    expect(S().teams[0].pos).toBe('n2');           // lanceur jamais touché
  });

  it('Cataclysme + Orage : multi-cibles reculées + DoT posé, sans boucle', () => {
    base([
      { ...withPower('foudre', 10, { spec10: 'orage' }), pos: 'n2' },
      { ...mk(), pos: 'n10' },
      { ...mk(), pos: 'n12' },
    ], { showTargetPicker: { powerKey: 'foudre' } });
    // L'ultime choisi est Orage (DoT) ; on vérifie au moins le DoT posé + recul cible.
    S().applyOffensivePower(1);
    expect(S().teams[1].orageRecul).toMatchObject({ turns: 2 });
    expect(S().teams[1].pos).not.toBe('n10');
  });
});

describe('conflits — Glaneur pendant rafale Double/Saboteur', () => {
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.9)); // > chances bonus
  afterEach(() => vi.restoreAllMocks());

  it('Glaneur (équipe 1, passive) glane l’or quand l’équipe 0 (Saboteur) répond faux', () => {
    base([
      { ...mk({ money: 100 }), doubleActive: true, doubleExtra: 1, doubleSaboteur: 2 }, // équipe qui répond, sous Saboteur
      { ...withPower('sablier', 10, { spec10: 'glaneur' }), money: 0 },                  // Glaneur passif
    ], {
      currentTeam: 0,
      showQuestion: { question: Q[0], subject: 'maths', timerHalved: false, timerDivisor: 1, itemBonusTime: 0 },
    });
    const before = S().teams[1].money;
    S().answerQuestion(0, 0); // mauvaise réponse (c=1), timeLeft 0
    expect(S().teams[1].money).toBeGreaterThan(before); // Glaneur a glané le gain non obtenu
    expect(S().teams[0].doubleActive).toBe(false);       // rafale stoppée (erreur)
  });
});

describe('conflits — plafonds & charges', () => {
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.9));
  afterEach(() => vi.restoreAllMocks());

  it('Surcharge permanente : doubleExtra plafonné à 4 même en cumulant', () => {
    base([
      withPower('double', 10, { spec10: 'surcharge' }),
      { ...mk(), pos: 'n8' },
    ], { showTargetPicker: { powerKey: 'double' } });
    S().applyOffensivePower(1); // add 3 (L10) + 2 (surcharge) = 5 → plafond 4
    expect(S().teams[1].doubleExtra).toBe(4);
    // 2e cast : reste plafonné
    useGameStore.setState({ showTargetPicker: { powerKey: 'double' } });
    S().applyOffensivePower(1);
    expect(S().teams[1].doubleExtra).toBe(4);
  });

  it('ultimes actifs : consomment EXACTEMENT 5 charges, pas de re-cast', () => {
    // Clairvoyance
    base([withPower('indice', 10, { spec10: 'clairvoyance' })], {
      showQuestion: { question: Q[0], subject: 'maths', timerDivisor: 1, itemBonusTime: 0 },
    });
    S().useClairvoyance();
    expect(S().teams[0].powers.indice.charges).toBe(0);
    S().useClairvoyance(); // re-cast : ignoré (déjà actif + 0 charge)
    expect(S().teams[0].powers.indice.charges).toBe(0);

    // Sablier brisé
    base([withPower('sablier', 10, { spec10: 'broken' }), { ...mk(), pos: 'n8' }]);
    S().useSablierBroken();
    expect(S().teams[0].powers.sablier.charges).toBe(0);
    expect(S().teams[1].maxTimerCap).toBe(7);
  });
});
