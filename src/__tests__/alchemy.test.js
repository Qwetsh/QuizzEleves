// Extension « Alchimie » : recettes (multiset), distillation, découverte.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { craftPotion } from '../store/itemHandlers.js';
import { matchRecipe, RECIPES } from '../data/recipes.js';
import { ITEMS } from '../data/items.js';

const set = (p) => useGameStore.setState(p);
const get = () => useGameStore.getState();
const S = () => useGameStore.getState();

function team(over = {}) {
  return { name: 'T', emoji: '🦁', color: '#111', pos: 'n1', money: 50, correct: 0, wrong: 0, powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], ...over };
}
function setup(bag) {
  useGameStore.setState({ phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [], teams: [team({ bag })] });
}

describe('recettes (matchRecipe)', () => {
  it('reconnaît une recette quel que soit l’ordre', () => {
    const r = RECIPES[0]; // or : herbeDoree + fleurLune + champignonBleu
    expect(matchRecipe([...r.ingredients].reverse())?.id).toBe(r.id);
  });
  it('renvoie null sans recette', () => {
    expect(matchRecipe(['herbeDoree', 'herbeDoree', 'herbeDoree'])).toBeNull();
    expect(matchRecipe(['herbeDoree', 'fleurLune'])).toBeNull(); // pas 3
  });
});

describe('craftPotion', () => {
  beforeEach(() => setup(['herbeDoree', 'fleurLune', 'champignonBleu']));

  it('distille la bonne potion, consomme les ingrédients et découvre la recette', () => {
    const r = craftPotion(set, get, 0, [0, 1, 2]);
    expect(r.ok).toBe(true);
    expect(r.potion).toBe('potionOr');
    expect(r.discovered).toBe(true);
    const bag = S().teams[0].bag;
    expect(bag.some((c) => (typeof c === 'string' ? c : c?.key) === 'potionOr')).toBe(true);
    expect(bag.filter((c) => (typeof c === 'string' ? c : c?.key) === 'herbeDoree').length).toBe(0);
    expect(S().teams[0].knownRecipes).toContain('or');
  });

  it('distillation ratée si aucune recette (ingrédients consommés)', () => {
    setup(['herbeDoree', 'racinePierre', 'aileFee']); // pas une recette
    const r = craftPotion(set, get, 0, [0, 1, 2]);
    expect(r.ok).toBe(false);
    expect(S().teams[0].bag.filter(Boolean).length).toBe(0); // tout consommé
  });

  it('refuse si une case n’est pas un ingrédient', () => {
    setup(['herbeDoree', 'fleurLune', 'bouclierBois']); // bouclierBois = consommable normal
    const r = craftPotion(set, get, 0, [0, 1, 2]);
    expect(r.ok).toBe(false);
    expect(S().teams[0].bag.filter(Boolean).length).toBe(3); // rien consommé
  });
});

describe('ingrédient utilisé seul → révélation', () => {
  it('révèle l’ingrédient dans le grimoire', () => {
    setup(['herbeDoree']);
    S().useConsumable(0);
    expect(S().teams[0].knownIngredients).toContain('herbeDoree');
  });
});
