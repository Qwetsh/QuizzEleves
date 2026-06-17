// Extension « Troc » : application ATOMIQUE des échanges entre équipes (TBI).
import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from '../store/gameStore.js';

const S = () => useGameStore.getState();

function team(i, over = {}) {
  return {
    name: `T${i}`, emoji: '🦁', color: '#111', pos: 'n1',
    money: 50, correct: 0, wrong: 0, powers: {},
    equipment: { head: null, body: null, feet: null }, bag: [],
    ...over,
  };
}

function setup(teams) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, finished: false, currentTeam: 99, log: [],
    board: { n1: { x: 1, y: 0, type: 'subject', next: ['n2'] } },
    showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
    rolling: false, showDiceModal: false, awaitingChoice: false, pendingActions: null, pendingLanding: false,
    teams,
  });
}

describe('applyTrade : transfert atomique', () => {
  beforeEach(() => setup([team(0), team(1)]));

  it('don d’or simple', () => {
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { gold: 10 }, want: {} });
    expect(r.ok).toBe(true);
    expect(S().teams[0].money).toBe(40);
    expect(S().teams[1].money).toBe(60);
  });

  it('échange objet du sac contre or', () => {
    setup([team(0, { bag: ['bouclierBois'] }), team(1, { money: 30 })]);
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { bag: ['bouclierBois'] }, want: { gold: 20 } });
    expect(r.ok).toBe(true);
    // A : perd l'objet, gagne 20 or ; B : perd 20 or, reçoit l'objet
    expect(S().teams[0].money).toBe(70);
    expect((S().teams[1].bag || []).some((c) => (typeof c === 'string' ? c : c?.key) === 'bouclierBois')).toBe(true);
    expect(S().teams[1].money).toBe(10);
  });

  it('échange d’un équipement porté (placeItem : équipé si le slot du receveur est libre)', () => {
    setup([team(0, { equipment: { head: null, body: null, feet: 'bottesMontagne' } }), team(1)]);
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { equip: ['feet'] }, want: { gold: 5 } });
    expect(r.ok).toBe(true);
    expect(S().teams[0].equipment.feet).toBeNull();
    const t1 = S().teams[1];
    const has = t1.equipment.feet === 'bottesMontagne' || (t1.bag || []).some((c) => (typeof c === 'string' ? c : c?.key) === 'bottesMontagne');
    expect(has).toBe(true);
  });

  it('échoue (et ne change rien) si l’or est insuffisant', () => {
    const before0 = S().teams[0].money, before1 = S().teams[1].money;
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { gold: 999 }, want: {} });
    expect(r.ok).toBe(false);
    expect(S().teams[0].money).toBe(before0);
    expect(S().teams[1].money).toBe(before1);
  });

  it('échoue si l’objet demandé n’est pas possédé', () => {
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { gold: 5 }, want: { bag: ['bouclierBois'] } });
    expect(r.ok).toBe(false);
    expect(S().teams[0].money).toBe(50); // rien prélevé
  });

  it('refusé pendant une résolution si une des équipes est active', () => {
    useGameStore.setState({ currentTeam: 0, showQuestion: { question: {} } });
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { gold: 5 }, want: {} });
    expect(r.ok).toBe(false);
  });

  it('refusé si la partie est terminée', () => {
    useGameStore.setState({ finished: true });
    const r = S().applyTrade({ from_idx: 0, to_idx: 1, give: { gold: 5 }, want: {} });
    expect(r.ok).toBe(false);
  });
});
