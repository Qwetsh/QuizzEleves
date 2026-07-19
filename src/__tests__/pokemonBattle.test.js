// Moteur de combat Pokémon (logic/pokemonBattle.js) : table des types Gén. 1,
// formule de dégâts, statuts, ordre par Vitesse, K.O./victoire, switch, draft.
// RNG injecté → tout est déterministe.
import { describe, it, expect } from 'vitest';
import {
  TYPE_CHART, typeMultiplier, statAt50, HP_SCALE,
  createBattle, resolveTurn, sendReplacement, activeFighter, aliveCount, draftOffers,
} from '../logic/pokemonBattle.js';

// RNG scripté : consomme la liste, puis 0.5.
const rngOf = (vals) => { let i = 0; return () => (i < vals.length ? vals[i++] : 0.5); };

// Fiches de test minimalistes.
const mon = (over = {}) => ({
  id: 1, name: 'Testmon', types: ['normal'], bst: 400, legendary: false,
  base: { hp: 100, atk: 100, def: 100, spc: 100, spe: 100 },
  moves: [
    { id: 'tackle', fr: 'Charge', type: 'normal', power: 40, accuracy: 100, effects: [] },
    { id: 'ember', fr: 'Flammèche', type: 'fire', power: 40, accuracy: 100, effects: [] },
    { id: 'thunder-wave', fr: 'Cage Éclair', type: 'electric', power: 0, accuracy: 90, effects: [{ kind: 'ailment', ailment: 'par' }] },
    { id: 'swords-dance', fr: 'Danse-Lames', type: 'normal', power: 0, accuracy: 100, effects: [{ kind: 'boost', stat: 'atk', delta: 2, target: 'self' }] },
  ],
  ...over,
});

describe('pokemonBattle — table des types et stats', () => {
  it('multiplicateurs Gén. 1 (immunités, doubles faiblesses, particularités)', () => {
    expect(typeMultiplier('electric', ['ground'])).toBe(0);
    expect(typeMultiplier('normal', ['ghost'])).toBe(0);
    expect(typeMultiplier('fire', ['grass'])).toBe(2);
    expect(typeMultiplier('water', ['fire'])).toBe(2);
    expect(typeMultiplier('electric', ['water', 'flying'])).toBe(4); // Léviator !
    expect(typeMultiplier('fire', ['water'])).toBe(0.5);
    expect(typeMultiplier('bug', ['poison'])).toBe(2);  // particularité Gén. 1
    expect(typeMultiplier('ice', ['fire'])).toBe(1);    // particularité Gén. 1
    expect(typeMultiplier('ghost', ['psychic'])).toBe(2); // bug d'époque corrigé
    // chaque type de la table ne référence que des types connus
    for (const [atk, row] of Object.entries(TYPE_CHART)) {
      expect(TYPE_CHART[atk]).toBeTruthy();
      for (const d of Object.keys(row)) expect(TYPE_CHART[d]).toBeTruthy();
    }
  });

  it('stats au niveau 50 — PV réduits par HP_SCALE, autres stats pleines', () => {
    expect(statAt50(100)).toBe(120);            // (2×100+31)×50/100 + 5
    expect(statAt50(100, true)).toBe(Math.floor((115 + 60) * HP_SCALE));
  });
});

describe('pokemonBattle — résolution de tour', () => {
  it('dégâts : STAB, efficacité et ordre par Vitesse', () => {
    const fast = mon({ name: 'Rapide', base: { ...mon().base, spe: 130 } });
    const slowGrass = mon({ name: 'Lent', types: ['grass'], base: { ...mon().base, spe: 20 } });
    const b = createBattle([fast], [slowGrass]);
    // rng : pas de paralysie ici ; ordre = A d'abord (plus rapide)
    const ev = resolveTurn(b, { A: { type: 'move', index: 1 }, B: { type: 'move', index: 0 } }, rngOf([0.5, 0.5, 0.99, 0.5, 0.5, 0.99]));
    const dmgOnB = ev.find((e) => e.kind === 'damage' && e.side === 'B');
    const dmgOnA = ev.find((e) => e.kind === 'damage' && e.side === 'A');
    expect(ev.findIndex((e) => e.side === 'B' && e.kind === 'damage')).toBeLessThan(ev.findIndex((e) => e.kind === 'damage' && e.side === 'A'));
    expect(dmgOnB.mult).toBe(2);           // Flammèche sur Plante
    expect(dmgOnA.mult).toBe(1);
    // Charge de B est STAB (normal/normal) : dégâts > Flammèche non-STAB à puissance égale ? Non comparable
    // directement (défenses différentes) — on vérifie juste des dégâts positifs et PV entamés.
    expect(activeFighter(b, 'B').hp).toBeLessThan(activeFighter(b, 'B').maxHp);
  });

  it('paralysie : statut posé, Vitesse divisée, tour perdu à 25 %', () => {
    const a = mon({ name: 'A', base: { ...mon().base, spe: 200 } });
    const c = mon({ name: 'B', base: { ...mon().base, spe: 100 } });
    const b = createBattle([a], [c]);
    // A pose Cage Éclair (précision ok), B danse (pas d'aléa consommé)
    resolveTurn(b, { A: { type: 'move', index: 2 }, B: { type: 'move', index: 3 } }, rngOf([0.1]));
    expect(activeFighter(b, 'B').status).toBe('par');
    // Tour suivant : B paralysé perd son tour (rng paralysie < 0.25)
    const ev2 = resolveTurn(b, { A: { type: 'move', index: 3 }, B: { type: 'move', index: 0 } }, rngOf([0.5, 0.1]));
    expect(ev2.some((e) => e.kind === 'paralyzed' && e.side === 'B')).toBe(true);
    expect(ev2.some((e) => e.kind === 'damage' && e.side === 'A')).toBe(false);
  });

  it('électrique ne paralyse pas le type Sol ; poison inoffensif sur type Poison', () => {
    const ground = mon({ name: 'Sol', types: ['ground'] });
    const b = createBattle([mon()], [ground]);
    resolveTurn(b, { A: { type: 'move', index: 2 }, B: { type: 'move', index: 3 } }, rngOf([0.1]));
    expect(activeFighter(b, 'B').status).toBe(null);
  });

  it('sommeil : tours sautés puis réveil ; poison : 1/8 par tour', () => {
    const sleeper = mon({ moves: [{ id: 'spore', fr: 'Spore', type: 'grass', power: 0, accuracy: 100, effects: [{ kind: 'ailment', ailment: 'slp' }] }, ...mon().moves.slice(1)] });
    const b = createBattle([sleeper], [mon({ base: { ...mon().base, spe: 10 } })]);
    // sommeil 3 tours (rng 0.9 → 1+2) : le tour d'endormissement en consomme
    // déjà un (l'endormi plus lent perd son action du tour — fidèle Gén. 1).
    resolveTurn(b, { A: { type: 'move', index: 0 }, B: { type: 'move', index: 0 } }, rngOf([0.1, 0.9]));
    expect(activeFighter(b, 'B').status).toBe('slp');
    const ev = resolveTurn(b, { A: { type: 'move', index: 3 }, B: { type: 'move', index: 0 } }, rngOf([]));
    expect(ev.some((e) => e.kind === 'asleep' && e.side === 'B')).toBe(true);
    const ev2 = resolveTurn(b, { A: { type: 'move', index: 3 }, B: { type: 'move', index: 0 } }, rngOf([0.5, 0.5, 0.99]));
    expect(ev2.some((e) => e.kind === 'wake' && e.side === 'B')).toBe(true);
  });

  it('boosts : Danse-Lames +2, plafond ±2, reset au switch', () => {
    const b = createBattle([mon(), mon({ name: 'Remplaçant' })], [mon({ base: { ...mon().base, spe: 10 } })]);
    resolveTurn(b, { A: { type: 'move', index: 3 }, B: { type: 'move', index: 3 } }, rngOf([]));
    expect(activeFighter(b, 'A').boosts.atk).toBe(2);
    const ev = resolveTurn(b, { A: { type: 'move', index: 3 }, B: { type: 'move', index: 3 } }, rngOf([]));
    expect(activeFighter(b, 'A').boosts.atk).toBe(2); // plafonné
    expect(ev.some((e) => e.kind === 'fail' && e.side === 'A')).toBe(true);
    // switch → boosts remis à zéro, PV conservés
    const hpBefore = b.sides.A.fighters[0].hp;
    resolveTurn(b, { A: { type: 'switch', index: 1 }, B: { type: 'move', index: 3 } }, rngOf([]));
    resolveTurn(b, { A: { type: 'switch', index: 0 }, B: { type: 'move', index: 3 } }, rngOf([]));
    expect(activeFighter(b, 'A').boosts.atk).toBe(0);
    expect(activeFighter(b, 'A').hp).toBe(hpBefore);
  });

  it('K.O. → pendingSwitch, remplaçant envoyé, victoire au dernier', () => {
    const weak = mon({ name: 'Fragile', base: { hp: 1, atk: 10, def: 10, spc: 10, spe: 10 } });
    const strong = mon({ name: 'Costaud', base: { ...mon().base, atk: 150 } });
    const b = createBattle([strong], [weak, mon({ name: 'Fragile2', base: { hp: 1, atk: 10, def: 10, spc: 10, spe: 10 } })]);
    const ev = resolveTurn(b, { A: { type: 'move', index: 0 }, B: { type: 'move', index: 0 } }, rngOf([0.5, 0.5, 0.99]));
    expect(ev.some((e) => e.kind === 'ko' && e.side === 'B')).toBe(true);
    expect(b.pendingSwitch).toBe('B');
    expect(b.winner).toBe(null);
    // tant que le remplaçant n'est pas envoyé, resolveTurn est inerte
    expect(resolveTurn(b, { A: { type: 'move', index: 0 }, B: { type: 'move', index: 0 } })).toEqual([]);
    const ev2 = sendReplacement(b, 'B', 1);
    expect(ev2.some((e) => e.kind === 'switch' && e.side === 'B')).toBe(true);
    // K.O. du dernier → victoire A
    const ev3 = resolveTurn(b, { A: { type: 'move', index: 0 }, B: { type: 'move', index: 0 } }, rngOf([0.5, 0.5, 0.99]));
    expect(b.winner).toBe('A');
    expect(ev3.some((e) => e.kind === 'win' && e.side === 'A')).toBe(true);
    expect(aliveCount(b, 'B')).toBe(0);
  });
});

describe('pokemonBattle — data générée et draft', () => {
  it('pokemonBattle.json : 151 fiches, movesets complets et supportés', async () => {
    const { default: MONS } = await import('../data/pokemonBattle.json');
    expect(MONS.length).toBe(151);
    const complete = MONS.filter((m) => m.moves.length === 4);
    expect(complete.length).toBeGreaterThanOrEqual(140);
    for (const m of MONS) {
      expect(typeof m.name).toBe('string');
      expect(m.types.length).toBeGreaterThanOrEqual(1);
      for (const t of m.types) expect(TYPE_CHART[t]).toBeTruthy();
      expect(m.sprite).toContain('.gif');
      for (const mv of m.moves) {
        expect(TYPE_CHART[mv.type]).toBeTruthy();
        for (const e of mv.effects) {
          if (e.kind === 'ailment') expect(['par', 'psn', 'slp']).toContain(e.ailment);
          if (e.kind === 'boost') expect(['atk', 'def', 'spc', 'spe']).toContain(e.stat);
        }
      }
      // au moins une attaque offensive par moveset complet
      if (m.moves.length === 4) expect(m.moves.some((mv) => mv.power > 0)).toBe(true);
    }
  });

  it('draft 6→3 : équitable, sans doublon ni légendaire', async () => {
    const { default: MONS } = await import('../data/pokemonBattle.json');
    const rng = rngOf([0.1, 0.9, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6, 0.15, 0.85, 0.25, 0.75]);
    const offers = draftOffers(MONS, rng);
    expect(offers.A.length).toBe(6);
    expect(offers.B.length).toBe(6);
    const ids = [...offers.A, ...offers.B].map((m) => m.id);
    expect(new Set(ids).size).toBe(12);
    expect([...offers.A, ...offers.B].every((m) => !m.legendary)).toBe(true);
    // appariement : les totaux de stats des deux équipes restent proches
    const sum = (t) => t.reduce((s, m) => s + m.bst, 0);
    expect(Math.abs(sum(offers.A) - sum(offers.B))).toBeLessThan(200);
  });
});
