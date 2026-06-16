// Tests : effet « dé de mouvement » (moveDieSides) — transforme le dé en D4/D6/D10.
import { describe, it, expect, afterEach } from 'vitest';
import { moveDieSides } from '../logic/itemEffects.js';
import { ITEMS, setItemsData } from '../data/items.js';

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
