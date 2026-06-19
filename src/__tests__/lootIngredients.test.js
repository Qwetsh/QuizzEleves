// Loot d'ingrédients : tirage PONDÉRÉ + affinité de matière favorite.
import { describe, it, expect, afterEach } from 'vitest';
import { pickLootIngredient } from '../store/itemHandlers.js';
import { LOOT } from '../logic/balanceConfig.js';

// Ingrédients présents dans le catalogue code (items.js) — family 'ingredient'.
const ING = ['herbeDoree', 'champignonBleu'];

afterEach(() => { LOOT.ingredients = {}; });

describe('pickLootIngredient', () => {
  it('la matière favorite augmente fortement la fréquence', () => {
    LOOT.ingredients = { herbeDoree: { weight: 1, favSubject: 'svt', favMult: 20 }, champignonBleu: { weight: 1 } };
    let h = 0;
    for (let i = 0; i < 400; i++) if (pickLootIngredient(ING, 'svt') === 'herbeDoree') h++;
    expect(h).toBeGreaterThan(300); // ~95 %
  });

  it('hors matière favorite, le tirage reste équilibré', () => {
    LOOT.ingredients = { herbeDoree: { weight: 1, favSubject: 'svt', favMult: 20 }, champignonBleu: { weight: 1 } };
    let h = 0;
    for (let i = 0; i < 400; i++) if (pickLootIngredient(ING, 'maths') === 'herbeDoree') h++;
    expect(h).toBeGreaterThan(120);
    expect(h).toBeLessThan(280);
  });

  it('ne renvoie que des ingrédients du pool', () => {
    LOOT.ingredients = {};
    for (let i = 0; i < 30; i++) expect(ING).toContain(pickLootIngredient(ING, 'svt'));
  });

  it('null si le pool ne contient aucun ingrédient', () => {
    expect(pickLootIngredient(['bouclierBois'], 'svt')).toBeNull();
  });
});
