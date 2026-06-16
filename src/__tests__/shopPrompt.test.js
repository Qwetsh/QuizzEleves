// Tests : prompt « Visiter la boutique ? » (compteur turnsSinceShop + condition
// d'affichage) et helper cheapestStockPrice.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { ITEMS } from '../data/items.js';
import { cheapestStockPrice } from '../store/itemHandlers.js';
import { LOOT } from '../logic/balanceConfig.js';
import { defaultExtensions } from '../extensions/registry.js';

const CONS = 'painVoyageur';   // consommable commun
const CONS2 = 'sablierPoche';  // autre consommable
const S = () => useGameStore.getState();

// 1 seule équipe → nextTurn redonne la main à la même équipe (pratique pour
// observer le compteur). Stock figé (shopStockTurns élevé) pour qu'il ne se
// renouvelle pas pendant le test.
function setupShop(teamOver = {}, stockKeys = [CONS]) {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    teams: [{
      name: 'T', emoji: '🦁', color: '#111', money: 999, bag: [],
      equipment: { head: null, body: null, feet: null }, powers: {},
      starterChestOpened: true, turnsSinceShop: 0, ...teamOver,
    }],
    currentTeam: 0, finished: false, log: [],
    shopStock: stockKeys, shopStockTurns: 99,
    showShop: false, showShopPrompt: false,
    extensions: defaultExtensions(),
  });
}

describe('cheapestStockPrice', () => {
  it('Infinity sur un stock vide', () => {
    expect(cheapestStockPrice([])).toBe(Infinity);
    expect(cheapestStockPrice(null)).toBe(Infinity);
  });
  it('renvoie le prix minimum du stock', () => {
    expect(cheapestStockPrice([CONS, CONS2]))
      .toBe(Math.min(ITEMS[CONS].price, ITEMS[CONS2].price));
  });
  it('ignore les clés inconnues', () => {
    expect(cheapestStockPrice(['cle-bidon', CONS])).toBe(ITEMS[CONS].price);
  });
});

describe('compteur turnsSinceShop', () => {
  it('nextTurn incrémente le compteur de l’équipe qui regagne la main', () => {
    setupShop();
    S().nextTurn();
    expect(S().teams[0].turnsSinceShop).toBe(1);
    S().nextTurn();
    expect(S().teams[0].turnsSinceShop).toBe(2);
  });

  it('openShop remet le compteur à 0 et ferme le prompt', () => {
    setupShop({ turnsSinceShop: 5 });
    useGameStore.setState({ showShopPrompt: true });
    S().openShop();
    expect(S().showShop).toBe(true);
    expect(S().showShopPrompt).toBe(false);
    expect(S().teams[0].turnsSinceShop).toBe(0);
  });

  it('dismissShopPrompt = snooze : compteur remis à 0', () => {
    setupShop({ turnsSinceShop: 5 });
    useGameStore.setState({ showShopPrompt: true });
    S().dismissShopPrompt();
    expect(S().showShopPrompt).toBe(false);
    expect(S().teams[0].turnsSinceShop).toBe(0);
  });
});

describe('condition d’affichage du prompt', () => {
  it('proposé après shopPromptDelay tours quand l’équipe peut payer', () => {
    const delay = LOOT.shopPromptDelay ?? 3;
    setupShop({ money: ITEMS[CONS].price });
    for (let i = 1; i < delay; i++) {
      S().nextTurn();
      expect(S().showShopPrompt).toBe(false);
    }
    S().nextTurn(); // atteint le seuil
    expect(S().teams[0].turnsSinceShop).toBe(delay);
    expect(S().showShopPrompt).toBe(true);
  });

  it('PAS proposé si l’équipe n’a pas de quoi acheter', () => {
    setupShop({ money: ITEMS[CONS].price - 1 });
    for (let i = 0; i < (LOOT.shopPromptDelay ?? 3) + 1; i++) S().nextTurn();
    expect(S().showShopPrompt).toBe(false);
    // le compteur continue de monter même sans prompt
    expect(S().teams[0].turnsSinceShop).toBeGreaterThanOrEqual(LOOT.shopPromptDelay ?? 3);
  });

  it('PAS proposé si l’extension objets est désactivée', () => {
    setupShop({ turnsSinceShop: 10 });
    useGameStore.setState({ extensions: { equipment: false } });
    S().nextTurn();
    expect(S().showShopPrompt).toBe(false);
  });
});
