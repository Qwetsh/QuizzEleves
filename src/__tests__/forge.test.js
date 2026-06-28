// Tests : modèle « Forge de dés » (forge.js) — dé à 6 faces personnalisables.
import { describe, it, expect } from 'vitest';
import {
  DIE_SLOTS, defaultDieFaces, isFaceForged, clampFaceValue, normalizeDieFaces, getDieFaces,
} from '../logic/forge.js';

describe('forge — modèle de dé', () => {
  it('le dé par défaut est standard 1→6 (value === base, aucun effet)', () => {
    const faces = defaultDieFaces();
    expect(faces).toHaveLength(DIE_SLOTS);
    faces.forEach((f, i) => {
      expect(f.base).toBe(i + 1);
      expect(f.value).toBe(i + 1);
      expect(f.effects).toEqual([]);
    });
  });

  it('isFaceForged : vrai si la valeur change OU un effet est posé', () => {
    expect(isFaceForged({ base: 3, value: 3, effect: null })).toBe(false);
    expect(isFaceForged({ base: 3, value: 0, effect: null })).toBe(true); // valeur changée
    expect(isFaceForged({ base: 3, value: 3, effect: { type: 'prime' } })).toBe(true); // effet
    expect(isFaceForged(null)).toBe(false);
  });

  it('clampFaceValue borne le déplacement à [0, 12] (entier)', () => {
    expect(clampFaceValue(-2)).toBe(0);
    expect(clampFaceValue(0)).toBe(0);
    expect(clampFaceValue(4)).toBe(4);
    expect(clampFaceValue(9)).toBe(9);
    expect(clampFaceValue(15)).toBe(12);
    expect(clampFaceValue(3.7)).toBe(4);
    expect(clampFaceValue('abc')).toBe(0);
  });

  it("normalizeDieFaces complète à 6 faces et préserve l'adresse (base = position)", () => {
    const partial = [{ value: 0, effect: { type: 'egide' } }]; // 1 seul slot fourni (forme héritée)
    const faces = normalizeDieFaces(partial);
    expect(faces).toHaveLength(DIE_SLOTS);
    expect(faces[0]).toEqual({ base: 1, value: 0, effects: [{ type: 'egide' }] }); // migré vers effects[]
    // les slots manquants reprennent le standard
    expect(faces[5]).toEqual({ base: 6, value: 6, effects: [] });
  });

  it("normalizeDieFaces force l'adresse même si la donnée tente de la falsifier", () => {
    const tampered = [{ base: 99, value: 5, effect: null }];
    expect(normalizeDieFaces(tampered)[0].base).toBe(1);
  });

  it('getDieFaces : dé standard si l\'équipe n\'a pas de dieFaces', () => {
    expect(getDieFaces({})).toEqual(defaultDieFaces());
    expect(getDieFaces(undefined)).toEqual(defaultDieFaces());
  });
});
