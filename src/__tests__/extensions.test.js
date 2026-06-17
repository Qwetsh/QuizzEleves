// Tests du système d'extensions (modules activables/désactivables).
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { defaultExtensions, extOn, EXTENSIONS } from '../extensions/registry.js';
import { pickRandomEvent } from '../logic/eventPicker.js';
import { EVENTS } from '../data/events.js';

const S = () => useGameStore.getState();

describe('registre des extensions', () => {
  it('extOn : absent → activé, false → désactivé, true → activé', () => {
    expect(extOn(undefined, 'equipment')).toBe(true); // compat vieilles saves
    expect(extOn({}, 'equipment')).toBe(true);
    expect(extOn({ equipment: false }, 'equipment')).toBe(false);
    expect(extOn({ equipment: true }, 'equipment')).toBe(true);
  });
  it('defaultExtensions : reflète le défaut de chaque extension', () => {
    const d = defaultExtensions();
    for (const e of EXTENSIONS) expect(d[e.id]).toBe(e.default !== false);
  });
});

describe('sélecteur d’événements selon l’extension objets', () => {
  const allKeys = Object.keys(EVENTS);
  const itemKeys = allKeys.filter((k) => EVENTS[k].needsItems);

  it('au moins un événement dépend des objets (needsItems)', () => {
    expect(itemKeys.length).toBeGreaterThan(0);
  });
  it('itemsEnabled=false : ne tire jamais un événement-objet (1000 tirages)', () => {
    for (let i = 0; i < 1000; i++) {
      const picked = pickRandomEvent(allKeys, { itemsEnabled: false });
      expect(picked).toBeTruthy();
      expect(EVENTS[picked.key].needsItems).toBeFalsy();
    }
  });
  it('itemsEnabled=true (défaut) : les événements-objets restent éligibles', () => {
    const keys = new Set();
    for (let i = 0; i < 2000; i++) keys.add(pickRandomEvent(allKeys).key);
    expect(itemKeys.some((k) => keys.has(k))).toBe(true);
  });
  it('pool entièrement item + objets coupés → null (pas de crash)', () => {
    expect(pickRandomEvent(itemKeys, { itemsEnabled: false })).toBeNull();
  });
});

describe('store : toggle verrouillé en partie', () => {
  beforeEach(() => useGameStore.getState().reset());

  it('reset initialise extensions par défaut et itemsEnabled()=true', () => {
    expect(S().extensions).toEqual(defaultExtensions());
    expect(S().itemsEnabled()).toBe(true);
  });
  it('au Setup : on peut désactiver l’extension objets', () => {
    useGameStore.setState({ phase: 'setup' });
    S().toggleExtension('equipment');
    expect(S().itemsEnabled()).toBe(false);
  });
  it('en partie : toggle ignoré (verrou)', () => {
    useGameStore.setState({ phase: 'game' });
    const before = S().itemsEnabled();
    S().toggleExtension('equipment');
    expect(S().itemsEnabled()).toBe(before); // inchangé
  });
});
