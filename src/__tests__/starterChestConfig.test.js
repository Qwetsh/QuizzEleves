// Tests : coffre de départ configurable (or fixe/aléatoire, proposés/gardés,
// catégorie, activation).
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { ITEMS } from '../data/items.js';
import { cellKey, normalizeBag } from '../store/itemHandlers.js';
import { defaultExtensions } from '../extensions/registry.js';

const S = () => useGameStore.getState();
const occupied = (bag) => normalizeBag(bag).filter(Boolean);

function setup(cfg = {}, gold = null) {
  useGameStore.setState({
    phase: 'game', devSandbox: true,
    teams: [{ name: 'T', emoji: '🦁', color: '#111', money: 0, bag: [], equipment: { head: null, body: null, feet: null }, powers: {}, starterChestOpened: false }],
    currentTeam: 0, finished: false, log: [],
    extensions: defaultExtensions(),
    enabledItems: Object.keys(ITEMS),
    showStarterChest: false, lastStarterReward: null,
    starterGold: gold,
    starterChestConfig: {
      enabled: true, goldMode: 'fixed', gold: 20, goldMin: 10, goldMax: 30,
      propose: 3, keep: 1, category: 'consumable', ...cfg,
    },
  });
}

describe('coffre de départ : configuration', () => {
  it('désactivé → pas de coffre', () => {
    setup({ enabled: false });
    S().triggerStarterChest();
    expect(S().showStarterChest).toBe(false);
    expect(S().lastStarterReward).toBeNull();
  });

  it('or fixe : montant proposé = config', () => {
    setup({ gold: 45 });
    S().triggerStarterChest();
    expect(S().lastStarterReward.gold).toBe(45);
  });

  it('or aléatoire identique : tiré dans [min,max] (déterministe si min=max)', () => {
    setup({ goldMode: 'random', goldMin: 17, goldMax: 17 });
    S().triggerStarterChest();
    expect(S().lastStarterReward.gold).toBe(17);
  });

  it('starterGold pré-résolu prioritaire (même montant pour tous)', () => {
    setup({ goldMode: 'random', goldMin: 0, goldMax: 100 }, 33);
    S().triggerStarterChest();
    expect(S().lastStarterReward.gold).toBe(33);
  });

  it('catégorie équipement : ne propose que de l’équipement', () => {
    setup({ category: 'equipment', propose: 4 });
    S().triggerStarterChest();
    const choices = S().lastStarterReward.choices;
    expect(choices.length).toBeGreaterThan(0);
    for (const k of choices) expect(ITEMS[k].slot).not.toBe('consumable');
  });

  it('propose/keep : garde plusieurs objets, plafonné à keep', () => {
    setup({ propose: 3, keep: 2, category: 'consumable', gold: 10 });
    S().triggerStarterChest();
    const choices = S().lastStarterReward.choices;
    expect(S().lastStarterReward.keep).toBe(Math.min(2, choices.length));
    // On tente d'en garder 3 (plus que keep) : seuls les 2 premiers valides comptent.
    S().closeStarterChest(choices.slice(0, 3));
    const t = S().teams[0];
    expect(t.money).toBe(10);
    expect(occupied(t.bag).length).toBe(Math.min(2, choices.length));
  });

  it('propose 0 : coffre d’or seul (aucun objet)', () => {
    setup({ propose: 0, gold: 25 });
    S().triggerStarterChest();
    expect(S().lastStarterReward.choices).toEqual([]);
    S().closeStarterChest([]);
    const t = S().teams[0];
    expect(t.money).toBe(25);
    expect(occupied(t.bag).length).toBe(0);
  });
});
