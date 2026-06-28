import { describe, it, expect } from 'vitest';
import { setLang } from '../i18n/lang.js';
import { buildGlossaryIndex, tokenizeText, resolveEntry, resolveDescriptor } from '../logic/glossary.js';
import { ITEMS } from '../data/items.js';
import { POWERS } from '../data/powers.js';

describe('glossary — tokenizeText', () => {
  const index = buildGlossaryIndex('fr');

  it('repère un pouvoir et le rend cliquable', () => {
    const segs = tokenizeText('🛡️ Équipe A utilise Bouclier !', index);
    const kw = segs.find((s) => s.type === 'power' && s.key === 'bouclier');
    expect(kw).toBeTruthy();
    expect(kw.text.toLowerCase()).toBe('bouclier');
  });

  it('respecte les bornes de mots (pas de match au milieu d’un mot)', () => {
    // « Bouclier » ne doit PAS matcher dans « Boucliers… » accolé à des lettres
    const segs = tokenizeText('mot Bouclierxyz', index);
    expect(segs.every((s) => !s.type)).toBe(true);
  });

  it('préfère la correspondance la plus longue', () => {
    // « Bouclier de bois » (terme) doit l’emporter sur « Bouclier » (pouvoir)
    const segs = tokenizeText('un Bouclier de bois utile', index);
    const kw = segs.find((s) => s.type);
    expect(kw.text).toBe('Bouclier de bois');
    expect(kw.key).toBe('bouclierBois');
  });

  it('reconnaît un terme de mécanique par alias', () => {
    const segs = tokenizeText('tu recules de 2 cases', index);
    const kw = segs.find((s) => s.type === 'term' && s.key === 'recul');
    expect(kw).toBeTruthy();
  });

  it('renvoie le texte intact pour un index vide', () => {
    const segs = tokenizeText('rien à matcher', null);
    expect(segs).toEqual([{ text: 'rien à matcher' }]);
  });
});

describe('glossary — resolveEntry', () => {
  it('résout un objet existant (nom + lignes d’effet)', () => {
    const key = Object.keys(ITEMS)[0];
    const e = resolveEntry('item', key, 'fr');
    expect(e).toBeTruthy();
    expect(e.type).toBe('item');
    expect(e.name).toBe(ITEMS[key].name);
    expect(Array.isArray(e.lines)).toBe(true);
  });

  it('résout un pouvoir (niveaux en lignes)', () => {
    const e = resolveEntry('power', 'bouclier', 'fr');
    expect(e.name).toBe(POWERS.bouclier.name);
    expect(e.lines.length).toBeGreaterThan(0);
  });

  it('résout un terme de mécanique en anglais', () => {
    const e = resolveEntry('term', 'recul', 'en');
    expect(e.name).toBe('Setback');
    expect(e.desc).toMatch(/setback/i);
  });

  it('résout un descripteur d’effet ad hoc', () => {
    const e = resolveDescriptor({ type: 'effect', name: 'Bouclier', desc: 'x', icon: '🛡️', color: '#3b6cb3' }, 'fr');
    expect(e.name).toBe('Bouclier');
    expect(e.accent).toBe('#3b6cb3');
  });

  it('retombe sur null pour une clé inconnue', () => {
    expect(resolveEntry('item', '__inconnu__', 'fr')).toBeNull();
  });
});

describe('glossary — index bilingue', () => {
  it('indexe les noms anglais quand lang=en', () => {
    setLang('en');
    const index = buildGlossaryIndex('en');
    const segs = tokenizeText('Team A uses Shield', index);
    expect(segs.some((s) => s.type === 'power' && s.key === 'bouclier')).toBe(true);
    setLang('fr');
  });
});
