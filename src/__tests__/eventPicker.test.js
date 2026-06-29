import { pickRandomEvent } from '../logic/eventPicker.js';

// We rely on the real EVENTS import inside eventPicker.js

describe('pickRandomEvent', () => {
  it('returns an event from the enabled list', () => {
    const result = pickRandomEvent(['rejouer', 'recul', 'coupDePouce']);
    expect(result).not.toBeNull();
    expect(['rejouer', 'recul', 'coupDePouce']).toContain(result.key);
    expect(result.event).toBeDefined();
    expect(result.event.name).toBeDefined();
  });

  it('returns null for an empty list', () => {
    const result = pickRandomEvent([]);
    expect(result).toBeNull();
  });

  it('returns null when no keys match existing events', () => {
    const result = pickRandomEvent(['nonexistent_event']);
    expect(result).toBeNull();
  });

  it('returns the only event when list has one item', () => {
    const result = pickRandomEvent(['rejouer']);
    expect(result.key).toBe('rejouer');
  });

  it('respects weighted selection (oubli has lower weight)', () => {
    // Run many picks with only oubli (weight 0.25) and rejouer (weight 1)
    // oubli should appear roughly 20% of the time (0.25 / 1.25)
    const counts = { oubli: 0, rejouer: 0 };
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const result = pickRandomEvent(['oubli', 'rejouer']);
      counts[result.key]++;
    }

    // oubli should be picked significantly less often than rejouer
    expect(counts.oubli).toBeLessThan(counts.rejouer);
    // With weight ratio 0.25:1, oubli should be ~20%. Allow wide margin.
    expect(counts.oubli).toBeLessThan(iterations * 0.4);
    expect(counts.oubli).toBeGreaterThan(iterations * 0.05);
  });

  it('treats events without a weight as weight 1 (no NaN degeneration)', () => {
    // 'tresor' is a money event defined without a `weight` property.
    // Before the fix, NaN total weight made the picker always fall back to pool[0].
    const counts = { rejouer: 0, tresor: 0 };
    const iterations = 1000;

    for (let i = 0; i < iterations; i++) {
      const result = pickRandomEvent(['rejouer', 'tresor']);
      counts[result.key]++;
    }

    // Both equal-weight events should be picked a comparable number of times.
    expect(counts.tresor).toBeGreaterThan(iterations * 0.3);
    expect(counts.rejouer).toBeGreaterThan(iterations * 0.3);
  });

  it('« hacking » (requiresPhone) : exclu hors mode téléphone, tiré en mode téléphone', () => {
    // Sans connectionMode (ou 'board') : l'event est filtré → seul rejouer reste.
    for (let i = 0; i < 50; i++) {
      const r = pickRandomEvent(['hacking', 'rejouer'], { connectionMode: 'board' });
      expect(r.key).toBe('rejouer');
    }
    // En mode téléphone : il devient éligible (au moins une fois sur 200 tirages).
    let seen = false;
    for (let i = 0; i < 200 && !seen; i++) {
      if (pickRandomEvent(['hacking', 'rejouer'], { connectionMode: 'phone' }).key === 'hacking') seen = true;
    }
    expect(seen).toBe(true);
  });
});
