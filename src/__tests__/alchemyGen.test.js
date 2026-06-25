// Valide les données d'alchimie générées (src/data/alchemyGen.js) : comptes,
// plafonds d'effets, rareté, et SURTOUT que chaque action/buff est connu du
// moteur (un typo casserait l'effet en jeu).
import { describe, it, expect } from 'vitest';
import { INGREDIENTS, POTIONS, ALCHEMY_RECIPES, INGREDIENT_LOOT } from '../data/alchemyGen.js';

const KNOWN_ACTIONS = new Set([
  'money', 'move', 'extraTime', 'shieldNext', 'gainCharge', 'fumigene', 'buff', 'loot',
  'loseItem', 'curseTimer', 'curseExtraQuestion', 'rerollQuestion', 'forceSubject',
  'randomPathNext', 'teleportFurthest', 'challenge', 'placeTrap', 'hideWrong',
  'blockPowers', 'blockConsumables',
]);
const KNOWN_BUFFS = new Set(['themeBonus', 'advanceOnCorrect', 'diceBonus', 'noRecul', 'loseOnWrong', 'randomPath', 'duelImmune', 'moveDieSides',
  'bleedGold', 'reflectChance', 'goldStealImmune', 'itemStealImmune']);
const KNOWN_TARGETS = new Set([undefined, 'self', 'all', 'allOthers', 'randomOpponent', 'target']);

function collectActions(effects) {
  const out = [];
  for (const fx of effects) {
    if (fx?.kind === 'trigger') {
      for (const a of (fx.do || [])) out.push(a);
      for (const arr of Object.values(fx.table || {})) for (const a of arr) out.push(a);
    }
  }
  return out;
}
const effectCount = (effects) => {
  const t = effects[0];
  return (t.do?.length || 0) + (t.table ? 1 : 0);
};

describe('alchemyGen — ingrédients', () => {
  it('20 ingrédients, family ingredient, ≤2 effets', () => {
    const keys = Object.keys(INGREDIENTS);
    expect(keys).toHaveLength(20);
    for (const k of keys) {
      const it = INGREDIENTS[k];
      expect(it.family).toBe('ingredient');
      expect(it.slot).toBe('consumable');
      expect(it.effects.length).toBeLessThanOrEqual(2);
      expect(it.effects.length).toBeGreaterThanOrEqual(1);
    }
  });
  it('chaque ingrédient a des données de loot (poids + matière favorite)', () => {
    for (const k of Object.keys(INGREDIENTS)) {
      const l = INGREDIENT_LOOT[k];
      expect(l).toBeTruthy();
      expect(l.weight).toBeGreaterThan(0);
      expect(typeof l.favSubject).toBe('string');
      expect(l.favMult).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('alchemyGen — potions', () => {
  const keys = Object.keys(POTIONS);
  it('1140 potions (C(20,3)), family potion, lootOnly', () => {
    expect(keys).toHaveLength(1140);
    for (const k of keys) {
      const p = POTIONS[k];
      expect(p.family).toBe('potion');
      expect(p.slot).toBe('consumable');
      expect(p.lootOnly).toBe(true);
      expect(['commun', 'rare', 'legendaire']).toContain(p.rarity);
    }
  });
  it('plafond d\'effets par rareté (commun ≤2, rare ≤4, légendaire ≤6)', () => {
    const cap = { commun: 2, rare: 4, legendaire: 6 };
    for (const k of keys) {
      const p = POTIONS[k];
      expect(effectCount(p.effects)).toBeGreaterThanOrEqual(1);
      expect(effectCount(p.effects)).toBeLessThanOrEqual(cap[p.rarity]);
    }
  });
  it('toutes les actions et buffs sont connus du moteur (anti-typo)', () => {
    for (const k of keys) {
      for (const a of collectActions(POTIONS[k].effects)) {
        expect(KNOWN_ACTIONS.has(a.action)).toBe(true);
        expect(KNOWN_TARGETS.has(a.target)).toBe(true);
        if (a.action === 'buff') expect(KNOWN_BUFFS.has(a.buff?.type)).toBe(true);
      }
    }
  });
  it('répartition de rareté ~50/38/12 %', () => {
    const by = keys.reduce((m, k) => ((m[POTIONS[k].rarity] = (m[POTIONS[k].rarity] || 0) + 1), m), {});
    expect(by.commun).toBeGreaterThan(500);
    expect(by.rare).toBeGreaterThan(350);
    expect(by.legendaire).toBeGreaterThan(80);
  });
});

describe('alchemyGen — recettes', () => {
  it('1140 recettes uniques, ingrédients valides, potion existante', () => {
    expect(ALCHEMY_RECIPES).toHaveLength(1140);
    const seen = new Set();
    for (const r of ALCHEMY_RECIPES) {
      expect(r.ingredients).toHaveLength(3);
      for (const ing of r.ingredients) expect(INGREDIENTS[ing]).toBeTruthy();
      expect(POTIONS[r.potion]).toBeTruthy();
      const key = [...r.ingredients].sort().join('|');
      expect(seen.has(key)).toBe(false); // pas de combo dupliqué
      seen.add(key);
    }
  });
});
