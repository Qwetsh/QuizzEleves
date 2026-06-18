// Achats pilotés depuis le téléphone : applyTeamIntent applique sur l'équipe du
// JETON (pas l'équipe active), et l'or/charge/niveau changent correctement.
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { POWERS } from '../data/powers.js';

const S = () => useGameStore.getState();

function team(i, over = {}) {
  return {
    name: `T${i}`, emoji: '🦁', color: '#111', pos: 'n1', token: `tok${i}`,
    money: 200, correct: 0, wrong: 0, powers: {},
    equipment: { head: null, body: null, feet: null }, bag: [],
    ...over,
  };
}

function setup(teams, over = {}) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, finished: false, currentTeam: 99, log: [],
    board: { n1: { x: 1, y: 0, type: 'subject', next: ['n2'] } },
    showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
    rolling: false, showDiceModal: false, awaitingChoice: false, pendingActions: null, pendingLanding: false,
    shopStock: [], enabledItems: [],
    teams,
    ...over,
  });
}

describe('applyTeamIntent : achats par équipe (téléphone)', () => {
  beforeEach(() => setup([team(0), team(1)]));

  it('buyItem : achète pour l’équipe du jeton (pas l’équipe active)', () => {
    setup([team(0), team(1)], { shopStock: ['bouclierBois'] });
    const before = S().teams[1].money;
    S().applyTeamIntent('tok1', 'buyItem', { key: 'bouclierBois' });
    const t1 = S().teams[1];
    const has = t1.equipment.body === 'bouclierBois'
      || (t1.bag || []).some((c) => (typeof c === 'string' ? c : c?.key) === 'bouclierBois');
    expect(has).toBe(true);
    expect(t1.money).toBeLessThan(before);
    expect(S().teams[0].money).toBe(200); // l'équipe active n'est pas touchée
  });

  it('buyPowerCharge : +1 charge sur un pouvoir possédé', () => {
    setup([team(0), team(1, { powers: { bouclier: { charges: 1, level: 1 } } })]);
    S().applyTeamIntent('tok1', 'buyPowerCharge', { key: 'bouclier' });
    expect(S().teams[1].powers.bouclier.charges).toBe(2);
    expect(S().teams[1].money).toBe(200 - (POWERS.bouclier.price || 15));
  });

  it('upgradePower : monte le niveau (et débite l’or)', () => {
    setup([team(0), team(1, { powers: { bouclier: { charges: 1, level: 1 } } })]);
    const before = S().teams[1].money;
    S().applyTeamIntent('tok1', 'upgradePower', { key: 'bouclier' });
    expect(S().teams[1].powers.bouclier.level).toBe(2);
    expect(S().teams[1].money).toBeLessThan(before);
  });

  it('buyPower : débloque un pouvoir non possédé', () => {
    S().applyTeamIntent('tok1', 'buyPower', { key: 'foudre' });
    expect(S().teams[1].powers.foudre).toBeTruthy();
    expect(S().teams[1].powers.foudre.level).toBe(1);
  });

  it('claimTeam : lie un jeton à une équipe puis l’achat via ce jeton s’applique', () => {
    setup([team(0), team(1)], { shopStock: ['bouclierBois'] });
    S().applyClaimIntent('phoneX', { idx: 0 });
    expect(S().teams[0].token).toBe('phoneX');
    const before = S().teams[0].money;
    S().applyTeamIntent('phoneX', 'buyItem', { key: 'bouclierBois' });
    expect(S().teams[0].money).toBeLessThan(before);
  });

  it('bloqué si l’équipe du jeton est ACTIVE et en pleine résolution', () => {
    setup([team(0), team(1, { powers: { bouclier: { charges: 1, level: 1 } } })],
      { currentTeam: 1, showQuestion: { question: {} } });
    S().applyTeamIntent('tok1', 'buyPowerCharge', { key: 'bouclier' });
    expect(S().teams[1].powers.bouclier.charges).toBe(1); // inchangé
    expect(S().teams[1].money).toBe(200);
  });
});
