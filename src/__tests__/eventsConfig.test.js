// Tests : fusion des événements personnalisés (setCustomEvents), mapping DB
// (eventToPayload) et réconciliation des activations (syncEnabledEvents).
import { describe, it, expect, afterEach } from 'vitest';
import { EVENTS, BUILTIN_EVENTS, setCustomEvents } from '../data/events.js';
import { eventToPayload } from '../logic/eventsConfig.js';
import { useGameStore } from '../store/gameStore.js';

const S = () => useGameStore.getState();

afterEach(() => setCustomEvents({})); // remet EVENTS aux seuls intégrés

describe('setCustomEvents', () => {
  it('fusionne les custom par-dessus les intégrés (liaison vivante)', () => {
    const before = Object.keys(EVENTS).length;
    setCustomEvents({ tresorDragon: { name: 'Trésor du dragon', icon: '🐉', desc: '', optional: true, weight: 1, actions: [] } });
    expect(EVENTS.tresorDragon).toBeTruthy();
    expect(EVENTS.rejouer).toBeTruthy(); // intégré préservé
    expect(Object.keys(EVENTS).length).toBe(before + 1);
  });

  it('un nouvel appel remplace l’ensemble des custom (intégrés intacts)', () => {
    setCustomEvents({ a: { name: 'A', actions: [] } });
    setCustomEvents({ b: { name: 'B', actions: [] } });
    expect(EVENTS.a).toBeUndefined();
    expect(EVENTS.b).toBeTruthy();
    expect(Object.keys(BUILTIN_EVENTS).every((k) => EVENTS[k])).toBe(true);
  });
});

describe('eventToPayload', () => {
  it('mappe en colonnes DB (snake_case)', () => {
    const p = eventToPayload({ key: 'k', name: 'X', icon: '✨', desc: 'd', optional: false, weight: 0.5, category: 'money', needsItems: true, actions: [{ action: 'money', mode: 'gain', target: 'self', n: 5 }] });
    expect(p.key).toBe('k');
    expect(p.description).toBe('d');
    expect(p.needs_items).toBe(true);
    expect(p.optional).toBe(false);
    expect(p.weight).toBe(0.5);
    expect(Array.isArray(p.actions)).toBe(true);
  });
});

describe('syncEnabledEvents', () => {
  it('active par défaut un événement custom jamais vu (au setup)', () => {
    useGameStore.setState({ phase: 'setup', enabledEvents: ['rejouer'], knownEventKeys: ['rejouer'] });
    setCustomEvents({ nouvel: { name: 'Nouvel', actions: [] } });
    S().syncEnabledEvents();
    expect(S().enabledEvents).toContain('nouvel');  // jamais vu → activé
    expect(S().knownEventKeys).toContain('nouvel');
  });

  it('ne réactive pas un événement déjà connu mais décoché', () => {
    setCustomEvents({ dejaVu: { name: 'Déjà vu', actions: [] } });
    useGameStore.setState({ phase: 'setup', enabledEvents: ['rejouer'], knownEventKeys: ['rejouer', 'dejaVu'] });
    S().syncEnabledEvents();
    expect(S().enabledEvents).not.toContain('dejaVu'); // connu + décoché → reste off
  });
});
