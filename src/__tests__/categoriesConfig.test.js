// Vérifie que le chargement DB (buildCatalogFromRows) reproduit EXACTEMENT le
// catalogue en dur (Phase 1 « Collège = zéro changement »). Les lignes sont
// dérivées de BASE_SUBJECTS comme le fait scripts/seed-categories.mjs.
import { describe, it, expect } from 'vitest';
import { buildCatalogFromRows } from '../logic/categoriesConfig.js';
import {
  BASE_SUBJECTS, SUBJECT_KEYS, DEFAULT_BOARD_SUBJECTS, LV2_SUBJECTS, FORCED_SUBJECT_KEYS, MODULES,
} from '../data/subjects.js';

const roleOf = (key) =>
  FORCED_SUBJECT_KEYS.includes(key) ? 'forced' : key === 'lv2' ? 'lv2' : key === 'multi' ? 'multi' : 'subject';

const catRows = Object.entries(BASE_SUBJECTS).map(([key, c], i) => ({
  key, module: c.module || 'college', name: c.name, name_en: c.name_en ?? null, short: c.short ?? null,
  icon: c.icon ?? null, color: c.color ?? null, color_soft: c.colorSoft ?? null, color_deep: c.colorDeep ?? null,
  biome: c.biome ?? null, biome_en: c.biome_en ?? null, role: roleOf(key), board: SUBJECT_KEYS.includes(key),
  default_on: DEFAULT_BOARD_SUBJECTS.includes(key), lv2_member: LV2_SUBJECTS.includes(key), enabled: true, ord: i,
}));
const modRows = Object.values(MODULES).map((m, i) => ({
  key: m.key, name: m.name, name_en: m.name_en ?? null, icon: m.icon ?? null, kind: m.kind, description: null, enabled: true, ord: i,
}));

describe('categoriesConfig — le chargement DB reproduit le catalogue en dur', () => {
  const built = buildCatalogFromRows(catRows, modRows);

  it('SUBJECTS identique à BASE_SUBJECTS', () => {
    expect(built.subjects).toEqual(BASE_SUBJECTS);
  });

  it('listes dérivées (keys/defaults/lv2/forced) identiques', () => {
    expect(built.keys).toEqual(SUBJECT_KEYS);
    expect(built.defaults).toEqual(DEFAULT_BOARD_SUBJECTS);
    expect(built.lv2).toEqual(LV2_SUBJECTS);
    expect(built.forced).toEqual(FORCED_SUBJECT_KEYS);
  });

  it('module Collège présent', () => {
    expect(built.moduleKeys).toContain('college');
    expect(built.modules.college.name).toBe('Collège');
  });
});
