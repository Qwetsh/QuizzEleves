import { describe, it, expect, afterEach } from 'vitest';
import { applyBalance } from '../logic/balanceConfig.js';
import { SETS } from '../data/sets.js';

afterEach(() => applyBalance({})); // restaure l'état par défaut

describe('balanceConfig — sets personnalisés', () => {
  it('crée un set custom dans SETS (clé absente du catalogue de base)', () => {
    applyBalance({ sets: { set_test: { custom: true, name: 'Set Test', name_en: 'Test Set', icon: '🧪', color: '#123456', size: 2, bonus2: [{ type: 'timerBonus', value: 3 }], bonus3: [] } } });
    expect(SETS.set_test).toBeTruthy();
    expect(SETS.set_test.name).toBe('Set Test');
    expect(SETS.set_test.name_en).toBe('Test Set');
    expect(SETS.set_test.size).toBe(2);
    expect(SETS.set_test.bonus2).toEqual([{ type: 'timerBonus', value: 3 }]);
  });

  it('supprime le set custom quand l’override est retiré (reset)', () => {
    applyBalance({ sets: { set_test: { custom: true, name: 'X', size: 2, bonus2: [] } } });
    expect(SETS.set_test).toBeTruthy();
    applyBalance({});
    expect(SETS.set_test).toBeUndefined();
  });

  it('n’ajoute pas une clé inconnue sans le marqueur custom', () => {
    applyBalance({ sets: { set_fantome: { name: 'Fantôme', bonus2: [] } } });
    expect(SETS.set_fantome).toBeUndefined();
  });

  it('continue d’overrider un set de base sans le dupliquer/supprimer', () => {
    const firstKey = Object.keys(SETS)[0];
    applyBalance({ sets: { [firstKey]: { name: 'Renommé' } } });
    expect(SETS[firstKey].name).toBe('Renommé');
    applyBalance({});
    expect(SETS[firstKey]).toBeTruthy();
    expect(SETS[firstKey].name).not.toBe('Renommé');
  });
});
