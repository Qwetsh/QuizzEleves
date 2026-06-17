// Extension « Maîtrise » : résolveur central, paliers 1→10, embranchements L5/L10,
// compatibilité 3 niveaux (sans extension) et flux d'amélioration via le store.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { POWERS } from '../data/powers.js';
import { resolveWrongAnswer } from '../logic/turnHelpers.js';
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
