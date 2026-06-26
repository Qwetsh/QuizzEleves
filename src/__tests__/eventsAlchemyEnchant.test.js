// Événements liés aux extensions Alchimie/Enchantement : gating `requires` +
// nouvelles actions moteur (grantIngredient, discoverRecipe, enchantEquipped, unenchant).
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { pickRandomEvent } from '../logic/eventPicker.js';
import { cellKey, cellEnchants } from '../store/itemHandlers.js';
import { itemEnchantsOf } from '../logic/itemEffects.js';
import { ITEMS } from '../data/items.js';
import { setCustomRecipes } from '../data/recipes.js';

const S = () => useGameStore.getState();
function team(over = {}) {
  return { name: 'T', emoji: '🦁', color: '#111', pos: 'n1', money: 30, correct: 0, wrong: 0, powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], knownRecipes: [], ...over };
}
function setup(over) {
  useGameStore.setState({ phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [], teams: [team(over), team()], lootReveal: null });
}

describe('gating `requires` des événements', () => {
  it('un event requires:[alchemy] est exclu si l\'extension est coupée', () => {
    // herboriste a requires:['alchemy']
    expect(pickRandomEvent(['herboriste'], { extensions: { alchemy: false } })).toBeNull();
    expect(pickRandomEvent(['herboriste'], { extensions: { alchemy: true } }).key).toBe('herboriste');
    // scribeAmbulant requires:['enchant']
    expect(pickRandomEvent(['scribeAmbulant'], { extensions: { enchant: false } })).toBeNull();
    expect(pickRandomEvent(['scribeAmbulant'], { extensions: { enchant: true } }).key).toBe('scribeAmbulant');
  });
});

describe('actions moteur alchimie/enchantement', () => {
  beforeEach(() => setup());

  it('grantIngredient donne N ingrédients au sac', () => {
    S().engineGrantIngredient(0, 2);
    const ings = S().teams[0].bag.filter((c) => ITEMS[cellKey(c)]?.family === 'ingredient');
    expect(ings.reduce((s, c) => s + (typeof c === 'object' ? (c.n || 1) : 1), 0)).toBe(2);
  });

  it('discoverRecipe ajoute une recette au grimoire', () => {
    // Les recettes viennent de la DB au runtime ; on en injecte une pour le test.
    setCustomRecipes([{ id: 'r-test', ingredients: ['herbeSolaire', 'roseeMatin', 'champNuit'], potion: 'pot000102' }]);
    expect(S().teams[0].knownRecipes).toHaveLength(0);
    S().engineDiscoverRecipe(0);
    expect(S().teams[0].knownRecipes).toContain('r-test');
    setCustomRecipes([]); // nettoyage
  });

  it('enchantEquipped enchante une pièce équipée (gratuit)', () => {
    setup({ equipment: { head: null, body: null, feet: 'bottesMontagne' } });
    S().engineEnchantEquipped(0);
    expect(cellEnchants(S().teams[0].equipment.feet).length).toBe(1);
  });

  it('enchantEquipped ne fait rien sans pièce équipée', () => {
    setup({ equipment: { head: null, body: null, feet: null } });
    S().engineEnchantEquipped(0); // no-op (pas de crash)
    expect(S().teams[0].equipment.feet).toBeNull();
  });

  it('unenchant retire un enchantement d\'une pièce', () => {
    setup({ equipment: { head: null, body: null, feet: { key: 'bottesMontagne', enchants: [{ type: 'timerBonus', value: 3 }] } } });
    S().engineUnenchant(0);
    expect(itemEnchantsOf(S().teams[0].equipment.feet)).toHaveLength(0);
  });
});
