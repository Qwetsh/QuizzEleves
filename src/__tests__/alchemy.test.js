// Extension « Alchimie » : recettes (multiset), distillation, découverte.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { craftPotion, generateShopStock, generateBlackMarketStock, pickLootItem, cellN } from '../store/itemHandlers.js';
import { matchRecipe, RECIPES, setCustomRecipes } from '../data/recipes.js';
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

// Refonte 2026-06 : plus de recettes intégrées en dur (BASE_RECIPES = []). Les
// recettes viennent de la base via setCustomRecipes. On en pose une de test.
const TEST_RECIPE = { id: 'or', ingredients: ['herbeDoree', 'fleurLune', 'champignonBleu'], potion: 'potionOr' };

describe('recettes (matchRecipe)', () => {
  beforeEach(() => setCustomRecipes([TEST_RECIPE]));
  afterEach(() => setCustomRecipes([]));
  it('reconnaît une recette quel que soit l’ordre', () => {
    expect(matchRecipe([...TEST_RECIPE.ingredients].reverse())?.id).toBe('or');
  });
  it('renvoie null sans recette', () => {
    expect(matchRecipe(['herbeDoree', 'herbeDoree', 'herbeDoree'])).toBeNull();
    expect(matchRecipe(['herbeDoree', 'fleurLune'])).toBeNull(); // pas 3
  });
});

describe('recettes personnalisées (éditeur)', () => {
  afterEach(() => setCustomRecipes([]));

  it('une recette custom est ajoutée et matchée (ordre indifférent)', () => {
    setCustomRecipes([{ id: 'custom1', ingredients: ['aileFee', 'racinePierre', 'larmeCristal'], potion: 'potionOr' }]);
    expect(RECIPES.some((r) => r.id === 'custom1')).toBe(true);
    expect(matchRecipe(['larmeCristal', 'aileFee', 'racinePierre'])?.potion).toBe('potionOr');
  });

  it('plusieurs recettes custom coexistent', () => {
    setCustomRecipes([
      { id: 'a', ingredients: ['aileFee', 'racinePierre', 'larmeCristal'], potion: 'potionOr' },
      TEST_RECIPE,
    ]);
    expect(matchRecipe(['herbeDoree', 'fleurLune', 'champignonBleu'])?.id).toBe('or');
    expect(matchRecipe(['racinePierre', 'aileFee', 'larmeCristal'])?.id).toBe('a');
  });
});

describe('craftPotion', () => {
  beforeEach(() => { setCustomRecipes([TEST_RECIPE]); setup(['herbeDoree', 'fleurLune', 'champignonBleu']); });
  afterEach(() => setCustomRecipes([]));

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

  it('sac plein : fusion annulée, ingrédients NON consommés, aucune potion perdue', () => {
    // 9 cases « pleines » distinctes (ni ingrédient ni potion) + 3 ingrédients à
    // 2 exemplaires (consommer n'en libère donc PAS la case) = sac de 12 saturé.
    const fillers = Object.keys(ITEMS)
      .filter((k) => ITEMS[k].family !== 'ingredient' && ITEMS[k].family !== 'potion')
      .slice(0, 9);
    expect(fillers.length).toBe(9); // garde-fou : assez d'objets pour saturer
    setup([
      { key: 'herbeDoree', n: 2 }, { key: 'fleurLune', n: 2 }, { key: 'champignonBleu', n: 2 },
      ...fillers,
    ]);
    const r = craftPotion(set, get, 0, [0, 1, 2]);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('sac plein');
    const bag = S().teams[0].bag;
    const keyOf = (c) => (typeof c === 'string' ? c : c?.key);
    expect(bag.some((c) => keyOf(c) === 'potionOr')).toBe(false);      // potion PAS perdue/refusée
    expect(bag.filter((c) => keyOf(c) === 'herbeDoree' && cellN(c) === 2).length).toBe(1); // ingrédients intacts
  });
});

// Régression : le mobile publie un sac COMPACTÉ (filter(Boolean)) tandis que le
// TBI a un sac POSITIONNEL avec des trous. Envoyer des index décalait la sélection
// dès qu'une case se libérait → distillation silencieuse sans consommer (le bug
// « après 4 potions ça ne marche plus, composants pas utilisés »). On envoie
// désormais les CLÉS et le TBI les résout sur son sac positionnel.
describe('craft via intent mobile (clés sur sac positionnel fragmenté)', () => {
  beforeEach(() => setCustomRecipes([TEST_RECIPE]));
  afterEach(() => setCustomRecipes([]));

  it('résout les clés même avec des trous/potions intercalés dans le sac', () => {
    // Sac TBI fragmenté : potion en tête, deux trous, puis les 3 ingrédients.
    // Avec des index, le mobile (sac compacté [potionOr, herbe, fleur, champ])
    // aurait envoyé [1,2,3] → côté TBI = [null, null, herbeDoree] → échec muet.
    const bag = ['potionOr', null, null, 'herbeDoree', 'fleurLune', 'champignonBleu'];
    useGameStore.setState({
      phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [],
      showQuestion: false, showEvent: false, showFight: false, showDuelChoice: false,
      rolling: false, showDiceModal: false, awaitingChoice: false, pendingActions: null, pendingLanding: null,
      teams: [team(), team({ token: 'TK', bag, pos: 'n1' })],
    });
    get().applyTeamIntent('TK', 'craft', { keys: ['herbeDoree', 'fleurLune', 'champignonBleu'] });
    const t = S().teams[1];
    const keyOf = (c) => (typeof c === 'string' ? c : c?.key);
    // Ingrédients consommés et potion bien créée (empilée sur la potionOr existante).
    expect(t.bag.filter((c) => keyOf(c) === 'herbeDoree').length).toBe(0);
    expect(t.bag.filter((c) => keyOf(c) === 'fleurLune').length).toBe(0);
    expect(t.bag.some((c) => keyOf(c) === 'potionOr' && cellN(c) === 2)).toBe(true);
    expect(t.knownRecipes).toContain('or');
  });
});

describe('extension OFF : aucune fuite des familles (ingrédient/potion/parchemin)', () => {
  const allKeys = Object.keys(ITEMS);
  const isFamily = (k) => !!ITEMS[k]?.family;
  // Sanity : le catalogue contient bien des objets à famille (sinon le test ne prouve rien).
  it('le catalogue contient des objets à famille', () => {
    expect(allKeys.some(isFamily)).toBe(true);
  });
  it('boutique : aucune famille par défaut', () => {
    for (let i = 0; i < 20; i++) expect(generateShopStock(allKeys).some(isFamily)).toBe(false);
  });
  it('boutique : ingrédients OK mais jamais potion/parchemin', () => {
    for (let i = 0; i < 20; i++) {
      const stock = generateShopStock(allKeys, ['ingredient']);
      expect(stock.some((k) => ITEMS[k].family === 'potion' || ITEMS[k].family === 'parchment')).toBe(false);
    }
  });
  it('loot aléatoire : aucune famille', () => {
    for (let i = 0; i < 80; i++) { const k = pickLootItem(0.3, allKeys); if (k) expect(isFamily(k)).toBe(false); }
  });
  it('Marché Noir : aucune famille', () => {
    expect(generateBlackMarketStock(30, allKeys).some(isFamily)).toBe(false);
  });
});

describe('ingrédient utilisé seul → révélation', () => {
  it('révèle l’ingrédient dans le grimoire', () => {
    setup(['herbeDoree']);
    S().useConsumable(0);
    expect(S().teams[0].knownIngredients).toContain('herbeDoree');
  });
});
