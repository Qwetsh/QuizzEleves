// Traduction lisible des effets (joueurs + éditeur).
import { describe, it, expect } from 'vitest';
import { describeItemEffects, describeEffect, amountLabel, itemEffectLines } from '../logic/effectText.js';

describe('effectText', () => {
  it('amountLabel : nombre / dé / échelle', () => {
    expect(amountLabel(3)).toBe('3');
    expect(amountLabel('d6')).toBe('1D6');
    expect(amountLabel({ per: 'streak', factor: 5 })).toBe('5×série');
    expect(amountLabel({ per: 'precision', factor: 0.1, base: 2 })).toBe('2+0.1×% de précision');
  });

  it('effets simples legacy', () => {
    expect(describeEffect({ type: 'timerBonus', value: 5 })).toBe('+5s au temps de réponse');
    expect(describeEffect({ type: 'moneyPerCorrect', value: { per: 'streak', factor: 2 } })).toContain('2×série');
    expect(describeEffect({ type: 'lootBonusEquipment', value: 25 })).toContain('25%');
    expect(describeEffect({ type: 'gainMoney', value: 'd6' })).toBe('gagne 1D6 pièces');
  });

  it('couche probabilité (chance) sur effet simple', () => {
    expect(describeEffect({ type: 'gainMoney', value: 10, chance: 0.2 })).toBe('20% de chance : gagne 10 pièces');
  });

  it('déclencheurs', () => {
    expect(describeEffect({ kind: 'trigger', on: 'wrong', do: [{ action: 'money', mode: 'lose', target: 'self', n: 5 }] }))
      .toContain('à chaque erreur');
    expect(describeEffect({ kind: 'trigger', on: 'roll', values: [5, 6], do: [{ action: 'money', mode: 'gain', target: 'self', n: 'd10' }] }))
      .toContain('si le dé fait 5/6');
    expect(describeEffect({ kind: 'trigger', on: 'correct', chance: 0.2, do: [{ action: 'gainCharge' }] }))
      .toContain('20% de chance');
  });

  it('use : chance / table d6', () => {
    expect(describeEffect({ kind: 'trigger', on: 'use', chance: 0.5, do: [{ action: 'money', mode: 'gain', target: 'self', n: 15 }], else: [] }))
      .toContain('50% de chance');
    const d6 = describeEffect({ kind: 'trigger', on: 'use', roll: 'd6', table: { '1': [], '2-4': [{ action: 'money', mode: 'gain', target: 'self', n: 10 }] } });
    expect(d6).toContain('lance un dé');
    expect(d6).toContain('rien');
  });

  it('describeItemEffects liste tous les effets', () => {
    const item = { effects: [{ type: 'moneyPerCorrect', value: 3 }, { kind: 'trigger', on: 'wrong', do: [{ action: 'money', mode: 'lose', target: 'self', n: 5 }] }] };
    expect(describeItemEffects(item)).toHaveLength(2);
  });

  it('itemEffectLines : auto-généré si pas d’override', () => {
    const item = { effects: [{ type: 'timerBonus', value: 5 }] };
    expect(itemEffectLines(item)).toEqual(['+5s au temps de réponse']);
  });

  it('itemEffectLines : descExpert prime (une ligne = une puce)', () => {
    const item = { descExpert: 'Ligne A\n  Ligne B  \n\n', effects: [{ type: 'timerBonus', value: 5 }] };
    expect(itemEffectLines(item)).toEqual(['Ligne A', 'Ligne B']);
  });
});
