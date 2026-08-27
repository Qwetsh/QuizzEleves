// Bug « sac plein » à la création d'enchantement : le catalogue d'objets est
// remplacé au boot par la table DB (setItemsData), qui NE contient PAS le
// « parchemin gravé » (item INTERNE produit par le craft, lootOnly). S'il
// disparaissait d'ITEMS, placeItem le prenait pour une clé inconnue → craft
// refusé avec un message « sac plein » trompeur. setItemsData doit donc toujours
// réinjecter les objets internes du moteur (INTERNAL_ITEM_KEYS) depuis le code.
import { describe, it, expect, afterAll } from 'vitest';
import { ITEMS, BASE_ITEMS, INTERNAL_ITEM_KEYS, setItemsData } from '../data/items.js';
import { useGameStore } from '../store/gameStore.js';
import { craftParchment, cellKey } from '../store/itemHandlers.js';

const set = (p) => useGameStore.setState(p);
const get = () => useGameStore.getState();
const S = () => useGameStore.getState();

// Catalogue « DB » minimal SANS parcheminGrave (comme la vraie table quete_items).
const DB_LIKE = {
  bottesMontagne: { ...BASE_ITEMS.bottesMontagne },
  parcheminVierge: { ...BASE_ITEMS.parcheminVierge },
};

describe('objets internes du moteur préservés au remplacement du catalogue (DB)', () => {
  afterAll(() => setItemsData(BASE_ITEMS)); // restaure le catalogue complet

  it('setItemsData réinjecte parcheminGrave même absent des données DB', () => {
    expect(INTERNAL_ITEM_KEYS).toContain('parcheminGrave');
    setItemsData(DB_LIKE);
    expect(ITEMS.parcheminVierge).toBeTruthy();
    expect(ITEMS.parcheminGrave).toBeTruthy();       // réinjecté depuis le code
    expect(ITEMS.parcheminGrave.slot).toBe('consumable');
  });

  it('craftParchment réussit (pas de faux « sac plein ») après remplacement DB', () => {
    setItemsData(DB_LIKE);
    useGameStore.setState({
      phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [],
      teams: [{ name: 'T', emoji: '🦁', color: '#111', pos: 'n1', money: 50, correct: 0, wrong: 0, powers: {}, equipment: { head: null, body: null, feet: 'bottesMontagne' }, bag: ['parcheminVierge'] }],
    });
    const r = craftParchment(set, get, 0, 0, [{ id: 'timerBonus', value: 5 }]);
    expect(r.ok).toBe(true);
    expect(r.reason).toBeUndefined();
    expect(S().teams[0].bag.some((c) => cellKey(c) === 'parcheminGrave')).toBe(true);
  });
});
