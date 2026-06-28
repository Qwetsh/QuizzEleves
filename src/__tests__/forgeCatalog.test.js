// Forge — sélection de faces depuis le CATALOGUE curé (remplace la génération
// aléatoire). Couvre le filtrage, le tirage pondéré sans doublon et le
// renouvellement à l'achat.
import { describe, it, expect, afterEach } from 'vitest';
import { applyBalance } from '../logic/balanceConfig.js';
import { enabledCatalogFaces, pickFaceStock, pickReplacementFace } from '../logic/forgeEffects.js';

afterEach(() => applyBalance({})); // restaure le catalogue par défaut

describe('Forge — enabledCatalogFaces', () => {
  it('le catalogue par défaut est non vide et n\'utilise que des effets résolus', () => {
    const faces = enabledCatalogFaces();
    expect(faces.length).toBeGreaterThan(0);
    faces.forEach((f) => {
      expect(f.key).toBeTruthy();
      expect(f.slot).toBeGreaterThanOrEqual(1);
      expect(f.slot).toBeLessThanOrEqual(6);
    });
  });

  it('exclut les faces désactivées', () => {
    applyBalance({ forge: { catalog: [
      { key: 'on', rarity: 'commun', price: 10, slot: 1, value: 3, effect: null, enabled: true },
      { key: 'off', rarity: 'commun', price: 10, slot: 2, value: 3, effect: null, enabled: false },
    ] } });
    const keys = enabledCatalogFaces().map((f) => f.key);
    expect(keys).toContain('on');
    expect(keys).not.toContain('off');
  });

  it('exclut une face dont l\'effet n\'est pas résolu', () => {
    applyBalance({ forge: { catalog: [
      { key: 'good', rarity: 'commun', price: 10, slot: 1, value: 2, effect: { type: 'prime', tier: 0 } },
      { key: 'bad', rarity: 'commun', price: 10, slot: 1, value: 2, effect: { type: 'inexistant', tier: 0 } },
    ] } });
    const keys = enabledCatalogFaces().map((f) => f.key);
    expect(keys).toEqual(['good']);
  });
});

describe('Forge — pickFaceStock', () => {
  it('tire le nombre demandé de faces DISTINCTES (par key)', () => {
    const stock = pickFaceStock(5, () => 0.5);
    expect(stock).toHaveLength(5);
    expect(new Set(stock.map((f) => f.key)).size).toBe(5);
  });

  it('ne dépasse pas la taille du catalogue', () => {
    applyBalance({ forge: { catalog: [
      { key: 'a', rarity: 'commun', price: 10, slot: 1, value: 3, effect: null },
      { key: 'b', rarity: 'commun', price: 10, slot: 2, value: 3, effect: null },
    ] } });
    expect(pickFaceStock(6, () => 0)).toHaveLength(2);
  });

  it('chaque face de vitrine porte slot, prix, rareté et puissance', () => {
    const f = pickFaceStock(1, () => 0)[0];
    expect(typeof f.price).toBe('number');
    expect(typeof f.power).toBe('number');
    expect(f.slot).toBeGreaterThanOrEqual(1);
    expect(['commun', 'rare', 'legendaire']).toContain(f.rarity);
  });
});

describe('Forge — pickReplacementFace', () => {
  it('renvoie une face absente du stock fourni (par key)', () => {
    const stock = pickFaceStock(3, () => 0.5);
    const taken = new Set(stock.map((f) => f.key));
    const repl = pickReplacementFace(stock, () => 0.5);
    expect(repl).not.toBeNull();
    expect(taken.has(repl.key)).toBe(false);
  });

  it('renvoie null si toutes les faces sont déjà dans le stock', () => {
    applyBalance({ forge: { catalog: [
      { key: 'only', rarity: 'commun', price: 10, slot: 1, value: 3, effect: null },
    ] } });
    expect(pickReplacementFace([{ key: 'only' }], () => 0)).toBeNull();
  });

  it('le tirage est pondéré par la rareté (commun >> légendaire)', () => {
    applyBalance({ forge: {
      shopWeight: { commun: 100, rare: 1, legendaire: 1 },
      catalog: [
        { key: 'c', rarity: 'commun', price: 10, slot: 1, value: 3, effect: null },
        { key: 'l', rarity: 'legendaire', price: 10, slot: 2, value: 3, effect: null },
      ],
    } });
    let common = 0;
    let i = 0;
    // rng déterministe balayant [0,1) : la grande majorité doit tomber sur 'c'.
    for (i = 0; i < 100; i++) {
      const r = i / 100;
      if (pickReplacementFace([], () => r).key === 'c') common++;
    }
    expect(common).toBeGreaterThan(90);
  });
});
