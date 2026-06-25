// Extension « Enchantement » : parchemin posé sur une pièce (instance), l'effet
// est lu par le moteur et SUIT l'objet (déséquiper / troc).
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { enchantWith, craftParchment, moveInventoryItem, cellKey, cellEnchants } from '../store/itemHandlers.js';
import { enchantCost } from '../data/enchantPalette.js';
import { getEffectValue } from '../logic/itemEffects.js';
import { equipOnRollActions } from '../store/effectEngine.js';

const set = (p) => useGameStore.setState(p);
const get = () => useGameStore.getState();
const S = () => useGameStore.getState();

function team(over = {}) {
  return { name: 'T', emoji: '🦁', color: '#111', pos: 'n1', money: 50, correct: 0, wrong: 0, powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], ...over };
}
function setup(over) {
  useGameStore.setState({ phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [], teams: [team(over), team()] });
}

describe('enchantWith', () => {
  beforeEach(() => setup({ equipment: { head: null, body: null, feet: 'bottesMontagne' }, bag: ['parchemoinTemps'] }));

  it('pose l’enchantement sur la pièce (instance) et consomme le parchemin', () => {
    const r = enchantWith(set, get, 0, 0, 'feet');
    expect(r.ok).toBe(true);
    const feet = S().teams[0].equipment.feet;
    expect(cellKey(feet)).toBe('bottesMontagne');
    expect(cellEnchants(feet)).toHaveLength(1);
    expect(S().teams[0].bag.filter(Boolean).length).toBe(0); // parchemin consommé
  });

  it('l’effet enchanté est lu par getEffectValue', () => {
    expect(getEffectValue(S().teams[0], 'timerBonus')).toBe(0);
    enchantWith(set, get, 0, 0, 'feet');
    expect(getEffectValue(S().teams[0], 'timerBonus')).toBe(3); // parchemin du sage : +3s
  });

  it('refuse sur un emplacement vide', () => {
    expect(enchantWith(set, get, 0, 0, 'head').ok).toBe(false);
  });

  it('un parchemin on:roll devient un déclencheur de la pièce', () => {
    setup({ equipment: { head: null, body: null, feet: 'bottesMontagne' }, bag: ['parchemoinOr5'] });
    enchantWith(set, get, 0, 0, 'feet');
    const acts = equipOnRollActions(S().teams[0], 5);
    expect(acts.some((a) => a.action === 'money')).toBe(true);
    expect(equipOnRollActions(S().teams[0], 4)).toHaveLength(0); // seulement sur un 5
  });
});

describe('l’enchantement SUIT la pièce', () => {
  beforeEach(() => setup({ equipment: { head: null, body: null, feet: 'bottesMontagne' }, bag: ['parchemoinTemps'] }));

  it('déséquiper puis ré-équiper conserve l’enchantement', () => {
    enchantWith(set, get, 0, 0, 'feet');
    moveInventoryItem(set, get, 'equip:feet', 'bag:1', 0); // au sac
    expect(getEffectValue(S().teams[0], 'timerBonus')).toBe(0); // non porté
    expect(cellEnchants(S().teams[0].bag[1])).toHaveLength(1); // mais conservé sur l’instance
    moveInventoryItem(set, get, 'bag:1', 'equip:feet', 0); // ré-équipe
    expect(getEffectValue(S().teams[0], 'timerBonus')).toBe(3);
  });

  it('le troc transfère la pièce avec son enchantement', () => {
    enchantWith(set, get, 0, 0, 'feet');
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { equip: ['feet'] }, want: { gold: 5 } });
    expect(r.ok).toBe(true);
    // l’équipe 1 reçoit la pièce enchantée (équipée car slot libre)
    expect(getEffectValue(S().teams[1], 'timerBonus')).toBe(3);
  });
});

describe('Autel du Scribe — craft de parchemin custom', () => {
  beforeEach(() => setup({ money: 50, equipment: { head: null, body: null, feet: 'bottesMontagne' }, bag: ['parcheminVierge'] }));

  it('grave un parchemin gravé (specs custom), consomme vierge + or', () => {
    const cost = enchantCost([{ id: 'timerBonus', value: 5 }]);
    const r = craftParchment(set, get, 0, 0, [{ id: 'timerBonus', value: 5 }]);
    expect(r.ok).toBe(true);
    const t = S().teams[0];
    expect(t.money).toBe(50 - cost);
    const grave = t.bag.find((c) => cellKey(c) === 'parcheminGrave');
    expect(grave).toBeTruthy();
    expect(cellEnchants(grave)).toEqual([{ type: 'timerBonus', value: 5 }]);
  });

  it('le parchemin gravé applique bien son effet custom sur une pièce', () => {
    craftParchment(set, get, 0, 0, [{ id: 'timerBonus', value: 5 }]);
    const gi = S().teams[0].bag.findIndex((c) => cellKey(c) === 'parcheminGrave');
    enchantWith(set, get, 0, gi, 'feet');
    expect(getEffectValue(S().teams[0], 'timerBonus')).toBe(5);
  });

  it('refuse sans vierge ou sans or', () => {
    setup({ money: 0, equipment: { feet: 'bottesMontagne' }, bag: ['parcheminVierge'] });
    expect(craftParchment(set, get, 0, 0, [{ id: 'timerBonus', value: 5 }]).ok).toBe(false); // or insuffisant
    setup({ money: 99, equipment: { feet: 'bottesMontagne' }, bag: ['parchemoinTemps'] });
    expect(craftParchment(set, get, 0, 0, [{ id: 'timerBonus', value: 5 }]).ok).toBe(false); // pas un vierge
  });

  it('plafond de 3 enchants par pièce', () => {
    const ench = [{ type: 'timerBonus', value: 1 }, { type: 'timerBonus', value: 1 }, { type: 'timerBonus', value: 1 }];
    setup({ money: 99, equipment: { feet: { key: 'bottesMontagne', enchants: ench } }, bag: ['parchemoinTemps'] });
    expect(enchantWith(set, get, 0, 0, 'feet').ok).toBe(false); // déjà 3
  });
});
