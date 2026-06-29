// Extension « Maîtrise » : résolveur central, paliers 1→10, embranchements L5/L10,
// compatibilité 3 niveaux (sans extension) et flux d'amélioration via le store.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { POWERS } from '../data/powers.js';
import { applyBalance } from '../logic/balanceConfig.js';
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
    expect(eff.goldOnUse).toBe(5); // ajout de la voie « Rempart doré » (forfait base)
    expect(eff.amount).toBe(9); // cœur du niveau 6 conservé
  });

  it('branche L10 ajoute un champ de drapeau (Forteresse) sans casser le cœur', () => {
    const t = teamWith('bouclier', { level: 10, spec10: 'fortress' });
    const eff = resolvePowerEffect(t, 'bouclier', true);
    expect(eff.fortressAdvance).toBe(true);
    expect(eff.amount).toBe(14); // cœur du niveau 10 conservé
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
    expect(describePowerScale('foudre', 8, true)).toContain('1D10'); // L8 = D10
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
      if (S().showSpecPicker) S().chooseSpec(S().showSpecPicker.slot === 'spec5' ? 'corsees' : 'allOthers');
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

  it('Anti-Foudre (L5) : la cible réduit de moitié le recul de Foudre (charge consommée)', () => {
    base([
      teamWith('foudre', { level: 1 }), // d4 → recul 3 (mock 0.5)
      { ...teamWith('bouclier', { level: 5, spec5: 'antifoudre', charges: 1 }), pos: 'n10' },
    ]);
    S().applyOffensivePower(1);
    // recul 3 réduit de moitié → ~2 → n10 reculé de 2, charge consommée
    expect(S().teams[1].pos).toBe('n8');
    expect(S().teams[1].powers.bouclier.charges).toBe(0);
    after();
  });

  it('Pillage (voie, palier L6) : vole ½ × la valeur du dé', () => {
    base([
      teamWith('foudre', { level: 6, spec5: 'pillage', charges: 2 }),
      { ...teamWith('foudre'), pos: 'n10', powers: {}, money: 100 },
    ]);
    S().applyOffensivePower(1);
    // d6 (mock 0.5) = 4 → vol round(4 × 0.5) = 2 ; le lanceur encaisse.
    expect(S().teams[1].money).toBe(98);
    expect(S().teams[0].money).toBe(9999 + 2);
    after();
  });

  it('Renvoi au départ (ultime, à 5 charges) : envoie la cible au départ et coûte 5 charges', () => {
    base([
      teamWith('foudre', { level: 10, spec10: 'banishStart', charges: 5 }),
      { ...teamWith('foudre'), pos: 'n8', powers: {} },
    ]);
    S().applyOffensivePower(1);
    expect(S().teams[1].pos).toBe('depart');
    expect(S().teams[0].powers.foudre.charges).toBe(0);
    after();
  });

  it('Renvoi au départ sous 5 charges : recul classique, pas de renvoi', () => {
    base([
      teamWith('foudre', { level: 10, spec10: 'banishStart', charges: 2 }),
      { ...teamWith('foudre'), pos: 'n8', powers: {} },
    ]);
    S().applyOffensivePower(1);
    expect(S().teams[1].pos).not.toBe('depart'); // recul normal
    expect(S().teams[0].powers.foudre.charges).toBe(1); // 1 seule charge consommée
    after();
  });

  it('Orage persistant (ultime) : pose le DoT, qui recule la cible au début de son tour', () => {
    base([
      teamWith('foudre', { level: 10, spec10: 'orage', charges: 2 }),
      { ...teamWith('foudre'), pos: 'n12', powers: {} },
    ]);
    S().applyOffensivePower(1);
    expect(S().teams[1].orageRecul).toMatchObject({ turns: 2, die: 'd4' });
    const posAfterCast = S().teams[1].pos; // déjà reculé par la Foudre L10
    // La main passe à l'équipe 1 : l'orage la fait reculer davantage.
    useGameStore.setState({ currentTeam: 0 });
    S().nextTurn();
    expect(S().currentTeam).toBe(1);
    expect(S().teams[1].orageRecul.turns).toBe(1); // 1 tour restant
    expect(BOARD[S().teams[1].pos].x).toBeLessThan(BOARD[posAfterCast].x); // reculé
    after();
  });
});

describe('Indice — arbre (résolveur)', () => {
  const ind = (over) => resolvePowerEffect(teamWith('indice', over), 'indice', true);
  it('cœur : 1 élimination + chance d’une 2ᵉ (25→50→75 %), puis 2 sûres dès L6', () => {
    expect(ind({ level: 1 }).count).toBe(1);
    expect(ind({ level: 2 }).secondChance).toBe(0.25);
    expect(ind({ level: 4 }).secondChance).toBe(0.75);
    expect(ind({ level: 6 }).count).toBe(2);
  });
  it('voie « Maîtrise du temps » : +5 (L7) → +10 (L8) → +15 (L9)', () => {
    expect(ind({ level: 7, spec5: 'temps' }).hintTimeBonus).toBe(5);
    expect(ind({ level: 8, spec5: 'temps' }).hintTimeBonus).toBe(10);
    expect(ind({ level: 9, spec5: 'temps' }).hintTimeBonus).toBe(15);
  });
  it('ultimes L10 : Clairvoyance (actif 5 ch.) / Sagesse partagée (passif)', () => {
    expect(ind({ level: 10, spec10: 'clairvoyance' }).activeCost).toBe(5);
    expect(ind({ level: 10, spec10: 'wisdom' }).sharedWisdom).toBe(true);
  });
});

describe('branches Bouclier câblées (or)', () => {
  it('Rempart doré (L5) : forfait d’or à l’usage du bouclier', () => {
    const t = teamWith('bouclier', { level: 5, spec5: 'gold', charges: 1 });
    t.money = 0;
    const r = applyRecul(t, BOARD, 3, true); // niv.5 : +5 or de palier + 5 or Rempart
    expect(r.bonusMoney).toBe(10);
    expect(r.patch.money).toBe(10);
  });
});

describe('Bouclier — passif, Forteresse, Sur-réduction (applyRecul)', () => {
  it('Passif L3 (−1) : réduit le recul SANS charge', () => {
    const t = teamWith('bouclier', { level: 3, charges: 0 }); // pas de charge → passif seul
    t.pos = 'n10';
    const r = applyRecul(t, BOARD, 3, true); // 3 − 1 (passif) = 2
    expect(r.applied).toBe(2);
    expect(r.patch.pos).toBe('n8');
  });

  it('Passif non cumulatif : avec charge, c’est la réduction active qui s’applique', () => {
    const t = teamWith('bouclier', { level: 4, charges: 1 }); // active 7, passif 1
    t.pos = 'n10';
    const r = applyRecul(t, BOARD, 3, true); // 3 − 7 → 0 (pas 3−7−1)
    expect(r.applied).toBe(0);
    expect(r.patch.powers.bouclier.charges).toBe(0); // charge consommée
  });

  it('Forteresse (L10) : le recul devient une AVANCE du montant évité', () => {
    const t = teamWith('bouclier', { level: 10, spec10: 'fortress', charges: 0 });
    t.pos = 'n3';
    const r = applyRecul(t, BOARD, 3, true);
    expect(r.forward).toBe(true);
    expect(r.advance).toBe(3);
    expect(r.patch.pos).toBe('n6'); // n3 + 3
  });

  it('Sur-réduction (L5) : le surplus de réduction fait avancer', () => {
    const t = teamWith('bouclier', { level: 5, spec5: 'surge', charges: 1 }); // réduction 8
    t.pos = 'n5';
    const r = applyRecul(t, BOARD, 3, true); // surplus 8−3 = 5 → avance 5
    expect(r.forward).toBe(true);
    expect(r.advance).toBe(5);
    expect(r.patch.pos).toBe('n10');
  });

  it('Sur-réduction L9 : signale un push « toutes » du surplus', () => {
    const t = teamWith('bouclier', { level: 9, spec5: 'surge', charges: 1 });
    t.pos = 'n5';
    const r = applyRecul(t, BOARD, 3, true);
    expect(r.surplusPush).toBe('all');
    expect(r.pushAmount).toBeGreaterThan(0);
  });

  it('Forteresse + Rempart doré : l’or est versé même quand Forteresse absorbe tout', () => {
    const t = teamWith('bouclier', { level: 10, spec5: 'gold', spec10: 'fortress', charges: 0 });
    t.money = 0; t.pos = 'n3';
    const r = applyRecul(t, BOARD, 3, true);
    expect(r.forward).toBe(true);
    expect(r.bonusMoney).toBe(30); // 15 (palier L10) + 15 (Rempart doré L9)
    expect(r.patch.money).toBe(30);
  });

  it('Forteresse court-circuite le bouclier de bois (avance pleine, bois préservé)', () => {
    const t = teamWith('bouclier', { level: 10, spec10: 'fortress', charges: 0 });
    t.itemShield = 3; t.pos = 'n3';
    const r = applyRecul(t, BOARD, 3, true);
    expect(r.advance).toBe(3);             // pas amputé par le bois
    expect(r.patch.itemShield).toBeUndefined(); // bois NON consommé
  });
});

describe('Bouclier — ultimes actifs (store)', () => {
  const S = () => useGameStore.getState();
  const base = (teams) => useGameStore.setState({
    phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
    extensions: { equipment: true, mastery: true }, teams, showTargetPicker: { powerKey: 'foudre' },
    emitVfx: () => {},
  });
  beforeEach(() => vi.spyOn(Math, 'random').mockReturnValue(0.5));
  afterEach(() => vi.restoreAllMocks());

  it('Immunité totale (L10) : dépense 5 charges, pose l’immunité 2 tours', () => {
    useGameStore.setState({
      phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
      extensions: { equipment: true, mastery: true },
      teams: [teamWith('bouclier', { level: 10, spec10: 'aegisTotal', charges: 5 })],
    });
    S().useShieldImmunity();
    expect(S().teams[0].totalImmuneTurns).toBe(2);
    expect(S().teams[0].powers.bouclier.charges).toBe(0);
  });

  it('Immunité : une Foudre adverse n’a aucun effet sur la cible immunisée', () => {
    base([
      teamWith('foudre', { level: 3 }),
      { ...teamWith('bouclier'), pos: 'n10', totalImmuneTurns: 2, powers: {} },
    ]);
    S().applyOffensivePower(1);
    expect(S().teams[1].pos).toBe('n10'); // recul bloqué
  });

  it('Immunité : Cataclysme (Foudre L10) épargne une équipe immunisée non ciblée', () => {
    base([
      teamWith('foudre', { level: 10, spec10: 'cataclysm' }),
      { ...teamWith('foudre'), pos: 'n6', powers: {} },
      { ...teamWith('foudre'), pos: 'n10', totalImmuneTurns: 2, powers: {} },
    ]);
    S().applyOffensivePower(1); // cible choisie = équipe 1 ; allOthers ajoute l'équipe 2
    expect(S().teams[2].pos).toBe('n10'); // immunisée épargnée malgré allOthers
    expect(S().teams[1].pos).not.toBe('n6'); // l'autre est bien touchée
  });

  it('Immunité : Tempête de sable (Sablier L10) n’affecte pas l’équipe immunisée', () => {
    base([
      teamWith('sablier', { level: 10, spec10: 'sandstorm' }),
      { ...teamWith('foudre'), pos: 'n8', totalImmuneTurns: 2, powers: {} },
    ]);
    S().applyOffensivePower(1);
    expect(S().teams[1].sablierActif).toBeFalsy();
  });

  it('Silence : empêche d’activer l’Immunité totale (charges intactes)', () => {
    useGameStore.setState({
      phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
      extensions: { equipment: true, mastery: true },
      teams: [{ ...teamWith('bouclier', { level: 10, spec10: 'aegisTotal', charges: 5 }), silencedNextTurn: true }],
    });
    S().useShieldImmunity();
    expect(S().teams[0].totalImmuneTurns ?? 0).toBe(0);
    expect(S().teams[0].powers.bouclier.charges).toBe(5);
  });

  it('Immunité : pas de re-cast tant qu’elle est active (anti double-dépense)', () => {
    useGameStore.setState({
      phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
      extensions: { equipment: true, mastery: true },
      teams: [{ ...teamWith('bouclier', { level: 10, spec10: 'aegisTotal', charges: 5 }), totalImmuneTurns: 2 }],
    });
    S().useShieldImmunity();
    expect(S().teams[0].powers.bouclier.charges).toBe(5); // pas re-dépensé
  });

  it('Sur-réduction « au choix » : ne recule pas une équipe immunisée', () => {
    useGameStore.setState({
      phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
      extensions: { equipment: true, mastery: true },
      teams: [teamWith('bouclier', { level: 9, spec5: 'surge' }), { ...teamWith('foudre'), pos: 'n10', totalImmuneTurns: 2, powers: {} }],
      showTargetPicker: { source: 'surge', amount: 3 },
    });
    S().selectTarget(1);
    expect(S().teams[1].pos).toBe('n10'); // immunisée non reculée
  });
});

describe('éditeur d’équilibrage : overrides de l’arbre Maîtrise', () => {
  afterEach(() => applyBalance({})); // restaure POWERS pour les autres tests

  it('override des coûts d’amélioration (L1→10)', () => {
    applyBalance({ powers: { foudre: { tree: { upgradeCosts: [5, 5, 5, 5, 5, 5, 5, 5, 5] } } } });
    expect(powerUpgradeCost('foudre', 1, true)).toBe(5);
    expect(powerUpgradeCost('foudre', 9, true)).toBe(5);
  });

  it('override d’une valeur de palier (scale)', () => {
    applyBalance({ powers: { sablier: { tree: { scale: [{ divisor: 9 }] } } } });
    expect(resolvePowerEffect({ powers: { sablier: { level: 1 } } }, 'sablier', true).divisor).toBe(9);
  });

  it('override d’un palier de voie per-power (Foudre Pillage, palier à L6)', () => {
    // Foudre : tierLevels [6,7,9] → tiers[0] s'applique dès le niveau 6.
    applyBalance({ powers: { foudre: { tree: { branch5: [{ tiers: [{ pillageMult: 9 }] }] } } } });
    expect(resolvePowerEffect({ powers: { foudre: { level: 6, spec5: 'pillage' } } }, 'foudre', true).pillageMult).toBe(9);
  });
});

describe('Relance — arbre de Maîtrise (résolveur, paliers, calibrage)', () => {
  const rl = (over) => resolvePowerEffect(teamWith('relance', over), 'relance', true);

  it('cœur : modes replace(L1)/best(L3)/sum(L6) + remboursement + Relance assurée (L8)', () => {
    expect(rl({ level: 1 }).mode).toBe('replace');
    expect(rl({ level: 3 }).mode).toBe('best');
    expect(rl({ level: 6 }).mode).toBe('sum');
    expect(rl({ level: 2 }).refundChance).toBe(0.10);
    expect(rl({ level: 4 }).refundChance).toBe(0.25);
    expect(rl({ level: 8 }).minRoll).toBe(3);
  });

  it('Lucrative : or ×1 (L5) → ×2 (L7, palier 1) → ×3 (L9, palier 2)', () => {
    expect(rl({ level: 5, spec5: 'lucrative' }).goldPerRoll).toBe(1);
    expect(rl({ level: 7, spec5: 'lucrative' }).goldPerRoll).toBe(2);
    expect(rl({ level: 9, spec5: 'lucrative' }).goldPerRoll).toBe(3);
  });

  it('renfort de voie : le palier s’applique au bon niveau (Opportune +temps)', () => {
    expect(rl({ level: 5, spec5: 'opportune' }).reqTimeBonus).toBe(10); // base
    expect(rl({ level: 7, spec5: 'opportune' }).reqTimeBonus).toBe(20); // palier L7
    expect(rl({ level: 9, spec5: 'opportune' }).reqTimeBonus).toBe(30); // palier L9
    expect(rl({ level: 5, spec5: 'opportune' }).reChooseSubject).toBe(true);
  });

  it('ultimes L10 (flat) : swap / lateStarter / vengeful', () => {
    expect(rl({ level: 10, spec10: 'swap' }).swapWithLeader).toBe(true);
    expect(rl({ level: 10, spec10: 'swap' }).swapCost).toBe(5);
    expect(rl({ level: 10, spec10: 'lateStarter' }).lateStarterCharge).toBe(1);
    expect(rl({ level: 10, spec10: 'vengeful' }).vengefulPushLeader).toBe(true);
  });

  it('override d’un palier de voie (tier L7/L9) via balanceConfig', () => {
    applyBalance({ powers: { relance: { tree: { branch5: [{ tiers: [{ goldPerRoll: 9 }] }] } } } });
    expect(rl({ level: 7, spec5: 'lucrative' }).goldPerRoll).toBe(9);
    applyBalance({}); // restaure
  });
});

describe('Relance — effets en jeu (store)', () => {
  const S = () => useGameStore.getState();
  const base = (teams) => useGameStore.setState({
    phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
    extensions: { equipment: true, mastery: true }, teams,
    preRollPos: 'n2', preRollValue: 2,
  });

  it('Échange de place (L10) : permute la position avec le leader et coûte 5 charges', () => {
    base([
      { ...teamWith('relance', { level: 10, spec10: 'swap', charges: 5 }), pos: 'n2' },
      { ...teamWith('relance'), pos: 'n10', powers: {} },
    ]);
    S().useRelanceSwap();
    expect(S().teams[0].pos).toBe('n10');
    expect(S().teams[1].pos).toBe('n2');
    expect(S().teams[0].powers.relance.charges).toBe(0);
  });

  it('Échange : sans leader devant (déjà 1ᵉʳ), aucun effet', () => {
    base([
      { ...teamWith('relance', { level: 10, spec10: 'swap', charges: 5 }), pos: 'n10' },
      { ...teamWith('relance'), pos: 'n2', powers: {} },
    ]);
    S().useRelanceSwap();
    expect(S().teams[0].pos).toBe('n10'); // inchangé
    expect(S().teams[0].powers.relance.charges).toBe(5);
  });

  it('Élan du retardataire (L10) : +1 charge de relance en début de tour si dernier', () => {
    base([
      { ...teamWith('relance'), pos: 'n10', powers: {} },
      { ...teamWith('relance', { level: 10, spec10: 'lateStarter', charges: 1 }), pos: 'n2' },
    ]);
    S().nextTurn(); // la main passe à l'équipe 1 (la moins avancée)
    expect(S().teams[1].powers.relance.charges).toBe(2);
  });

  it('vengeresse (L10) : la relance recule le leader de la valeur du dé', () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // dé D6 → 4 ; refund 0.5<0.25 = non
    base([
      { ...teamWith('relance', { level: 10, spec10: 'vengeful', charges: 2 }), pos: 'n1' },
      { ...teamWith('relance'), pos: 'n10', powers: {} },
    ]);
    useGameStore.setState({ preRollPos: 'n1', preRollValue: 2 });
    S().useRelance();
    vi.advanceTimersByTime(1000);
    expect(S().teams[1].pos).toBe('n6'); // n10 reculé de 4 (D6)
    vi.restoreAllMocks();
    vi.useRealTimers();
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

  it('Temps commun (L5) : pose le drapeau doubleSharedTimer', () => {
    cast({ level: 5, spec5: 'shared' });
    expect(S().teams[1].doubleSharedTimer).toBe(true);
  });

  it('Surcharge (ultime) : +2 questions garanties à chaque Double (plafonné)', () => {
    cast({ level: 10, spec10: 'surcharge' }); // base L10 add=3 + surcharge 2 = 5 → plafond 4
    expect(S().teams[1].doubleExtra).toBe(4);
  });

  it('Saboteur (voie, palier L9) : pose le niveau 3 sur la cible', () => {
    cast({ level: 9, spec5: 'saboteur' });
    expect(S().teams[1].doubleSaboteur).toBe(3);
  });

  it('Questions corsées (voie) : pose la chance Hardcore sur la cible', () => {
    cast({ level: 9, spec5: 'corsees' });
    expect(S().teams[1].doubleHCChance).toBe(0.15); // palier L9
  });

  it('Report (ultime) : pose le drapeau report', () => {
    cast({ level: 10, spec10: 'report' });
    expect(S().teams[1].doubleReport).toBe(true);
  });

  it('Cible tout le monde (ultime) : impose la Double à tous les adversaires', () => {
    useGameStore.setState({
      phase: 'game', devSandbox: true, board: BOARD, finished: false, currentTeam: 0, log: [],
      extensions: { equipment: true, mastery: true }, showTargetPicker: { powerKey: 'double' },
      teams: [teamWith('double', { level: 10, spec10: 'allOthers' }), { ...teamWith('foudre'), pos: 'n8', powers: {} }, { ...teamWith('foudre'), pos: 'n6', powers: {} }],
    });
    S().applyOffensivePower(1);
    expect(S().teams[1].doubleActive).toBe(true);
    expect(S().teams[2].doubleActive).toBe(true); // touché aussi
  });
});
