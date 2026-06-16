// Tests : piles de consommables (stacking) + coffre de départ à triple choix.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { ITEMS } from '../data/items.js';
import {
  placeItem, normalizeBag, cellKey, cellN, bagUnitCount, canReceiveItem, STACK_MAX,
} from '../store/itemHandlers.js';

const CONS = 'painVoyageur';   // consommable commun (gainMoney)
const CONS2 = 'sablierPoche';  // autre consommable
const EQUIP = 'chapeauPaille'; // équipement (ne se stacke pas)

const S = () => useGameStore.getState();
const occupied = (bag) => normalizeBag(bag).filter(Boolean);

function setupGame(bag = [], over = {}) {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    teams: [{ name: 'T', emoji: '🦁', color: '#111', money: 50, bag, equipment: { head: null, body: null, feet: null }, powers: {}, ...over }],
    currentTeam: 0, finished: false, log: [], showInventory: false,
  });
}

describe('stacking : modèle de pile', () => {
  it('placeItem empile les consommables identiques dans une seule case', () => {
    let team = { equipment: { head: null, body: null, feet: null }, bag: [], money: 0 };
    for (let i = 0; i < 3; i++) team = placeItem(team, CONS).team;
    const bag = occupied(team.bag);
    expect(bag.length).toBe(1);
    expect(cellKey(bag[0])).toBe(CONS);
    expect(cellN(bag[0])).toBe(3);
    expect(bagUnitCount(team.bag)).toBe(3);
  });

  it('consommables différents occupent des cases distinctes', () => {
    let team = { equipment: {}, bag: [], money: 0 };
    team = placeItem(team, CONS).team;
    team = placeItem(team, CONS2).team;
    expect(occupied(team.bag).length).toBe(2);
  });

  it('plafond STACK_MAX puis débordement sur une nouvelle case', () => {
    let team = { equipment: {}, bag: [], money: 0 };
    for (let i = 0; i < STACK_MAX + 1; i++) team = placeItem(team, CONS).team;
    const bag = occupied(team.bag);
    expect(bag.length).toBe(2);
    expect(cellN(bag[0])).toBe(STACK_MAX);
    expect(cellN(bag[1])).toBe(1);
  });

  it('canReceiveItem : sac plein mais pile compatible non pleine → true', () => {
    const bag = [...Array(11).fill(EQUIP), CONS]; // 12 cases occupées, dont 1 pile CONS
    const team = { equipment: { head: 'x', body: 'x', feet: 'x' }, bag };
    expect(canReceiveItem(team, CONS)).toBe(true);   // la pile CONS a de la place
    expect(canReceiveItem(team, CONS2)).toBe(false); // ni case libre ni pile CONS2
  });

  it('useConsumable décrémente la pile (case libérée à 0)', () => {
    setupGame([{ key: CONS, n: 2 }]);
    S().useConsumable(0);
    expect(cellN(S().teams[0].bag[0])).toBe(1);
    S().useConsumable(0);
    expect(S().teams[0].bag[0]).toBeNull();
  });

  it('sellBagItem revend UNE unité à la fois', () => {
    setupGame([{ key: CONS, n: 3 }], { money: 0 });
    const refund = Math.ceil(ITEMS[CONS].price / 2);
    S().sellBagItem(0);
    expect(cellN(S().teams[0].bag[0])).toBe(2);
    expect(S().teams[0].money).toBe(refund);
  });
});

describe('coffre de départ : triple choix', () => {
  it('propose jusqu’à 3 consommables + 20 or', () => {
    setupGame();
    S().triggerStarterChest();
    const r = S().lastStarterReward;
    expect(r.gold).toBe(20);
    expect(r.choices.length).toBeGreaterThan(0);
    expect(r.choices.length).toBeLessThanOrEqual(3);
    r.choices.forEach((k) => expect(ITEMS[k].slot).toBe('consumable'));
  });

  it('le choix verse l’or + le consommable choisi', () => {
    setupGame();
    S().triggerStarterChest();
    const chosen = S().lastStarterReward.choices[0];
    S().closeStarterChest(chosen);
    const t = S().teams[0];
    expect(t.money).toBe(70); // 50 + 20
    expect(t.starterChestOpened).toBe(true);
    expect(occupied(t.bag).some((c) => cellKey(c) === chosen)).toBe(true);
  });

  it('choix invalide / absent → seulement les 20 or', () => {
    setupGame();
    S().triggerStarterChest();
    S().closeStarterChest('cle-inexistante');
    const t = S().teams[0];
    expect(t.money).toBe(70);
    expect(occupied(t.bag).length).toBe(0);
  });
});
