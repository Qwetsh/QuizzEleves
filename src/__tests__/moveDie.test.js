// Tests : effet « dé de mouvement » (moveDieSides) — transforme le dé en D4/D6/D10
// + effet « Question Hardcore (X%) » (hardcoreChance).
import { describe, it, expect, afterEach } from 'vitest';
import { moveDieSides } from '../logic/itemEffects.js';
import { ITEMS, setItemsData } from '../data/items.js';
import { useGameStore } from '../store/gameStore.js';

const S = () => useGameStore.getState();

const mkTeam = (over = {}) => ({
  equipment: { head: null, body: null, feet: null }, bag: [], powers: {}, buffs: [], ...over,
});

describe('moveDieSides', () => {
  const snapshot = { ...ITEMS };
  afterEach(() => setItemsData(snapshot));

  it('6 faces par défaut', () => {
    expect(moveDieSides(mkTeam())).toBe(6);
  });

  it('buff moveDieSides applique les faces (D10)', () => {
    expect(moveDieSides(mkTeam({ buffs: [{ type: 'moveDieSides', n: 10 }] }))).toBe(10);
    expect(moveDieSides(mkTeam({ buffs: [{ type: 'moveDieSides', n: 4 }] }))).toBe(4);
  });

  it('valeur non autorisée ignorée (retombe sur 6)', () => {
    expect(moveDieSides(mkTeam({ buffs: [{ type: 'moveDieSides', n: 8 }] }))).toBe(6);
  });

  it('plusieurs buffs : le DERNIER posé prime', () => {
    expect(moveDieSides(mkTeam({ buffs: [{ type: 'moveDieSides', n: 10 }, { type: 'moveDieSides', n: 4 }] }))).toBe(4);
    expect(moveDieSides(mkTeam({ buffs: [{ type: 'moveDieSides', n: 4 }, { type: 'moveDieSides', n: 10 }] }))).toBe(10);
  });

  it('effet d’équipement (passif) pris en compte, le plus grand dé', () => {
    setItemsData({
      ...snapshot,
      deTruque: { name: 'Dé truqué', icon: '🎲', slot: 'head', rarity: 'rare', price: 0, effects: [{ type: 'moveDieSides', value: 10 }] },
    });
    expect(moveDieSides(mkTeam({ equipment: { head: 'deTruque', body: null, feet: null } }))).toBe(10);
  });

  it('un buff ACTIF (malus D4) prime sur un équipement passif D10', () => {
    setItemsData({
      ...snapshot,
      deTruque: { name: 'Dé truqué', icon: '🎲', slot: 'head', rarity: 'rare', price: 0, effects: [{ type: 'moveDieSides', value: 10 }] },
    });
    const team = mkTeam({ equipment: { head: 'deTruque', body: null, feet: null }, buffs: [{ type: 'moveDieSides', n: 4, turns: 3 }] });
    expect(moveDieSides(team)).toBe(4);
  });
});

describe('hardcoreChance (Question Hardcore X%)', () => {
  const snap = { ...ITEMS };
  afterEach(() => setItemsData(snap));

  function setup(hc, withHardcorePool = true) {
    setItemsData({
      ...snap,
      casqueHC: { name: 'Casque maudit', icon: '💀', slot: 'head', rarity: 'rare', price: 0, effects: [{ type: 'hardcoreChance', value: hc }] },
    });
    useGameStore.setState({
      phase: 'game', devSandbox: true,
      teams: [{ name: 'T', emoji: '🦁', color: '#111', money: 0, correct: 0, wrong: 0, streak: 0, powers: {}, equipment: { head: 'casqueHC', body: null, feet: null }, bag: [] }],
      currentTeam: 0, forcedSubject: null,
      questions: {
        maths: [{ q: 'M ?', a: ['a', 'b', 'c', 'd'], c: 0 }],
        ...(withHardcorePool ? { hardcore: [{ q: 'HC ?', a: ['a', 'b', 'c', 'd'], c: 0 }] } : {}),
      },
      askedQuestions: {}, log: [], showQuestion: null,
    });
  }

  it('100% → question forcée en Hardcore', () => {
    setup(100);
    S().askQuestion('maths');
    expect(S().showQuestion.subject).toBe('hardcore');
  });

  it('0% → question normale (maths)', () => {
    setup(0);
    S().askQuestion('maths');
    expect(S().showQuestion.subject).toBe('maths');
  });

  it('aucun pool Hardcore → reste normal même à 100%', () => {
    setup(100, false);
    S().askQuestion('maths');
    expect(S().showQuestion.subject).toBe('maths');
  });
});
