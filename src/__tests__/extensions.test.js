// Tests du système d'extensions (modules activables/désactivables).
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { defaultExtensions, extOn, EXTENSIONS, applyExtensionToggle } from '../extensions/registry.js';
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

describe('dépendances entre extensions (cascade)', () => {
  const all = () => Object.fromEntries(EXTENSIONS.map((e) => [e.id, true]));

  it('activer Complots active sa dépendance Troc (et la chaîne)', () => {
    const base = { ...all(), diplomacy: false, trade: false, equipment: false };
    const next = applyExtensionToggle(base, 'diplomacy', true);
    expect(extOn(next, 'diplomacy')).toBe(true);
    expect(extOn(next, 'trade')).toBe(true); // dépendance directe
    expect(extOn(next, 'equipment')).toBe(true); // dépendance transitive (trade→equipment)
  });

  it('désactiver Troc désactive Complots (dépendant)', () => {
    const base = { ...all() };
    const next = applyExtensionToggle(base, 'trade', false);
    expect(extOn(next, 'trade')).toBe(false);
    expect(extOn(next, 'diplomacy')).toBe(false);
  });

  it('désactiver Objets coupe toute la chaîne dépendante', () => {
    const next = applyExtensionToggle(all(), 'equipment', false);
    for (const id of ['equipment', 'trade', 'diplomacy', 'alchemy', 'enchant']) {
      expect(extOn(next, id)).toBe(false);
    }
    // une extension indépendante reste active
    expect(extOn(next, 'forge')).toBe(true);
  });

  it('invariant : aucune extension active sans ses dépendances', () => {
    for (const e of EXTENSIONS) {
      const next = applyExtensionToggle(defaultExtensions(), e.id, true);
      for (const id of Object.keys(next)) {
        if (extOn(next, id)) {
          for (const req of EXTENSIONS.find((x) => x.id === id)?.requires || []) {
            expect(extOn(next, req)).toBe(true);
          }
        }
      }
    }
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
