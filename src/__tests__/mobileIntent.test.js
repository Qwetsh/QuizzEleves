// Tests : application des intentions mobiles (édition d'équipement à distance)
// par le TBI — mapping token→équipe, verrou de résolution, types d'actions.
import { describe, it, expect } from 'vitest';
import { useGameStore } from '../store/gameStore.js';
import { normalizeBag, cellKey } from '../store/itemHandlers.js';

const S = () => useGameStore.getState();
const EQUIP = 'chapeauPaille'; // équipement tête
const occupied = (bag) => normalizeBag(bag).filter(Boolean).map(cellKey);

const RESET = {
  showQuestion: null, showEvent: null, showFight: null, showDuelChoice: null,
  rolling: false, showDiceModal: false, awaitingChoice: false, pendingActions: null, pendingLanding: false,
};

function setup(over = {}) {
  useGameStore.setState({
    phase: 'game', devSandbox: true, finished: false, currentTeam: 0, log: [], ...RESET,
    teams: [
      { name: 'A', emoji: '🦁', color: '#111', money: 0, token: 'tA', equipment: { head: null, body: null, feet: null }, bag: [], powers: {} },
      { name: 'B', emoji: '🦅', color: '#222', money: 0, token: 'tB', equipment: { head: null, body: null, feet: null }, bag: [], powers: {} },
    ],
    ...over,
  });
}

describe('applyTeamIntent', () => {
  it('equip : équipe l’objet du sac de la BONNE équipe (par token)', () => {
    setup();
    useGameStore.setState({ teams: [S().teams[0], { ...S().teams[1], bag: [EQUIP] }] });
    S().applyTeamIntent('tB', 'equip', { key: EQUIP });
    expect(S().teams[1].equipment.head).toBe(EQUIP);
    expect(occupied(S().teams[1].bag)).toEqual([]);
    expect(S().teams[0].equipment.head).toBeNull(); // l'autre équipe intacte
  });

  it('unequip : range l’équipement dans le sac', () => {
    setup();
    useGameStore.setState({ teams: [S().teams[0], { ...S().teams[1], equipment: { head: EQUIP, body: null, feet: null } }] });
    S().applyTeamIntent('tB', 'unequip', { slot: 'head' });
    expect(S().teams[1].equipment.head).toBeNull();
    expect(occupied(S().teams[1].bag)).toContain(EQUIP);
  });

  it('sellEquip / sellBag : crédite l’or de l’équipe', () => {
    setup();
    useGameStore.setState({ teams: [S().teams[0], { ...S().teams[1], equipment: { head: EQUIP, body: null, feet: null } }] });
    S().applyTeamIntent('tB', 'sellEquip', { slot: 'head' });
    expect(S().teams[1].equipment.head).toBeNull();
    expect(S().teams[1].money).toBeGreaterThan(0);
  });

  it('jeton inconnu : aucune action (pas d’erreur)', () => {
    setup();
    useGameStore.setState({ teams: [S().teams[0], { ...S().teams[1], bag: [EQUIP] }] });
    expect(() => S().applyTeamIntent('???', 'equip', { key: EQUIP })).not.toThrow();
    expect(S().teams[1].equipment.head).toBeNull();
  });

  it('verrou : l’équipe ACTIVE ne peut pas éditer pendant une question', () => {
    setup({ currentTeam: 0, showQuestion: { question: {} } });
    useGameStore.setState({ teams: [{ ...S().teams[0], bag: [EQUIP] }, S().teams[1]] });
    S().applyTeamIntent('tA', 'equip', { key: EQUIP });
    expect(S().teams[0].equipment.head).toBeNull(); // bloqué
  });

  it('une équipe NON active peut éditer pendant la question d’une autre', () => {
    setup({ currentTeam: 0, showQuestion: { question: {} } });
    useGameStore.setState({ teams: [S().teams[0], { ...S().teams[1], bag: [EQUIP] }] });
    S().applyTeamIntent('tB', 'equip', { key: EQUIP });
    expect(S().teams[1].equipment.head).toBe(EQUIP); // autorisé
  });

  it('partie finie : édition bloquée', () => {
    setup({ finished: true });
    useGameStore.setState({ finished: true, teams: [S().teams[0], { ...S().teams[1], bag: [EQUIP] }] });
    S().applyTeamIntent('tB', 'equip', { key: EQUIP });
    expect(S().teams[1].equipment.head).toBeNull();
  });
});
