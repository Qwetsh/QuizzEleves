import { describe, it, expect } from 'vitest';
import {
  EFFECT_BY_ID, buildEnchant, effectPower, enchantCost, validateParchment,
  MAX_TOTAL_POWER, MAX_EFFECTS_PER_PARCHMENT,
} from '../data/enchantPalette.js';

describe('enchantPalette — specs moteur valides', () => {
  it('passif → { type, value } borné', () => {
    const e = EFFECT_BY_ID.timerBonus;
    expect(buildEnchant(e, { value: 5 })).toEqual({ type: 'timerBonus', value: 5 });
    // borne le max
    expect(buildEnchant(e, { value: 999 })).toEqual({ type: 'timerBonus', value: 8 });
  });

  it('déclencheur on:correct → { kind:trigger, on, do }', () => {
    const spec = buildEnchant(EFFECT_BY_ID.gainGold, { value: 10, trigger: 'correct' });
    expect(spec.kind).toBe('trigger');
    expect(spec.on).toBe('correct');
    expect(spec.do[0]).toMatchObject({ action: 'money', mode: 'gain', target: 'self', n: 10 });
  });

  it('déclencheur on:roll porte les faces du dé', () => {
    const spec = buildEnchant(EFFECT_BY_ID.gainGold, { value: 12, trigger: 'roll', dice: [5, 6] });
    expect(spec.on).toBe('roll');
    expect(spec.values).toEqual([5, 6]);
  });

  it('binaire (immunité duel) → value 1, pas de magnitude', () => {
    expect(buildEnchant(EFFECT_BY_ID.duelImmune, {})).toEqual({ type: 'duelImmune', value: 1 });
  });
});

describe('enchantPalette — puissance & coût', () => {
  it("un déclencheur rare (dé=6) coûte moins qu'à chaque bonne réponse", () => {
    const onRoll = effectPower(EFFECT_BY_ID.gainGold, { value: 20, trigger: 'roll', dice: [6] });
    const onCorrect = effectPower(EFFECT_BY_ID.gainGold, { value: 20, trigger: 'correct' });
    expect(onCorrect).toBeGreaterThan(onRoll);
  });

  it('le coût croît avec la valeur', () => {
    const cheap = enchantCost([{ id: 'timerBonus', value: 2 }]);
    const dear = enchantCost([{ id: 'timerBonus', value: 8 }]);
    expect(dear).toBeGreaterThan(cheap);
  });

  it('refuse > 2 effets ou puissance totale dépassée', () => {
    expect(validateParchment([]).ok).toBe(false);
    const three = [{ id: 'timerBonus', value: 8 }, { id: 'reculReduction', value: 3 }, { id: 'reflectChance', value: 50 }];
    expect(three.length).toBeGreaterThan(MAX_EFFECTS_PER_PARCHMENT);
    expect(validateParchment(three).ok).toBe(false);
    // deux effets binaires forts restent sous le plafond de puissance
    const maxed = validateParchment([{ id: 'goldStealImmune' }, { id: 'duelImmune' }]);
    expect(maxed.power).toBeLessThanOrEqual(MAX_TOTAL_POWER); // 5+6=11 OK
  });

  it('un parchemin valide renvoie cost + enchants', () => {
    const v = validateParchment([{ id: 'timerBonus', value: 5 }, { id: 'gainGold', value: 10, trigger: 'correct' }]);
    expect(v.ok).toBe(true);
    expect(v.cost).toBeGreaterThan(0);
    expect(v.enchants).toHaveLength(2);
  });
});
