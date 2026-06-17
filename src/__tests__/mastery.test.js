// Extension « Maîtrise » : résolveur central, paliers 1→10, embranchements L5/L10,
// compatibilité 3 niveaux (sans extension) et flux d'amélioration via le store.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { POWERS } from '../data/powers.js';
import { resolveWrongAnswer, applyRecul } from '../logic/turnHelpers.js';
import {
  resolvePowerEffect, maxPowerLevel, powerUpgradeCost, describePowerScale, specSlotForLevel,
} from '../logic/powerEffects.js';

const BOARD = (() => {
  const b = { depart: { x: 0, y: 0, type: 'depart', next: ['n1'] } };
  for (let i = 1; i <= 12; i++) b[`n${i}`] = { x: i, y: 0, type: 'subject', subject: 'maths', next: [i === 12 ? 'arrivee' : `n${i + 1}`] };
  b.arrivee = { x: 13, y: 0, type: 'arrivee', next: [] };
  return b;
})();

const teamWith = (key, over) => ({ name: 'T', emoji: '🦁', pos: 'n10', money: 9999, correct: 0, wrong: 0, powers: { [key]: { charges: 2, level: 1, ...over } }, equipment: { head: null, body: null, feet: null }, bag: [] });

describe('résolveur resolvePowerEffect', () => {
  it('mastery OFF → effet des levels classiques (3 niveaux)', () => {
    const t = teamWith('bouclier', { level: 3 });
    expect(resolvePowerEffect(t, 'bouclier', false).amount).toBe(6); // levels[2]
  });

  it('mastery ON → L1-3 identiques aux levels (compat équilibrage)', () => {
    for (let lvl = 1; lvl <= 3; lvl++) {
      const legacy = POWERS.bouclier.levels[lvl - 1].effect.amount;
      const tree = resolvePowerEffect(teamWith('bouclier', { level: lvl }), 'bouclier', true).amount;
      expect(tree).toBe(legacy);
    }
  });

  it('mastery ON → paliers hauts (L10 bouclier = 14 cases)', () => {
    expect(resolvePowerEffect(teamWith('bouclier', { level: 10 }), 'bouclier', true).amount).toBe(14);
  });

  it('branche L5 fusionne (champ NOUVEAU) sans écraser le cœur', () => {
    const t = teamWith('bouclier', { level: 6, spec5: 'gold' });
    const eff = resolvePowerEffect(t, 'bouclier', true);
    expect(eff.goldPerCaseAbsorbed).toBe(1); // ajout de la voie « Rempart doré »
    expect(eff.amount).toBe(9); // cœur du niveau 6 conservé
  });

  it('branche L10 ÉCRASE le cœur (Forteresse amount:99)', () => {
    const t = teamWith('bouclier', { level: 10, spec10: 'fortress' });
    expect(resolvePowerEffect(t, 'bouclier', true).amount).toBe(99);
  });

  it('une branche non débloquée (niveau < 5) est ignorée', () => {
    const t = teamWith('bouclier', { level: 4, spec5: 'gold' });
    expect(resolvePowerEffect(t, 'bouclier', true).goldPerCaseAbsorbed).toBeUndefined();
  });
});

describe('niveaux & coûts', () => {
  it('maxPowerLevel : 3 sans extension, 10 avec', () => {
    expect(maxPowerLevel('foudre', false)).toBe(3);
    expect(maxPowerLevel('foudre', true)).toBe(10);
  });
  it('powerUpgradeCost : null au max', () => {
    expect(powerUpgradeCost('foudre', 3, false)).toBeNull();
    expect(powerUpgradeCost('foudre', 10, true)).toBeNull();
    expect(powerUpgradeCost('foudre', 1, true)).toBe(POWERS.foudre.tree.upgradeCosts[0]);
  });
  it('specSlotForLevel : embranchement à 5 et 10', () => {
    expect(specSlotForLevel(5)).toBe('spec5');
    expect(specSlotForLevel(10)).toBe('spec10');
    expect(specSlotForLevel(6)).toBeNull();
  });
  it('describePowerScale produit un texte lisible', () => {
    expect(describePowerScale('bouclier', 1, true)).toContain('Recul');
    expect(describePowerScale('foudre', 3, true)).toContain('1D10');
  });
});

describe('Bouclier en jeu : tree vs legacy', () => {
  it('resolveWrongAnswer mastery ON utilise le tree (L10 absorbe un gros recul)', () => {
    const t = teamWith('bouclier', { level: 10 });
    const r = resolveWrongAnswer(t, BOARD, 'Mauvaise réponse', 12, true); // amount 14 ≥ 12
    expect(r.updatedTeam.pos).toBe('n10'); // recul totalement absorbé
  });
  it('resolveWrongAnswer mastery OFF reste sur les 3 niveaux', () => {
    const t = teamWith('bouclier', { level: 3 });
    const r = resolveWrongAnswer(t, BOARD, 'Mauvaise réponse', 12, false); // amount 6 → recul 6
    expect(r.updatedTeam.pos).toBe('n4'); // n10 reculé de 6
  });
});

describe('flux store : amélioration jusqu’à L10 + choix de voie', () => {
  const S = () => useGameStore.getState();
  beforeEach(() => {
    useGameStore.setState({
      phase: 'game', devSandbox: true, board: BOARD, finished: false,
      currentTeam: 0, log: [], showSpecPicker: null,
      extensions: { equipment: true, mastery: true },
      teams: [teamWith('double', { level: 1 })],
    });
  });

  it('on peut améliorer jusqu’au niveau 10', () => {
    for (let i = 0; i < 9; i++) {
      S().upgradePowerLevel('double');
      // au passage L5/L10 un picker s'ouvre : on choisit pour pouvoir continuer
      if (S().showSpecPicker) S().chooseSpec(S().showSpecPicker.slot === 'spec5' ? 'exam' : 'general');
    }
    expect(S().teams[0].powers.double.level).toBe(10);
  });

  it('le picker de voie s’ouvre au niveau 5 et chooseSpec verrouille la voie', () => {
    for (let i = 0; i < 4; i++) S().upgradePowerLevel('double'); // → niveau 5
    expect(S().teams[0].powers.double.level).toBe(5);
    expect(S().showSpecPicker).toMatchObject({ powerKey: 'double', slot: 'spec5' });
    S().chooseSpec('shared');
    expect(S().teams[0].powers.double.spec5).toBe('shared');
    expect(S().showSpecPicker).toBeNull();
  });

  it('sans extension mastery, l’amélioration plafonne à 3', () => {
    useGameStore.setState({ extensions: { equipment: true, mastery: false } });
    for (let i = 0; i < 6; i++) S().upgradePowerLevel('double');
    expect(S().teams[0].powers.double.level).toBe(3);
    expect(S().showSpecPicker).toBeNull();
  });
});

describe('branches Foudre câblées', () => {
  const S = () => useGameStore.getState();
  const base = (teams, pk = 'foudre') => useGameStore.setState({
    phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0,
    log: [], extensions: { equipment: true, mastery: true }, showTargetPicker: { powerKey: pk },
    teams, emitVfx: () => {},
  });
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.5));
  const after = () => vi.restoreAllMocks();

  it('Cataclysme (L10) recule TOUTES les autres équipes', () => {
    base([
      teamWith('foudre', { level: 10, spec10: 'cataclysm' }),
      { ...teamWith('foudre'), pos: 'n10', powers: {} },
      { ...teamWith('foudre'), pos: 'n8', powers: {} },
    ]);
    S().applyOffensivePower(1);
    expect(S().teams[1].pos).not.toBe('n10');
    expect(S().teams[2].pos).not.toBe('n8'); // touchée aussi
    after();
  });

  it('Égide (L5) : la cible protège son recul avec son Bouclier (charge consommée)', () => {
    base([
      teamWith('foudre', { level: 1 }), // d4 → recul 3 (mock 0.5)
      { ...teamWith('bouclier', { level: 5, spec5: 'aegis', charges: 1 }), pos: 'n10' },
    ]);
    S().applyOffensivePower(1);
    // bouclier niv.5 retire 6 ≥ 3 → recul absorbé, charge consommée
    expect(S().teams[1].pos).toBe('n10');
    expect(S().teams[1].powers.bouclier.charges).toBe(0);
    after();
  });

  it('Silence (Sablier L5) : pose le drapeau + bloque le pouvoir de la cible', () => {
    base([teamWith('sablier', { level: 5, spec5: 'silence' }), { ...teamWith('foudre', { charges: 2 }), pos: 'n8' }], 'sablier');
    S().applyOffensivePower(1);
    expect(S().teams[1].silencedNextTurn).toBe(true);
    after();
  });

  it('Gel (Sablier L10) : pose skipNextRoll sur la cible', () => {
    base([teamWith('sablier', { level: 10, spec10: 'freeze' }), { ...teamWith('foudre'), pos: 'n8' }], 'sablier');
    S().applyOffensivePower(1);
    expect(S().teams[1].skipNextRoll).toBe(true);
    after();
  });
});

describe('branches Indice câblées', () => {
  const S = () => useGameStore.getState();
  const setup = (over) => useGameStore.setState({
    phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
    extensions: { equipment: true, mastery: true }, indiceUsed: false, indiceHidden: [],
    showQuestion: { question: { a: ['A', 'B', 'C', 'D'], c: 1 }, subject: 'maths' },
    teams: [teamWith('indice', over)],
  });

  it('50/50 (L5) : ne laisse que 2 réponses (2 éliminées sur 3)', () => {
    setup({ level: 5, spec5: 'fifty', charges: 1 });
    S().useIndice();
    expect(S().indiceHidden).toHaveLength(2);
  });

  it('Omniscience (L10) : élimine toutes les mauvaises (3) et coûte 2 charges', () => {
    setup({ level: 10, spec10: 'omni', charges: 2 });
    S().useIndice();
    expect(S().indiceHidden).toHaveLength(3);
    expect(S().teams[0].powers.indice.charges).toBe(0); // 2 charges consommées
  });
});

describe('branches Bouclier câblées (or)', () => {
  it('Rempart doré (L5) : +1 or par case de recul absorbée', () => {
    const t = teamWith('bouclier', { level: 5, spec5: 'gold', charges: 1 });
    t.money = 0;
    const r = applyRecul(t, BOARD, 3, true); // niv.5 : +5 or de palier + 3 (1/case absorbée)
    expect(r.bonusMoney).toBe(8);
    expect(r.patch.money).toBe(8);
  });
});

describe('branches Double câblées', () => {
  const S = () => useGameStore.getState();
  const cast = (over, extra) => {
    useGameStore.setState({
      phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
      extensions: { equipment: true, mastery: true }, showTargetPicker: { powerKey: 'double' },
      teams: [teamWith('double', over), { ...teamWith('foudre'), pos: 'n8' }],
      ...extra,
    });
    S().applyOffensivePower(1);
  };

  it('Tout-ou-rien (L10) : banque active + « sans bonus » levé', () => {
    cast({ level: 10, spec10: 'allin' });
    expect(S().teams[1].doubleAllOrNothing).toBe(true);
    expect(S().teams[1].doubleNoBonus).toBe(false);
  });

  it('Examen surprise (L5) : force une question Hardcore sur la cible', () => {
    cast({ level: 5, spec5: 'exam' }, { questions: { hardcore: [{ q: '?', a: ['A', 'B', 'C', 'D'], c: 0 }] } });
    expect(S().teams[1].forcedSubject).toBe('hardcore');
  });
});
