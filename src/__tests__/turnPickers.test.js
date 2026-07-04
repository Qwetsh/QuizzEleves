// Tests : manette téléphone — pouvoirs, consommables et pickers (Phase 3).
// Chaque intent est gardé par sa phase et délégué au handler TBI existant.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { normalizeBag, cellKey, cellN } from '../store/itemHandlers.js';

const S = () => useGameStore.getState();

const BOARD = {
  depart: { type: 'depart', x: 0, y: 0, next: ['a'] },
  a: { type: 'subject', subject: 'maths', x: 1, y: 0, next: ['b'] },
  b: { type: 'subject', subject: 'svt', x: 2, y: 0, next: ['c'] },
  c: { type: 'subject', subject: 'histoire', x: 3, y: 0, next: [] },
};

const RESET = {
  showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
  rolling: false, showDiceModal: false, awaitingChoice: false, pendingActions: null,
  pendingLanding: false, pendingMove: null, diceValue: null,
  showTargetPicker: null, showSubjectPicker: false, showChargePicker: false,
  indiceUsed: false, indiceHidden: [], rerollUsed: false,
};

let uidSeq = 500;
const uid = () => `tp-uid-${++uidSeq}`;

function setup(over = {}) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [],
    phoneController: true, board: BOARD, ...RESET,
    teams: [
      { name: 'A', emoji: '🦁', color: '#111', money: 50, token: 'tA', pos: 'a', correct: 0, wrong: 0, equipment: { head: null, body: null, feet: null }, bag: [], powers: {} },
      { name: 'B', emoji: '🦅', color: '#222', money: 50, token: 'tB', pos: 'b', correct: 0, wrong: 0, equipment: { head: null, body: null, feet: null }, bag: [], powers: {} },
    ],
    ...over,
  });
}

describe('turnUseConsumable', () => {
  it('consomme UNE unité, résolue par clé (sac compacté ≠ sac positionnel)', () => {
    setup();
    useGameStore.setState({ teams: [{ ...S().teams[0], bag: [null, { key: 'painVoyageur', n: 2 }] }, S().teams[1]] });
    S().applyTeamIntent('tA', 'turnUseConsumable', { key: 'painVoyageur', uid: uid() });
    const cell = normalizeBag(S().teams[0].bag).find((cl) => cellKey(cl) === 'painVoyageur');
    expect(cellN(cell)).toBe(1); // une unité consommée
  });

  it('clé absente du sac : no-op', () => {
    setup();
    expect(() => S().applyTeamIntent('tA', 'turnUseConsumable', { key: 'painVoyageur', uid: uid() })).not.toThrow();
  });

  it('équipe non active : refusé', () => {
    setup();
    useGameStore.setState({ teams: [S().teams[0], { ...S().teams[1], bag: ['painVoyageur'] }] });
    S().applyTeamIntent('tB', 'turnUseConsumable', { key: 'painVoyageur', uid: uid() });
    expect(cellN(normalizeBag(S().teams[1].bag).find((cl) => cellKey(cl) === 'painVoyageur'))).toBe(1);
  });
});

describe('turnSelectTarget / turnCancelTarget', () => {
  it('cible sous Immunité totale : refusée (picker toujours ouvert)', () => {
    setup({ showTargetPicker: { powerKey: 'foudre' } });
    useGameStore.setState({ teams: [S().teams[0], { ...S().teams[1], totalImmuneTurns: 2 }] });
    S().applyTeamIntent('tA', 'turnSelectTarget', { index: 1, uid: uid() });
    expect(S().showTargetPicker).not.toBeNull();
  });

  it('se cibler sans allowSelf : refusé', () => {
    setup({ showTargetPicker: { powerKey: 'foudre' } });
    S().applyTeamIntent('tA', 'turnSelectTarget', { index: 0, uid: uid() });
    expect(S().showTargetPicker).not.toBeNull();
  });

  it('hors phase (pas de picker) : no-op', () => {
    setup();
    expect(() => S().applyTeamIntent('tA', 'turnSelectTarget', { index: 1, uid: uid() })).not.toThrow();
  });

  it('turnCancelTarget ferme le picker', () => {
    setup({ showTargetPicker: { powerKey: 'foudre' } });
    S().applyTeamIntent('tA', 'turnCancelTarget', { uid: uid() });
    expect(S().showTargetPicker).toBeNull();
  });
});

describe('turnSelectSubject', () => {
  it('Relance opportune : le thème choisi lance la question', () => {
    setup({
      showSubjectPicker: { source: 'opportune' },
      askedQuestions: {},
      questions: { maths: [{ q: '1+1 ?', a: ['2', '3', '4', '5'], c: 0, e: '' }] },
    });
    S().applyTeamIntent('tA', 'turnSelectSubject', { key: 'maths', uid: uid() });
    expect(S().showSubjectPicker).toBe(false);
    expect(S().showQuestion?.subject).toBe('maths');
  });

  it('hors phase : no-op', () => {
    setup();
    S().applyTeamIntent('tA', 'turnSelectSubject', { key: 'maths', uid: uid() });
    expect(S().showQuestion).toBeNull();
  });
});

describe('turnChargePick / turnChargeSkip', () => {
  it('recharge le pouvoir choisi (+1, plafonné)', () => {
    setup({ showChargePicker: { amount: 1 } });
    useGameStore.setState({ teams: [{ ...S().teams[0], powers: { foudre: { level: 1, charges: 1 } } }, S().teams[1]] });
    S().applyTeamIntent('tA', 'turnChargePick', { key: 'foudre', uid: uid() });
    expect(S().teams[0].powers.foudre.charges).toBe(2);
    expect(S().showChargePicker).toBe(false);
  });

  it('turnChargeSkip ferme sans recharger', () => {
    setup({ showChargePicker: { amount: 1 } });
    useGameStore.setState({ teams: [{ ...S().teams[0], powers: { foudre: { level: 1, charges: 1 } } }, S().teams[1]] });
    S().applyTeamIntent('tA', 'turnChargeSkip', { uid: uid() });
    expect(S().teams[0].powers.foudre.charges).toBe(1);
    expect(S().showChargePicker).toBe(false);
  });

  it('équipe non active : refusé', () => {
    setup({ showChargePicker: { amount: 1 } });
    S().applyTeamIntent('tB', 'turnChargePick', { key: 'foudre', uid: uid() });
    expect(S().showChargePicker).not.toBe(false);
  });
});

describe('turnUsePower', () => {
  it('pouvoir sans charge : no-op silencieux', () => {
    setup();
    expect(() => S().applyTeamIntent('tA', 'turnUsePower', { key: 'foudre', uid: uid() })).not.toThrow();
  });

  it('clé invalide : no-op silencieux', () => {
    setup();
    expect(() => S().applyTeamIntent('tA', 'turnUsePower', { key: 'zzz', uid: uid() })).not.toThrow();
    expect(() => S().applyTeamIntent('tA', 'turnUsePower', { uid: uid() })).not.toThrow();
  });
});
