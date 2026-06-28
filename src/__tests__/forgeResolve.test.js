// Phase 1c — résolution des effets de face au lancer + intégration de l'Égide
// dans la chaîne de recul (max avec le Bouclier, jamais la somme — spec §6.3).
import { describe, it, expect, afterEach } from 'vitest';
import { applyBalance } from '../logic/balanceConfig.js';
import { resolveFaceAtRoll, aegisReduction, facePower, faceRollEngineActions, isRelanceFace, FORGE_RESOLVED } from '../logic/forgeEffects.js';
import { applyRecul, resolveWrongAnswer } from '../logic/turnHelpers.js';

const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 12; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 12 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 13, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const team = (over = {}) => ({ name: 'T', emoji: '🦁', pos: 'n10', money: 100, correct: 0, wrong: 0, powers: {}, equipment: { head: null, body: null, feet: null }, bag: [], ...over });

afterEach(() => applyBalance({})); // restaure les valeurs d'équilibrage par défaut

describe('Forge — résolution de face au lancer', () => {
  it('Prime (tier 1) verse l\'or du palier', () => {
    const r = resolveFaceAtRoll(team({ money: 50 }), { base: 3, value: 3, effect: { type: 'prime', tier: 1 } });
    expect(r.patch.money).toBe(75); // 50 + tiers[1]=25
    expect(r.logs).toHaveLength(1);
  });

  it('Prime est calibrable via balanceConfig', () => {
    applyBalance({ forge: { effects: { prime: { tiers: [99, 0, 0] } } } });
    expect(resolveFaceAtRoll(team({ money: 0 }), { effect: { type: 'prime', tier: 0 } }).patch.money).toBe(99);
  });

  it('Égide arme la réduction (tier 0 = 2 ; tier 2 = cancel)', () => {
    expect(resolveFaceAtRoll(team(), { effect: { type: 'egide', tier: 0 } }).patch.forgeAegis).toBe(2);
    expect(resolveFaceAtRoll(team(), { effect: { type: 'egide', tier: 2 } }).patch.forgeAegis).toBe('cancel');
  });

  it('face sans effet : aucun patch, aucun log', () => {
    const r = resolveFaceAtRoll(team(), { base: 3, value: 5, effect: null });
    expect(r.patch).toEqual({});
    expect(r.logs).toEqual([]);
  });

  it('aegisReduction : nombre / cancel / absente / recul nul', () => {
    expect(aegisReduction({ forgeAegis: 3 }, 6)).toBe(3);
    expect(aegisReduction({ forgeAegis: 'cancel' }, 6)).toBe(6);
    expect(aegisReduction({}, 6)).toBe(0);
    expect(aegisReduction({ forgeAegis: 3 }, 0)).toBe(0);
  });
});

describe('Forge — Égide dans applyRecul (max avec Bouclier, jamais la somme)', () => {
  it('Égide seule réduit le recul sans consommer de charge', () => {
    const r = applyRecul(team({ forgeAegis: 4 }), BOARD, 6);
    expect(r.applied).toBe(2); // 6 − 4
    expect(r.patch.powers).toBeUndefined();
  });

  it('Égide « cancel » annule tout le recul', () => {
    expect(applyRecul(team({ forgeAegis: 'cancel' }), BOARD, 5).applied).toBe(0);
  });

  it('MAX : Égide 4 ≥ Bouclier 2 → réduit de 4 et GARDE la charge', () => {
    const t = team({ forgeAegis: 4, powers: { bouclier: { charges: 1, level: 1 } } }); // amount 2
    const r = applyRecul(t, BOARD, 6);
    expect(r.applied).toBe(2);             // max(2,4)=4 → 6−4
    expect(r.patch.powers).toBeUndefined(); // charge non consommée
  });

  it('Bouclier 6 > Égide 2 → le pouvoir gagne et consomme la charge', () => {
    const t = team({ forgeAegis: 2, powers: { bouclier: { charges: 1, level: 3 } } }); // amount 6
    const r = applyRecul(t, BOARD, 6);
    expect(r.applied).toBe(0);                       // max(6,2)=6 → 0
    expect(r.patch.powers.bouclier.charges).toBe(0); // charge consommée
  });

  it('sans Égide : Bouclier inchangé (régression)', () => {
    const t = team({ powers: { bouclier: { charges: 1, level: 1 } } });
    const r = applyRecul(t, BOARD, 6); // amount 2 → recul 4
    expect(r.applied).toBe(4);
    expect(r.patch.powers.bouclier.charges).toBe(0);
  });
});

describe('Forge — armement des effets au lancer', () => {
  const arm = (type, tier) => resolveFaceAtRoll(team(), { effect: { type, tier } }).patch;

  it('Aubaine arme un multiplicateur d\'or', () => {
    expect(arm('aubaine', 0).forgeGoldMult).toBe(1.5);
    expect(arm('aubaine', 2).forgeGoldMult).toBe(3);
  });
  it('Indice arme un nombre de réponses à éliminer', () => {
    expect(arm('indice', 0).forgeIndice).toBe(1);
    expect(arm('indice', 1).forgeIndice).toBe(2);
  });
  it('Répit arme des secondes', () => {
    expect(arm('repit', 0).forgeRepit).toBe(5);
    expect(arm('repit', 1).forgeRepit).toBe(10);
  });
  it('Garde de série arme un drapeau', () => {
    expect(arm('gardeSerie', 0).forgeStreakGuard).toBe(true);
  });
  it('Butin arme une fraction de chance ou « guaranteed »', () => {
    expect(arm('butin', 0).forgeButin).toBe(0.5);
    expect(arm('butin', 1).forgeButin).toBe('guaranteed');
  });
  it('Question fraîche arme un drapeau', () => {
    expect(arm('questionFraiche', 0).forgeFreshQ).toBe(true);
  });
  it('Recharge → action moteur gainCharge avec le bon palier', () => {
    expect(faceRollEngineActions({ effect: { type: 'recharge', tier: 0 } })).toEqual([{ action: 'gainCharge', n: 1 }]);
    expect(faceRollEngineActions({ effect: { type: 'recharge', tier: 2 } })).toEqual([{ action: 'gainCharge', n: 'full' }]);
    expect(faceRollEngineActions({ effect: { type: 'prime', tier: 0 } })).toEqual([]);
  });
  it('isRelanceFace détecte une face Relance', () => {
    expect(isRelanceFace({ effect: { type: 'relance', tier: 0 } })).toBe(true);
    expect(isRelanceFace({ effect: null })).toBe(false);
  });
  it('FORGE_RESOLVED couvre le lot complet (10 effets)', () => {
    ['prime', 'egide', 'aubaine', 'indice', 'repit', 'gardeSerie', 'butin', 'recharge', 'questionFraiche', 'relance']
      .forEach((k) => expect(FORGE_RESOLVED).toContain(k));
  });
});

describe('Forge — puissance de face', () => {
  it('facePower = valeur + coût de l\'effet', () => {
    expect(facePower({ value: 5, effect: null })).toBe(5);
    expect(facePower({ value: 3, effect: { type: 'prime', tier: 1 } })).toBe(7); // 3 + coût 4
    expect(facePower({ value: 6, effect: { type: 'egide', tier: 2 } })).toBe(12); // 6 + coût 6
  });
});

describe('Forge — face valeur 0 = pas de recul', () => {
  it('resolveWrongAnswer avec un recul de base 0 ne fait pas reculer', () => {
    const r = resolveWrongAnswer(team(), BOARD, 'X', 0);
    expect(r.updatedTeam.pos).toBe('n10');
    expect(r.updatedTeam.wrong).toBe(1);
  });
});

describe('Forge — faces multi-effets (jusqu\'à 3)', () => {
  it('facePower somme les coûts de tous les effets', () => {
    // 2 (avance) + coût(prime,1)=4 + coût(egide,0)=2 = 8
    expect(facePower({ value: 2, effects: [{ type: 'prime', tier: 1 }, { type: 'egide', tier: 0 }] })).toBe(8);
  });

  it('deux Prime cumulent l\'or, une Prime + un Répit arment les deux', () => {
    const r = resolveFaceAtRoll(team({ money: 0 }), { effects: [{ type: 'prime', tier: 0 }, { type: 'prime', tier: 1 }] });
    expect(r.patch.money).toBe(35); // 10 + 25
    const r2 = resolveFaceAtRoll(team({ money: 0 }), { effects: [{ type: 'prime', tier: 0 }, { type: 'repit', tier: 1 }] });
    expect(r2.patch.money).toBe(10);
    expect(r2.patch.forgeRepit).toBe(10);
  });

  it('deux Égide fusionnent en prenant la plus forte (cancel l\'emporte)', () => {
    const r = resolveFaceAtRoll(team(), { effects: [{ type: 'egide', tier: 0 }, { type: 'egide', tier: 2 }] });
    expect(r.patch.forgeAegis).toBe('cancel');
  });

  it('faceRollEngineActions renvoie une action par Recharge', () => {
    const acts = faceRollEngineActions({ effects: [{ type: 'recharge', tier: 0 }, { type: 'recharge', tier: 2 }] });
    expect(acts).toEqual([{ action: 'gainCharge', n: 1 }, { action: 'gainCharge', n: 'full' }]);
  });

  it('isRelanceFace détecte une Relance dans le tableau d\'effets', () => {
    expect(isRelanceFace({ effects: [{ type: 'prime', tier: 0 }, { type: 'relance', tier: 0 }] })).toBe(true);
    expect(isRelanceFace({ effects: [{ type: 'prime', tier: 0 }] })).toBe(false);
  });

  it('la forme héritée `effect` (singulier) reste résolue', () => {
    const r = resolveFaceAtRoll(team({ money: 0 }), { effect: { type: 'prime', tier: 1 } });
    expect(r.patch.money).toBe(25);
  });
});
