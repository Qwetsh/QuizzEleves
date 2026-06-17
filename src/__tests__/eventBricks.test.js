// Tests : nouvelles briques d'action du moteur pour l'éditeur d'événements —
// loseItem, cible allOthers + money 'give', curseTimer, curseExtraQuestion.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { runEffects } from '../store/effectEngine.js';

const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 8; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 8 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 9, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const mk = (i, over = {}) => ({
  name: `T${i}`, color: '#111', emoji: '🦁', pos: 'n4', money: 50, correct: 0, wrong: 0, streak: 0,
  powerDef: null, powerOff: null, powers: {}, sablierActif: false, doubleActive: false,
  equipment: { head: null, body: null, feet: null }, bag: [], ...over,
});

const S = () => useGameStore.getState();
const set = (p) => useGameStore.setState(p);
const get = () => S();
const exec = (actions, ctx = {}) => runEffects(set, get, actions, ctx);

function setup(teams) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, board: BOARD, currentTeam: 0, finished: false, log: [],
    teams, enabledItems: undefined, pendingActions: null, movePath: null,
    showQuestion: null, showEvent: null, showFight: null, showTargetPicker: null,
  });
}

beforeEach(() => setup([mk(0), mk(1), mk(2)]));

describe('loseItem', () => {
  it('retire un équipement à la cible', () => {
    setup([mk(0, { equipment: { head: 'chapeauPaille', body: null, feet: null } }), mk(1)]);
    exec([{ action: 'loseItem', target: 'self', category: 'equipment' }]);
    expect(S().teams[0].equipment.head).toBeNull();
  });

  it('repli sur l’or si aucun objet', () => {
    setup([mk(0, { money: 30 })]);
    exec([{ action: 'loseItem', target: 'self', fallbackGold: 10 }]);
    expect(S().teams[0].money).toBe(20);
  });
});

describe('money give + cible allOthers', () => {
  it('la source distribue de l’or à chaque autre équipe et paie le total', () => {
    setup([mk(0, { money: 50 }), mk(1, { money: 0 }), mk(2, { money: 0 })]);
    exec([{ action: 'money', mode: 'give', target: 'allOthers', n: 5, unit: 'flat' }], { sourceTeam: 0 });
    expect(S().teams[1].money).toBe(5);
    expect(S().teams[2].money).toBe(5);
    expect(S().teams[0].money).toBe(40); // a payé 2×5
  });

  it('voler à allOthers fait gagner la source (épargne la source)', () => {
    setup([mk(0, { money: 0 }), mk(1, { money: 10 }), mk(2, { money: 10 })]);
    exec([{ action: 'money', mode: 'steal', target: 'allOthers', n: 4, unit: 'flat' }], { sourceTeam: 0 });
    expect(S().teams[1].money).toBe(6);
    expect(S().teams[2].money).toBe(6);
    expect(S().teams[0].money).toBe(8); // récupère 4+4
  });
});

describe('malédictions', () => {
  it('curseTimer pose le timer réduit sur toutes les équipes', () => {
    exec([{ action: 'curseTimer', target: 'all', divisor: 2 }]);
    expect(S().teams.every((t) => t.sablierActif && t.sablierDivisor === 2)).toBe(true);
  });

  it('curseExtraQuestion ajoute des questions aux autres équipes', () => {
    exec([{ action: 'curseExtraQuestion', target: 'allOthers', n: 1 }], { sourceTeam: 0 });
    expect(S().teams[0].doubleActive).toBe(false);
    expect(S().teams[1].doubleActive).toBe(true);
    expect(S().teams[1].doubleExtra).toBe(1);
  });
});
